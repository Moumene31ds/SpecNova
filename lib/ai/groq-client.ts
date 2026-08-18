import "server-only";

import Groq from "groq-sdk";

/**
 * Groq API client with retry, exponential backoff for 429 quota errors,
 * and in-memory cache to minimize API calls.
 *
 * Groq free tier: 30 RPM, 14,400 RPD per model.
 * Models: llama-3.3-70b-versatile (best), llama-3.1-8b-instant (fast).
 */

export const AI_MODEL =
  process.env.AI_EXTRACTION_MODEL ?? "llama-3.3-70b-versatile";

let groqClient: Groq | null = null;

function getClient(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

// ---------------------------------------------------------------------------
// In-memory cache (per-serverless-instance, survives warm invocations)
// ---------------------------------------------------------------------------

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown): void {
  if (cache.size > 200) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { data, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Web search via GSMArena page fetching for grounding
// ---------------------------------------------------------------------------

const SEARCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * Fetch a web page and return text content (for grounding).
 */
export async function fetchPageText(url: string, maxChars = 12000): Promise<string> {
  try {
    const res = await fetch(url, { headers: SEARCH_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return "";
    const html = await res.text();
    // Strip HTML tags, scripts, styles
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, maxChars);
  } catch {
    return "";
  }
}

/**
 * Search GSMArena for a device and return the specs page content.
 */
export async function searchDeviceSpecs(query: string): Promise<string> {
  const encoded = encodeURIComponent(query);
  // Try GSMArena search
  const searchUrl = `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encoded}`;
  const searchText = await fetchPageText(searchUrl, 4000);
  return searchText;
}

// ---------------------------------------------------------------------------
// Rate-limited Groq generateContent with retry + backoff
// ---------------------------------------------------------------------------

export interface GroqCallOptions {
  model?: string;
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  topP?: number;
  maxTokens: number;
  responseFormat?: { type: "json_object" };
}

const MAX_API_RETRIES = 3;
const BASE_DELAY_MS = 5000; // 5s initial backoff for 429

/**
 * Call Groq with automatic retry + exponential backoff on 429 quota errors.
 * On 429, waits `BASE_DELAY_MS * 2^attempt` before retrying.
 */
export async function groqGenerateContent(
  options: GroqCallOptions,
): Promise<{ text: string }> {
  const client = getClient();
  const model = options.model ?? AI_MODEL;

  for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: options.userMessage },
        ],
        temperature: options.temperature ?? 0.2,
        top_p: options.topP ?? 0.95,
        max_tokens: options.maxTokens,
        response_format: options.responseFormat,
      });

      const text = response.choices?.[0]?.message?.content ?? "";
      return { text };
    } catch (err: unknown) {
      const isQuota = isQuotaError(err);
      const isLastAttempt = attempt >= MAX_API_RETRIES;

      if (isQuota && !isLastAttempt) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[groq] 429 quota hit, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_API_RETRIES + 1})`,
        );
        await sleep(delay);
        continue;
      }

      throw err;
    }
  }

  throw new Error("Groq API: exhausted all retries.");
}

function isQuotaError(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err) {
    return (err as { status: number }).status === 429;
  }
  const msg = String(err);
  return msg.includes("429") || msg.includes("rate_limit") || msg.includes("RESOURCE_EXHAUSTED");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

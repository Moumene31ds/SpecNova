import "server-only";

import { GoogleGenAI } from "@google/genai";

/**
 * Shared Gemini client with retry, exponential backoff for 429 quota errors,
 * and in-memory cache to minimize API calls.
 */

export const AI_MODEL =
  process.env.AI_EXTRACTION_MODEL ?? "gemini-3.6-flash";

let geaiClient: InstanceType<typeof GoogleGenAI> | null = null;

function getClient(): InstanceType<typeof GoogleGenAI> {
  if (!geaiClient) {
    geaiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geaiClient;
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
  // Evict oldest entries if cache grows too large
  if (cache.size > 200) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { data, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Rate-limited Gemini generateContent with retry + backoff
// ---------------------------------------------------------------------------

export interface GeminiCallOptions {
  model?: string;
  systemInstruction: string;
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  tools?: Array<{ googleSearch: Record<string, never> }>;
  temperature?: number;
  topP?: number;
  maxOutputTokens: number;
  responseMimeType?: string;
}

const MAX_API_RETRIES = 3;
const BASE_DELAY_MS = 5000; // 5s initial backoff for 429

/**
 * Call Gemini with automatic retry + exponential backoff on 429 quota errors.
 * On 429, waits `BASE_DELAY_MS * 2^attempt` before retrying.
 */
export async function geminiGenerateContent(
  options: GeminiCallOptions,
): Promise<{ text: string; candidates?: unknown[]; groundingMetadata?: unknown }> {
  const client = getClient();
  const model = options.model ?? AI_MODEL;

  for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          tools: options.tools,
          temperature: options.temperature,
          topP: options.topP,
          maxOutputTokens: options.maxOutputTokens,
          responseMimeType: options.responseMimeType,
        },
      });

      return {
        text: response.text ?? "",
        candidates: response.candidates,
        groundingMetadata: response.candidates?.[0]?.groundingMetadata,
      };
    } catch (err: unknown) {
      const isQuota = isQuotaError(err);
      const isLastAttempt = attempt >= MAX_API_RETRIES;

      if (isQuota && !isLastAttempt) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[gemini] 429 quota hit, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_API_RETRIES + 1})`,
        );
        await sleep(delay);
        continue;
      }

      throw err;
    }
  }

  throw new Error("Gemini API: exhausted all retries.");
}

function isQuotaError(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err) {
    return (err as { status: number }).status === 429;
  }
  const msg = String(err);
  return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

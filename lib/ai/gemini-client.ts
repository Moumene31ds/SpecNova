import "server-only";

import { GoogleGenAI } from "@google/genai";

/**
 * Shared Gemini client with:
 * - Model rotation across 5 free-tier models (5 × 20 RPD = 100 RPD)
 * - Exponential backoff on 429/503
 * - In-memory cache (1 hour TTL)
 */

const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
];

let geaiClient: InstanceType<typeof GoogleGenAI> | null = null;

function getClient(): InstanceType<typeof GoogleGenAI> {
  if (geaiClient) return geaiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  geaiClient = new GoogleGenAI({ apiKey });
  return geaiClient;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

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
// Model rotation — track 429 per model, skip exhausted ones
// ---------------------------------------------------------------------------

const exhaustedUntil = new Map<string, number>(); // model → timestamp when quota resets

function pickModel(): string {
  const now = Date.now();
  for (const model of MODELS) {
    const until = exhaustedUntil.get(model) ?? 0;
    if (now >= until) return model;
  }
  // All exhausted — pick the one that resets soonest
  let best = MODELS[0]!;
  let bestUntil = Infinity;
  for (const model of MODELS) {
    const until = exhaustedUntil.get(model) ?? 0;
    if (until < bestUntil) {
      bestUntil = until;
      best = model;
    }
  }
  return best;
}

function markExhausted(model: string): void {
  // Quota resets at midnight UTC — mark exhausted until then
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  exhaustedUntil.set(model, tomorrow.getTime());
}

// ---------------------------------------------------------------------------
// API call with rotation + retry
// ---------------------------------------------------------------------------

export interface GeminiCallOptions {
  systemInstruction: string;
  userMessage: string;
  temperature?: number;
  topP?: number;
  maxTokens: number;
  responseMimeType?: string;
  useGoogleSearch?: boolean;
}

const MAX_API_RETRIES = 6; // Try all 5 models + 1 extra
const BASE_DELAY_MS = 3000;

export async function geminiGenerateContent(
  options: GeminiCallOptions,
): Promise<{ text: string; groundingMetadata?: Record<string, unknown> }> {
  const client = getClient();
  const triedModels = new Set<string>();

  for (let attempt = 0; attempt < MAX_API_RETRIES; attempt++) {
    const model = pickModel();
    triedModels.add(model);

    try {
      const response = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: options.userMessage }] }],
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.2,
          topP: options.topP ?? 0.95,
          maxOutputTokens: options.maxTokens,
          responseMimeType: options.responseMimeType ?? "application/json",
        },
        ...(options.useGoogleSearch ? { tools: [{ googleSearch: {} }] } : {}),
      });

      const text = response.text ?? "";
      const gm = (response as unknown as { groundingMetadata?: Record<string, unknown> }).groundingMetadata;
      return { text, groundingMetadata: gm };
    } catch (err: unknown) {
      const status = getErrorStatus(err);
      const isRetryable = status === 429 || status === 503;

      if (isRetryable) {
        markExhausted(model);
        console.warn(`[gemini] ${status} on ${model}, rotating to next model`);

        // If all models exhausted, wait before retrying
        if (triedModels.size >= MODELS.length) {
          await sleep(BASE_DELAY_MS * 2);
          triedModels.clear();
        }
        continue;
      }

      throw err;
    }
  }

  throw new Error("Gemini API: all models exhausted. Try again tomorrow.");
}

function getErrorStatus(err: unknown): number {
  if (err && typeof err === "object" && "status" in err) {
    return (err as { status: number }).status;
  }
  const msg = String(err);
  if (msg.includes("429")) return 429;
  if (msg.includes("503")) return 503;
  return 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

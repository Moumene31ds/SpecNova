import "server-only";

import { z } from "zod";
import {
  geminiGenerateContent,
  getCached,
  setCache,
} from "./gemini-client";

export const AI_DISCOVERY_MODEL = "gemini-3.6-flash (rotating)";

/**
 * Brand catalog discovery with web fetch grounding.
 * Fetches GSMArena + Google search results for the brand's latest phones,
 * then uses Groq LLM to extract the complete catalog.
 * Caches results for 1 hour to minimize API calls.
 */

export const BRAND_CATALOG_MAX_MODELS = 120;
const DISCOVERY_MAX_OUTPUT_TOKENS = 8192;

export const BrandCatalogSchema = z.object({
  brand: z.string().min(1),
  models: z
    .array(
      z.object({
        /** Official product name WITHOUT the brand prefix, e.g. "Galaxy S25 Ultra". */
        name: z.string().min(1),
        modelNumbers: z.array(z.string()).default([]),
        codename: z.string().nullish(),
        status: z.string().default("available"),
        announcedAt: z.string().nullish(),
        releaseAt: z.string().nullish(),
      }),
    )
    .min(0)
    .max(BRAND_CATALOG_MAX_MODELS),
});

export type BrandCatalogModel = z.infer<typeof BrandCatalogSchema>["models"][number];
export type BrandCatalog = z.infer<typeof BrandCatalogSchema>;

// No web fetch — training knowledge is sufficient for brand catalogs.

const PROMPT = `List phones from this brand into JSON. PRIORITIZE 2024-2026 models first, then older. Include flagships, mid-range, budget. Cap at 120.

JSON: {"brand":"","models":[{"name":"without brand","modelNumbers":[],"codename":null,"status":"available","announcedAt":null,"releaseAt":null}]}

Rules: status=rumored|announced|upcoming|available|discontinued. Put NEWEST phones first. ONLY output JSON.`;

/** Discover the brand's full model catalog with web fetch grounding. Retries up to 2 times on malformed JSON. */
export async function discoverBrand(brand: string): Promise<{
  catalog: BrandCatalog;
  raw: string;
}> {
  const cacheKey = `discover:${brand.toLowerCase().trim()}`;
  const cached = getCached<{ catalog: BrandCatalog; raw: string }>(cacheKey);
  if (cached) return cached;

  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isRetry = attempt > 0;

    const userMessage = isRetry ? `${brand}\nRetry: Valid JSON only.` : brand;

    const response = await geminiGenerateContent({
      systemInstruction: PROMPT,
      userMessage,
      temperature: isRetry ? 0 : 0.1,
      topP: 0.9,
      maxTokens: DISCOVERY_MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
      useGoogleSearch: true,
    });

    const raw = response.text;
    if (!raw.trim()) {
      if (attempt < MAX_RETRIES) continue;
      throw new Error("Groq returned an empty catalog after all retries.");
    }

    try {
      const parsed = parseJsonObject(raw);
      const catalog = BrandCatalogSchema.parse(parsed);
      if (catalog.models.length === 0 && attempt < MAX_RETRIES) {
        continue;
      }
      const result = { catalog, raw };
      setCache(cacheKey, result);
      return result;
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        const msg = err instanceof z.ZodError
          ? `Schema validation failed after ${MAX_RETRIES + 1} attempts:\n${err.message.slice(0, 500)}`
          : err instanceof SyntaxError
            ? `JSON parse error after ${MAX_RETRIES + 1} attempts: ${err.message}`
            : `Discovery failed: ${String(err).slice(0, 300)}`;
        throw new Error(msg);
      }
    }
  }

  throw new Error("Discovery failed unexpectedly.");
}

// ---------------------------------------------------------------------------
// JSON Parser with truncation repair (shared logic)
// ---------------------------------------------------------------------------

function parseJsonObject(text: string): unknown {
  let cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  if (firstBrace === -1 && firstBracket === -1) {
    throw new SyntaxError("No JSON object or array found in response.");
  }
  const startIdx = firstBrace === -1
    ? firstBracket
    : firstBracket === -1
      ? firstBrace
      : Math.min(firstBrace, firstBracket);
  if (startIdx > 0) {
    cleaned = cleaned.slice(startIdx);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const repaired = repairTruncatedJson(cleaned);
    return JSON.parse(repaired);
  }
}

function repairTruncatedJson(text: string): string {
  let result = text.replace(/,\s*$/, "");

  let inString = false;
  let escape = false;
  let braces = 0;
  let brackets = 0;

  for (let i = 0; i < result.length; i++) {
    const ch = result[i]!;
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") braces++;
    if (ch === "}") braces--;
    if (ch === "[") brackets++;
    if (ch === "]") brackets--;
  }

  if (inString) result += '"';

  const lastColon = result.lastIndexOf(":");
  if (lastColon > 0) {
    const afterColon = result.slice(lastColon + 1).trim();
    if (afterColon && !afterColon.match(/^[\]}\d"true false null]/)) {
      const lastComma = result.lastIndexOf(",", lastColon);
      const lastOpenBrace = Math.max(result.lastIndexOf("{", lastColon), result.lastIndexOf("[", lastColon));
      if (lastComma > lastOpenBrace && lastComma > 0) {
        result = result.slice(0, lastComma);
      } else if (lastOpenBrace >= 0) {
        result = result.slice(0, lastOpenBrace + 1);
        braces = 0;
        brackets = 0;
        for (const ch of result) {
          if (ch === "{") braces++;
          if (ch === "}") braces--;
          if (ch === "[") brackets++;
          if (ch === "]") brackets--;
        }
      }
    }
  }

  while (brackets > 0) { result += "]"; brackets--; }
  while (braces > 0) { result += "}"; braces--; }

  return result;
}

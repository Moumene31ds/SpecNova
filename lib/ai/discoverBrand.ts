import "server-only";

import { z } from "zod";
import {
  groqGenerateContent,
  fetchPageText,
  getCached,
  setCache,
  AI_MODEL,
} from "./groq-client";

export const AI_DISCOVERY_MODEL = AI_MODEL;

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
        status: z.enum(["rumored", "announced", "upcoming", "available", "discontinued"]),
        announcedAt: z.string().nullish(),
        releaseAt: z.string().nullish(),
      }),
    )
    .min(0)
    .max(BRAND_CATALOG_MAX_MODELS),
});

export type BrandCatalogModel = z.infer<typeof BrandCatalogSchema>["models"][number];
export type BrandCatalog = z.infer<typeof BrandCatalogSchema>;

async function fetchBrandWebContext(brand: string): Promise<string> {
  const queries = [
    `${brand} latest phones 2025 2026`,
    `${brand} all phone models complete catalog`,
    `${brand} new phone announcements`,
  ];

  const results = await Promise.all(
    queries.map(async (q) => {
      const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&num=8&hl=en`;
      return fetchPageText(url, 3000);
    }),
  );

  // Also fetch GSMArena brand page
  const gsmarenaUrl = `https://www.gsmarena.com/${brand.toLowerCase().replace(/\s+/g, "-")}-phones-f-35-0-p1.php`;
  const gsmarenaText = await fetchPageText(gsmarenaUrl, 4000);

  const parts: string[] = [];
  if (gsmarenaText) parts.push(`=== GSMArena ${brand} Phones ===\n${gsmarenaText}`);
  results.forEach((r, i) => {
    if (r) parts.push(`=== Search ${i + 1}: ${queries[i]} ===\n${r}`);
  });

  return parts.join("\n\n---\n\n");
}

const PROMPT = `You are SpecNova's world-class device-catalog librarian — an encyclopedic authority on every smartphone ever manufactured.

INPUT: a smartphone brand name + pre-fetched web data containing the brand's phone catalog info.

YOUR MISSION: produce the most COMPLETE and ACCURATE catalog of every phone this brand has ever made, using the provided web data.

CRITICAL RULES:
1. RETURN ONE strict JSON object with the brand's complete phone catalog.
2. Include EVERY phone the brand has shipped in the last 8-10 years, PLUS all announced/upcoming models.
3. Include iconic older devices that are still relevant (flagships, foldables, gaming phones).
4. Cap the list at ${BRAND_CATALOG_MAX_MODELS} entries — prioritize flagships and best-sellers.
5. "name" is the official product name WITHOUT the brand prefix (e.g. "Galaxy S25 Ultra", not "Samsung Galaxy S25 Ultra").
6. "modelNumbers": real SKU / market numbers when known (e.g. "SM-S938U1", "CPH2573"). Use null if unknown.
7. "codename": internal codename only when publicly known, else null.
8. "status": current lifecycle status. Be accurate — don't mark discontinued phones as "available".
9. "announcedAt"/"releaseAt": ISO dates (YYYY-MM-DD) when known, else null.
10. NEVER invent phones. If you cannot verify a model exists, leave it out. Accuracy beats completeness.
11. One entry per model family — do NOT create separate entries for storage/color variants.
12. Include sub-brands (e.g. for Xiaomi: include "Redmi", "POCO", "Black Shark" models).
13. MOST IMPORTANTLY: include ALL phones from 2025-2026 that appear in your web data.

JSON SCHEMA:
{
  "brand": "string",
  "models": [
    {
      "name": "string (without brand prefix)",
      "modelNumbers": ["string"],
      "codename": "string|null",
      "status": "rumored|announced|upcoming|available|discontinued",
      "announcedAt": "YYYY-MM-DD|null",
      "releaseAt": "YYYY-MM-DD|null"
    }
  ]
}

Return ONLY the JSON object. No markdown fences, no commentary, no explanation.`;

/** Discover the brand's full model catalog with web fetch grounding. Retries up to 2 times on malformed JSON. */
export async function discoverBrand(brand: string): Promise<{
  catalog: BrandCatalog;
  raw: string;
}> {
  const cacheKey = `discover:${brand.toLowerCase().trim()}`;
  const cached = getCached<{ catalog: BrandCatalog; raw: string }>(cacheKey);
  if (cached) return cached;

  const MAX_RETRIES = 2;

  // Gather web context once
  const webContext = await fetchBrandWebContext(brand);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isRetry = attempt > 0;

    let retryHint = "";
    if (isRetry) {
      retryHint = `\n\nATTEMPT ${attempt + 1}/${MAX_RETRIES + 1}: Your previous response was malformed. Issues found:\n${attempt === 1 ? "JSON parse error — output was truncated or contained invalid syntax." : "Schema validation failed."}\n\nIMPORTANT: Output COMPLETE, VALID JSON only. Do not truncate. Do not add markdown fences. Output ONLY the raw JSON object.`;
    }

    const userMessage = `Brand: ${brand}\n\n${webContext ? `=== WEB SEARCH DATA ===\n${webContext}\n\n=== END WEB DATA ===\n\nExtract the complete phone catalog from the data above.${retryHint}` : `No web search data available. Use your training knowledge to list all phones from this brand.${retryHint}`}`;

    const response = await groqGenerateContent({
      systemPrompt: PROMPT,
      userMessage,
      temperature: isRetry ? 0 : 0.1,
      topP: 0.9,
      maxTokens: DISCOVERY_MAX_OUTPUT_TOKENS,
      responseFormat: { type: "json_object" },
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
        retryHint = `\n\nATTEMPT ${attempt + 1}: You returned an EMPTY models array. You MUST include at least 5 phone models. Search the web data again and include ALL phones from this brand.`;
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

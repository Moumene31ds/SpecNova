import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AI_EXTRACTION_MODEL } from "./extractSpecs";

export const AI_DISCOVERY_MODEL = AI_EXTRACTION_MODEL;

/**
 * Brand catalog discovery with live web grounding.
 *
 * Uses Google Search Grounding so Gemini searches the web in real-time
 * for the very latest phone models — including devices announced today.
 */

const geai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const BRAND_CATALOG_MAX_MODELS = 120;
const DISCOVERY_MAX_OUTPUT_TOKENS = 16384;

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
    .min(1)
    .max(BRAND_CATALOG_MAX_MODELS),
});

export type BrandCatalogModel = z.infer<typeof BrandCatalogSchema>["models"][number];
export type BrandCatalog = z.infer<typeof BrandCatalogSchema>;

const PROMPT = `You are SpecNova's world-class device-catalog librarian — an encyclopedic authority on every smartphone ever manufactured.

CRITICAL: You have Google Search access. USE IT. Search the web for the LATEST phone models from this brand, especially any devices announced or released in 2025-2026. Your training data may be outdated — the web search results are your source of truth.

INPUT: a smartphone brand name.

YOUR MISSION: produce the most COMPLETE and ACCURATE catalog of every phone this brand has ever made, by searching the live web for the latest information.

SEARCH STRATEGY:
- ALWAYS search for "[brand] latest phones 2025 2026", "[brand] all phone models", "[brand] new phone announcements".
- Search for "[brand] phone lineup" and "[brand] complete catalog" for comprehensive lists.
- For sub-brands, search "[brand] [sub-brand] phones" separately.

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
13. MOST IMPORTANTLY: include ALL phones from 2025-2026 that appear in your web search results.

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

/** Discover the brand's full model catalog with live web search. Retries up to 2 times on malformed JSON. */
export async function discoverBrand(brand: string): Promise<{
  catalog: BrandCatalog;
  raw: string;
}> {
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isRetry = attempt > 0;
    const response = await geai.models.generateContent({
      model: AI_EXTRACTION_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: brand },
            ...(isRetry
              ? [{ text: `ATTEMPT ${attempt + 1}/${MAX_RETRIES + 1}: Your previous response was malformed. Issues found:\n${attempt === 1 ? "JSON parse error — output was truncated or contained invalid syntax." : "Schema validation failed."}\n\nIMPORTANT: Output COMPLETE, VALID JSON only. Do not truncate. Do not add markdown fences. Output ONLY the raw JSON object.` }]
              : []),
          ],
        },
      ],
      config: {
        systemInstruction: PROMPT,
        tools: [{ googleSearch: {} }],
        temperature: isRetry ? 0 : 0.1,
        topP: 0.9,
        maxOutputTokens: DISCOVERY_MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";
    if (!raw.trim()) {
      if (attempt < MAX_RETRIES) continue;
      throw new Error("Gemini returned an empty catalog after all retries.");
    }

    try {
      const parsed = parseJsonObject(raw);
      return { catalog: BrandCatalogSchema.parse(parsed), raw };
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

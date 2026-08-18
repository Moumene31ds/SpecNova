import "server-only";

import { z } from "zod";
import {
  geminiGenerateContent,
  getCached,
  setCache,
} from "./gemini-client";

export const AI_DISCOVERY_MODEL = "gemini-3.6-flash (rotating)";

/**
 * Brand catalog discovery — fetches the COMPLETE model lineup.
 * Uses a 2-phase approach: first discovers flagships + recent models,
 * then asks for mid-range, budget, foldables, and older models.
 */

export const BRAND_CATALOG_MAX_MODELS = 120;
const DISCOVERY_MAX_OUTPUT_TOKENS = 16384;

export const BrandCatalogSchema = z.object({
  brand: z.string().min(1),
  models: z
    .array(
      z.object({
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

// Phase 1: Flagships + 2024-2026 models
const PROMPT_PHASE1 = `You are a phone catalog expert. Search the web for ALL phones made by this brand. Use Google Search to find the COMPLETE list.

List EVERY phone model this brand has released. Include:
- Flagship series (Pro, Ultra, Max, Plus variants)
- Sub-flagship / premium mid-range
- Mid-range series
- Budget / entry-level
- Foldable / flip phones
- Gaming phones
- Tablets if they make phones too (only phone models)

Output JSON array. Include modelNumbers if known (SM-XXXX, etc).
Status: rumored|announced|upcoming|available|discontinued

Output: {"brand":"","models":[{"name":"Model Name","modelNumbers":[],"codename":null,"status":"available","announcedAt":null,"releaseAt":null}]}

RULES:
- Include ALL variants: base, Pro, Ultra, Max, Plus, Lite, SE, Mini, FE, etc.
- Include ALL series, not just flagships
- Name = official product name without brand prefix (e.g. "Galaxy S25 Ultra")
- Newest phones first
- Status = available for released phones
- ONLY valid JSON. No markdown.`;

// Phase 2: Ask for more if the first response seems incomplete
const PROMPT_PHASE2 = `You are a phone catalog expert. The previous search returned these models. Now search the web again and add ANY MISSING models.

Focus on finding models from these categories that may be missing:
- Older models (2020-2023)
- Budget and entry-level series
- Regional variants
- Foldable and flip phones
- Gaming phones
- Special editions
- All sub-variants (Pro, Ultra, Max, Plus, Lite, FE, SE, Mini)

Return ONLY the NEW models not in the existing list. If no new models, return {"brand":"","models":[]}

Output: {"brand":"","models":[{"name":"Model Name","modelNumbers":[],"codename":null,"status":"available","announcedAt":null,"releaseAt":null}]}

ONLY valid JSON. No markdown.`;

/** Discover the brand's full model catalog. Phase 1 + Phase 2 for completeness. */
export async function discoverBrand(brand: string): Promise<{
  catalog: BrandCatalog;
  raw: string;
}> {
  const cacheKey = `discover:${brand.toLowerCase().trim()}`;
  const cached = getCached<{ catalog: BrandCatalog; raw: string }>(cacheKey);
  if (cached) return cached;

  // Phase 1: Main discovery
  const phase1 = await discoverPhase(brand, PROMPT_PHASE1);
  let allModels = [...phase1.catalog.models];
  let rawLog = `=== Phase 1: ${allModels.length} models ===\n${phase1.raw}\n`;

  // Phase 2: Fill gaps if we got fewer than 60 models (brands usually have 50-120)
  if (allModels.length < 60) {
    try {
      const existingNames = allModels.map((m) => m.name).join(", ");
      const phase2 = await discoverPhase(
        brand,
        `${PROMPT_PHASE2}\n\nExisting models already found: ${existingNames}`,
      );
      const newModels = phase2.catalog.models.filter(
        (m) => !allModels.some((e) => e.name.toLowerCase() === m.name.toLowerCase()),
      );
      allModels = [...allModels, ...newModels];
      rawLog += `\n=== Phase 2: +${newModels.length} new models ===\n${phase2.raw}`;
    } catch {
      // Phase 2 failure is non-fatal — use Phase 1 results
      rawLog += "\n=== Phase 2: skipped (error) ===";
    }
  }

  const catalog: BrandCatalog = {
    brand: phase1.catalog.brand || brand,
    models: allModels.slice(0, BRAND_CATALOG_MAX_MODELS),
  };

  const result = { catalog, raw: rawLog };
  setCache(cacheKey, result);
  return result;
}

/** Single discovery phase with retry logic. */
async function discoverPhase(
  brand: string,
  prompt: string,
): Promise<{ catalog: BrandCatalog; raw: string }> {
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isRetry = attempt > 0;

    const userMessage = isRetry ? `${brand}\nRetry: Return valid JSON only.` : brand;

    const response = await geminiGenerateContent({
      systemInstruction: prompt,
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
      throw new Error("Gemini returned an empty catalog after all retries.");
    }

    try {
      const parsed = parseJsonObject(raw);
      const catalog = BrandCatalogSchema.parse(parsed);
      if (catalog.models.length === 0 && attempt < MAX_RETRIES) {
        continue;
      }
      return { catalog, raw };
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        const msg = err instanceof z.ZodError
          ? `Schema validation failed:\n${err.message.slice(0, 500)}`
          : err instanceof SyntaxError
            ? `JSON parse error: ${err.message}`
            : `Discovery failed: ${String(err).slice(0, 300)}`;
        throw new Error(msg);
      }
    }
  }

  throw new Error("Discovery failed unexpectedly.");
}

// ---------------------------------------------------------------------------
// JSON Parser with truncation repair
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

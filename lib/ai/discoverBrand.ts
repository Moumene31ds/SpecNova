import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AI_EXTRACTION_MODEL } from "./extractSpecs";

export const AI_DISCOVERY_MODEL = AI_EXTRACTION_MODEL;

/**
 * Brand catalog discovery — stage 1 of the Brand Importer.
 *
 * Given a phone maker ("Samsung", "Xiaomi", "OnePlus") this module asks
 * Gemini for a compact, non-invented list of every model the brand makes
 * (name + model numbers + codename + lifecycle). Each listed model is then
 * passed through the full single-device extraction engine (`extractSpecs`)
 * — that second stage is what produces the very-high-accuracy spec sheets.
 *
 * Splitting discovery from extraction keeps every structured response well
 * inside the output-token budget (a full brand catalog is far too large for
 * one response, and a single request per model keeps accuracy highest).
 */

const geai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    .min(1)
    .max(BRAND_CATALOG_MAX_MODELS),
});

export type BrandCatalogModel = z.infer<typeof BrandCatalogSchema>["models"][number];
export type BrandCatalog = z.infer<typeof BrandCatalogSchema>;

const PROMPT = `You are SpecNova's device-catalog librarian.

Input: a smartphone brand name.

Task: return ONE strict JSON object with the brand's complete phone catalog.

RULES:
- "models" is a list of EVERY phone the brand has shipped, PLUS announced /
  upcoming models. Prioritize completeness for the last 8 years; include
  iconic older devices. Cap the list at ${BRAND_CATALOG_MAX_MODELS} entries.
- "name" is the official product name WITHOUT the brand prefix
  (e.g. "Galaxy S25 Ultra", "iPhone 17 Pro", "Pixel 10 Pro", "13R").
  One entry per model family — do not create separate entries for storage
  or color variants.
- "modelNumbers": real SKU / market numbers (e.g. "SM-S938U1") when known.
- "codename": internal codename only when publicly known, else null.
- "status": current lifecycle status. Never mark rumored unless the device
  is genuinely leaked/expected.
- "announcedAt"/"releaseAt": ISO dates (YYYY-MM-DD) when known, else null.
- NEVER invent phones. If you cannot verify a model exists, leave it out.
  Accuracy beats completeness — a wrong entry poisons the catalog.

EXACT JSON SHAPE:
{
  "brand": string,
  "models": [
    { "name": string, "modelNumbers": string[], "codename": string|null,
      "status": "rumored"|"announced"|"upcoming"|"available"|"discontinued",
      "announcedAt": string|null, "releaseAt": string|null }
  ]
}

Return ONLY the JSON object. No markdown fences, no commentary.`;

/** Discover the brand's full model catalog. Retries once on malformed JSON. */
export async function discoverBrand(brand: string): Promise<{
  catalog: BrandCatalog;
  raw: string;
}> {
  const generate = (retryHint?: string) =>
    geai.models.generateContent({
      model: AI_EXTRACTION_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: brand },
            ...(retryHint ? [{ text: retryHint }] : []),
          ],
        },
      ],
      config: {
        systemInstruction: PROMPT,
        temperature: 0.1,
        topP: 0.9,
        maxOutputTokens: DISCOVERY_MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
      },
    });

  const response = await generate();
  const raw = response.text ?? "";
  if (!raw.trim()) throw new Error("Gemini returned an empty catalog.");

  const parsed = parseJsonObject(raw);
  try {
    return { catalog: BrandCatalogSchema.parse(parsed), raw };
  } catch (firstErr) {
    const retry = await generate(
      `Your previous output failed schema validation:\n${
        firstErr instanceof z.ZodError ? firstErr.message : String(firstErr)
      }\n\nRe-issue the corrected JSON only.`,
    );
    const raw2 = retry.text ?? "";
    return { catalog: BrandCatalogSchema.parse(parseJsonObject(raw2)), raw: raw2 };
  }
}

function parseJsonObject(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

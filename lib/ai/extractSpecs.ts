import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

/**
 * AI Magic Auto-Fill — structured spec extraction with live web grounding.
 *
 * Uses Google Search Grounding so Gemini searches the web in real-time
 * for the latest phone specifications — including devices released today.
 */

export const AI_EXTRACTION_MODEL =
  process.env.AI_EXTRACTION_MODEL ?? "gemini-2.5-flash";

const geai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CameraSchema = z.object({
  kind: z.enum(["wide", "ultrawide", "telephoto", "periscope", "macro", "depth", "selfie"]),
  megapixels: z.number().nullish(),
  aperture: z.string().nullish(),
  sensorSize: z.string().nullish(),
  pixelSize: z.string().nullish(),
  fieldOfViewDeg: z.number().nullish(),
  opticalZoom: z.number().nullish(),
  digitalZoom: z.number().nullish(),
  stabilization: z.enum(["OIS", "OIS+EIS", "EIS", "none"]).nullish(),
  video: z.array(z.string()).default([]),
});

export const AiExtractedDeviceSchema = z.object({
  brand: z.string().min(1),
  name: z.string().min(1),
  modelNumbers: z.array(z.string()).default([]),
  codename: z.string().nullish(),
  status: z.enum(["rumored", "announced", "upcoming", "available", "discontinued"]),
  announcedAt: z.string().nullish(),
  releaseAt: z.string().nullish(),
  specs: z.object({
    body: z.object({
      dimensions: z.object({
        widthMm: z.number().nullish(),
        heightMm: z.number().nullish(),
        depthMm: z.number().nullish(),
      }).nullish(),
      weightG: z.number().nullish(),
      build: z.string().nullish(),
      materials: z.array(z.string()).default([]),
      protection: z.string().nullish(),
      ipRating: z.string().nullish(),
      colors: z.array(z.string()).default([]),
    }),
    display: z.object({
      type: z.enum(["OLED", "AMOLED", "LTPO AMOLED", "LCD", "Mini-LED"]).nullish(),
      sizeIn: z.number().nullish(),
      resolution: z.string().nullish(),
      ppi: z.number().nullish(),
      refreshRateHz: z.number().nullish(),
      peakBrightnessNits: z.number().nullish(),
      hdrSupport: z.array(z.string()).default([]),
      pwmHz: z.number().nullish(),
      glass: z.string().nullish(),
      colorDepth: z.string().nullish(),
    }),
    platform: z.object({
      os: z.string().nullish(),
      ui: z.string().nullish(),
      chipset: z.string().nullish(),
      cpu: z.string().nullish(),
      gpu: z.string().nullish(),
      antutuV10: z.number().nullish(),
      geekbench6: z.object({
        single: z.number().nullish(),
        multi: z.number().nullish(),
      }).nullish(),
    }),
    memory: z.object({
      ramOptions: z.array(z.number()).default([]),
      storageOptions: z.array(z.number()).default([]),
      storageType: z.enum(["UFS 2.2", "UFS 3.1", "UFS 4.0", "eMMC 5.1"]).nullish(),
      cardSlot: z.boolean().nullish(),
    }),
    cameras: z.object({
      rear: z.array(CameraSchema).default([]),
      front: z.array(CameraSchema).default([]),
      features: z.array(z.string()).default([]),
      videoCapabilities: z.array(z.string()).default([]),
    }),
    audio: z.object({
      speakers: z.array(z.string()).default([]),
      headphoneJack: z.boolean().nullish(),
      codecs: z.array(z.string()).default([]),
      microphone: z.string().nullish(),
    }),
    battery: z.object({
      capacityMah: z.number().nullish(),
      type: z.string().nullish(),
      chargingWatts: z.number().nullish(),
      chargingTimeMin: z.number().nullish(),
      wirelessWatts: z.number().nullish(),
      reverseWirelessWatts: z.number().nullish(),
      enduranceHours: z.number().nullish(),
    }),
    connectivity: z.object({
      wifi: z.string().nullish(),
      bluetooth: z.string().nullish(),
      nfc: z.boolean().nullish(),
      usb: z.string().nullish(),
      irBlaster: z.boolean().nullish(),
      gnss: z.array(z.string()).default([]),
      bands: z.array(z.string()).default([]),
    }),
    sensors: z.array(z.string()).default([]),
    extras: z.object({
      fingerprint: z.enum(["under-display", "side", "rear", "none"]).nullish(),
      faceUnlock: z.boolean().nullish(),
      stylus: z.boolean().nullish(),
      esim: z.boolean().nullish(),
      uwb: z.boolean().nullish(),
      satelliteSos: z.boolean().nullish(),
    }),
  }),
  variants: z
    .array(
      z.object({
        name: z.string(),
        region: z.string(),
        chipset: z.string().nullish(),
        ramGb: z.number().nullish(),
        storageGb: z.number().nullish(),
        modem: z.string().nullish(),
        note: z.string().nullish(),
      }),
    )
    .default([]),
  confidence: z.object({
    overall: z.number().min(0).max(1),
    verifiedFields: z.array(z.string()).default([]),
    estimatedFields: z.array(z.string()).default([]),
    unavailableFields: z.array(z.string()).default([]),
  }),
  sources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        kind: z.enum(["official", "tenaa", "fcc", "retailer", "benchmark"]),
      }),
    )
    .default([]),
});

export type AiExtractedDevice = z.infer<typeof AiExtractedDeviceSchema>;

// ---------------------------------------------------------------------------
// Prompt — grounded in live web search
// ---------------------------------------------------------------------------

const PROMPT = `You are SpecNova's world-class device-spec engineer — the single most accurate phone specification database on the planet.

CRITICAL: You have Google Search access. USE IT. Search the web for the LATEST official specifications, especially for phones announced or released in 2025-2026. Your training data may be outdated — the web search results are your source of truth.

INPUT: a device name the user wants documented (e.g. "Samsung Galaxy S25 Ultra", "iPhone 17 Pro Max", "Xiaomi 15 Ultra", "OnePlus 14").

YOUR MISSION: produce the most accurate, complete, and detailed spec sheet ever assembled for this device by searching the live web.

SEARCH STRATEGY:
- ALWAYS search for "[device name] specifications" on GSMArena, official manufacturer pages, and tech review sites.
- For very new phones (2025-2026), search multiple sources to cross-verify specs.
- Search for "[device name] camera specs", "[device name] battery test", "[device name] benchmarks" for detailed data.
- Use the search results to fill in EVERY field with verified data.

CRITICAL RULES:
1. RETURN ONE strict JSON object matching the EXACT structure below.
2. Fill EVERY field you can verify with precision from web search results. Use null ONLY when truly unknown.
3. NEVER invent, guess, or hallucinate specs. If uncertain, use null and mark in confidence.unavailableFields.
4. Preserve official marketing names exactly (e.g. "Snapdragon 8 Elite", "LTPO AMOLED", "Armor Aluminum").
5. Numbers: strip units (mm, g, Hz, nits, mAh, W). Dates: ISO 8601 (YYYY-MM-DD).
6. Be EXHAUSTIVE on cameras — one entry per physical lens/sensor, rear then front order.
7. Include ALL known cellular bands as individual strings (e.g. "n1", "n3", "B20", "B28").
8. List ALL sensors, ALL connectivity features, ALL audio capabilities.
9. For variants: include EVERY regional SKU you know about.
10. For sources: prefer URLs from your web search results (gsmarena.com, phonearena.com, official manufacturer pages, tenaa.cn, fcc.gov, nanoreview.net, antutu.com).

CAMERA ENTRIES — for each lens include:
- kind: "wide"|"ultrawide"|"telephoto"|"periscope"|"macro"|"depth"|"selfie"
- megapixels, aperture (e.g. "f/1.7"), sensorSize (e.g. "1/1.3\\""), pixelSize (e.g. "1.6μm")
- fieldOfViewDeg, opticalZoom, digitalZoom, stabilization ("OIS"|"OIS+EIS"|"EIS"|"none")
- video capabilities array

CONFIDENCE SCORING:
- overall: fraction of fields you are confident about (0.0 to 1.0)
- verifiedFields: dotted paths for fields backed by official/cross-checked sources
- estimatedFields: fields inferred from reliable but not primary sources
- unavailableFields: fields not publicly documented

JSON SCHEMA:
{
  "brand": "string",
  "name": "string (without brand prefix)",
  "modelNumbers": ["string"],
  "codename": "string|null",
  "status": "rumored|announced|upcoming|available|discontinued",
  "announcedAt": "YYYY-MM-DD|null",
  "releaseAt": "YYYY-MM-DD|null",
  "specs": {
    "body": { "dimensions": {"widthMm": num|null,"heightMm": num|null,"depthMm": num|null}, "weightG": num|null, "build": "string|null", "materials": ["string"], "protection": "string|null", "ipRating": "string|null", "colors": ["string"] },
    "display": { "type": "OLED|AMOLED|LTPO AMOLED|LCD|Mini-LED|null", "sizeIn": num|null, "resolution": "string|null", "ppi": num|null, "refreshRateHz": num|null, "peakBrightnessNits": num|null, "hdrSupport": ["string"], "pwmHz": num|null, "glass": "string|null", "colorDepth": "string|null" },
    "platform": { "os": "string|null", "ui": "string|null", "chipset": "string|null", "cpu": "string|null", "gpu": "string|null", "antutuV10": num|null, "geekbench6": {"single": num|null, "multi": num|null}|null },
    "memory": { "ramOptions": [num], "storageOptions": [num], "storageType": "UFS 2.2|UFS 3.1|UFS 4.0|eMMC 5.1|null", "cardSlot": bool|null },
    "cameras": { "rear": [CameraEntry], "front": [CameraEntry], "features": ["string"], "videoCapabilities": ["string"] },
    "audio": { "speakers": ["string"], "headphoneJack": bool|null, "codecs": ["string"], "microphone": "string|null" },
    "battery": { "capacityMah": num|null, "type": "string|null", "chargingWatts": num|null, "chargingTimeMin": num|null, "wirelessWatts": num|null, "reverseWirelessWatts": num|null, "enduranceHours": num|null },
    "connectivity": { "wifi": "string|null", "bluetooth": "string|null", "nfc": bool|null, "usb": "string|null", "irBlaster": bool|null, "gnss": ["string"], "bands": ["string"] },
    "sensors": ["string"],
    "extras": { "fingerprint": "under-display|side|rear|none|null", "faceUnlock": bool|null, "stylus": bool|null, "esim": bool|null, "uwb": bool|null, "satelliteSos": bool|null }
  },
  "variants": [ {"name": "string", "region": "string", "chipset": "string|null", "ramGb": num|null, "storageGb": num|null, "modem": "string|null", "note": "string|null"} ],
  "confidence": { "overall": num, "verifiedFields": ["string"], "estimatedFields": ["string"], "unavailableFields": ["string"] },
  "sources": [ {"title": "string", "url": "string (real URL)", "kind": "official|tenaa|fcc|retailer|benchmark"} ]
}

Return ONLY the JSON object. No markdown fences, no commentary, no explanation.`;

/** Hard cap — increased to prevent truncation on complex devices. */
const MAX_OUTPUT_TOKENS = 16384;

// ---------------------------------------------------------------------------
// Source extraction from grounding metadata
// ---------------------------------------------------------------------------

function extractGroundingSources(
  groundingChunks?: Array<{ web?: { title?: string; uri?: string } }>,
): { title: string; url: string; kind: "official" | "tenaa" | "fcc" | "retailer" | "benchmark" }[] {
  if (!groundingChunks?.length) return [];

  const seen = new Set<string>();
  const sources: { title: string; url: string; kind: "official" | "tenaa" | "fcc" | "retailer" | "benchmark" }[] = [];

  for (const chunk of groundingChunks) {
    const web = chunk.web;
    if (!web?.uri) continue;
    if (seen.has(web.uri)) continue;
    seen.add(web.uri);

    const domain = web.uri.toLowerCase();
    let kind: "official" | "tenaa" | "fcc" | "retailer" | "benchmark" = "retailer";
    if (domain.includes("gsmarena.com") || domain.includes("phonearena.com") || domain.includes("notebookcheck") || domain.includes("androidauthority.com") || domain.includes("xda-developers.com") || domain.includes("91mobiles.com") || domain.includes("smartprix.com")) {
      kind = "retailer";
    } else if (domain.includes("tenaa.cn")) {
      kind = "tenaa";
    } else if (domain.includes("fcc.gov") || domain.includes("fccid.io")) {
      kind = "fcc";
    } else if (domain.includes("antutu.com") || domain.includes("nanoreview.net") || domain.includes("geekbench")) {
      kind = "benchmark";
    } else if (domain.includes("samsung.com") || domain.includes("apple.com") || domain.includes("xiaomi.com") || domain.includes("oneplus.com") || domain.includes("google.com") || domain.includes("motorola.com") || domain.includes("sony.com") || domain.includes("huawei.com")) {
      kind = "official";
    }

    sources.push({
      title: web.title ?? new URL(web.uri).hostname,
      url: web.uri,
      kind,
    });
  }

  return sources;
}

/**
 * Extract a fully-typed spec sheet for a device query.
 * Uses Google Search Grounding so Gemini can access the LIVE web for
 * the latest phone specifications — even phones released today.
 * Retries up to 2 times on malformed JSON or schema validation failures.
 */
export async function extractSpecs(query: string): Promise<{
  device: AiExtractedDevice;
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
            { text: query },
            ...(isRetry
              ? [{ text: `ATTEMPT ${attempt + 1}/${MAX_RETRIES + 1}: Your previous response was malformed. Issues found:\n${attempt === 1 ? "JSON parse error — output was truncated or contained invalid syntax." : "Schema validation failed."}\n\nIMPORTANT: Output COMPLETE, VALID JSON only. Do not truncate. Do not add markdown fences. Do not add commentary. Output ONLY the raw JSON object, starting with { and ending with }.` }]
              : []),
          ],
        },
      ],
      config: {
        systemInstruction: PROMPT,
        tools: [{ googleSearch: {} }],
        temperature: isRetry ? 0 : 0.2,
        topP: 0.95,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";
    if (!raw.trim()) {
      if (attempt < MAX_RETRIES) continue;
      throw new Error("Gemini returned an empty extraction after all retries.");
    }

    try {
      const parsed = parseJsonObject(raw);
      const device = AiExtractedDeviceSchema.parse(parsed);

      // Merge grounding metadata sources with AI-provided sources
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const groundingSources = extractGroundingSources(
        groundingChunks as Array<{ web?: { title?: string; uri?: string } }> | undefined,
      );

      if (groundingSources.length > 0) {
        const existingUrls = new Set(device.sources.map((s) => s.url));
        for (const gs of groundingSources) {
          if (!existingUrls.has(gs.url)) {
            device.sources.push(gs);
            existingUrls.add(gs.url);
          }
        }
      }

      return { device, raw };
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        const msg = err instanceof z.ZodError
          ? `Schema validation failed after ${MAX_RETRIES + 1} attempts:\n${err.message.slice(0, 500)}`
          : err instanceof SyntaxError
            ? `JSON parse error after ${MAX_RETRIES + 1} attempts: ${err.message}`
            : `Extraction failed: ${String(err).slice(0, 300)}`;
        throw new Error(msg);
      }
    }
  }

  throw new Error("Extraction failed unexpectedly.");
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

  // Strip any leading/trailing non-JSON text (e.g. "Here is the JSON:")
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

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt repair for truncated JSON
    const repaired = repairTruncatedJson(cleaned);
    return JSON.parse(repaired);
  }
}

/**
 * Attempt to repair truncated JSON by closing unclosed strings, arrays,
 * and objects in the correct order.
 */
function repairTruncatedJson(text: string): string {
  let result = text;

  // Remove any trailing comma before closing
  result = result.replace(/,\s*$/, "");

  // Count unclosed delimiters
  let inString = false;
  let escape = false;
  let braces = 0;
  let brackets = 0;

  for (let i = 0; i < result.length; i++) {
    const ch = result[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") braces++;
    if (ch === "}") braces--;
    if (ch === "[") brackets++;
    if (ch === "]") brackets--;
  }

  // If we're inside a string, close it
  if (inString) {
    result += '"';
  }

  // Remove trailing incomplete key-value (e.g. "someKey": "someVa")
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
        // Reset bracket counts since we truncated
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

  // Close remaining brackets/braces in reverse order
  while (brackets > 0) {
    result += "]";
    brackets--;
  }
  while (braces > 0) {
    result += "}";
    braces--;
  }

  return result;
}

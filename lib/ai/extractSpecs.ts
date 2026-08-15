import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

/**
 * AI Magic Auto-Fill — structured spec extraction.
 *
 * The Admin Studio sends a human query ("Samsung Galaxy S25 Ultra") and this
 * module asks `gemini-2.5-flash` for a complete, typed spec sheet in a single
 * pass. The zod schema mirrors `DeviceSpecs` in lib/firebase/types.ts so the
 * editor can map results onto the draft device 1:1; unknown values are null
 * (never invented), and every field carries a confidence classification that
 * drives the UI badges.
 */

export const AI_EXTRACTION_MODEL =
  process.env.AI_EXTRACTION_MODEL ?? "gemini-3.5-flash";

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
// Prompt
// ---------------------------------------------------------------------------

const PROMPT = `You are SpecNova's senior device-spec engineer filling a relational spec sheet.

Input: a device the user wants documented.

Task: return ONE strict JSON object matching the EXACT structure below. Fill
EVERY field you can verify; use null when a value is unknown or unannounced.
NEVER invent, guess, or extrapolate specs. Preserve official naming (e.g.
"Snapdragon 8 Elite", "LTPO AMOLED"). Numbers keep their units stripped
(mm, g, in, Hz, nits, mAh, W). Dates use ISO 8601 (YYYY-MM-DD).

Camera entries: one per physical lens, in rear then front order. For each
lens include kind, megapixels, aperture, sensorSize, pixelSize,
fieldOfViewDeg, opticalZoom, digitalZoom, stabilization, video.
Selfie cameras go under "front".

Bands: use 3G/4G/5G band identifiers exactly as published (e.g. "n77", "n1",
"B28", "B20"). If only regional groups are known (e.g. "5G: n1/n3/n7/n28/n38/
n40/n41/n77/n78"), split them into individual band strings.

confidence.verifiedFields: dotted paths (e.g. "specs.display.sizeIn",
"specs.platform.chipset") for fields backed by official or cross-checked
sources. confidence.estimatedFields: fields inferred or lower-confidence.
confidence.unavailableFields: fields that are not publicly documented yet.
overall is the fraction of filled fields the model is confident about (0-1).

variants: list known regional SKU variants (name, region, chipset, ramGb,
storageGb, modem, note). Leave empty when variants are not public.

sources: 1-4 canonical URLs (official spec pages, gsmarena, tenaa, fcc)
supporting the extraction.

EXACT JSON SHAPE:
${"/* see schema */"}
{
  "brand": string,
  "name": string,
  "modelNumbers": string[],
  "codename": string|null,
  "status": "rumored"|"announced"|"upcoming"|"available"|"discontinued",
  "announcedAt": string|null,
  "releaseAt": string|null,
  "specs": {
    "body": { "dimensions": {"widthMm": number|null,"heightMm": number|null,"depthMm": number|null}, "weightG": number|null, "build": string|null, "materials": string[], "protection": string|null, "ipRating": string|null, "colors": string[] },
    "display": { "type": "OLED"|"AMOLED"|"LTPO AMOLED"|"LCD"|"Mini-LED"|null, "sizeIn": number|null, "resolution": string|null, "ppi": number|null, "refreshRateHz": number|null, "peakBrightnessNits": number|null, "hdrSupport": string[], "pwmHz": number|null, "glass": string|null, "colorDepth": string|null },
    "platform": { "os": string|null, "ui": string|null, "chipset": string|null, "cpu": string|null, "gpu": string|null, "antutuV10": number|null, "geekbench6": {"single": number|null, "multi": number|null}|null },
    "memory": { "ramOptions": number[], "storageOptions": number[], "storageType": "UFS 2.2"|"UFS 3.1"|"UFS 4.0"|"eMMC 5.1"|null, "cardSlot": boolean|null },
    "cameras": { "rear": [ { "kind": string, "megapixels": number|null, "aperture": string|null, "sensorSize": string|null, "pixelSize": string|null, "fieldOfViewDeg": number|null, "opticalZoom": number|null, "digitalZoom": number|null, "stabilization": string|null, "video": string[] } ], "front": [ same ], "features": string[], "videoCapabilities": string[] },
    "audio": { "speakers": string[], "headphoneJack": boolean|null, "codecs": string[], "microphone": string|null },
    "battery": { "capacityMah": number|null, "type": string|null, "chargingWatts": number|null, "chargingTimeMin": number|null, "wirelessWatts": number|null, "reverseWirelessWatts": number|null, "enduranceHours": number|null },
    "connectivity": { "wifi": string|null, "bluetooth": string|null, "nfc": boolean|null, "usb": string|null, "irBlaster": boolean|null, "gnss": string[], "bands": string[] },
    "sensors": string[],
    "extras": { "fingerprint": "under-display"|"side"|"rear"|"none"|null, "faceUnlock": boolean|null, "stylus": boolean|null, "esim": boolean|null, "uwb": boolean|null, "satelliteSos": boolean|null }
  },
  "variants": [ { "name": string, "region": string, "chipset": string|null, "ramGb": number|null, "storageGb": number|null, "modem": string|null, "note": string|null } ],
  "confidence": { "overall": number, "verifiedFields": string[], "estimatedFields": string[], "unavailableFields": string[] },
  "sources": [ { "title": string, "url": string, "kind": string } ]
}

Return ONLY the JSON object. No markdown fences, no commentary.`;

/** Hard cap so a runaway model can't blow the request budget. */
const MAX_OUTPUT_TOKENS = 6144;

/**
 * Extract a fully-typed spec sheet for a device query. Retries once with the
 * zod validation error when the model returns malformed JSON.
 */
export async function extractSpecs(query: string): Promise<{
  device: AiExtractedDevice;
  raw: string;
}> {
  const response = await geai.models.generateContent({
    model: AI_EXTRACTION_MODEL,
    contents: [{ role: "user", parts: [{ text: query }] }],
    config: {
      systemInstruction: PROMPT,
      temperature: 0.2,
      topP: 0.95,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
    },
  });

  const raw = response.text ?? "";
  if (!raw.trim()) throw new Error("Gemini returned an empty extraction.");

  const parsed = parseJsonObject(raw);
  try {
    return { device: AiExtractedDeviceSchema.parse(parsed), raw };
  } catch (firstErr) {
    // One corrective retry with the validation error as feedback.
    const retryResponse = await geai.models.generateContent({
      model: AI_EXTRACTION_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: query },
            {
              text: `Your previous output failed schema validation:\n${
                firstErr instanceof z.ZodError ? firstErr.message : String(firstErr)
              }\n\nRe-issue the corrected JSON only.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: PROMPT,
        temperature: 0,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
      },
    });
    const raw2 = retryResponse.text ?? "";
    return { device: AiExtractedDeviceSchema.parse(parseJsonObject(raw2)), raw: raw2 };
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

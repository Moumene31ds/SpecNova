import "server-only";

import { z } from "zod";
import {
  geminiGenerateContent,
  getCached,
  setCache,
  AI_MODEL,
} from "./gemini-client";

export const AI_EXTRACTION_MODEL = AI_MODEL;

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
      dimensions: z
        .object({
          widthMm: z.number().nullish(),
          heightMm: z.number().nullish(),
          depthMm: z.number().nullish(),
        })
        .default({}),
      weightG: z.number().nullish(),
      build: z.string().nullish(),
      materials: z.array(z.string()).default([]),
      protection: z.string().nullish(),
      ipRating: z.string().nullish(),
      colors: z.array(z.string()).default([]),
    }),
    display: z.object({
      type: z.string().nullish(),
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
      geekbench6: z
        .object({
          single: z.number().nullish(),
          multi: z.number().nullish(),
        })
        .default({}),
    }),
    memory: z.object({
      ramOptions: z.array(z.number()).default([]),
      storageOptions: z.array(z.number()).default([]),
      storageType: z.string().nullish(),
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
  images: z.object({
    heroImage: z.string().url().nullish(),
    gallery: z.array(z.string().url()).default([]),
    renderImages: z.array(z.string().url()).default([]),
  }).default({}),
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

// No web fetch — training knowledge is sufficient for 99% of phones.
// This keeps requests under Groq's 8000 TPM free tier limit.

// ---------------------------------------------------------------------------
// Prompt — compact for Groq free tier (8000 TPM limit)
// ---------------------------------------------------------------------------

const PROMPT = `You have Google Search. Search the web for the LATEST specs of this phone. Use real web data, not training memory.

JSON:
{"brand":"","name":"","modelNumbers":[],"codename":null,"status":"available","announcedAt":null,"releaseAt":null,"specs":{"body":{"dimensions":{"widthMm":0,"heightMm":0,"depthMm":0},"weightG":0,"build":"","materials":[],"protection":"","ipRating":"","colors":[]},"display":{"type":"","sizeIn":0,"resolution":"","ppi":0,"refreshRateHz":0,"peakBrightnessNits":0,"hdrSupport":[],"pwmHz":0,"glass":"","colorDepth":""},"platform":{"os":"","ui":"","chipset":"","cpu":"","gpu":"","antutuV10":0,"geekbench6":{"single":0,"multi":0}},"memory":{"ramOptions":[],"storageOptions":[],"storageType":"","cardSlot":false},"cameras":{"rear":[{"kind":"wide","megapixels":0,"aperture":"","sensorSize":"","pixelSize":"","fieldOfViewDeg":0,"opticalZoom":0,"digitalZoom":0,"stabilization":"OIS","video":[]}],"front":[{"kind":"selfie","megapixels":0,"aperture":"","sensorSize":"","pixelSize":"","fieldOfViewDeg":0,"opticalZoom":0,"digitalZoom":0,"stabilization":"EIS","video":[]}],"features":[],"videoCapabilities":[]},"audio":{"speakers":[],"headphoneJack":false,"codecs":[],"microphone":""},"battery":{"capacityMah":0,"type":"","chargingWatts":0,"chargingTimeMin":0,"wirelessWatts":0,"reverseWirelessWatts":0,"enduranceHours":0},"connectivity":{"wifi":"","bluetooth":"","nfc":false,"usb":"","irBlaster":false,"gnss":[],"bands":[]},"sensors":[],"extras":{"fingerprint":"","faceUnlock":false,"stylus":false,"esim":false,"uwb":false,"satelliteSos":false}},"variants":[],"images":{"heroImage":null,"gallery":[],"renderImages":[]},"confidence":{"overall":0.9,"verifiedFields":[],"estimatedFields":[],"unavailableFields":[]},"sources":[{"title":"","url":"","kind":"retailer"}]}

null=unknown. Numbers only. ONLY output JSON.`;

/** Max output tokens. */
const MAX_OUTPUT_TOKENS = 4096;

// ---------------------------------------------------------------------------
// Extract a fully-typed spec sheet for a device query.
// Uses Groq LLM with web fetch grounding (GSMArena + Google).
// Caches results for 1 hour to minimize API calls.
// Retries up to 2 times — first retry targets missing fields, second retry fixes JSON.
// ---------------------------------------------------------------------------

export async function extractSpecs(query: string): Promise<{
  device: AiExtractedDevice;
  raw: string;
}> {
  const cacheKey = `extract:${query.toLowerCase().trim()}`;
  const cached = getCached<{ device: AiExtractedDevice; raw: string }>(cacheKey);
  if (cached) return cached;

  const MAX_RETRIES = 2;
  let lastDevice: AiExtractedDevice | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isRetry = attempt > 0;

    let userMessage = query;
    if (isRetry && attempt === 1 && lastDevice) {
      const missing = findMissingFields(lastDevice);
      userMessage += `\nMissing: ${missing}`;
    } else if (isRetry) {
      userMessage += `\nRetry: Valid JSON only.`;
    }

    const response = await geminiGenerateContent({
      systemInstruction: PROMPT,
      userMessage,
      temperature: isRetry ? 0 : 0.2,
      topP: 0.95,
      maxTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
      useGoogleSearch: true,
    });

    const raw = response.text;
    if (!raw.trim()) {
      if (attempt < MAX_RETRIES) continue;
      throw new Error("Gemini returned an empty extraction after all retries.");
    }

    try {
      const parsed = parseJsonObject(raw);
      const device = AiExtractedDeviceSchema.parse(parsed);
      lastDevice = device;

      // Extract grounding sources from Google Search
      const gm = response.groundingMetadata as { groundingChunks?: Array<{ web?: { title?: string; uri?: string } }> } | undefined;
      const groundingChunks = gm?.groundingChunks;
      if (groundingChunks?.length) {
        const seen = new Set(device.sources.map((s) => s.url));
        for (const chunk of groundingChunks) {
          const web = chunk.web;
          if (!web?.uri || seen.has(web.uri)) continue;
          seen.add(web.uri);
          device.sources.push({
            title: web.title ?? new URL(web.uri).hostname,
            url: web.uri,
            kind: "retailer",
          });
        }
      }

      // If this is attempt 1+ and we got valid data, check if it's complete enough
      if (isRetry) {
        const missingCount = countNullFields(device);
        if (missingCount > 5 && attempt < MAX_RETRIES) {
          continue;
        }
      }

      const result = { device, raw };
      setCache(cacheKey, result);
      return result;
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
// Source inference from web data
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Missing field detection for smart retries
// ---------------------------------------------------------------------------

function countNullFields(device: AiExtractedDevice): number {
  let count = 0;
  const s = device.specs;
  if (!s.body.dimensions?.widthMm) count++;
  if (!s.body.dimensions?.heightMm) count++;
  if (!s.body.dimensions?.depthMm) count++;
  if (!s.body.weightG) count++;
  if (!s.body.build) count++;
  if (!s.body.ipRating) count++;
  if (!s.body.colors.length) count++;
  if (!s.display.type) count++;
  if (!s.display.sizeIn) count++;
  if (!s.display.resolution) count++;
  if (!s.display.refreshRateHz) count++;
  if (!s.display.peakBrightnessNits) count++;
  if (!s.platform.chipset) count++;
  if (!s.platform.cpu) count++;
  if (!s.platform.gpu) count++;
  if (!s.platform.antutuV10) count++;
  if (!s.platform.geekbench6?.single) count++;
  if (!s.memory.ramOptions.length) count++;
  if (!s.memory.storageOptions.length) count++;
  if (!s.cameras.rear.length) count++;
  if (!s.cameras.front.length) count++;
  if (!s.battery.capacityMah) count++;
  if (!s.battery.chargingWatts) count++;
  if (!s.connectivity.wifi) count++;
  if (!s.connectivity.bluetooth) count++;
  if (!s.connectivity.bands.length) count++;
  if (!s.sensors.length) count++;
  return count;
}

function findMissingFields(device: AiExtractedDevice): string {
  const missing: string[] = [];
  const s = device.specs;

  if (!s.body.dimensions?.widthMm || !s.body.weightG) missing.push("- body dimensions (widthMm, heightMm, depthMm) and weightG");
  if (!s.body.build) missing.push("- body build materials (e.g. 'Titanium frame, glass back')");
  if (!s.body.ipRating) missing.push("- IP rating (e.g. 'IP68')");
  if (!s.body.colors.length) missing.push("- color options");

  if (!s.display.type) missing.push("- display type (OLED/AMOLED/LTPO AMOLED)");
  if (!s.display.sizeIn) missing.push("- display size in inches");
  if (!s.display.resolution) missing.push("- display resolution (e.g. '3120x1440')");
  if (!s.display.peakBrightnessNits) missing.push("- peak brightness in nits");
  if (!s.display.ppi) missing.push("- PPI density");
  if (!s.display.glass) missing.push("- protective glass type");

  if (!s.platform.chipset) missing.push("- chipset name");
  if (!s.platform.cpu) missing.push("- CPU configuration");
  if (!s.platform.gpu) missing.push("- GPU name");
  if (!s.platform.os) missing.push("- OS version");
  if (!s.platform.antutuV10) missing.push("- AnTuTu v10 score");
  if (!s.platform.geekbench6?.single) missing.push("- Geekbench 6 scores (single + multi)");

  if (!s.memory.ramOptions.length) missing.push("- RAM options in GB");
  if (!s.memory.storageOptions.length) missing.push("- storage options in GB");
  if (!s.memory.storageType) missing.push("- storage type (UFS 4.0 etc)");
  if (s.memory.cardSlot === null || s.memory.cardSlot === undefined) missing.push("- microSD card slot (true/false)");

  if (!s.cameras.rear.length) missing.push("- rear cameras (megapixels, aperture, sensor size, stabilization)");
  if (!s.cameras.front.length) missing.push("- front camera specs");

  if (!s.battery.capacityMah) missing.push("- battery capacity in mAh");
  if (!s.battery.chargingWatts) missing.push("- wired charging wattage");
  if (!s.battery.wirelessWatts && s.battery.wirelessWatts !== 0) missing.push("- wireless charging wattage");
  if (!s.battery.enduranceHours) missing.push("- battery endurance hours");

  if (!s.connectivity.wifi) missing.push("- WiFi standard");
  if (!s.connectivity.bluetooth) missing.push("- Bluetooth version");
  if (!s.connectivity.bands.length) missing.push("- cellular bands list");
  if (s.connectivity.nfc === null || s.connectivity.nfc === undefined) missing.push("- NFC support (true/false)");
  if (s.connectivity.irBlaster === null || s.connectivity.irBlaster === undefined) missing.push("- IR blaster (true/false)");

  if (!s.sensors.length) missing.push("- sensors list");
  if (!s.extras.fingerprint) missing.push("- fingerprint sensor type");
  if (s.extras.faceUnlock === null || s.extras.faceUnlock === undefined) missing.push("- face unlock (true/false)");
  if (s.extras.esim === null || s.extras.esim === undefined) missing.push("- eSIM support (true/false)");
  if (s.extras.uwb === null || s.extras.uwb === undefined) missing.push("- UWB support (true/false)");
  if (s.extras.satelliteSos === null || s.extras.satelliteSos === undefined) missing.push("- satellite SOS (true/false)");

  if (!s.audio.speakers.length) missing.push("- speaker type");
  if (s.audio.headphoneJack === null || s.audio.headphoneJack === undefined) missing.push("- headphone jack (true/false)");

  if (!device.images.heroImage) missing.push("- official product image URL");

  return missing.length > 0 ? missing.join("\n") : "None — all fields filled!";
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

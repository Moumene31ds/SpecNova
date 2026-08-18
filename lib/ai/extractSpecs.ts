import "server-only";

import { z } from "zod";
import {
  groqGenerateContent,
  fetchPageText,
  getCached,
  setCache,
  AI_MODEL,
} from "./groq-client";

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

// ---------------------------------------------------------------------------
// Web search grounding — fetch real specs pages before calling LLM
// ---------------------------------------------------------------------------

function gsmarenaUrl(query: string): string {
  const encoded = encodeURIComponent(query.replace(/\s+/g, "+"));
  return `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encoded}`;
}

async function fetchGoogleSearch(query: string): Promise<string> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=en`;
  const text = await fetchPageText(url, 6000);
  return text;
}

async function fetchGSMArenaSpecs(query: string): Promise<string> {
  // Step 1: search GSMArena
  const searchUrl = gsmarenaUrl(query);
  const searchText = await fetchPageText(searchUrl, 4000);

  // Extract the first phone page link from search results
  const phoneLinkMatch = searchText.match(/([a-z0-9_-]+)\.php/i);
  let specsText = "";

  if (phoneLinkMatch) {
    const phoneUrl = `https://www.gsmarena.com/${phoneLinkMatch[0]}`;
    specsText = await fetchPageText(phoneUrl, 12000);
  }

  return specsText;
}

/**
 * Gather web context from multiple sources for grounding.
 */
async function gatherWebContext(query: string): Promise<string> {
  const [gsmarena, google1, google2] = await Promise.all([
    fetchGSMArenaSpecs(query),
    fetchGoogleSearch(`${query} full specifications`),
    fetchGoogleSearch(`${query} benchmarks antutu geekbench score battery endurance`),
  ]);

  const parts: string[] = [];
  if (gsmarena) parts.push(`=== GSMArena Specs Page ===\n${gsmarena}`);
  if (google1) parts.push(`=== Google Search: ${query} specifications ===\n${google1}`);
  if (google2) parts.push(`=== Google Search: ${query} benchmarks & battery ===\n${google2}`);

  return parts.join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Prompt — adapted for Groq (no built-in web search, uses fetched context)
// ---------------------------------------------------------------------------

const PROMPT = `You are the world's most thorough phone specification engineer. You receive pre-fetched web data from GSMArena, Google, and other sources. USE THIS DATA to fill in every field accurately.

INPUT: A device name (e.g. "Samsung Galaxy S25 Ultra") + pre-fetched web search data containing specs.

YOUR JOB: Fill in EVERY SINGLE FIELD below with real, verified data from the provided web context. Null is ONLY acceptable for truly non-existent or unpublished data.

RULES:
1. Fill EVERY field with real data. null ONLY when truly impossible to find.
2. NEVER invent or hallucinate. Use only the provided web search data.
3. Preserve official marketing names exactly.
4. Numbers only — strip units (mm, g, Hz, nits, mAh, W).
5. Dates: ISO 8601 (YYYY-MM-DD).
6. If benchmark scores appear in the web data, use them. If not found, set to null.
7. If battery endurance hours appear in the web data, use them. If not, null.
8. If camera sensor sizes appear, use them. If not, null.
9. confidence.overall should reflect how complete the data is: 0.90+ if most fields found, 0.70-0.89 if partial, 0.50-0.69 if limited.
10. For images.heroImage: find any direct image URL from the web data (e.g. gsmarena.com/vv/bigpic/...). If none found, leave null.
11. For images.gallery: extract multiple image URLs if available.
12. For images.renderImages: extract official press render URLs if available.
13. For sources: list the URLs you actually used from the web data.

JSON SCHEMA (match EXACTLY):
{
  "brand": "string",
  "name": "string (without brand)",
  "modelNumbers": ["SM-XXXX", "etc"],
  "codename": "string|null",
  "status": "rumored|announced|upcoming|available|discontinued",
  "announcedAt": "YYYY-MM-DD|null",
  "releaseAt": "YYYY-MM-DD|null",
  "specs": {
    "body": { "dimensions": {"widthMm": num, "heightMm": num, "depthMm": num}, "weightG": num, "build": "string", "materials": ["string"], "protection": "string", "ipRating": "IP68", "colors": ["string"] },
    "display": { "type": "LTPO AMOLED", "sizeIn": num, "resolution": "3120x1440", "ppi": num, "refreshRateHz": 120, "peakBrightnessNits": num, "hdrSupport": ["string"], "pwmHz": num, "glass": "string", "colorDepth": "string" },
    "platform": { "os": "Android 15", "ui": "One UI 7", "chipset": "Snapdragon 8 Elite", "cpu": "string", "gpu": "string", "antutuV10": num, "geekbench6": {"single": num, "multi": num} },
    "memory": { "ramOptions": [12, 16], "storageOptions": [256, 512, 1024], "storageType": "UFS 4.0", "cardSlot": false },
    "cameras": { "rear": [{"kind":"wide","megapixels":200,"aperture":"f/1.7","sensorSize":"1/1.3\\"","pixelSize":"0.6μm","fieldOfViewDeg":85,"opticalZoom":null,"digitalZoom":100,"stabilization":"OIS","video":["8K@30fps","4K@60fps"]}],"front": [{"kind":"selfie","megapixels":12,"aperture":"f/2.2","sensorSize":"1/3.2\\"","pixelSize":"1.12μm","fieldOfViewDeg":80,"opticalZoom":null,"digitalZoom":null,"stabilization":"EIS","video":["4K@30fps"]}],"features": ["Night Mode","Pro Mode"], "videoCapabilities": ["8K@30fps","4K@120fps"] },
    "audio": { "speakers": ["stereo speakers"], "headphoneJack": false, "codecs": ["LDAC","aptX HD","AAC"], "microphone": "3 mics with noise cancellation" },
    "battery": { "capacityMah": 5000, "type": "Li-Po", "chargingWatts": 45, "chargingTimeMin": 65, "wirelessWatts": 15, "reverseWirelessWatts": 4.5, "enduranceHours": 142 },
    "connectivity": { "wifi": "Wi-Fi 7", "bluetooth": "5.4", "nfc": true, "usb": "USB-C 3.2 Gen 2", "irBlaster": false, "gnss": ["GPS","GLONASS","BeiDou","Galileo"], "bands": ["n1","n3","n5","n7","n8","n20","n28","n38","n40","n41","n77","n78","n79"] },
    "sensors": ["accelerometer","gyroscope","proximity","compass","barometer"],
    "extras": { "fingerprint": "under-display", "faceUnlock": true, "stylus": false, "esim": true, "uwb": true, "satelliteSos": false }
  },
  "variants": [{"name":"Global","region":"Global","chipset":"Snapdragon 8 Elite","ramGb":12,"storageGb":256,"modem":null,"note":null}],
  "images": { "heroImage": "https://...", "gallery": ["https://..."], "renderImages": ["https://..."] },
  "confidence": { "overall": 0.97, "verifiedFields": ["specs.body","specs.display","specs.platform"], "estimatedFields": [], "unavailableFields": [] },
  "sources": [{"title":"GSMArena","url":"https://gsmarena.com/...","kind":"retailer"}]
}

Return ONLY the JSON object. No markdown, no explanation, no commentary.`;

/** Hard cap — increased to prevent truncation on complex devices. */
const MAX_OUTPUT_TOKENS = 16384;

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

  // Gather web context once (shared across retries)
  const webContext = await gatherWebContext(query);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isRetry = attempt > 0;

    let retryHint = "";
    if (isRetry && attempt === 1 && lastDevice) {
      const missing = findMissingFields(lastDevice);
      retryHint = `\n\nPREVIOUS ATTEMPT was valid but INCOMPLETE. You LEFT THESE FIELDS EMPTY/NULL:\n${missing}\n\nLook through the web context data again and FILL THEM ALL. Do not leave any of them null.`;
    } else if (isRetry) {
      retryHint = `\n\nFINAL RETRY: Output COMPLETE, VALID JSON only. Do not truncate. Start with { and end with }. No markdown fences.`;
    }

    const userMessage = `Device: ${query}\n\n${webContext ? `=== WEB SEARCH DATA ===\n${webContext}\n\n=== END WEB DATA ===\n\nExtract ALL specs from the data above into the JSON schema below.${retryHint}` : `No web search data available. Use your training knowledge to fill in as much as possible.${retryHint}`}`;

    const response = await groqGenerateContent({
      systemPrompt: PROMPT,
      userMessage,
      temperature: isRetry ? 0 : 0.2,
      topP: 0.95,
      maxTokens: MAX_OUTPUT_TOKENS,
      responseFormat: { type: "json_object" },
    });

    const raw = response.text;
    if (!raw.trim()) {
      if (attempt < MAX_RETRIES) continue;
      throw new Error("Groq returned an empty extraction after all retries.");
    }

    try {
      const parsed = parseJsonObject(raw);
      const device = AiExtractedDeviceSchema.parse(parsed);
      lastDevice = device;

      // Build source list from web data URLs
      if (device.sources.length === 0) {
        const inferredSources = inferSourcesFromWebData(webContext);
        if (inferredSources.length > 0) {
          device.sources = inferredSources;
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

function inferSourcesFromWebData(
  webData: string,
): { title: string; url: string; kind: "official" | "tenaa" | "fcc" | "retailer" | "benchmark" }[] {
  const sources: { title: string; url: string; kind: "official" | "tenaa" | "fcc" | "retailer" | "benchmark" }[] = [];
  const seen = new Set<string>();

  // Extract URLs from the web data
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/g;
  const urls = webData.match(urlRegex) ?? [];

  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);

    const domain = url.toLowerCase();
    let kind: "official" | "tenaa" | "fcc" | "retailer" | "benchmark" = "retailer";
    let title = "";

    if (domain.includes("gsmarena.com")) {
      kind = "retailer"; title = "GSMArena";
    } else if (domain.includes("phonearena.com")) {
      kind = "retailer"; title = "PhoneArena";
    } else if (domain.includes("notebookcheck")) {
      kind = "retailer"; title = "Notebookcheck";
    } else if (domain.includes("androidauthority.com")) {
      kind = "retailer"; title = "Android Authority";
    } else if (domain.includes("xda-developers.com")) {
      kind = "retailer"; title = "XDA Developers";
    } else if (domain.includes("91mobiles.com")) {
      kind = "retailer"; title = "91Mobiles";
    } else if (domain.includes("tenaa.cn")) {
      kind = "tenaa"; title = "TENAA";
    } else if (domain.includes("fcc.gov") || domain.includes("fccid.io")) {
      kind = "fcc"; title = "FCC";
    } else if (domain.includes("antutu.com") || domain.includes("nanoreview.net") || domain.includes("geekbench")) {
      kind = "benchmark"; title = "Benchmark";
    } else if (domain.includes("samsung.com") || domain.includes("apple.com") || domain.includes("xiaomi.com") || domain.includes("oneplus.com") || domain.includes("google.com") || domain.includes("motorola.com") || domain.includes("sony.com") || domain.includes("huawei.com")) {
      kind = "official"; title = "Official";
    } else {
      try { title = new URL(url).hostname; } catch { continue; }
    }

    sources.push({ title, url, kind });
  }

  return sources.slice(0, 10);
}

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

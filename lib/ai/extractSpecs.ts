import "server-only";

import { z } from "zod";
import {
  AI_MODEL,
  geminiGenerateContent,
  getCached,
  setCache,
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
// Prompt — grounded in live web search
// ---------------------------------------------------------------------------

const PROMPT = `You are the world's most thorough phone specification engineer. You have Google Search access — USE IT AGGRESSIVELY.

INPUT: A device name (e.g. "Samsung Galaxy S25 Ultra").

YOUR JOB: Fill in EVERY SINGLE FIELD below with real, verified data from the web. Null is ONLY acceptable for truly non-existent or unpublished data.

═══════════════════════════════════════════════════════════════
MANDATORY SEARCH QUERIES — you MUST search for each of these:
═══════════════════════════════════════════════════════════════
Search #1: "[device] full specifications gsmarena"
  → Gets body dimensions, weight, build, display, chipset, memory, battery, connectivity

Search #2: "[device] camera details sensor size aperture"
  → Gets exact camera specs: sensor size, pixel size, aperture, FOV, video capabilities

Search #3: "[device] benchmarks antutu geekbench score"
  → Gets AnTuTu and Geekbench scores

Search #4: "[device] battery test endurance charging speed"
  → Gets battery endurance hours, charging time 0-100%

Search #5: "[device] connectivity bands wifi bluetooth version"
  → Gets WiFi standard, Bluetooth version, full band list, GNSS support

Search #6: "[device] sensors fingerprint face unlock features"
  → Gets fingerprint type, face unlock, all sensors, stylus, eSIM, UWB, satellite

Search #7: "[device] official images press photos renders"
  → Gets official product photos

Search #8: "[device] price variants regional models"
  → Gets pricing, regional variants, model numbers

═══════════════════════════════════════════════════════════════
FIELD-BY-FIELD INSTRUCTIONS — follow EXACTLY:
═══════════════════════════════════════════════════════════════

BODY:
- dimensions: widthMm, heightMm, depthMm in millimeters (numbers only, e.g. 79.0)
- weightG: weight in grams (number only, e.g. 232)
- build: exact material description (e.g. "Titanium frame, Gorilla Armor 2 back")
- materials: array like ["titanium", "gorilla armor 2 glass"] — list each material
- protection: scratch/drop protection details (e.g. "Gorilla Armor 2")
- ipRating: exact IP rating (e.g. "IP68")
- colors: ALL color names as marketed (e.g. ["Titanium Silverblue", "Titanium Gray"])

DISPLAY:
- type: ONE of "OLED", "AMOLED", "LTPO AMOLED", "LCD", "Mini-LED" (pick the most accurate)
- sizeIn: diagonal inches (number, e.g. 6.9)
- resolution: exact resolution string (e.g. "3120 x 1440")
- ppi: pixels per inch (number, e.g. 504)
- refreshRateHz: max refresh rate (number, e.g. 120)
- peakBrightnessNits: peak brightness (number, e.g. 2600)
- hdrSupport: array like ["HDR10+", "Dolby Vision"]
- pwmHz: PWM dimming frequency if known (number or null)
- glass: protective glass name (e.g. "Corning Gorilla Armor 2")
- colorDepth: color depth (e.g. "10-bit" or "16M colors")

PLATFORM:
- os: base OS (e.g. "Android 15")
- ui: manufacturer skin (e.g. "One UI 7.0")
- chipset: exact chipset name (e.g. "Qualcomm Snapdragon 8 Elite")
- cpu: CPU configuration (e.g. "2x Oryon V2 Phoenix L 4.47GHz + 6x Oryon V2 Phoenix M 3.53GHz")
- gpu: GPU name (e.g. "Adreno 830")
- antutuV10: AnTuTu v10 score (number, e.g. 2480000)
- geekbench6: { single: number, multi: number } (e.g. { single: 3120, multi: 9450 })

MEMORY:
- ramOptions: ALL RAM variants in GB as numbers (e.g. [12, 16])
- storageOptions: ALL storage variants in GB as numbers (e.g. [256, 512, 1024])
- storageType: ONE of "UFS 2.2", "UFS 3.1", "UFS 4.0", "eMMC 5.1"
- cardSlot: true if microSD slot exists, false if not

CAMERAS:
- REAR cameras: one entry per physical lens, in order (main, ultrawide, telephoto, periscope, macro, depth)
- FRONT cameras: one entry per selfie camera
- For EACH lens provide:
  * kind: "wide"|"ultrawide"|"telephoto"|"periscope"|"macro"|"depth"|"selfie"
  * megapixels: exact MP (number, e.g. 200)
  * aperture: exact f-stop (e.g. "f/1.7")
  * sensorSize: sensor size (e.g. "1/1.3\"")
  * pixelSize: pixel size (e.g. "0.6μm" or "1.6μm with pixel binning")
  * fieldOfViewDeg: FOV in degrees if known (e.g. 120)
  * opticalZoom: optical zoom multiplier if applicable (e.g. 3, 5)
  * digitalZoom: max digital zoom (e.g. 100)
  * stabilization: "OIS", "OIS+EIS", "EIS", or "none"
  * video: array of video modes (e.g. ["8K@30fps", "4K@60fps", "1080p@240fps"])
- features: camera software features array (e.g. ["Night Mode", "Pro Mode", "Director's View", "8K Video"])
- videoCapabilities: overall video capabilities (e.g. ["8K@30fps", "4K@120fps", "Slow-motion 1080p@480fps", "HDR10+ recording"])

AUDIO:
- speakers: speaker type array (e.g. ["stereo speakers", "tuned by AKG"])
- headphoneJack: true/false
- codecs: supported audio codecs (e.g. ["LDAC", "aptX HD", "AAC", "SBC"])
- microphone: microphone details (e.g. "3 microphones with noise cancellation")

BATTERY:
- capacityMah: exact capacity (number, e.g. 5000)
- type: battery chemistry (e.g. "Li-Po" or "Li-Ion")
- chargingWatts: max wired charging (number, e.g. 45)
- chargingTimeMin: time for 0-100% charge in minutes (e.g. 65)
- wirelessWatts: max wireless charging (number, e.g. 15)
- reverseWirelessWatts: reverse wireless charging (number, e.g. 4.5)
- enduranceHours: battery endurance/rating in hours (e.g. 142)

CONNECTIVITY:
- wifi: WiFi standard (e.g. "Wi-Fi 7 (802.11be)")
- bluetooth: Bluetooth version (e.g. "5.4")
- nfc: true/false
- usb: USB standard (e.g. "USB Type-C 3.2 Gen 2")
- irBlaster: true/false
- gnss: supported GNSS systems array (e.g. ["GPS", "GLONASS", "BeiDou", "Galileo", "QZSS"])
- bands: ALL cellular bands as individual strings (e.g. ["n1", "n2", "n3", "n5", "n7", "n8", "n12", "n20", "n25", "n26", "n28", "n38", "n40", "n41", "n48", "n66", "n71", "n77", "n78", "n79", "B1", "B2", "B3", "B4", "B5", "B7", "B8", "B12", "B13", "B17", "B18", "B19", "B20", "B25", "B26", "B28", "B38", "B39", "B40", "B41", "B66"])

SENSORS: array of ALL sensors (e.g. ["accelerometer", "gyroscope", "proximity", "compass", "barometer", "color spectrum", "thermometer"])

EXTRAS:
- fingerprint: "under-display"|"side"|"rear"|"none" + specific type if known
- faceUnlock: true/false
- stylus: true/false (e.g. Samsung S Pen support)
- esim: true/false
- uwb: true/false (Ultra-Wideband)
- satelliteSos: true/false

VARIANTS: include ALL regional variants with different chipsets, RAM, storage (e.g. Snapdragon vs Exynos versions, US vs Global)

IMAGES:
- heroImage: best official product photo URL (DIRECT image link only, e.g. "https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s25-ultra.jpg")
- gallery: array of 2-5 official photo URLs (different angles, colors)
- renderImages: official press render URLs

═══════════════════════════════════════════════════════════════
RULES:
═══════════════════════════════════════════════════════════════
1. Fill EVERY field with real data from web search. null ONLY when truly impossible to find.
2. NEVER invent or hallucinate. Use real search results only.
3. Preserve official marketing names exactly.
4. Numbers only — strip units (mm, g, Hz, nits, mAh, W).
5. Dates: ISO 8601 (YYYY-MM-DD).
6. If you cannot find benchmark scores, search "[device] antutu score" and "[device] geekbench score" specifically.
7. If you cannot find battery endurance, search "[device] battery endurance hours" specifically.
8. If you cannot find PWM frequency, search "[device] PWM dimming frequency" specifically.
9. If you cannot find camera sensor size, search "[device] camera sensor size pixel size" specifically.
10. confidence.overall should be 0.95+ if you searched thoroughly.

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
    "cameras": { "rear": [{"kind":"wide","megapixels":200,"aperture":"f/1.7","sensorSize":"1/1.3\\"","pixelSize":"0.6μm","fieldOfViewDeg":85,"opticalZoom":null,"digitalZoom":100,"stabilization":"OIS","video":["8K@30fps","4K@60fps"]}], "front": [{"kind":"selfie","megapixels":12,"aperture":"f/2.2","sensorSize":"1/3.2\\"","pixelSize":"1.12μm","fieldOfViewDeg":80,"opticalZoom":null,"digitalZoom":null,"stabilization":"EIS","video":["4K@30fps"]}], "features": ["Night Mode","Pro Mode"], "videoCapabilities": ["8K@30fps","4K@120fps"] },
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
 * Caches results for 1 hour to minimize API calls.
 * Retries up to 2 times — first retry targets missing fields, second retry fixes JSON.
 */
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

    let retryHint = "";
    if (isRetry && attempt === 1 && lastDevice) {
      // First retry: target specific missing fields
      const missing = findMissingFields(lastDevice);
      retryHint = `\n\nPREVIOUS ATTEMPT was valid but INCOMPLETE. You LEFT THESE FIELDS EMPTY/NULL:\n${missing}\n\nSEARCH THE WEB for each missing field above and FILL THEM ALL. Do not leave any of them null.`;
    } else if (isRetry) {
      retryHint = `\n\nFINAL RETRY: Output COMPLETE, VALID JSON only. Do not truncate. Start with { and end with }. No markdown fences.`;
    }

    const response = await geminiGenerateContent({
      systemInstruction: PROMPT,
      contents: [
        {
          role: "user",
          parts: [
            { text: query },
            ...(retryHint ? [{ text: retryHint }] : []),
          ],
        },
      ],
      tools: [{ googleSearch: {} }],
      temperature: isRetry ? 0 : 0.2,
      topP: 0.95,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
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

      // Merge grounding metadata sources with AI-provided sources
      const groundingChunks = (response.groundingMetadata as { groundingChunks?: Array<{ web?: { title?: string; uri?: string } }> } | undefined)?.groundingChunks;
      const groundingSources = extractGroundingSources(groundingChunks);

      if (groundingSources.length > 0) {
        const existingUrls = new Set(device.sources.map((s) => s.url));
        for (const gs of groundingSources) {
          if (!existingUrls.has(gs.url)) {
            device.sources.push(gs);
            existingUrls.add(gs.url);
          }
        }
      }

      // If this is attempt 1+ and we got valid data, check if it's complete enough
      if (isRetry) {
        const missingCount = countNullFields(device);
        if (missingCount > 5 && attempt < MAX_RETRIES) {
          // Still too many missing fields, retry
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

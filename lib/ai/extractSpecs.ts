import "server-only";

import { z } from "zod";
import {
  geminiGenerateContent,
  getCached,
  setCache,
} from "./gemini-client";

export const AI_EXTRACTION_MODEL = "gemini-3.6-flash (rotating)";

// ---------------------------------------------------------------------------
// Lenient helpers — AI often returns wrong types
// ---------------------------------------------------------------------------

const lenientArray = z
  .union([z.array(z.any()), z.boolean(), z.string(), z.number(), z.null()])
  .transform((val) => {
    if (Array.isArray(val)) return val.map(String);
    if (val === true) return ["yes"];
    if (val === false || val === null) return [];
    return [String(val)];
  })
  .default([]);

const lenientBool = z
  .union([z.boolean(), z.string(), z.number(), z.null()])
  .transform((val) => {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val === "true" || val === "yes" || val === "1";
    if (typeof val === "number") return val !== 0;
    return false;
  })
  .default(false);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CameraSchema = z.object({
  kind: z.string().default("wide"),
  megapixels: z.number().nullish(),
  aperture: z.string().nullish(),
  sensorSize: z.string().nullish(),
  pixelSize: z.union([z.string(), z.number()]).transform(v => String(v)).nullish(),
  fieldOfViewDeg: z.number().nullish(),
  opticalZoom: z.number().nullish(),
  digitalZoom: z.number().nullish(),
  stabilization: z.string().nullish(),
  video: lenientArray,
});

export const AiExtractedDeviceSchema = z.object({
  brand: z.string().min(1),
  name: z.string().min(1),
  modelNumbers: lenientArray,
  codename: z.string().nullish(),
  status: z.string().default("available"),
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
      materials: lenientArray,
      protection: z.string().nullish(),
      ipRating: z.string().nullish(),
      colors: lenientArray,
    }),
    display: z.object({
      type: z.string().nullish(),
      sizeIn: z.number().nullish(),
      resolution: z.string().nullish(),
      ppi: z.number().nullish(),
      refreshRateHz: z.number().nullish(),
      peakBrightnessNits: z.number().nullish(),
      hdrSupport: lenientArray,
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
      ramOptions: z
        .union([z.array(z.number()), z.array(z.string()), z.number(), z.string(), z.null()])
        .transform((v) => {
          if (Array.isArray(v)) return v.map(Number).filter((n) => !isNaN(n));
          if (typeof v === "number") return [v];
          if (typeof v === "string") {
            const nums = v.match(/\d+/g);
            return nums ? nums.map(Number) : [];
          }
          return [];
        })
        .default([]),
      storageOptions: z
        .union([z.array(z.number()), z.array(z.string()), z.number(), z.string(), z.null()])
        .transform((v) => {
          if (Array.isArray(v)) return v.map(Number).filter((n) => !isNaN(n));
          if (typeof v === "number") return [v];
          if (typeof v === "string") {
            const nums = v.match(/\d+/g);
            return nums ? nums.map(Number) : [];
          }
          return [];
        })
        .default([]),
      storageType: z.string().nullish(),
      cardSlot: z.boolean().nullish(),
    }),
    cameras: z.object({
      rear: z.array(CameraSchema).default([]),
      front: z.array(CameraSchema).default([]),
      features: lenientArray,
      videoCapabilities: lenientArray,
    }),
    audio: z.object({
      speakers: lenientArray,
      headphoneJack: lenientBool,
      codecs: lenientArray,
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
      nfc: lenientBool,
      usb: z.string().nullish(),
      irBlaster: lenientBool,
      gnss: lenientArray,
      bands: lenientArray,
    }),
    sensors: lenientArray,
    extras: z.object({
      fingerprint: z.string().nullish(),
      faceUnlock: lenientBool,
      stylus: lenientBool,
      esim: lenientBool,
      uwb: lenientBool,
      satelliteSos: lenientBool,
    }),
  }),
  variants: z
    .array(
      z.object({
        name: z.string().nullish().default(null),
        region: z.string().nullish().default(null),
        chipset: z.string().nullish(),
        ramGb: z.number().nullish(),
        storageGb: z.number().nullish(),
        modem: z.string().nullish(),
        note: z.string().nullish(),
      }),
    )
    .transform((variants) => variants.filter((v) => v.name))
    .default([]),
  images: z.object({
    heroImage: z.string().nullish(),
    gallery: lenientArray,
    renderImages: lenientArray,
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
        url: z.string().min(1).transform((val) => {
          if (!val.startsWith("http")) return `https://${val}`;
          return val;
        }),
        kind: z.string().default("retailer"),
      }),
    )
    .default([]),
});

export type AiExtractedDevice = z.infer<typeof AiExtractedDeviceSchema>;

// ---------------------------------------------------------------------------

const PROMPT = `You are the world's most precise phone specification analyst. Your job is to extract COMPLETE, ACCURATE, VERIFIED specs for a phone using Google Search.

═══════════════════════════════════════════════════════════════
                    MANDATORY SEARCH STRATEGY
═══════════════════════════════════════════════════════════════

STEP 1: Search Google for the EXACT phone name + "specifications"
  Example: "Samsung Galaxy S25 Ultra specifications"

STEP 2: Search Google for the phone name + "GSMArena"
  Example: "Samsung Galaxy S25 Ultra GSMArena"

STEP 3: Search Google for the phone name + "official specs"
  Example: "Samsung Galaxy S25 Ultra official specs"

STEP 4: Search Google for the phone name + "camera specs details"
  Example: "Samsung Galaxy S25 Ultra camera specs details"

STEP 5: Search Google for the phone name + "battery charging speed"
  Example: "Samsung Galaxy S25 Ultra battery charging speed"

STEP 6: Search Google for the phone name + "benchmark antutu geekbench"
  Example: "Samsung Galaxy S25 Ultra benchmark antutu geekbench"

ONLY use data from these verified sources:
- GSMArena (gsmarena.com)
- Official manufacturer websites (samsung.com, apple.com, oneplus.com, etc.)
- PhoneArena (phonearena.com)
- Kimovil (kimovil.com)
- NanoReview (nanoreview.net)
- 91mobiles (91mobiles.com)
- Devicespecifications.com

NEVER guess. NEVER use memory. ALWAYS search the web.

═══════════════════════════════════════════════════════════════
                    CRITICAL RULES
═══════════════════════════════════════════════════════════════

1. EVERY number must be REAL — no placeholders like 0
2. If a spec is truly unknown after searching, set it to null
3. NEVER fabricate data — accuracy is more important than completeness
4. Camera specs must be EXACT:
   - Megapixels: 200, 108, 50, 12 (real values only)
   - Aperture: f/1.7, f/1.8, f/2.2 (with f/ prefix)
   - Sensor size: 1/1.3", 1/1.56", 1/2.55" (with 1/ prefix)
   - Pixel size: 0.6μm, 1.4μm (with μm suffix)
   - Stabilization: "OIS", "EIS", "OIS+EIS"
5. Battery capacity in mAh (e.g., 5000, 4500)
6. Charging speed in watts (e.g., 45, 65, 100)
7. Display brightness in nits (e.g., 2600, 1750)
8. AnTuTu score as number (e.g., 2150000)
9. Geekbench as numbers (e.g., {"single": 2800, "multi": 8500})
10. Status must match reality:
    - "available" if released and on sale NOW
    - "announced" if announced but not yet released
    - "upcoming" if expected soon
    - "discontinued" if no longer sold
    - "rumored" if only leaks exist
11. Sources MUST be valid URLs starting with https://
12. Include ALL regional variants (SM-S938U, SM-S938B, etc.)
13. Colors must be official marketing names (e.g., "Titanium Black", not just "black")
14. Weight in grams (e.g., 233, 189)

═══════════════════════════════════════════════════════════════
                    FIELD REQUIREMENTS
═══════════════════════════════════════════════════════════════

BODY:
- dimensions.widthMm: width in mm (e.g., 79.0)
- dimensions.heightMm: height in mm (e.g., 162.8)
- dimensions.depthMm: thickness in mm (e.g., 8.6)
- weightG: weight in grams (e.g., 233)
- build: material description (e.g., "Titanium frame, Gorilla Armor 2")
- materials: ["titanium", "glass"] or ["aluminum", "glass"]
- ipRating: IP67, IP68, etc.

DISPLAY:
- type: "LTPO AMOLED", "OLED", "IPS LCD", etc.
- sizeIn: diagonal inches (e.g., 6.9)
- resolution: "1440 x 3120" or "1080 x 2400"
- ppi: pixels per inch (e.g., 505)
- refreshRateHz: 60, 90, 120, 144
- peakBrightnessNits: peak brightness (e.g., 2600)
- hdrSupport: ["HDR10+", "Dolby Vision"]
- pwmHz: PWM frequency if known (e.g., 1920) or null

PLATFORM:
- os: "Android 15", "iOS 18", etc.
- ui: "One UI 7", "OxygenOS 15", etc.
- chipset: full name (e.g., "Snapdragon 8 Elite for Galaxy")
- cpu: core config (e.g., "2x4.47GHz + 6x3.53GHz")
- gpu: GPU name (e.g., "Adreno 830")
- antutuV10: AnTuTu v10 score as number (e.g., 2150000)
- geekbench6: {"single": 2800, "multi": 8500}

MEMORY:
- ramOptions: [8, 12, 16] in GB as numbers
- storageOptions: [128, 256, 512, 1024] in GB as numbers
- storageType: "UFS 4.0", "NVMe", etc.
- cardSlot: true/false

CAMERAS:
REAR (array, main camera first):
  - kind: "wide", "ultrawide", "telephoto", "periscope", "periscope telephoto", "macro", "depth"
  - megapixels: number (e.g., 200, 50, 12, 10)
  - aperture: "f/1.7", "f/2.2" (with f/ prefix)
  - sensorSize: "1/1.3\"", "1/1.56\"" (with 1/ prefix and " suffix)
  - pixelSize: "0.6μm", "1.4μm" (with μm)
  - fieldOfViewDeg: degrees (e.g., 120, 85)
  - opticalZoom: multiplier (e.g., 3, 5, 10)
  - digitalZoom: multiplier (e.g., 100)
  - stabilization: "OIS", "EIS", "OIS+EIS", "None"
  - video: ["8K@30fps", "4K@60fps", "1080p@240fps"]

FRONT (array):
  - Same fields as rear cameras
  - kind should be "selfie" or "wide"

CAMERA FEATURES: ["Night Mode", "Portrait Mode", "Pro Mode", "8K Video", etc.]
VIDEO CAPABILITIES: ["8K@30fps", "4K@120fps", "1080p@240fps", "HDR10+"]

AUDIO:
- speakers: ["stereo", "mono"] or ["stereo"]
- headphoneJack: true/false
- codecs: ["aptX HD", "LDAC", "AAC"]
- microphone: description or null

BATTERY:
- capacityMah: number (e.g., 5000, 4500)
- type: "Li-Po", "Li-Ion"
- chargingWatts: wired charging speed (e.g., 45, 65, 100)
- wirelessWatts: wireless charging speed (e.g., 15, 50)
- reverseWirelessWatts: reverse wireless (e.g., 4.5, 10)

CONNECTIVITY:
- wifi: "Wi-Fi 7", "Wi-Fi 6E", "Wi-Fi 6"
- bluetooth: "5.4", "5.3", "5.2"
- nfc: true/false
- usb: "USB-C 3.2", "USB-C 2.0"
- irBlaster: true/false
- gnss: ["GPS", "GLONASS", "Galileo", "BeiDou", "QZSS"]
- bands: 5G bands ["n1", "n3", "n7", "n28", "n77", "n78", "n258"]

SENSORS: ["accelerometer", "gyroscope", "proximity", "compass", "barometer", "fingerprint", "face recognition"]

EXTRAS:
- fingerprint: "under-display (ultrasonic)", "under-display (optical)", "side-mounted", "rear-mounted"
- faceUnlock: true/false
- stylus: true/false (e.g., S Pen)
- esim: true/false
- uwb: true/false
- satelliteSos: true/false

VARIANTS (array):
- name: variant name (e.g., "SM-S938U1")
- region: "US", "Global", "China", etc.
- chipset: if different from base
- ramGb: if different from base
- storageGb: if different from base

IMAGES:
- heroImage: URL to OFFICIAL high-resolution product image (minimum 1000x1000px preferred)
  - Search for: "[phone name] official press image high resolution"
  - Search for: "[phone name] product image png"
  - Prefer official manufacturer CDN URLs (e.g., samsung.com, apple.com, oneplus.com)
  - Avoid thumbnails, crops, or low-res preview images
  - If URL contains "thumb", "small", "preview", "crop", "200x", "300x" — find a better URL
- gallery: array of high-res image URLs (official renders, press photos, color variants)
  - Search for: "[phone name] press images gallery"
  - Search for: "[phone name] official renders high resolution"
- renderImages: array of high-res render URLs (3D renders, product shots)
  - Search for: "[phone name] official renders png"
  - Search for: "[phone name] product renders high quality"

CONFIDENCE:
- overall: 0.0 to 1.0 (how confident you are in the data)
- verifiedFields: list of fields you verified from official sources
- estimatedFields: list of fields that are estimates
- unavailableFields: list of fields you couldn't find

SOURCES (array):
- title: source name (e.g., "GSMArena")
- url: valid URL starting with https://
- kind: "official", "retailer", "review", "news"

═══════════════════════════════════════════════════════════════
                    OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Output ONLY valid JSON. No markdown, no explanation, no commentary.

{"brand":"Samsung","name":"Galaxy S25 Ultra","modelNumbers":["SM-S938U","SM-S938B"],"codename":"p3q","status":"available","announcedAt":"2025-01-22","releaseAt":"2025-02-07","specs":{"body":{"dimensions":{"widthMm":79.0,"heightMm":162.8,"depthMm":8.6},"weightG":233,"build":"Titanium frame, Gorilla Armor 2","materials":["titanium","glass"],"protection":"Gorilla Armor 2","ipRating":"IP68","colors":["Titanium Silverblue","Titanium Gray","Titanium Black","Titanium Whitesilver"]},"display":{"type":"LTPO AMOLED","sizeIn":6.9,"resolution":"1440 x 3120","ppi":505,"refreshRateHz":120,"peakBrightnessNits":2600,"hdrSupport":["HDR10+","Dolby Vision"],"pwmHz":1920,"glass":"Gorilla Armor 2","colorDepth":"12-bit"},"platform":{"os":"Android 15","ui":"One UI 7","chipset":"Snapdragon 8 Elite for Galaxy","cpu":"2x4.47GHz Oryon V2 Phoenix + 6x3.53GHz Oryon V2 Phoenix","gpu":"Adreno 830","antutuV10":2150000,"geekbench6":{"single":2800,"multi":8500}},"memory":{"ramOptions":[12,16],"storageOptions":[256,512,1024],"storageType":"UFS 4.0","cardSlot":false},"cameras":{"rear":[{"kind":"wide","megapixels":200,"aperture":"f/1.7","sensorSize":"1/1.3\"","pixelSize":"0.6μm","fieldOfViewDeg":85,"opticalZoom":0,"digitalZoom":100,"stabilization":"OIS","video":["8K@30fps","4K@120fps","1080p@240fps"]},{"kind":"telephoto","megapixels":50,"aperture":"f/3.4","sensorSize":"1/2.52\"","pixelSize":"0.7μm","fieldOfViewDeg":22,"opticalZoom":5,"digitalZoom":100,"stabilization":"OIS","video":["8K@30fps","4K@120fps"]},{"kind":"ultrawide","megapixels":50,"aperture":"f/1.9","sensorSize":"1/2.55\"","pixelSize":"0.7μm","fieldOfViewDeg":120,"opticalZoom":0,"digitalZoom":2,"stabilization":"None","video":["8K@30fps","4K@120fps"]}],"front":[{"kind":"selfie","megapixels":12,"aperture":"f/2.2","sensorSize":"1/3.2\"","pixelSize":"1.12μm","fieldOfViewDeg":80,"opticalZoom":0,"digitalZoom":2,"stabilization":"None","video":["4K@60fps"]}],"features":["Night Mode","Portrait Mode","Pro Mode","8K Video","AI Photo Enhancer"],"videoCapabilities":["8K@30fps","4K@120fps","1080p@240fps","HDR10+","Slow Motion"]},"audio":{"speakers":["stereo"],"headphoneJack":false,"codecs":["aptX HD","LDAC","AAC"],"microphone":"Triple microphone with noise cancellation"},"battery":{"capacityMah":5000,"type":"Li-Po","chargingWatts":45,"chargingTimeMin":65,"wirelessWatts":15,"reverseWirelessWatts":4.5,"enduranceHours":null},"connectivity":{"wifi":"Wi-Fi 7","bluetooth":"5.4","nfc":true,"usb":"USB-C 3.2 Gen 2","irBlaster":false,"gnss":["GPS","GLONASS","Galileo","BeiDou","QZSS"],"bands":["n1","n2","n3","n5","n7","n8","n12","n20","n25","n28","n38","n40","n41","n66","n71","n77","n78","n258"]},"sensors":["accelerometer","gyroscope","proximity","compass","barometer","fingerprint","face recognition","magnetic sensor"],"extras":{"fingerprint":"under-display (ultrasonic)","faceUnlock":true,"stylus":true,"esim":true,"uwb":true,"satelliteSos":false}},"variants":[{"name":"SM-S938U","region":"United States","chipset":null,"ramGb":null,"storageGb":null,"modem":"Snapdragon X80","note":"US unlocked"},{"name":"SM-S938B","region":"Global","chipset":null,"ramGb":null,"storageGb":null,"modem":"Snapdragon X80","note":"Global dual SIM"}],"images":{"heroImage":null,"gallery":[],"renderImages":[]},"confidence":{"overall":0.95,"verifiedFields":["brand","name","display.sizeIn","display.refreshRateHz","platform.chipset","memory.ramOptions","cameras.rear[0].megapixels","battery.capacityMah"],"estimatedFields":[],"unavailableFields":["images.heroImage"]},"sources":[{"title":"GSMArena - Samsung Galaxy S25 Ultra","url":"https://www.gsmarena.com/samsung_galaxy_s25_ultra-13211.php","kind":"retailer"},{"title":"Samsung Official","url":"https://www.samsung.com/global/galaxy/galaxy-s25-ultra/","kind":"official"}]}`;

/** Max output tokens. */
const MAX_OUTPUT_TOKENS = 8192;

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

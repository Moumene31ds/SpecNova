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
      simConfig: z.string().nullish(),
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
      touchSamplingRateHz: z.number().nullish(),
      alwaysOnDisplay: lenientBool,
      ltpoGen: z.string().nullish(),
    }),
    platform: z.object({
      os: z.string().nullish(),
      ui: z.string().nullish(),
      chipset: z.string().nullish(),
      cpu: z.string().nullish(),
      gpu: z.string().nullish(),
      processNode: z.string().nullish(),
      npuTops: z.number().nullish(),
      antutuV10: z.number().nullish(),
      geekbench6: z
        .object({
          single: z.number().nullish(),
          multi: z.number().nullish(),
        })
        .nullish()
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
      adaptiveCharging: lenientBool,
      bypassCharging: lenientBool,
    }),
    connectivity: z.object({
      wifi: z.string().nullish(),
      bluetooth: z.string().nullish(),
      nfc: lenientBool,
      usb: z.string().nullish(),
      irBlaster: lenientBool,
      gnss: lenientArray,
      bands: lenientArray,
      thread: lenientBool,
      matter: lenientBool,
      satelliteType: z.string().nullish(),
    }),
    sensors: lenientArray,
    extras: z.object({
      fingerprint: z.string().nullish(),
      faceUnlock: lenientBool,
      stylus: lenientBool,
      esim: lenientBool,
      uwb: lenientBool,
      satelliteSos: lenientBool,
      aiFeatures: lenientArray,
      boxContents: lenientArray,
      updatePolicy: z.string().nullish(),
      sarValue: z.string().nullish(),
    }),
  }),
  pricing: z.object({
    msrp: z.number().nullish(),
    currentPrice: z.number().nullish(),
    currency: z.string().nullish(),
    region: z.string().nullish(),
  }).default({}),
  software: z.object({
    osUpdateYears: z.number().nullish(),
    securityUpdateYears: z.number().nullish(),
    aiPlatform: z.string().nullish(),
  }).default({}),
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

// ---------------------------------------------------------------------------
// SEARCH PHASE PROMPTS — each is a short, focused search that Gemini can
// actually execute via Google Search Grounding in a single API call.
// ---------------------------------------------------------------------------

const SEARCH_IDENTIFY = `Search Google for "{query}" and extract:
- Brand, full official name, model numbers, codename
- Announcement date, release date, current status (available/announced/upcoming/discontinued/rumored)
- Official product image URL (high-res, from manufacturer CDN or GSMArena)
- Pricing (MSRP in USD or local currency with region)

Return as structured text with clear labels. Include ALL sources found.`;

const SEARCH_BODY_DISPLAY = `Search Google for "{query}" and extract:
BODY: dimensions (width × height × depth in mm), weight (grams), build description, materials (glass/aluminum/titanium), IP rating, official color names, SIM configuration
DISPLAY: panel type (AMOLED/LTPO/OLED/LCD), size (inches), resolution (WxH), PPI, refresh rate (Hz), peak brightness (nits), HDR support, PWM dimming frequency, glass type, color depth, touch sampling rate, LTPO generation, always-on display

Return as structured text with clear labels.`;

const SEARCH_PLATFORM = `Search Google for "{query}" and extract:
PLATFORM: OS version, UI skin, chipset full name, CPU config (cores × GHz), GPU name, process node (nm), NPU AI TOPS
BENCHMARKS: AnTuTu v10 score, Geekbench 6 single-core and multi-core
MEMORY: RAM options (GB), storage options (GB), storage type (UFS/NVMe), microSD card slot

Return as structured text with clear labels.`;

const SEARCH_CAMERA = `Search Google for "{query} camera specs detailed" and extract:
REAR CAMERAS (each lens): megapixels, aperture (f/), sensor size (1/x"), pixel size (μm), field of view (degrees), optical zoom, digital zoom, stabilization type, video capabilities
FRONT CAMERA: same fields
CAMERA FEATURES: all computational photography and AI features
VIDEO: max resolution, fps, HDR, ProRes, Cinematic mode

Return as structured text with clear labels. Include sensor model names (e.g., Sony IMX989).`;

const SEARCH_BATTERY_CONNECTIVITY = `Search Google for "{query}" and extract:
BATTERY: capacity (mAh), type (Li-Po/Silicon-carbon), wired charging (W), wireless charging (W), reverse wireless (W), charging time, endurance rating, adaptive charging, bypass charging
CONNECTIVITY: WiFi standard, Bluetooth version, NFC, USB type, IR blaster, GNSS systems, ALL 5G/4G/3G bands, Thread/Matter, UWB, satellite
SENSORS: full list
EXTRAS: fingerprint type, face unlock, stylus, eSIM, AI features, box contents, software update policy

Return as structured text with clear labels.`;

// ---------------------------------------------------------------------------
// EXTRACTION PROMPT — takes gathered search results and produces final JSON
// ---------------------------------------------------------------------------

const EXTRACT_PROMPT = `You are an elite phone specification extraction engine. Given the SEARCH RESULTS below, extract a complete, accurate spec sheet as valid JSON.

CRITICAL RULES:
1. Every value MUST come from the search results. If not found, use null.
2. NEVER fabricate or guess. null is always better than wrong data.
3. Use EXACT official names from search results.
4. Output ONLY valid JSON — no markdown, no commentary.
5. Camera aperture = "f/1.7", sensor = "1/1.3\\"", pixel = "0.6μm"
6. 5G bands = "n1","n3", 4G bands = "B1","B3", 3G bands = "B1","B2"
7. Status: "available"=on sale, "announced"=revealed not on sale, "upcoming"=confirmed no date, "discontinued"=stopped, "rumored"=leaks only

OUTPUT JSON SCHEMA:
{"brand":"","name":"","modelNumbers":[],"codename":null,"status":"available","announcedAt":null,"releaseAt":null,"specs":{"body":{"dimensions":{"widthMm":null,"heightMm":null,"depthMm":null},"weightG":null,"build":null,"materials":[],"protection":null,"ipRating":null,"colors":[],"simConfig":null},"display":{"type":null,"sizeIn":null,"resolution":null,"ppi":null,"refreshRateHz":null,"peakBrightnessNits":null,"hdrSupport":[],"pwmHz":null,"glass":null,"colorDepth":null,"touchSamplingRateHz":null,"alwaysOnDisplay":false,"ltpoGen":null},"platform":{"os":null,"ui":null,"chipset":null,"cpu":null,"gpu":null,"processNode":null,"npuTops":null,"antutuV10":null,"geekbench6":{"single":null,"multi":null}},"memory":{"ramOptions":[],"storageOptions":[],"storageType":null,"cardSlot":false},"cameras":{"rear":[],"front":[],"features":[],"videoCapabilities":[]},"audio":{"speakers":[],"headphoneJack":false,"codecs":[],"microphone":null},"battery":{"capacityMah":null,"type":null,"chargingWatts":null,"chargingTimeMin":null,"wirelessWatts":null,"reverseWirelessWatts":null,"enduranceHours":null,"adaptiveCharging":false,"bypassCharging":false},"connectivity":{"wifi":null,"bluetooth":null,"nfc":false,"usb":null,"irBlaster":false,"gnss":[],"bands":[],"thread":false,"matter":false,"satelliteType":null},"sensors":[],"extras":{"fingerprint":null,"faceUnlock":false,"stylus":false,"esim":false,"uwb":false,"satelliteSos":false,"aiFeatures":[],"boxContents":[],"updatePolicy":null,"sarValue":null}},"pricing":{"msrp":null,"currentPrice":null,"currency":"USD","region":null},"software":{"osUpdateYears":null,"securityUpdateYears":null,"aiPlatform":null},"variants":[],"images":{"heroImage":null,"gallery":[],"renderImages":[]},"confidence":{"overall":0.9,"verifiedFields":[],"estimatedFields":[],"unavailableFields":[]},"sources":[{"title":"Search Results","url":"https://google.com","kind":"review"}]}`;

/** Max output tokens. */
const MAX_OUTPUT_TOKENS = 16384;

// ---------------------------------------------------------------------------
// Multi-step extraction: gather search results first, then extract JSON.
// This fixes the problem where a single 500-line prompt with 10 mandatory
// searches overwhelms Gemini and it can't actually execute the searches.
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

    // ── PHASE 1: Gather raw search results ──
    const searchPrompts = [
      { key: "identify", prompt: SEARCH_IDENTIFY, label: "Identity & Launch" },
      { key: "bodyDisplay", prompt: SEARCH_BODY_DISPLAY, label: "Body & Display" },
      { key: "platform", prompt: SEARCH_PLATFORM, label: "Platform & Memory" },
      { key: "camera", prompt: SEARCH_CAMERA, label: "Camera Details" },
      { key: "battery", prompt: SEARCH_BATTERY_CONNECTIVITY, label: "Battery & Connectivity" },
      { key: "images", prompt: `Search Google for "{query} official product image high resolution" and find:
- Hero image: official high-res product photo URL (from manufacturer CDN, GSMArena, or PhoneArena)
- Gallery: official press photos, color variants
- Renders: official promotional renders
Return ONLY valid URLs (https://). Avoid thumbnails, crops, watermarks.`, label: "Product Images" },
    ];

    console.log(`[extractSpecs] Starting multi-step extraction for: "${query}" (attempt ${attempt + 1})`);

    const searchResults: string[] = [];
    const allSources: Array<{ title: string; url: string; kind: string }> = [];

    for (const sp of searchPrompts) {
      const userMsg = sp.prompt.replace("{query}", query);
      console.log(`[extractSpecs] → Search: ${sp.label}`);

      try {
        const result = await geminiGenerateContent({
          systemInstruction: "You are a phone specification researcher. Use Google Search to find accurate, real-time data. Return structured text with all details found. Never fabricate data.",
          userMessage: userMsg,
          temperature: 0.1,
          maxTokens: 8192,
          useGoogleSearch: true,
        });

        if (result.text?.trim()) {
          searchResults.push(`=== ${sp.label} ===\n${result.text}`);

          // Collect grounding sources
          const gm = result.groundingMetadata as { groundingChunks?: Array<{ web?: { title?: string; uri?: string } }> } | undefined;
          if (gm?.groundingChunks) {
            for (const chunk of gm.groundingChunks) {
              const web = chunk.web;
              if (!web?.uri) continue;
              if (!allSources.some(s => s.url === web.uri)) {
                allSources.push({
                  title: web.title ?? new URL(web.uri).hostname,
                  url: web.uri,
                  kind: "review",
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[extractSpecs] Search "${sp.label}" failed:`, err);
        // Continue with other searches — don't fail the whole extraction
      }
    }

    if (searchResults.length === 0) {
      if (attempt < MAX_RETRIES) continue;
      throw new Error(`No search results found for "${query}". Check phone name and try again.`);
    }

    // ── PHASE 2: Extract structured JSON from gathered results ──
    console.log(`[extractSpecs] → Extracting structured data from ${searchResults.length} search results`);

    let userMessage = `SEARCH RESULTS FOR "${query}":\n\n${searchResults.join("\n\n")}`;
    if (isRetry && lastDevice) {
      const missing = findMissingFields(lastDevice);
      userMessage += `\n\nPREVIOUS ATTEMPT MISSING FIELDS — search for these specifically:\n${missing}`;
    }

    const response = await geminiGenerateContent({
      systemInstruction: EXTRACT_PROMPT,
      userMessage,
      temperature: isRetry ? 0 : 0.15,
      topP: 0.95,
      maxTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
      useGoogleSearch: false, // Already have search results — just extract
    });

    const raw = response.text;
    if (!raw.trim()) {
      if (attempt < MAX_RETRIES) continue;
      throw new Error("Gemini returned empty extraction after all retries.");
    }

    try {
      const parsed = parseJsonObject(raw);
      const device = AiExtractedDeviceSchema.parse(parsed);
      lastDevice = device;

      // Merge sources from search phase
      if (allSources.length > 0) {
        const seen = new Set(device.sources.map((s) => s.url));
        for (const src of allSources) {
          if (!seen.has(src.url)) {
            seen.add(src.url);
            device.sources.push(src);
          }
        }
      }

      // If retry and still too many missing fields, try again
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

  if (!s.body.dimensions?.widthMm || !s.body.weightG) missing.push("- body: dimensions (widthMm, heightMm, depthMm) and weightG — search '[phone] dimensions weight grams'");
  if (!s.body.build) missing.push("- body: build materials — search '[phone] build quality materials frame'");
  if (!s.body.ipRating) missing.push("- body: IP rating — search '[phone] IP rating water resistance'");
  if (!s.body.colors.length) missing.push("- body: official color names — search '[phone] official colors list'");
  if (!s.body.simConfig) missing.push("- body: SIM config — search '[phone] SIM type eSIM dual SIM'");

  if (!s.display.type) missing.push("- display: type (OLED/AMOLED/LTPO) — search '[phone] display type panel'");
  if (!s.display.sizeIn) missing.push("- display: size in inches");
  if (!s.display.resolution) missing.push("- display: resolution (e.g. '3120x1440')");
  if (!s.display.peakBrightnessNits) missing.push("- display: peak brightness nits — search '[phone] display brightness nits outdoor'");
  if (!s.display.ppi) missing.push("- display: PPI density");
  if (!s.display.glass) missing.push("- display: protective glass type");

  if (!s.platform.chipset) missing.push("- platform: chipset name — search '[phone] chipset SoC'");
  if (!s.platform.cpu) missing.push("- platform: CPU configuration");
  if (!s.platform.gpu) missing.push("- platform: GPU name");
  if (!s.platform.os) missing.push("- platform: OS version");
  if (!s.platform.processNode) missing.push("- platform: process node — search '[chipset name] process node nm fabrication'");
  if (!s.platform.antutuV10) missing.push("- platform: AnTuTu v10 score — search '[phone] AnTuTu v10 benchmark'");
  if (!s.platform.geekbench6?.single) missing.push("- platform: Geekbench 6 scores — search '[phone] Geekbench 6 single multi core'");

  if (!s.memory.ramOptions.length) missing.push("- memory: RAM options in GB");
  if (!s.memory.storageOptions.length) missing.push("- memory: storage options in GB");
  if (!s.memory.storageType) missing.push("- memory: storage type (UFS 4.0 etc)");

  if (!s.cameras.rear.length) missing.push("- cameras: rear cameras — search '[phone] camera specs sensor size aperture'");
  if (!s.cameras.front.length) missing.push("- cameras: front camera specs");
  if (!s.cameras.features.length) missing.push("- cameras: computational photography features — search '[phone] AI camera features Night Mode'");

  if (!s.battery.capacityMah) missing.push("- battery: capacity in mAh");
  if (!s.battery.chargingWatts) missing.push("- battery: wired charging wattage");
  if (!s.battery.enduranceHours) missing.push("- battery: endurance hours — search '[phone] battery endurance GSMArena hours'");

  if (!s.connectivity.wifi) missing.push("- connectivity: WiFi standard");
  if (!s.connectivity.bluetooth) missing.push("- connectivity: Bluetooth version");
  if (!s.connectivity.bands.length) missing.push("- connectivity: ALL cellular bands — search '[phone] 5G 4G bands complete list'");

  if (!s.sensors.length) missing.push("- sensors: full sensor list");
  if (!s.extras.fingerprint) missing.push("- extras: fingerprint sensor type");
  if (!s.extras.aiFeatures.length) missing.push("- extras: AI features — search '[phone] AI features on-device Gemini Galaxy AI'");
  if (!s.extras.updatePolicy) missing.push("- extras: software update policy — search '[phone] OS update years security patches'");

  if (!device.images.heroImage) missing.push("- images: official product image URL — search '[phone] official press image high resolution'");

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

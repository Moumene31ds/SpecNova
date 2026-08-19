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

const PROMPT = `You are the world's most elite phone specification analyst — a hyper-accurate, zero-hallucination extraction engine. You use Google Search Grounding to retrieve REAL-TIME data from the internet. You NEVER guess, NEVER fabricate, NEVER use training data alone.

═══════════════════════════════════════════════════════════════════
         PHASE 1: MANDATORY MULTI-STEP SEARCH STRATEGY
═══════════════════════════════════════════════════════════════════

You MUST execute ALL 10 searches below before extracting any data. Each search targets a specific data category.

SEARCH 1 — IDENTITY & LAUNCH:
  Query: "[phone name] specifications release date model numbers codename"
  Extract: brand, name, model numbers, codename, status, announcedAt, releaseAt

SEARCH 2 — BODY & BUILD:
  Query: "[phone name] dimensions weight materials build quality IP rating"
  Extract: dimensions, weight, build description, materials, IP rating, colors

SEARCH 3 — DISPLAY (TECHNICAL):
  Query: "[phone name] display specs LTPO touch sampling rate PWM frequency color depth DeltaE"
  Extract: type, size, resolution, PPI, refresh rate, brightness, HDR, PWM, glass, touch sampling rate, LTPO generation, always-on display

SEARCH 4 — CHIPSET & PERFORMANCE:
  Query: "[phone name] chipset process node nm CPU GPU NPU TOPS transistors"
  Extract: chipset, process node, CPU config, GPU, NPU AI TOPS, transistor count

SEARCH 5 — BENCHMARKS:
  Query: "[phone name] AnTuTu v10 Geekbench 6 score benchmark 2025"
  Extract: AnTuTu v10, Geekbench 6 single/multi

SEARCH 6 — MEMORY & STORAGE:
  Query: "[phone name] RAM storage options UFS type microSD card slot"
  Extract: RAM options, storage options, storage type, card slot

SEARCH 7 — CAMERA (DETAILED):
  Query: "[phone name] camera specs sensor size pixel size aperture OIS computational photography AI"
  Extract: ALL rear + front camera specs, sensor size, pixel size, aperture, stabilization, video capabilities, computational photography features, AI camera features

SEARCH 8 — BATTERY & CHARGING:
  Query: "[phone name] battery mAh charging speed wireless adaptive charging bypass endurance test"
  Extract: capacity, type, wired/wireless watts, reverse wireless, adaptive charging, bypass charging, endurance, charging time

SEARCH 9 — CONNECTIVITY & NETWORK:
  Query: "[phone name] 5G bands WiFi 7 Bluetooth version Thread Matter UWB satellite NFC USB"
  Extract: WiFi, Bluetooth, NFC, USB, IR blaster, GNSS, all 5G/4G/3G bands, Thread, Matter, UWB, satellite connectivity type

SEARCH 10 — EXTRAS, AI & SOFTWARE:
  Query: "[phone name] AI features software update policy years box contents SAR value eSIM dual SIM"
  Extract: fingerprint type, face unlock, stylus, eSIM, UWB, satellite SOS, AI features list, box contents, update policy, SAR, SIM config, pricing MSRP

═══════════════════════════════════════════════════════════════════
         PHASE 2: CROSS-VERIFICATION STRATEGY
═══════════════════════════════════════════════════════════════════

After completing ALL 10 searches, you MUST cross-verify critical specs using at least 2 independent sources:
- Battery capacity: verify on GSMArena AND official manufacturer site
- Camera sensor size: verify on GSMArena AND camera review sites
- Display brightness: verify on official spec sheet AND review measurements
- Benchmark scores: verify on nanoreview.net OR geekbench.com
- Charging speed: verify on official site AND charging test reviews
- Dimensions/weight: verify on manufacturer site AND retail listings

If two sources CONFLICT, use the more recent data point. If still uncertain, use null.

═══════════════════════════════════════════════════════════════════
         PHASE 3: VERIFIED DATA SOURCES (TRUST HIERARCHY)
═══════════════════════════════════════════════════════════════════

TIER 1 — Official (HIGHEST TRUST):
- Manufacturer websites: samsung.com, apple.com, oneplus.com, xiaomi.com, oppo.com, vivo.com, realme.com, motorola.com, nothing.tech, google.com/store, honor.com, huawei.com, nokia.com, sony.com, asus.com, lenovo.com, zte.com
- Official press kits and media galleries

TIER 2 — Expert Reviews (HIGH TRUST):
- GSMArena (gsmarena.com) — most comprehensive spec database
- PhoneArena (phonearena.com) — detailed measurements
- AnandTech / ArsTechnica — deep technical analysis
- DXOMARK — camera/display/audio benchmarks

TIER 3 — Aggregator (MEDIUM TRUST):
- Kimovil (kimovil.com)
- NanoReview (nanoreview.net)
- 91mobiles (91mobiles.com)
- Devicespecifications.com
- Versus.com
- NanoReview.net

TIER 4 — Retailer (REFERENCE):
- Amazon, Best Buy, Flipkart, JD.com — for pricing/availability

NEVER use: Wikipedia (for specs), random blogs, forum posts, YouTube descriptions.

═══════════════════════════════════════════════════════════════════
         CRITICAL RULES — ZERO TOLERANCE
═══════════════════════════════════════════════════════════════════

1. ACCURACY OVER COMPLETENESS: If you cannot find a verified value, set it to null. NEVER use 0, "unknown", or placeholders.
2. NO FABRICATION: Every number, every string must come from search results. If your training data says "5000 mAh" but search confirms "4800 mAh" — use 4800.
3. OFFICIAL NAMES ONLY: Use exact marketing names. "Titanium Black" not "black". "Snapdragon 8 Elite for Galaxy" not "SD 8 Elite".
4. PRECISION UNITS: mAh (not Ah), nits (not cd/m²), mm (not inches), grams (not kg), GHz (not MHz for CPU config).
5. CAMERA FORMATTING: Aperture = "f/1.7" (always with f/ prefix). Sensor = "1/1.3\"" (with 1/ prefix and " suffix). Pixel = "0.6μm" (with μm suffix).
6. STATUS ACCURACY:
   - "available" = on sale NOW in at least one market
   - "announced" = officially revealed but not yet on sale
   - "upcoming" = confirmed by manufacturer, no release date
   - "discontinued" = no longer manufactured/sold
   - "rumored" = leaks/rumors only, no official announcement
7. BANDS FORMAT: 5G = "n1", "n3", "n7", "n28", "n77", "n78", "n258" (with n prefix). 4G = "B1", "B3", "B7", "B20" (with B prefix). 3G = "B1", "B2", "B5" (with B prefix).
8. JSON ONLY: Output valid JSON. No markdown fences, no explanations, no commentary before or after.
9. IMAGES: Return real CDN URLs from official sources. Never return placeholder URLs.
10. PRICING: Use USD as default. If only local price available, note the currency and region.

═══════════════════════════════════════════════════════════════════
         COMPLETE FIELD SPECIFICATION
═══════════════════════════════════════════════════════════════════

TOP-LEVEL:
- brand: Official brand name (e.g., "Samsung", "Apple", "OnePlus")
- name: Official model name (e.g., "Galaxy S25 Ultra", "iPhone 16 Pro Max")
- modelNumbers: ALL known model numbers (e.g., ["SM-S938U", "SM-S938B", "SM-S938N"])
- codename: Internal codename if known (e.g., "p3q", "t91") or null
- status: "available" | "announced" | "upcoming" | "discontinued" | "rumored"
- announcedAt: ISO date of announcement (e.g., "2025-01-22") or null
- releaseAt: ISO date of release (e.g., "2025-02-07") or null

BODY:
- dimensions.widthMm: width in mm (e.g., 79.0)
- dimensions.heightMm: height in mm (e.g., 162.8)
- dimensions.depthMm: thickness in mm (e.g., 8.6)
- weightG: weight in grams (e.g., 233)
- build: descriptive (e.g., "Titanium frame, Gorilla Armor 2 glass back")
- materials: ["titanium", "glass"] or ["aluminum", "glass"] etc.
- protection: glass type (e.g., "Gorilla Armor 2", "Ceramic Shield")
- ipRating: "IP68", "IP67", etc. with EXACT rating string
- colors: OFFICIAL marketing color names (e.g., ["Titanium Silverblue", "Titanium Gray"])
- simConfig: "Nano-SIM + eSIM" or "Dual Nano-SIM" or "Nano-SIM + Nano-SIM + eSIM" etc.

DISPLAY:
- type: exact tech (e.g., "LTPO AMOLED", "Dynamic AMOLED 2X", "OLED", "IPS LCD", "MicroLED")
- sizeIn: diagonal inches (e.g., 6.9)
- resolution: "1440 x 3120" format
- ppi: pixels per inch (e.g., 505)
- refreshRateHz: max refresh (e.g., 120, 144)
- peakBrightnessNits: outdoor peak (e.g., 2600)
- hdrSupport: ["HDR10+", "Dolby Vision", "HLG"]
- pwmHz: PWM dimming frequency (e.g., 1920, 2160) or null if unknown
- glass: protective glass name (e.g., "Gorilla Armor 2")
- colorDepth: "10-bit", "12-bit", "8-bit" etc.
- touchSamplingRateHz: touch sampling rate (e.g., 240, 480) or null
- alwaysOnDisplay: true/false
- ltpoGen: "LTPO 4", "LTPO 3", "LTPO 2", "LTPS" etc. or null

PLATFORM:
- os: "Android 15", "iOS 18", "HarmonyOS 5" etc.
- ui: "One UI 7", "MIUI 15", "OxygenOS 15" etc. or null
- chipset: full official name (e.g., "Snapdragon 8 Elite for Galaxy", "Apple A18 Pro")
- cpu: detailed config (e.g., "2x4.47GHz Oryon V2 + 6x3.53GHz Oryon V2")
- gpu: GPU name (e.g., "Adreno 830", "Apple GPU 6-core")
- processNode: manufacturing process (e.g., "3nm TSMC", "4nm Samsung") or null
- npuTops: AI performance in TOPS (e.g., 45, 75) or null
- antutuV10: AnTuTu v10 total score as integer (e.g., 2150000)
- geekbench6: {"single": 2800, "multi": 8500} or null

MEMORY:
- ramOptions: [8, 12, 16] in GB as numbers
- storageOptions: [128, 256, 512, 1024] in GB as numbers
- storageType: "UFS 4.0", "UFS 3.1", "NVMe" etc.
- cardSlot: true/false

CAMERAS:
REAR (array, main camera first):
  - kind: "wide" | "ultrawide" | "telephoto" | "periscope" | "periscope telephoto" | "macro" | "depth" | "ToF" | "LiDAR"
  - megapixels: number (e.g., 200, 50, 12, 10, 0.3)
  - aperture: "f/1.7" format
  - sensorSize: "1/1.3\"" format with 1/ prefix
  - pixelSize: "0.6μm" format with μm
  - fieldOfViewDeg: degrees (e.g., 120, 85)
  - opticalZoom: multiplier (e.g., 3, 5, 10, 0)
  - digitalZoom: multiplier (e.g., 100, 30)
  - stabilization: "OIS" | "EIS" | "OIS+EIS" | "Sensor-shift OIS" | "Action mode" | "None"
  - video: ["8K@30fps", "4K@120fps", "1080p@240fps"]

FRONT (array):
  - Same fields, kind = "selfie" or "wide"

CAMERA FEATURES (array): Include ALL computational photography features:
  "Night Mode", "Portrait Mode", "Pro Mode", "8K Video", "AI Photo Enhancer",
  "Magic Eraser", "Best Take", "Photo Unblur", "Astrophotography",
  "Cinematic Mode", "Action Mode", "Spatial Video", "ProRes Video",
  "Log Video", "Director's View", "Single Take", "AI Scene Optimizer",
  "Professional RAW", "Focus Peaking", "Zebra Lines", "Histogram"

VIDEO CAPABILITIES (array): ["8K@30fps", "4K@120fps", "1080p@240fps", "HDR10+", "Dolby Vision", "ProRes 422", "Cinematic 4K@30fps"]

AUDIO:
- speakers: ["stereo"] or ["mono"] or ["stereo", "Dolby Atmos"]
- headphoneJack: true/false
- codecs: ["aptX HD", "LDAC", "AAC", "LC3", "Lossless"]
- microphone: number of mics or description (e.g., "3 microphones" or null)

BATTERY:
- capacityMah: integer in mAh (e.g., 5000)
- type: "Li-Po" | "Li-Ion" | "Silicon-carbon" etc.
- chargingWatts: wired (e.g., 45, 100, 240)
- chargingTimeMin: 0-100% time in minutes (e.g., 30) or null
- wirelessWatts: wireless (e.g., 15, 50) or null
- reverseWirelessWatts: reverse wireless (e.g., 4.5, 10) or null
- enduranceHours: GSMArena endurance rating hours (e.g., 114) or null
- adaptiveCharging: true/false (AI-based charging optimization)
- bypassCharging: true/false (gaming bypass charging)

CONNECTIVITY:
- wifi: "Wi-Fi 7", "Wi-Fi 6E", "Wi-Fi 6" etc.
- bluetooth: "5.4", "5.3", "5.2" etc.
- nfc: true/false
- usb: "USB-C 3.2 Gen 2", "USB-C 2.0", "USB-C 3.1" etc.
- irBlaster: true/false
- gnss: ["GPS L1+L5", "GLONASS", "Galileo", "BeiDou", "QZSS", "NavIC"]
- bands: ALL cellular bands — 5G ["n1","n3","n7",...], 4G ["B1","B3",...], 3G ["B1","B2",...]
- thread: true/false (Thread/Matter smart home protocol)
- matter: true/false (Matter smart home standard)
- satelliteType: "Iridium", "Globalstar", "Qualcomm Snapdragon Satellite", "MediaTek" or null

SENSORS (array): ["accelerometer", "gyroscope", "proximity", "compass", "barometer", "fingerprint", "face recognition", "ToF sensor", "LiDAR scanner", "color spectrum sensor", "magnetometer"]

EXTRAS:
- fingerprint: "under-display (ultrasonic)" | "under-display (optical)" | "side-mounted" | "rear-mounted" | "under-display (3D Sonic Max)" or null
- faceUnlock: true/false (secure 3D face unlock)
- stylus: true/false + model (e.g., "S Pen")
- esim: true/false
- uwb: true/false (Ultra-Wideband)
- satelliteSos: true/false (emergency satellite SOS)
- aiFeatures (array): ALL on-device AI features — "Gemini Nano", "Apple Intelligence", "Galaxy AI", "Live Translate", "Circle to Search", "AI Summary", "AI Writing", "Photo AI Editor", "Real-time call translation", "AI-generated emoji", "Smart Reply"
- boxContents (array): What's in the box — ["Phone", "USB-C cable", "SIM ejector", "Quick start guide", "S Pen"] — NEVER include charger unless confirmed
- updatePolicy: e.g., "7 years OS, 7 years security" or "3 years OS, 4 years security"
- sarValue: Head/Body SAR (e.g., "Head: 0.98 W/kg, Body: 1.25 W/kg") or null

PRICING:
- msrp: launch price in USD (e.g., 1299)
- currentPrice: current market price in USD (e.g., 1099) or null
- currency: "USD" (default)
- region: "US", "Global", "EU" etc.

SOFTWARE:
- osUpdateYears: years of OS updates (e.g., 7)
- securityUpdateYears: years of security updates (e.g., 7)
- aiPlatform: "Google AI / Gemini", "Apple Intelligence", "Samsung Galaxy AI", "Qualcomm AI Engine" or null

VARIANTS (array):
- name: variant identifier (e.g., "SM-S938U", "A3293")
- region: "US", "Global", "China", "Japan", "Europe", "India" etc.
- chipset: if different from base (e.g., some regions get Exynos instead of Snapdragon)
- ramGb: if different from base
- storageGb: if different from base
- modem: modem variant if known (e.g., "Snapdragon X80")
- note: special notes (e.g., "China-only", "No Google services")

IMAGES:
- heroImage: OFFICIAL high-res product image URL (min 1000x1000px)
  Search strategy:
    1. Search: "[phone name] official press image high resolution PNG"
    2. Search: "[brand] [name] product image official CDN"
    3. Search: "[phone name] GSMArena pictures"
    4. Search: "[phone name] phonearena images"
    Prefer: samsung.com, apple.com, oneplus.com, xiaomi.com CDN URLs
    Avoid: thumbnails, crops, watermarks, "thumb", "small", "preview"
- gallery (array): Official press photos, color variants, multiple angles
    Search: "[phone name] all color variants official images"
    Search: "[phone name] press kit gallery official"
- renderImages (array): 3D renders, product shots, promotional images
    Search: "[phone name] official renders high quality"
    Search: "[phone name] promotional render wallpaper"

IMAGE SEARCH PRIORITY (execute ALL):
1. Official manufacturer press/media page
2. GSMArena device page → Pictures tab
3. PhoneArena device page
4. Official social media announcement posts
5. Retailer product pages (if official unavailable)
Set to null if no official images found — NEVER use stock/placeholder images.

CONFIDENCE:
- overall: 0.0-1.0 (how confident in ALL data combined)
- verifiedFields (array): fields verified from 2+ sources
- estimatedFields (array): fields from single source or partially verified
- unavailableFields (array): fields that could not be found

SOURCES (array):
- title: source name (e.g., "GSMArena - Samsung Galaxy S25 Ultra")
- url: valid URL starting with https://
- kind: "official" | "review" | "benchmark" | "retailer" | "news"

═══════════════════════════════════════════════════════════════════
         OUTPUT FORMAT — EXAMPLE (Samsung Galaxy S25 Ultra)
═══════════════════════════════════════════════════════════════════

Output ONLY valid JSON. No markdown, no explanation, no commentary.

{"brand":"Samsung","name":"Galaxy S25 Ultra","modelNumbers":["SM-S938U","SM-S938B","SM-S938N","SM-S938Q"],"codename":"p3q","status":"available","announcedAt":"2025-01-22","releaseAt":"2025-02-07","specs":{"body":{"dimensions":{"widthMm":79.0,"heightMm":162.8,"depthMm":8.6},"weightG":233,"build":"Titanium frame, Corning Gorilla Armor 2 glass","materials":["titanium","glass"],"protection":"Gorilla Armor 2","ipRating":"IP68","colors":["Titanium Silverblue","Titanium Gray","Titanium Black","Titanium Whitesilver"],"simConfig":"Nano-SIM + eSIM"},"display":{"type":"Dynamic AMOLED 2X","sizeIn":6.9,"resolution":"1440 x 3120","ppi":505,"refreshRateHz":120,"peakBrightnessNits":2600,"hdrSupport":["HDR10+","Dolby Vision"],"pwmHz":1920,"glass":"Gorilla Armor 2","colorDepth":"12-bit","touchSamplingRateHz":240,"alwaysOnDisplay":true,"ltpoGen":"LTPO 4"},"platform":{"os":"Android 15","ui":"One UI 7","chipset":"Snapdragon 8 Elite for Galaxy","cpu":"2x4.47GHz Oryon V2 Phoenix + 6x3.53GHz Oryon V2 Phoenix","gpu":"Adreno 830","processNode":"3nm TSMC","npuTops":75,"antutuV10":2150000,"geekbench6":{"single":2800,"multi":8500}},"memory":{"ramOptions":[12,16],"storageOptions":[256,512,1024],"storageType":"UFS 4.0","cardSlot":false},"cameras":{"rear":[{"kind":"wide","megapixels":200,"aperture":"f/1.7","sensorSize":"1/1.3\"","pixelSize":"0.6μm","fieldOfViewDeg":85,"opticalZoom":0,"digitalZoom":100,"stabilization":"OIS","video":["8K@30fps","4K@120fps","1080p@240fps"]},{"kind":"telephoto","megapixels":50,"aperture":"f/3.4","sensorSize":"1/2.52\"","pixelSize":"0.7μm","fieldOfViewDeg":22,"opticalZoom":5,"digitalZoom":100,"stabilization":"OIS","video":["8K@30fps","4K@120fps"]},{"kind":"ultrawide","megapixels":50,"aperture":"f/1.9","sensorSize":"1/2.55\"","pixelSize":"0.7μm","fieldOfViewDeg":120,"opticalZoom":0,"digitalZoom":2,"stabilization":"None","video":["8K@30fps","4K@120fps"]}],"front":[{"kind":"selfie","megapixels":12,"aperture":"f/2.2","sensorSize":"1/3.2\"","pixelSize":"1.12μm","fieldOfViewDeg":80,"opticalZoom":0,"digitalZoom":2,"stabilization":"None","video":["4K@60fps"]}],"features":["Night Mode","Portrait Mode","Pro Mode","8K Video","AI Photo Enhancer","Nightography","Expert RAW","Astrophotography","Single Take","Director's View"],"videoCapabilities":["8K@30fps","4K@120fps","1080p@240fps","HDR10+","ProRes 422"]},"audio":{"speakers":["stereo"],"headphoneJack":false,"codecs":["aptX HD","LDAC","AAC","LC3"],"microphone":"3 microphones"},"battery":{"capacityMah":5000,"type":"Li-Po","chargingWatts":45,"chargingTimeMin":65,"wirelessWatts":15,"reverseWirelessWatts":4.5,"enduranceHours":114,"adaptiveCharging":true,"bypassCharging":false},"connectivity":{"wifi":"Wi-Fi 7","bluetooth":"5.4","nfc":true,"usb":"USB-C 3.2 Gen 2","irBlaster":false,"gnss":["GPS L1+L5","GLONASS","Galileo","BeiDou","QZSS","NavIC"],"bands":["n1","n2","n3","n5","n7","n8","n12","n20","n25","n28","n38","n40","n41","n66","n71","n77","n78","n258"],"thread":true,"matter":true,"satelliteType":null},"sensors":["accelerometer","gyroscope","proximity","compass","barometer","fingerprint","face recognition","magnetometer","color spectrum sensor"],"extras":{"fingerprint":"under-display (ultrasonic)","faceUnlock":true,"stylus":true,"esim":true,"uwb":true,"satelliteSos":false,"aiFeatures":["Galaxy AI","Circle to Search","Live Translate","AI Photo Editor","Chat Assist","Notebook Assist","Circle to Search","AI Summary"],"boxContents":["Samsung Galaxy S25 Ultra","USB-C to USB-C cable","SIM ejector tool","Quick start guide"],"updatePolicy":"7 years OS, 7 years security","sarValue":"Head: 0.98 W/kg, Body: 1.25 W/kg"}},"pricing":{"msrp":1299.99,"currentPrice":1199.99,"currency":"USD","region":"US"},"software":{"osUpdateYears":7,"securityUpdateYears":7,"aiPlatform":"Samsung Galaxy AI / Google Gemini"},"variants":[{"name":"SM-S938U","region":"US","chipset":"Snapdragon 8 Elite for Galaxy","ramGb":12,"storageGb":256,"modem":"Snapdragon X80","note":"US unlocked"},{"name":"SM-S938B","region":"Global","chipset":"Snapdragon 8 Elite","ramGb":12,"storageGb":256,"modem":"Snapdragon X80","note":"International"}],"images":{"heroImage":"https://image-us.samsung.com/SamsungUS/home/mobile/phones/galaxy-s25-ultra/01172025/Gallery-S25Ultra-TitaniumSilverblue.jpg","gallery":["https://image-us.samsung.com/SamsungUS/home/mobile/phones/galaxy-s25-ultra/01172025/Gallery-S25Ultra-TitaniumGray.jpg"],"renderImages":[]},"confidence":{"overall":0.95,"verifiedFields":["brand","name","chipset","display size","battery capacity","camera megapixels","RAM","storage"],"estimatedFields":["touch sampling rate","SAR value"],"unavailableFields":[]},"sources":[{"title":"Samsung Official - Galaxy S25 Ultra","url":"https://www.samsung.com/us/smartphones/galaxy-s25-ultra/","kind":"official"},{"title":"GSMArena - Samsung Galaxy S25 Ultra","url":"https://www.gsmarena.com/samsung_galaxy_s25_ultra-13211.php","kind":"review"},{"title":"NanoReview - Samsung Galaxy S25 Ultra","url":"https://nanoreview.net/en/smartphone/samsung-galaxy-s25-ultra","kind":"retailer"}]}

═══════════════════════════════════════════════════════════════════
         QUALITY GATES — SELF-CHECK BEFORE OUTPUT
═══════════════════════════════════════════════════════════════════

Before outputting the JSON, verify:
1. Is every camera entry complete with megapixels, aperture, sensor size?
2. Are ALL 5G bands included (search for "[phone] 5G bands list")?
3. Is the battery capacity correct (cross-verify 2 sources)?
4. Is the heroImage a real, working URL (not a placeholder)?
5. Are color names the EXACT official marketing names?
6. Is the chipset the FULL official name (not abbreviated)?
7. Are benchmark scores from 2024-2025 (not outdated)?
8. Is the status current (not outdated)?
9. Are all prices in USD?
10. Are sources valid, clickable URLs?

If any answer is "no", fix it before outputting.`;

/** Max output tokens. */
const MAX_OUTPUT_TOKENS = 16384;

// ---------------------------------------------------------------------------
// Extract a fully-typed spec sheet for a device query.
// Uses Gemini LLM with Google Search Grounding.
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
      userMessage += `\n\nPREVIOUS ATTEMPT MISSING FIELDS — search specifically for these:\n${missing}`;
    } else if (isRetry) {
      userMessage += `\n\nPREVIOUS ATTEMPT HAD INVALID JSON — output ONLY valid JSON with no markdown or commentary.`;
    }

    const response = await geminiGenerateContent({
      systemInstruction: PROMPT,
      userMessage,
      temperature: isRetry ? 0 : 0.15,
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

      // If this is a retry and we got valid data, check if it's complete enough
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

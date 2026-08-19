// ============================================================================
// Scraper Output Types — matches phones.json output from scraper.py
// ----------------------------------------------------------------------------
// This file describes the JSON structure produced by the Python scraper and
// consumed by the Next.js import pipeline / Firestore ingestion.
// ============================================================================

// ---------------------------------------------------------------------------
// Image assets
// ---------------------------------------------------------------------------

export interface PhoneImages {
  /** Hero / main product shot (front render or official press image). */
  main: string | null;
  /** Gallery: different angles, color variants, lifestyle shots. */
  gallery: string[];
  /** Manufacturer press renders (high-res transparent/white-bg PNGs). */
  renders: string[];
  /** Sample photos taken with the phone's camera (GSMArena samples). */
  cameraSamples: string[];
}

// ---------------------------------------------------------------------------
// Screen / Display
// ---------------------------------------------------------------------------

export interface PhoneScreen {
  type: string;          // "Dynamic LTPO AMOLED 2X", "IPS LCD", etc.
  sizeIn: number | null; // 6.8
  resolution: string;    // "1440 x 3120 pixels"
  ppi: number | null;
  refreshRateHz: number | null;
  peakBrightnessNits: number | null;
  hdr: string[];         // ["HDR10+", "Dolby Vision"]
  protection: string;    // "Corning Gorilla Armor 2"
  touchSamplingHz: number | null;
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export interface PhoneCameraLens {
  label: string;          // "wide", "ultrawide", "telephoto", "periscope", "macro", "depth"
  megapixels: number | null;
  aperture: string;       // "f/1.7"
  sensorSize: string;     // '1/1.3"'
  pixelSizeUm: number | null;
  fovDeg: number | null;
  opticalZoom: number | null;
  stabilization: string;  // "OIS", "EIS", "OIS+EIS", ""
  features: string[];     // ["PDAF", "Laser AF"]
}

export interface PhoneCameras {
  rear: PhoneCameraLens[];
  front: PhoneCameraLens | null;
  videoMax: string;       // "8K@30fps, 4K@120fps"
  features: string[];     // ["LED flash", "HDR", "panorama"]
}

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

export interface PhonePlatform {
  os: string;             // "Android 14"
  ui: string;             // "One UI 6.1"
  chipset: string;        // "Qualcomm Snapdragon 8 Gen 3"
  processNodeNm: number | null;
  cpu: string;            // "Octa-core (1x3.3 GHz + 3x3.15 GHz + 4x2.2 GHz)"
  gpu: string;            // "Adreno 750"
  antutuV10: number | null;
  geekbench6Single: number | null;
  geekbench6Multi: number | null;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export interface PhoneMemory {
  ramGb: number[];
  storageGb: number[];
  storageType: string;    // "UFS 4.0"
  cardSlot: boolean;
}

// ---------------------------------------------------------------------------
// Battery
// ---------------------------------------------------------------------------

export interface PhoneBattery {
  capacityMah: number | null;
  type: string;           // "Li-Po", "Li-Ion", "Silicon-carbon"
  chargingW: number | null;
  wirelessChargingW: number | null;
  reverseW: number | null;
}

// ---------------------------------------------------------------------------
// Connectivity
// ---------------------------------------------------------------------------

export interface PhoneConnectivity {
  network: string;        // "GSM / CDMA / HSPA / EVDO / LTE / 5G"
  wifi: string;           // "Wi-Fi 7"
  bluetooth: string;      // "5.4"
  nfc: boolean;
  usb: string;            // "USB Type-C 3.2"
  irBlaster: boolean;
  satelliteSos: boolean;
  uwb: boolean;
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

export interface PhoneBody {
  dimensions: string;     // "162.3 x 79.0 x 8.6 mm"
  weightG: number | null;
  build: string;          // "Glass front (Gorilla Armor 2), titanium frame, glass back"
  ipRating: string;       // "IP68"
  sim: string;            // "Nano-SIM + eSIM"
  colors: string[];
  materials: string[];
}

// ---------------------------------------------------------------------------
// Extras
// ---------------------------------------------------------------------------

export interface PhoneExtras {
  fingerprint: string;    // "under display, ultrasonic"
  faceUnlock: boolean;
  stylus: boolean;
  stylusStorage: boolean;
  speakers: string;       // "stereo speakers"
  headphoneJack: boolean;
  fmRadio: boolean;
  sensors: string[];
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export interface PhonePricing {
  msrp: number | null;
  currency: string;       // "USD"
  startingPrice: number | null;
}

// ---------------------------------------------------------------------------
// Top-level phone document — the JSON output from scraper.py
// ---------------------------------------------------------------------------

export interface ScrapedPhone {
  /** Stable identifier derived from brand + model name. */
  id: string;
  /** URL-safe slug matching the GSMArena page name. */
  slug: string;
  /** Human-readable name, e.g. "Samsung Galaxy S24 Ultra". */
  name: string;
  /** Brand name, e.g. "Samsung". */
  brand: string;
  /** GSMArena phone ID (numeric). */
  gsmarenaId: number | null;
  /** Direct URL to the GSMArena product page. */
  sourceUrl: string;

  /** Announcement date (ISO 8601 or "YYYY-MM" or "YYYY"). */
  announcedAt: string | null;
  /** Release / availability date. */
  releaseAt: string | null;
  /** Derived year for quick filtering. */
  releaseYear: number | null;
  /** Device lifecycle status. */
  status: "rumored" | "announced" | "upcoming" | "available" | "discontinued";

  /** All image assets. */
  images: PhoneImages;

  /** Full specification sheet. */
  specs: {
    body: PhoneBody;
    screen: PhoneScreen;
    cameras: PhoneCameras;
    platform: PhonePlatform;
    memory: PhoneMemory;
    battery: PhoneBattery;
    connectivity: PhoneConnectivity;
    extras: PhoneExtras;
  };

  /** Pricing snapshot. */
  pricing: PhonePricing;

  /** ISO 8601 timestamp of when this record was scraped. */
  scrapedAt: string;
  /** ISO 8601 timestamp of the last update. */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Scraper runtime types (not in JSON, used during scraping)
// ---------------------------------------------------------------------------

export interface ScraperProgress {
  mode: "full" | "daily";
  startedAt: string;
  lastBrand: string | null;
  lastPage: number;
  totalBrands: number;
  completedBrands: number;
  totalPhones: number;
  scrapedPhones: number;
  failedUrls: string[];
  errors: Array<{ url: string; error: string; timestamp: string }>;
}

export interface ScraperStats {
  totalBrands: number;
  totalPhones: number;
  successRate: number;
  avgTimePerPhone: number;
  imageDownloadRate: number;
  duration: string;
}

import type { Timestamp } from "firebase-admin/firestore";

// ============================================================================
// SpecNova Firestore Data Model
// ----------------------------------------------------------------------------
// Collection layout (all top-level collections):
//
//   devices/{deviceId}              -> Device (one doc per device *family*)
//   devices/{id}/variants/{vId}     -> DeviceVariant (regional SKUs)
//   devices/{id}/embeddings/{vId}   -> EmbeddingVector (semantic index)
//   price_history/{variantId}       -> PriceHistory (compact ring buffer)
//   carrier_bands/{bandId}          -> CarrierBand (network coverage map)
//   price_alerts/{userId}           -> { alertIds: { PriceAlert } }
//   scrape_jobs/{jobId}             -> ScrapeJob (on-demand fallback queue)
//   users/{userId}                  -> UserProfile (prefs, fcm tokens)
// ============================================================================

export type DeviceStatus =
  | "rumored"
  | "announced"
  | "upcoming"
  | "available"
  | "discontinued";

export interface Device {
  /** Stable ID, derived from the primary brand + model slug. */
  id: string;
  slug: string;
  brand: string;
  name: string;
  /** Model / market numbers, e.g. "SM-S938U1". */
  modelNumbers: string[];
  codename: string | null;
  status: DeviceStatus;
  announcedAt: Timestamp | null;
  releaseAt: Timestamp | null;

  /** Dominant brand accent for dynamic UI glow (hex). */
  brandColor: string;

  specs: DeviceSpecs;
  media: DeviceMedia;

  /** Normalized "living spec sheet" for LLM consumption. */
  content: string;
  /** Semantic embedding of `content` (gemini-embedding-001, dim 768). */
  embedding: number[];

  score: SpecNovaScore;
  priceSummary: PriceSummary;

  /** Network group ids (see carrier_bands). */
  bandGroupIds: string[];

  sources: SourceRef[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DeviceVariant {
  id: string;
  deviceId: string;
  region: string;
  name: string;
  chipset: string;
  ramGb: number;
  storageGb: number;
  storageType: "UFS 2.2" | "UFS 3.1" | "UFS 4.0" | "eMMC 5.1";
  modem: string | null;
  connectivity: Connectivity;
  price: { usd: number; currency: string };
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

export interface DeviceSpecs {
  body: {
    dimensions: { widthMm: number; heightMm: number; depthMm: number };
    weightG: number;
    build: string;
    materials: string[];
    protection: string | null;
    ipRating: string | null;
    colors: string[];
  };
  display: {
    type: "OLED" | "AMOLED" | "LTPO AMOLED" | "LCD" | "Mini-LED";
    sizeIn: number;
    resolution: string;
    ppi: number;
    refreshRateHz: number;
    peakBrightnessNits: number;
    hdrSupport: string[];
    pwmHz: number | null;
    glass: string | null;
    colorDepth: string;
  };
  platform: {
    os: string;
    ui: string;
    chipset: string;
    cpu: string;
    gpu: string;
    antutuV10: number | null;
    geekbench6: { single: number; multi: number } | null;
  };
  memory: {
    ramOptions: number[];
    storageOptions: number[];
    storageType: DeviceVariant["storageType"];
    cardSlot: boolean;
  };
  cameras: {
    rear: CameraSpec[];
    front: CameraSpec[];
    features: string[];
    videoCapabilities: string[];
  };
  audio: {
    speakers: string[];
    headphoneJack: boolean;
    codecs: string[];
    microphone: string;
  };
  battery: {
    capacityMah: number;
    type: string;
    chargingWatts: number;
    chargingTimeMin: number | null;
    wirelessWatts: number;
    reverseWirelessWatts: number;
    enduranceHours: number | null;
  };
  connectivity: Connectivity;
  sensors: string[];
  extras: {
    fingerprint: "under-display" | "side" | "rear" | "none";
    faceUnlock: boolean;
    stylus: boolean;
    esim: boolean;
    uwb: boolean;
    satelliteSos: boolean;
  };
}

export interface Connectivity {
  wifi: string;
  bluetooth: string;
  nfc: boolean;
  usb: string;
  irBlaster: boolean;
  gnss: string[];
  /** Supported 3G/4G/5G bands, e.g. "n1", "n77", "B28". */
  bands: string[];
}

export interface CameraSpec {
  id: string;
  position: "rear" | "front";
  kind: "wide" | "ultrawide" | "telephoto" | "periscope" | "macro" | "depth" | "selfie";
  megapixels: number;
  aperture: string | null;
  sensorSize: string | null;
  pixelSize: string | null;
  fieldOfViewDeg: number | null;
  opticalZoom: number | null;
  digitalZoom: number | null;
  stabilization: "OIS" | "OIS+EIS" | "EIS" | "none";
  video: string[];
}

export interface DeviceMedia {
  heroImage: string | null;
  gallery: string[];
  renderImages: string[];
  /** glb/gltf model URL for the 3D inspector. */
  modelUrl: string | null;
  cameraSamples: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Scoring, Pricing, Reviews
// ---------------------------------------------------------------------------

export interface SpecNovaScore {
  total: number;
  hardware: number;
  display: number;
  camera: number;
  battery: number;
  value: number;
  sentiment: number;
  updatedAt: Timestamp;
}

export interface PriceSummary {
  currency: string;
  latest: number;
  msrp: number;
  min: number;
  max: number;
  average: number;
  dropPercent: number;
  trend: "falling" | "rising" | "stable";
  sources: string[];
  updatedAt: Timestamp;
}

export interface SourceRef {
  kind: "official" | "tenaa" | "fcc" | "retailer" | "benchmark";
  url: string;
  title: string;
  fetchedAt: Timestamp;
}

export interface ReviewSummary {
  deviceId: string;
  sentimentScore: number;
  positive: string[];
  negative: string[];
  themes: { label: string; weight: number }[];
  generatedAt: Timestamp;
  model: string;
}

// ---------------------------------------------------------------------------
// Price History
// ---------------------------------------------------------------------------

export interface PricePoint {
  ts: Timestamp;
  priceUsd: number;
  currency: string;
  source: string;
  availability: "in-stock" | "out-of-stock" | "pre-order" | "unavailable";
}

export interface PriceHistory {
  variantId: string;
  deviceId: string;
  points: PricePoint[];
  lastPoint: PricePoint | null;
  windowDays: number;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Carrier Bands
// ---------------------------------------------------------------------------

export interface CarrierBand {
  id: string;
  countryCode: string;
  country: string;
  carrier: string;
  technology: "2G" | "3G" | "4G" | "5G";
  band: string;
  frequency: string;
  bandwidthMhz: number | null;
  status: "live" | "testing" | "planned";
  standalone: boolean;
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSION = 768;

export interface EmbeddingVector {
  id: string;
  deviceId: string;
  model: string;
  dimension: number;
  content: string;
  /** Vector field target for Firestore `findNearest`. */
  embedding: number[];
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Search / Alerts / Jobs
// ---------------------------------------------------------------------------

export interface PriceAlert {
  id: string;
  deviceId: string;
  variantId: string;
  targetPriceUsd: number;
  thresholdPercent: number;
  channels: ("push" | "email")[];
  createdAt: Timestamp;
  lastTriggeredAt: Timestamp | null;
  active: boolean;
}

export interface ScrapeJob {
  id: string;
  type: "on-demand" | "scheduled";
  query: string;
  status: "queued" | "running" | "succeeded" | "failed";
  requestedBy: string | null;
  attempts: number;
  deviceId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  error: string | null;
}

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  fcmTokens: string[];
  priceAlertCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Collection path constants
// ---------------------------------------------------------------------------

export const COLLECTIONS = {
  devices: "devices",
  variants: "variants",
  embeddings: "embeddings",
  priceHistory: "price_history",
  carrierBands: "carrier_bands",
  priceAlerts: "price_alerts",
  scrapeJobs: "scrape_jobs",
  oemMediaJobs: "oem_media_jobs",
  users: "users",
  auditLogs: "audit_logs",
} as const;

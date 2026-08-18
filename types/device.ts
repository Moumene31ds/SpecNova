// ============================================================================
// iToPhone shared device types (web + pipeline)
// ----------------------------------------------------------------------------
// Superset / extension module built on top of `lib/firebase/types.ts`.
// Everything here is serialization-safe (no firebase-admin runtime imports)
// so it can be imported from server actions, client components and the
// functions runtime alike. The base Firestore model stays in
// `lib/firebase/types.ts`; this module only *adds* the fields used by the
// OEM media pipeline, the JIT server action and the gallery.
// ============================================================================

import type {
  Device,
  DeviceMedia,
  DeviceSpecs,
  DeviceStatus,
  DeviceVariant,
  PriceSummary,
  SourceRef,
} from "@/lib/firebase/types";

// ---------------------------------------------------------------------------
// Serialization-safe device document
// ---------------------------------------------------------------------------

/** Core identity + lifecycle fields of a device *family*. */
export interface DeviceCore {
  id: string;
  slug: string;
  brand: string;
  name: string;
  modelNumbers: string[];
  codename: string | null;
  status: DeviceStatus;
  /** Opaque timestamps: firebase-admin Timestamp server-side, POJO after a round-trip. */
  announcedAt: unknown;
  releaseAt: unknown;
  /** Dominant brand accent for dynamic UI glow (hex). */
  brandColor: string;
}

/**
 * The `DeviceSpecs` union with additive legacy/vintage fields. Never a
 * rebuild of the base shape — only optional extension keys are layered on.
 */
export type FullSpecs = DeviceSpecs & VintageSpec;

/**
 * Media payload as written by the OEM image pipeline: the base `DeviceMedia`
 * plus QC results, per-asset CDN families and color cut-outs.
 */
export type DeviceMediaDocument = DeviceMedia & OemMedia;

/** Split view: identity + specs + media (what the app actually renders). */
export type BaseDevice = DeviceCore & {
  specs: FullSpecs;
  media: DeviceMediaDocument;
};

/**
 * One serializable device record — the shape the ingestion pipeline writes
 * to `devices/{slug}` and routes read back. Kept structurally compatible
 * with `Device` so `DeviceDocument` and `Device` are interchangeable at
 * call sites that tolerate the widened media/specs.
 */
export type DeviceDocument = BaseDevice & {
  content: string;
  /** Omitted from network payloads; kept for the vector index write. */
  embedding?: number[];
  score: Device["score"];
  priceSummary: PriceSummary;
  bandGroupIds: string[];
  sources: SourceRef[];
  createdAt: unknown;
  updatedAt: unknown;
};

// ---------------------------------------------------------------------------
// Variants / SKUs / colorways
// ---------------------------------------------------------------------------

/**
 * Granular retail SKU (one row per region × color × storage × carrier).
 * Supplements the coarser `DeviceVariant` in `lib/firebase/types.ts`.
 */
export interface VariantSKU {
  sku: string;
  deviceId: string;
  region: string;
  market: string;
  modelNumber: string;
  colorName: string;
  colorHex: string;
  storageGb: number;
  ramGb: number;
  priceUsd: number | null;
  msrpUsd: number | null;
  inStock: boolean;
  url: string | null;
  carrier: string | null;
  updatedAt: unknown;
}

/** A per-color render/cut-out surfaced in the gallery color picker. */
export interface ColorVariantImage {
  colorName: string;
  colorHex: string;
  source: "official" | "render" | "user";
  imageUrl: string;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// CDN assets / media pipeline
// ---------------------------------------------------------------------------

export interface DensitySet {
  "1x": string;
  "2x": string;
  "3x": string;
}

/**
 * Responsive asset family produced by `functions/src/processOEMImages.ts`
 * and served through Firebase Storage (public CDN reads).
 */
export interface AssetCDNUrls {
  /** Master uploaded to GCS (original pixel size). */
  original: string;
  /** AVIF + WebP srcset families (1x/2x/3x at the configured base width). */
  avif: DensitySet;
  webp: DensitySet;
  /** Background-removed transparent PNG (hero / color cut-outs), if produced. */
  transparentPng: string | null;
  /** Tiny blurred placeholder (LQIP) for the gallery stage. */
  blurDataUrl: string | null;
}

/** AI QC lifecycle for a single media asset. */
export type MediaAssetStatus =
  | "pending"
  | "processing"
  | "passed"
  | "rejected";

export interface QcVerdict {
  model: string;
  passed: boolean;
  confidence: number;
  reasons: string[];
  suggestedColor: string | null;
  reviewedAt: unknown;
}

/** Queue entry consumed by the `oem_media_jobs` Cloud Function trigger. */
export interface OemMediaJob {
  id: string;
  deviceId: string;
  slug: string;
  kind: "official" | "render" | "sample" | "manual";
  sourceUrl: string;
  status: MediaAssetStatus;
  qc: QcVerdict | null;
  cdn: AssetCDNUrls | null;
  attempts: number;
  createdAt: unknown;
  updatedAt: unknown;
}

/** Extension fields layered onto `Device.media` by the OEM pipeline. */
export interface OemMedia {
  /** QC-pas list of assets attached to this device. */
  assetJobs: OemMediaJob[];
  /** Per-asset CDN families keyed by asset id. */
  cdn: Record<string, AssetCDNUrls>;
  /** Colorway cut-outs for the gallery color picker. */
  colorVariants: ColorVariantImage[];
  /** Last time the device's media went through AI QC. */
  lastQcAt: unknown;
  qcModel: string;
}

// ---------------------------------------------------------------------------
// Vintage / OCR-parsed legacy devices
// ---------------------------------------------------------------------------

/** Additive fields for phones from the OCR'd vintage catalogs. */
export interface VintageDetails {
  year: number;
  formFactor: "bar" | "clamshell" | "slider" | "qwerty" | "swivel";
  /** 2G/3G only, e.g. "GSM 900/1800". */
  bands: string[];
  removableBattery: boolean;
  expandableStorage: boolean;
  physicalKeyboard: boolean;
  polyphonic: boolean;
  java: boolean;
  fmRadio: boolean;
  infrared: boolean;
  releaseAs: string | null;
}

/** Layered on top of `DeviceSpecs` (see `FullSpecs`). */
export interface VintageSpec {
  vintage?: VintageDetails;
}

// ---------------------------------------------------------------------------
// Helpers (self-contained: no client-hostile imports)
// ---------------------------------------------------------------------------

/** Canonical URL-safe slug. Mirrors `lib/utils.ts` but keeps this module dependency-free. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const COLOR_HEX: Record<string, string> = {
  black: "#17181B",
  "space black": "#111827",
  "titanium black": "#17181B",
  white: "#F4F4F5",
  silver: "#C0C4CC",
  gray: "#9CA3AF",
  grey: "#9CA3AF",
  graphite: "#4B5563",
  gold: "#D4AF37",
  "rose gold": "#E0BFB8",
  blue: "#2563EB",
  "midnight blue": "#1E3A8A",
  navy: "#1E3A8A",
  red: "#DC2626",
  pink: "#EC4899",
  purple: "#7C3AED",
  violet: "#7C3AED",
  green: "#16A34A",
  teal: "#0D9488",
  mint: "#A7F3D0",
  orange: "#EA580C",
  yellow: "#EAB308",
  titanium: "#A8A29E",
  starlight: "#E7E0D6",
  midnight: "#1E293B",
  ivory: "#FFFFF0",
  cream: "#F5EFE0",
  beige: "#E8DCC4",
  turquoise: "#2DD4BF",
  coral: "#FB7185",
  lavender: "#C4B5FD",
};

/** Map a color name to a hex swatch; deterministic hash fallback for unknown names. */
export function colorToHex(colorName: string): string {
  const key = colorName.trim().toLowerCase();
  const known = COLOR_HEX[key];
  if (known) return known;

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 0.6, 0.45);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Detect vintage/legacy devices: either an explicit `vintage` block, or an
 * LCD screen with no chipset (the classic pre-smartphone fingerprint).
 */
export function isVintageDevice(specs: unknown): boolean {
  if (!specs || typeof specs !== "object") return false;
  const s = specs as { vintage?: VintageDetails; display?: { type?: string }; platform?: { chipset?: string } };
  if (s.vintage) return true;
  const type = s.display?.type ?? "";
  const chipset = s.platform?.chipset ?? "";
  return type === "LCD" && chipset.length === 0;
}

/** Build a public Firebase Storage CDN URL for a GCS object path. */
export function storageUrl(bucket: string, objectPath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
    objectPath,
  )}?alt=media`;
}

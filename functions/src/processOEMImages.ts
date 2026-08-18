import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { gemini15Flash } from "@genkit-ai/googleai";
import { z } from "genkit";
import sharp from "sharp";
import { ai } from "./ai";
import { db, COLLECTIONS } from "./config";

/**
 * OEM media pipeline for the triple-layer ingestion engine.
 *
 * Consumes `oem_media_jobs/{jobId}` docs (written by the web layer or the
 * bulk harvesters) and produces:
 *
 *   1. Gemini Vision AI QC  — is this actually a photo/render of the device?
 *   2. sharp CDN variants   — AVIF + WebP 1x/2x/3x + LQIP blur placeholder.
 *   3. background removal   — transparent PNG cut-out via corner keying
 *                             (only when Vision confirms a plain backdrop).
 *   4. Storage upload       — public `devices/{slug}/media/...` objects.
 *   5. Device doc backfill  — `media.assetJobs`, `media.cdn`, color variants,
 *                             hero/gallery/camera-samples wiring.
 *
 * Storage rules already expose `devices/{slug}/media/*` as public reads and
 * deny direct writes, so this is the single write path for device media.
 */

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
/** Base display width; 1x/2x/3x are generated from it (capped at source). */
const BASE_WIDTH = 640;

const COLLECTION = COLLECTIONS.oemMediaJobs;

// ---------------------------------------------------------------------------
// Local mirrors of the shared shapes in `types/device.ts` (the functions
// tsconfig does not include the web tree, so keep them in sync manually).
// ---------------------------------------------------------------------------

type MediaAssetStatus = "pending" | "processing" | "passed" | "rejected";

interface QcVerdict {
  model: string;
  passed: boolean;
  confidence: number;
  reasons: string[];
  suggestedColor: string | null;
  reviewedAt: unknown;
}

interface DensitySet {
  "1x": string;
  "2x": string;
  "3x": string;
}

interface AssetCDNUrls {
  original: string;
  avif: DensitySet;
  webp: DensitySet;
  transparentPng: string | null;
  blurDataUrl: string | null;
}

interface OemMediaJob {
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

const QcResultSchema = z.object({
  isCorrectDevice: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).default([]),
  suggestedColor: z.string().nullish(),
  transparentReady: z.boolean().default(false),
});

type QcResult = z.infer<typeof QcResultSchema>;

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

/** Full media pipeline for one job. Returns the terminal job state. */
export async function processOEMImages(job: OemMediaJob): Promise<OemMediaJob> {
  const started = Date.now();
  const device = `${job.deviceId || job.slug}`;

  const source = await downloadSource(job.sourceUrl);
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unreadable image metadata for ${job.sourceUrl}`);
  }

  // ---- 1. AI QC ----------------------------------------------------------
  const qcResult = await runQc(job, source);
  const qc: QcVerdict = {
    model: "gemini-1.5-flash",
    passed: qcResult.isCorrectDevice && qcResult.confidence >= 0.55,
    confidence: Math.round(qcResult.confidence * 100) / 100,
    reasons: qcResult.reasons,
    suggestedColor: qcResult.suggestedColor ?? null,
    reviewedAt: Timestamp.now(),
  };

  if (!qc.passed) {
    console.info(
      `[oem-media] rejected ${job.sourceUrl} for ${device} ` +
        `(confidence ${qc.confidence}): ${qc.reasons.join("; ")}`,
    );
    return { ...job, status: "rejected", qc };
  }

  // ---- 2+3+4. Transcode, cut-out, upload --------------------------------
  const assetBase = `${job.slug}-${job.kind}-${hash(job.sourceUrl).slice(0, 8)}`;
  const bucket = bucketName();
  const cdn = await buildAndUpload(
    bucket,
    job.slug,
    source,
    assetBase,
    metadata.width,
    qcResult.transparentReady,
  );

  // ---- 5. Backfill the device document ---------------------------------
  await backfillDevice(job, cdn, qc, metadata.width, metadata.height);

  const elapsed = Date.now() - started;
  console.info(
    `[oem-media] processed ${job.sourceUrl} -> ${job.slug} in ${elapsed}ms`,
  );

  return { ...job, status: "passed", qc, cdn };
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function downloadSource(sourceUrl: string): Promise<Buffer> {
  const res = await fetch(sourceUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "user-agent": "iToPhoneMediaPipeline/1.0" },
  });
  if (!res.ok) {
    throw new Error(`download ${sourceUrl} -> HTTP ${res.status}`);
  }

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_SOURCE_BYTES) {
    throw new Error(`source too large (${declared} bytes)`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_SOURCE_BYTES) {
    throw new Error(`source too large (${buffer.byteLength} bytes)`);
  }
  return buffer;
}

async function runQc(job: OemMediaJob, source: Buffer): Promise<QcResult> {
  const subject = job.deviceId || job.slug;
  const brand = subject.split(/[- ]+/)[0] ?? "";
  const dataUrl = `data:image/png;base64,${source.toString("base64")}`;
  const response = await ai.generate({
    model: gemini15Flash,
    prompt: [
      {
        text: `You are iToPhone's media quality controller. Decide whether the
attached image is an official, accurate photo or render of the ${subject}
smartphone from ${brand}. Answer with the JSON schema.

- isCorrectDevice: true ONLY for a clean photo/render of that exact phone.
  Reject logos, marketing banners, mixed collages, retail boxes, accessories,
  other devices, text-heavy slides, and heavily watermarked stock.
- confidence: your probability that the verdict is right (0..1).
- reasons: 1-3 short reasons for the verdict.
- suggestedColor: the dominant body color name (e.g. "Titanium Black"), or
  null when the color is unclear.
- transparentReady: true when the phone sits on a plain, near-uniform light
  background (white/gray studio shot) so a background cut-out will look good.`,
      },
      { media: { url: dataUrl, contentType: "image/png" } },
    ],
    output: { schema: QcResultSchema },
  });

  const output = response.output;
  if (!output) {
    throw new Error("Gemini Vision QC returned no structured output.");
  }
  return output;
}

async function buildAndUpload(
  bucket: string,
  slug: string,
  source: Buffer,
  assetBase: string,
  sourceWidth: number,
  transparentReady: boolean,
): Promise<AssetCDNUrls> {
  const orientation = await sharp(source).metadata();
  const ext = orientation.format === "jpeg" ? "jpg" : (orientation.format ?? "png");

  const dir = `devices/${slug}/media`;

  // Master (original pixels).
  const originalPath = `${dir}/${assetBase}-master.${ext}`;
  const original = await upload(bucket, originalPath, source, mimeFor(ext), true);

  // Density families (1x/2x/3x).
  const densities = [1, 2, 3].map((m) => Math.min(BASE_WIDTH * m, sourceWidth));
  const widths = {
    "1x": densities[0],
    "2x": densities[1],
    "3x": densities[2],
  };

  const avif = {} as DensitySet;
  const webp = {} as DensitySet;

  for (const key of Object.keys(widths) as Array<keyof DensitySet>) {
    const width = widths[key];
    const avifPath = `${dir}/${assetBase}-${key}.avif`;
    const webpPath = `${dir}/${assetBase}-${key}.webp`;
    const [avifBuf, webpBuf] = await Promise.all([
      encodeVariant(source, width, "avif"),
      encodeVariant(source, width, "webp"),
    ]);
    const [avifUrl, webpUrl] = await Promise.all([
      upload(bucket, avifPath, avifBuf, "image/avif", true),
      upload(bucket, webpPath, webpBuf, "image/webp", true),
    ]);
    avif[key] = avifUrl;
    webp[key] = webpUrl;
  }

  // LQIP blur placeholder.
  const lqip = await sharp(source)
    .resize(24, null, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 40 })
    .toBuffer();
  const blurDataUrl = `data:image/webp;base64,${lqip.toString("base64")}`;

  // Background-removed transparent PNG (only when QC confirmed a clean backdrop).
  let transparentPng: string | null = null;
  if (transparentReady) {
    try {
      const cutout = await removeBackground(source);
      const pngPath = `${dir}/${assetBase}-transparent.png`;
      transparentPng = await upload(bucket, pngPath, cutout, "image/png", true);
    } catch (err) {
      console.warn(
        `[oem-media] background removal skipped for ${assetBase}:`,
        err,
      );
    }
  }

  return {
    original,
    avif,
    webp,
    transparentPng,
    blurDataUrl: blurDataUrl.slice(0, 1200),
  };
}

async function encodeVariant(
  source: Buffer,
  width: number,
  format: "avif" | "webp",
): Promise<Buffer> {
  const pipeline = sharp(source)
    .rotate()
    .resize(width, null, { fit: "inside", withoutEnlargement: true });
  return format === "avif"
    ? pipeline.avif({ quality: 70, effort: 4 }).toBuffer()
    : pipeline.webp({ quality: 82 }).toBuffer();
}

/**
 * Corner-key background removal. Samples the (assumed) uniform studio
 * background from the corners, then soft-masks pixels within a distance
 * window of that key color to transparent. Deterministic, dependency-free
 * (sharp raw pixel pass only) — reserved for QC-confirmed clean backdrops.
 */
async function removeBackground(source: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(source)
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const px = Buffer.from(data);

  const sample = (x: number, y: number): [number, number, number] => {
    const i = (Math.max(0, Math.min(width - 1, x)) + Math.max(0, Math.min(height - 1, y)) * width) * channels;
    return [px[i], px[i + 1], px[i + 2]];
  };
  const corners = [
    sample(2, 2),
    sample(width - 3, 2),
    sample(2, height - 3),
    sample(width - 3, height - 3),
    sample(Math.floor(width / 2), 2),
  ];
  const key: [number, number, number] = [
    Math.round(corners.reduce((s, c) => s + c[0], 0) / corners.length),
    Math.round(corners.reduce((s, c) => s + c[1], 0) / corners.length),
    Math.round(corners.reduce((s, c) => s + c[2], 0) / corners.length),
  ];

  const LO = 26;
  const HI = 120;
  const out = Buffer.alloc(width * height * 4);
  for (let p = 0, o = 0; p < px.length; p += channels, o += 4) {
    const d = Math.max(
      Math.abs(px[p] - key[0]),
      Math.abs(px[p + 1] - key[1]),
      Math.abs(px[p + 2] - key[2]),
    );
    let alpha = 255;
    if (d < LO) alpha = 0;
    else if (d < HI) alpha = Math.round(((d - LO) / (HI - LO)) * 255);
    out[o] = px[p];
    out[o + 1] = px[p + 1];
    out[o + 2] = px[p + 2];
    out[o + 3] = alpha;
  }

  return sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function upload(
  bucketName: string,
  objectPath: string,
  data: Buffer,
  contentType: string,
  publicRead: boolean,
): Promise<string> {
  const file = getStorage().bucket(bucketName).file(objectPath);
  await file.save(data, {
    contentType,
    public: publicRead,
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000, immutable" },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    objectPath,
  )}?alt=media`;
}

async function backfillDevice(
  job: OemMediaJob,
  cdn: AssetCDNUrls,
  qc: QcVerdict,
  width: number,
  height: number,
): Promise<void> {
  const deviceRef = db.collection(COLLECTIONS.devices).doc(job.slug);

  const jobEntry = {
    id: job.id,
    deviceId: job.deviceId || job.slug,
    slug: job.slug,
    kind: job.kind,
    sourceUrl: job.sourceUrl,
    status: "passed" as const,
    qc,
    cdn,
    attempts: job.attempts,
    createdAt: job.createdAt ?? Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const patch: Record<string, unknown> = {
    "media.assetJobs": FieldValue.arrayUnion(jobEntry),
    [`media.cdn.${job.id}`]: cdn,
    "media.qcModel": "gemini-1.5-flash",
    "media.lastQcAt": Timestamp.now(),
  };

  if (qc.suggestedColor) {
    patch["media.colorVariants"] = FieldValue.arrayUnion({
      colorName: qc.suggestedColor,
      colorHex: colorToHex(qc.suggestedColor),
      source: job.kind === "official" ? "official" : "render",
      imageUrl: cdn.transparentPng ?? cdn.original,
      width,
      height,
    });
  }

  if (job.kind === "official") {
    patch["media.gallery"] = FieldValue.arrayUnion(cdn.original);
  } else if (job.kind === "sample") {
    patch[`media.cameraSamples.${job.id}`] = cdn.original;
  }

  const devSnap = await deviceRef.get();
  if (
    job.kind === "official" &&
    (!devSnap.exists || !devSnap.get("media.heroImage"))
  ) {
    patch["media.heroImage"] = cdn.original;
  }

  await deviceRef.set(patch, { merge: true });
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

/**
 * Firestore trigger over `oem_media_jobs/{jobId}`. Enqueues the QC + CDN
 * pipeline and keeps the job doc in lockstep with every state transition
 * so the gallery can render JIT image fallback states.
 */
export const onOemMediaJobCreated = onDocumentCreated(
  {
    document: `${COLLECTION}/{jobId}`,
    timeoutSeconds: 300,
    memory: "1GiB",
    retry: true,
  },
  async (event) => {
    if (!event.data) return;
    const job = event.data.data() as OemMediaJob;
    job.id = event.params.jobId;

    const jobRef = event.data.ref;
    await jobRef.update({
      status: "processing",
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      const done = await processOEMImages(job);
      await jobRef.update({
        status: done.status,
        qc: done.qc,
        cdn: done.cdn,
        attempts: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[oem-media] job ${job.id} failed:`, err);
      await jobRef.update({
        status: "rejected",
        qc: {
          ...(job.qc ?? {
            model: "gemini-1.5-flash",
            passed: false,
            confidence: 0,
            reasons: [],
            suggestedColor: null,
          }),
          passed: false,
          reasons: [
            ...(job.qc?.reasons ?? []),
            `pipeline error: ${message.slice(0, 200)}`,
          ],
          reviewedAt: Timestamp.now(),
        },
        attempts: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);

// ---------------------------------------------------------------------------
// Small helpers (functions build is isolated from the web `types/device.ts`)
// ---------------------------------------------------------------------------

function bucketName(): string {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    `${process.env.GCLOUD_PROJECT ?? "specnova"}.appspot.com`
  );
}

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function mimeFor(ext: string): string {
  switch (ext) {
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
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
  blue: "#2563EB",
  navy: "#1E3A8A",
  red: "#DC2626",
  pink: "#EC4899",
  purple: "#7C3AED",
  green: "#16A34A",
  teal: "#0D9488",
  orange: "#EA580C",
  yellow: "#EAB308",
  titanium: "#A8A29E",
  starlight: "#E7E0D6",
  midnight: "#1E293B",
};

function colorToHex(colorName: string): string {
  const key = colorName.trim().toLowerCase();
  if (COLOR_HEX[key]) return COLOR_HEX[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  const a = 0.6 * Math.min(0.45, 1 - 0.45);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const c = 0.45 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

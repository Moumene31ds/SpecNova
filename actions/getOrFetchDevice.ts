"use server";

import { revalidatePath } from "next/cache";
import { getAdminFirestore, isFirebaseConfigured } from "@/lib/firebase/admin";
import { getServerUser } from "@/lib/firebase/auth";
import { getDeviceBySlug } from "@/lib/search/vector-search";
import { findDeviceBySlug } from "@/lib/dev-data";
import { COLLECTIONS, type ScrapeJob } from "@/lib/firebase/types";
import { slugify, type DeviceDocument } from "@/types/device";

/**
 * Result of a zero-missing device lookup.
 *  - `found`     → the device is already indexed; callers render immediately.
 *  - `enqueued`  → the device is unknown; an on-demand scrape_jobs doc was
 *                  written and `onScrapeJobCreated` will ingest it (~3s).
 *  - `unavailable` → nothing could be produced (dev mode / auth / error).
 */
export type DeviceLookupResult =
  | { status: "found"; device: DeviceDocument }
  | { status: "enqueued"; jobId: string; slug: string }
  | { status: "unavailable"; slug: string; reason: string };

/** Mirrors the firestore.rules per-identity enqueue rate limit. */
const ENQUEUE_COOLDOWN_MS = 60_000;

/**
 * JIT on-demand harvesting: read `devices/{slug}` first, and if it does not
 * exist, enqueue a `scrape_jobs` doc so the Cloud Functions pipeline picks
 * it up and writes the device back. Falls back to the bundled dev catalog
 * when Firestore is not configured so routes stay renderable locally.
 */
export async function getOrFetchDevice(
  slug: string,
  query?: string,
): Promise<DeviceLookupResult> {
  const target = slugify(slug);
  if (!target) {
    return { status: "unavailable", slug, reason: "invalid-slug" };
  }

  const searchQuery = (query ?? slug).trim().slice(0, 120) || target;

  // ------------------------------------------------------------------
  // Dev mode: no Firestore to enqueue into — use the bundled catalog.
  // ------------------------------------------------------------------
  if (!isFirebaseConfigured()) {
    const dev = findDeviceBySlug(target);
    if (dev) {
      return { status: "found", device: plainify(dev as unknown as DeviceDocument) };
    }
    return { status: "unavailable", slug: target, reason: "not-in-dev-catalog" };
  }

  // ------------------------------------------------------------------
  // Live index: single-read path.
  // ------------------------------------------------------------------
  let existing: DeviceDocument | null = null;
  try {
    const hit = await getDeviceBySlug(target);
    if (hit) existing = plainify(stripEmbedding(hit)) as unknown as DeviceDocument;
  } catch (err) {
    console.error("[specnova] getOrFetchDevice index read failed", err);
    return { status: "unavailable", slug: target, reason: "firestore-unavailable" };
  }
  if (existing) return { status: "found", device: existing };

  // ------------------------------------------------------------------
  // Zero-Missing path: dedupe + rate-limit, then enqueue a scrape job.
  // ------------------------------------------------------------------
  const db = getAdminFirestore();
  const jobsRef = db.collection(COLLECTIONS.scrapeJobs);

  const recent = await jobsRef.where("query", "==", searchQuery).limit(20).get();
  const recentJobs = recent.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Array<ScrapeJob & { id: string }>;

  const active = recentJobs.find(
    (job) => job.status === "queued" || job.status === "running",
  );
  if (active) {
    return { status: "enqueued", jobId: active.id, slug: target };
  }

  const newest = recentJobs
    .filter((job) => toMillis(job.createdAt) > 0)
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))[0];
  if (newest && Date.now() - toMillis(newest.createdAt) < ENQUEUE_COOLDOWN_MS) {
    return { status: "enqueued", jobId: newest.id, slug: target };
  }

  const user = await getServerUser();
  if (!user) {
    return {
      status: "unavailable",
      slug: target,
      reason: "auth-required-to-enqueue",
    };
  }

  const jobRef = jobsRef.doc();
  const job: ScrapeJob = {
    id: jobRef.id,
    type: "on-demand",
    query: searchQuery,
    status: "queued",
    requestedBy: user.uid,
    attempts: 0,
    deviceId: target,
    createdAt: new Date() as never,
    updatedAt: new Date() as never,
    error: null,
  };
  await jobRef.set({ ...job, createdAt: new Date(), updatedAt: new Date() });

  revalidatePath(`/phone/${target}`);
  return { status: "enqueued", jobId: jobRef.id, slug: target };
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/** Drop the heavy vector field before shipping a device to the client. */
function stripEmbedding(device: Record<string, unknown>): Record<string, unknown> {
  const { embedding: _embedding, ...rest } = device;
  return rest;
}

/**
 * Convert firebase-admin `Timestamp` instances (and nested objects) into
 * plain serializable POJOs so the action result survives React Flight
 * serialization. Date objects pass through untouched.
 */
export function plainify<T>(value: T): T {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((item) => plainify(item)) as T;

  if (value && typeof value === "object") {
    const candidate = value as { toMillis?: unknown; seconds?: unknown; nanoseconds?: unknown };
    if (typeof candidate.toMillis === "function") {
      return {
        seconds: candidate.seconds,
        nanoseconds: candidate.nanoseconds,
      } as T;
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = plainify(item);
    }
    return out as T;
  }

  return value;
}

function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  const candidate = ts as { toMillis?: unknown; seconds?: number };
  if (typeof candidate.toMillis === "function") {
    return (candidate as { toMillis(): number }).toMillis();
  }
  return candidate.seconds ? candidate.seconds * 1000 : 0;
}

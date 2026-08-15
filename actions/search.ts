"use server";

import { revalidatePath } from "next/cache";
import { getServerUser } from "@/lib/firebase/auth";
import { vectorSearch, getDevicesBySlugs } from "@/lib/search/vector-search";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, type ScrapeJob } from "@/lib/firebase/types";
import { getServerTokens } from "@/lib/firebase/auth";

export interface AiSearchResult {
  hits: Array<{
    device: {
      id: string;
      slug: string;
      brand: string;
      name: string;
      status: string;
      priceSummary?: { latest: number; currency: string };
      score?: { total: number };
      media?: { heroImage: string | null };
      brandColor: string;
    };
    score: number;
  }>;
  query: string;
  latencyMs: number;
}

/**
 * Hybrid AI search server action.
 * Embeds the natural-language query via Gemini then runs Firestore
 * Native Vector Search (cosine), fused with a keyword leg.
 */
export async function aiSearch(
  query: string,
  limit = 8,
): Promise<AiSearchResult> {
  const started = performance.now();
  const trimmed = query.trim();
  if (!trimmed) return { hits: [], query: trimmed, latencyMs: 0 };

  const hits = await vectorSearch(trimmed, limit);

  return {
    hits: hits.map(({ device, score }) => ({
      device: {
        id: String(device.id ?? ""),
        slug: String(device.slug ?? ""),
        brand: String(device.brand ?? ""),
        name: String(device.name ?? ""),
        status: String(device.status ?? "available"),
        brandColor: String(device.brandColor ?? "#8A2BE2"),
        priceSummary: device.priceSummary as AiSearchResult["hits"][number]["device"]["priceSummary"],
        score: device.score as AiSearchResult["hits"][number]["device"]["score"],
        media: device.media as AiSearchResult["hits"][number]["device"]["media"],
      },
      score,
    })),
    query: trimmed,
    latencyMs: Math.round(performance.now() - started),
  };
}

/**
 * Zero-Missing guarantee: enqueue an on-demand scrape for a device that
 * the index does not know yet. The Firestore `onCreate scrape_jobs`
 * trigger spins up a headless Playwright job, normalizes via Gemini and
 * writes back within ~3s.
 */
export async function triggerOnDemandScrape(query: string): Promise<{
  ok: boolean;
  jobId?: string;
  error?: string;
}> {
  const user = await getServerUser();
  if (!user) {
    return { ok: false, error: "Sign in to request an unindexed device." };
  }

  const db = getAdminFirestore();
  const jobRef = db.collection(COLLECTIONS.scrapeJobs).doc();

  const job: ScrapeJob = {
    id: jobRef.id,
    type: "on-demand",
    query: query.trim().slice(0, 120),
    status: "queued",
    requestedBy: user.uid,
    attempts: 0,
    deviceId: null,
    createdAt: new Date() as never,
    updatedAt: new Date() as never,
    error: null,
  };

  await jobRef.set({ ...job, createdAt: new Date(), updatedAt: new Date() });

  revalidatePath("/search");
  return { ok: true, jobId: jobRef.id };
}

/** Batch fetch for the /compare route. */
export async function fetchCompareDevices(slugs: string[]) {
  const devices = await getDevicesBySlugs(slugs);
  return devices.map((d) => ({ ...d, id: d.id, embedding: undefined }));
}

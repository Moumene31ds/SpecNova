import "server-only";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { isFirebaseConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS, type PriceHistory } from "@/lib/firebase/types";
import { getDevCatalog } from "@/lib/dev-data";

interface PriceHistoryResult {
  variantId: string;
  deviceId: string;
  points: { ts: number; priceUsd: number; source: string }[];
  current: { priceUsd: number; currency: string } | null;
}

/**
 * Deterministic synthetic history for the bundled dev catalog — keeps the
 * price chart fully renderable before the live Firestore index is wired.
 */
function syntheticHistory(variantId: string): PriceHistoryResult {
  const device = getDevCatalog(60).find((d) => d.id === variantId);
  if (!device) return { variantId, deviceId: "", points: [], current: null };

  const latest = device.priceSummary.latest ?? 1199;
  const msrp = device.priceSummary.msrp ?? Math.round(latest * 1.12);
  const days = 180;
  const now = Date.now();
  const step = Math.max(2, Math.round(days / 120));

  const points: { ts: number; priceUsd: number; source: string }[] = [];
  for (let i = days; i >= 0; i -= step) {
    const progress = 1 - i / days;
    const base = msrp - (msrp - latest) * progress;
    const wave = Math.sin(i * 0.7) * (msrp * 0.012);
    points.push({
      ts: now - i * 86_400_000,
      priceUsd: Math.max(1, Math.round(base + wave)),
      source: "synthetic",
    });
  }
  points[points.length - 1] = { ...points[points.length - 1]!, priceUsd: latest };

  return {
    variantId,
    deviceId: device.id,
    points,
    current: { priceUsd: latest, currency: device.priceSummary.currency ?? "USD" },
  };
}

/**
 * Read a variant's price history, downsampled for the client chart.
 * Server-side so the raw ring buffer never leaves the edge. Falls back to
 * the deterministic dev dataset when Firestore isn't configured.
 */
export async function getPriceHistory(
  variantId: string,
  maxPoints = 120,
): Promise<PriceHistoryResult> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.priceHistory).doc(variantId).get();
  if (!snap.exists) {
    return { variantId, deviceId: "", points: [], current: null };
  }
  const history = snap.data() as PriceHistory;

  const raw = history.points ?? [];
  const step = Math.max(1, Math.floor(raw.length / maxPoints));
  const sampled = raw
    .filter((_, i) => i % step === 0 || i === raw.length - 1)
    .map((p) => ({
      ts: Number(p.ts.toMillis?.() ?? p.ts.seconds * 1000),
      priceUsd: p.priceUsd,
      source: p.source,
    }));

  return {
    variantId,
    deviceId: history.deviceId,
    points: sampled,
    current: history.lastPoint
      ? { priceUsd: history.lastPoint.priceUsd, currency: history.lastPoint.currency }
      : null,
  };
}

export async function getPriceHistorySafe(
  variantId: string,
  maxPoints = 120,
): Promise<PriceHistoryResult> {
  if (!isFirebaseConfigured()) return syntheticHistory(variantId);
  try {
    return await getPriceHistory(variantId, maxPoints);
  } catch (err) {
    console.error("[specnova] Firestore price read failed, using synthetic.", err);
    return syntheticHistory(variantId);
  }
}

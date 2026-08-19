"use server";

/**
 * LIVE INSTANT FETCH SYSTEM
 *
 * When a user searches for a phone not in the database,
 * this system automatically fetches its specs in real-time
 * using the multi-step extraction pipeline.
 *
 * Flow:
 * 1. Search DB first (fast, <50ms)
 * 2. If not found, trigger live extraction (~10-30s)
 * 3. Return partial results as they come (streaming feel)
 * 4. Optionally save to DB for future searches
 */

import { extractSpecs } from "@/lib/ai/extractSpecs";
import { computeScore } from "@/lib/score/compute-score";
import { FieldValue } from "@/lib/firebase/firestore-rest";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { slugify } from "@/lib/utils";

export interface LiveFetchResult {
  found: boolean;
  source: "database" | "live" | "cache";
  device?: {
    slug: string;
    brand: string;
    name: string;
    status: string;
    score: number;
    heroImage: string | null;
    chipset: string | null;
    displaySize: number | null;
    cameraMP: number | null;
    batteryMah: number | null;
    price: number | null;
    specs: Record<string, unknown>;
  };
  latencyMs: number;
  message: string;
}

/**
 * Search for a phone — DB first, then live fetch if not found.
 */
export async function liveFetchDevice(
  query: string,
  options?: { saveToDb?: boolean },
): Promise<LiveFetchResult> {
  const start = Date.now();
  const saveToDb = options?.saveToDb ?? true;

  // ── Step 1: Search existing database ──
  try {
    const adminDb = getAdminFirestore();

    // Try exact slug match first
    const slug = slugify(query);
    const doc = await adminDb.collection("devices").doc(slug).get();
    if (doc.exists) {
      const data = doc.data()!;
      return {
        found: true,
        source: "database",
        device: formatDeviceDoc(data),
        latencyMs: Date.now() - start,
        message: `Found in database`,
      };
    }

    // Try brand + name search
    const words = query.toLowerCase().split(/\s+/);
    const brand = words[0] ?? "";
    if (brand) {
      const snapshot = await adminDb
        .collection("devices")
        .where("brand", "==", brand.charAt(0).toUpperCase() + brand.slice(1))
        .limit(20)
        .get();

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const name = (data.name ?? "").toLowerCase();
        const queryWithoutBrand = words.slice(1).join(" ");
        if (name.includes(queryWithoutBrand) || queryWithoutBrand.includes(name)) {
          return {
            found: true,
            source: "database",
            device: formatDeviceDoc(data),
            latencyMs: Date.now() - start,
            message: `Found in database`,
          };
        }
      }
    }
  } catch {
    // Firestore not available — fall through to live fetch
  }

  // ── Step 2: Live extraction from web ──
  console.log(`[liveFetch] Not found in DB, fetching live: "${query}"`);

  try {
    const { device } = await extractSpecs(query);
    const score = computeScore(device.specs);

    // Optionally save to DB for future searches
    if (saveToDb) {
      try {
        await saveLiveFetchedDevice(device, score);
        console.log(`[liveFetch] Saved to DB: ${device.brand} ${device.name}`);
      } catch (err) {
        console.warn(`[liveFetch] Failed to save to DB:`, err);
      }
    }

    return {
      found: true,
      source: "live",
      device: {
        slug: slugify(`${device.brand} ${device.name}`),
        brand: device.brand,
        name: device.name,
        status: device.status ?? "available",
        score: score.total,
        heroImage: device.images?.heroImage ?? null,
        chipset: device.specs.platform?.chipset ?? null,
        displaySize: device.specs.display?.sizeIn ?? null,
        cameraMP: device.specs.cameras?.rear?.[0]?.megapixels ?? null,
        batteryMah: device.specs.battery?.capacityMah ?? null,
        price: device.pricing?.msrp ?? null,
        specs: device.specs as unknown as Record<string, unknown>,
      },
      latencyMs: Date.now() - start,
      message: `Fetched live from web`,
    };
  } catch (err) {
    return {
      found: false,
      source: "live",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Could not find phone specifications",
    };
  }
}

function formatDeviceDoc(data: Record<string, unknown>): LiveFetchResult["device"] {
  const specs = (data.specs ?? {}) as Record<string, unknown>;
  const display = (specs.display ?? {}) as Record<string, unknown>;
  const platform = (specs.platform ?? {}) as Record<string, unknown>;
  const cameras = (specs.cameras ?? {}) as Record<string, unknown>;
  const rear = (cameras.rear ?? []) as Array<Record<string, unknown>>;
  const battery = (specs.battery ?? {}) as Record<string, unknown>;
  const pricing = (data.pricing ?? {}) as Record<string, unknown>;
  const media = (data.media ?? {}) as Record<string, unknown>;
  const score = (data.score ?? {}) as Record<string, number>;

  return {
    slug: (data.slug as string) ?? "",
    brand: (data.brand as string) ?? "",
    name: (data.name as string) ?? "",
    status: (data.status as string) ?? "available",
    score: score.total ?? 0,
    heroImage: (media.heroImage as string) ?? null,
    chipset: (platform.chipset as string) ?? null,
    displaySize: (display.sizeIn as number) ?? null,
    cameraMP: (rear[0]?.megapixels as number) ?? null,
    batteryMah: (battery.capacityMah as number) ?? null,
    price: (pricing.msrp as number) ?? null,
    specs,
  };
}

async function saveLiveFetchedDevice(
  device: import("@/lib/ai/extractSpecs").AiExtractedDevice,
  score: { total: number; hardware: number; display: number; camera: number; battery: number; value: number },
): Promise<void> {
  const adminDb = getAdminFirestore();
  const slug = slugify(`${device.brand} ${device.name}`);

  const now = FieldValue.serverTimestamp();
  const deviceData = {
    slug,
    brand: device.brand,
    name: device.name,
    modelNumbers: device.modelNumbers ?? [],
    codename: device.codename ?? null,
    status: device.status ?? "available",
    announcedAt: device.announcedAt ?? null,
    releaseAt: device.releaseAt ?? null,
    specs: device.specs,
    variants: [],
    media: {
      heroImage: device.images?.heroImage ?? null,
      gallery: device.images?.gallery ?? [],
      renderImages: device.images?.renderImages ?? [],
    },
    sources: device.sources ?? [],
    score,
    pricing: device.pricing ?? { msrp: null, currentPrice: null, currency: "USD", region: null },
    software: device.software ?? { osUpdateYears: null, securityUpdateYears: null, aiPlatform: null },
    searchContent: [
      device.brand, device.name, device.modelNumbers?.join(" ") ?? "",
      device.specs.platform?.chipset ?? "",
      `${device.specs.display?.sizeIn ?? ""}`,
      `${device.specs.battery?.capacityMah ?? ""}`,
    ].filter(Boolean).join(" ").toLowerCase(),
    confidence: device.confidence ?? { overall: 0.5, verifiedFields: [], estimatedFields: [], unavailableFields: [] },
    createdAt: now,
    updatedAt: now,
  };

  await adminDb.collection("devices").doc(slug).set(deviceData);
}

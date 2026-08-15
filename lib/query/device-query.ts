import "server-only";

import { isFirebaseConfigured } from "@/lib/firebase/admin";
import type { Device } from "@/lib/firebase/types";
import { getDevCatalog, findDeviceBySlug, findDevicesBySlugs } from "@/lib/dev-data";

/**
 * Server-side device catalog accessor. Uses the live Firestore index when
 * configured, otherwise transparently falls back to the bundled dev
 * catalog so every route remains fully renderable in local preview.
 */
export async function getCatalog(
  limit = 50,
): Promise<Device[]> {
  if (isFirebaseConfigured()) {
    try {
      const { getAdminFirestore } = await import("@/lib/firebase/admin");
      const { COLLECTIONS } = await import("@/lib/firebase/types");
      const db = getAdminFirestore();
      const snap = await db
        .collection(COLLECTIONS.devices)
        .orderBy("score.total", "desc")
        .limit(limit)
        .get();
      if (!snap.empty) {
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Device));
      }
    } catch (err) {
      console.error("[specnova] Firestore catalog read failed, using dev catalog.", err);
    }
  }
  return getDevCatalog(limit);
}

export async function getDevice(slug: string): Promise<Device | null> {
  if (isFirebaseConfigured()) {
    try {
      const { getDeviceBySlug } = await import("@/lib/search/vector-search");
      const hit = await getDeviceBySlug(slug);
      if (hit) return hit as unknown as Device;
    } catch (err) {
      console.error("[specnova] Firestore device read failed.", err);
    }
  }
  return findDeviceBySlug(slug);
}

export async function getDevices(slugs: string[]): Promise<Device[]> {
  if (isFirebaseConfigured()) {
    try {
      const { getDevicesBySlugs } = await import("@/lib/search/vector-search");
      const hits = await getDevicesBySlugs(slugs);
      if (hits.length) return hits as unknown as Device[];
    } catch (err) {
      console.error("[specnova] Firestore bulk read failed.", err);
    }
  }
  return findDevicesBySlugs(slugs);
}

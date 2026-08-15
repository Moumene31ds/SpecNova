"use server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getServerUser } from "@/lib/firebase/auth";
import { COLLECTIONS, type PriceAlert } from "@/lib/firebase/types";
import { absoluteUrl } from "@/lib/utils";

async function requireUser() {
  const user = await getServerUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export interface AlertDraft {
  deviceId: string;
  variantId: string;
  targetPriceUsd: number;
  thresholdPercent: number;
  channels: ("push" | "email")[];
}

/**
 * Subscribe to price-drop notifications. Stored per-user under
 * `price_alerts/{uid}` (Security Rules enforce owner-only access) and
 * matched against in Firestore by the `active` + `targetPriceUsd`
 * composite index when the ingestion pipeline lands a new price point.
 */
export async function subscribePriceAlert(draft: AlertDraft) {
  const user = await requireUser();
  if (!(draft.targetPriceUsd > 0)) throw new Error("INVALID_TARGET_PRICE");
  if (draft.thresholdPercent < 1 || draft.thresholdPercent > 50)
    throw new Error("INVALID_THRESHOLD");

  const db = getAdminFirestore();
  const userRef = db.collection(COLLECTIONS.priceAlerts).doc(user.uid);
  const alertId = db.collection(COLLECTIONS.priceAlerts).doc(user.uid).id;

  const alert: PriceAlert = {
    id: alertId,
    deviceId: draft.deviceId,
    variantId: draft.variantId,
    targetPriceUsd: draft.targetPriceUsd,
    thresholdPercent: draft.thresholdPercent,
    channels: draft.channels,
    createdAt: new Date() as never,
    lastTriggeredAt: null,
    active: true,
  };

  await userRef.set(
    { [alertId]: { ...alert, createdAt: new Date() } },
    { merge: true },
  );
  return { ok: true as const, alertId };
}

export async function unsubscribePriceAlert(alertId: string) {
  const user = await requireUser();
  const db = getAdminFirestore();
  await db
    .collection(COLLECTIONS.priceAlerts)
    .doc(user.uid)
    .update({ [alertId]: {} } as never);
  return { ok: true as const };
}

export async function listMyPriceAlerts(): Promise<PriceAlert[]> {
  const user = await requireUser();
  const db = getAdminFirestore();
  const doc = await db.collection(COLLECTIONS.priceAlerts).doc(user.uid).get();
  if (!doc.exists) return [];
  const data = doc.data() as Record<string, unknown>;
  return Object.values(data).filter((v): v is PriceAlert => {
    return (
      typeof v === "object" &&
      v !== null &&
      "targetPriceUsd" in v &&
      Boolean((v as PriceAlert).active)
    );
  });
}

/** Web-push / email unsubscribe endpoint used by FCM click-throughs. */
export async function optOutViaLink(token: string) {
  const db = getAdminFirestore();
  if (!token) return { ok: false as const };
  const snap = await db
    .collection(COLLECTIONS.priceAlerts)
    .where("id", "==", token)
    .limit(1)
    .get();
  snap.docs.forEach((d) => d.ref.update({ active: false }));
  return { ok: true as const };
}

export async function buildUnsubscribeUrl(alertId: string) {
  return absoluteUrl(`/api/unsubscribe?alert=${alertId}`);
}

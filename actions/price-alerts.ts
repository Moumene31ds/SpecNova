"use server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getServerUser } from "@/lib/firebase/auth";
import { COLLECTIONS, type PriceAlert } from "@/lib/firebase/types";
import { FieldValue } from "@/lib/firebase/firestore-rest";
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

  const alertRef = db.collection(COLLECTIONS.priceAlerts).doc(user.uid).collection("alerts").doc();
  const alertId = alertRef.id;

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

  await alertRef.set({ ...alert, createdAt: new Date() });
  return { ok: true as const, alertId };
}

export async function unsubscribePriceAlert(alertId: string) {
  const user = await requireUser();
  const db = getAdminFirestore();
  const alertRef = db
    .collection(COLLECTIONS.priceAlerts)
    .doc(user.uid)
    .collection("alerts")
    .doc(alertId);
  await alertRef.update({ active: false });
  return { ok: true as const };
}

export async function deletePriceAlert(alertId: string) {
  const user = await requireUser();
  const db = getAdminFirestore();
  const alertRef = db
    .collection(COLLECTIONS.priceAlerts)
    .doc(user.uid)
    .collection("alerts")
    .doc(alertId);
  await alertRef.delete();
  return { ok: true as const };
}

export async function listMyPriceAlerts(): Promise<PriceAlert[]> {
  const user = await requireUser();
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.priceAlerts)
    .doc(user.uid)
    .collection("alerts")
    .where("active", "==", true)
    .get();
  return snap.docs.map((doc) => doc.data() as PriceAlert);
}

/** Web-push / email unsubscribe endpoint used by FCM click-throughs. */
export async function optOutViaLink(token: string) {
  const db = getAdminFirestore();
  if (!token) return { ok: false as const };

  const usersSnap = await db.collection(COLLECTIONS.priceAlerts).get();
  for (const userDoc of usersSnap.docs) {
    const alertRef = userDoc.ref.collection("alerts").doc(token);
    const alertSnap = await alertRef.get();
    if (alertSnap.exists) {
      await alertRef.update({ active: false });
      return { ok: true as const };
    }
  }
  return { ok: false as const };
}

export async function buildUnsubscribeUrl(alertId: string) {
  return absoluteUrl(`/api/unsubscribe?alert=${alertId}`);
}

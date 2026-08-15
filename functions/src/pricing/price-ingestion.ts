import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { Timestamp, FieldValue, type Firestore } from "firebase-admin/firestore";
import { db, COLLECTIONS } from "../config";
import { sendPriceDropNotification } from "../notifications/price-drop-fcm";

export interface PriceIngestionInput {
  deviceId: string;
  priceUsd: number;
  currency: string;
  source: string;
  availability?: "in-stock" | "out-of-stock" | "pre-order" | "unavailable";
}

/**
 * Record a retail price point for a device variant and evaluate price
 * alerts. Queries the `active + targetPriceUsd` composite index for any
 * alert whose target is now met, then fans out FCM / email notifications.
 */
export async function ingestPricePoint(firestore: Firestore, input: PriceIngestionInput) {
  const { deviceId, priceUsd, currency, source } = input;
  const availability = input.availability ?? "in-stock";

  const historyRef = firestore
    .collection(COLLECTIONS.priceHistory)
    .doc(`${deviceId}_${currency}`);

  const point = {
    ts: Timestamp.now(),
    priceUsd,
    currency,
    source,
    availability,
  };

  await historyRef.set(
    {
      variantId: `${deviceId}_${currency}`,
      deviceId,
      lastPoint: point,
      points: FieldValue.arrayUnion(point),
      windowDays: 365,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  const now = Timestamp.now();
  const alerts = await firestore
    .collectionGroup(COLLECTIONS.priceAlerts)
    .where("active", "==", true)
    .where("targetPriceUsd", ">=", priceUsd)
    .get();

  let notified = 0;
  for (const alertDoc of alerts.docs) {
    const alert = alertDoc.data();
    if (alert.variantId !== `${deviceId}_${currency}`) continue;

    const userId = alertDoc.ref.parent.id;
    await alertDoc.ref.update({
      active: false,
      lastTriggeredAt: now,
    });

    await sendPriceDropNotification(
      userId,
      {
        deviceId,
        currentPriceUsd: priceUsd,
        currency,
        targetPriceUsd: alert.targetPriceUsd as number,
        source,
      },
      alert.channels as ("push" | "email")[],
    );
    notified++;
  }

  console.info(
    `[pricing] ${deviceId} @ $${priceUsd} (${source}) — ${notified} alerts fired`,
  );
  return { notified };
}

/**
 * Manual / webhook ingestion entrypoint, protected by the webhook secret
 * (mirrors Vercel Cron calling /api/cron/prices).
 */
export const ingestPriceFromClient = onCall<PriceIngestionInput>(
  { region: "us-central1", secrets: ["FUNCTIONS_WEBHOOK_SECRET"] },
  async (request) => {
    if (request.auth?.token.admin !== true) {
      throw new Error("Admin-only.");
    }
    return ingestPricePoint(db, request.data);
  },
);

/** Hourly retail sweep placeholder — swap with real retailer APIs. */
export const scheduledPriceSweep = onSchedule(
  "every 1 hours",
  async () => {
    const trending = await db
      .collection(COLLECTIONS.devices)
      .orderBy("priceSummary.dropPercent", "desc")
      .limit(50)
      .get();

    let processed = 0;
    for (const doc of trending.docs) {
      const device = doc.data();
      const price = device.priceSummary?.latest;
      if (typeof price !== "number" || price <= 0) continue;
      await ingestPricePoint(db, {
        deviceId: doc.id,
        priceUsd: price,
        currency: device.priceSummary.currency ?? "USD",
        source: "Retail sweep",
      });
      processed++;
    }
    console.info(`[pricing] sweep processed ${processed} devices`);
  },
);

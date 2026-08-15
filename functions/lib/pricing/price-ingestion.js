"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledPriceSweep = exports.ingestPriceFromClient = void 0;
exports.ingestPricePoint = ingestPricePoint;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const config_1 = require("../config");
const price_drop_fcm_1 = require("../notifications/price-drop-fcm");
/**
 * Record a retail price point for a device variant and evaluate price
 * alerts. Queries the `active + targetPriceUsd` composite index for any
 * alert whose target is now met, then fans out FCM / email notifications.
 */
async function ingestPricePoint(firestore, input) {
    const { deviceId, priceUsd, currency, source } = input;
    const availability = input.availability ?? "in-stock";
    const historyRef = firestore
        .collection(config_1.COLLECTIONS.priceHistory)
        .doc(`${deviceId}_${currency}`);
    const point = {
        ts: firestore_1.Timestamp.now(),
        priceUsd,
        currency,
        source,
        availability,
    };
    await historyRef.set({
        variantId: `${deviceId}_${currency}`,
        deviceId,
        lastPoint: point,
        points: firestore_1.FieldValue.arrayUnion(point),
        windowDays: 365,
        updatedAt: firestore_1.Timestamp.now(),
    }, { merge: true });
    const now = firestore_1.Timestamp.now();
    const alerts = await firestore
        .collectionGroup(config_1.COLLECTIONS.priceAlerts)
        .where("active", "==", true)
        .where("targetPriceUsd", ">=", priceUsd)
        .get();
    let notified = 0;
    for (const alertDoc of alerts.docs) {
        const alert = alertDoc.data();
        if (alert.variantId !== `${deviceId}_${currency}`)
            continue;
        const userId = alertDoc.ref.parent.id;
        await alertDoc.ref.update({
            active: false,
            lastTriggeredAt: now,
        });
        await (0, price_drop_fcm_1.sendPriceDropNotification)(userId, {
            deviceId,
            currentPriceUsd: priceUsd,
            currency,
            targetPriceUsd: alert.targetPriceUsd,
            source,
        }, alert.channels);
        notified++;
    }
    console.info(`[pricing] ${deviceId} @ $${priceUsd} (${source}) — ${notified} alerts fired`);
    return { notified };
}
/**
 * Manual / webhook ingestion entrypoint, protected by the webhook secret
 * (mirrors Vercel Cron calling /api/cron/prices).
 */
exports.ingestPriceFromClient = (0, https_1.onCall)({ region: "us-central1", secrets: ["FUNCTIONS_WEBHOOK_SECRET"] }, async (request) => {
    if (request.auth?.token.admin !== true) {
        throw new Error("Admin-only.");
    }
    return ingestPricePoint(config_1.db, request.data);
});
/** Hourly retail sweep placeholder — swap with real retailer APIs. */
exports.scheduledPriceSweep = (0, scheduler_1.onSchedule)("every 1 hours", async () => {
    const trending = await config_1.db
        .collection(config_1.COLLECTIONS.devices)
        .orderBy("priceSummary.dropPercent", "desc")
        .limit(50)
        .get();
    let processed = 0;
    for (const doc of trending.docs) {
        const device = doc.data();
        const price = device.priceSummary?.latest;
        if (typeof price !== "number" || price <= 0)
            continue;
        await ingestPricePoint(config_1.db, {
            deviceId: doc.id,
            priceUsd: price,
            currency: device.priceSummary.currency ?? "USD",
            source: "Retail sweep",
        });
        processed++;
    }
    console.info(`[pricing] sweep processed ${processed} devices`);
});
//# sourceMappingURL=price-ingestion.js.map
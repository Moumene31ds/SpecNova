"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledCatalogSweep = exports.onScrapeJobCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_2 = require("firebase-admin/firestore");
const config_1 = require("../config");
const pipeline_1 = require("../pipeline");
/**
 * Real-time on-demand fallback scraper.
 *
 * Fires when a signed-in user enqueues a `scrape_jobs` doc (see the
 * `triggerOnDemandScrape` server action). Sets state running → invokes the
 * Playwright + Gemini pipeline → records the created deviceId or the
 * error, keeping the client fully informed on every state transition.
 */
exports.onScrapeJobCreated = (0, firestore_1.onDocumentCreated)("scrape_jobs/{jobId}", async (event) => {
    if (!event.data)
        return;
    const job = event.data.data();
    if (job?.type !== "on-demand")
        return;
    const jobRef = config_1.db.collection(config_1.COLLECTIONS.scrapeJobs).doc(event.params.jobId);
    await jobRef.update({ status: "running", updatedAt: firestore_2.FieldValue.serverTimestamp() });
    try {
        const result = await (0, pipeline_1.runIngestionPipeline)(job.query);
        await jobRef.update({
            status: "succeeded",
            deviceId: result.deviceId,
            attempts: firestore_2.FieldValue.increment(1),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await jobRef.update({
            status: "failed",
            error: message.slice(0, 500),
            attempts: firestore_2.FieldValue.increment(1),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
    }
});
/**
 * Scheduled freshness sweep (hourly): re-crawl recent/unindexed requests
 * and repopulate any device whose pipeline previously failed. Vercel Cron
 * also mirrors this cadence via /api/cron/scrape.
 */
exports.scheduledCatalogSweep = (0, scheduler_1.onSchedule)("every 12 hours", async () => {
    const failed = await config_1.db
        .collection(config_1.COLLECTIONS.scrapeJobs)
        .where("status", "==", "failed")
        .orderBy("updatedAt", "desc")
        .limit(20)
        .get();
    for (const doc of failed.docs) {
        const job = doc.data();
        if ((job.attempts ?? 0) >= 3)
            continue;
        try {
            const result = await (0, pipeline_1.runIngestionPipeline)(job.query);
            await doc.ref.update({
                status: "succeeded",
                deviceId: result.deviceId,
                attempts: firestore_2.FieldValue.increment(1),
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            });
        }
        catch (err) {
            console.error(`[sweep] retry failed for ${doc.id}:`, err);
        }
    }
});
//# sourceMappingURL=on-demand.js.map
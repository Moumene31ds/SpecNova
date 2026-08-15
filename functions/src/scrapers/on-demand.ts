import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue } from "firebase-admin/firestore";
import { db, COLLECTIONS } from "../config";
import { runIngestionPipeline } from "../pipeline";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

/**
 * Real-time on-demand fallback scraper.
 *
 * Fires when a signed-in user enqueues a `scrape_jobs` doc (see the
 * `triggerOnDemandScrape` server action). Sets state running → invokes the
 * Playwright + Gemini pipeline → records the created deviceId or the
 * error, keeping the client fully informed on every state transition.
 */
export const onScrapeJobCreated = onDocumentCreated(
  "scrape_jobs/{jobId}",
  async (event) => {
    if (!event.data) return;
    const job = event.data.data();
    if (job?.type !== "on-demand") return;

    const jobRef = db.collection(COLLECTIONS.scrapeJobs).doc(event.params.jobId);
    await jobRef.update({ status: "running", updatedAt: FieldValue.serverTimestamp() });

    try {
      const result = await runIngestionPipeline(job.query);
      await jobRef.update({
        status: "succeeded",
        deviceId: result.deviceId,
        attempts: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await jobRef.update({
        status: "failed",
        error: message.slice(0, 500),
        attempts: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);

/**
 * Scheduled freshness sweep (hourly): re-crawl recent/unindexed requests
 * and repopulate any device whose pipeline previously failed. Vercel Cron
 * also mirrors this cadence via /api/cron/scrape.
 */
export const scheduledCatalogSweep = onSchedule(
  "every 12 hours",
  async () => {
    const failed = await db
      .collection(COLLECTIONS.scrapeJobs)
      .where("status", "==", "failed")
      .orderBy("updatedAt", "desc")
      .limit(20)
      .get();

    for (const doc of failed.docs) {
      const job = doc.data() as { query: string; attempts: number };
      if ((job.attempts ?? 0) >= 3) continue;
      try {
        const result = await runIngestionPipeline(job.query);
        await doc.ref.update({
          status: "succeeded",
          deviceId: result.deviceId,
          attempts: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.error(`[sweep] retry failed for ${doc.id}:`, err);
      }
    }
  },
);

export type ScrapeJobDoc = QueryDocumentSnapshot;

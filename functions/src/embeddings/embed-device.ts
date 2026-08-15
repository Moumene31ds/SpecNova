import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue } from "firebase-admin/firestore";
import { db, COLLECTIONS, EMBEDDING_DIMENSION } from "../config";
import { embedDeviceContent } from "../ai";

/**
 * Keep the semantic index in sync. On any device write we re-embed the
 * normalized content and write `devices/{id}/embeddings/{id}` — the
 * collection that the vector index definition targets. Guarded by an
 * `embeddingVersion` doc field to skip already-embedded devices.
 */
export const maintainEmbeddings = onDocumentWritten(
  "devices/{deviceId}",
  async (event) => {
    const device = event.data?.after.data();
    if (!device) return;

    if (device.embeddingVersion === "v1" && event.data?.before?.exists) return;

    const content: string =
      typeof device.content === "string" && device.content.length > 0
        ? device.content
        : `${device.brand ?? ""} ${device.name ?? ""}`.trim();

    const embedding = await embedDeviceContent(content);

    const deviceRef = db.collection(COLLECTIONS.devices).doc(event.params.deviceId);
    await deviceRef.update({
      content,
      embedding: FieldValue.vector(embedding),
      embeddingVersion: "v1",
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db
      .collection(COLLECTIONS.devices)
      .doc(event.params.deviceId)
      .collection(COLLECTIONS.embeddings)
      .doc(event.params.deviceId)
      .set({
        id: event.params.deviceId,
        deviceId: event.params.deviceId,
        model: "gemini-embedding-001",
        dimension: EMBEDDING_DIMENSION,
        content,
        embedding: FieldValue.vector(embedding),
        updatedAt: FieldValue.serverTimestamp(),
      });

    console.info(`[embeddings] embedded ${event.params.deviceId}`);
  },
);

/**
 * Nightly backfill job: sweep devices missing embeddings (imported before
 * the embedding trigger shipped) and embed them in batches.
 */
export const scheduledEmbeddingBackfill = onSchedule(
  "every 24 hours",
  async () => {
    const missing = await db
      .collection(COLLECTIONS.devices)
      .where("embeddingVersion", "!=", "v1")
      .limit(50)
      .get();

    for (const doc of missing.docs) {
      const device = doc.data();
      const content = `${device.brand ?? ""} ${device.name ?? ""}`.trim();
      try {
        const embedding = await embedDeviceContent(content);
        await doc.ref.update({
          content,
          embedding: FieldValue.vector(embedding),
          embeddingVersion: "v1",
        });
      } catch (err) {
        console.error(`[embeddings] backfill failed for ${doc.id}:`, err);
      }
    }
  },
);

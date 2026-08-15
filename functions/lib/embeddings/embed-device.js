"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledEmbeddingBackfill = exports.maintainEmbeddings = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_2 = require("firebase-admin/firestore");
const config_1 = require("../config");
const ai_1 = require("../ai");
/**
 * Keep the semantic index in sync. On any device write we re-embed the
 * normalized content and write `devices/{id}/embeddings/{id}` — the
 * collection that the vector index definition targets. Guarded by an
 * `embeddingVersion` doc field to skip already-embedded devices.
 */
exports.maintainEmbeddings = (0, firestore_1.onDocumentWritten)("devices/{deviceId}", async (event) => {
    const device = event.data?.after.data();
    if (!device)
        return;
    if (device.embeddingVersion === "v1" && event.data?.before?.exists)
        return;
    const content = typeof device.content === "string" && device.content.length > 0
        ? device.content
        : `${device.brand ?? ""} ${device.name ?? ""}`.trim();
    const embedding = await (0, ai_1.embedDeviceContent)(content);
    const deviceRef = config_1.db.collection(config_1.COLLECTIONS.devices).doc(event.params.deviceId);
    await deviceRef.update({
        content,
        embedding: firestore_2.FieldValue.vector(embedding),
        embeddingVersion: "v1",
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    });
    await config_1.db
        .collection(config_1.COLLECTIONS.devices)
        .doc(event.params.deviceId)
        .collection(config_1.COLLECTIONS.embeddings)
        .doc(event.params.deviceId)
        .set({
        id: event.params.deviceId,
        deviceId: event.params.deviceId,
        model: "gemini-embedding-001",
        dimension: config_1.EMBEDDING_DIMENSION,
        content,
        embedding: firestore_2.FieldValue.vector(embedding),
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    });
    console.info(`[embeddings] embedded ${event.params.deviceId}`);
});
/**
 * Nightly backfill job: sweep devices missing embeddings (imported before
 * the embedding trigger shipped) and embed them in batches.
 */
exports.scheduledEmbeddingBackfill = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    const missing = await config_1.db
        .collection(config_1.COLLECTIONS.devices)
        .where("embeddingVersion", "!=", "v1")
        .limit(50)
        .get();
    for (const doc of missing.docs) {
        const device = doc.data();
        const content = `${device.brand ?? ""} ${device.name ?? ""}`.trim();
        try {
            const embedding = await (0, ai_1.embedDeviceContent)(content);
            await doc.ref.update({
                content,
                embedding: firestore_2.FieldValue.vector(embedding),
                embeddingVersion: "v1",
            });
        }
        catch (err) {
            console.error(`[embeddings] backfill failed for ${doc.id}:`, err);
        }
    }
});
//# sourceMappingURL=embed-device.js.map
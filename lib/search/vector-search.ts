import "server-only";

import { FieldValue, type Query } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, EMBEDDING_DIMENSION } from "@/lib/firebase/types";
import { embedText } from "@/lib/ai/embeddings";
import { classNamesOfDevice } from "@/lib/utils";

type VectorQuerySnap = Awaited<ReturnType<ReturnType<Query["findNearest"]>["get"]>>;

export interface SearchHit {
  device: Record<string, unknown>;
  score: number; // 0..1 cosine similarity
}

/**
 * Hybrid semantic search.
 *
 * Strategy:
 *   1. Vector leg   -> Firestore Native Vector Search (cosine) over `devices.embedding`.
 *   2. Keyword leg  -> brand/model token matching on `name` + `modelNumbers` array,
 *                      which catches exact SKUs the embedding may dilute.
 *   Results are fused via rank-position score blending.
 */
export async function vectorSearch(
  query: string,
  limit = 12,
): Promise<SearchHit[]> {
  const db = getAdminFirestore();
  const embedding = await embedText(query);

  // Keyword leg relies only on auto-created single-field indexes, so it
  // runs first and never blocks on the vector index being deployed.
  const keywordSnap = await keywordSearch(query, limit);

  let vectorSnap: VectorQuerySnap | null = null;
  try {
    vectorSnap = await db
      .collection(COLLECTIONS.devices)
      .findNearest({
        vectorField: "embedding",
        queryVector: embedding,
        distanceMeasure: "COSINE",
        distanceResultField: "distance",
        limit: limit * 2,
      })
      .get();
  } catch (err) {
    console.error(
      "[specnova] Firestore vector search unavailable (vector index not deployed?); using keyword leg only.",
      err,
    );
  }

  const fused = new Map<string, { device: Record<string, unknown>; score: number }>();

  vectorSnap?.docs.forEach((doc) => {
    const data = doc.data();
    const distance = (data.distance as number) ?? 1;
    const cosine = 1 - distance; // COSINE distance -> similarity
    fused.set(doc.id, { device: { id: doc.id, ...data }, score: cosine });
  });

  keywordSnap.forEach((hit) => {
    const existing = fused.get(hit.device.id as string);
    const keywordScore = hit.score * 0.85;
    if (!existing || keywordScore > existing.score) {
      fused.set(hit.device.id as string, { device: hit.device, score: Math.max(existing?.score ?? 0, keywordScore) });
    }
  });

  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ device, score }) => ({
      device: { ...device, embedding: undefined } as Record<string, unknown>,
      score: Number(score.toFixed(3)),
    }));
}

/** Lexical fallback: matches brand/model tokens and recent availability. */
async function keywordSearch(query: string, limit: number) {
  const db = getAdminFirestore();
  const tokens = classNamesOfDevice({
    brand: "",
    name: query,
    modelNumbers: [query],
  });

  if (tokens.length === 0) return [];

  const refs = db.collection(COLLECTIONS.devices);
  // Single-field `name`/`modelNumbers` queries need no composite index,
  // so this leg survives before `firestore:indexes` is deployed.
  let snap = await refs
    .where("name", "in", tokens.slice(0, 10))
    .limit(limit)
    .get();

  if (snap.empty) {
    snap = await refs
      .where("modelNumbers", "array-contains-any", tokens.slice(0, 10))
      .limit(limit)
      .get();
  }

  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        device: { id: doc.id, ...data } as Record<string, unknown>,
        score: 0.5 + (data.score?.total ?? 50) / 1000,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Random access by slug — single-read path for phone/compare pages. */
export async function getDeviceBySlug(slug: string) {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.devices)
    .where("slug", "==", slug)
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0]!.id, ...snap.docs[0]!.data() };
}

export async function getDevicesBySlugs(slugs: string[]) {
  if (slugs.length === 0) return [];
  const db = getAdminFirestore();
  const unique = [...new Set(slugs)];
  const snap = await db
    .collection(COLLECTIONS.devices)
    .where("slug", "in", unique)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export function deviceEmbeddingMustExist(): void {
  if (EMBEDDING_DIMENSION !== 768) {
    throw new Error("Embedding dimension mismatch with Firestore vector index.");
  }
}

export const vectorField = (embedding: number[]) =>
  FieldValue.vector(embedding);

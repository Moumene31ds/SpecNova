import "server-only";

import { GoogleGenAI } from "@google/genai";
import {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
} from "@/lib/firebase/types";

let genaiClient: InstanceType<typeof GoogleGenAI> | null = null;

export function getGenAI(): InstanceType<typeof GoogleGenAI> {
  if (genaiClient) return genaiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  genaiClient = new GoogleGenAI({ apiKey });
  return genaiClient;
}

/**
 * Generate a dense vector for arbitrary text using Gemini embeddings.
 * Uses `models/gemini-embedding-001` truncated to 768 dims, which matches
 * the Firestore vector index configuration (see firestore.indexes.json).
 */
export async function embedText(input: string): Promise<number[]> {
  const client = getGenAI();
  const result = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: input,
    config: { outputDimensionality: EMBEDDING_DIMENSION },
  });

  const values = result.embeddings?.[0]?.values;
  if (!values?.length) {
    throw new Error("Gemini embedContent returned no vector.");
  }
  return values;
}

/** Batched embedding with concurrency guard for index pipelines. */
export async function embedBatch(inputs: string[], batchSize = 16): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < inputs.length; i += batchSize) {
    const slice = inputs.slice(i, i + batchSize);
    const results = await Promise.all(slice.map((t) => embedText(t)));
    vectors.push(...results);
  }
  return vectors;
}

/**
 * Compose the canonical semantic-searchable text for a device. The same
 * template is used both at ingest (functions) and, without the database
 * fields, when normalizing an on-demand scrape.
 */
export function buildDeviceContent(input: {
  brand: string;
  name: string;
  modelNumbers?: string[];
  status: string;
  specs: {
    display?: { sizeIn: number; refreshRateHz: number; type: string };
    platform?: { chipset: string; os: string };
    memory?: { ramOptions: number[]; storageOptions: number[] };
    cameras?: { rear: unknown[]; front: unknown[] };
    battery?: { capacityMah: number; chargingWatts: number };
    extras?: { esim: boolean; satelliteSos: boolean };
  };
}): string {
  const { brand, name, status, specs } = input;
  const parts = [
    `${brand} ${name}`,
    ...(input.modelNumbers ?? []).map((m) => `model number ${m}`),
    `status: ${status}`,
  ];

  const d = specs.display;
  if (d) parts.push(`${d.type} display, ${d.sizeIn}" diagonal, ${d.refreshRateHz}Hz refresh rate`);

  const p = specs.platform;
  if (p) parts.push(`${p.chipset} chipset running ${p.os}`);

  const m = specs.memory;
  if (m) parts.push(`RAM options ${m.ramOptions.join("/")}GB, storage ${m.storageOptions.join("/")}GB`);

  const c = specs.cameras;
  if (c) {
    const rearCount = c.rear?.length ?? 0;
    const frontCount = c.front?.length ?? 0;
    parts.push(`${rearCount} rear camera${rearCount > 1 ? "s" : ""} and ${frontCount} front camera${frontCount > 1 ? "s" : ""}`);
  }

  const b = specs.battery;
  if (b) parts.push(`${b.capacityMah}mAh battery, ${b.chargingWatts}W charging`);

  const e = specs.extras;
  if (e) {
    const flags: string[] = [];
    if (e.esim) flags.push("eSIM");
    if (e.satelliteSos) flags.push("satellite SOS");
    if (flags.length) parts.push(`supports ${flags.join(" and ")}`);
  }

  return parts.join(". ").toLowerCase();
}

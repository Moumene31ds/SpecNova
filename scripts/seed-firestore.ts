/**
 * Seeds the Firestore `devices` collection from the bundled dev catalog,
 * embedding each device's living spec text via Gemini (`gemini-embedding-001`,
 * 768 dims) so Firestore Native Vector Search returns real semantic hits.
 *
 * Usage: npx tsx scripts/seed-firestore.ts
 * Requires .env.local with GEMINI_API_KEY + FIREBASE_SERVICE_ACCOUNT_JSON.
 */
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";
import { getDevCatalog } from "../lib/dev-data";

const envRaw = readFileSync(".env.local", "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const GEMINI_API_KEY = env.GEMINI_API_KEY;
const PROJECT_ID = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON).project_id;
const DIM = 768;

if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing in .env.local");

const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function buildContent(device: ReturnType<typeof getDevCatalog>[number]): string {
  const s = device.specs;
  const parts = [
    `${device.brand} ${device.name}`,
    ...(device.modelNumbers ?? []).map((m) => `model number ${m}`),
    `status: ${device.status}`,
  ];
  const d = s.display;
  if (d) parts.push(`${d.type} display, ${d.sizeIn}" diagonal, ${d.refreshRateHz}Hz, ${d.resolution}, ${d.peakBrightnessNits} nits`);
  const p = s.platform;
  if (p) parts.push(`${p.chipset} chipset running ${p.os}${p.ui ? ` with ${p.ui}` : ""}`);
  const m = s.memory;
  if (m) parts.push(`RAM ${m.ramOptions.join("/")}GB, storage ${m.storageOptions.join("/")}GB`);
  const c = s.cameras;
  if (c) parts.push(`${c.rear.length} rear cameras and ${c.front.length} front cameras`);
  const b = s.battery;
  if (b) parts.push(`${b.capacityMah}mAh battery with ${b.chargingWatts}W charging`);
  const e = s.extras;
  if (e) {
    const flags: string[] = [];
    if (e.esim) flags.push("eSIM");
    if (e.satelliteSos) flags.push("satellite SOS");
    if (flags.length) parts.push(`supports ${flags.join(" and ")}`);
  }
  if (device.priceSummary?.latest) parts.push(`priced around $${device.priceSummary.latest}`);
  return parts.join(". ").toLowerCase();
}

const toTs = (v: unknown): Timestamp | null => {
  if (v && typeof v === "object" && "seconds" in v) {
    return new Timestamp(Number((v as { seconds: number }).seconds), 0);
  }
  return null;
};

async function main() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON).project_id,
        clientEmail: JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON).client_email,
        privateKey: JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON).private_key,
      }),
      projectId: PROJECT_ID,
    });
  }
  const db = getFirestore();
  const devices = getDevCatalog();

  console.log(`Seeding ${devices.length} devices into project ${PROJECT_ID}...`);
  let ok = 0;
  for (const d of devices) {
    const content = buildContent(d);
    const t0 = Date.now();
    const res = await genai.models.embedContent({
      model: "gemini-embedding-001",
      contents: content,
      config: { outputDimensionality: DIM },
    });
    const values = res.embeddings?.[0]?.values ?? [];
    if (values.length !== DIM) throw new Error(`${d.slug}: got ${values.length} dims`);
    const now = Timestamp.now();
    await db.collection("devices").doc(d.id).set({
      id: d.id,
      slug: d.slug,
      brand: d.brand,
      name: d.name,
      brandColor: d.brandColor,
      modelNumbers: d.modelNumbers,
      codename: d.codename,
      status: d.status,
      announcedAt: toTs(d.announcedAt),
      releaseAt: toTs(d.releaseAt),
      specs: d.specs,
      media: d.media,
      content,
      embedding: FieldValue.vector(values),
      embeddingVersion: "v1",
      score: { ...d.score, updatedAt: now },
      priceSummary: { ...d.priceSummary, updatedAt: now },
      bandGroupIds: d.bandGroupIds,
      sources: d.sources,
      createdAt: now,
      updatedAt: now,
    });
    ok++;
    console.log(`  ✓ ${d.brand} ${d.name} (${d.slug}) — ${values.length} dims in ${Date.now() - t0}ms`);
  }
  console.log(`\nDone. ${ok}/${devices.length} devices seeded.`);
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});

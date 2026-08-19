"use server";

/**
 * AUTO-DISCOVERY BULK IMPORT SYSTEM
 *
 * Discovers ALL phone models from a brand using Google Search,
 * then extracts specs for each phone using the multi-step extraction pipeline.
 *
 * Flow:
 * 1. Discover: Gemini searches "[brand] all phone models 2024 2025 list"
 * 2. Filter: Remove duplicates and already-existing phones
 * 3. Extract: Run multi-step extraction for each new phone
 * 4. Save: Store in Firestore with computed scores
 * 5. Report: Return results summary
 */

import { z } from "zod";
import { geminiGenerateContent } from "@/lib/ai/gemini-client";
import { extractSpecs } from "@/lib/ai/extractSpecs";
import { computeScore } from "@/lib/score/compute-score";
import { FirestoreRest, FieldValue } from "@/lib/firebase/firestore-rest";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/server/adminAuth";
import { slugify } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Brand Discovery — find all models for a brand
// ---------------------------------------------------------------------------

const DISCOVERY_PROMPT = `You are a phone catalog researcher. Search Google for "{brand} all smartphone models 2024 2025 2026 complete list" and extract EVERY phone model.

For EACH phone found, return:
- Model name (official, e.g. "Galaxy S25 Ultra", "Galaxy A56", "Galaxy Z Fold 6")
- Release year (2024, 2025, or 2026)
- Status (available, announced, upcoming, rumored)
- Brief note (flagship, mid-range, budget, foldable, etc.)

Search for at least 3 different queries to find ALL models:
1. "[brand] flagship phones 2024 2025 2026"
2. "[brand] mid-range phones 2024 2025"
3. "[brand] budget phones 2024 2025"
4. "[brand] foldable phones 2024 2025"
5. "[brand] all phones complete catalog"

Return as a simple list, one phone per line:
- Model Name | Year | Status | Category

Include EVERY model — flagships, mid-range, budget, foldables, gaming phones, etc.
Do NOT skip any model. Be comprehensive.`;

interface DiscoveredPhone {
  name: string;
  year: number;
  status: string;
  category: string;
}

export async function discoverBrandModels(
  brand: string,
): Promise<{ phones: DiscoveredPhone[]; raw: string }> {
  const userMsg = DISCOVERY_PROMPT.replace(/\{brand\}/g, brand);

  const result = await geminiGenerateContent({
    systemInstruction: "You are a comprehensive phone catalog researcher. Be thorough and include EVERY model.",
    userMessage: userMsg,
    temperature: 0.1,
    maxTokens: 8192,
    useGoogleSearch: true,
  });

  const raw = result.text ?? "";
  const phones: DiscoveredPhone[] = [];

  // Parse the structured list
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.replace(/^[-*•]\s*/, "").trim();
    if (!trimmed || trimmed.length < 5) continue;

    // Try to parse "Model Name | Year | Status | Category" format
    const parts = trimmed.split("|").map((p) => p.trim());
    if (parts.length >= 2) {
      const name = parts[0]!;
      const yearStr = parts[1] ?? "";
      const status = parts[2] ?? "available";
      const category = parts[3] ?? "phone";

      const year = parseInt(yearStr, 10);
      if (!isNaN(year) && year >= 2023 && year <= 2027) {
        phones.push({ name, year, status, category });
      }
    } else {
      // Fallback: just a model name
      phones.push({
        name: trimmed.replace(/^[-*•]\s*/, ""),
        year: new Date().getFullYear(),
        status: "available",
        category: "phone",
      });
    }
  }

  return { phones, raw };
}

// ---------------------------------------------------------------------------
// Batch Import — extract and save multiple phones
// ---------------------------------------------------------------------------

interface ImportResult {
  phone: string;
  slug: string;
  status: "saved" | "error" | "skipped";
  message: string;
  score?: number;
}

export async function autoImportBrand(
  brand: string,
  options?: {
    maxPhones?: number;
    categories?: string[];
    yearMin?: number;
    skipExisting?: boolean;
  },
): Promise<{
  discovered: number;
  imported: ImportResult[];
  errors: string[];
}> {
  // Auth check
  await requireAdmin();

  const maxPhones = options?.maxPhones ?? 50;
  const categories = options?.categories;
  const yearMin = options?.yearMin ?? 2024;
  const skipExisting = options?.skipExisting ?? true;

  console.log(`[autoImport] Starting auto-discovery for "${brand}" (max: ${maxPhones})`);

  // Step 1: Discover models
  const { phones: discovered } = await discoverBrandModels(brand);
  console.log(`[autoImport] Discovered ${discovered.length} models for ${brand}`);

  // Step 2: Filter
  let filtered = discovered.filter((p) => p.year >= yearMin);
  if (categories?.length) {
    filtered = filtered.filter((p) =>
      categories.some((c) => p.category.toLowerCase().includes(c.toLowerCase())),
    );
  }
  filtered = filtered.slice(0, maxPhones);
  console.log(`[autoImport] After filtering: ${filtered.length} phones to import`);

  // Step 3: Check existing
  let existingSlugs = new Set<string>();
  if (skipExisting) {
    try {
      const adminDb = getAdminFirestore();
      const snapshot = await adminDb
        .collection("devices")
        .where("brand", "==", brand)
        .limit(200)
        .get();
      for (const doc of snapshot.docs) {
        existingSlugs.add(slugify(doc.data().name));
      }
    } catch {
      // Firestore not configured — skip existing check
    }
  }

  // Step 4: Extract and save each phone
  const results: ImportResult[] = [];
  const errors: string[] = [];

  for (const phone of filtered) {
    const phoneSlug = slugify(`${brand} ${phone.name}`);

    // Skip if already exists
    if (skipExisting && existingSlugs.has(phoneSlug)) {
      results.push({
        phone: phone.name,
        slug: phoneSlug,
        status: "skipped",
        message: "Already in database",
      });
      continue;
    }

    try {
      console.log(`[autoImport] Extracting: ${brand} ${phone.name}...`);

      // Extract specs
      const { device } = await extractSpecs(`${brand} ${phone.name}`);

      // Compute score
      const score = computeScore(device.specs);

      // Save to Firestore
      await saveDeviceToFirestore(device, score);

      results.push({
        phone: phone.name,
        slug: slugify(`${device.brand} ${device.name}`),
        status: "saved",
        message: `Score: ${score.total.toFixed(1)}`,
        score: score.total,
      });

      console.log(`[autoImport] ✓ Saved: ${device.brand} ${device.name} (score: ${score.total.toFixed(1)})`);

      // Rate limit: 2 second delay between phones
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${phone.name}: ${msg.slice(0, 200)}`);
      results.push({
        phone: phone.name,
        slug: phoneSlug,
        status: "error",
        message: msg.slice(0, 200),
      });
      console.error(`[autoImport] ✗ Failed: ${phone.name} — ${msg}`);
    }
  }

  return {
    discovered: discovered.length,
    imported: results,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Save to Firestore
// ---------------------------------------------------------------------------

async function saveDeviceToFirestore(
  device: import("@/lib/ai/extractSpecs").AiExtractedDevice,
  score: { total: number; hardware: number; display: number; camera: number; battery: number; value: number },
): Promise<string> {
  const adminDb = getAdminFirestore();
  const slug = slugify(`${device.brand} ${device.name}`);

  const now = new Date();
  const deviceData = {
    slug,
    brand: device.brand,
    name: device.name,
    modelNumbers: device.modelNumbers ?? [],
    codename: device.codename ?? null,
    status: device.status ?? "available",
    announcedAt: device.announcedAt ?? null,
    releaseAt: device.releaseAt ?? null,
    specs: device.specs,
    variants: [],
    media: {
      heroImage: device.images?.heroImage ?? null,
      gallery: device.images?.gallery ?? [],
      renderImages: device.images?.renderImages ?? [],
    },
    sources: device.sources ?? [],
    score,
    pricing: device.pricing ?? { msrp: null, currentPrice: null, currency: "USD", region: null },
    software: device.software ?? { osUpdateYears: null, securityUpdateYears: null, aiPlatform: null },
    searchContent: buildSearchContent(device),
    bandGroups: extractBandGroups(device.specs),
    confidence: device.confidence ?? { overall: 0.5, verifiedFields: [], estimatedFields: [], unavailableFields: [] },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Check if slug already exists
  const existingDoc = await adminDb.collection("devices").doc(slug).get();
  if (existingDoc.exists) {
    // Update instead
    await adminDb.collection("devices").doc(slug).update(deviceData);
    return slug;
  }

  // Create new
  await adminDb.collection("devices").doc(slug).set(deviceData);
  return slug;
}

function buildSearchContent(device: import("@/lib/ai/extractSpecs").AiExtractedDevice): string {
  const parts: string[] = [
    device.brand,
    device.name,
    device.modelNumbers?.join(" ") ?? "",
    device.specs.platform?.chipset ?? "",
    device.specs.platform?.cpu ?? "",
    device.specs.platform?.gpu ?? "",
    device.specs.display?.type ?? "",
    `${device.specs.display?.sizeIn ?? ""}`,
    `${device.specs.battery?.capacityMah ?? ""}`,
    `${device.specs.cameras?.rear?.[0]?.megapixels ?? ""}`,
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function extractBandGroups(
  specs: import("@/lib/ai/extractSpecs").AiExtractedDevice["specs"],
): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  const bands = specs.connectivity?.bands ?? [];
  for (const band of bands) {
    if (band.startsWith("n")) {
      if (!groups["5G"]) groups["5G"] = [];
      groups["5G"].push(band);
    } else if (band.startsWith("B") || band.startsWith("b")) {
      if (!groups["4G"]) groups["4G"] = [];
      groups["4G"].push(band);
    } else {
      if (!groups["3G"]) groups["3G"] = [];
      groups["3G"].push(band);
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Quick Import — single phone
// ---------------------------------------------------------------------------

export async function quickImportPhone(
  query: string,
): Promise<{
  success: boolean;
  slug?: string;
  score?: number;
  message: string;
}> {
  await requireAdmin();

  try {
    const { device } = await extractSpecs(query);
    const score = computeScore(device.specs);
    await saveDeviceToFirestore(device, score);

    const slug = slugify(`${device.brand} ${device.name}`);
    return {
      success: true,
      slug,
      score: score.total,
      message: `Successfully imported ${device.brand} ${device.name} (Score: ${score.total.toFixed(1)})`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

"use server";

import { Timestamp } from "@/lib/firebase/firestore-rest";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  AiExtractedDeviceSchema,
  type AiExtractedDevice,
} from "@/lib/ai/extractSpecs";
import { requireAdmin, requireEditor } from "@/lib/server/adminAuth";
import { verifyAppCheckToken } from "@/lib/server/appCheck";
import { writeAuditLog } from "@/lib/server/auditLog";
import { AppError, ok, fail, type ActionResult } from "@/lib/server/errors";
import { brandColor } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import type { DeviceStatus, DeviceVariant, SourceRef } from "@/lib/firebase/types";

/**
 * Persist an admin-authored device (from the Studio editor) into `devices`
 * as a draft. Draft statuses ("rumored", "announced") stay invisible to the
 * public catalog because Firestore rules only allow reads of
 * available/upcoming/announced/discontinued documents.
 *
 * Publishing (transitioning to available/upcoming) requires the `admin`
 * role — editors may draft but not publish. Every mutation is audit-logged.
 */

const SaveDraftSchema = AiExtractedDeviceSchema.omit({
  confidence: true,
  sources: true,
});

const SourceInputSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  kind: z.string().default("retailer"),
});

export interface SaveDeviceResult {
  id: string;
  slug: string;
  published: boolean;
}

export async function saveDeviceDraft(input: {
  draft: z.infer<typeof SaveDraftSchema>;
  sources?: z.infer<typeof SourceInputSchema>[];
  publish: boolean;
  appCheckToken?: string;
}): Promise<ActionResult<SaveDeviceResult>> {
  try {
    const draft = SaveDraftSchema.parse(input.draft);
    const sources = (input.sources ?? []).map((s) => SourceInputSchema.parse(s));

    const ctx = input.publish
      ? await requireAdmin()
      : await requireEditor();

    const appCheck = await verifyAppCheckToken(input.appCheckToken);
    if (appCheck.enforced && !appCheck.verified) {
      throw new AppError("FORBIDDEN", "App Check verification failed. Refresh and retry.");
    }

    const now = Timestamp.now();
    const id = slugify(`${draft.brand} ${draft.name}`);
    if (!id) throw new AppError("VALIDATION", "Could not derive a slug from brand + name.");

    const db = getAdminFirestore();

    // Reject collisions with an existing device of the same slug.
    const existing = await db.collection("devices").doc(id).get();
    if (existing.exists) {
      throw new AppError(
        "CONFLICT",
        `A device with slug "${id}" already exists. Edit it instead of creating a duplicate.`,
      );
    }

    const status = draft.status as DeviceStatus;
    const dateToTs = (iso: string | null | undefined) =>
      iso ? Timestamp.fromDate(new Date(iso)) : null;

    const doc = {
      id,
      slug: id,
      brand: draft.brand,
      name: draft.name,
      modelNumbers: draft.modelNumbers,
      codename: draft.codename ?? null,
      status,
      announcedAt: dateToTs(draft.announcedAt),
      releaseAt: dateToTs(draft.releaseAt),
      brandColor: brandColor(draft.brand),
      specs: draft.specs,
      media: {
        heroImage: draft.images?.heroImage ?? null,
        gallery: draft.images?.gallery ?? [],
        renderImages: draft.images?.renderImages ?? [],
        modelUrl: null,
        cameraSamples: {},
      },
      content: buildSearchContent(draft),
      embedding: [],
      score: {
        total: 0,
        hardware: 0,
        display: 0,
        camera: 0,
        battery: 0,
        value: 0,
        sentiment: 0,
        updatedAt: now,
      },
      priceSummary: {
        currency: "USD",
        latest: 0,
        msrp: 0,
        min: 0,
        max: 0,
        average: 0,
        dropPercent: 0,
        trend: "stable",
        sources: [],
        updatedAt: now,
      },
      bandGroupIds: draft.specs.connectivity.bands,
      sources: sources.map<SourceRef>((s) => ({
        kind: s.kind,
        url: s.url,
        title: s.title,
        fetchedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    };

    const batch = db.batch();
    batch.set(db.collection("devices").doc(id), doc);

    // Regional variants → devices/{id}/variants/{variantId}
    const storageType = (draft.specs.memory.storageType ?? "UFS 4.0") as DeviceVariant["storageType"];
    const baseConnectivity: DeviceVariant["connectivity"] = {
      wifi: draft.specs.connectivity.wifi ?? "",
      bluetooth: draft.specs.connectivity.bluetooth ?? "",
      nfc: draft.specs.connectivity.nfc ?? false,
      usb: draft.specs.connectivity.usb ?? "",
      irBlaster: draft.specs.connectivity.irBlaster ?? false,
      gnss: draft.specs.connectivity.gnss,
      bands: draft.specs.connectivity.bands,
    };
    draft.variants.forEach((v, idx) => {
      const variantId = slugify(v.name) || `variant-${idx + 1}`;
      const variant: Omit<DeviceVariant, "id" | "deviceId"> = {
        region: v.region || "Global",
        name: v.name,
        chipset: v.chipset ?? doc.specs.platform.chipset ?? "",
        ramGb: v.ramGb ?? draft.specs.memory.ramOptions[0] ?? 0,
        storageGb: v.storageGb ?? draft.specs.memory.storageOptions[0] ?? 0,
        storageType,
        modem: v.modem ?? null,
        connectivity: baseConnectivity,
        price: { usd: 0, currency: "USD" },
      };
      batch.set(db.collection("devices").doc(id).collection("variants").doc(variantId), variant);
    });

    await batch.commit();

    await writeAuditLog({
      action: input.publish ? "device.publish" : "device.create",
      resourceType: "device",
      resourceId: id,
      severity: "info",
      actorUid: ctx.uid,
      actorEmail: ctx.email,
      note: `Created draft "${draft.brand} ${draft.name}" [${status}] with ${draft.variants.length} variant(s).`,
      after: {
        id,
        brand: draft.brand,
        name: draft.name,
        status,
        specs: draft.specs,
        variants: draft.variants,
        sources: sources.map((s) => s.url),
      },
    });

    return ok({ id, slug: id, published: input.publish });
  } catch (err) {
    return fail(err);
  }
}

/** Minimal searchable content so drafts are indexable once published. */
function buildSearchContent(d: z.infer<typeof SaveDraftSchema>): string {
  const s = d.specs;
  return [
    `${d.brand} ${d.name}`,
    ...d.modelNumbers.map((m) => `model ${m}`),
    `status ${d.status}`,
    s.display.type ? `${s.display.type} display` : "",
    s.display.sizeIn ? `${s.display.sizeIn} inch` : "",
    s.display.refreshRateHz ? `${s.display.refreshRateHz}Hz` : "",
    s.platform.chipset ?? "",
    s.platform.os ? `running ${s.platform.os}` : "",
    s.memory.ramOptions.length ? `${s.memory.ramOptions.join("/")}GB RAM` : "",
    s.memory.storageOptions.length
      ? `${s.memory.storageOptions.join("/")}GB storage`
      : "",
    s.cameras.rear[0]?.megapixels
      ? `${s.cameras.rear[0].megapixels}MP main camera`
      : "",
    s.battery.capacityMah ? `${s.battery.capacityMah}mAh` : "",
    s.connectivity.bands.length ? `bands ${s.connectivity.bands.join(", ")}` : "",
    s.extras.esim ? "eSIM" : "",
    s.extras.satelliteSos ? "satellite SOS" : "",
  ]
    .filter(Boolean)
    .join(". ")
    .toLowerCase();
}

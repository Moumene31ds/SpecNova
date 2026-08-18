"use server";

import { Timestamp } from "@/lib/firebase/firestore-rest";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  AiExtractedDeviceSchema,
  type AiExtractedDevice,
} from "@/lib/ai/extractSpecs";
import { requireAdmin } from "@/lib/server/adminAuth";
import { writeAuditLog } from "@/lib/server/auditLog";
import { AppError, ok, fail, type ActionResult } from "@/lib/server/errors";
import { brandColor } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import { computeScore } from "@/lib/score/compute-score";
import type { DeviceStatus, DeviceVariant, SourceRef } from "@/lib/firebase/types";

const UpdateDraftSchema = AiExtractedDeviceSchema.omit({
  confidence: true,
  sources: true,
});

const SourceInputSchema = z.object({
  title: z.string(),
  url: z.string().min(1).transform((val) => {
    if (!val.startsWith("http")) return `https://${val}`;
    return val;
  }),
  kind: z.string().default("retailer"),
});

export interface UpdateDeviceResult {
  id: string;
  slug: string;
}

export async function updateDevice(input: {
  slug: string;
  draft: z.infer<typeof UpdateDraftSchema>;
  sources?: z.infer<typeof SourceInputSchema>[];
  publish?: boolean;
  appCheckToken?: string;
}): Promise<ActionResult<UpdateDeviceResult>> {
  try {
    const draft = UpdateDraftSchema.parse(input.draft);
    const sources = (input.sources ?? []).map((s) => SourceInputSchema.parse(s));

    const ctx = input.publish
      ? await requireAdmin()
      : await requireAdmin();

    const now = Timestamp.now();
    const id = input.slug;
    if (!id) throw new AppError("VALIDATION", "Device slug is required.");

    const db = getAdminFirestore();

    const existing = await db.collection("devices").doc(id).get();
    if (!existing.exists) {
      throw new AppError("NOT_FOUND", `Device "${id}" not found.`);
    }

    const status = draft.status as DeviceStatus;
    const dateToTs = (iso: string | null | undefined) =>
      iso ? Timestamp.fromDate(new Date(iso)) : null;

    const doc = {
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
      },
      content: buildSearchContent(draft),
      score: (() => {
        const computed = computeScore(draft.specs);
        return { ...computed, updatedAt: now };
      })(),
      bandGroupIds: draft.specs.connectivity.bands,
      sources: sources.map<SourceRef>((s) => ({
        kind: s.kind,
        url: s.url,
        title: s.title,
        fetchedAt: now,
      })),
      updatedAt: now,
    };

    const batch = db.batch();
    batch.set(db.collection("devices").doc(id), doc, { merge: true });

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

    // Delete existing variants, then write new ones
    const existingVariants = await db.collection("devices").doc(id).collection("variants").get();
    for (const v of existingVariants.docs) {
      batch.delete(v.ref);
    }

    draft.variants.forEach((v, idx) => {
      const variantId = slugify(v.name || "") || `variant-${idx + 1}`;
      const variant: Omit<DeviceVariant, "id" | "deviceId"> = {
        region: v.region || "Global",
        name: v.name || `Variant ${idx + 1}`,
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
      action: "device.update",
      resourceType: "device",
      resourceId: id,
      severity: "info",
      actorUid: ctx.uid,
      actorEmail: ctx.email,
      note: `Updated device "${draft.brand} ${draft.name}" [${status}] with ${draft.variants.length} variant(s).`,
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

    return ok({ id, slug: id });
  } catch (err) {
    return fail(err);
  }
}

export async function deleteDevice(input: {
  slug: string;
}): Promise<ActionResult<void>> {
  try {
    const ctx = await requireAdmin();
    const db = getAdminFirestore();
    const id = input.slug;

    const existing = await db.collection("devices").doc(id).get();
    if (!existing.exists) {
      throw new AppError("NOT_FOUND", `Device "${id}" not found.`);
    }

    const batch = db.batch();

    // Delete variants
    const variants = await db.collection("devices").doc(id).collection("variants").get();
    for (const v of variants.docs) {
      batch.delete(v.ref);
    }

    // Delete the device
    batch.delete(db.collection("devices").doc(id));
    await batch.commit();

    await writeAuditLog({
      action: "device.delete",
      resourceType: "device",
      resourceId: id,
      severity: "warning",
      actorUid: ctx.uid,
      actorEmail: ctx.email,
      note: `Deleted device "${id}".`,
    });

    return ok(undefined as void);
  } catch (err) {
    return fail(err);
  }
}

function buildSearchContent(d: z.infer<typeof UpdateDraftSchema>): string {
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

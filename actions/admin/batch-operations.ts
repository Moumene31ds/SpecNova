"use server";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/server/adminAuth";
import { writeAuditLog } from "@/lib/server/auditLog";
import { AppError, ok, fail, type ActionResult } from "@/lib/server/errors";

/**
 * Batch delete multiple devices at once.
 * Deletes device docs + their variant subcollections.
 */
export async function batchDeleteDevices(input: {
  slugs: string[];
}): Promise<ActionResult<{ deleted: number }>> {
  try {
    const ctx = await requireAdmin();
    const db = getAdminFirestore();
    const { slugs } = input;

    if (!slugs.length) {
      throw new AppError("VALIDATION", "No devices selected.");
    }

    if (slugs.length > 50) {
      throw new AppError("VALIDATION", "Cannot delete more than 50 devices at once.");
    }

    let deletedCount = 0;

    // Process in batches of 10 (Firestore batch limit)
    for (let i = 0; i < slugs.length; i += 10) {
      const batchSlugs = slugs.slice(i, i + 10);
      const batch = db.batch();

      for (const slug of batchSlugs) {
        const docRef = db.collection("devices").doc(slug);
        const existing = await docRef.get();
        if (!existing.exists) continue;

        // Delete variants subcollection
        const variants = await docRef.collection("variants").get();
        for (const v of variants.docs) {
          batch.delete(v.ref);
        }

        // Delete the device
        batch.delete(docRef);
        deletedCount++;
      }

      await batch.commit();
    }

    await writeAuditLog({
      action: "device.batch_delete",
      resourceType: "device",
      resourceId: slugs.join(","),
      severity: "warning",
      actorUid: ctx.uid,
      actorEmail: ctx.email,
      note: `Batch deleted ${deletedCount} device(s).`,
    });

    return ok({ deleted: deletedCount });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Batch update device status.
 */
export async function batchUpdateStatus(input: {
  slugs: string[];
  status: string;
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const ctx = await requireAdmin();
    const db = getAdminFirestore();
    const { slugs, status } = input;

    if (!slugs.length) {
      throw new AppError("VALIDATION", "No devices selected.");
    }

    if (!["rumored", "announced", "upcoming", "available", "discontinued"].includes(status)) {
      throw new AppError("VALIDATION", "Invalid status.");
    }

    let updatedCount = 0;

    for (let i = 0; i < slugs.length; i += 10) {
      const batchSlugs = slugs.slice(i, i + 10);
      const batch = db.batch();

      for (const slug of batchSlugs) {
        const docRef = db.collection("devices").doc(slug);
        const existing = await docRef.get();
        if (!existing.exists) continue;

        batch.update(docRef, { status, updatedAt: new Date() });
        updatedCount++;
      }

      await batch.commit();
    }

    await writeAuditLog({
      action: "device.batch_status",
      resourceType: "device",
      resourceId: slugs.join(","),
      severity: "info",
      actorUid: ctx.uid,
      actorEmail: ctx.email,
      note: `Batch updated ${updatedCount} device(s) to status "${status}".`,
    });

    return ok({ updated: updatedCount });
  } catch (err) {
    return fail(err);
  }
}

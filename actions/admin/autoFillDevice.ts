"use server";

import { extractSpecs, AI_EXTRACTION_MODEL } from "@/lib/ai/extractSpecs";
import { requireEditor } from "@/lib/server/adminAuth";
import { verifyAppCheckToken } from "@/lib/server/appCheck";
import { writeAuditLog } from "@/lib/server/auditLog";
import { AppError, ok, fail, type ActionResult } from "@/lib/server/errors";
import { rateLimit } from "@/lib/server/rateLimit";
import type { AiExtractedDevice } from "@/lib/ai/extractSpecs";

/**
 * AI Magic Auto-Fill — server action.
 *
 * Takes a natural-language device query, runs the Gemini spec-extraction
 * pipeline, and returns a fully-typed draft device plus the raw model JSON
 * (for the side-by-side diff view) and field-level confidence metadata.
 *
 * Guarded by: editor RBAC, per-user rate limiting, optional App Check.
 */

export interface AutoFillResult {
  device: AiExtractedDevice;
  /** Raw model JSON for the "AI data vs raw source" comparison panel. */
  raw: string;
  model: string;
}

export async function autoFillDevice(input: {
  query: string;
  appCheckToken?: string;
}): Promise<ActionResult<AutoFillResult>> {
  try {
    const query = input.query?.trim().slice(0, 200) ?? "";
    if (query.length < 3) {
      throw new AppError("VALIDATION", "Enter at least 3 characters describing the device.");
    }

    const ctx = await requireEditor();

    const limit = await rateLimit({
      key: `autofill:${ctx.uid}`,
      limit: 30,
      windowSec: 60 * 60,
    });
    if (!limit.ok) {
      throw new AppError("RATE_LIMITED", "Auto-fill quota reached. Try again later.", {
        retryAfterSec: limit.retryAfterSec,
      });
    }

    const appCheck = await verifyAppCheckToken(input.appCheckToken);
    if (appCheck.enforced && !appCheck.verified) {
      await writeAuditLog({
        action: "device.autofill.blocked",
        resourceType: "device",
        severity: "warning",
        actorUid: ctx.uid,
        actorEmail: ctx.email,
        note: `App Check rejected autofill request: ${appCheck.error ?? "invalid token"}`,
      });
      throw new AppError("FORBIDDEN", "App Check verification failed. Refresh and retry.");
    }

    const { device, raw } = await extractSpecs(query);

    await writeAuditLog({
      action: "device.autofill",
      resourceType: "device",
      resourceId: null,
      severity: "info",
      actorUid: ctx.uid,
      actorEmail: ctx.email,
      note: `Auto-filled "${device.brand} ${device.name}" (confidence ${Math.round(
        device.confidence.overall * 100,
      )}%) from ${device.sources.length} source(s).`,
      after: { query, brand: device.brand, name: device.name },
    });

    return ok({ device, raw, model: AI_EXTRACTION_MODEL });
  } catch (err) {
    return fail(err);
  }
}

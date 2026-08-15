"use server";

import { extractSpecs, AI_EXTRACTION_MODEL } from "@/lib/ai/extractSpecs";
import { requireEditor } from "@/lib/server/adminAuth";
import { verifyAppCheckToken } from "@/lib/server/appCheck";
import { writeAuditLog } from "@/lib/server/auditLog";
import { AppError, ok, fail, type ActionResult } from "@/lib/server/errors";
import { rateLimit } from "@/lib/server/rateLimit";
import type { AiExtractedDevice } from "@/lib/ai/extractSpecs";
import type { BrandCatalogModel } from "@/lib/ai/discoverBrand";

/**
 * Brand Importer — stage 2: per-model full spec extraction.
 *
 * Runs one model through the exact same high-accuracy engine as
 * `autoFillDevice` (full typed spec sheet + per-field confidence + sources),
 * disambiguated by model numbers/codename so regional SKUs extract cleanly.
 *
 * The admin UI drives this sequentially over the discovered catalog so a
 * brand of any size imports without hitting one giant, time-out-prone request.
 */

export interface ExtractBrandDeviceResult {
  device: AiExtractedDevice;
  raw: string;
  model: string;
}

export async function extractBrandDevice(input: {
  brand: string;
  model: BrandCatalogModel;
  appCheckToken?: string;
}): Promise<ActionResult<ExtractBrandDeviceResult>> {
  try {
    const brand = input.brand?.trim().slice(0, 40) ?? "";
    const name = input.model.name?.trim().slice(0, 80) ?? "";
    if (!brand || !name) {
      throw new AppError("VALIDATION", "Brand and model name are required.");
    }

    const ctx = await requireEditor();

    const limit = await rateLimit({
      key: `brand-extract:${ctx.uid}`,
      limit: 150,
      windowSec: 60 * 60,
    });
    if (!limit.ok) {
      throw new AppError(
        "RATE_LIMITED",
        "Per-hour extraction quota reached. Continue tomorrow or clear UPSTASH / wait for the window.",
        { retryAfterSec: limit.retryAfterSec },
      );
    }

    const appCheck = await verifyAppCheckToken(input.appCheckToken);
    if (appCheck.enforced && !appCheck.verified) {
      throw new AppError("FORBIDDEN", "App Check verification failed. Refresh and retry.");
    }

    const disambiguation = [
      ...input.model.modelNumbers,
      input.model.codename ? `codename ${input.model.codename}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const query = disambiguation
      ? `${brand} ${name} (${disambiguation})`
      : `${brand} ${name}`;

    const { device, raw } = await extractSpecs(query);

    await writeAuditLog({
      action: "brand.extract",
      resourceType: "device",
      resourceId: null,
      severity: "info",
      actorUid: ctx.uid,
      actorEmail: ctx.email,
      note: `Extracted "${device.brand} ${device.name}" (confidence ${Math.round(
        device.confidence.overall * 100,
      )}%) from ${device.sources.length} source(s).`,
      after: { brand, model: name },
    });

    return ok({ device, raw, model: AI_EXTRACTION_MODEL });
  } catch (err) {
    return fail(err);
  }
}

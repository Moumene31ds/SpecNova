"use server";

import { discoverBrand, AI_DISCOVERY_MODEL } from "@/lib/ai/discoverBrand";
import { requireEditor } from "@/lib/server/adminAuth";
import { verifyAppCheckToken } from "@/lib/server/appCheck";
import { writeAuditLog } from "@/lib/server/auditLog";
import { AppError, ok, fail, type ActionResult } from "@/lib/server/errors";
import { rateLimit } from "@/lib/server/rateLimit";
import type { BrandCatalog } from "@/lib/ai/discoverBrand";

/**
 * Brand Importer — stage 1: catalog discovery.
 *
 * Returns the full, non-invented model list for a phone maker. Each model is
 * then extracted in stage 2 (`extractBrandDevice`) with the full spec engine.
 */

export interface DiscoverBrandResult {
  catalog: BrandCatalog;
  /** Raw model JSON for review. */
  raw: string;
  model: string;
}

export async function discoverBrandCatalog(input: {
  brand: string;
  appCheckToken?: string;
}): Promise<ActionResult<DiscoverBrandResult>> {
  try {
    const brand = input.brand?.trim().slice(0, 40) ?? "";
    if (brand.length < 2) {
      throw new AppError("VALIDATION", "Enter a brand name (e.g. OnePlus, Xiaomi).");
    }

    const ctx = await requireEditor();

    const limit = await rateLimit({
      key: `brand-discover:${ctx.uid}`,
      limit: 10,
      windowSec: 60 * 60,
    });
    if (!limit.ok) {
      throw new AppError("RATE_LIMITED", "Catalog discovery quota reached. Try again later.", {
        retryAfterSec: limit.retryAfterSec,
      });
    }

    const appCheck = await verifyAppCheckToken(input.appCheckToken);
    if (appCheck.enforced && !appCheck.verified) {
      throw new AppError("FORBIDDEN", "App Check verification failed. Refresh and retry.");
    }

    const { catalog, raw } = await discoverBrand(brand);

    await writeAuditLog({
      action: "brand.discover",
      resourceType: "brand",
      resourceId: catalog.brand.toLowerCase(),
      severity: "info",
      actorUid: ctx.uid,
      actorEmail: ctx.email,
      note: `Discovered ${catalog.models.length} model(s) for "${catalog.brand}".`,
      after: { brand: catalog.brand, count: catalog.models.length },
    });

    return ok({ catalog, raw, model: AI_DISCOVERY_MODEL });
  } catch (err) {
    return fail(err);
  }
}

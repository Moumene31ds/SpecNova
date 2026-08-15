import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Vercel Cron webhook. Each cron route mirrors a Cloud Function:
 *
 *   /api/cron/scrape     -> onScrapeJobCreated / scheduledCatalogSweep
 *   /api/cron/prices     -> scheduledPriceSweep
 *   /api/cron/embeddings -> scheduledEmbeddingBackfill
 *
 * In production this proxies to the deployed Cloud Function HTTPS endpoint
 * (`FUNCTIONS_BASE_URL`) with the shared webhook secret. For standalone
 * deployments it falls back to a no-op health ping so cron never 500s.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ task: string }> },
) {
  const { task } = await params;
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;

  if (!expected.endsWith("=") || auth !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const baseUrl = process.env.FUNCTIONS_BASE_URL;
  if (!baseUrl) {
    console.warn(`[cron/${task}] FUNCTIONS_BASE_URL unset — no-op.`);
    return NextResponse.json({ ok: true, task, delegated: false });
  }

  const res = await fetch(`${baseUrl}/${task}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.FUNCTIONS_WEBHOOK_SECRET ?? ""}`,
    },
    signal: AbortSignal.timeout(240_000),
  });

  if (!res.ok) {
    console.error(`[cron/${task}] upstream ${res.status}`);
    return NextResponse.json({ ok: false, task }, { status: res.status });
  }

  return NextResponse.json({ ok: true, task, delegated: true });
}

export const GET = POST;

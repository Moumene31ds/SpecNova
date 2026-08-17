"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronRight,
  CloudDownload,
  CloudUpload,
  Loader2,
  PackageSearch,
  Pause,
  Play,
} from "lucide-react";

import { discoverBrandCatalog } from "@/actions/admin/discoverBrand";
import { extractBrandDevice } from "@/actions/admin/extractBrandDevice";
import { saveDeviceDraft } from "@/actions/admin/saveDevice";
import { getClientAppCheckToken } from "@/lib/ai/client-app-check";
import type { BrandCatalog, BrandCatalogModel } from "@/lib/ai/discoverBrand";
import type { AiExtractedDevice } from "@/lib/ai/extractSpecs";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";

type ExtractState = "pending" | "extracting" | "ok" | "error";
type SaveState = "saved" | "conflict" | "error";

interface ResultRow {
  model: BrandCatalogModel;
  state: ExtractState;
  device?: AiExtractedDevice;
  error?: string;
  save?: SaveState;
}

function specSummary(d: AiExtractedDevice): { label: string; value: string }[] {
  const s = d.specs;
  const rows: Array<[string, string | null | undefined]> = [
    ["Chipset", s.platform.chipset],
    ["GPU", s.platform.gpu],
    ["RAM", s.memory.ramOptions.length ? `${s.memory.ramOptions.join(" / ")} GB` : null],
    ["Storage", s.memory.storageOptions.length ? `${s.memory.storageOptions.join(" / ")} GB` : null],
    [
      "Display",
      s.display.sizeIn
        ? `${s.display.sizeIn}" ${s.display.type ?? ""}`.trim()
        : s.display.type,
    ],
    ["Refresh", s.display.refreshRateHz ? `${s.display.refreshRateHz} Hz` : null],
    ["Resolution", s.display.resolution ?? null],
    ["Main camera", s.cameras.rear[0]?.megapixels ? `${s.cameras.rear[0]?.megapixels} MP` : null],
    ["Battery", s.battery.capacityMah ? `${s.battery.capacityMah} mAh` : null],
    ["Charging", s.battery.chargingWatts ? `${s.battery.chargingWatts} W` : null],
    ["Weight", s.body.weightG ? `${s.body.weightG} g` : null],
    ["Bands", s.connectivity.bands.length ? s.connectivity.bands.join(", ") : null],
  ];
  return rows
    .filter((r): r is [string, string] => typeof r[1] === "string")
    .map(([label, value]) => ({ label, value }));
}

const STATUS_BADGE: Record<ExtractState, { label: string; cls: string }> = {
  pending: { label: "Queued", cls: "bg-muted text-muted-foreground" },
  extracting: { label: "Extracting…", cls: "bg-amber-500/15 text-amber-600" },
  ok: { label: "Extracted", cls: "bg-emerald-500/15 text-emerald-600" },
  error: { label: "Failed", cls: "bg-destructive/10 text-destructive" },
};

export default function BrandImporterPage() {
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";
  const [brand, setBrand] = useState("");
  const [phase, setPhase] = useState<"idle" | "discovering" | "error">("idle");
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<BrandCatalog | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [publish, setPublish] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const cancelRef = useRef(false);

  const doneCount = useMemo(() => rows.filter((r) => r.state === "ok").length, [rows]);
  const failedCount = useMemo(() => rows.filter((r) => r.state === "error").length, [rows]);
  const savedCount = useMemo(
    () => rows.filter((r) => r.save === "saved").length,
    [rows],
  );
  const duplicateCount = useMemo(
    () => rows.filter((r) => r.save === "conflict").length,
    [rows],
  );
  const avgConfidence = useMemo(() => {
    const ok = rows.filter((r): r is ResultRow & { device: AiExtractedDevice } => !!r.device);
    if (ok.length === 0) return 0;
    return (
      ok.reduce((sum, r) => sum + r.device.confidence.overall, 0) / ok.length
    );
  }, [rows]);
  const progressPct =
    rows.length > 0
      ? Math.round(((doneCount + failedCount) / rows.length) * 100)
      : 0;

  async function onDiscover() {
    setDiscoverError(null);
    setPhase("discovering");
    const token = await getClientAppCheckToken();
    const res = await discoverBrandCatalog({ brand, appCheckToken: token });
    if (!res.ok) {
      setPhase("error");
      setDiscoverError(res.error.message);
      return;
    }
    setCatalog(res.data.catalog);
    setRows(
      res.data.catalog.models.map((m) => ({ model: m, state: "pending" as ExtractState })),
    );
    setPhase("idle");
  }

  async function onRunAll() {
    cancelRef.current = false;
    setRunning(true);
    const token = await getClientAppCheckToken();

    for (let i = 0; i < rows.length; i++) {
      if (cancelRef.current) break;
      const row = rows[i];
      if (!row || row.state === "ok" || row.state === "error") continue;

      setCurrentIndex(i);
      setRows((prev) => prev.map((r, j) => (j === i ? { ...r, state: "extracting" } : r)));

      const res = await extractBrandDevice({
        brand: catalog?.brand ?? brand,
        model: row.model,
        appCheckToken: token,
      });

      if (cancelRef.current) break;

      setRows((prev) =>
        prev.map((r, j) =>
          j === i
            ? res.ok
              ? { ...r, state: "ok", device: res.data.device, error: undefined }
              : { ...r, state: "error", error: res.error.message }
            : r,
        ),
      );

      if (!res.ok && res.error.code === "RATE_LIMITED") break;
    }

    setCurrentIndex(null);
    setRunning(false);
  }

  function onStop() {
    cancelRef.current = true;
  }

  async function onSaveAll() {
    if (saving) return;
    setSaving(publish ? "publish" : "draft");
    const token = await getClientAppCheckToken();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.state !== "ok" || !row.device || row.save) continue;

      const res = await saveDeviceDraft({
        draft: row.device,
        sources: row.device.sources,
        publish,
        appCheckToken: token,
      });

      setRows((prev) =>
        prev.map((r, j) =>
          j === i
            ? {
                ...r,
                save: res.ok
                  ? "saved"
                  : res.error.code === "CONFLICT"
                    ? "conflict"
                    : "error",
                error: res.ok ? r.error : res.error.message,
              }
            : r,
        ),
      );
    }

    setSaving(null);
  }

  const pendingExtract = rows.filter((r) => r.state === "pending" || r.state === "error");

  return (
    <div className="space-y-8">
      <section className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Brand Importer
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Enter a manufacturer and AI imports its <em>entire</em> phone catalog — every
          model extracted one-by-one with the same very-high-accuracy full-spec engine as
          Magic Auto-Fill. Discover the lineup, review confidence, save as drafts, and
          publish.
        </p>
      </section>

      {/* Discover */}
      {!catalog ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageSearch className="size-5 text-primary" />
              Step 1 · Discover the catalog
            </CardTitle>
            <CardDescription>
              Gemini lists the brand&apos;s phones (no invented models). Each one is then
              extracted individually in Step 2.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onDiscover()}
                placeholder="e.g. OnePlus, Xiaomi, Samsung, Nothing"
                className="h-11"
                disabled={phase === "discovering"}
              />
              <Button
                size="lg"
                onClick={onDiscover}
                disabled={phase === "discovering" || brand.trim().length < 2}
              >
                {phase === "discovering" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CloudDownload className="size-4" />
                )}
                {phase === "discovering" ? "Discovering…" : "Discover"}
              </Button>
            </div>
            {discoverError ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{discoverError}</span>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Up to 120 models per brand, most recent first. You&apos;ll review the list
              before extraction starts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Progress summary */}
          <Card>
            <CardContent className="grid gap-4 py-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Catalog</p>
                <p className="text-sm font-semibold">
                  {catalog.brand}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {rows.length} models
                  </span>
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Extracted</p>
                <p className="text-sm font-semibold">
                  {doneCount}{" "}
                  <span className="font-normal text-muted-foreground">
                    / {rows.length} · {progressPct}%
                  </span>
                </p>
                <Progress value={progressPct} className="h-1.5" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Avg confidence
                </p>
                <p className="text-sm font-semibold">
                  {doneCount > 0 ? `${Math.round(avgConfidence * 100)}%` : "—"}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Saved</p>
                <p className="text-sm font-semibold">
                  {savedCount}{" "}
                  <span className="font-normal text-muted-foreground">
                    {duplicateCount > 0 ? `· ${duplicateCount} duplicates` : ""}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={onRunAll}
              disabled={running || pendingExtract.length === 0}
            >
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {running
                ? `Extracting ${rows[currentIndex ?? 0]?.model.name ?? "…"}…`
                : `Extract remaining (${pendingExtract.length})`}
            </Button>
            {running ? (
              <Button variant="destructive" onClick={onStop}>
                <Pause className="size-4" />
                Stop
              </Button>
            ) : null}
            <div className="mx-2 h-6 w-px bg-border" />
            <Button
              variant="outline"
              onClick={onSaveAll}
              disabled={saving !== null || doneCount === 0}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : publish ? (
                <CloudUpload className="size-4" />
              ) : (
                <CloudDownload className="size-4" />
              )}
              {saving
                ? "Saving…"
                : `Save ${doneCount} as ${publish ? "published" : "drafts"}`}
            </Button>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={publish} onCheckedChange={setPublish} disabled={!!saving} />
              Publish (admin only)
            </label>
          </div>

          {publish && (
            <p className="text-xs text-muted-foreground">
              Publishing skips devices that already exist (duplicates) and requires the
              admin role — editors&apos; publish requests are rejected.
            </p>
          )}

          {/* Model list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Extraction queue</CardTitle>
              <CardDescription>
                Tap a row to inspect its extracted specs and sources. Failed rows can be
                re-run with <span className="font-medium">Extract remaining</span>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {rows.map((row, i) => {
                  const badge = STATUS_BADGE[row.state];
                  const open = openIndex === i;
                  const summary = row.device ? specSummary(row.device) : [];
                  return (
                    <li key={`${row.model.name}-${i}`}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 py-3 text-left"
                        onClick={() =>
                          row.device ? setOpenIndex(open ? null : i) : undefined
                        }
                        disabled={!row.device}
                      >
                        {row.device ? (
                          open ? (
                            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                          )
                        ) : (
                          <span className="w-4" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{row.model.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.model.modelNumbers.length > 0
                              ? row.model.modelNumbers.join(", ")
                              : row.model.status}
                            {row.model.codename ? ` · ${row.model.codename}` : ""}
                          </p>
                        </div>
                        {row.state === "extracting" ? (
                          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                        ) : null}
                        {row.device ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {Math.round(row.device.confidence.overall * 100)}%
                          </span>
                        ) : null}
                        <Badge className={badge.cls}>{badge.label}</Badge>
                        {row.save ? (
                          <Badge
                            variant="secondary"
                            className={cn(
                              row.save === "conflict" && "bg-amber-500/15 text-amber-600",
                              row.save === "error" && "bg-destructive/10 text-destructive",
                            )}
                          >
                            {row.save === "saved"
                              ? publish
                                ? "Published"
                                : "Draft saved"
                              : row.save === "conflict"
                                ? "Duplicate"
                                : "Save failed"}
                          </Badge>
                        ) : null}
                      </button>

                      {row.error ? (
                        <p className="pb-2 pl-7 text-xs text-destructive">{row.error}</p>
                      ) : null}

                      {open && row.device ? (
                        <div className="mb-3 ml-7 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                            {summary.map(({ label, value }) => (
                              <div
                                key={label}
                                className="flex items-baseline justify-between gap-4 text-sm"
                              >
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {label}
                                </span>
                                <span className="truncate text-right text-xs font-medium">
                                  {value}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {row.device.sources.map((s) => (
                              <a
                                key={s.url}
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                              >
                                {s.title}
                              </a>
                            ))}
                          </div>
                          <details className="group">
                            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                              Raw extraction JSON
                            </summary>
                            <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed">
                              {JSON.stringify(row.device, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {failedCount > 0 ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="size-4 text-amber-600" />
              {failedCount} model(s) failed to extract — most likely a temporary upstream
              error or rate limit. Re-run to retry.
            </p>
          ) : null}
        </>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bot className="size-4" />
        Powered by Gemini — same engine and confidence model as{" "}
        <Link href={`/${locale}/admin/devices/new`} className="underline hover:text-foreground">
          Magic Auto-Fill
        </Link>
        . Every extraction is audited.
      </div>
    </div>
  );
}

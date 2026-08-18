"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Battery, Camera, Calendar, Cpu, DollarSign, RotateCcw, SlidersHorizontal, GitCompareArrows, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { localSearch } from "@/lib/search/local-search";
import { getDevCatalog } from "@/lib/dev-data";
import type { Device } from "@/lib/firebase/types";
import { DeviceCard } from "@/components/device/device-card";
import { cn } from "@/lib/utils";

interface Filters {
  maxPrice: number | null;
  minBattery: number | null;
  minCamera: number | null;
  chipset: string;
  minYear: number | null;
}

const DEFAULT_FILTERS: Filters = {
  maxPrice: null,
  minBattery: null,
  minCamera: null,
  chipset: "",
  minYear: null,
};

const PAGE_SIZE = 24;

function tsYear(ts: { seconds: number } | null): number | null {
  return ts && ts.seconds ? new Date(ts.seconds * 1000).getFullYear() : null;
}

function applyFilters(catalog: Device[], query: string, f: Filters): Device[] {
  let list = catalog;
  if (f.maxPrice !== null || f.minBattery !== null || f.minCamera !== null || f.chipset.trim() || f.minYear !== null) {
    list = catalog.filter((d) => {
      if (f.maxPrice !== null) {
        const price = d.priceSummary?.latest;
        if (price === undefined || price > f.maxPrice) return false;
      }
      if (f.minBattery !== null && d.specs.battery.capacityMah < f.minBattery) return false;
      if (f.minCamera !== null && (d.specs.cameras.rear[0]?.megapixels ?? 0) < f.minCamera) return false;
      if (f.chipset.trim()) {
        const chipset = `${d.specs.platform.chipset} ${d.specs.platform.os}`.toLowerCase();
        if (!chipset.includes(f.chipset.trim().toLowerCase())) return false;
      }
      if (f.minYear !== null) {
        const year = tsYear(d.releaseAt) ?? tsYear(d.announcedAt);
        if (year === null || year < f.minYear) return false;
      }
      return true;
    });
  }

  const q = query.trim();
  if (q) {
    list = localSearch(q, list, 50).map((h) => h.device as Device);
  }
  return list;
}

const isActive = (f: Filters) =>
  f.maxPrice !== null || f.minBattery !== null || f.minCamera !== null || f.chipset.trim() !== "" || f.minYear !== null;

export function DeviceExplorer({ defaultQuery = "" }: { defaultQuery?: string }) {
  const t = useTranslations("search");
  const router = useRouter();
  const catalogRef = React.useRef<Device[]>(getDevCatalog(200));

  const [query, setQuery] = React.useState(defaultQuery);
  const [inputValue, setInputValue] = React.useState(defaultQuery);
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [openFilters, setOpenFilters] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [compareMode, setCompareMode] = React.useState(false);
  const [selectedForCompare, setSelectedForCompare] = React.useState<string[]>([]);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(null);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(inputValue);
      setPage(0);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputValue]);

  const results = React.useMemo(
    () => applyFilters(catalogRef.current, query, filters),
    [query, filters],
  );

  const visibleResults = React.useMemo(
    () => results.slice(0, (page + 1) * PAGE_SIZE),
    [results, page],
  );

  const hasMore = visibleResults.length < results.length;

  const set = React.useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value })), []);

  const reset = React.useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setInputValue("");
    setQuery("");
    setPage(0);
    setCompareMode(false);
    setSelectedForCompare([]);
  }, []);

  const toggleCompare = React.useCallback((slug: string) => {
    setSelectedForCompare((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : prev.length < 4 ? [...prev, slug] : prev
    );
  }, []);

  const launchCompare = React.useCallback(() => {
    if (selectedForCompare.length >= 2) {
      router.push(`/compare/${selectedForCompare.join("/")}`);
    }
  }, [selectedForCompare, router]);

  const activeCount = React.useMemo(() =>
    isActive(filters)
      ? (["maxPrice", "minBattery", "minCamera", "minYear"] as const).filter((k) => filters[k] !== null).length +
        (filters.chipset.trim() ? 1 : 0)
      : 0,
    [filters],
  );

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-border bg-card/40 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <DollarSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t("aiSearchPlaceholder")}
              className="h-11 w-full rounded-xl border border-border bg-background/60 pl-10 pr-3 text-sm outline-none transition-colors focus:border-ring"
            />
          </div>
          <button
            onClick={() => setOpenFilters((v) => !v)}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-medium transition-colors",
              openFilters || activeCount > 0
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground",
            )}
            aria-expanded={openFilters}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">{t("filters")}</span>
            {activeCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {openFilters && (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" /> {t("maxPrice")}
                </span>
                <input
                  type="number"
                  min={0}
                  value={filters.maxPrice ?? ""}
                  onChange={(e) => set("maxPrice", e.target.value ? Number(e.target.value) : null)}
                  placeholder="$"
                  className="h-10 rounded-lg border border-border bg-background/60 px-3 font-mono text-sm outline-none focus:border-ring"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Battery className="h-3.5 w-3.5" /> {t("minBattery")}
                </span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={filters.minBattery ?? ""}
                  onChange={(e) => set("minBattery", e.target.value ? Number(e.target.value) : null)}
                  placeholder="mAh"
                  className="h-10 rounded-lg border border-border bg-background/60 px-3 font-mono text-sm outline-none focus:border-ring"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Camera className="h-3.5 w-3.5" /> {t("minCamera")}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={filters.minCamera ?? ""}
                  onChange={(e) => set("minCamera", e.target.value ? Number(e.target.value) : null)}
                  placeholder="MP"
                  className="h-10 rounded-lg border border-border bg-background/60 px-3 font-mono text-sm outline-none focus:border-ring"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Cpu className="h-3.5 w-3.5" /> {t("chipset")}
                </span>
                <input
                  value={filters.chipset}
                  onChange={(e) => set("chipset", e.target.value)}
                  placeholder="Snapdragon 8 Elite…"
                  className="h-10 rounded-lg border border-border bg-background/60 px-3 text-sm outline-none focus:border-ring"
                />
              </label>

              <label className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> {t("minYear")}
                </span>
                <select
                  value={filters.minYear ?? ""}
                  onChange={(e) => set("minYear", e.target.value ? Number(e.target.value) : null)}
                  className="h-10 rounded-lg border border-border bg-background/60 px-3 text-sm outline-none focus:border-ring"
                >
                  <option value="">Any</option>
                  {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                    <option key={y} value={y}>{y}+</option>
                  ))}
                </select>
              </label>

              <button
                onClick={reset}
                className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-secondary/40 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:col-span-1"
              >
                <RotateCcw className="h-3.5 w-3.5" /> {t("resetFilters")}
              </button>
            </div>
          )}
        </AnimatePresence>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{results.length}</span>{" "}
            {t("resultsFound")}
          </p>
          <button
            onClick={() => { setCompareMode(!compareMode); setSelectedForCompare([]); }}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
              compareMode
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            {compareMode ? "Cancel Compare" : "Compare"}
          </button>
        </div>
      </div>

      {visibleResults.length > 0 ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleResults.map((device) => (
              <div key={device.id} className="relative">
                {compareMode && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCompare(device.slug); }}
                    className={cn(
                      "absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                      selectedForCompare.includes(device.slug)
                        ? "border-primary bg-primary text-primary-foreground scale-110"
                        : "border-white/30 bg-black/40 text-white/70 hover:border-white/60"
                    )}
                  >
                    {selectedForCompare.includes(device.slug) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-bold">{selectedForCompare.indexOf(device.slug) + 1 || "+"}</span>
                    )}
                  </button>
                )}
                <DeviceCard device={device} />
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-card/50 px-6 text-sm font-medium transition-colors hover:border-ring/40 hover:bg-card/80"
              >
                Load more ({results.length - visibleResults.length} remaining)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
            <SlidersHorizontal className="h-6 w-6 text-neon-cyan" />
          </div>
          <p className="font-medium">{t("noMatches")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("clearQuery")}</p>
          <button
            onClick={reset}
            className="mt-1 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RotateCcw className="h-4 w-4" /> {t("resetFilters")}
          </button>
        </div>
      )}

      {/* Floating compare bar */}
      <AnimatePresence>
        {compareMode && selectedForCompare.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-border bg-card/95 px-6 py-3 shadow-2xl backdrop-blur-xl md:bottom-8"
          >
            <div className="flex items-center gap-2">
              {selectedForCompare.map((slug) => {
                const device = catalogRef.current.find((d) => d.slug === slug);
                return (
                  <div
                    key={slug}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/50 text-xs font-bold"
                    style={{ color: device?.brandColor }}
                  >
                    {device?.brand?.split(" ")[0] || "?"}
                  </div>
                );
              })}
            </div>
            <span className="text-sm text-muted-foreground">
              {selectedForCompare.length}/4 selected
            </span>
            <button
              onClick={launchCompare}
              disabled={selectedForCompare.length < 2}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-all",
                selectedForCompare.length >= 2
                  ? "hover:shadow-[0_0_36px_hsl(var(--glow-primary)/0.4)]"
                  : "cursor-not-allowed opacity-40"
              )}
            >
              <GitCompareArrows className="h-4 w-4" />
              Compare {selectedForCompare.length}
            </button>
            <button
              onClick={() => { setCompareMode(false); setSelectedForCompare([]); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

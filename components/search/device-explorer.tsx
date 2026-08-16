"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Battery, Camera, Calendar, Cpu, DollarSign, RotateCcw, SlidersHorizontal } from "lucide-react";
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

function tsYear(ts: { seconds: number } | null): number | null {
  return ts && ts.seconds ? new Date(ts.seconds * 1000).getFullYear() : null;
}

function applyFilters(catalog: Device[], query: string, f: Filters): Device[] {
  let list = catalog.filter((d) => {
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

  const q = query.trim();
  if (q) {
    list = localSearch(q, list, 50).map((h) => h.device as Device);
  }
  return list;
}

function isActive(f: Filters): boolean {
  return (
    f.maxPrice !== null ||
    f.minBattery !== null ||
    f.minCamera !== null ||
    f.chipset.trim() !== "" ||
    f.minYear !== null
  );
}

export function DeviceExplorer({ defaultQuery = "" }: { defaultQuery?: string }) {
  const t = useTranslations("search");

  const [query, setQuery] = React.useState(defaultQuery);
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [openFilters, setOpenFilters] = React.useState(false);

  const results = React.useMemo(
    () => applyFilters(getDevCatalog(200), query, filters),
    [query, filters],
  );

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    setQuery("");
  };

  const activeCount = isActive(filters)
    ? (["maxPrice", "minBattery", "minCamera", "minYear"] as const).filter((k) => filters[k] !== null).length +
      (filters.chipset.trim() ? 1 : 0)
    : 0;

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-border bg-card/40 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <DollarSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <label className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" /> {t("maxPrice")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={filters.maxPrice ?? ""}
                    onChange={(e) =>
                      set("maxPrice", e.target.value ? Number(e.target.value) : null)
                    }
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
                    onChange={(e) =>
                      set("minBattery", e.target.value ? Number(e.target.value) : null)
                    }
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
                    onChange={(e) =>
                      set("minCamera", e.target.value ? Number(e.target.value) : null)
                    }
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
                    onChange={(e) =>
                      set("minYear", e.target.value ? Number(e.target.value) : null)
                    }
                    className="h-10 rounded-lg border border-border bg-background/60 px-3 text-sm outline-none focus:border-ring"
                  >
                    <option value="">Any</option>
                    {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                      <option key={y} value={y}>
                        {y}+
                      </option>
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
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{results.length}</span>{" "}
            {t("resultsFound")}
          </p>
        </div>
      </div>

      {results.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
            />
          ))}
        </div>
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
    </div>
  );
}

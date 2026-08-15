"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Plus, ShieldCheck } from "lucide-react";
import type { Device } from "@/lib/firebase/types";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ComparePickerProps {
  catalog: Device[];
  preselected?: string[];
  maxSlots?: number;
}

/**
 * Standalone comparison launcher. Lets the visitor pick up to `maxSlots`
 * devices (min 2) and route to the live diff at /compare/a/b/…
 */
export function ComparePicker({
  catalog,
  preselected = [],
  maxSlots = 4,
}: ComparePickerProps) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>(
    preselected.filter((s) => catalog.some((d) => d.slug === s)),
  );
  const minSlots = 2;
  const ready = selected.length >= minSlots;

  const toggle = (slug: string) => {
    setSelected((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= maxSlots
          ? prev
          : [...prev, slug],
    );
  };

  const launch = () => {
    if (!ready) return;
    router.push(`/compare/${selected.join("/")}`);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-1.5 text-xs font-medium text-neon-cyan">
          <Plus className="h-3.5 w-3.5" /> Pick up to {maxSlots} devices
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Build your comparison
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Choose two or more handsets and SpecNova will diff every spec, camera
          and price in real time.
        </p>
      </div>

      <div className="mx-auto mb-8 flex max-w-md items-center justify-center gap-3">
        {Array.from({ length: maxSlots }).map((_, i) => {
          const slug = selected[i];
          const device = slug ? catalog.find((d) => d.slug === slug) : null;
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <span className="font-display text-lg text-muted-foreground/40">vs</span>
              )}
              <div
                className={cn(
                  "flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border transition-all",
                  device
                    ? "border-ring/50 bg-card"
                    : "border-dashed border-border bg-card/40",
                )}
                style={device ? { boxShadow: `0 0 20px ${device.brandColor}30` } : undefined}
              >
                {device ? (
                  <span
                    className="text-xs font-bold"
                    style={{ color: device.brandColor }}
                  >
                    {device.brand.split(" ")[0]}
                  </span>
                ) : (
                  <Plus className="h-5 w-5 text-muted-foreground/50" />
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {catalog.map((device) => {
          const isSelected = selected.includes(device.slug);
          return (
            <button
              key={device.id}
              onClick={() => toggle(device.slug)}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card/50 p-4 text-left backdrop-blur transition-all hover:border-ring/40 hover:bg-card/80",
                isSelected && "border-ring/60 bg-card",
              )}
              aria-pressed={isSelected}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-35"
                style={{ background: device.brandColor }}
              />
              <div className="relative z-10 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: device.brandColor }}>
                    {device.brand}
                  </p>
                  <h3 className="truncate font-display text-base font-semibold">{device.name}</h3>
                  <Badge className="mt-1.5 capitalize">{device.status}</Badge>
                </div>
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-transparent group-hover:border-ring/50",
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="relative z-10 mt-3 flex items-center justify-between">
                <span className="font-mono text-sm text-foreground">
                  {device.priceSummary?.latest
                    ? formatCurrency(device.priceSummary.latest, device.priceSummary.currency)
                    : "—"}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {device.score.total} pts
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex flex-col items-center gap-3">
        <button
          onClick={launch}
          disabled={!ready}
          className={cn(
            "inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 text-base font-medium text-primary-foreground shadow-[0_0_36px_hsl(var(--glow-primary)/0.35)] transition-all",
            ready
              ? "hover:shadow-[0_0_52px_hsl(var(--glow-primary)/0.55)]"
              : "cursor-not-allowed opacity-40 shadow-none",
          )}
        >
          Compare {selected.length} device{selected.length === 1 ? "" : "s"}
          <ChevronRight className="h-4 w-4" />
        </button>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          {selected.length < minSlots
            ? `Select at least ${minSlots} devices to unlock the diff.`
            : `Locked in — ${selected.length} devices ready.`}
        </p>
      </div>
    </div>
  );
}

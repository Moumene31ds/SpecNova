"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { RadioTower, Search } from "lucide-react";
import {
  checkCarrierCompatibility,
  bandsForCarrier,
  STATIC_CARRIER_BANDS,
  type BandCompatibility,
} from "@/lib/bands";
import type { Device } from "@/lib/firebase/types";
import { cn } from "@/lib/utils";

interface BandCheckerProps {
  device: Device;
}

const verdictStyles = {
  full: "border-success/40 bg-success/10 text-success",
  partial: "border-warning/40 bg-warning/10 text-warning",
  none: "border-danger/40 bg-danger/10 text-danger",
} as const;

const verdictLabels = { full: "Full coverage", partial: "Partial", none: "No support" } as const;

export function BandChecker({ device }: BandCheckerProps) {
  const deviceBands = device.specs.connectivity.bands;
  const carriers = React.useMemo(() => {
    const set = new Set<string>();
    for (const b of STATIC_CARRIER_BANDS) set.add(b.carrier);
    return [...set].sort();
  }, []);

  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);

  const filtered = carriers.filter((c) => c.toLowerCase().includes(query.toLowerCase()));

  const results: BandCompatibility[] = React.useMemo(
    () => (selected ? checkCarrierCompatibility(deviceBands, bandsForCarrier(selected)) : []),
    [selected, deviceBands],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/50 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <RadioTower className="h-4 w-4 text-neon-cyan" />
          <h3 className="text-sm font-medium">Carrier band compatibility</h3>
          <span className="font-mono text-xs text-muted-foreground">
            {deviceBands.length} bands
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search carrier…"
            className="h-8 w-44 rounded-lg border border-input bg-background/50 pl-8 pr-3 text-xs outline-none transition-colors focus:border-ring"
          />
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[240px_1fr]">
        <div className="max-h-64 overflow-y-auto rounded-xl border border-border/60">
          {filtered.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground">No carriers match.</p>
          )}
          {filtered.map((carrier) => {
            const country = STATIC_CARRIER_BANDS.find((b) => b.carrier === carrier)?.country;
            const hasMatch = bandsForCarrier(carrier).some((b) =>
              deviceBands.map((x) => x.toLowerCase()).includes(b.band.toLowerCase()),
            );
            return (
              <button
                key={carrier}
                onClick={() => setSelected(selected === carrier ? null : carrier)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 border-b border-border/40 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 last:border-0",
                  selected === carrier && "bg-secondary",
                )}
              >
                <span>
                  <span className="block text-sm font-medium">{carrier}</span>
                  <span className="block text-[11px] text-muted-foreground">{country}</span>
                </span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    hasMatch ? "bg-success" : "bg-muted-foreground/40",
                  )}
                />
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {!selected ? (
            <div className="flex h-full min-h-32 items-center justify-center rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              Select a carrier to map {device.brand} {device.name} against its
              3G/4G/5G network.
            </div>
          ) : (
            results.map((r) => (
              <motion.div
                key={r.technology}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("rounded-xl border px-4 py-3", verdictStyles[r.verdict])}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{r.technology}</span>
                    <span className="text-sm">{r.carrier} · {r.country}</span>
                  </div>
                  <span className="text-xs font-medium">
                    {verdictLabels[r.verdict]} · {Math.round(r.score * 100)}%
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.matched.map((b) => (
                    <span key={b} className="rounded-md bg-success/15 px-1.5 py-0.5 font-mono text-[11px]">
                      {b}
                    </span>
                  ))}
                  {r.missing.map((b) => (
                    <span key={b} className="rounded-md bg-background/40 px-1.5 py-0.5 font-mono text-[11px] opacity-70 line-through">
                      {b}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

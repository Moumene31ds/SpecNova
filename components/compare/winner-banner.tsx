"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildSpecRows, SPEC_GROUPS } from "@/lib/compare/spec-rows";
import type { Device } from "@/lib/firebase/types";

/**
 * Category-winner summary bar: shows how many spec groups each device
 * wins and crowns an overall leader for the comparison.
 */
export function WinnerBanner({ devices }: { devices: Device[] }) {
  const wins = React.useMemo(() => {
    const rows = buildSpecRows(devices);
    const counts = devices.map(() => 0);
    rows.forEach((row) => {
      row.better.forEach((i) => {
        counts[i] = (counts[i] ?? 0) + 1;
      });
    });
    return counts;
  }, [devices]);

  const max = Math.max(...wins);
  const leaders = wins
    .map((n, i) => ({ n, i }))
    .filter((w) => w.n === max && max > 0)
    .map((w) => w.i);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {devices.map((device, i) => {
        const isLeader = leaders.includes(i);
        const pct = max > 0 ? Math.round((wins[i] / max) * 100) : 0;
        return (
          <div
            key={device.id}
            className={cn(
              "relative min-w-[160px] flex-1 overflow-hidden rounded-2xl border p-4",
              isLeader
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-card/40",
            )}
          >
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-0.5"
              style={{ background: device.brandColor }}
            />
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="truncate text-xs font-semibold uppercase tracking-wider"
                  style={{ color: device.brandColor }}
                >
                  {device.brand}
                </p>
                <p className="truncate text-sm font-medium">{device.name}</p>
              </div>
              {isLeader && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  <Trophy className="h-3 w-3" /> Best
                </span>
              )}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="font-display text-2xl font-bold">{wins[i]}</span>
              <span className="pb-1 text-xs text-muted-foreground">
                {wins[i] === 1 ? "category won" : "categories won"}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary/60">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                className="h-full rounded-full"
                style={{ background: device.brandColor }}
              />
            </div>
          </div>
        );
      })}
      {devices.length > 2 && (
        <p className="text-xs text-muted-foreground">
          {SPEC_GROUPS.length} spec groups · shared winners possible
        </p>
      )}
    </div>
  );
}

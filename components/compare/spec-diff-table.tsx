"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildSpecRows, SPEC_GROUPS, type SpecRow } from "@/lib/compare/spec-rows";
import type { Device } from "@/lib/firebase/types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type DiffMode = "all" | "only-differences" | "only-better";

interface SpecDiffTableProps {
  devices: Device[];
}

/**
 * Framer Motion-powered spec diffing matrix with three modes:
 * show everything / highlight differences / winners only.
 */
export function SpecDiffTable({ devices }: SpecDiffTableProps) {
  const rows = React.useMemo(() => buildSpecRows(devices), [devices]);
  const [mode, setMode] = React.useState<DiffMode>("all");
  const [expanded, setExpanded] = React.useState<string[]>(SPEC_GROUPS);

  const toggleGroup = (group: string) =>
    setExpanded((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );

  const visibleRows = rows.filter((row) => {
    if (mode === "all") return true;
    if (mode === "only-better") return row.better.length > 0;
    const distinct = new Set(row.values).size > 1;
    return distinct;
  });

  const groups = SPEC_GROUPS.map((group) => ({
    group,
    rows: visibleRows.filter((r) => r.group === group),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/50 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-neon-cyan" />
          <span className="text-sm font-medium">Spec diffing</span>
        </div>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && setMode(v as DiffMode)}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="only-differences">Differences</ToggleGroupItem>
          <ToggleGroupItem value="only-better">Winners</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {groups.map(({ group, rows: groupRows }) => {
        const isOpen = expanded.includes(group);
        return (
          <div key={group} className="border-b border-border/60 last:border-0">
            <button
              onClick={() => toggleGroup(group)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              {group}
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
              />
            </button>

            {isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {groupRows.map((row) => (
                  <SpecRowLine key={row.key} row={row} devices={devices} />
                ))}
              </motion.div>
            )}
          </div>
        );
      })}

      {groups.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Nothing to diff — all specs match.
        </p>
      )}
    </div>
  );
}

function SpecRowLine({ row, devices }: { row: SpecRow; devices: Device[] }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,1fr)_1.5fr_1.5fr] items-center gap-2 border-t border-border/40 px-4 py-2 text-sm">
      <span className="truncate text-xs text-muted-foreground">{row.label}</span>
      {row.values.map((value, i) => {
        const isBetter = row.better.includes(i);
        return (
          <motion.span
            key={i}
            initial={{ backgroundColor: "transparent" }}
            animate={
              isBetter
                ? {
                    backgroundColor: "hsl(var(--glow-primary) / 0.12)",
                    transition: { duration: 0.3 },
                  }
                : { backgroundColor: "transparent" }
            }
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium",
              isBetter && "text-primary",
            )}
            title={`${devices[i]?.brand} ${devices[i]?.name}`}
          >
            {isBetter && <Check className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate tabular-nums">{value}</span>
          </motion.span>
        );
      })}
    </div>
  );
}

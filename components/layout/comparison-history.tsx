"use client";

import Link from "next/link";
import { History, X, GitCompareArrows } from "lucide-react";
import { motion } from "framer-motion";
import { useComparisonHistory } from "@/lib/hooks/use-comparison-history";
import { formatDate } from "@/lib/utils";

export function ComparisonHistory() {
  const { history, remove } = useComparisonHistory();

  if (history.length === 0) return null;

  return (
    <section className="py-8">
      <div className="container">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Comparison History</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
          {history.map((entry, idx) => (
            <motion.div
              key={`${entry.slugs.join("-")}-${entry.timestamp}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative shrink-0"
            >
              <Link
                href={`/compare/${entry.slugs.join("/")}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/40 px-3 py-2 backdrop-blur transition-all hover:border-ring/40 hover:bg-card/80"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <GitCompareArrows className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 max-w-[200px]">
                  <p className="truncate text-sm font-semibold">{entry.names.join(" vs ")}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(new Date(entry.timestamp))}</p>
                </div>
              </Link>
              <button
                onClick={() => remove(idx)}
                className="absolute -right-1.5 -top-1.5 h-7 w-7 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Remove from comparison history"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

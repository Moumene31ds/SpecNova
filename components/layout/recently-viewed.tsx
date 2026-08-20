"use client";

import Link from "next/link";
import { Clock, X } from "lucide-react";
import { motion } from "framer-motion";
import { useRecentlyViewed } from "@/lib/hooks/use-recently-viewed";

export function RecentlyViewed() {
  const { devices, remove } = useRecentlyViewed();

  if (devices.length === 0) return null;

  return (
    <section className="py-8">
      <div className="container">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Recently Viewed</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
          {devices.map((d) => (
            <motion.div
              key={d.slug}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative shrink-0"
            >
              <Link
                href={`/phone/${d.slug}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/40 px-3 py-2 backdrop-blur transition-all hover:border-ring/40 hover:bg-card/80"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {d.brand.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{d.brand}</p>
                  <p className="max-w-[120px] truncate text-sm font-semibold">{d.name}</p>
                </div>
              </Link>
              <button
                onClick={() => remove(d.slug)}
                className="absolute -right-1.5 -top-1.5 h-7 w-7 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label={`Remove ${d.name} from recently viewed`}
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

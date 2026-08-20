"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewStatsProps {
  score: { total: number; camera: number; hardware: number; battery: number; display: number };
  brandColor?: string;
  className?: string;
}

const distribution = [
  { stars: 5, percent: 45 },
  { stars: 4, percent: 30 },
  { stars: 3, percent: 15 },
  { stars: 2, percent: 7 },
  { stars: 1, percent: 3 },
];

const totalReviews = 247;

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn("shrink-0", i < rating ? "fill-warning text-warning" : "text-muted-foreground/30")}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

export function ReviewStats({ score, brandColor = "#8A2BE2", className }: ReviewStatsProps) {
  const rating = Math.round(score.total / 20);

  return (
    <div className={cn("rounded-2xl border border-border/60 bg-card/50 p-5 backdrop-blur-xl", className)}>
      <div className="flex items-start gap-5">
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-display text-4xl font-bold tabular-nums">{(score.total / 20).toFixed(1)}</span>
          <Stars rating={rating} size={16} />
          <span className="text-xs text-muted-foreground">Based on {totalReviews} reviews</span>
        </div>

        <div className="flex-1 space-y-2">
          {distribution.map(({ stars, percent }, i) => (
            <div key={stars} className="flex items-center gap-2.5">
              <span className="w-3 text-xs text-muted-foreground tabular-nums">{stars}</span>
              <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: brandColor }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${percent}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { Stars, totalReviews };

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type BentoSpan = 1 | 2 | 3 | 4;

interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | 4;
  className?: string;
}

const colSpanMap: Record<BentoSpan, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
};

export function BentoGrid({
  columns = 3,
  className,
  children,
  ...props
}: BentoGridProps) {
  const gridCols =
    columns === 2
      ? "md:grid-cols-2"
      : columns === 4
        ? "md:grid-cols-4"
        : "md:grid-cols-3";

  return (
    <div
      className={cn("grid grid-cols-1 gap-4", gridCols, className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface BentoCellProps {
  span?: BentoSpan;
  glowColor?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Ambient-lit bento cell. `glowColor` (device brand color) tints the
 * corner aura; the card tilts subtly on hover.
 */
export function BentoCell({
  span = 1,
  glowColor = "hsl(var(--glow-primary))",
  className,
  style,
  children,
}: BentoCellProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={style}
      className={cn(
        "tilt-card group relative overflow-hidden rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-xl transition-colors hover:border-ring/40 hover:bg-card/80",
        colSpanMap[span],
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-45"
        style={{ background: glowColor }}
      />
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </motion.div>
  );
}

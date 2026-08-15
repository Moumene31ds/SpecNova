"use client";

import { motion } from "framer-motion";

export function ScoreRing({
  value,
  size = 64,
  stroke = 5,
  label,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const hue =
    value >= 90
      ? "hsl(var(--success))"
      : value >= 75
        ? "hsl(var(--neon-cyan))"
        : value >= 60
          ? "hsl(var(--warning))"
          : "hsl(var(--danger))";

  return (
    <div className={`relative inline-flex items-center justify-center ${className ?? ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-secondary" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={hue}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${hue})` }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="font-display text-sm font-bold tabular-nums">{value}</span>
        {label && <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Cpu, Zap, Trophy, BarChart3 } from "lucide-react";

interface BenchmarkDevice {
  brand: string;
  name: string;
  brandColor: string;
  specs: {
    platform: {
      antutuV10: number | null;
      geekbench6: { single: number; multi: number } | null;
      chipset: string;
    };
  };
  score: {
    hardware: number;
  };
}

interface BenchmarkComparisonProps {
  devices: BenchmarkDevice[];
}

type BenchmarkType = "antutu" | "geekbenchSingle" | "geekbenchMulti" | "hardwareScore";

const BENCHMARKS: { key: BenchmarkType; label: string; icon: typeof Zap }[] = [
  { key: "antutu", label: "AnTuTu v10", icon: Zap },
  { key: "geekbenchSingle", label: "Geekbench 6 Single-Core", icon: Cpu },
  { key: "geekbenchMulti", label: "Geekbench 6 Multi-Core", icon: Cpu },
  { key: "hardwareScore", label: "Overall Hardware Score", icon: BarChart3 },
];

function getValue(device: BenchmarkDevice, key: BenchmarkType): number | null {
  switch (key) {
    case "antutu":
      return device.specs.platform.antutuV10;
    case "geekbenchSingle":
      return device.specs.platform.geekbench6?.single ?? null;
    case "geekbenchMulti":
      return device.specs.platform.geekbench6?.multi ?? null;
    case "hardwareScore":
      return device.score.hardware;
  }
}

function formatValue(key: BenchmarkType, value: number | null): string {
  if (value === null) return "N/A";
  if (key === "hardwareScore") return value.toString();
  return value.toLocaleString();
}

function getWinnerIdx(devices: BenchmarkDevice[], key: BenchmarkType): number {
  let max = -Infinity;
  let idx = -1;
  devices.forEach((d, i) => {
    const v = getValue(d, key);
    if (v !== null && v > max) {
      max = v;
      idx = i;
    }
  });
  return idx;
}

export default function BenchmarkComparison({ devices }: BenchmarkComparisonProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-neon-cyan" />
        <h3 className="text-sm font-medium">Benchmark Comparison</h3>
      </div>

      <div className="space-y-6">
        {BENCHMARKS.map((bench) => {
          const values = devices.map((d) => getValue(d, bench.key));
          const max = Math.max(...values.filter((v): v is number => v !== null), 1);
          const winnerIdx = getWinnerIdx(devices, bench.key);
          const Icon = bench.icon;

          return (
            <div key={bench.key}>
              <div className="mb-2 flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{bench.label}</span>
              </div>

              <div className="space-y-2">
                {devices.map((device, i) => {
                  const value = values[i];
                  const pct = value !== null ? (value / max) * 100 : 0;
                  const isWinner = i === winnerIdx && value !== null;

                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">
                        {device.brand} {device.name}
                      </span>

                      <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-secondary/40">
                        <motion.div
                          className="absolute inset-y-0 left-0 rounded-lg"
                          style={{ backgroundColor: device.brandColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                        <div className="relative z-10 flex h-full items-center justify-between px-2">
                          <span className="font-mono text-xs font-semibold tabular-nums text-white mix-blend-difference">
                            {formatValue(bench.key, value)}
                          </span>
                          {isWinner && (
                            <Trophy className="h-3.5 w-3.5 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {devices.map((device, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-background/40 p-3">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: device.brandColor }}
            />
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">
                {device.brand} {device.name}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                {device.specs.platform.chipset}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

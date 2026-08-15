"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Cpu, Thermometer, Zap } from "lucide-react";
import { gamingProfile } from "@/lib/compare/spec-rows";
import type { Device } from "@/lib/firebase/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GamingSimulatorProps {
  devices: Device[];
}

const GENRES = {
  fps: { label: "Competitive FPS", gpuLoad: 0.75 },
  openworld: { label: "Open World RPG", gpuLoad: 0.95 },
  racing: { label: "Racing / Racing sim", gpuLoad: 0.88 },
} as const;

/**
 * Interactive FPS & thermal-throttle simulator. Modeled on the device's
 * synthetic benchmark score, per-genre GPU load, and body-mass-derived
 * heat dissipation — the same curve the SpecNova score consumes.
 */
export function GamingSimulator({ devices }: GamingSimulatorProps) {
  const [genre, setGenre] = React.useState<keyof typeof GENRES>("fps");
  const profiles = devices.map(gamingProfile);
  const t = GENRES[genre];

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-neon-cyan" />
          <h3 className="text-sm font-medium">FPS & thermal simulator</h3>
        </div>
        <Tabs value={genre} onValueChange={(v) => setGenre(v as keyof typeof GENRES)}>
          <TabsList>
            {Object.entries(GENRES).map(([key, { label }]) => (
              <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {devices.map((device, i) => {
          const profile = profiles[i]!;
          const { peak, sustained, throttlePct, heatPct } = simulate(profile.fpsPeak, profile.thermal, t.gpuLoad);
          return (
            <div key={device.id} className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {device.brand} {device.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{profile.chipset}</span>
              </div>

              <div className="relative h-40">
                <svg viewBox="0 0 320 120" className="h-full w-full" preserveAspectRatio="none">
                  <GridLines />
                  {devices.length === 2 && <OpponentCurve idx={1 - i} devices={devices} t={t} />}
                  <SustainedCurve fps={peak} sustained={sustained} color={device.brandColor} />
                </svg>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Metric icon={Zap} value={`${peak} fps`} label="Peak" color="text-neon-cyan" />
                <Metric icon={Thermometer} value={`${Math.round(heatPct)}°C`} label="Stable temp" color="text-warning" />
                <Metric icon={Cpu} value={`-${Math.round(throttlePct)}%`} label="Throttle" color="text-danger" />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Projection based on AnTuTu v10, sustained-load heat modelling and body
        mass dissipation. Real-world results vary with ambient temperature.
      </p>
    </div>
  );
}

function simulate(fpsPeak: number, thermal: number, gpuLoad: number) {
  const peak = Math.round(fpsPeak * (0.9 + gpuLoad * 0.1));
  const heatPct = Math.min(45 + gpuLoad * 32 * thermal, 72);
  const throttlePct = Math.min(Math.max((heatPct - 46) * 1.15, 0), 26);
  const sustained = Math.max(Math.round(peak * (1 - throttlePct / 100) * (gpuLoad > 0.9 ? 0.86 : 0.94)), 24);
  return { peak, sustained, throttlePct, heatPct };
}

function Metric({ icon: Icon, value, label, color }: { icon: typeof Zap; value: string; label: string; color: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-2 py-2">
      <Icon className={`mx-auto h-4 w-4 ${color}`} />
      <div className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function GridLines() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={0} x2={320} y1={20 + i * 30} y2={20 + i * 30} stroke="hsl(var(--border))" strokeWidth={1} />
      ))}
    </>
  );
}

function SustainedCurve({ fps, sustained, color }: { fps: number; sustained: number; color: string }) {
  const toY = (f: number) => 120 - (f / 80) * 90;
  const d = `M 0,${toY(fps)} C 60,${toY(fps + 2)} 90,${toY(fps + 4)} 140,${toY(fps)} S 230,${toY(sustained - 6)} 320,${toY(sustained)}`;
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      style={{ filter: `drop-shadow(0 0 6px ${color})` }}
    />
  );
}

function OpponentCurve({ idx, devices, t }: { idx: number; devices: Device[]; t: (typeof GENRES)[keyof typeof GENRES] }) {
  const device = devices[idx]!;
  const profile = gamingProfile(device);
  const { peak, sustained } = simulate(profile.fpsPeak, profile.thermal, t.gpuLoad);
  const toY = (f: number) => 120 - (f / 80) * 90;
  const d = `M 0,${toY(peak)} C 70,${toY(peak - 1)} 120,${toY(peak - 3)} 180,${toY(sustained)} S 280,${toY(sustained - 4)} 320,${toY(sustained)}`;
  return <path d={d} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.5} />;
}

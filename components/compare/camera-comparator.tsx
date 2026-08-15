"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Device } from "@/lib/firebase/types";

interface CameraComparatorProps {
  devices: Device[];
}

/**
 * Side-by-side camera comparison slider. When real sample shots exist in
 * `media.cameraSamples` they're used; otherwise a synthetic split render
 * tinted by each device's brand glow demonstrates the interaction.
 */
export function CameraComparator({ devices }: CameraComparatorProps) {
  const [pos, setPos] = React.useState(50);
  const [a, b] = devices;
  if (!a || !b) return null;

  const sampleA = a.media?.cameraSamples?.night;
  const sampleB = b.media?.cameraSamples?.night;

  return (
    <div className="relative select-none overflow-hidden rounded-2xl border border-border">
      <div className="relative aspect-[16/9] w-full">
        {/* Layer B (right side) */}
        <div className="absolute inset-0">
          <Scene device={b} label="Night mode" />
        </div>

        {/* Layer A clipped by the divider */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <Scene device={a} label="Day mode" />
        </div>

        {sampleA && sampleB && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sampleB} alt={`${b.brand} ${b.name} night sample`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sampleA} alt={`${a.brand} ${a.name} day sample`} className="h-full w-full object-cover" draggable={false} />
            </div>
          </>
        )}

        {/* Divider */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/90 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
          style={{ left: `${pos}%` }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur">
            <ChevronLeft className="h-4 w-4" />
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>

        <input
          type="range"
          min={2}
          max={98}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Camera comparison slider"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-card/60 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: a.brandColor, boxShadow: `0 0 8px ${a.brandColor}` }} />
          <span className="text-sm font-medium">{a.brand} {a.name}</span>
          <span className="text-xs text-muted-foreground">· {pos}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{100 - pos}%</span>
          <span className="text-sm font-medium">{b.brand} {b.name}</span>
          <span className="h-2 w-2 rounded-full" style={{ background: b.brandColor, boxShadow: `0 0 8px ${b.brandColor}` }} />
        </div>
      </div>
    </div>
  );
}

function Scene({
  device,
  label,
}: {
  device: Device;
  label: string;
}) {
  const [x] = useSceneMovement();

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-background via-secondary to-background">
      <div
        className="absolute h-[140%] w-[140%] transition-transform duration-700"
        style={{
          background: `radial-gradient(circle at ${x}% 50%, ${device.brandColor}33 0%, transparent 45%)`,
          transform: "scale(1.1)",
        }}
      />
      <div className="absolute bottom-4 left-4 rounded-lg bg-background/70 px-3 py-1.5 text-xs font-medium backdrop-blur">
        {device.brand} {device.name} · {label}
      </div>
    </div>
  );
}

function useSceneMovement() {
  const [pos, setPos] = React.useState({ x: 40, y: 50 });
  React.useEffect(() => {
    const id = setInterval(() => {
      setPos(({ x }) => ({ x: (x + 1.5) % 100, y: 50 + Math.sin(x / 9) * 18 }));
    }, 400);
    return () => clearInterval(id);
  }, []);
  return [pos.x, pos.y] as const;
}

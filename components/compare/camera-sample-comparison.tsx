"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Camera, Aperture, Video, Eye, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraLens {
  megapixels: number;
  aperture: string | null;
  sensorSize: string | null;
  pixelSize: string | null;
  kind: string;
  stabilization: string;
  opticalZoom: number | null;
}

interface CameraDevice {
  brand: string;
  name: string;
  brandColor?: string;
  cameraSamples: Record<string, string>;
  cameras: {
    rear: CameraLens[];
    front: { megapixels: number; aperture: string | null };
  };
  specs: { display: { sizeIn: number } };
}

interface CameraSampleComparisonProps {
  deviceA: CameraDevice;
  deviceB: CameraDevice;
}

const CAMERA_KIND_LABELS: Record<string, string> = {
  main: "Main Sensor",
  wide: "Main Sensor",
  ultrawide: "Ultrawide",
  telephoto: "Telephoto",
  periscope: "Periscope Telephoto",
  macro: "Macro",
  depth: "Depth",
  selfie: "Selfie",
  front: "Front Camera",
};

function getLensLabel(lens: CameraLens): string {
  const kind = lens.kind?.toLowerCase() ?? "";
  return CAMERA_KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

function computeCameraScore(device: CameraDevice): number {
  let score = 0;
  const main = device.cameras.rear.find(
    (l) => l.kind?.toLowerCase() === "main" || l.kind?.toLowerCase() === "wide",
  );
  if (main) {
    score += Math.min(main.megapixels / 10.8, 12);
    const apVal = parseFloat(main.aperture?.replace("f/", "") ?? "1.8");
    if (!isNaN(apVal) && apVal > 0) score += Math.max(0, (2.5 - apVal) * 4);
    if (main.sensorSize) score += 4;
    if (main.stabilization?.includes("OIS")) score += 2;
  }

  const uw = device.cameras.rear.find((l) => l.kind?.toLowerCase() === "ultrawide");
  if (uw) {
    score += Math.min(uw.megapixels / 10, 6);
    score += 1.5;
  }

  const tele = device.cameras.rear.find(
    (l) => l.kind?.toLowerCase() === "telephoto" || l.kind?.toLowerCase() === "periscope",
  );
  if (tele) {
    score += Math.min((tele.opticalZoom ?? 1) * 2, 8);
    score += 2;
    if (tele.stabilization?.includes("OIS")) score += 1.5;
  }

  if (device.cameras.rear.length > 2) score += 2;
  score += Math.min(device.cameras.rear.length * 0.5, 3);

  const front = device.cameras.front;
  if (front) {
    score += Math.min(front.megapixels / 16, 4);
    const fAp = parseFloat(front.aperture?.replace("f/", "") ?? "2.0");
    if (!isNaN(fAp) && fAp > 0) score += Math.max(0, (2.8 - fAp) * 2);
  }

  return Math.round(Math.min(score, 100));
}

export default function CameraSampleComparison({
  deviceA,
  deviceB,
}: CameraSampleComparisonProps) {
  const hasSamplesA = Object.keys(deviceA.cameraSamples ?? {}).length > 0;
  const hasSamplesB = Object.keys(deviceB.cameraSamples ?? {}).length > 0;
  const hasSamples = hasSamplesA && hasSamplesB;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/50 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-neon-cyan" />
          <span className="text-sm font-medium">Camera Comparison</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {hasSamples ? "Sample Comparison" : "Specs Comparison"}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DeviceHeader device={deviceA} />
        <DeviceHeader device={deviceB} />
      </div>

      {hasSamples ? (
        <SampleSlider deviceA={deviceA} deviceB={deviceB} />
      ) : (
        <SpecsComparisonTable deviceA={deviceA} deviceB={deviceB} />
      )}

      <CameraScoreComparison deviceA={deviceA} deviceB={deviceB} />
    </div>
  );
}

function DeviceHeader({ device }: { device: CameraDevice }) {
  const color = device.brandColor ?? "#888";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 px-4 py-3 backdrop-blur-xl">
      <div
        className="h-3 w-3 rounded-full"
        style={{ background: color, boxShadow: `0 0 10px ${color}55` }}
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
          {device.brand}
        </p>
        <p className="truncate text-sm font-medium">{device.name}</p>
      </div>
    </div>
  );
}

function SampleSlider({
  deviceA,
  deviceB,
}: {
  deviceA: CameraDevice;
  deviceB: CameraDevice;
}) {
  const sampleKeys = Object.keys(deviceA.cameraSamples);
  const [activeSample, setActiveSample] = React.useState(sampleKeys[0] ?? "day");
  const [pos, setPos] = React.useState(50);

  const srcA = deviceA.cameraSamples[activeSample] ?? deviceA.cameraSamples[Object.keys(deviceA.cameraSamples)[0] ?? ""];
  const srcB = deviceB.cameraSamples[activeSample] ?? deviceB.cameraSamples[Object.keys(deviceB.cameraSamples)[0] ?? ""];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
    >
      {sampleKeys.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60 px-4 py-2">
          {sampleKeys.map((key) => (
            <button
              key={key}
              onClick={() => setActiveSample(key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                activeSample === key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="relative aspect-[16/9] w-full select-none overflow-hidden">
        {srcB && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={srcB}
            alt={`${deviceB.brand} ${deviceB.name} ${activeSample}`}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
            loading="lazy"
            decoding="async"
          />
        )}
        {srcA && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={srcA}
              alt={`${deviceA.brand} ${deviceA.name} ${activeSample}`}
              className="h-full w-full object-cover"
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        {!srcA && !srcB && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/30">
            <Camera className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

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
          aria-label="Camera sample comparison slider"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>

      <div className="flex items-center justify-between border-t border-border/60 bg-card/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: deviceA.brandColor, boxShadow: `0 0 8px ${deviceA.brandColor}` }}
          />
          <span className="text-sm font-medium">{deviceA.brand} {deviceA.name}</span>
          <span className="text-xs text-muted-foreground">· {pos}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{100 - pos}%</span>
          <span className="text-sm font-medium">{deviceB.brand} {deviceB.name}</span>
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: deviceB.brandColor, boxShadow: `0 0 8px ${deviceB.brandColor}` }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function SpecsComparisonTable({
  deviceA,
  deviceB,
}: {
  deviceA: CameraDevice;
  deviceB: CameraDevice;
}) {
  const specsA = buildSpecRows(deviceA);
  const specsB = buildSpecRows(deviceB);
  const allKeys = [...new Set([...specsA.map((s) => s.key), ...specsB.map((s) => s.key)])];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
    >
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Aperture className="h-4 w-4 text-neon-cyan" />
          <span className="text-sm font-medium">Camera Specs</span>
        </div>
      </div>

      <div className="divide-y divide-border/40">
        {allKeys.map((key) => {
          const rowA = specsA.find((s) => s.key === key);
          const rowB = specsB.find((s) => s.key === key);
          return (
            <SpecRow
              key={key}
              label={rowA?.label ?? rowB?.label ?? key}
              valueA={rowA?.value ?? "—"}
              valueB={rowB?.value ?? "—"}
              icon={rowA?.icon ?? rowB?.icon ?? Camera}
            />
          );
        })}
      </div>

      <VideoCapabilities deviceA={deviceA} deviceB={deviceB} />
      <SelfieSection deviceA={deviceA} deviceB={deviceB} />
    </motion.div>
  );
}

interface SpecRowData {
  key: string;
  label: string;
  value: string;
  icon: typeof Camera;
}

function buildSpecRows(device: CameraDevice): SpecRowData[] {
  const rows: SpecRowData[] = [];
  const main = device.cameras.rear.find(
    (l) => l.kind?.toLowerCase() === "main" || l.kind?.toLowerCase() === "wide",
  );
  if (main) {
    rows.push({
      key: "main-mp",
      label: "Main MP",
      value: `${main.megapixels} MP`,
      icon: Camera,
    });
    rows.push({
      key: "main-aperture",
      label: "Main Aperture",
      value: main.aperture ?? "—",
      icon: Aperture,
    });
    if (main.sensorSize) {
      rows.push({
        key: "main-sensor",
        label: "Sensor Size",
        value: main.sensorSize,
        icon: Camera,
      });
    }
    if (main.pixelSize) {
      rows.push({
        key: "main-pixel",
        label: "Pixel Size",
        value: main.pixelSize,
        icon: Camera,
      });
    }
  }

  const uw = device.cameras.rear.find((l) => l.kind?.toLowerCase() === "ultrawide");
  if (uw) {
    rows.push({
      key: "uw-mp",
      label: "Ultrawide MP",
      value: `${uw.megapixels} MP`,
      icon: Eye,
    });
    rows.push({
      key: "uw-aperture",
      label: "Ultrawide Aperture",
      value: uw.aperture ?? "—",
      icon: Aperture,
    });
  }

  const tele = device.cameras.rear.find(
    (l) => l.kind?.toLowerCase() === "telephoto" || l.kind?.toLowerCase() === "periscope",
  );
  if (tele) {
    rows.push({
      key: "tele-mp",
      label: "Telephoto MP",
      value: `${tele.megapixels} MP`,
      icon: Camera,
    });
    rows.push({
      key: "tele-zoom",
      label: "Optical Zoom",
      value: `${tele.opticalZoom ?? 1}x`,
      icon: ZoomIn,
    });
    rows.push({
      key: "tele-stab",
      label: "Stabilization",
      value: tele.stabilization ?? "None",
      icon: Camera,
    });
  }

  rows.push({
    key: "rear-count",
    label: "Rear Cameras",
    value: `${device.cameras.rear.length} lenses`,
    icon: Camera,
  });

  return rows;
}

function SpecRow({
  label,
  valueA,
  valueB,
  icon: Icon,
}: {
  label: string;
  valueA: string;
  valueB: string;
  icon: typeof Camera;
}) {
  const isBetterA = compareSpecValue(valueA, valueB) > 0;
  const isBetterB = compareSpecValue(valueA, valueB) < 0;

  return (
    <div className="grid grid-cols-[minmax(4rem,1fr)_1fr_1fr] items-center gap-1.5 px-4 py-2.5">
      <span className="flex items-center gap-2 truncate text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </span>
      <span
        className={cn(
          "rounded-lg px-2.5 py-1.5 text-center text-sm font-medium tabular-nums transition-colors",
          isBetterA && "bg-primary/12 text-primary ring-1 ring-primary/20",
          !isBetterA && isBetterB && "text-muted-foreground/60",
        )}
      >
        {valueA}
      </span>
      <span
        className={cn(
          "rounded-lg px-2.5 py-1.5 text-center text-sm font-medium tabular-nums transition-colors",
          isBetterB && "bg-primary/12 text-primary ring-1 ring-primary/20",
          !isBetterB && isBetterA && "text-muted-foreground/60",
        )}
      >
        {valueB}
      </span>
    </div>
  );
}

function compareSpecValue(a: string, b: string): number {
  const numA = extractNumber(a);
  const numB = extractNumber(b);
  if (numA !== null && numB !== null) return numA - numB;

  const lenA = a === "—" || a === "None" ? 0 : 1;
  const lenB = b === "—" || b === "None" ? 0 : 1;
  return lenA - lenB;
}

function extractNumber(s: string): number | null {
  const match = s.match(/[\d.]+/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return isNaN(n) ? null : n;
}

function VideoCapabilities({
  deviceA,
  deviceB,
}: {
  deviceA: CameraDevice;
  deviceB: CameraDevice;
}) {
  const mainA = deviceA.cameras.rear.find(
    (l) => l.kind?.toLowerCase() === "main" || l.kind?.toLowerCase() === "wide",
  );
  const mainB = deviceB.cameras.rear.find(
    (l) => l.kind?.toLowerCase() === "main" || l.kind?.toLowerCase() === "wide",
  );

  const stabA = mainA?.stabilization ?? "None";
  const stabB = mainB?.stabilization ?? "None";

  return (
    <div className="border-t border-border/40 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Video className="h-3.5 w-3.5 text-neon-cyan" />
        <span className="text-xs font-medium text-muted-foreground">Video Capabilities</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Stabilization</p>
          <p className="text-sm font-medium">{stabA}</p>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Stabilization</p>
          <p className="text-sm font-medium">{stabB}</p>
        </div>
      </div>
    </div>
  );
}

function SelfieSection({
  deviceA,
  deviceB,
}: {
  deviceA: CameraDevice;
  deviceB: CameraDevice;
}) {
  const frontA = deviceA.cameras.front;
  const frontB = deviceB.cameras.front;

  return (
    <div className="border-t border-border/40 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Camera className="h-3.5 w-3.5 text-neon-cyan" />
        <span className="text-xs font-medium text-muted-foreground">Selfie Camera</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Resolution</p>
          <p className="text-sm font-medium">{frontA.megapixels} MP</p>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Resolution</p>
          <p className="text-sm font-medium">{frontB.megapixels} MP</p>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Aperture</p>
          <p className="text-sm font-medium">{frontA.aperture}</p>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Aperture</p>
          <p className="text-sm font-medium">{frontB.aperture}</p>
        </div>
      </div>
    </div>
  );
}

function CameraScoreComparison({
  deviceA,
  deviceB,
}: {
  deviceA: CameraDevice;
  deviceB: CameraDevice;
}) {
  const scoreA = computeCameraScore(deviceA);
  const scoreB = computeCameraScore(deviceB);
  const maxScore = Math.max(scoreA, scoreB, 1);
  const colorA = deviceA.brandColor ?? "#888";
  const colorB = deviceB.brandColor ?? "#888";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center gap-2">
        <Aperture className="h-4 w-4 text-neon-cyan" />
        <span className="text-sm font-medium">Camera Score</span>
      </div>

      <div className="space-y-4">
        <ScoreBar
          label={`${deviceA.brand} ${deviceA.name}`}
          score={scoreA}
          maxScore={maxScore}
          color={colorA}
          isWinner={scoreA >= scoreB}
        />
        <ScoreBar
          label={`${deviceB.brand} ${deviceB.name}`}
          score={scoreB}
          maxScore={maxScore}
          color={colorB}
          isWinner={scoreB > scoreA}
        />
      </div>

      <p className="mt-4 text-[10px] text-muted-foreground/60">
        Based on megapixels, aperture, sensor size, stabilization, lens count, and front camera quality.
      </p>
    </motion.div>
  );
}

function ScoreBar({
  label,
  score,
  maxScore,
  color,
  isWinner,
}: {
  label: string;
  score: number;
  maxScore: number;
  color: string;
  isWinner: boolean;
}) {
  const pct = Math.round((score / maxScore) * 100);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={cn(
            "font-mono text-lg font-bold tabular-nums",
            isWinner ? "text-primary" : "text-muted-foreground",
          )}
        >
          {score}
          <span className="ml-0.5 text-xs text-muted-foreground">/100</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-secondary/60">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
          className="h-full rounded-full"
          style={{ background: color, boxShadow: isWinner ? `0 0 12px ${color}44` : undefined }}
        />
      </div>
      {isWinner && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.6 }}
          className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary"
        >
          Better Camera
        </motion.span>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Trophy,
  Camera,
  Cpu,
  BatteryFull,
  Monitor,
  BadgeDollarSign,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreRing } from "@/components/device/score-ring";
import { brandDisplayName } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type { Device } from "@/lib/firebase/types";

type SortKey = "total" | "camera" | "hardware" | "battery" | "display" | "value";

const CATEGORIES: {
  key: SortKey;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { key: "total", label: "Best Overall", icon: Trophy, color: "hsl(var(--neon-amber))" },
  { key: "camera", label: "Best Camera", icon: Camera, color: "hsl(var(--neon-violet))" },
  { key: "hardware", label: "Best Performance", icon: Cpu, color: "hsl(var(--neon-cyan))" },
  { key: "battery", label: "Best Battery", icon: BatteryFull, color: "hsl(var(--neon-green))" },
  { key: "display", label: "Best Display", icon: Monitor, color: "hsl(var(--neon-pink))" },
  { key: "value", label: "Best Value", icon: BadgeDollarSign, color: "hsl(var(--neon-amber))" },
];

function sortDevices(devices: Device[], key: SortKey): Device[] {
  const sorted = [...devices];
  if (key === "value") {
    sorted.sort((a, b) => {
      const aPrice = a.priceSummary?.min || Infinity;
      const bPrice = b.priceSummary?.min || Infinity;
      const aVal = aPrice > 0 ? a.score.total / aPrice : 0;
      const bVal = bPrice > 0 ? b.score.total / bPrice : 0;
      return bVal - aVal;
    });
  } else {
    sorted.sort((a, b) => (b.score?.[key] ?? 0) - (a.score?.[key] ?? 0));
  }
  return sorted.slice(0, 10);
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function RankBadge({ rank }: { rank: number }) {
  const colors =
    rank === 1
      ? "bg-neon-amber/20 text-neon-amber border-neon-amber/30"
      : rank === 2
        ? "bg-muted text-muted-foreground border-border"
        : rank === 3
          ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
          : "bg-secondary text-muted-foreground border-border";

  return (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${colors}`}
    >
      #{rank}
    </span>
  );
}

function RankingCard({
  device,
  rank,
  sortKey,
}: {
  device: Device;
  rank: number;
  sortKey: SortKey;
}) {
  const scoreVal = sortKey === "value" ? device.score.total : (device.score?.[sortKey] ?? 0);
  const mainCamera = device.specs?.cameras?.rear?.[0];
  const chipset = device.specs?.platform?.chipset ?? "—";
  const battery = device.specs?.battery?.capacityMah;
  const ram = device.specs?.memory?.ramOptions?.[0];
  const price = device.priceSummary?.min;

  const isTop3 = rank <= 3;

  return (
    <motion.div
      variants={itemVariants}
      className={`group relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-xl transition-all hover:border-primary/40 hover:shadow-[0_0_24px_hsl(var(--glow-primary)/0.15)] ${
        isTop3 ? "ring-1 ring-primary/10" : ""
      }`}
    >
      {isTop3 && (
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl"
          style={{ background: device.brandColor || "hsl(var(--primary))" }}
        />
      )}

      <div className="relative flex items-center gap-4 p-4 sm:p-5">
        <RankBadge rank={rank} />

        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white sm:h-16 sm:w-16 sm:text-xl"
          style={{
            background: `linear-gradient(135deg, ${device.brandColor || "#6B7280"}, ${device.brandColor || "#6B7280"}88)`,
          }}
        >
          {device.brand?.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{brandDisplayName(device.brand)}</p>
          <h3 className="truncate font-display text-base font-semibold sm:text-lg">
            {device.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{chipset}</p>
        </div>

        <div className="hidden flex-shrink-0 items-center gap-3 sm:flex">
          <div className="hidden text-right md:block">
            {battery && (
              <p className="text-xs text-muted-foreground">
                {battery} mAh
              </p>
            )}
            {mainCamera && (
              <p className="text-xs text-muted-foreground">
                {mainCamera.megapixels} MP
              </p>
            )}
            {ram && (
              <p className="text-xs text-muted-foreground">
                {ram} GB RAM
              </p>
            )}
          </div>

          <ScoreRing value={scoreVal} size={52} stroke={4} />
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-1.5 sm:hidden">
          <ScoreRing value={scoreVal} size={44} stroke={3} />
          {price != null && price > 0 && (
            <span className="text-xs font-medium text-primary">
              {formatCurrency(price)}
            </span>
          )}
        </div>

        {price != null && price > 0 && (
          <div className="hidden flex-shrink-0 flex-col items-end sm:flex">
            <span className="text-sm font-semibold text-foreground">
              {formatCurrency(price)}
            </span>
            <Link
              href={`/compare?devices=${device.slug}`}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              Compare
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function RankingsView({ catalog }: { catalog: Device[] }) {
  const [activeTab, setActiveTab] = useState<SortKey>("total");

  const sortedMap = useMemo(() => {
    const map: Record<SortKey, Device[]> = {} as Record<SortKey, Device[]>;
    for (const cat of CATEGORIES) {
      map[cat.key] = sortDevices(catalog, cat.key);
    }
    return map;
  }, [catalog]);

  return (
    <section className="pb-24 pt-8 sm:pt-12">
      <div className="container">
        <div className="mb-8 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-neon-amber/10">
            <Trophy className="h-5 w-5 text-neon-amber" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Top Phones
            </h1>
            <p className="text-sm text-muted-foreground">
              Rankings updated in real-time
            </p>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as SortKey)}
        >
          <TabsList className="mb-6 flex w-full overflow-x-auto sm:w-auto">
            {CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat.key}
                value={cat.key}
                className="gap-1.5 text-xs sm:text-sm"
              >
                <span className="text-neon-amber">★</span>
                <span className="hidden sm:inline">{cat.label}</span>
                <span className="sm:hidden">
                  {cat.key === "total"
                    ? "Overall"
                    : cat.key === "camera"
                      ? "Camera"
                      : cat.key === "hardware"
                        ? "CPU"
                        : cat.key === "battery"
                          ? "Battery"
                          : cat.key === "display"
                            ? "Display"
                            : "Value"}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map((cat) => (
            <TabsContent key={cat.key} value={cat.key}>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                key={cat.key}
                className="flex flex-col gap-3"
              >
                {sortedMap[cat.key].map((device, i) => (
                  <RankingCard
                    key={device.id}
                    device={device}
                    rank={i + 1}
                    sortKey={cat.key}
                  />
                ))}
              </motion.div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}

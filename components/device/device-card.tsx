import * as React from "react";
import Link from "next/link";
import { Smartphone, Battery, Camera, Cpu } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { Device } from "@/lib/firebase/types";
import { ScoreRing } from "@/components/device/score-ring";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/wishlist/wishlist-provider";

interface DeviceCardProps {
  device: Pick<
    Device,
    "slug" | "brand" | "name" | "status" | "priceSummary" | "score" | "media" | "brandColor"
  > & {
    specs?: Device["specs"];
  };
  className?: string;
  compact?: boolean;
}

const statusTone: Record<Device["status"], "success" | "warning" | "neon" | "secondary" | "default"> = {
  available: "success",
  announced: "neon",
  upcoming: "neon",
  rumored: "warning",
  discontinued: "secondary",
};

export const DeviceCard = React.memo(function DeviceCard({ device, className, compact = false }: DeviceCardProps) {
  const score = device.score?.total ?? 0;
  const price = device.priceSummary?.latest;
  const accent = device.brandColor ?? "#8A2BE2";

  const specs = device.specs;
  const chipsetShort = (specs?.platform?.chipset ?? "").replace(/Snapdragon |Dimensity |Exynos /, "").split(" ")[0] || "—";
  const batteryMah = specs?.battery?.capacityMah ?? 0;
  const mainCameraMp = specs?.cameras?.rear?.[0]?.megapixels ?? 0;
  const displaySize = specs?.display?.sizeIn ?? 0;

  return (
    <Link
      href={`/phone/${device.slug}`}
      className={cn(
        "tilt-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/50 p-4 sm:p-5 backdrop-blur-xl transition-all hover:border-ring/40 hover:bg-card/80 active:scale-[0.98] duration-200",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ background: accent }}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
            {device.brand}
          </p>
          <h3 className="mt-1 line-clamp-2 font-display text-base sm:text-lg font-semibold leading-tight">
            {device.name}
          </h3>
          <Badge variant={statusTone[device.status]} className="mt-1.5 capitalize text-[10px]">
            {device.status}
          </Badge>
        </div>
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <ScoreRing value={score} size={52} stroke={4} />
          <WishlistButton deviceId={device.slug} />
        </div>
      </div>

      {!compact && (
        <div
          className="relative z-10 mt-4 flex aspect-[4/3] items-center justify-center rounded-xl border border-border/60 bg-gradient-to-br from-secondary/80 to-background"
          style={{ boxShadow: `inset 0 0 40px ${accent}14` }}
        >
          {device.media?.heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={device.media.heroImage}
              alt={`${device.brand} ${device.name}`}
              className="h-full w-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <Smartphone
              className="h-14 w-14 sm:h-16 sm:w-16 text-muted-foreground/40 transition-all duration-500 group-hover:scale-110 group-hover:text-muted-foreground/70"
              style={{ filter: `drop-shadow(0 0 24px ${accent}55)` }}
            />
          )}
        </div>
      )}

      {/* Quick specs row */}
      {!compact && (
        <div className="relative z-10 mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          {chipsetShort !== "—" && (
            <span className="inline-flex items-center gap-1">
              <Cpu className="h-3 w-3" /> {chipsetShort}
            </span>
          )}
          {mainCameraMp > 0 && (
            <span className="inline-flex items-center gap-1">
              <Camera className="h-3 w-3" /> {mainCameraMp}MP
            </span>
          )}
          {batteryMah > 0 && (
            <span className="inline-flex items-center gap-1">
              <Battery className="h-3 w-3" /> {batteryMah >= 1000 ? `${(batteryMah / 1000).toFixed(1)}K` : batteryMah}
            </span>
          )}
          {displaySize > 0 && (
            <span>{displaySize}&quot;</span>
          )}
        </div>
      )}

      <div className="relative z-10 mt-3 flex items-center justify-between">
        <span className="font-mono text-sm font-medium text-foreground">
          {price ? formatCurrency(price, device.priceSummary?.currency ?? "USD") : "—"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {device.score ? `${device.score.camera} cam · ${device.score.battery} batt` : ""}
        </span>
      </div>
    </Link>
  );
});

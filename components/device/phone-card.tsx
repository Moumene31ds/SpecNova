"use client";

/**
 * PhoneCard — Displays a scraped phone with image, name, specs, and brand glow.
 *
 * Uses the ScrapedPhone type from types/phone.ts.
 * Designed for the /phones catalog grid — responsive, fast, and beautiful.
 */

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Smartphone, Battery, Camera, Cpu, Star, ExternalLink } from "lucide-react";
import type { ScrapedPhone } from "@/types/phone";

interface PhoneCardProps {
  phone: ScrapedPhone;
  className?: string;
  compact?: boolean;
}

// ── Helpers ──

function getBrandColor(brand: string): string {
  const colors: Record<string, string> = {
    samsung: "#1428A0",
    apple: "#A2AAAD",
    google: "#4285F4",
    xiaomi: "#FF6700",
    oneplus: "#F5010C",
    huawei: "#CF0A2C",
    oppo: "#1BA784",
    vivo: "#415FFF",
    realme: "#FFC800",
    sony: "#000000",
    nokia: "#124191",
    motorola: "#5C2D91",
    honor: "#00B0F0",
    nothing: "#000000",
    asus: "#00529B",
    lenovo: "#E2231A",
    tecno: "#0066CC",
    infinix: "#F37920",
    iqoo: "#F5C518",
    redmi: "#FF4500",
    poco: "#FBC02D",
    zte: "#0057B8",
    fairphone: "#2DB84B",
  };
  return colors[brand.toLowerCase().split(" ")[0]] ?? "#6B7280";
}

const statusColors: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  announced: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  upcoming: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  rumored: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  discontinued: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

// ── Component ──

export const PhoneCard = React.memo(function PhoneCard({
  phone,
  className = "",
  compact = false,
}: PhoneCardProps) {
  const accent = getBrandColor(phone.brand);

  const mainCamera = phone.specs?.cameras?.rear?.[0];
  const batteryMah = phone.specs?.battery?.capacityMah;
  const displaySize = phone.specs?.screen?.sizeIn;
  const chipset = phone.specs?.platform?.chipset;
  const ram = phone.specs?.memory?.ramGb?.[0];

  return (
    <Link
      href={`/phone/${phone.slug}`}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/50 backdrop-blur-xl transition-all duration-200 hover:border-ring/40 hover:bg-card/80 active:scale-[0.98] ${className}`}
    >
      {/* Brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ background: accent }}
      />

      {/* Image */}
      <div className="relative mx-auto mt-4 h-44 w-44 sm:h-52 sm:w-52 flex-shrink-0 overflow-hidden rounded-xl">
        {phone.images?.main ? (
          <Image
            src={phone.images.main}
            alt={phone.name}
            fill
            sizes="(max-width: 640px) 176px, 208px"
            className="object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjA4IiBoZWlnaHQ9IjIwOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjA4IiBoZWlnaHQ9IjIwOCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYzRjNGM2IiBmb250LXNpemU9IjQ4Ij48L3RleHQ+PC9zdmc+"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted/50 to-muted/20">
            <Smartphone className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}

        {/* Status badge */}
        <span
          className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${
            statusColors[phone.status] ?? "bg-zinc-500/10 text-zinc-400"
          }`}
        >
          {phone.status}
        </span>

        {/* Image count */}
        {(phone.images.gallery?.length ?? 0) > 1 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
            {phone.images.gallery.length} imgs
          </span>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col p-4 pt-3">
        <p
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: accent }}
        >
          {phone.brand}
        </p>
        <h3 className="mt-1 line-clamp-2 font-display text-base font-semibold leading-tight sm:text-lg">
          {phone.name}
        </h3>

        {/* Quick specs row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {chipset && (
            <span className="flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              <span className="max-w-[100px] truncate">{chipset.split(" ").slice(-2).join(" ")}</span>
            </span>
          )}
          {displaySize && (
            <span className="flex items-center gap-1">
              <Smartphone className="h-3 w-3" />
              {displaySize}&quot;
            </span>
          )}
          {mainCamera?.megapixels && (
            <span className="flex items-center gap-1">
              <Camera className="h-3 w-3" />
              {mainCamera.megapixels}MP
            </span>
          )}
          {batteryMah && (
            <span className="flex items-center gap-1">
              <Battery className="h-3 w-3" />
              {batteryMah}mAh
            </span>
          )}
        </div>

        {/* Price + Year */}
        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            {phone.pricing?.msrp && (
              <p className="text-sm font-bold text-foreground">
                ${phone.pricing.msrp.toLocaleString()}
              </p>
            )}
            {phone.releaseYear && (
              <p className="text-[10px] text-muted-foreground">{phone.releaseYear}</p>
            )}
          </div>

          {phone.pricing?.msrp && (
            <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5">
              <Star className="h-3 w-3 text-primary" fill="currentColor" />
              <span className="text-[10px] font-semibold text-primary">New</span>
            </div>
          )}
        </div>
      </div>

      {/* Gallery preview dots */}
      {compact && (phone.images.gallery?.length ?? 0) > 1 && (
        <div className="flex justify-center gap-1 pb-3">
          {phone.images.gallery.slice(0, 5).map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"
            />
          ))}
        </div>
      )}
    </Link>
  );
});

// ── Compact variant for lists ──

interface PhoneListItemProps {
  phone: ScrapedPhone;
}

export function PhoneListItem({ phone }: PhoneListItemProps) {
  const accent = getBrandColor(phone.brand);

  return (
    <Link
      href={`/phone/${phone.slug}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card/30 p-3 backdrop-blur-sm transition-all hover:border-ring/30 hover:bg-card/60"
    >
      {/* Thumbnail */}
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted/30">
        {phone.images?.main ? (
          <Image
            src={phone.images.main}
            alt={phone.name}
            fill
            sizes="64px"
            className="object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Smartphone className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
          {phone.brand}
        </p>
        <h4 className="truncate text-sm font-semibold">{phone.name}</h4>
        <p className="text-[11px] text-muted-foreground">
          {phone.specs?.platform?.chipset ?? "—"}
        </p>
      </div>

      {/* Price */}
      <div className="text-end">
        {phone.pricing?.msrp && (
          <p className="text-sm font-bold">${phone.pricing.msrp.toLocaleString()}</p>
        )}
        {phone.releaseYear && (
          <p className="text-[10px] text-muted-foreground">{phone.releaseYear}</p>
        )}
      </div>

      <ExternalLink className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-primary" />
    </Link>
  );
}

// ── Skeleton ──

export function PhoneCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-card/30 ${className}`}>
      <div className="mx-auto mt-4 h-44 w-44 animate-pulse rounded-xl bg-muted/50 sm:h-52 sm:w-52" />
      <div className="p-4 pt-3">
        <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
        <div className="mt-2 h-5 w-40 animate-pulse rounded bg-muted/50" />
        <div className="mt-3 flex gap-3">
          <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
          <div className="h-3 w-14 animate-pulse rounded bg-muted/50" />
          <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
        </div>
        <div className="mt-4 flex justify-between">
          <div className="h-4 w-16 animate-pulse rounded bg-muted/50" />
          <div className="h-4 w-12 animate-pulse rounded bg-muted/50" />
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Image from "next/image";
import { Camera, ChevronLeft, ChevronRight, Images, Loader2, Palette, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AssetCDNUrls, ColorVariantImage } from "@/types/device";

type MediaShape = {
  heroImage?: string | null;
  gallery?: string[];
  renderImages?: string[];
  modelUrl?: string | null;
  cameraSamples?: Record<string, string>;
  colorVariants?: ColorVariantImage[];
  cdn?: Record<string, AssetCDNUrls>;
};

export interface PhoneImageGalleryProps {
  device: {
    brand: string;
    name: string;
    brandColor?: string;
    media?: MediaShape | null;
  };
  className?: string;
  fallbackImage?: string | null;
}

interface StageItem {
  url: string;
  label: string;
}

/** Whether a URL is safe for `next/image` under the configured remote patterns. */
function isImageOptimizable(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "firebasestorage.googleapis.com" ||
      host.endsWith(".googleusercontent.com") ||
      host.endsWith("gsmarena.com") ||
      host.endsWith("samsung.com") ||
      host.endsWith("apple.com") ||
      host === "images.unsplash.com" ||
      host.endsWith("cloudfront.net") ||
      host === "i0.wp.com"
    );
  } catch {
    return false;
  }
}

/**
 * Interactive media gallery: hero + gallery photos, per-color cut-outs and
 * camera samples, with a lazy-loaded lightbox and a branded placeholder for
 * devices whose media is still queued in the OEM pipeline (JIT fallback).
 */
export function PhoneImageGallery({
  device,
  className,
  fallbackImage,
}: PhoneImageGalleryProps) {
  const accent = device.brandColor ?? "#8A2BE2";
  const media = device.media ?? {};

  const photos = React.useMemo(() => {
    const list: string[] = [];
    const push = (url: string | null | undefined) => {
      if (url && !list.includes(url)) list.push(url);
    };
    push(media.heroImage);
    for (const url of media.gallery ?? []) push(url);
    for (const url of media.renderImages ?? []) push(url);
    push(fallbackImage);
    return list;
  }, [media.heroImage, media.gallery, media.renderImages, fallbackImage]);

  const colorVariants = React.useMemo(
    () => media.colorVariants ?? [],
    [media.colorVariants],
  );
  const samples = React.useMemo(
    () => Object.entries(media.cameraSamples ?? {}),
    [media.cameraSamples],
  );

  const [tab, setTab] = React.useState<"photos" | "colors" | "samples">("photos");
  const [selected, setSelected] = React.useState<StageItem | null>(null);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);

  // Active stage item per tab.
  const active =
    selected && selected.url
      ? selected
      : photos[0]
        ? { url: photos[0], label: "Hero" }
        : null;

  const flat = React.useMemo(() => {
    const items: StageItem[] = [];
    photos.forEach((url, i) => items.push({ url, label: `Photo ${i + 1}` }));
    colorVariants.forEach((c) =>
      items.push({ url: c.imageUrl, label: c.colorName }),
    );
    samples.forEach(([key, url]) =>
      items.push({ url, label: key.replace(/[-_]+/g, " ") }),
    );
    return items;
  }, [photos, colorVariants, samples]);

  const selectItem = (item: StageItem) => {
    setSelected(item);
    setLightboxOpen(true);
  };

  const moveLightbox = React.useCallback(
    (delta: number) => {
      setSelected((prev) => {
        if (flat.length === 0) return prev;
        const currentIndex = prev
          ? flat.findIndex((i) => i.url === prev.url)
          : 0;
        const next = (currentIndex + delta + flat.length) % flat.length;
        return flat[next] ?? prev;
      });
    },
    [flat],
  );

  React.useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") moveLightbox(-1);
      if (e.key === "ArrowRight") moveLightbox(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, moveLightbox]);

  const initials = `${device.brand[0] ?? ""}${device.name[0] ?? ""}`.toUpperCase();

  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border bg-card/40 backdrop-blur", className)}>
      {/* Stage */}
      <div
        className="relative aspect-[4/5] w-full"
        style={{
          background: `radial-gradient(120% 140% at 85% -10%, ${accent}1f 0%, transparent 55%), linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--secondary)/0.35) 100%)`,
        }}
      >
        {active ? (
          <>
            {isImageOptimizable(active.url) ? (
              <Image
                src={active.url}
                alt={`${device.brand} ${device.name} — ${active.label}`}
                fill
                priority={selected === null}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 640px"
                className="object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.url}
                alt={`${device.brand} ${device.name} — ${active.label}`}
                loading="lazy"
                className="h-full w-full object-contain"
              />
            )}

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4">
              <span className="rounded-lg bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                {active.label}
              </span>
              <button
                type="button"
                onClick={() => selectItem(active)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-background/70 px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur transition-colors hover:bg-background/90"
              >
                <ZoomIn className="h-3.5 w-3.5" /> Fullscreen
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <span
              className="font-display text-7xl font-bold tracking-tight"
              style={{ color: accent }}
            >
              {initials || "—"}
            </span>
            <p className="max-w-[16rem] text-sm text-muted-foreground">
              Official renders are queued for AI QC. Images appear here as soon
              as the media pipeline finishes.
            </p>
            <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as typeof tab);
          setSelected(null);
        }}
        className="p-4"
      >
        <TabsList className="w-full">
          <TabsTrigger value="photos" className="flex-1 gap-1.5">
            <Images className="h-3.5 w-3.5" /> Photos
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {photos.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex-1 gap-1.5">
            <Palette className="h-3.5 w-3.5" /> Colors
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {colorVariants.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="samples" className="flex-1 gap-1.5">
            <Camera className="h-3.5 w-3.5" /> Samples
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {samples.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-3">
          {photos.length ? (
            <ThumbStrip
              items={photos.map((url, i) => ({ url, label: `Photo ${i + 1}` }))}
              activeUrl={active?.url}
              accent={accent}
              onSelect={(item) => {
                setSelected(item);
                setLightboxOpen(false);
              }}
            />
          ) : (
            <EmptyStrip label="No photos yet — queued for the OEM harvester." />
          )}
        </TabsContent>

        <TabsContent value="colors" className="mt-3">
          {colorVariants.length ? (
            <div className="grid grid-cols-3 gap-2">
              {colorVariants.map((v) => (
                <button
                  key={`${v.colorName}-${v.imageUrl}`}
                  type="button"
                  onClick={() => {
                    setSelected({ url: v.imageUrl, label: v.colorName });
                    setLightboxOpen(false);
                  }}
                  className="group flex flex-col items-center gap-1.5 rounded-xl border border-border/60 p-2 transition-colors hover:border-ring/50"
                >
                  <span className="relative aspect-square w-full overflow-hidden rounded-lg bg-secondary/40">
                    <VariantImage url={v.imageUrl} alt={v.colorName} />
                  </span>
                  <span className="flex items-center gap-1.5 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-border"
                      style={{ background: v.colorHex ?? accent }}
                    />
                    {v.colorName}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyStrip label="No colorway renders yet." />
          )}
        </TabsContent>

        <TabsContent value="samples" className="mt-3">
          {samples.length ? (
            <div className="grid grid-cols-2 gap-2">
              {samples.map(([key, url]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelected({ url, label: key.replace(/[-_]+/g, " ") });
                    setLightboxOpen(false);
                  }}
                  className="group aspect-[3/4] overflow-hidden rounded-xl border border-border/60"
                >
                  <div className="relative h-full w-full">
                    <VariantImage url={url} alt={key} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyStrip label="No camera samples yet." />
          )}
        </TabsContent>
      </Tabs>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl gap-2 border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">
            {device.brand} {device.name} — media
          </DialogTitle>
          {selected ? (
            <div className="relative overflow-hidden rounded-2xl border border-border bg-background">
              <div
                className="relative aspect-[4/5] w-full sm:aspect-[3/2]"
                style={{
                  background: `radial-gradient(120% 140% at 85% -10%, ${accent}1f 0%, transparent 55%)`,
                }}
              >
                {isImageOptimizable(selected.url) ? (
                  <Image
                    src={selected.url}
                    alt={selected.label}
                    fill
                    sizes="90vw"
                    className="object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.url}
                    alt={selected.label}
                    className="h-full w-full object-contain"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => moveLightbox(-1)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 text-foreground backdrop-blur transition-colors hover:bg-background"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => moveLightbox(1)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 text-foreground backdrop-blur transition-colors hover:bg-background"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm text-muted-foreground">
                  {selected.label}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {flat.findIndex((i) => i.url === selected.url) + 1}/
                  {flat.length}
                </span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ThumbStrip({
  items,
  activeUrl,
  accent,
  onSelect,
}: {
  items: StageItem[];
  activeUrl?: string | null;
  accent: string;
  onSelect: (item: StageItem) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map((item) => {
        const isActive = item.url === activeUrl;
        return (
          <button
            key={`${item.url}-${item.label}`}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-xl border bg-secondary/40 transition-all",
              isActive
                ? "border-transparent ring-2"
                : "border-border/60 hover:border-ring/50",
            )}
            style={isActive ? { ["--tw-ring-color" as string]: accent } : undefined}
          >
            <VariantImage url={item.url} alt={item.label} />
          </button>
        );
      })}
    </div>
  );
}

function VariantImage({ url, alt }: { url: string; alt: string }) {
  if (isImageOptimizable(url)) {
    return (
      <Image
        src={url}
        alt={alt}
        fill
        sizes="(max-width: 768px) 33vw, 200px"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  );
}

function EmptyStrip({ label }: { label: string }) {  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
      {label}
    </p>
  );
}

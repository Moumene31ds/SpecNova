"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, RotateCcw, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface LightboxImage {
  url: string;
  label: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accent?: string;
}

export function ImageLightbox({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
  accent = "#8A2BE2",
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const touchRef = React.useRef({ dist: 0, scale: 1 });

  React.useEffect(() => {
    setCurrentIndex(initialIndex);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [initialIndex, open]);

  const current = images[currentIndex];

  const zoomIn = () => setScale((s) => Math.min(s + 0.5, 5));
  const zoomOut = () => {
    setScale((s) => {
      const next = Math.max(s - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const goPrev = React.useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
    resetZoom();
  }, [images.length]);

  const goNext = React.useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length);
    resetZoom();
  }, [images.length]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
      if (e.key === "0") resetZoom();
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goPrev, goNext, onOpenChange]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = { dist: Math.hypot(dx, dy), scale };
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const newScale = Math.min(Math.max((dist / touchRef.current.dist) * touchRef.current.scale, 1), 5);
      setScale(newScale);
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (scale <= 1) setPosition({ x: 0, y: 0 });
  };

  const handleDoubleClick = () => {
    if (scale > 1) resetZoom();
    else setScale(2.5);
  };

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] gap-0 border-none bg-transparent p-0 shadow-none sm:max-w-5xl">
        <DialogTitle className="sr-only">{current.label} — Image viewer</DialogTitle>

        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-2xl border border-border bg-background"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
        >
          {/* Image area */}
          <div
            className="relative w-full"
            style={{ aspectRatio: "4/3", background: `radial-gradient(120% 140% at 85% -10%, ${accent}1f 0%, transparent 55%)` }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center transition-transform duration-150"
              style={{
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              }}
            >
              <Image
                src={current.url}
                alt={current.label}
                fill
                sizes="95vw"
                className="object-contain"
                draggable={false}
              />
            </div>
          </div>

          {/* Top bar */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-background/80 to-transparent p-3">
            <span className="rounded-lg bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              {current.label}
            </span>
            <div className="flex items-center gap-1.5">
              <ZoomButton onClick={zoomOut} disabled={scale <= 1}>
                <ZoomOut className="h-4 w-4" />
              </ZoomButton>
              <span className="min-w-[3rem] text-center font-mono text-xs text-muted-foreground">
                {Math.round(scale * 100)}%
              </span>
              <ZoomButton onClick={zoomIn} disabled={scale >= 5}>
                <ZoomIn className="h-4 w-4" />
              </ZoomButton>
              {scale !== 1 && (
                <ZoomButton onClick={resetZoom}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </ZoomButton>
              )}
            </div>
          </div>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 backdrop-blur transition-colors hover:bg-background"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                aria-label="Next image"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 backdrop-blur transition-colors hover:bg-background"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Bottom info */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-background/80 to-transparent px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} / {images.length}
            </span>
            <div className="flex gap-1.5">
              {images.map((img, i) => (
                <button
                  key={`${img.url}-${i}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(i);
                    resetZoom();
                  }}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === currentIndex ? "w-5" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                  )}
                  style={i === currentIndex ? { background: accent } : undefined}
                />
              ))}
            </div>
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg bg-background/70 p-1.5 backdrop-blur hover:bg-background/90"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ZoomButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/70 text-foreground backdrop-blur transition-colors hover:bg-background disabled:opacity-30"
    >
      {children}
    </button>
  );
}

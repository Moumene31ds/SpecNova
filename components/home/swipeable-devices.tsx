"use client";

import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DeviceCard } from "@/components/device/device-card";
import type { Device } from "@/lib/firebase/types";
import { haptic } from "@/lib/haptic";

export function SwipeableDeviceGrid({ devices }: { devices: Device[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    const cardWidth = 320 + 12;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.min(idx, devices.length - 1));
  }, [devices.length]);

  const scrollToIndex = useCallback((index: number) => {
    haptic("light");
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.children;
    if (cards[index]) {
      (cards[index] as HTMLElement).scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, []);

  const scroll = (direction: "left" | "right") => {
    haptic("light");
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Desktop grid */}
      <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {devices.map((device) => (
          <div key={device.id} className="min-h-[20rem]">
            <DeviceCard device={device} />
          </div>
        ))}
      </div>

      {/* Mobile swipe carousel */}
      <div className="sm:hidden relative overflow-visible">
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-4"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {devices.map((device) => (
            <div
              key={device.id}
              className="snap-center shrink-0 w-[85vw] max-w-[320px] min-h-[20rem]"
            >
              <DeviceCard device={device} />
            </div>
          ))}
        </div>

        {/* Scroll arrows */}
        {canScrollLeft && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => scroll("left")}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-background/90 border border-border shadow-lg flex items-center justify-center"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
        )}
        {canScrollRight && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => scroll("right")}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-background/90 border border-border shadow-lg flex items-center justify-center"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        )}

        {/* Scroll indicators */}
        <div className="flex justify-center gap-1.5 mt-2">
          {devices.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? "w-4 bg-primary"
                  : "w-1.5 bg-muted-foreground/30"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

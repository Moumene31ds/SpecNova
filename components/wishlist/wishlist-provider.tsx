"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const WISHLIST_KEY = "specnova-wishlist";

function getWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(WISHLIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setWishlist(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  } catch {}
}

export function useWishlist() {
  const [ids, setIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    setIds(getWishlist());
    const onStorage = (e: StorageEvent) => {
      if (e.key === WISHLIST_KEY) setIds(getWishlist());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = React.useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      setWishlist(next);
      return next;
    });
  }, []);

  const has = React.useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, toggle, has, count: ids.length };
}

export function WishlistButton({
  deviceId,
  className,
}: {
  deviceId: string;
  className?: string;
}) {
  const { toggle, has } = useWishlist();
  const isSaved = has(deviceId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(deviceId);
      }}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full transition-all",
        "border border-border/50 bg-background/60 backdrop-blur-sm",
        isSaved
          ? "text-red-500 hover:bg-red-500/10 hover:border-red-500/30"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary",
        className,
      )}
      aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart
        className={cn("h-4 w-4", isSaved && "fill-current")}
      />
    </button>
  );
}

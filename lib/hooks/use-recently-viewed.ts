"use client";

import * as React from "react";

const STORAGE_KEY = "itophone-recently-viewed";
const MAX_ITEMS = 20;

export interface RecentDevice {
  slug: string;
  brand: string;
  name: string;
  timestamp: number;
}

function readStorage(): RecentDevice[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeStorage(devices: RecentDevice[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch {}
}

export function useRecentlyViewed() {
  const [devices, setDevices] = React.useState<RecentDevice[]>([]);

  React.useEffect(() => {
    setDevices(readStorage());
    const onStorage = () => setDevices(readStorage());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = React.useCallback((device: Omit<RecentDevice, "timestamp">) => {
    setDevices((prev) => {
      const filtered = prev.filter((d) => d.slug !== device.slug);
      const next = [{ ...device, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      writeStorage(next);
      return next;
    });
  }, []);

  const remove = React.useCallback((slug: string) => {
    setDevices((prev) => {
      const next = prev.filter((d) => d.slug !== slug);
      writeStorage(next);
      return next;
    });
  }, []);

  const clear = React.useCallback(() => {
    setDevices([]);
    writeStorage([]);
  }, []);

  return { devices, add, remove, clear };
}

export function trackView(slug: string, brand: string, name: string) {
  if (typeof window === "undefined") return;
  const current = readStorage();
  const filtered = current.filter((d) => d.slug !== slug);
  const next = [{ slug, brand, name, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
  writeStorage(next);
}

"use client";

import * as React from "react";

const STORAGE_KEY = "itophone-compare-history";
const MAX_ITEMS = 20;

export interface CompareEntry {
  slugs: string[];
  names: string[];
  timestamp: number;
}

function readStorage(): CompareEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeStorage(entries: CompareEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export function useComparisonHistory() {
  const [history, setHistory] = React.useState<CompareEntry[]>([]);

  React.useEffect(() => {
    setHistory(readStorage());
    const onStorage = () => setHistory(readStorage());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = React.useCallback((slugs: string[], names: string[]) => {
    setHistory((prev) => {
      const key = [...slugs].sort().join("|");
      const filtered = prev.filter((e) => [...e.slugs].sort().join("|") !== key);
      const next = [{ slugs, names, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      writeStorage(next);
      return next;
    });
  }, []);

  const remove = React.useCallback((index: number) => {
    setHistory((prev) => {
      const next = prev.filter((_, i) => i !== index);
      writeStorage(next);
      return next;
    });
  }, []);

  const clear = React.useCallback(() => {
    setHistory([]);
    writeStorage([]);
  }, []);

  return { history, add, remove, clear };
}

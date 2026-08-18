"use client";

import dynamic from "next/dynamic";

export const LazyHeroSearch = dynamic(
  () => import("@/components/search/ai-search").then((m) => m.AiSearch),
  { ssr: false, loading: () => <div className="h-12 w-full max-w-xl animate-pulse rounded-2xl bg-card/50" /> },
);
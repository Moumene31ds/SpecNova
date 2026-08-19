"use client";

import dynamic from "next/dynamic";

export const LazyHeroSearch = dynamic(
  () => import("@/components/search/smart-search"),
  { ssr: false, loading: () => <div className="h-16 w-full max-w-3xl mx-auto animate-pulse rounded-2xl bg-card/50" /> },
);

export const LazyAiSearch = dynamic(
  () => import("@/components/search/ai-search").then((m) => m.AiSearch),
  { ssr: false, loading: () => <div className="h-12 w-full animate-pulse rounded-2xl bg-card/50" /> },
);
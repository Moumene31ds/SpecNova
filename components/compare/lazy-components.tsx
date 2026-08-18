"use client";

import dynamic from "next/dynamic";

export const LazyWinnerBanner = dynamic(
  () => import("@/components/compare/winner-banner").then((m) => m.WinnerBanner),
  { ssr: false, loading: () => <div className="h-12 animate-pulse rounded-xl bg-card/50" /> },
);

export const LazyCameraComparator = dynamic(
  () => import("@/components/compare/camera-comparator").then((m) => m.CameraComparator),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-card/50" /> },
);

export const LazyGamingSimulator = dynamic(
  () => import("@/components/compare/gaming-simulator").then((m) => m.GamingSimulator),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-card/50" /> },
);

export const LazyPriceHistoryChart = dynamic(
  () => import("@/components/charts/price-history-chart").then((m) => m.PriceHistoryChart),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-card/50" /> },
);

export const LazyBandChecker = dynamic(
  () => import("@/components/bands/band-checker").then((m) => m.BandChecker),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-2xl bg-card/50" /> },
);
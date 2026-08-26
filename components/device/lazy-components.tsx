"use client";

import dynamic from "next/dynamic";

export const LazyPriceHistoryChart = dynamic(
  () => import("@/components/charts/price-history-chart").then((m) => m.PriceHistoryChart),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-card/50" /> },
);

export const LazyBandChecker = dynamic(
  () => import("@/components/bands/band-checker").then((m) => m.BandChecker),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-2xl bg-card/50" /> },
);

export const LazyPhoneImageGallery = dynamic(
  () => import("@/components/PhoneImageGallery").then((m) => m.PhoneImageGallery),
  { ssr: false, loading: () => <div className="aspect-square animate-pulse rounded-2xl bg-card/50" /> },
);

export const LazyDeviceViewer3D = dynamic(
  () => import("@/components/device/device-viewer-3d").then((m) => m.DeviceViewer3D),
  { ssr: false, loading: () => <div className="aspect-square animate-pulse rounded-2xl bg-card/50" /> },
);

export const LazyImageUpload = dynamic(
  () => import("@/components/device/image-upload").then((m) => m.ImageUpload),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-2xl bg-card/50" /> },
);

export const LazyImageLightbox = dynamic(
  () => import("@/components/device/image-lightbox").then((m) => m.ImageLightbox),
  { ssr: false },
);
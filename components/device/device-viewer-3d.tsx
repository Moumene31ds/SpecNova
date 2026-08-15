"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const DeviceCanvas = dynamic(
  () => import("./device-canvas").then((m) => m.DeviceCanvas),
  { ssr: false, loading: () => <DeviceSkeleton /> },
);

/**
 * Interactive 360° device inspector (WebGL). Wrapped in a lazy-loaded
 * client boundary so Three.js never ships to the server bundle.
 */
export function DeviceViewer3D({
  brandColor,
  modelUrl,
  deviceName,
}: {
  brandColor: string;
  modelUrl?: string | null;
  deviceName?: string;
}) {
  return (
    <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-background to-secondary/40 sm:h-80">
      <DeviceCanvas brandColor={brandColor} modelUrl={modelUrl} deviceName={deviceName} />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
        <span className="rounded-lg bg-background/60 px-2 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground backdrop-blur">
          360° Inspector
        </span>
        <span className="rounded-lg bg-background/60 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
          drag to orbit · scroll to zoom
        </span>
      </div>
    </div>
  );
}

function DeviceSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

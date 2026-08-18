"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, ArrowRight } from "lucide-react";
import { useWishlist } from "@/components/wishlist/wishlist-provider";
import { fetchWishlistDevices } from "@/actions/wishlist";
import { DeviceCard } from "@/components/device/device-card";
import type { Device } from "@/lib/firebase/types";

type DeviceLike = Pick<
  Device,
  "slug" | "brand" | "name" | "status" | "priceSummary" | "score" | "media" | "brandColor"
>;

export function WishlistView({ locale }: { locale: string }) {
  const { ids } = useWishlist();
  const [devices, setDevices] = React.useState<DeviceLike[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (ids.length === 0) {
      setDevices([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchWishlistDevices(ids)
      .then((res) => {
        if (!cancelled) setDevices(res as DeviceLike[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return (
    <div className="container flex min-h-[70vh] flex-col items-center pt-16">
      <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-400">
        <Heart className="h-3.5 w-3.5 fill-current" /> {ids.length} saved
        device{ids.length !== 1 ? "s" : ""}
      </div>

      <h1 className="mt-5 text-balance text-center font-display text-4xl font-bold tracking-tight md:text-6xl">
        Your Wishlist
      </h1>
      <p className="mt-4 max-w-xl text-center text-muted-foreground">
        Devices you&apos;ve saved for later. Tap the heart on any device card to
        add or remove it here.
      </p>

      <div className="mt-8 w-full max-w-5xl">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: Math.max(ids.length, 3) }).map((_, i) => (
              <div
                key={i}
                className="h-80 animate-pulse rounded-2xl border border-border bg-card/30"
              />
            ))}
          </div>
        ) : devices.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((device) => (
              <DeviceCard key={device.slug} device={device} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card/30 px-8 py-20 text-center">
            <Heart className="h-12 w-12 text-muted-foreground/30" />
            <h2 className="font-display text-xl font-semibold">
              No devices saved yet
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Browse devices and tap the heart icon to save your favorites here.
            </p>
            <Link
              href={`/${locale}/search`}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-5 py-2.5 text-sm font-medium text-neon-cyan transition-colors hover:bg-neon-cyan/20"
            >
              Explore devices <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

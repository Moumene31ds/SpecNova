import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { DeviceCardSkeleton } from "@/components/device/device-card-skeleton";
import { LazyHeroSearch } from "@/components/search/lazy-components";
import HeroSection from "@/components/home/hero-section";
import BrandShowcase from "@/components/home/brand-showcase";
import FeatureBento from "@/components/home/feature-bento";
import CtaSection from "@/components/home/cta-section";
import { SwipeableDeviceGrid } from "@/components/home/swipeable-devices";
import { RecentlyViewed } from "@/components/layout/recently-viewed";
import { ComparisonHistory } from "@/components/layout/comparison-history";
import { getCatalog } from "@/lib/query/device-query";

export const metadata: Metadata = {
  title: "Every phone. Compared. Tracked.",
  description:
    "iToPhone — AI-powered device comparison with 100% global coverage and real-time price tracking.",
};

async function FeaturedDevices() {
  const catalog = await getCatalog(8);
  return <SwipeableDeviceGrid devices={catalog} />;
}

export default async function HomePage() {
  return (
    <>
      {/* ── Animated Hero Section ── */}
      <HeroSection />

      {/* ── Smart Search (centered under hero) ── */}
      <section className="relative -mt-16 z-20 px-4">
        <div className="max-w-3xl mx-auto">
          <Suspense fallback={<div className="h-16 w-full animate-pulse rounded-2xl bg-card/50" />}>
            <LazyHeroSearch />
          </Suspense>
        </div>
      </section>

      {/* ── Recently Viewed + Comparison History ── */}
      <RecentlyViewed />
      <ComparisonHistory />

      {/* ── Brand Showcase ── */}
      <BrandShowcase />

      {/* ── Featured Devices ── */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Trending now
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                This week&apos;s flagships
              </h2>
            </div>
            <Link
              href="/search"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="min-h-[20rem]">
                    <DeviceCardSkeleton />
                  </div>
                ))}
              </div>
            }
          >
            <FeaturedDevices />
          </Suspense>
        </div>
      </section>

      {/* ── Feature Bento ── */}
      <FeatureBento />

      {/* ── CTA Section ── */}
      <CtaSection />
    </>
  );
}

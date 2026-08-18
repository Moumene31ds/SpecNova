import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Box, RadioTower, Sparkles, TrendingDown, WandSparkles, Zap, ShieldCheck, Globe2, Search } from "lucide-react";
import { AiSearch } from "@/components/search/ai-search";
import { BentoGrid, BentoCell } from "@/components/bento/bento-grid";
import { DeviceCard } from "@/components/device/device-card";
import { getCatalog } from "@/lib/query/device-query";

// PPR-ready: this route is a static shell with client islands (AiSearch).
// Re-enable when PPR lands in stable Next: `export const experimental_ppr = true;`

export const metadata: Metadata = {
  title: "Every phone. Compared. Tracked.",
  description:
    "iToPhone — AI-powered device comparison with 100% global coverage and real-time price tracking.",
};

const STATS = [
  { value: "100%", label: "Device coverage" },
  { value: "<3s", label: "On-demand scrape" },
  { value: "50ms", label: "Vector search" },
  { value: "0", label: "Missing phones" },
];

const FEATURES = [
  {
    icon: Box,
    title: "3D Device Inspector",
    body: "Orbit any handset in WebGL. Rotate, inspect ports, and toggle exploded hardware layers.",
    accent: "hsl(262 100% 66%)",
    href: "/compare",
  },
  {
    icon: RadioTower,
    title: "Carrier Band Compatibility",
    body: "Check 3G/4G/5G frequency coverage against 40+ carriers worldwide — instantly.",
    accent: "hsl(187 100% 55%)",
    href: "/bands",
  },
  {
    icon: TrendingDown,
    title: "Live Price Intelligence",
    body: "Real-time retail price graphs with automated push alerts when the drop hits your target.",
    accent: "hsl(150 100% 46%)",
    href: "/compare",
  },
  {
    icon: WandSparkles,
    title: "Semantic Search",
    body: "“Best low-light camera under $400” — described in English, answered with vectors.",
    accent: "hsl(330 100% 60%)",
    href: "/search",
  },
];

export default async function HomePage() {
  const catalog = await getCatalog(6);

  return (
    <>
      {/* ------------------------------------------------ Hero */}
      <section className="relative overflow-hidden pb-12 pt-20 sm:pb-20 sm:pt-24 md:pt-32">
        <div className="container relative z-10 flex flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-1.5 text-xs font-medium text-neon-cyan">
            <Zap className="h-3.5 w-3.5" />
            Gemini-powered spec intelligence
          </div>

          <h1 className="max-w-4xl text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-7xl">
            Every phone ever made.
            <span className="text-shimmer block">Compared. Tracked.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
            iToPhone indexes 100% of the world&apos;s devices — historical,
            vintage, regional, and upcoming — then answers in milliseconds.
            Ask it anything.
          </p>

          <div className="mt-10 flex w-full justify-center">
            <AiSearch />
          </div>

          <dl className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="bg-card/60 px-6 py-5 backdrop-blur">
                <dt className="order-2 text-xs uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="font-display text-2xl font-bold text-primary">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------ Featured devices */}
      <section className="pb-20">
        <div className="container">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-neon-cyan">
                <Sparkles className="h-3.5 w-3.5" /> Trending now
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
                This week&apos;s flagships
              </h2>
            </div>
            <Link
              href="/compare"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Open compare
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <BentoGrid columns={3}>
            {catalog.slice(0, 6).map((device, i) => (
              <BentoCell
                key={device.id}
                span={i === 0 ? 2 : 1}
                glowColor={device.brandColor}
                className="min-h-[12rem] md:min-h-[16rem]"
              >
                <DeviceCard device={device} />
              </BentoCell>
            ))}
          </BentoGrid>
        </div>
      </section>

      {/* ------------------------------------------------ Feature bento */}
      <section className="pb-24">
        <div className="container">
          <div className="mb-10 text-center">
            <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-neon-cyan">
              <ShieldCheck className="h-3.5 w-3.5" /> The engine
            </p>
            <h2 className="mx-auto mt-2 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight md:text-4xl">
              Legacy spec sites, out-paced
            </h2>
          </div>

          <BentoGrid columns={4}>
            {FEATURES.map((feature, i) => (
              <BentoCell
                key={feature.title}
                span={i === 0 ? 2 : 1}
                glowColor={feature.accent}
                className="min-h-[12rem] md:min-h-[15rem]"
              >
                <div className="mb-auto">
                  <div
                    className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border"
                    style={{ boxShadow: `0 0 24px ${feature.accent}44` }}
                  >
                    <feature.icon className="h-5 w-5" style={{ color: feature.accent }} />
                  </div>
                  <h3 className="font-display text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
                </div>
                <Link
                  href={feature.href}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-foreground"
                >
                  Explore <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </BentoCell>
            ))}
          </BentoGrid>
        </div>
      </section>

      {/* ------------------------------------------------ CTA */}
      <section className="pb-24">
        <div className="container">
          <BentoCell
            span={4}
            glowColor="hsl(var(--glow-primary))"
            className="relative overflow-hidden py-16 text-center"
          >
            <Globe2 className="pointer-events-none absolute -right-8 -top-8 h-64 w-64 text-primary/10" />
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-bold tracking-tight md:text-5xl">
              Zero missing phones. Zero missed price drops.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              If we don&apos;t have it, we scrape it live in seconds. Subscribe
              to a price and we&apos;ll notify you the moment it falls.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/finder"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-border px-6 text-base font-medium transition-colors hover:border-ring/50 sm:px-8"
              >
                <Search className="h-4 w-4" /> Find your perfect phone
              </Link>
              <Link
                href="/compare"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-base font-medium text-primary-foreground shadow-[0_0_36px_hsl(var(--glow-primary)/0.4)] transition-shadow hover:shadow-[0_0_52px_hsl(var(--glow-primary)/0.6)] sm:px-8"
              >
                Start comparing <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/search"
                className="inline-flex h-12 items-center rounded-xl border border-border px-6 text-base font-medium transition-colors hover:border-ring/50 sm:px-8"
              >
                Try AI search
              </Link>
            </div>
          </BentoCell>
        </div>
      </section>
    </>
  );
}

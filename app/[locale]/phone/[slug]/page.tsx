import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowRight, Cpu, Battery, Camera, Disc, Gauge, Smartphone, Zap } from "lucide-react";
import { getDevice, getCatalog } from "@/lib/query/device-query";
import { brandColor } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ScoreRing } from "@/components/device/score-ring";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceCard } from "@/components/device/device-card";
import { BentoGrid, BentoCell } from "@/components/bento/bento-grid";
import { ShareButton } from "@/components/device/share-button";
import {
  LazyPriceHistoryChart,
  LazyBandChecker,
  LazyPhoneImageGallery,
  LazyDeviceViewer3D,
} from "@/components/device/lazy-components";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const device = await getDevice(slug);
  if (!device) return { title: "Device not found" };
  return {
    title: `${device.brand} ${device.name} — specs, price & review`,
    description: `Full ${device.brand} ${device.name} specs, live price tracking and carrier compatibility.`,
  };
}

const scoreMeta = [
  { key: "hardware", label: "Hardware", icon: Cpu },
  { key: "display", label: "Display", icon: Zap },
  { key: "camera", label: "Camera", icon: Camera },
  { key: "battery", label: "Battery", icon: Battery },
] as const satisfies ReadonlyArray<{
  key: "hardware" | "display" | "camera" | "battery";
  label: string;
  icon: typeof Cpu;
}>;

export default async function PhonePage({ params }: Props) {
  const { slug } = await params;
  const device = await getDevice(slug);
  if (!device) notFound();

  const accent = device.brandColor ?? brandColor(device.brand);
  const priceHistory = await import("@/lib/pricing").then((m) => m.getPriceHistorySafe(device.id));

  const related = (await getCatalog(8))
    .filter((d) => d.slug !== device.slug)
    .slice(0, 3);

  const compareUrl = `/compare/${device.slug}/${related[0]?.slug ?? ""}`.replace(/\/$/, "");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${device.brand} ${device.name}`,
    brand: { "@type": "Brand", name: device.brand },
    model: device.modelNumbers[0] ?? undefined,
    description: device.content || `${device.brand} ${device.name} - Full specifications, live price tracking and carrier compatibility.`,
    image: device.media.heroImage || undefined,
    offers: device.priceSummary?.latest
      ? {
          "@type": "Offer",
          price: device.priceSummary.latest,
          priceCurrency: device.priceSummary.currency ?? "USD",
          availability: device.status === "available" ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
        }
      : undefined,
    aggregateRating: device.score?.total
      ? {
          "@type": "AggregateRating",
          ratingValue: device.score.total,
          bestRating: 100,
          ratingCount: 1,
        }
      : undefined,
  };

  return (
    <div className="pb-20 pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ---------------------------------------------- Hero header */}
      <section className="container">
        <div
          className="relative overflow-hidden rounded-3xl border border-border p-5 sm:p-8 md:p-12"
          style={{
            background: `radial-gradient(120% 160% at 85% -20%, ${accent}26 0%, transparent 55%), radial-gradient(90% 120% at -10% 120%, hsl(var(--glow-accent)/0.12) 0%, transparent 50%)`,
          }}
        >
          <div className="grid items-center gap-6 sm:gap-10 md:grid-cols-2">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {device.modelNumbers[0] ?? "—"}
                </Badge>
                <Badge className="capitalize">{device.status}</Badge>
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-6xl">
                <span style={{ color: accent }}>{device.brand}</span>{" "}
                {device.name}
              </h1>
              <p className="mt-3 max-w-md text-muted-foreground">
                {device.specs.platform.chipset} ·{" "}
                {device.specs.display.sizeIn}&quot; {device.specs.display.type} ·{" "}
                {device.specs.battery.capacityMah} mAh
                {device.releaseAt ? ` · Released ${formatDate(device.releaseAt)}` : ""}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3 sm:gap-6">
                <ScoreRing value={device.score.total} size={80} stroke={6} label="iToPhone" />
                <div className="space-y-1">
                  <p className="font-display text-2xl font-bold sm:text-3xl">
                    {formatCurrency(device.priceSummary.latest, device.priceSummary.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Latest ·{" "}
                    <span className="text-success">
                      -{device.priceSummary.dropPercent}% off MSRP
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={compareUrl}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-5 text-sm font-medium transition-colors hover:border-ring/50 active:scale-[0.97]"
                  >
                    Compare <ArrowRight className="h-4 w-4" />
                  </Link>
                  <ShareButton title={`${device.brand} ${device.name} Specs`} />
                </div>
              </div>
            </div>

            <div className="perspective-1200">
              {(device.media.heroImage || device.media.gallery.length > 0) ? (
                <LazyPhoneImageGallery
                  device={{
                    brand: device.brand,
                    name: device.name,
                    brandColor: accent,
                    media: device.media,
                  }}
                />
              ) : (
                <LazyDeviceViewer3D
                  brandColor={accent}
                  modelUrl={device.media.modelUrl}
                  deviceName={`${device.brand} ${device.name}`}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- Score strip */}
      <section className="container mt-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
          {scoreMeta.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center gap-2 sm:gap-3 rounded-2xl border border-border bg-card/40 px-3 py-3 sm:px-5 sm:py-4 backdrop-blur">
              <Icon className="h-4 w-4 shrink-0 text-neon-cyan" />
              <div>
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="font-mono text-base font-semibold sm:text-lg">
                  {device.score[key]}
                  <span className="text-[10px] text-muted-foreground">/100</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------- Detail tabs */}
      <section className="container mt-6">
        <Tabs defaultValue="specs" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto gap-1 md:w-auto">
            <TabsTrigger value="specs" className="text-xs sm:text-sm">Full specs</TabsTrigger>
            <TabsTrigger value="price" className="text-xs sm:text-sm">Price history</TabsTrigger>
            <TabsTrigger value="bands" className="text-xs sm:text-sm">Carrier bands</TabsTrigger>
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="specs">
            <SpecGrid device={device} accent={accent} />
          </TabsContent>
          <TabsContent value="price">
            <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-card/50" />}>
              <LazyPriceHistoryChart
                deviceId={device.id}
                deviceName={`${device.brand} ${device.name}`}
                variantId={priceHistory.variantId || device.id}
                points={priceHistory.points}
                current={priceHistory.current as never}
              />
            </Suspense>
          </TabsContent>
          <TabsContent value="bands">
            <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-card/50" />}>
              <LazyBandChecker device={device} />
            </Suspense>
          </TabsContent>
          <TabsContent value="overview">
            <p className="max-w-3xl leading-relaxed text-muted-foreground">
              {device.content ||
                `${device.brand} ${device.name} is a ${device.specs.platform.os} phone powered by the ${device.specs.platform.chipset}, featuring a ${device.specs.display.sizeIn}" ${device.specs.display.type} display at ${device.specs.display.refreshRateHz}Hz, a ${device.specs.cameras.rear[0]?.megapixels ?? "—"}MP main camera, and a ${device.specs.battery.capacityMah}mAh battery.`}
            </p>
          </TabsContent>
        </Tabs>
      </section>

      {/* ---------------------------------------------- Related */}
      <section className="container mt-14">
        <h2 className="mb-6 flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
          <Smartphone className="h-5 w-5 text-neon-cyan" /> Compare with rivals
        </h2>
        <BentoGrid columns={3}>
          {related.map((d) => (
            <BentoCell key={d.id} glowColor={d.brandColor}>
              <DeviceCard device={d} />
            </BentoCell>
          ))}
        </BentoGrid>
      </section>
    </div>
  );
}

function SpecGrid({ device, accent }: { device: Awaited<ReturnType<typeof getDevice>> & object; accent: string }) {
  const s = device!.specs;
  const groups = [
    { label: "Body", icon: Smartphone, rows: [
      ["Dimensions", `${s.body.dimensions.heightMm} × ${s.body.dimensions.widthMm} × ${s.body.dimensions.depthMm} mm`],
      ["Weight", `${s.body.weightG} g`],
      ["Build", s.body.build],
      ["Protection", s.body.protection ?? "—"],
      ["Water resistance", s.body.ipRating ?? "None"],
      ["Colors", s.body.colors.join(", ")],
    ]},
    { label: "Display", icon: Zap, rows: [
      ["Type", `${s.display.type}, ${s.display.colorDepth}`],
      ["Size", `${s.display.sizeIn}" (${s.display.resolution})`],
      ["Refresh", `${s.display.refreshRateHz}Hz`],
      ["Peak brightness", `${s.display.peakBrightnessNits} nits`],
      ["PPI", String(s.display.ppi)],
      ["Glass", s.display.glass ?? "—"],
    ]},
    { label: "Performance", icon: Gauge, rows: [
      ["Chipset", s.platform.chipset],
      ["CPU", s.platform.cpu],
      ["GPU", s.platform.gpu],
      ["RAM", s.memory.ramOptions.join(" / ") + " GB"],
      ["Storage", s.memory.storageOptions.join(" / ") + " GB " + s.memory.storageType],
      ["AnTuTu v10", s.platform.antutuV10 ? s.platform.antutuV10.toLocaleString() : "—"],
    ]},
    { label: "Camera", icon: Camera, rows: [
      ["Main", `${s.cameras.rear[0]?.megapixels} MP ${s.cameras.rear[0]?.aperture}`],
      ["Ultrawide", `${s.cameras.rear[1]?.megapixels ?? "—"} MP`],
      ["Telephoto", `${s.cameras.rear[2]?.megapixels ?? "—"} MP ${s.cameras.rear[2]?.opticalZoom ? `(${s.cameras.rear[2].opticalZoom}x)` : ""}`],
      ["Front", `${s.cameras.front[0]?.megapixels} MP`],
      ["Features", s.cameras.features.slice(0, 4).join(" · ")],
    ]},
    { label: "Battery", icon: Battery, rows: [
      ["Capacity", `${s.battery.capacityMah} mAh`],
      ["Wired", `${s.battery.chargingWatts}W`],
      ["Wireless", `${s.battery.wirelessWatts}W`],
      ["Endurance", s.battery.enduranceHours ? `${s.battery.enduranceHours} h` : "—"],
      ["Charging", s.battery.chargingTimeMin ? `${s.battery.chargingTimeMin} min (0-100%)` : "—"],
    ]},
    { label: "Connectivity", icon: Disc, rows: [
      ["Wi-Fi", s.connectivity.wifi],
      ["Bluetooth", s.connectivity.bluetooth],
      ["NFC", s.connectivity.nfc ? "Yes" : "No"],
      ["eSIM", s.extras.esim ? "Yes" : "No"],
      ["Satellite SOS", s.extras.satelliteSos ? "Yes" : "No"],
      ["5G bands", s.connectivity.bands.filter((b) => b.startsWith("n")).join(" ")],
    ]},
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map(({ label, icon: Icon, rows }) => (
        <div key={label} className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            <Icon className="h-4 w-4" style={{ color: accent }} /> {label}
          </h3>
          <dl className="space-y-2">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-2 text-sm last:border-0 last:pb-0">
                <dt className="shrink-0 text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

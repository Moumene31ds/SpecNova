import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Gamepad2, RadioTower, Sparkles, TrendingDown } from "lucide-react";
import { getDevices, getCatalog } from "@/lib/query/device-query";
import { ScoreRing } from "@/components/device/score-ring";
import { ComparePicker } from "@/components/compare/compare-picker";
import { SpecDiffTable } from "@/components/compare/spec-diff-table";
import { WinnerBanner } from "@/components/compare/winner-banner";
import { CameraComparator } from "@/components/compare/camera-comparator";
import { GamingSimulator } from "@/components/compare/gaming-simulator";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";
import { BandChecker } from "@/components/bands/band-checker";
import { getPriceHistorySafe } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug = [] } = await params;
  const devices = await getDevices(slug);
  return {
    title: devices.length
      ? `${devices.map((d) => `${d.brand} ${d.name}`).join(" vs ")}`
      : "Compare devices",
    description: "Side-by-side SpecNova comparison with AI spec diffing.",
  };
}

export default async function ComparePage({ params }: Props) {
  const { slug = [] } = await params;
  const devices = await getDevices(slug);

  if (devices.length < 2) {
    const catalog = await getCatalog(24);
    return (
      <div className="container pb-24 pt-12">
        <ComparePicker
          catalog={catalog}
          preselected={slug}
          maxSlots={4}
        />
      </div>
    );
  }

  const histories = await Promise.all(
    devices.map((d) => getPriceHistorySafe(d.id)),
  );

  return (
    <div className="pb-20 pt-8">
      <div className="container">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to explore
        </Link>

        {/* ---------------------------------------------- Compare header */}
        <div className="relative overflow-hidden rounded-3xl border border-border p-5 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full opacity-25 blur-3xl"
            style={{ background: devices[0]!.brandColor }}
          />
          {devices[1] && (
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-25 blur-3xl"
              style={{ background: devices[1].brandColor }}
            />
          )}

          <div className="relative z-10">
            <Badge variant="neon" className="mb-4">
              <Sparkles className="h-3 w-3" /> AI comparison
            </Badge>

            <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
              {devices.map((device, i) => (
                <div key={device.id} className="flex items-center gap-4">
                  <ScoreRing value={device.score.total} size={80} stroke={6} label="Score" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: device.brandColor }}>
                      {device.brand}
                    </p>
                    <Link
                      href={`/phone/${device.slug}`}
                      className="font-display text-2xl font-bold tracking-tight transition-colors hover:text-primary md:text-3xl"
                    >
                      {device.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                      {device.specs.platform.chipset}
                    </p>
                  </div>
                  {i < devices.length - 1 && (
                    <span className="hidden font-display text-2xl text-muted-foreground/40 md:block">VS</span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <WinnerBanner devices={devices} />
            </div>
          </div>
        </div>

        {/* ---------------------------------------------- Tabs */}
        <Tabs defaultValue="overview" className="mt-6 w-full">
          <TabsList className="w-full justify-start overflow-x-auto md:w-auto">
            <TabsTrigger value="overview">Spec diffing</TabsTrigger>
            <TabsTrigger value="cameras">Camera</TabsTrigger>
            <TabsTrigger value="gaming">
              <Gamepad2 className="mr-1.5 h-3.5 w-3.5" /> Gaming
            </TabsTrigger>
            <TabsTrigger value="price">
              <TrendingDown className="mr-1.5 h-3.5 w-3.5" /> Price
            </TabsTrigger>
            <TabsTrigger value="bands">
              <RadioTower className="mr-1.5 h-3.5 w-3.5" /> Bands
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <SpecDiffTable devices={devices} />
          </TabsContent>

          <TabsContent value="cameras" className="mt-4">
            <CameraComparator devices={devices} />
          </TabsContent>

          <TabsContent value="gaming" className="mt-4">
            <GamingSimulator devices={devices} />
          </TabsContent>

          <TabsContent value="price" className="mt-4">
            <div className="grid gap-4 xl:grid-cols-2">
              {devices.map((device, i) => (
                <PriceHistoryChart
                  key={device.id}
                  deviceId={device.id}
                  deviceName={`${device.brand} ${device.name}`}
                  variantId={histories[i]?.variantId || device.id}
                  points={histories[i]?.points ?? []}
                  current={histories[i]?.current as never}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bands" className="mt-4">
            <div className="grid gap-4 xl:grid-cols-2">
              {devices.map((device) => (
                <BandChecker key={device.id} device={device} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

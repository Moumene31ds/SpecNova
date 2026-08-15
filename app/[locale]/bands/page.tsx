import type { Metadata } from "next";
import Link from "next/link";
import { RadioTower, Search } from "lucide-react";
import { STATIC_CARRIER_BANDS } from "@/lib/bands";

export const metadata: Metadata = { title: "Carrier Bands" };

export default function BandsPage() {
  const byCountry = new Map<string, typeof STATIC_CARRIER_BANDS>();
  for (const band of STATIC_CARRIER_BANDS) {
    const list = byCountry.get(band.country) ?? [];
    list.push(band);
    byCountry.set(band.country, list);
  }

  return (
    <div className="container pb-20 pt-12">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-1.5 text-xs font-medium text-neon-cyan">
          <RadioTower className="h-3.5 w-3.5" /> 3G / 4G / 5G coverage map
        </div>
        <h1 className="mt-5 font-display text-4xl font-bold tracking-tight md:text-5xl">
          Carrier band directory
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Open every phone page to run the interactive compatibility checker
          against these networks.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...byCountry.entries()].map(([country, bands]) => {
          const carriers = [...new Set(bands.map((b) => b.carrier))];
          const techs = [...new Set(bands.map((b) => b.technology))];
          return (
            <div key={country} className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
              <h2 className="flex items-center justify-between font-display text-lg font-semibold">
                {country}
                <span className="font-mono text-xs text-muted-foreground">
                  {techs.join("/")}
                </span>
              </h2>
              <div className="mt-4 space-y-3">
                {carriers.map((carrier) => {
                  const carrierBands = bands.filter((b) => b.carrier === carrier);
                  return (
                    <div key={carrier}>
                      <p className="text-sm font-medium text-muted-foreground">{carrier}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {carrierBands.map((b) => (
                          <Link
                            key={b.id}
                            href="/search"
                            className="rounded-md bg-secondary/60 px-2 py-1 font-mono text-[11px] transition-colors hover:bg-primary/15 hover:text-primary"
                            title={`${b.technology} ${b.band} · ${b.frequency}`}
                          >
                            {b.technology}·{b.band}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          href="/search"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground"
        >
          <Search className="h-4 w-4" /> Check your phone
        </Link>
      </div>
    </div>
  );
}

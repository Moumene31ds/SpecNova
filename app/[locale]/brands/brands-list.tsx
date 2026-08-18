"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  POPULAR_BRANDS,
  brandColor,
  brandDisplayName,
} from "@/lib/constants";

interface BrandInfo {
  slug: string;
  count: number;
}

export function BrandsList({ brands }: { brands: BrandInfo[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return brands;
    const q = query.toLowerCase();
    return brands.filter(
      (b) =>
        b.slug.includes(q) || brandDisplayName(b.slug).toLowerCase().includes(q),
    );
  }, [brands, query]);

  const popular = useMemo(
    () => filtered.filter((b) => POPULAR_BRANDS.includes(b.slug)),
    [filtered],
  );
  const rest = useMemo(
    () => filtered.filter((b) => !POPULAR_BRANDS.includes(b.slug)),
    [filtered],
  );

  return (
    <div className="space-y-8">
      <div className="relative mx-auto max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search brands…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {popular.length > 0 && (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Popular Brands
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {popular.map((b) => (
              <BrandCard key={b.slug} brand={b} />
            ))}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            All Brands
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {rest.map((b) => (
              <BrandCard key={b.slug} brand={b} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          No brands match your search.
        </p>
      )}
    </div>
  );
}

function BrandCard({ brand }: { brand: BrandInfo }) {
  const color = brandColor(brand.slug);
  const name = brandDisplayName(brand.slug);

  return (
    <Link
      href={`/search?brand=${brand.slug}`}
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-5 transition-all hover:border-transparent hover:shadow-lg"
      style={{
        // @ts-expect-error CSS custom properties are valid
        "--brand-color": color,
      }}
    >
      <div
        className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background: `radial-gradient(ellipse at top left, ${color}15, transparent 60%)`,
        }}
      />

      <div className="relative flex flex-col gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}20` }}
        >
          <Smartphone className="h-5 w-5" style={{ color }} />
        </div>

        <div>
          <h3 className="font-display text-base font-semibold">{name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {brand.count === 1 ? "1 phone" : `${brand.count} phones`}
          </p>
        </div>

        <div
          className="mt-auto h-0.5 w-8 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </Link>
  );
}

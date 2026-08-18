import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { locales } from "@/lib/i18n";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, type Device } from "@/lib/firebase/types";
import { BrandsList } from "./brands-list";

export const metadata: Metadata = {
  title: "Brands",
  description:
    "Browse every smartphone brand tracked by iToPhone — compare specs, track prices, and discover devices from Samsung, Apple, Xiaomi, and more.",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamic = "force-static";

interface BrandInfo {
  slug: string;
  count: number;
}

async function fetchBrands(): Promise<BrandInfo[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(COLLECTIONS.devices).get();

  const counts = new Map<string, number>();
  for (const doc of snapshot.docs) {
    const data = doc.data() as Partial<Device>;
    const brand = data.brand;
    if (brand && typeof brand === "string") {
      counts.set(brand, (counts.get(brand) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count);
}

export default async function BrandsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const brands = await fetchBrands();

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Smartphone Brands
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Explore every brand we track — compare specs, prices, and availability.
        </p>
      </div>
      <BrandsList brands={brands} />
    </section>
  );
}

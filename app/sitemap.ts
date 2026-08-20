import { MetadataRoute } from "next";
import { getCatalog } from "@/lib/query/device-query";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://phone-steel-beta.vercel.app";
const LOCALES = ["en", "fr"];
const STATIC_PAGES = [
  { path: "", changeFrequency: "daily" as const, priority: 1 },
  { path: "/search", changeFrequency: "daily" as const, priority: 0.9 },
  { path: "/compare", changeFrequency: "weekly" as const, priority: 0.8 },
  { path: "/rankings", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/finder", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/bands", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/wishlist", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/sign-in", changeFrequency: "monthly" as const, priority: 0.3 },
  { path: "/sign-up", changeFrequency: "monthly" as const, priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly" as const, priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const page of STATIC_PAGES) {
      entries.push({
        url: `${BASE_URL}/${locale}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      });
    }
  }

  try {
    const catalog = await getCatalog(2000);
    for (const device of catalog) {
      if (!device.slug) continue;
      for (const locale of LOCALES) {
        entries.push({
          url: `${BASE_URL}/${locale}/phone/${device.slug}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  } catch {
    // If Firestore is unavailable, skip dynamic entries
  }

  return entries;
}

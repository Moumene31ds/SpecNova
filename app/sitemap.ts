import { MetadataRoute } from "next";

const BASE_URL = "https://spec-nova-dz31.vercel.app";
const LOCALES = ["en", "fr"];
const PAGES = ["", "/search", "/compare", "/bands", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const page of PAGES) {
      const isRoot = page === "";
      const isLegal = page === "/privacy" || page === "/terms";
      entries.push({
        url: `${BASE_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: isRoot ? "daily" : isLegal ? "yearly" : "weekly",
        priority: isRoot ? 1 : isLegal ? 0.3 : 0.8,
      });
    }
  }

  return entries;
}

import type { MetadataRoute } from "next";

const PRODUCTION_URL = "https://phone-steel-beta.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/phone", "/compare", "/search", "/bands"],
        disallow: ["/api/", "/_next/"],
      },
    ],
    sitemap: `${PRODUCTION_URL}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://phone-steel-beta.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/phone/", "/compare/", "/search", "/rankings", "/finder", "/bands"],
        disallow: ["/api/", "/_next/", "/admin/", "/sign-in", "/sign-up"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}

import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    // PPR-ready architecture: static shells + client islands.
    // Flip `ppr: "incremental"` here once Next 16 (stable) ships PPR,
    // then un-ignore `experimental_ppr` in app/page.tsx.
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "recharts",
      "@react-three/fiber",
      "firebase",
      "firebase/auth",
      "next-intl",
      "react-hot-toast",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "fdn2.gsmarena.com",
      },
      {
        protocol: "https",
        hostname: "fdn1.gsmarena.com",
      },
      {
        protocol: "https",
        hostname: "image-us.samsung.com",
      },
      {
        protocol: "https",
        hostname: "**.samsung.com",
      },
      {
        protocol: "https",
        hostname: "store.storeimages.cdn-apple.com",
      },
      {
        protocol: "https",
        hostname: "**.apple.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "i0.wp.com",
      },
      {
        protocol: "https",
        hostname: "**.cdn-telegram.org",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudinary.com",
      },
    ],
    minimumCacheTTL: 604800,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com https://www.google.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.googleusercontent.com https://fdn2.gsmarena.com https://fdn1.gsmarena.com https://*.samsung.com https://store.storeimages.cdn-apple.com https://*.apple.com https://images.unsplash.com https://*.cloudfront.net https://i0.wp.com https://*.cdn-telegram.org https://res.cloudinary.com https://*.cloudinary.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
              "frame-src https://www.google.com https://*.firebaseapp.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/fonts/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./lib/i18n.ts");

export default withNextIntl(nextConfig);

// Cloudflare local dev: wire worker bindings into `next dev`.
// Guarded to `development` so Vercel/`next build` is never affected.
if (process.env.NODE_ENV === "development") {
  const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}

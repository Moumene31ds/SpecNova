import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext Cloudflare adapter configuration.
 *
 * Used only by the Cloudflare deploy path (`npm run deploy:cf`). Vercel
 * ignores this file entirely and keeps using `next build` + vercel.json.
 *
 * Defaults: in-memory incremental cache + direct revalidation, no durable
 * objects. To persist the Next.js cache across worker restarts, create an
 * R2 bucket, uncomment it in wrangler.jsonc, and wire it here:
 *
 *   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
 *   export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
 *
 * `cloudflare.useWorkerdCondition: false` is required for firebase-admin's
 * transitive dep `jwks-rsa` → `jose`: OpenNext's nft tracing only copies
 * jose's `dist/node` build, but the workerd export condition points at
 * `dist/browser/index.js`, which the traced copy lacks, so bundling fails.
 * Node conditions resolve the traced copy, and everything runs under
 * `nodejs_compat` anyway.
 */
export default {
  ...defineCloudflareConfig(),
  cloudflare: {
    useWorkerdCondition: false,
  },
};

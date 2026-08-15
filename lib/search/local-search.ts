import type { Device } from "@/lib/firebase/types";

export interface LocalSearchHit {
  device: Pick<
    Device,
    "id" | "slug" | "brand" | "name" | "status" | "priceSummary" | "score" | "media" | "brandColor"
  >;
  score: number;
}

/**
 * Client-side lexical search used as a graceful degradation path when the
 * Firestore index / Gemini key isn't available in a local preview build.
 * Mirrors the shape of the production `aiSearch` server action.
 */
export function localSearch(query: string, catalog: Device[], limit = 8): LocalSearchHit[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = catalog
    .map((device) => {
      const haystack = [
        device.brand,
        device.name,
        device.codename ?? "",
        ...(device.modelNumbers ?? []),
        device.content,
      ]
        .join(" ")
        .toLowerCase();

      let score = 0;
      let matched = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) {
          matched++;
          score += token.length / q.length;
        }
      }
      // Prefix bonus on brand/name.
      if (device.brand.toLowerCase().startsWith(q)) score += 0.6;
      if (device.name.toLowerCase().includes(q)) score += 0.5;

      const coverage = matched / tokens.length;
      if (coverage < 0.5) return null;

      return {
        device: {
          id: device.id,
          slug: device.slug,
          brand: device.brand,
          name: device.name,
          status: device.status,
          priceSummary: device.priceSummary,
          score: device.score,
          media: device.media,
          brandColor: device.brandColor,
        },
        score: Math.min(1, coverage * score * 1.8),
      } as LocalSearchHit;
    })
    .filter((hit): hit is LocalSearchHit => hit !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

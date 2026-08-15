import type { Metadata } from "next";
import { Sparkles, Zap } from "lucide-react";
import { AiSearch } from "@/components/search/ai-search";

export const metadata: Metadata = { title: "AI Search" };

const SUGGESTIONS = [
  "Best phone under $400 with great low-light camera",
  "2-day battery life with wireless charging",
  "Snapdragon flagship with 5x periscope",
  "Compact phone under 160g with IP68",
  "Best value gaming phone 2026",
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div className="container flex min-h-[70vh] flex-col items-center pt-20">
      <div className="flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-1.5 text-xs font-medium text-neon-cyan">
        <Sparkles className="h-3.5 w-3.5" /> Hybrid semantic engine · Gemini
        embeddings · Firestore Vector Search
      </div>

      <h1 className="mt-5 text-balance text-center font-display text-4xl font-bold tracking-tight md:text-6xl">
        Ask for a phone, <span className="text-shimmer">not a spec sheet</span>
      </h1>
      <p className="mt-4 max-w-xl text-center text-muted-foreground">
        Describe your ideal device in plain English. SpecNova embeds your
        intent and returns ranked matches in under 50ms.
      </p>

      <div className="mt-8 w-full max-w-2xl">
        <AiSearch
          placeholder='Try "best low-light camera under $400"…'
          showFallbackCta
          defaultQuery={q}
        />
      </div>

      <div className="mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <a
            key={s}
            href={`/search?q=${encodeURIComponent(s)}`}
            className="rounded-full border border-border bg-card/40 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground"
          >
            {s}
          </a>
        ))}
      </div>

      <div className="mt-16 flex items-center gap-2 text-xs text-muted-foreground">
        <Zap className="h-3.5 w-3.5 text-neon-cyan" />
        Missing a device? Search anyway — the Zero-Missing engine scrapes it
        live in ~3 seconds.
      </div>
    </div>
  );
}

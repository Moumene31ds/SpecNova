"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, Search, Sparkles, Zap } from "lucide-react";
import type { AiSearchResult } from "@/actions/search";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type Hit = {
  device: {
    id: string;
    slug: string;
    brand: string;
    name: string;
    status: string;
    brandColor: string;
    priceSummary?: { latest: number; currency: string };
    score?: { total: number };
    media?: { heroImage: string | null };
  };
  score: number;
};

interface AiSearchProps {
  placeholder?: string;
  initialResults?: Hit[];
  showFallbackCta?: boolean;
  defaultQuery?: string;
}

export function AiSearch({
  placeholder = "Search any device ever made…",
  initialResults = [],
  showFallbackCta = true,
  defaultQuery,
}: AiSearchProps) {
  const t = useTranslations("search");
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";

  const [query, setQuery] = React.useState(defaultQuery ?? "");
  const [results, setResults] = React.useState<Hit[]>(initialResults);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [usedFallback, setUsedFallback] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [latency, setLatency] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(null);
  const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const requestCountRef = React.useRef(0);

  const runSearch = React.useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setOpen(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestCountRef.current;

    setLoading(true);
    const started = performance.now();
    try {
      const { aiSearch } = await import("@/actions/search");
      const res: AiSearchResult = await aiSearch(trimmed, 8);
      if (controller.signal.aborted || requestId !== requestCountRef.current) return;
      if (res.hits.length) {
        setResults(res.hits);
        setUsedFallback(false);
      } else {
        const { localSearch } = await import("@/lib/search/local-search");
        const { getDevCatalog } = await import("@/lib/dev-data");
        if (controller.signal.aborted) return;
        setResults(localSearch(trimmed, getDevCatalog(), 8));
        setUsedFallback(true);
      }
      setLatency(res.latencyMs);
      setOpen(true);
    } catch {
      if (controller.signal.aborted) return;
      const { localSearch } = await import("@/lib/search/local-search");
      const { getDevCatalog } = await import("@/lib/dev-data");
      const hits = localSearch(trimmed, getDevCatalog(), 8);
      setResults(hits);
      setUsedFallback(true);
      setLatency(Math.round(performance.now() - started));
      setOpen(true);
    } finally {
      if (!controller.signal.aborted && requestId === requestCountRef.current) {
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  React.useEffect(() => {
    if (defaultQuery) setQuery(defaultQuery);
    return () => {
      abortRef.current?.abort();
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, [defaultQuery]);

  const navigate = React.useCallback((index: number) => {
    const hit = results[index];
    if (!hit) return;
    abortRef.current?.abort();
    setOpen(false);
    setQuery("");
    router.push(`/${locale}/phone/${hit.device.slug}`);
  }, [results, router, locale]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIndex]) navigate(activeIndex);
      else if (query.trim()) router.push(`/${locale}/search?q=${encodeURIComponent(query)}`);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full max-w-2xl">
      <div className="group relative">
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />
          ) : (
            <Search className="h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
          )}
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => { if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current); if (results.length > 0) setOpen(true); }}
          onBlur={() => { blurTimeoutRef.current = setTimeout(() => setOpen(false), 160); }}
          placeholder={placeholder}
          aria-label={t("aiSearchPlaceholder")}
          className="h-14 w-full rounded-2xl border border-border bg-card/80 pl-12 pr-4 font-mono text-sm text-foreground shadow-[0_0_40px_hsl(var(--glow-primary)/0.08)] outline-none backdrop-blur-xl transition-all placeholder:text-muted-foreground focus:border-ring focus:shadow-[0_0_48px_hsl(var(--glow-primary)/0.2)]"
        />
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          {loading ? t("embedding") : t("aiVectorSearch")}
        </div>
      </div>

      <AnimatePresence>
        {open && (results.length > 0 || query.trim()) && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-2xl backdrop-blur-2xl"
            onMouseDown={(e) => e.preventDefault()}
          >
            {results.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                  <Sparkles className="h-6 w-6 text-neon-cyan" />
                </div>
                <div>
                  <p className="font-medium">{t("notInIndex")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("requestScrape")}
                  </p>
                </div>
                {showFallbackCta && (
                  <Link
                    href={`/${locale}/search?q=${encodeURIComponent(query)}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Zap className="h-4 w-4" /> {t("requestScrape")}
                  </Link>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {usedFallback ? (
                      <Search className="h-3 w-3" />
                    ) : (
                      <Sparkles className="h-3 w-3 text-neon-cyan" />
                    )}
                    {usedFallback ? t("localPreview") : t("semanticMatches")}
                  </span>
                  {latency !== null && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {latency}ms
                    </span>
                  )}
                </div>
                <ul className="max-h-80 overflow-y-auto p-1.5" style={{ contain: "content" }}>
                  {results.map((hit, i) => (
                    <li key={hit.device.id}>
                      <button
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => navigate(i)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                          i === activeIndex && "bg-secondary/80",
                        )}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            background: hit.device.brandColor,
                            boxShadow: `0 0 12px ${hit.device.brandColor}`,
                          }}
                        />
                        <span className="flex-1">
                          <span className="block text-sm font-medium">
                            {hit.device.brand} {hit.device.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {hit.device.status}
                            {hit.device.priceSummary?.latest
                              ? ` · $${hit.device.priceSummary.latest}`
                              : ""}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-neon-cyan">
                            {(hit.score * 100).toFixed(0)}%
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onMouseDown={() => router.push(`/${locale}/search?q=${encodeURIComponent(query)}`)}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("openFullSearch")} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

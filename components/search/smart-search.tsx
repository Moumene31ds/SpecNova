"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Zap, Database, Globe, ArrowRight, Sparkles, X } from "lucide-react";
import { liveFetchDevice, type LiveFetchResult } from "@/actions/liveFetch";

interface SearchSuggestion {
  text: string;
  kind: "database" | "brand" | "popular";
}

const POPULAR_SEARCHES = [
  "Samsung Galaxy S25 Ultra",
  "iPhone 17 Pro Max",
  "Google Pixel 10 Pro",
  "OnePlus 13",
  "Xiaomi 16 Pro",
  "Vivo X300 Ultra",
  "OPPO Find X9 Ultra",
  "Nothing Phone 3",
];

const BRAND_SUGGESTIONS: SearchSuggestion[] = [
  { text: "Samsung", kind: "brand" },
  { text: "Apple", kind: "brand" },
  { text: "Google", kind: "brand" },
  { text: "OnePlus", kind: "brand" },
  { text: "Xiaomi", kind: "brand" },
  { text: "vivo", kind: "brand" },
  { text: "OPPO", kind: "brand" },
  { text: "Honor", kind: "brand" },
  { text: "Nothing", kind: "brand" },
  { text: "Realme", kind: "brand" },
];

export default function SmartSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [liveResult, setLiveResult] = useState<LiveFetchResult | null>(null);
  const [showLivePanel, setShowLivePanel] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Filter suggestions based on query
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions(BRAND_SUGGESTIONS);
      return;
    }
    const q = query.toLowerCase();
    const filtered = BRAND_SUGGESTIONS.filter((s) =>
      s.text.toLowerCase().includes(q),
    );
    // Also add popular searches that match
    const matchedPopular = POPULAR_SEARCHES.filter((p) =>
      p.toLowerCase().includes(q),
    ).map((text) => ({ text, kind: "popular" as const }));
    setSuggestions([...filtered, ...matchedPopular].slice(0, 8));
  }, [query]);

  // Live fetch with debounce
  const handleLiveFetch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 3) {
      setLiveResult(null);
      setShowLivePanel(false);
      return;
    }

    setIsLoading(true);
    setShowLivePanel(true);

    try {
      const result = await liveFetchDevice(searchQuery, { saveToDb: true });
      setLiveResult(result);

      if (result.found && result.device) {
        // Auto-navigate to phone page after brief display
        setTimeout(() => {
          router.push(`/phone/${result.device!.slug}`);
        }, 1500);
      }
    } catch {
      setLiveResult({
        found: false,
        source: "live",
        latencyMs: 0,
        message: "Search failed. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleInputChange = (value: string) => {
    setQuery(value);

    // Debounce live fetch
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 3) {
      debounceRef.current = setTimeout(() => {
        handleLiveFetch(value);
      }, 800);
    } else {
      setLiveResult(null);
      setShowLivePanel(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      if (liveResult?.found && liveResult.device) {
        router.push(`/phone/${liveResult.device.slug}`);
      } else {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  const handleSuggestionClick = (text: string) => {
    setQuery(text);
    setIsFocused(false);
    handleLiveFetch(text);
  };

  const handleClear = () => {
    setQuery("");
    setLiveResult(null);
    setShowLivePanel(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Main Search Bar */}
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`
            relative flex items-center gap-3 px-5 py-4
            bg-white/10 dark:bg-white/5
            backdrop-blur-2xl
            border transition-all duration-300
            rounded-2xl shadow-lg
            ${isFocused
              ? "border-primary/50 shadow-primary/10 ring-2 ring-primary/20"
              : "border-white/20 dark:border-white/10 hover:border-white/30"
            }
          `}
        >
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="Search any phone... Samsung, iPhone, Pixel, OnePlus..."
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-base"
            autoComplete="off"
          />

          {isLoading && (
            <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
          )}

          {query && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-all active:scale-95 shrink-0"
          >
            Search
          </button>
        </div>

        {/* Live Fetch Status Indicator */}
        {showLivePanel && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50">
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Loading State */}
              {isLoading && !liveResult && (
                <div className="p-6 text-center">
                  <div className="inline-flex items-center gap-3 px-5 py-3 bg-primary/10 rounded-xl">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    <span className="text-sm font-medium text-foreground">
                      Searching the web for &quot;{query}&quot;...
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Globe className="w-3 h-3" />
                    <span>Multi-step AI extraction with Google Search</span>
                  </div>
                </div>
              )}

              {/* Result Found */}
              {liveResult?.found && liveResult.device && (
                <div className="p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-4">
                    {liveResult.device.heroImage && (
                      <img
                        src={liveResult.device.heroImage}
                        alt={liveResult.device.name}
                        className="w-16 h-16 object-contain rounded-xl bg-white/5"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                          {liveResult.source === "database" ? (
                            <><Database className="w-3 h-3 inline mr-1" />Database</>
                          ) : (
                            <><Zap className="w-3 h-3 inline mr-1" />Live Fetch</>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {liveResult.latencyMs}ms
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground mt-1 truncate">
                        {liveResult.device.brand} {liveResult.device.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {liveResult.device.chipset && (
                          <span>{liveResult.device.chipset}</span>
                        )}
                        {liveResult.device.score > 0 && (
                          <span className="text-primary font-medium">
                            Score: {liveResult.device.score.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-primary shrink-0" />
                  </div>
                  {liveResult.source === "live" && (
                    <div className="mt-3 text-xs text-muted-foreground text-center">
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      Auto-saved to database for future searches
                    </div>
                  )}
                </div>
              )}

              {/* Not Found */}
              {liveResult && !liveResult.found && (
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    {liveResult.message}
                  </p>
                  <button
                    onClick={() => router.push(`/search?q=${encodeURIComponent(query)}`)}
                    className="mt-2 text-sm text-primary hover:underline"
                  >
                    Try advanced search →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </form>

      {/* Suggestions Dropdown */}
      {isFocused && !showLivePanel && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50">
          <div className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden p-2">
            {suggestions.map((s, i) => (
              <button
                key={`${s.text}-${i}`}
                onClick={() => handleSuggestionClick(s.text)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                {s.kind === "brand" ? (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {s.text.charAt(0)}
                  </div>
                ) : (
                  <Search className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm text-foreground">{s.text}</span>
                {s.kind === "brand" && (
                  <span className="ml-auto text-xs text-muted-foreground">brand</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Trophy, AlertCircle } from "lucide-react";
import { aiChat, type ChatMessage } from "@/actions/aiChat";
import MarkdownRenderer from "./markdown-renderer";

interface AiCompareAnalysisProps {
  phone1: string;
  phone2: string;
  specs1?: Record<string, unknown>;
  specs2?: Record<string, unknown>;
}

export default function AiCompareAnalysis({
  phone1,
  phone2,
  specs1,
  specs2,
}: AiCompareAnalysisProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    const specsContext = [];
    if (specs1) specsContext.push(`${phone1} specs: ${JSON.stringify(specs1).slice(0, 2000)}`);
    if (specs2) specsContext.push(`${phone2} specs: ${JSON.stringify(specs2).slice(0, 2000)}`);

    const messages: ChatMessage[] = [
      {
        role: "user",
        content: `Compare these two phones in detail: ${phone1} vs ${phone2}.${specsContext.length ? `\n\nSPECS DATA:\n${specsContext.join("\n\n")}` : ""}

Provide a comprehensive analysis covering:
1. **Overall Winner** — which phone is better and why
2. **Camera** — detailed comparison (sensors, low-light, video, zoom)
3. **Performance** — chipset, benchmarks, real-world speed
4. **Display** — quality, brightness, refresh rate, outdoor visibility
5. **Battery** — capacity, charging speed, real-world endurance
6. **Build & Design** — materials, durability, ergonomics
7. **Value** — price-to-performance ratio
8. **Best For** — who should buy each phone

Be specific with numbers. Declare clear winners for each category.`,
        timestamp: Date.now(),
      },
    ];

    try {
      const result = await aiChat(messages, { includeCatalog: false });
      setAnalysis(result.response);
    } catch {
      setError("Failed to generate analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!analysis && !isLoading && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={runAnalysis}
          className="w-full p-6 bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 border border-white/10 rounded-2xl text-center hover:border-white/20 transition-all group"
        >
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold">Get AI Deep Analysis</p>
              <p className="text-sm text-muted-foreground">
                Let AI compare {phone1} vs {phone2} in detail
              </p>
            </div>
          </div>
        </motion.button>
      )}

      {isLoading && (
        <div className="p-8 bg-white/5 border border-white/10 rounded-2xl text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            AI is analyzing {phone1} vs {phone2}...
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Cross-referencing specs from multiple sources
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={runAnalysis}
            className="ml-auto text-sm text-red-400 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-white/5 border border-white/10 rounded-2xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold">AI Analysis: {phone1} vs {phone2}</h3>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <MarkdownRenderer content={analysis} />
          </div>
          <button
            onClick={() => {
              setAnalysis(null);
              runAnalysis();
            }}
            className="mt-4 text-sm text-primary hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            Regenerate analysis
          </button>
        </motion.div>
      )}
    </div>
  );
}

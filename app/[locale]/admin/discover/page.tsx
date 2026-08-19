"use client";

import { useState } from "react";
import { Loader2, Download, Search, CheckCircle, XCircle, AlertTriangle, Zap } from "lucide-react";
import { discoverBrandModels, autoImportBrand, quickImportPhone } from "@/actions/admin/auto-discover";

const BRANDS = [
  "Samsung", "Apple", "Google", "Xiaomi", "OnePlus", "vivo", "OPPO",
  "Honor", "Nothing", "Realme", "Sony", "Motorola", "Huawei", "ASUS",
  "Nokia", "Infinix", "Tecno", "itel",
];

interface ImportProgress {
  phase: "idle" | "discovering" | "importing" | "done";
  discovered: number;
  imported: number;
  errors: number;
  total: number;
  currentPhone: string;
  results: Array<{
    phone: string;
    status: string;
    message: string;
    score?: number;
  }>;
}

export default function AutoDiscoverPage() {
  const [selectedBrand, setSelectedBrand] = useState("");
  const [maxPhones, setMaxPhones] = useState(20);
  const [quickQuery, setQuickQuery] = useState("");
  const [progress, setProgress] = useState<ImportProgress>({
    phase: "idle",
    discovered: 0,
    imported: 0,
    errors: 0,
    total: 0,
    currentPhone: "",
    results: [],
  });
  const [quickResult, setQuickResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleAutoImport = async () => {
    if (!selectedBrand) return;

    setProgress({
      phase: "discovering",
      discovered: 0,
      imported: 0,
      errors: 0,
      total: 0,
      currentPhone: "Discovering models...",
      results: [],
    });

    try {
      const result = await autoImportBrand(selectedBrand, {
        maxPhones,
        yearMin: 2024,
        skipExisting: true,
      });

      setProgress({
        phase: "done",
        discovered: result.discovered,
        imported: result.imported.filter((r) => r.status === "saved").length,
        errors: result.errors.length,
        total: result.imported.length,
        currentPhone: "",
        results: result.imported,
      });
    } catch (err) {
      setProgress((prev) => ({
        ...prev,
        phase: "idle",
        currentPhone: "",
      }));
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleQuickImport = async () => {
    if (!quickQuery.trim()) return;

    setQuickResult(null);
    try {
      const result = await quickImportPhone(quickQuery);
      setQuickResult(result);
      if (result.success) setQuickQuery("");
    } catch (err) {
      setQuickResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">
        Auto-Discovery{" "}
        <span className="text-primary">System</span>
      </h1>

      {/* Quick Import */}
      <div className="p-6 bg-card border border-border rounded-2xl">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Quick Import
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Import a single phone by name. AI will search the web, extract specs, and save to database.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            placeholder="e.g. Samsung Galaxy S25 Ultra, iPhone 17 Pro Max..."
            className="flex-1 px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            onKeyDown={(e) => e.key === "Enter" && handleQuickImport()}
          />
          <button
            onClick={handleQuickImport}
            disabled={!quickQuery.trim()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Import
          </button>
        </div>

        {quickResult && (
          <div className={`mt-4 p-3 rounded-xl text-sm ${quickResult.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {quickResult.success ? <CheckCircle className="w-4 h-4 inline mr-2" /> : <XCircle className="w-4 h-4 inline mr-2" />}
            {quickResult.message}
          </div>
        )}
      </div>

      {/* Brand Auto-Import */}
      <div className="p-6 bg-card border border-border rounded-2xl">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Brand Auto-Discovery
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Automatically discover and import ALL phone models from a brand. AI will search Google for complete model lists, then extract specs for each.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Brand</label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select brand...</option>
              {BRANDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Max phones</label>
            <input
              type="number"
              value={maxPhones}
              onChange={(e) => setMaxPhones(parseInt(e.target.value) || 20)}
              min={1}
              max={100}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAutoImport}
              disabled={!selectedBrand || progress.phase === "discovering" || progress.phase === "importing"}
              className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {progress.phase === "discovering" || progress.phase === "importing" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progress.phase === "discovering" ? "Discovering..." : "Importing..."}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Start Auto-Import
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress */}
        {progress.phase !== "idle" && (
          <div className="mt-6 space-y-4">
            {/* Progress Bar */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{
                    width: progress.total > 0
                      ? `${((progress.imported + progress.errors) / progress.total) * 100}%`
                      : "0%",
                  }}
                />
              </div>
              <span className="text-muted-foreground whitespace-nowrap">
                {progress.imported + progress.errors} / {progress.total || "?"}
              </span>
            </div>

            {/* Status */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-400" />
                {progress.imported} saved
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-400" />
                {progress.errors} errors
              </span>
              {progress.currentPhone && (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {progress.currentPhone}
                </span>
              )}
            </div>

            {/* Results */}
            {progress.results.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {progress.results.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                      r.status === "saved"
                        ? "bg-green-500/5"
                        : r.status === "skipped"
                          ? "bg-yellow-500/5"
                          : "bg-red-500/5"
                    }`}
                  >
                    {r.status === "saved" ? (
                      <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
                    ) : r.status === "skipped" ? (
                      <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                    )}
                    <span className="font-medium truncate">{r.phone}</span>
                    <span className="ml-auto text-muted-foreground truncate">{r.message}</span>
                    {r.score !== undefined && (
                      <span className="text-primary font-medium">Score: {r.score.toFixed(1)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

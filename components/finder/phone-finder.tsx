"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Camera,
  Cpu,
  BatteryFull,
  Monitor,
  Gamepad2,
  BadgeDollarSign,
  Smartphone,
  ArrowRight,
  RotateCcw,
  Check,
  Target,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { BRAND_COLORS, brandDisplayName } from "@/lib/constants";
import type { Device } from "@/lib/firebase/types";
import { DeviceCard } from "@/components/device/device-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BudgetIdx = 0 | 1 | 2 | 3 | 4 | 5;
type PriorityIdx = 0 | 1 | 2 | 3 | 4 | 5;
type SizeIdx = 0 | 1 | 2;

interface QuizAnswers {
  budget: BudgetIdx | null;
  priority: PriorityIdx | null;
  size: SizeIdx | null;
  brands: Set<string>;
}

// ---------------------------------------------------------------------------
// Budget ranges
// ---------------------------------------------------------------------------

const BUDGET_MAX: number[] = [200, 400, 600, 800, 1200, Infinity];
const BUDGET_MIN: number[] = [0, 200, 400, 600, 800, 1200];

// ---------------------------------------------------------------------------
// Priority → score key mapping
// ---------------------------------------------------------------------------

type ScoreKey = "camera" | "hardware" | "battery" | "display" | "value";

const PRIORITY_SCORE_KEY: ScoreKey[] = [
  "camera",     // Camera
  "hardware",   // Performance
  "battery",    // Battery Life
  "display",    // Display
  "hardware",   // Gaming (performance-driven)
  "value",      // Value
];

// ---------------------------------------------------------------------------
// Step icons
// ---------------------------------------------------------------------------

const PRIORITY_ICONS = [Camera, Cpu, BatteryFull, Monitor, Gamepad2, BadgeDollarSign];

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const pageVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PhoneFinderClientProps {
  catalog: Device[];
}

export function PhoneFinderClient({ catalog }: PhoneFinderClientProps) {
  const t = useTranslations("finder");

  const [step, setStep] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  const [answers, setAnswers] = React.useState<QuizAnswers>({
    budget: null,
    priority: null,
    size: null,
    brands: new Set<string>(),
  });

  // ── Navigation ────────────────────────────────────────────────────────

  const goTo = React.useCallback(
    (next: number) => {
      setDirection(next > step ? 1 : -1);
      setStep(next);
    },
    [step],
  );

  const selectBudget = React.useCallback(
    (idx: BudgetIdx) => {
      setAnswers((prev) => ({ ...prev, budget: idx }));
      setTimeout(() => goTo(1), 300);
    },
    [goTo],
  );

  const selectPriority = React.useCallback(
    (idx: PriorityIdx) => {
      setAnswers((prev) => ({ ...prev, priority: idx }));
      setTimeout(() => goTo(2), 300);
    },
    [goTo],
  );

  const selectSize = React.useCallback(
    (idx: SizeIdx) => {
      setAnswers((prev) => ({ ...prev, size: idx }));
      setTimeout(() => goTo(3), 300);
    },
    [goTo],
  );

  const toggleBrand = React.useCallback((brand: string) => {
    setAnswers((prev) => {
      const next = new Set(prev.brands);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return { ...prev, brands: next };
    });
  }, []);

  const startOver = React.useCallback(() => {
    setAnswers({ budget: null, priority: null, size: null, brands: new Set() });
    goTo(0);
  }, [goTo]);

  // ── Results ───────────────────────────────────────────────────────────

  const results = React.useMemo(() => {
    if (step !== 4) return [];
    if (answers.budget === null) return catalog;

    let filtered = catalog;

    // Budget filter
    if (answers.budget !== null) {
      const lo = BUDGET_MIN[answers.budget];
      const hi = BUDGET_MAX[answers.budget];
      filtered = filtered.filter((d) => {
        const price = d.priceSummary?.latest;
        if (!price || price === 0) return false;
        return price >= lo && price < hi;
      });
    }

    // Size filter
    if (answers.size !== null) {
      const sizeFilter: ((s: number) => boolean)[] = [
        (s) => s < 6.1,     // Compact
        (s) => s >= 6.1 && s <= 6.5, // Standard
        (s) => s > 6.5,     // Large
      ];
      filtered = filtered.filter((d) => {
        const sz = d.specs?.display?.sizeIn;
        return sz != null && sizeFilter[answers.size!](sz);
      });
    }

    // Brand filter
    if (answers.brands.size > 0) {
      filtered = filtered.filter((d) =>
        answers.brands.has(d.brand.toLowerCase()),
      );
    }

    // Priority sort
    if (answers.priority !== null) {
      const key = PRIORITY_SCORE_KEY[answers.priority];
      filtered = [...filtered].sort((a, b) => {
        const sa = a.score?.[key] ?? 0;
        const sb = b.score?.[key] ?? 0;
        return sb - sa;
      });
    }

    return filtered.slice(0, 6);
  }, [step, answers, catalog]);

  // ── Budget labels ─────────────────────────────────────────────────────

  const budgetIcons = Array(6).fill(DollarSign);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="container flex min-h-[70vh] flex-col items-center pt-12 pb-20">
      {/* Header */}
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-1.5 text-xs font-medium text-neon-cyan">
        <Target className="h-3.5 w-3.5" /> {t("subtitle")}
      </div>
      <h1 className="mt-4 text-balance text-center font-display text-4xl font-bold tracking-tight md:text-5xl">
        {t("title")}
      </h1>

      {/* Progress dots */}
      <div className="mt-6 flex items-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            onClick={() => i < step && goTo(i)}
            className={cn(
              "h-2.5 rounded-full transition-all duration-300",
              i < step
                ? "w-2.5 bg-primary cursor-pointer"
                : i === step
                  ? "w-8 bg-primary"
                  : "w-2.5 bg-border",
              i >= step && i > step && "cursor-default",
            )}
            aria-label={`Step ${i + 1}`}
          />
        ))}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("stepOf", { current: Math.min(step + 1, 4) })}
      </p>

      {/* Glass container */}
      <div className="relative mt-8 w-full max-w-2xl overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl sm:p-10">
        <AnimatePresence mode="wait" custom={direction}>
          {/* ── Step 0: Budget ──────────────────────────────────── */}
          {step === 0 && (
            <motion.div
              key="step0"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <h2 className="mb-6 text-center font-display text-2xl font-bold tracking-tight">
                {t("step1Title")}
              </h2>
              <motion.div
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                {t.raw("budgets").map((label: string, i: number) => {
                  const Icon = budgetIcons[i];
                  const active = answers.budget === i;
                  return (
                    <motion.button
                      key={i}
                      variants={itemVariants}
                      onClick={() => selectBudget(i as BudgetIdx)}
                      className={cn(
                        "group flex flex-col items-center gap-2 rounded-2xl border p-5 text-center transition-all duration-200",
                        active
                          ? "border-primary bg-primary/10 shadow-[0_0_24px_hsl(var(--glow-primary)/0.15)]"
                          : "border-border bg-card/60 backdrop-blur hover:border-primary/50 hover:shadow-[0_0_24px_hsl(var(--glow-primary)/0.1)]",
                      )}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/80 transition-colors group-hover:bg-primary/15">
                        <Icon
                          className={cn(
                            "h-5 w-5 transition-colors",
                            active ? "text-primary" : "text-muted-foreground group-hover:text-primary",
                          )}
                        />
                      </div>
                      <span className="text-sm font-medium">{label}</span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </motion.div>
          )}

          {/* ── Step 1: Priority ───────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <h2 className="mb-6 text-center font-display text-2xl font-bold tracking-tight">
                {t("step2Title")}
              </h2>
              <motion.div
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                {t.raw("priorities").map((label: string, i: number) => {
                  const Icon = PRIORITY_ICONS[i];
                  const desc = t.raw("priorityDesc")[i];
                  const active = answers.priority === i;
                  return (
                    <motion.button
                      key={i}
                      variants={itemVariants}
                      onClick={() => selectPriority(i as PriorityIdx)}
                      className={cn(
                        "group flex flex-col items-center gap-2 rounded-2xl border p-5 text-center transition-all duration-200",
                        active
                          ? "border-primary bg-primary/10 shadow-[0_0_24px_hsl(var(--glow-primary)/0.15)]"
                          : "border-border bg-card/60 backdrop-blur hover:border-primary/50 hover:shadow-[0_0_24px_hsl(var(--glow-primary)/0.1)]",
                      )}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/80 transition-colors group-hover:bg-primary/15">
                        <Icon
                          className={cn(
                            "h-5 w-5 transition-colors",
                            active ? "text-primary" : "text-muted-foreground group-hover:text-primary",
                          )}
                        />
                      </div>
                      <span className="text-sm font-semibold">{label}</span>
                      <span className="text-xs text-muted-foreground">{desc}</span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </motion.div>
          )}

          {/* ── Step 2: Size ──────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <h2 className="mb-6 text-center font-display text-2xl font-bold tracking-tight">
                {t("step3Title")}
              </h2>
              <motion.div
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                {t.raw("sizes").map((label: string, i: number) => {
                  const desc = t.raw("sizeDesc")[i];
                  const active = answers.size === i;
                  const scale = [0.75, 1, 1.15][i];
                  return (
                    <motion.button
                      key={i}
                      variants={itemVariants}
                      onClick={() => selectSize(i as SizeIdx)}
                      className={cn(
                        "group flex flex-col items-center gap-3 rounded-2xl border p-6 text-center transition-all duration-200",
                        active
                          ? "border-primary bg-primary/10 shadow-[0_0_24px_hsl(var(--glow-primary)/0.15)]"
                          : "border-border bg-card/60 backdrop-blur hover:border-primary/50 hover:shadow-[0_0_24px_hsl(var(--glow-primary)/0.1)]",
                      )}
                    >
                      <Smartphone
                        className={cn(
                          "transition-colors",
                          active ? "text-primary" : "text-muted-foreground group-hover:text-primary",
                        )}
                        style={{ width: 48 * scale, height: 48 * scale }}
                        strokeWidth={1.5}
                      />
                      <div>
                        <span className="text-sm font-semibold">{label}</span>
                        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            </motion.div>
          )}

          {/* ── Step 3: Brand ─────────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <h2 className="mb-6 text-center font-display text-2xl font-bold tracking-tight">
                {t("step4Title")}
              </h2>

              {/* "All brands" toggle */}
              <motion.button
                variants={itemVariants}
                initial="hidden"
                animate="show"
                onClick={() =>
                  setAnswers((prev) => ({
                    ...prev,
                    brands: prev.brands.size > 0 ? new Set() : prev.brands,
                  }))
                }
                className={cn(
                  "mx-auto mb-4 flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                  answers.brands.size === 0
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40",
                )}
              >
                {answers.brands.size === 0 && <Check className="h-3.5 w-3.5" />}
                {t("allBrands")}
              </motion.button>

              <motion.div
                className="flex flex-wrap justify-center gap-2"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                {Object.keys(BRAND_COLORS).map((brand) => {
                  const active = answers.brands.has(brand);
                  const color = BRAND_COLORS[brand];
                  return (
                    <motion.button
                      key={brand}
                      variants={itemVariants}
                      onClick={() => toggleBrand(brand)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200",
                        active
                          ? "border-transparent text-white shadow-lg"
                          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                      style={
                        active
                          ? { backgroundColor: color, boxShadow: `0 0 20px ${color}44` }
                          : undefined
                      }
                    >
                      {active && <Check className="h-3 w-3" />}
                      {brandDisplayName(brand)}
                    </motion.button>
                  );
                })}
              </motion.div>

              <motion.div
                className="mt-8 flex justify-center"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <button
                  onClick={() => goTo(4)}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 text-base font-medium text-primary-foreground shadow-[0_0_36px_hsl(var(--glow-primary)/0.4)] transition-shadow hover:shadow-[0_0_52px_hsl(var(--glow-primary)/0.6)]"
                >
                  {t("showResults")} <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ── Step 4: Results ────────────────────────────────── */}
          {step === 4 && (
            <motion.div
              key="step4"
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <h2 className="mb-6 text-center font-display text-2xl font-bold tracking-tight">
                {t("yourMatches")}
              </h2>

              {results.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">{t("noResults")}</p>
                </div>
              ) : (
                <motion.div
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {results.map((device) => (
                    <motion.div key={device.id} variants={itemVariants}>
                      <DeviceCard device={device} compact />
                    </motion.div>
                  ))}
                </motion.div>
              )}

              <motion.div
                className="mt-8 flex justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <button
                  onClick={startOver}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-6 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("startOver")}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

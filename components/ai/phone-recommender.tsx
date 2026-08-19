"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, Smartphone, DollarSign, Camera, Battery,
  Cpu, Monitor, Gamepad2, Briefcase, GraduationCap, Heart, Zap, X,
} from "lucide-react";
import { recommendPhones, type RecommendationRequest } from "@/actions/aiChat";
import MarkdownRenderer from "./markdown-renderer";

const USE_CASES = [
  { id: "camera", label: "Photography", icon: Camera, color: "#F59E0B" },
  { id: "gaming", label: "Gaming", icon: Gamepad2, color: "#EF4444" },
  { id: "battery", label: "All-Day Battery", icon: Battery, color: "#10B981" },
  { id: "business", label: "Business", icon: Briefcase, color: "#6366F1" },
  { id: "student", label: "Student", icon: GraduationCap, color: "#06B6D4" },
  { id: "value", label: "Best Value", icon: Heart, color: "#EC4899" },
];

const BUDGET_RANGES = [
  { label: "Under $200", min: 0, max: 200 },
  { label: "$200-400", min: 200, max: 400 },
  { label: "$400-600", min: 400, max: 600 },
  { label: "$600-800", min: 600, max: 800 },
  { label: "$800-1000", min: 800, max: 1000 },
  { label: "$1000+", min: 1000, max: 9999 },
  { label: "Any budget", min: 0, max: 9999 },
];

const PRIORITIES = [
  "Camera Quality", "Battery Life", "Performance", "Display Quality",
  "Build Quality", "Software Updates", "5G Support", "Fast Charging",
  "Compact Size", "Water Resistance", "Brand Reputation", "Price Value",
];

export default function PhoneRecommender() {
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [request, setRequest] = useState<RecommendationRequest>({
    priorities: [],
    dealbreakers: [],
  });

  const handleRecommend = async () => {
    setIsLoading(true);
    try {
      const res = await recommendPhones(request);
      setResult(res.recommendations);
      setStep(4);
    } catch {
      setResult("Sorry, I couldn't generate recommendations. Please try again.");
      setStep(4);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePriority = (p: string) => {
    setRequest((prev) => ({
      ...prev,
      priorities: prev.priorities?.includes(p)
        ? prev.priorities.filter((x) => x !== p)
        : [...(prev.priorities ?? []), p],
    }));
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4"
          >
            <Sparkles className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-bold">
            AI Phone{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Advisor
            </span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Tell me what you need, and I&apos;ll find your perfect phone
          </p>
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          {/* Step 0: Use Case */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold text-center">What will you use it for?</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {USE_CASES.map((uc) => (
                  <motion.button
                    key={uc.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setRequest((prev) => ({ ...prev, useCase: uc.id }));
                      setStep(1);
                    }}
                    className={`p-4 bg-white/5 border border-white/10 rounded-xl text-left hover:border-white/20 transition-all ${
                      request.useCase === uc.id ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <uc.icon className="w-6 h-6 mb-2" style={{ color: uc.color }} />
                    <p className="font-medium text-sm">{uc.label}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 1: Budget */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold text-center">What&apos;s your budget?</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {BUDGET_RANGES.map((b) => (
                  <motion.button
                    key={b.label}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setRequest((prev) => ({ ...prev, budget: b.max }));
                      setStep(2);
                    }}
                    className="p-4 bg-white/5 border border-white/10 rounded-xl text-center hover:border-white/20 transition-all"
                  >
                    <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-400" />
                    <p className="font-medium text-sm">{b.label}</p>
                  </motion.button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip — any budget
              </button>
            </motion.div>
          )}

          {/* Step 2: Priorities */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold text-center">What matters most? (select up to 3)</h2>
              <div className="flex flex-wrap justify-center gap-2">
                {PRIORITIES.map((p) => (
                  <motion.button
                    key={p}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => togglePriority(p)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      request.priorities?.includes(p)
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/5 border border-white/10 hover:border-white/20"
                    }`}
                  >
                    {p}
                  </motion.button>
                ))}
              </div>
              <button
                onClick={() => setStep(3)}
                className="w-full mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* Step 3: Brand & Summary */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-lg font-semibold text-center">Any brand preference?</h2>
              <div className="flex flex-wrap justify-center gap-2">
                {["Samsung", "Apple", "Google", "OnePlus", "Xiaomi", "vivo", "OPPO", "Any"].map((b) => (
                  <motion.button
                    key={b}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setRequest((prev) => ({
                      ...prev,
                      brand: b === "Any" ? undefined : b,
                    }))}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      (request.brand === b) || (!request.brand && b === "Any")
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/5 border border-white/10 hover:border-white/20"
                    }`}
                  >
                    {b}
                  </motion.button>
                ))}
              </div>

              {/* Summary */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <h3 className="text-sm font-medium mb-2">Your preferences:</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  {request.useCase && (
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded-full">
                      {USE_CASES.find((u) => u.id === request.useCase)?.label}
                    </span>
                  )}
                  {request.budget && request.budget < 9999 && (
                    <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded-full">
                      Up to ${request.budget}
                    </span>
                  )}
                  {request.priorities?.map((p) => (
                    <span key={p} className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded-full">
                      {p}
                    </span>
                  ))}
                  {request.brand && (
                    <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded-full">
                      {request.brand}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handleRecommend}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Finding your perfect phones...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Get Recommendations
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* Step 4: Results */}
          {step === 4 && result && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Your Recommendations</h2>
                <button
                  onClick={() => {
                    setStep(0);
                    setResult(null);
                    setRequest({ priorities: [], dealbreakers: [] });
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Start over
                </button>
              </div>

              <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                <MarkdownRenderer content={result} />
              </div>

              <button
                onClick={handleRecommend}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-white/5 border border-white/10 rounded-xl font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Regenerate with different criteria
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

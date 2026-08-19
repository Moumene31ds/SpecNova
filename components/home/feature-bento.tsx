"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Search, BarChart3, Radio, Zap, ArrowRight, Shield, Smartphone, TrendingUp } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Live Instant Fetch",
    description: "Not in our database? AI fetches complete specs from the web in seconds using multi-step Google Search extraction.",
    color: "#F59E0B",
    link: "/search",
    span: "md:col-span-2",
  },
  {
    icon: BarChart3,
    title: "Smart Comparison",
    description: "Side-by-side spec comparison with AI-powered winner analysis and detailed diff tables.",
    color: "#8B5CF6",
    link: "/compare",
    span: "md:col-span-1",
  },
  {
    icon: Radio,
    title: "Carrier Band Check",
    description: "Check if your phone supports all bands for your carrier. Full 5G/4G/3G band database.",
    color: "#06B6D4",
    link: "/bands",
    span: "md:col-span-1",
  },
  {
    icon: Search,
    title: "AI Semantic Search",
    description: "Search by meaning — \"best camera phone under $1000\" — not just keywords. Powered by Gemini embeddings.",
    color: "#10B981",
    link: "/search",
    span: "md:col-span-1",
  },
  {
    icon: TrendingUp,
    title: "Price Intelligence",
    description: "Track price history across retailers. Get alerts when prices drop on your wishlist phones.",
    color: "#EF4444",
    link: "/rankings",
    span: "md:col-span-1",
  },
  {
    icon: Shield,
    title: "Zero-Hallucination AI",
    description: "Every spec is cross-verified from multiple sources. If we can't confirm it, we mark it null — never guess.",
    color: "#6366F1",
    link: "/search",
    span: "md:col-span-2",
  },
];

export default function FeatureBento() {
  const router = useRouter();

  return (
    <section className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold">
            Why{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              iToPhone
            </span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            The most advanced phone intelligence platform, powered by AI
          </p>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => (
            <motion.button
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(feature.link)}
              className={`group relative p-6 bg-white/5 dark:bg-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl hover:border-white/20 transition-all duration-300 text-left overflow-hidden ${feature.span}`}
            >
              {/* Background Glow */}
              <div
                className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"
                style={{ backgroundColor: feature.color }}
              />

              <div className="relative z-10">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${feature.color}15` }}
                >
                  <feature.icon
                    className="w-6 h-6"
                    style={{ color: feature.color }}
                  />
                </div>

                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>

                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { BRAND_COLORS } from "@/lib/constants";

const BRANDS = [
  { id: "samsung", name: "Samsung", emoji: "📱", models: "Galaxy S/A/Z/F Series" },
  { id: "apple", name: "Apple", emoji: "🍎", models: "iPhone 17/16 Series" },
  { id: "google", name: "Google", emoji: "🔍", models: "Pixel 10/9 Series" },
  { id: "xiaomi", name: "Xiaomi", emoji: "🔴", models: "16/15 Series" },
  { id: "oneplus", name: "OnePlus", emoji: "🔴", models: "13/13T Series" },
  { id: "vivo", name: "vivo", emoji: "🔵", models: "X300/X200 Series" },
  { id: "oppo", name: "OPPO", emoji: "🟢", models: "Find X9/Reno Series" },
  { id: "honor", name: "Honor", emoji: "👑", models: "Magic 8/7 Series" },
  { id: "nothing", name: "Nothing", emoji: "⚪", models: "Phone 3/3a Series" },
  { id: "realme", name: "Realme", emoji: "🟡", models: "GT 7/6 Series" },
  { id: "sony", name: "Sony", emoji: "🎮", models: "Xperia 1 VII Series" },
  { id: "motorola", name: "Motorola", emoji: "📱", models: "Edge/Razr Series" },
];

export default function BrandShowcase() {
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
            All Major{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Brands
            </span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Comprehensive coverage of every major smartphone manufacturer
          </p>
        </motion.div>

        {/* Brand Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {BRANDS.map((brand, i) => {
            const brandColor = BRAND_COLORS[brand.id as keyof typeof BRAND_COLORS] ?? "#666";

            return (
              <motion.button
                key={brand.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(`/search?q=${brand.name}`)}
                className="group relative p-5 bg-white/5 dark:bg-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl hover:border-white/20 transition-all duration-300 text-left overflow-hidden"
              >
                {/* Color Glow on Hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-2xl"
                  style={{ backgroundColor: brandColor }}
                />

                <div className="relative z-10">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold mb-3 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
                  >
                    {brand.name.charAt(0)}
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">
                    {brand.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {brand.models}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

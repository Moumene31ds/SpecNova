"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const STATS = [
  { value: "200+", label: "Phones Tracked" },
  { value: "18", label: "Brands Covered" },
  { value: "100%", label: "Spec Accuracy" },
  { value: "<3s", label: "Fetch Speed" },
];

const FLOATING_PHONES = [
  { name: "Galaxy S25 Ultra", color: "#1428A0", delay: 0 },
  { name: "iPhone 17 Pro", color: "#555555", delay: 0.2 },
  { name: "Pixel 10 Pro", color: "#EA4335", delay: 0.4 },
  { name: "OnePlus 13", color: "#EB0028", delay: 0.6 },
];

export default function HeroSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-500/10 to-pink-500/20" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Floating Phone Cards */}
      {mounted && (
        <div className="absolute inset-0 pointer-events-none hidden lg:block">
          {FLOATING_PHONES.map((phone, i) => (
            <motion.div
              key={phone.name}
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 0.15, y: [0, -20, 0], scale: 1 }}
              transition={{
                opacity: { delay: phone.delay + 0.5, duration: 0.8 },
                y: { delay: phone.delay + 0.5, duration: 4, repeat: Infinity, ease: "easeInOut" },
                scale: { delay: phone.delay + 0.5, duration: 0.8 },
              }}
              className="absolute"
              style={{
                top: `${15 + i * 20}%`,
                left: i % 2 === 0 ? "5%" : "85%",
              }}
            >
              <div
                className="w-20 h-36 rounded-2xl border-2 shadow-2xl"
                style={{
                  borderColor: phone.color,
                  background: `linear-gradient(135deg, ${phone.color}20, ${phone.color}05)`,
                }}
              >
                <div className="p-2 text-center">
                  <div className="w-8 h-1 rounded-full bg-white/20 mx-auto mt-1" />
                  <p className="text-[6px] text-white/40 mt-2 font-medium">{phone.name}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Hero Content */}
      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary font-medium mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            AI-Powered Phone Intelligence
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-foreground via-foreground/80 to-foreground bg-clip-text text-transparent">
              Every Phone.
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              One Search.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Instantly fetch complete specifications for{" "}
            <span className="text-foreground font-semibold">any smartphone</span>{" "}
            using AI-powered extraction. Not in our database? We&apos;ll find it live.
          </p>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
        >
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl"
            >
              <div className="text-2xl md:text-3xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}

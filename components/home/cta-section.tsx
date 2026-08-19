"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, Zap, Search, BarChart3 } from "lucide-react";

export default function CtaSection() {
  const router = useRouter();

  return (
    <section className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative p-10 md:p-16 bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 border border-white/10 rounded-3xl text-center overflow-hidden"
        >
          {/* Background Decoration */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl" />

          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            >
              <Zap className="w-8 h-8 text-primary" />
            </motion.div>

            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Ready to Find Your{" "}
              <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Perfect Phone?
              </span>
            </h2>

            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
              Search any phone and get instant, AI-verified specifications.
              If it&apos;s not in our database, we&apos;ll fetch it live.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/search")}
                className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-base hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Search className="w-5 h-5" />
                Search Phones
                <ArrowRight className="w-5 h-5" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/compare")}
                className="px-8 py-4 bg-white/10 border border-white/20 text-foreground rounded-2xl font-semibold text-base hover:bg-white/15 transition-colors flex items-center gap-2"
              >
                <BarChart3 className="w-5 h-5" />
                Compare Now
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

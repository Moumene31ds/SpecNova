"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { useRouter } from "next/navigation";

const SHORTCUTS = [
  { key: "/", description: "Search phones" },
  { key: "c", description: "Compare" },
  { key: "r", description: "Rankings" },
  { key: "h", description: "Home" },
  { key: "?", shift: true, description: "Toggle shortcuts" },
  { key: "Escape", description: "Close" },
];

export function KeyboardShortcutsProvider({ locale }: { locale: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const shortcuts = useMemo(() => [
    { key: "/", action: () => router.push(`/${locale}/search`), description: "Search phones" },
    { key: "c", action: () => router.push(`/${locale}/compare`), description: "Compare" },
    { key: "r", action: () => router.push(`/${locale}/rankings`), description: "Rankings" },
    { key: "h", action: () => router.push(`/${locale}`), description: "Home" },
    { key: "?", shift: true, action: () => setIsOpen((v) => !v), description: "Toggle shortcuts" },
    { key: "Escape", action: () => setIsOpen(false), description: "Close" },
  ], [locale, router]);

  useKeyboardShortcuts(shortcuts);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-lg font-bold">Keyboard Shortcuts</h3>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {SHORTCUTS.map((s) => (
                  <div key={s.key + (s.shift ? "+shift" : "")} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">{s.description}</span>
                    <kbd className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-xs font-mono text-muted-foreground">
                      {s.shift && <span>Shift</span>}
                      {s.key === "/" ? "/" : s.key === "?" ? "?" : s.key}
                    </kbd>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground/50">
                Press <kbd className="rounded border border-border px-1 py-0.5 text-[10px] font-mono">Shift</kbd> + <kbd className="rounded border border-border px-1 py-0.5 text-[10px] font-mono">?</kbd> to toggle
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

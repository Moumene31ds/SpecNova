"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone, Check, ExternalLink } from "lucide-react";
import { haptic } from "@/lib/haptic";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState = "idle" | "installing" | "installed" | "dismissed";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [state, setState] = useState<InstallState>("idle");
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const wasDismissed = localStorage.getItem("itophone-install-dismissed");
    if (wasDismissed) {
      setState("dismissed");
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const animateProgress = () => {
    startTimeRef.current = performance.now();
    const totalDuration = 4000;

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const ratio = Math.min(elapsed / totalDuration, 1);
      const eased = 1 - Math.pow(1 - ratio, 3);
      const pct = Math.min(Math.round(eased * 100), 99);
      setProgress(pct);

      if (ratio < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    haptic("medium");
    setState("installing");
    setProgress(0);
    animateProgress();

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      if (outcome === "accepted") {
        setProgress(100);
        haptic("success");
        setTimeout(() => setState("installed"), 500);
      } else {
        setState("idle");
        setProgress(0);
      }
    } catch {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setState("idle");
      setProgress(0);
    }
    setDeferredPrompt(null);
  };

  const handleOpenApp = () => {
    haptic("medium");
    window.location.href = "itophone://";
  };

  const handleDismiss = () => {
    haptic("light");
    localStorage.setItem("itophone-install-dismissed", "true");
    setState("dismissed");
    setShowPrompt(false);
  };

  if (state === "dismissed" || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-24 md:bottom-8 left-4 right-4 sm:left-auto sm:right-8 sm:w-80 z-40 overflow-hidden rounded-2xl border border-border bg-background/95 backdrop-blur-xl shadow-2xl"
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 end-3 z-10 p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Progress bar - only during install */}
        {state === "installing" && (
          <div className="h-1 w-full bg-secondary/50">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0 }}
            />
          </div>
        )}

        <div className="p-4">
          {/* Idle state - Install button */}
          {state === "idle" && (
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan shadow-lg shadow-neon-violet/25">
                <Smartphone className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm">Install iToPhone</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Add to your home screen for instant access and offline support
                </p>
                <button
                  onClick={handleInstall}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-violet to-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all active:scale-95"
                >
                  <Download className="h-4 w-4" /> Install Now
                </button>
              </div>
            </div>
          )}

          {/* Installing state - Smooth progress */}
          {state === "installing" && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan">
                <Download className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm">Installing iToPhone...</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {progress < 30
                    ? "Downloading files..."
                    : progress < 60
                      ? "Extracting resources..."
                      : progress < 85
                        ? "Setting up..."
                          : "Finishing up..."}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan transition-none"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs font-semibold text-neon-cyan tabular-nums">{progress}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Installed state - Open App button ONLY here */}
          {state === "installed" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="flex items-center gap-3"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-green to-accent shadow-lg shadow-neon-green/25"
              >
                <Check className="h-5 w-5 text-white" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-neon-green">Installation Complete!</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">iToPhone is on your home screen</p>
                <button
                  onClick={handleOpenApp}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-green to-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-neon-green/25 hover:shadow-neon-green/40 transition-all active:scale-95"
                >
                  <ExternalLink className="h-4 w-4" /> Open App
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

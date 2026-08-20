"use client";

import { useState, useEffect, useCallback } from "react";
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
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const simulateProgress = useCallback(() => {
    setProgress(0);
    const steps = [
      { target: 20, delay: 100 },
      { target: 45, delay: 200 },
      { target: 70, delay: 300 },
      { target: 90, delay: 400 },
      { target: 100, delay: 200 },
    ];

    let step = 0;
    const advance = () => {
      if (step < steps.length) {
        setProgress(steps[step]!.target);
        step++;
        setTimeout(advance, steps[step - 1]!.delay);
      }
    };
    advance();
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    haptic("medium");
    setState("installing");
    simulateProgress();

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setProgress(100);
        haptic("success");
        setTimeout(() => setState("installed"), 600);
      } else {
        setState("idle");
        setProgress(0);
      }
    } catch {
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

        {/* Progress bar */}
        {(state === "installing" || state === "installed") && (
          <div className="h-1 w-full bg-secondary/50">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
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

          {/* Installing state - Progress */}
          {state === "installing" && (
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan"
              >
                <Download className="h-5 w-5 text-white" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm">Installing...</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {progress < 50 ? "Downloading..." : progress < 90 ? "Preparing..." : "Almost done..."}
                </p>
                <p className="mt-1 font-mono text-xs font-semibold text-neon-cyan">{progress}%</p>
              </div>
            </div>
          )}

          {/* Installed state - Open button */}
          {state === "installed" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15, stiffness: 300 }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-green to-accent shadow-lg shadow-neon-green/25"
              >
                <Check className="h-5 w-5 text-white" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-neon-green">Installed!</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">iToPhone is ready on your home screen</p>
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

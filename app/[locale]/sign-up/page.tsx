"use client";

import * as React from "react";
import { Suspense, useState, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { Loader2, Lock, Mail, Eye, EyeOff, AlertCircle, CheckCircle2, Zap, Sparkles, Shield, ArrowRight, User } from "lucide-react";

import { getFirebaseClient, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { initializeAppCheckForApp } from "@/lib/firebase/app-check";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { ParticleField, GlowingOrbs, GlassCard } from "@/components/auth/auth-canvas";

function SignUpForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const commonT = useTranslations("common");
  const validationT = useTranslations("validation");
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? `/${locale}`;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "busy" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [inputErrors, setInputErrors] = useState<{ name?: string; email?: string; password?: string; confirm?: string }>({});
  const formRef = useRef<HTMLFormElement>(null);

  const validateEmail = (value: string) => {
    if (!value) return validationT("required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return validationT("email");
    return undefined;
  };

  const validatePassword = (value: string) => {
    if (!value) return validationT("required");
    if (value.length < 8) return validationT("minLength", { min: 8 });
    return undefined;
  };

  const validateConfirm = (value: string) => {
    if (!value) return validationT("required");
    if (value !== password) return t("passwordMismatch");
    return undefined;
  };

  async function getAppCheckToken(): Promise<string | undefined> {
    try {
      const { app } = getFirebaseClient();
      const appCheck = initializeAppCheckForApp(app);
      if (!appCheck) return undefined;
      const { getLimitedUseToken } = await import("firebase/app-check");
      return (await getLimitedUseToken(appCheck)).token;
    } catch {
      return undefined;
    }
  }

  async function createSession(): Promise<boolean> {
    const { auth } = getFirebaseClient();
    const user = auth.currentUser;
    if (!user) return false;
    const idToken = await user.getIdToken(true);
    const appCheckToken = await getAppCheckToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    };
    if (appCheckToken) headers["X-Firebase-AppCheck"] = appCheckToken;

    const res = await fetch("/api/session", { method: "POST", headers, cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as { success?: boolean };
    if (!res.ok || !body.success) {
      throw new Error(`${res.status}: session`);
    }
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const nameErr = name.trim() ? undefined : validationT("required");
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    const confirmErr = validateConfirm(confirmPassword);
    if (emailErr || passwordErr || confirmErr || nameErr) {
      setInputErrors({ name: nameErr, email: emailErr, password: passwordErr, confirm: confirmErr });
      formRef.current?.classList.add("animate-shake");
      setTimeout(() => formRef.current?.classList.remove("animate-shake"), 400);
      return;
    }

    setInputErrors({});
    setStatus("busy");

    if (!isFirebaseClientConfigured()) {
      setStatus("error");
      setError(t("notConfigured"));
      return;
    }

    try {
      const { auth } = getFirebaseClient();
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) {
        await updateProfile(user, { displayName: name.trim() }).catch(() => undefined);
      }

      const sessionOk = await createSession();
      if (!sessionOk) {
        throw new Error("Session could not be established.");
      }

      setStatus("success");
      setTimeout(() => {
        router.replace(redirectTo);
        router.refresh();
      }, 700);
    } catch (err) {
      const code = err instanceof Error && "code" in err ? (err as { code: string }).code : undefined;
      setStatus("error");
      setError(
        code === "auth/email-already-in-use"
          ? t("emailInUse")
          : code === "auth/weak-password"
            ? t("weakPassword")
            : err instanceof Error && /^\d+: session$/.test(err.message)
              ? t("sessionFailed")
              : err instanceof Error
                ? err.message
                : t("error"),
      );
      formRef.current?.classList.add("animate-shake");
      setTimeout(() => formRef.current?.classList.remove("animate-shake"), 400);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative w-full max-w-md"
    >
      <GlassCard className="overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-violet/5 via-transparent to-neon-cyan/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-neon-violet/10" />

        <div className="relative z-10 p-8 md:p-10">
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
              className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-violet to-neon-cyan shadow-[0_0_40px_hsl(var(--glow-primary)/0.5)] mb-6"
            >
              <Sparkles className="h-8 w-8 text-white" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="font-display text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-primary to-neon-cyan bg-clip-text text-transparent"
            >
              {t("signUpTitle")}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-2 text-muted-foreground"
            >
              {t("signUpSubtitle")}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mb-6 flex items-center justify-center gap-4 text-xs text-muted-foreground/70"
          >
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-neon-cyan" />
              Firebase Auth
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-neon-violet" />
              App Check
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Free
            </span>
          </motion.div>

          <AnimatePresence mode="wait">
            {status === "success" && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <p className="text-sm font-medium text-green-500">{t("accountCreated")}</p>
                </div>
              </motion.div>
            )}
            {status === "error" && error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.55 }}
              className={cn("relative", inputErrors.name && "animate-shake")}
            >
              <label htmlFor="name" className="sr-only">{t("name")}</label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                  <User className="h-5 w-5" />
                </div>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder={t("namePlaceholder")}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (inputErrors.name) setInputErrors((prev) => ({ ...prev, name: e.target.value.trim() ? undefined : validationT("required") }));
                  }}
                  className={cn(
                    "peer h-12 w-full rounded-xl bg-background/50 border border-border/50 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 transition-all duration-200",
                    "focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30",
                    inputErrors.name && "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/30",
                  )}
                />
              </div>
              {inputErrors.name && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs text-red-400">
                  {inputErrors.name}
                </motion.p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className={cn("relative", inputErrors.email && "animate-shake")}
            >
              <label htmlFor="email" className="sr-only">{t("email")}</label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (inputErrors.email) setInputErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
                  }}
                  className={cn(
                    "peer h-12 w-full rounded-xl bg-background/50 border border-border/50 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 transition-all duration-200",
                    "focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30",
                    inputErrors.email && "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/30",
                  )}
                />
              </div>
              {inputErrors.email && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs text-red-400">
                  {inputErrors.email}
                </motion.p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.65 }}
              className={cn("relative", inputErrors.password && "animate-shake")}
            >
              <label htmlFor="password" className="sr-only">{t("password")}</label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (inputErrors.password || inputErrors.confirm) {
                      setInputErrors((prev) => ({
                        ...prev,
                        password: validatePassword(e.target.value),
                        confirm: prev.confirm ? t("passwordMismatch") : undefined,
                      }));
                    }
                  }}
                  className={cn(
                    "peer h-12 w-full rounded-xl bg-background/50 border border-border/50 pl-12 pr-12 text-foreground placeholder:text-muted-foreground/50 transition-all duration-200",
                    "focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30",
                    inputErrors.password && "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/30",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-foreground"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {inputErrors.password && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs text-red-400">
                  {inputErrors.password}
                </motion.p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.7 }}
              className={cn("relative", inputErrors.confirm && "animate-shake")}
            >
              <label htmlFor="confirm" className="sr-only">{t("confirmPassword")}</label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder={t("confirmPasswordPlaceholder")}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (inputErrors.confirm) setInputErrors((prev) => ({ ...prev, confirm: validateConfirm(e.target.value) }));
                  }}
                  className={cn(
                    "peer h-12 w-full rounded-xl bg-background/50 border border-border/50 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 transition-all duration-200",
                    "focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30",
                    inputErrors.confirm && "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/30",
                  )}
                />
              </div>
              {inputErrors.confirm && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs text-red-400">
                  {inputErrors.confirm}
                </motion.p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.75 }}
            >
              <motion.button
                type="submit"
                disabled={status === "busy"}
                whileHover={{ scale: status === "busy" ? 1 : 1.02 }}
                whileTap={{ scale: status === "busy" ? 1 : 0.98 }}
                className="group relative mt-2 flex w-full items-center justify-center overflow-hidden rounded-xl h-12 bg-gradient-to-r from-neon-cyan via-primary to-neon-violet bg-[length:200%_100%] bg-left hover:bg-right text-primary-foreground font-semibold shadow-[0_0_30px_hsl(var(--glow-primary)/0.4)] transition-[background-position] duration-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {status === "busy" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : status === "success" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                  <span>{status === "busy" ? t("signingUp") : status === "success" ? t("accountCreated") : t("signUpButton")}</span>
                </span>
                {status !== "busy" && status !== "success" && (
                  <ArrowRight className="h-4 w-4 ml-2 text-primary-foreground/70 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan to-neon-violet opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </motion.button>
            </motion.div>
          </form>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
            className="mt-6 text-center text-sm text-muted-foreground"
          >
            {t("alreadyHaveAccount")}{" "}
            <Link
              href={`/${locale}/sign-in`}
              className="font-medium text-primary hover:underline transition-colors"
            >
              {t("signInLink")}
            </Link>
          </motion.p>
        </div>
      </GlassCard>

      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 1, ease: [0.68, -0.55, 0.27, 1.55] }}
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan blur-md opacity-60"
        aria-hidden="true"
      />
    </motion.div>
  );
}

export default function SignUpPage() {
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden">
      <ParticleField />
      <GlowingOrbs />
      <div className="relative z-10 w-full max-w-md">
        <Suspense fallback={
          <div className="flex h-96 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-3 border-neon-cyan/30 border-t-neon-cyan" />
          </div>
        }>
          <SignUpForm locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Suspense, useState, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Loader2, Lock, Mail, Eye, EyeOff, AlertCircle, CheckCircle2, Zap, Sparkles, Shield, ArrowRight } from "lucide-react";

import { getFirebaseClient } from "@/lib/firebase/client";
import { initializeAppCheckForApp } from "@/lib/firebase/app-check";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { ParticleField, GlowingOrbs, GlassCard } from "@/components/auth/auth-canvas";

function SignInForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const commonT = useTranslations("common");
  const validationT = useTranslations("validation");
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? `/${locale}/admin`;
  const mfaRequired = params.get("mfa") === "required";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "busy" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [inputErrors, setInputErrors] = useState<{ email?: string; password?: string }>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    if (emailErr || passwordErr) {
      setInputErrors({ email: emailErr, password: passwordErr });
      formRef.current?.classList.add("animate-shake");
      setTimeout(() => formRef.current?.classList.remove("animate-shake"), 400);
      return;
    }

    setInputErrors({});
    setStatus("busy");

    try {
      const { auth } = getFirebaseClient();
      const { user } = await signInWithEmailAndPassword(auth, email, password);
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
        throw new Error(body.success === false ? "Session could not be established." : "Login failed.");
      }

      setStatus("success");
      setTimeout(() => {
        router.replace(redirectTo);
        router.refresh();
      }, 600);
    } catch (err) {
      const message =
        err instanceof Error && "code" in err
          ? (err as { code: string }).code
          : undefined;
      setStatus("error");
      setError(
        message === "auth/invalid-credential"
          ? t("invalidCredentials")
          : message === "auth/user-disabled"
            ? t("accountLocked")
            : err instanceof Error
              ? err.message
              : t("error"),
      );
      formRef.current?.classList.add("animate-shake");
      setTimeout(() => formRef.current?.classList.remove("animate-shake"), 400);
    }
  }

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (inputErrors.email) setInputErrors((prev) => ({ ...prev, email: validateEmail(value) }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (inputErrors.password) setInputErrors((prev) => ({ ...prev, password: validatePassword(value) }));
  };

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
              {t("signInTitle")}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-2 text-muted-foreground"
            >
              {t("signInSubtitle")}
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
              HttpOnly Cookies
            </span>
          </motion.div>

          <AnimatePresence mode="wait">
            {mfaRequired && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-400">{t("mfaRequired")}</p>
                    <p className="mt-1 text-sm text-amber-500/80">{t("mfaDescription")}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className={cn("relative", inputErrors.email && "animate-shake")}
            >
              <label htmlFor="email" className="sr-only">
                {t("email")}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors duration-200 peer-focus-within:text-neon-cyan">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  ref={emailRef}
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={() => setInputErrors((prev) => ({ ...prev, email: validateEmail(email) }))}
                  className={cn(
                    "peer h-12 w-full rounded-xl bg-background/50 border border-border/50 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 transition-all duration-200",
                    "focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30",
                    "hover:border-border",
                    inputErrors.email && "border-destructive/50 focus:border-destructive focus:ring-destructive/20",
                    status === "success" && "border-green-500/50"
                  )}
                  disabled={status === "busy"}
                  aria-invalid={inputErrors.email ? "true" : "false"}
                  aria-describedby={inputErrors.email ? "email-error" : undefined}
                />
                {inputErrors.email && (
                  <motion.span
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    id="email-error"
                    className="absolute -bottom-5 left-4 text-xs text-destructive"
                    role="alert"
                  >
                    {inputErrors.email}
                  </motion.span>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.7 }}
              className={cn("relative", inputErrors.password && "animate-shake")}
            >
              <label htmlFor="password" className="sr-only">
                {t("password")}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors duration-200 peer-focus-within:text-neon-cyan">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  onBlur={() => setInputErrors((prev) => ({ ...prev, password: validatePassword(password) }))}
                  className={cn(
                    "peer h-12 w-full rounded-xl bg-background/50 border border-border/50 pl-12 pr-12 text-foreground placeholder:text-muted-foreground/50 transition-all duration-200",
                    "focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30",
                    "hover:border-border",
                    inputErrors.password && "border-destructive/50 focus:border-destructive focus:ring-destructive/20",
                    status === "success" && "border-green-500/50"
                  )}
                  disabled={status === "busy"}
                  aria-invalid={inputErrors.password ? "true" : "false"}
                  aria-describedby={inputErrors.password ? "password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
                {inputErrors.password && (
                  <motion.span
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    id="password-error"
                    className="absolute -bottom-5 left-4 text-xs text-destructive"
                    role="alert"
                  >
                    {inputErrors.password}
                  </motion.span>
                )}
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              {error && status !== "busy" && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={status === "busy" || status === "success"}
              whileHover={{ scale: status === "busy" || status === "success" ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.8 }}
              className={cn(
                "relative overflow-hidden w-full h-12 rounded-xl font-medium text-base transition-all",
                "bg-gradient-to-r from-neon-violet to-neon-cyan text-white shadow-[0_0_30px_hsl(var(--glow-primary)/0.4)]",
                "hover:shadow-[0_0_45px_hsl(var(--glow-primary)/0.6)]",
                "focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:ring-offset-2 focus:ring-offset-background",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                status === "success" && "bg-gradient-to-r from-green-500 to-emerald-500"
              )}
            >
              <span className="relative flex h-full items-center justify-center gap-2">
                {status === "busy" && (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                )}
                {status === "success" && <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                <span>{status === "busy" ? t("signingIn") : status === "success" ? "Success!" : t("signInButton")}</span>
                {status !== "busy" && status !== "success" && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan to-neon-violet opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </motion.button>
          </form>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
            className="mt-6 text-center text-sm text-muted-foreground"
          >
            {commonT("noAccount")}{" "}
            <Link
              href={`/${locale}/sign-up`}
              className="font-medium text-primary hover:underline transition-colors"
            >
              {commonT("createAccount")}
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

export default function SignInPage() {
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
          <SignInForm locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
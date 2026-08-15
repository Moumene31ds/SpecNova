"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInWithEmailAndPassword,
} from "firebase/auth";
import Link from "next/link";
import { Loader2, Lock, Mail } from "lucide-react";

import { getFirebaseClient } from "@/lib/firebase/client";
import { initializeAppCheckForApp } from "@/lib/firebase/app-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "/admin";
  const mfaRequired = params.get("mfa") === "required";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

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
    setStatus("busy");
    setError(null);

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

      // The Edge middleware intercepts /api/session (the configured
      // `loginPath`) and exchanges the ID token for the HttpOnly session
      // cookie, returning { success: true } with Set-Cookie headers.
      const res = await fetch("/api/session", { method: "POST", headers, cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { success?: boolean };
      if (!res.ok || !body.success) {
        throw new Error(body.success === false ? "Session could not be established." : "Login failed.");
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error && "code" in err
          ? (err as { code: string }).code
          : undefined;
      setStatus("error");
      setError(
        message === "auth/invalid-credential"
          ? "Invalid email or password."
          : err instanceof Error
            ? err.message
            : "Something went wrong.",
      );
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="font-display text-xl tracking-tight">
          SpecNova <span className="text-primary">Admin</span>
        </CardTitle>
        <CardDescription>Staff sign-in — protected by Firebase Auth + App Check.</CardDescription>
      </CardHeader>
      <CardContent>
        {mfaRequired ? (
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            This workspace requires an Authenticator (TOTP) second factor. Enable MFA on your
            account in the Firebase console, then sign in again.
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              required
              autoComplete="email"
              placeholder="you@specnova.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 pl-9"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pl-9"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full h-11" disabled={status === "busy"}>
            {status === "busy" ? <Loader2 className="size-4 animate-spin" /> : null}
            {status === "busy" ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Don&apos;t have a staff account?{" "}
          <Link href="/" className="text-primary underline">
            Back to SpecNova
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </div>
  );
}

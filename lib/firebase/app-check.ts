"use client";

import type { FirebaseApp } from "firebase/app";
import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
  setTokenAutoRefreshEnabled,
  type AppCheck,
} from "firebase/app-check";

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  }
}

let appCheck: AppCheck | null = null;

/**
 * Client-side Firebase App Check, hardened with reCAPTCHA Enterprise.
 *
 * During local development the SDK auto-discovers the debug token set in
 * the JS console: `FIREBASE_APPCHECK_DEBUG_TOKEN=true` in DevTools.
 *
 * IMPORTANT: App Check requires a reCAPTCHA Enterprise key attached to the
 * Firebase project (Security > App Check > Apps). Requests without a valid
 * token are rejected by Firestore before any rule evaluation runs.
 */
export function initializeAppCheckForApp(app: FirebaseApp): AppCheck | null {
  if (appCheck) return appCheck;
  if (typeof window === "undefined") return null;

  if (window.FIREBASE_APPCHECK_DEBUG_TOKEN) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (!siteKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[specnova] NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY missing — App Check disabled.",
      );
    }
    return null;
  }

  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });

  setTokenAutoRefreshEnabled(appCheck, true);
  return appCheck;
}

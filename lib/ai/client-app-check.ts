"use client";

import { getFirebaseClient } from "@/lib/firebase/client";
import { initializeAppCheckForApp } from "@/lib/firebase/app-check";

/**
 * Best-effort App Check token for server actions. Returns undefined when App
 * Check isn't configured (reCAPTCHA Enterprise key missing) — the server
 * actions then skip enforcement transparently.
 */
export async function getClientAppCheckToken(): Promise<string | undefined> {
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

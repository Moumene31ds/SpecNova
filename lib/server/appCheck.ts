import "server-only";

import { createPrivateKey, createSign } from "node:crypto";
import { SERVICE_ACCOUNT } from "@/lib/firebase/admin";

/**
 * Server-side Firebase App Check assertion verification.
 *
 * Clients send their App Check token in the `x-firebase-appcheck` header
 * (see `components/security/app-check-provider.tsx`). This module validates
 * it against Firebase App Check's `verifyAssertion` REST API using a
 * short-lived Google OAuth2 access token minted from the service account.
 *
 * Enforcement is best-effort: when the project isn't wired for App Check
 * (no reCAPTCHA Enterprise key / no service account) verification is skipped
 * and `enforced` is false so development keeps working.
 */

interface AppCheckResult {
  /** The token was cryptographically verified by Firebase. */
  verified: boolean;
  /** A verification was actually attempted (App Check configured). */
  enforced: boolean;
  error?: string;
}

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
const APP_ID = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }
  if (!SERVICE_ACCOUNT) throw new Error("No service account configured.");

  const privateKey = createPrivateKey(SERVICE_ACCOUNT.privateKey);
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: SERVICE_ACCOUNT.clientEmail,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const encode = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${encode(header)}.${encode(claims)}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(privateKey, "base64url");
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OAuth token ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

export async function verifyAppCheckToken(
  token: string | null | undefined,
): Promise<AppCheckResult> {
  if (!token) return { verified: false, enforced: false, error: "Missing token" };
  if (!PROJECT_ID || !APP_ID || !SERVICE_ACCOUNT) {
    return { verified: false, enforced: false };
  }

  try {
    const accessToken = await getAccessToken();
    const res = await fetch(
      `https://appcheck.googleapis.com/v1beta/projects/${encodeURIComponent(
        PROJECT_ID,
      )}/apps/${encodeURIComponent(APP_ID)}:verifyAssertion`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ appCheckToken: token }),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const text = await res.text();
      return { verified: false, enforced: true, error: `verifyAssertion ${res.status}: ${text}` };
    }
    const data = (await res.json()) as { verified?: boolean };
    return { verified: data.verified === true, enforced: true };
  } catch (err) {
    return {
      verified: false,
      enforced: true,
      error: err instanceof Error ? err.message : "App Check verification failed",
    };
  }
}

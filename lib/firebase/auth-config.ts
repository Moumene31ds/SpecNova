import type { ServiceAccount } from "./admin";

/**
 * Shared authentication config consumed by both the Edge middleware and
 * server-side token helpers (`next-firebase-auth-edge`).
 *
 * `cookieSignatureKeys` must be a cryptographically-random, stable secret
 * (≥32 bytes) shared by every runtime instance. Generate once:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
export const authConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  cookieName: "SpecNovaAuthToken",
  cookieSignatureKeys: [
    process.env.COOKIE_SIGNATURE_KEY_CURRENT ?? process.env.COOKIE_SIGNATURE_KEY ?? "",
  ],
  cookieSerializeOptions: {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60, // 12h sliding session
  },
  serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? (JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) as ServiceAccount)
    : undefined,
};

export function isAuthConfigValid() {
  return Boolean(
    authConfig.apiKey &&
      authConfig.cookieSignatureKeys[0] &&
      authConfig.serviceAccount,
  );
}

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
  cookieName: "ITOPhoneAuthToken",
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
  serviceAccount: (() => {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, "\n"),
      };
    } catch {
      return undefined;
    }
  })(),
};

export function isAuthConfigValid() {
  return Boolean(
    authConfig.apiKey &&
      authConfig.cookieSignatureKeys[0] &&
      authConfig.serviceAccount,
  );
}

import "server-only";

import { cookies } from "next/headers";
import { getTokens, getFirebaseAuth, type Tokens } from "next-firebase-auth-edge";
import { isAuthConfigValid, authConfig } from "./auth-config";

export { isAuthConfigValid };

/** Reads the signed session cookie and returns Firebase ID-token claims (or null). */
export async function getServerTokens(): Promise<Tokens | null> {
  if (!isAuthConfigValid()) return null;
  try {
    const cookieStore = await cookies();
    return await getTokens(cookieStore, authConfig);
  } catch {
    return null;
  }
}

/** Convenience: current authenticated user's decoded claims, or null. */
export async function getServerUser() {
  const tokens = await getServerTokens();
  if (!tokens?.decodedToken) return null;
  const { uid, email, name, picture, email_verified } = tokens.decodedToken;
  return { uid, email, name, picture, emailVerified: email_verified };
}

/**
 * Firebase Auth handle for server-side token verification & user management.
 * Signature (v1.12): getFirebaseAuth(serviceAccount, apiKey, tenantId?).
 */
export const firebaseAuth = isAuthConfigValid()
  ? getFirebaseAuth(authConfig.serviceAccount!, authConfig.apiKey)
  : null;

import "server-only";

import { headers as nextHeaders } from "next/headers";
import { getServerTokens } from "@/lib/firebase/auth";
import { parseRoles, type AdminRoles } from "@/lib/firebase/roles";
import { AppError } from "./errors";

/**
 * iToPhone Admin RBAC — enforced on every privileged server action / route.
 *
 * Custom claims are provisioned via `app/api/admin/bootstrap/route.ts`
 * (or the Firebase console) into the ID token and mirrored into the session
 * cookie by `next-firebase-auth-edge`. Claim shape (set on the Auth record):
 *
 *   admin: true          -> full access (devices, pricing, deletes, users)
 *   editor: true         -> spec editing + autofill only (no deletes/pricing)
 *
 * The `admin` claim is also what Firestore Security Rules trust for admin
 * writes (see functions/firestore.rules).
 */

export type AdminRole = "admin" | "editor";

export interface AdminContext {
  uid: string;
  email: string | null;
  roles: AdminRoles;
  /** True when the signed-in session was completed with TOTP second factor. */
  mfaVerified: boolean;
  clientIp: string;
  userAgent: string;
}

/** Best-effort client IP from the standard proxy chain. */
export async function getClientIp(): Promise<string> {
  const h = await nextHeaders();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return (
    h.get("x-real-ip") ??
    h.get("cf-connecting-ip") ??
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function getClientUserAgent(): Promise<string> {
  return (await nextHeaders()).get("user-agent") ?? "unknown";
}

/**
 * Resolve the authenticated admin context. Throws `AppError("UNAUTHORIZED")`
 * when the session is missing and `AppError("FORBIDDEN")` when the account
 * holds no admin/editor role.
 */
export async function getAdminContext(opts: { require?: AdminRole } = {}): Promise<AdminContext> {
  const tokens = await getServerTokens();
  const claims = tokens?.decodedToken;
  if (!claims?.uid) throw new AppError("UNAUTHORIZED", "Sign in to continue.");

  const roles = parseRoles(claims as unknown as Record<string, unknown>);
  const require = opts.require ?? "editor";

  if (require === "admin" && !roles.isAdmin) {
    throw new AppError("FORBIDDEN", "Admin access required for this operation.");
  }
  if (require === "editor" && !roles.isEditor) {
    throw new AppError("FORBIDDEN", "Editor access required for this operation.");
  }

  const firebase = (claims as unknown as { firebase?: { sign_in_second_factor?: string } })
    .firebase;
  const mfaVerified =
    firebase?.sign_in_second_factor === "totp" ||
    firebase?.sign_in_second_factor === "sms";

  return {
    uid: claims.uid,
    email: claims.email ?? null,
    roles,
    mfaVerified,
    clientIp: await getClientIp(),
    userAgent: await getClientUserAgent(),
  };
}

/** Convenience: throws unless the caller is a full admin. */
export async function requireAdmin(): Promise<AdminContext> {
  return getAdminContext({ require: "admin" });
}

/** Convenience: throws unless the caller is an admin or editor. */
export async function requireEditor(): Promise<AdminContext> {
  return getAdminContext({ require: "editor" });
}

import { NextResponse } from "next/server";
import { firebaseAuth, getServerTokens } from "@/lib/firebase/auth";
import { writeAuditLog } from "@/lib/server/auditLog";

/**
 * One-time RBAC bootstrap.
 *
 * Grants full admin claims to the first authenticated user whose email
 * matches the `ADMIN_BOOTSTRAP_EMAIL` environment variable. The endpoint is
 * disabled (404) until that variable is set, and it only ever promotes the
 * caller's own account — never an arbitrary email.
 *
 * After a successful promotion the user must re-authenticate (or re-issue
 * their ID token) for the claims to reach the session cookie.
 *
 * For day-to-day role management, use the Firebase console
 * (Authentication → Users → Set custom claims) with this claim shape:
 *   { admin: true, editor: true, roles: { admin: true, editor: true } }
 */
export async function POST() {
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!bootstrapEmail) {
    return NextResponse.json(
      { error: "Bootstrap is not enabled (ADMIN_BOOTSTRAP_EMAIL is not set)." },
      { status: 404 },
    );
  }
  if (!firebaseAuth) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 500 });
  }

  const tokens = await getServerTokens();
  const email = tokens?.decodedToken?.email?.trim().toLowerCase();
  const uid = tokens?.decodedToken?.uid;
  if (!uid || !email || email !== bootstrapEmail) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  await firebaseAuth.setCustomUserClaims(uid, {
    admin: true,
    editor: true,
    roles: { admin: true, editor: true },
  });

  await writeAuditLog({
    action: "admin.bootstrap",
    resourceType: "user",
    resourceId: uid,
    severity: "critical",
    actorUid: uid,
    actorEmail: email,
    note: "Account promoted to admin via bootstrap endpoint.",
  });

  return NextResponse.json({
    ok: true,
    message: "Admin claims set. Sign out and back in to pick them up.",
  });
}

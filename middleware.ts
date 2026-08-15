import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "next-firebase-auth-edge";
import { authConfig, isAuthConfigValid } from "@/lib/firebase/auth-config";
import { hasAdminClaim, hasEditorClaim } from "@/lib/firebase/roles";

/**
 * Edge middleware.
 *
 * 1. Session management — verifies the signed session cookie, refreshes
 *    near-expiry ID tokens, and stamps `x-firebase-uid` / `x-firebase-email`
 *    for downstream server actions & routes. The `loginPath` (`/api/session`)
 *    and `logoutPath` (`/api/signout`) endpoints exchange the Firebase ID
 *    token for an HttpOnly session cookie.
 *
 * 2. Admin guard — requests under `/admin/*` require a verified session whose
 *    custom claims include `admin` or `editor`:
 *      - anonymous / invalid token  -> redirect to `/sign-in?redirect=...`
 *      - signed in but no role      -> redirect to `/`
 *      - admin with MFA enforcement -> optional `REQUIRE_ADMIN_MFA=true`
 *        blocks sessions that were not completed with a TOTP second factor.
 *
 * Data access itself is still enforced by Firestore Security Rules + App Check.
 */

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function signInRedirect(request: NextRequest) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  if (!isAuthConfigValid()) return NextResponse.next();

  const requestPath = request.nextUrl.pathname;

  return authMiddleware(request, {
    serviceAccount: authConfig.serviceAccount,
    apiKey: authConfig.apiKey,
    cookieName: authConfig.cookieName,
    cookieSignatureKeys: authConfig.cookieSignatureKeys,
    cookieSerializeOptions: authConfig.cookieSerializeOptions,
    loginPath: "/api/session",
    logoutPath: "/api/signout",
    debug: process.env.NODE_ENV !== "production",
    handleValidToken: async ({ decodedToken }, extraHeaders) => {
      const headers = new Headers(extraHeaders);
      headers.set("x-firebase-uid", decodedToken.uid ?? "");
      headers.set("x-firebase-email", decodedToken.email ?? "");

      if (isAdminPath(requestPath)) {
        const claims = decodedToken as unknown as Record<string, unknown>;
        const isStaff = hasAdminClaim(claims) || hasEditorClaim(claims);
        if (!isStaff) {
          return NextResponse.redirect(new URL("/", request.url));
        }

        if (process.env.REQUIRE_ADMIN_MFA === "true") {
          const firebase = (claims.firebase as { sign_in_second_factor?: string }) ?? {};
          const mfaVerified =
            firebase.sign_in_second_factor === "totp" ||
            firebase.sign_in_second_factor === "sms";
          if (!mfaVerified) {
            const url = new URL("/sign-in", request.url);
            url.searchParams.set("mfa", "required");
            url.searchParams.set("redirect", request.nextUrl.pathname);
            return NextResponse.redirect(url);
          }
        }
      }

      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async () => {
      if (isAdminPath(requestPath)) return signInRedirect(request);
      return NextResponse.next();
    },
    handleError: async () => {
      if (isAdminPath(requestPath)) return signInRedirect(request);
      return NextResponse.next();
    },
  });
}

export const config = {
  matcher: [
    // Run on every route except static assets & framework files.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|avif|woff2?|ico|mp4)$).*)",
  ],
};

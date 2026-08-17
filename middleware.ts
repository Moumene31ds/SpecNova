import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "next-firebase-auth-edge";
import { authConfig, isAuthConfigValid } from "@/lib/firebase/auth-config";
import { hasAdminClaim, hasEditorClaim } from "@/lib/firebase/roles";
import { locales, defaultLocale } from "@/lib/i18n";

function isAdminPath(pathname: string) {
  const pathWithoutLocale = stripLocale(pathname);
  return pathWithoutLocale === "/admin" || pathWithoutLocale.startsWith("/admin/");
}

function stripLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || "/";
    }
  }
  return pathname;
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function hasLocalePrefix(pathname: string): boolean {
  return locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
}

function getLocaleFromRequest(request: NextRequest): string {
  const pathname = request.nextUrl.pathname;
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  for (const locale of locales) {
    if (acceptLanguage.startsWith(locale)) return locale;
  }
  return defaultLocale;
}

function ensureLocaleRedirect(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const locale = getLocaleFromRequest(request);
  const url = new URL(`/${locale}${pathname === "/" ? "" : pathname}`, request.url);
  url.search = request.nextUrl.search;
  return NextResponse.redirect(url);
}

function signInRedirect(request: NextRequest) {
  const locale = getLocaleFromRequest(request);
  const url = new URL(`/${locale}/sign-in`, request.url);
  url.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isApiRoute(pathname)) {
    if (!isAuthConfigValid()) return NextResponse.next();

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
        return NextResponse.next({ request: { headers } });
      },
      handleInvalidToken: async () => NextResponse.next(),
      handleError: async () => NextResponse.next(),
    });
  }

  if (!hasLocalePrefix(pathname)) {
    return ensureLocaleRedirect(request);
  }

  if (!isAuthConfigValid()) {
    return NextResponse.next();
  }

  const requestPath = pathname;

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
          return NextResponse.redirect(new URL(`/${getLocaleFromRequest(request)}/`, request.url));
        }

        if (process.env.REQUIRE_ADMIN_MFA === "true") {
          const firebase = (claims.firebase as { sign_in_second_factor?: string }) ?? {};
          const mfaVerified =
            firebase.sign_in_second_factor === "totp" ||
            firebase.sign_in_second_factor === "sms";
          if (!mfaVerified) {
            const locale = getLocaleFromRequest(request);
            const url = new URL(`/${locale}/sign-in`, request.url);
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
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|svg|webp|avif|woff2?|ico|mp4)$).*)",
  ],
};

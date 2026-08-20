"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, type User } from "firebase/auth";
import { LogOut, Shield, UserCircle2, Loader2, LayoutDashboard } from "lucide-react";
import { useTranslations } from "next-intl";
import { getFirebaseClient, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { parseRoles } from "@/lib/firebase/roles";
import { getLocaleFromPathname } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

function getLocalizedHref(locale: string, path: string): string {
  if (path === "/") return `/${locale}`;
  return `/${locale}${path}`;
}

export function UserMenu() {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);

  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [signingOut, setSigningOut] = React.useState(false);
  const [isStaff, setIsStaff] = React.useState(false);

  React.useEffect(() => {
    if (!isFirebaseClientConfigured()) {
      setLoading(false);
      return;
    }
    const { auth } = getFirebaseClient();
    const unsubscribe = auth.onAuthStateChanged(async (next) => {
      setUser(next);
      if (next) {
        try {
          const tokenResult = await next.getIdTokenResult(true);
          setIsStaff(parseRoles(tokenResult.claims as Record<string, unknown>).isAdmin || parseRoles(tokenResult.claims as Record<string, unknown>).isEditor);
        } catch {
          setIsStaff(false);
        }
      } else {
        setIsStaff(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = React.useCallback(async () => {
    const { auth } = getFirebaseClient();
    setSigningOut(true);
    try {
      await signOut(auth);
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }, [router]);

  const email = user?.email ?? user?.providerData?.[0]?.email;
  const displayName = user?.displayName;
  const initial = (displayName ?? email ?? "U").charAt(0).toUpperCase();

  if (loading) {
    return (
      <Button variant="ghost" size="icon" className="h-11 w-11" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (!user) {
    return (
      <Link
        href={getLocalizedHref(locale, "/sign-in")}
        aria-label={t("signIn")}
        className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <UserCircle2 className="h-5 w-5" />
      </Link>
    );
  }

  const photoURL = user.photoURL;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={displayName ?? email ?? "Account"}
          className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border overflow-hidden shadow-[0_0_16px_hsl(var(--glow-primary)/0.35)] transition-transform hover:scale-105"
        >
          {photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoURL}
              alt={displayName ?? "Avatar"}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neon-violet to-neon-cyan text-sm font-bold text-white">
              {initial}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {displayName ?? "iToPhone user"}
            </span>
            {user.providerData?.[0]?.providerId === "google.com" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
              </span>
            )}
          </div>
          {email && (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={getLocalizedHref(locale, "/compare")} className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("compare")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={getLocalizedHref(locale, "/search")} className="flex items-center gap-2">
            <UserCircle2 className="h-4 w-4" />
            {t("aiSearch")}
          </Link>
        </DropdownMenuItem>
        {isStaff && (
          <>
            <DropdownMenuItem asChild>
              <Link href={getLocalizedHref(locale, "/admin")} className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                {t("adminDashboard")}
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleSignOut();
          }}
          disabled={signingOut}
          className="flex items-center gap-2 text-destructive focus:text-destructive"
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

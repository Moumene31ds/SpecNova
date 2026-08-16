"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, type User } from "firebase/auth";
import { LogOut, Shield, UserCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { getFirebaseClient } from "@/lib/firebase/client";
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

  React.useEffect(() => {
    const { auth } = getFirebaseClient();
    const unsubscribe = auth.onAuthStateChanged((next) => {
      setUser(next);
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
      <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (!user) {
    return (
      <Link
        href={getLocalizedHref(locale, "/sign-in")}
        aria-label={t("signIn")}
        className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <UserCircle2 className="h-5 w-5" />
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={displayName ?? email ?? "Account"}
          className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-gradient-to-br from-neon-violet to-neon-cyan text-sm font-bold text-white shadow-[0_0_16px_hsl(var(--glow-primary)/0.35)] transition-transform hover:scale-105"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">
            {displayName ?? "SpecNova user"}
          </span>
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

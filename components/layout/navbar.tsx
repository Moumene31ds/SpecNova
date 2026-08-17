"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Globe, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { locales, localeNames, defaultLocale } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme/theme-provider";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";

function getLocaleFromPathname(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return defaultLocale;
}

function getPathWithoutLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || "/";
    }
  }
  return pathname;
}

function getLocalizedHref(locale: string, path: string): string {
  if (path === "/") return `/${locale}`;
  return `/${locale}${path}`;
}

export function Navbar() {
  const pathname = usePathname();
  const currentLocale = getLocaleFromPathname(pathname);
  const pathWithoutLocale = getPathWithoutLocale(pathname);
  const t = useTranslations("common");
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: "/", label: t("home") },
    { href: "/compare", label: t("compare") },
    { href: "/search", label: t("aiSearch") },
    { href: "/bands", label: t("carrierBands") },
  ] as const;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-6">
          <Link
            href={getLocalizedHref(currentLocale, "/")}
            className="group flex items-center gap-2"
          >
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-neon-violet to-neon-cyan shadow-[0_0_24px_hsl(var(--glow-primary)/0.5)]">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Spec<span className="text-primary">Nova</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const active =
                pathWithoutLocale === link.href ||
                (link.href !== "/" && pathWithoutLocale.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={getLocalizedHref(currentLocale, link.href)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                    active && "bg-secondary text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href={getLocalizedHref(currentLocale, "/search")}>
                <Sparkles className="text-neon-cyan" />
                <span>{t("aiSearch")}</span>
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Globe className="h-4 w-4" />
                  <span className="sr-only">Select language</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                {locales.map((locale) => (
                  <DropdownMenuItem
                    key={locale}
                    asChild
                    className={cn(
                      "flex items-center gap-2",
                      locale === currentLocale && "font-medium text-foreground"
                    )}
                  >
                    <Link
                      href={getLocalizedHref(locale, pathWithoutLocale)}
                      className="flex w-full items-center gap-2"
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.href = getLocalizedHref(locale, pathWithoutLocale);
                      }}
                    >
                      <span className="flex h-4 w-6 items-center justify-center">
                        {locale === "fr" ? "🇫🇷" : "🇺🇸"}
                      </span>
                      {localeNames[locale as keyof typeof localeNames]}
                      {locale === currentLocale && (
                        <span className="ml-auto h-4 w-4 text-primary">✓</span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <UserMenu />
            <ThemeToggle />

            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-x-0 top-14 z-50 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-border/50 bg-background/95 backdrop-blur-xl sm:top-16 md:hidden"
            >
              <nav className="container flex flex-col gap-1 py-3">
                {navLinks.map((link) => {
                  const active =
                    pathWithoutLocale === link.href ||
                    (link.href !== "/" && pathWithoutLocale.startsWith(link.href));
                  return (
                    <Link
                      key={link.href}
                      href={getLocalizedHref(currentLocale, link.href)}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "rounded-xl px-4 py-3.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
                <div className="my-2 h-px bg-border/50" />
                <Link
                  href={getLocalizedHref(currentLocale, "/search")}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-4 py-3.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Sparkles className="h-4 w-4 text-neon-cyan" />
                  {t("aiSearch")}
                </Link>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

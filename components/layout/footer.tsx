"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Twitter } from "lucide-react";
import { useTranslations } from "next-intl";
import { locales, defaultLocale, getLocalizedHref } from "@/lib/i18n";

function getLocaleFromPathname(pathname: string) {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return defaultLocale;
}

export function Footer() {
  const pathname = usePathname();
  const currentLocale = getLocaleFromPathname(pathname);
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border/50 py-10">
      <div className="container flex flex-col items-center justify-between gap-6 md:flex-row">
        <p className="text-sm text-muted-foreground">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
        <div className="flex flex-col items-center gap-4 md:flex-row md:items-center">
          <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link
              href={getLocalizedHref(currentLocale, "/bands")}
              className="transition-colors hover:text-foreground"
            >
              {t("carrierBands")}
            </Link>
            <Link
              href={getLocalizedHref(currentLocale, "/api/health")}
              className="transition-colors hover:text-foreground"
            >
              {t("status")}
            </Link>
            <Link
              href={getLocalizedHref(currentLocale, "/privacy")}
              className="transition-colors hover:text-foreground"
            >
              {t("privacy")}
            </Link>
            <Link
              href={getLocalizedHref(currentLocale, "/terms")}
              className="transition-colors hover:text-foreground"
            >
              {t("terms")}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <a
              aria-label="GitHub"
              href="https://github.com"
              className="transition-colors hover:text-foreground"
            >
              <Github className="h-4 w-4" />
            </a>
            <a
              aria-label="X"
              href="https://x.com"
              className="transition-colors hover:text-foreground"
            >
              <Twitter className="h-4 w-4" />
            </a>
          </div>
          <p className="text-xs text-muted-foreground/60 md:hidden">
            {t("madeWith")}
          </p>
        </div>
      </div>
    </footer>
  );
}
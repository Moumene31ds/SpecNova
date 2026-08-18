"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Compass, GitCompareArrows, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { locales, defaultLocale } from "@/lib/i18n";

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

const tabs = [
  { href: "/", icon: Home, labelKey: "home" },
  { href: "/search", icon: Search, labelKey: "aiSearch" },
  { href: "/finder", icon: Compass, labelKey: "finder" },
  { href: "/compare", icon: GitCompareArrows, labelKey: "compare" },
  { href: "/rankings", icon: Trophy, labelKey: "rankings" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const currentLocale = getLocaleFromPathname(pathname);
  const pathWithoutLocale = getPathWithoutLocale(pathname);
  const t = useTranslations("common");

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-xl pb-safe md:hidden">
      <div className="flex items-center justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const active =
            pathWithoutLocale === tab.href ||
            (tab.href !== "/" && pathWithoutLocale.startsWith(tab.href));
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href === "/" ? `/${currentLocale}` : `/${currentLocale}${tab.href}`}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-colors",
                active
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

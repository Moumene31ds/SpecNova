"use client";

import * as React from "react";
import { Monitor, Moon, Sun, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ThemeName } from "@/lib/constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "specnova-theme";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
};

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

export function useTheme() {
  return React.useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeName>("light");

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    const initial: ThemeName = stored ?? "light";
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = React.useCallback((next: ThemeName) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme === "light" ? "light" : "dark";
  // Seed a subtle cross-fade via the View Transitions API.
  if (document.startViewTransition) {
    document.startViewTransition(() => {});
  }
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("common");

  const Icon = theme === "light" ? Sun : theme === "neon" ? Monitor : Moon;

  const items: Array<{ value: ThemeName; label: string; icon: React.ReactNode }> = [
    { value: "light", label: t("themeLight"), icon: <Sun className="h-4 w-4" /> },
    { value: "oled", label: t("themeOled"), icon: <Moon className="h-4 w-4" /> },
    { value: "neon", label: t("themeNeon"), icon: <Sparkles className="h-4 w-4" /> },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          aria-label={t("theme")}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          {t("theme")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem
            key={item.value}
            onClick={() => setTheme(item.value)}
            className="flex items-center gap-2.5"
          >
            {item.icon}
            <span>{item.label}</span>
            {theme === item.value && (
              <span className="ml-auto h-4 w-4 text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemeName } from "@/lib/constants";

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

  const next: ThemeName = theme === "oled" ? "neon" : theme === "neon" ? "light" : "oled";
  const Icon = theme === "light" ? Sun : theme === "neon" ? Monitor : Moon;

  return (
    <button
      onClick={() => setTheme(next)}
      className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary/50 text-muted-foreground transition-colors hover:text-foreground"
      aria-label={`Switch theme (current: ${theme})`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
const storageKey = "croebet:theme";
const changeEvent = "croebet:theme-change";
const mediaQuery = "(prefers-color-scheme: dark)";

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(storageKey);
    if (value === "light" || value === "dark") return value;
  } catch {
    // Keep the current preference usable when browser storage is unavailable.
  }
  const current = document.documentElement.dataset.themePreference;
  return current === "light" || current === "dark" ? current : "system";
}

function applyTheme() {
  const theme = readTheme();
  const resolved = theme === "system"
    ? (window.matchMedia(mediaQuery).matches ? "dark" : "light")
    : theme;
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.dataset.theme = resolved;
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(mediaQuery);
  const update = () => {
    applyTheme();
    onChange();
  };
  update();
  media.addEventListener("change", update);
  window.addEventListener("storage", update);
  window.addEventListener(changeEvent, update);
  return () => {
    media.removeEventListener("change", update);
    window.removeEventListener("storage", update);
    window.removeEventListener(changeEvent, update);
  };
}

function setTheme(theme: Theme) {
  document.documentElement.dataset.themePreference = theme;
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // Apply the selection for this page even without persistence.
  }
  window.dispatchEvent(new Event(changeEvent));
}

const ThemeContext = createContext<{
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme === "light" ? "light" : "dark",
    () => "dark",
  );
  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme requires ThemeProvider");
  return context;
}

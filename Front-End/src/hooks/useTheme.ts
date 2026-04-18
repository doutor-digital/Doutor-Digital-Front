import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "dd:theme";

function readInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  useEffect(() => {
    apply(theme);
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);

  return { theme, setTheme, toggle };
}

export function initThemeEarly() {
  try {
    apply(readInitial());
  } catch { /* ignore */ }
}

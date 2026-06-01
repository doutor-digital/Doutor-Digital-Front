import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "dd:theme";

// O produto é dark-only: sempre forçamos o tema escuro, ignorando a preferência
// do sistema/armazenada (evita fundos brancos no mobile em modo claro).
function readInitial(): Theme {
  return "dark";
}

function apply(_theme?: Theme) {
  const root = document.documentElement;
  root.classList.add("dark");
  root.dataset.theme = "dark";
}

export function useTheme() {
  const [theme] = useState<Theme>("dark");

  useEffect(() => {
    apply();
    try { window.localStorage.setItem(STORAGE_KEY, "dark"); } catch { /* ignore */ }
  }, []);

  // Mantém a API, mas o tema é sempre dark.
  const setTheme = useCallback((_t: Theme) => apply(), []);
  const toggle = useCallback(() => apply(), []);

  return { theme, setTheme, toggle };
}

export function initThemeEarly() {
  try {
    apply(readInitial());
  } catch { /* ignore */ }
}

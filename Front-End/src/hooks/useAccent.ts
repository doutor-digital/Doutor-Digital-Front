import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Accent = "emerald" | "sky" | "amber" | "indigo" | "rose" | "violet";

export const ACCENTS: Record<Accent, { rgb: string; ring: string; label: string }> = {
  emerald: { rgb: "16 185 129",  ring: "ring-emerald-500/40", label: "Esmeralda" },
  sky:     { rgb: "56 189 248",  ring: "ring-sky-500/40",     label: "Azul" },
  amber:   { rgb: "245 158 11",  ring: "ring-amber-500/40",   label: "Âmbar" },
  indigo:  { rgb: "99 102 241",  ring: "ring-indigo-500/40",  label: "Índigo" },
  rose:    { rgb: "244 63 94",   ring: "ring-rose-500/40",    label: "Rosa" },
  violet:  { rgb: "139 92 246",  ring: "ring-violet-500/40",  label: "Violeta" },
};

interface AccentStore {
  accent: Accent;
  setAccent: (a: Accent) => void;
}

export const useAccent = create<AccentStore>()(
  persist(
    (set) => ({
      accent: "emerald",
      setAccent: (a) => set({ accent: a }),
    }),
    { name: "doutor.digital.accent" },
  ),
);

/**
 * Aplica a CSS variable `--accent` no documento.
 * Ex: `style={{ background: "rgb(var(--accent))" }}` em componentes opt-in.
 */
export function AccentProvider({ children }: { children: React.ReactNode }) {
  const accent = useAccent((s) => s.accent);
  useEffect(() => {
    const rgb = ACCENTS[accent].rgb;
    document.documentElement.style.setProperty("--accent", rgb);
  }, [accent]);
  return <>{children}</>;
}

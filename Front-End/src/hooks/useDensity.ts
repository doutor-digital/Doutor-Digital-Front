import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Density = "comfortable" | "compact";

interface DensityStore {
  density: Density;
  set: (d: Density) => void;
  toggle: () => void;
}

export const useDensity = create<DensityStore>()(
  persist(
    (set) => ({
      density: "comfortable",
      set: (d) => set({ density: d }),
      toggle: () =>
        set((s) => ({ density: s.density === "comfortable" ? "compact" : "comfortable" })),
    }),
    { name: "doutor.digital.density" },
  ),
);

/** Classe utilitária pra aplicar em tabelas. */
export function densityTable(d: Density) {
  return d === "compact" ? "[&_td]:py-1.5 [&_th]:py-2 text-[12px]" : "";
}

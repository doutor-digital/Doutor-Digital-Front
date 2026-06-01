import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Overrides manuais dos KPIs da dashboard principal.
 *
 * Permite que o usuário "fixe" o número exibido num card (ex.: para representar
 * o total real consolidado), sobrepondo o valor vindo do backend/Kommo.
 * Persistido em localStorage (mesma convenção do useClinic).
 *
 * Chave canônica: `${unitId ?? "all"}::${metricKey}` — overrides são por unidade
 * e independentes do range/período selecionado.
 */
interface KpiOverridesStore {
  /** Map de chave canônica → valor manual. */
  overrides: Record<string, number>;
  setOverride: (key: string, value: number) => void;
  clearOverride: (key: string) => void;
}

export const useKpiOverrides = create<KpiOverridesStore>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (key, value) =>
        set((s) => ({ overrides: { ...s.overrides, [key]: value } })),
      clearOverride: (key) =>
        set((s) => {
          const next = { ...s.overrides };
          delete next[key];
          return { overrides: next };
        }),
    }),
    { name: "doutor.digital.kpi-overrides" },
  ),
);

/** Monta a chave canônica de um override de KPI. */
export function kpiKey(unitId: number | null | undefined, metric: string) {
  return `${unitId ?? "all"}::${metric}`;
}

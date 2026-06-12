import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Overrides manuais dos KPIs da dashboard principal.
 *
 * Permite que o usuário "fixe" o número exibido num card (ex.: para representar
 * o total real consolidado), sobrepondo o valor vindo do backend/Kommo.
 * Persistido em localStorage (mesma convenção do useClinic).
 *
 * Chave canônica: `${unitId ?? "all"}::${metricKey}::${fromDay}__${toDay}` —
 * overrides são por unidade E por janela de datas. Editar "50 Cadastros" em
 * junho NÃO carrega o valor pra julho — o override só vale pro range
 * (intervalo de dias) em que foi editado.
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
    {
      name: "doutor.digital.kpi-overrides",
      // v0 = sem range na chave (override valia pra todo período). v1 inclui range,
      // então descarta overrides antigos pra não vazarem pro novo formato.
      version: 1,
      migrate: () => ({ overrides: {} }),
    },
  ),
);

/**
 * Extrai só a parte de data (yyyy-MM-dd) de uma string ISO ou Date. Range comercial
 * normaliza pra "véspera 19h → 19h do dia final" — manter só o dia evita que o
 * mesmo período abrido em horários diferentes gere chaves distintas.
 */
function toDayKey(v: string | Date | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") return v.slice(0, 10); // ISO "2026-06-12T..." → "2026-06-12"
  return v.toISOString().slice(0, 10);
}

/**
 * Monta a chave canônica de um override de KPI.
 * Inclui o range (data inicial + final) — sem isso o mesmo valor manual era
 * exibido em todos os meses.
 */
export function kpiKey(
  unitId: number | null | undefined,
  metric: string,
  from?: string | Date | null,
  to?: string | Date | null,
) {
  const fromDay = toDayKey(from);
  const toDay = toDayKey(to);
  const range = fromDay && toDay ? `${fromDay}__${toDay}` : "all";
  return `${unitId ?? "all"}::${metric}::${range}`;
}

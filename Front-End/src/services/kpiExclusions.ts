import { api } from "@/lib/api";

/**
 * Marca/desmarca um lead como "não contar" num KPI específico (ex.: agendados).
 * Quando marcado, ele soma de aparição em todos os números do dashboard daquele
 * KPI — mas continua existindo (visível no drill-down com flag excluded=true).
 */
export const kpiExclusionsService = {
  async add(params: { unitId: number; kpiKey: string; leadId: number; reason?: string }) {
    const { data } = await api.post<{ id: number; already: boolean }>(
      "/api/admin/kpi-exclusions",
      {
        unit_id: params.unitId,
        kpi_key: params.kpiKey,
        lead_id: params.leadId,
        reason: params.reason,
      },
    );
    return data;
  },

  async remove(params: { unitId: number; kpiKey: string; leadId: number }) {
    const { data } = await api.delete<{ ok: boolean }>(
      "/api/admin/kpi-exclusions",
      {
        data: {
          unit_id: params.unitId,
          kpi_key: params.kpiKey,
          lead_id: params.leadId,
        },
      },
    );
    return data;
  },

  async list(unitId: number, kpiKey: string) {
    const { data } = await api.get<{
      items: Array<{
        id: number;
        lead_id: number;
        lead_name: string;
        reason?: string | null;
        excluded_at: string;
      }>;
      total: number;
    }>("/api/admin/kpi-exclusions", { params: { unitId, kpiKey } });
    return data;
  },
};

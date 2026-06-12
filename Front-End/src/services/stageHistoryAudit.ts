import { api } from "@/lib/api";

export interface StageTransitionItem {
  id: number;
  lead_id: number;
  lead_name: string;
  stage_id: number;
  stage_label: string;
  /** Inferido do stage_label — "agendados" / "no_show" / "tratamentos" / null. */
  kpi_key: string | null;
  original_changed_at: string;
  corrected_changed_at: string | null;
  effective_changed_at: string;
  corrected_at: string | null;
  corrected_by_email: string | null;
  correction_reason: string | null;
  entry_source: string;
  /** Lead está em kpi_exclusions pro kpi_key desta transição. */
  excluded: boolean;
}

export interface StageHistoryAuditResult {
  items: StageTransitionItem[];
  total: number;
  truncated: boolean;
}

/**
 * Auditoria de movimentações de etapa — admin lista transições do período pra
 * corrigir erros das SDRs (data errada ou marcar como "não contar" no KPI).
 */
export const stageHistoryAuditService = {
  async audit(params: {
    unitId: number;
    dateFrom: string;
    dateTo: string;
    kpiKey?: string;
    leadName?: string;
    limit?: number;
  }): Promise<StageHistoryAuditResult> {
    const { data } = await api.get<StageHistoryAuditResult>(
      "/api/admin/stage-history/audit",
      {
        params: {
          unitId: params.unitId,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          kpiKey: params.kpiKey || undefined,
          leadName: params.leadName || undefined,
          limit: params.limit ?? 500,
        },
      },
    );
    return {
      items: data?.items ?? [],
      total: data?.total ?? 0,
      truncated: Boolean(data?.truncated),
    };
  },

  async correctDate(params: { id: number; correctedAt: string; reason?: string }) {
    const { data } = await api.patch<{
      ok: boolean;
      id: number;
      corrected_changed_at: string;
      corrected_by_email: string;
    }>(`/api/admin/stage-history/${params.id}/corrected-date`, {
      corrected_at: params.correctedAt,
      reason: params.reason,
    });
    return data;
  },

  async resetCorrection(id: number) {
    const { data } = await api.delete<{ ok: boolean }>(
      `/api/admin/stage-history/${id}/corrected-date`,
    );
    return data;
  },
};

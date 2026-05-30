import { api } from "@/lib/api";
import { asArray, cleanParams, toInt } from "@/lib/http";
import type {
  ActiveLeadDto,
  ApiCountPayload,
  CompareMode,
  ConversionAnalytics,
  DashboardEvolutionResponse,
  DashboardLeadListItem,
  DashboardOverview,
  GroupByGranularity,
  Lead,
  LeadDetail,
  LeadProcessResponse,
  LeadTimeline,
  LeadsCountDto,
  EvolutionAdvancedDto,
  MarkAttendancePayload,
  OrigemAgrupada,
  OvernightLeadsDto,
  RecentLeadsResponse,
  RecoveryLead,
  RecoveryAttempt,
  CreateRecoveryAttempt,
  StageChangesSummary,
  StageCount,
  TimeSeriesPoint,
} from "@/types";

export interface HeatmapCell {
  dayOfWeek: number; // 0=domingo .. 6=sábado
  hour: number; // 0..23
  count: number;
}

export interface CampaignCell {
  campaign: string;
  source: string;
  count: number;
}

export interface ByUnitEvolutionSeries {
  unitId: number | null;
  unitName: string;
  points: Array<{ date: string; count: number }>;
}

export interface LeadFilters {
  clinicId?: number | string;
  search?: string;
  stage?: string;
  state?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface ConsultaPeriodosParams {
  ClinicId?: number | string;
  Ano?: number;
  Mes?: number;
  Semana?: number;
  Dia?: number;
}

function extractCount(data: ApiCountPayload | number | null | undefined): number {
  if (typeof data === "number") return data;
  if (!data) return 0;
  return data.count ?? data.total ?? data.quantidade ?? 0;
}

function normalizeSourceGroup(data: unknown): Array<{ source: string; count: number }> {
  return asArray<Record<string, unknown>>(data).map((item) => ({
    source: String(item.source ?? item.origem ?? item.etapa ?? item.name ?? "—"),
    count: Number(item.count ?? item.quantidade ?? item.total ?? 0),
  }));
}

function normalizeStageGroup(data: unknown): StageCount[] {
  return asArray<Record<string, unknown>>(data).map((item) => ({
    stage: String(item.stage ?? item.etapa ?? item.name ?? "—"),
    count: Number(item.count ?? item.quantidade ?? item.total ?? 0),
  }));
}

const MONTH_SHORT_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function buildPeriodLabel(item: Record<string, unknown>): string {
  const ano = Number(item.ano ?? item.year);
  const mes = Number(item.mes ?? item.month);
  if (Number.isFinite(ano) && Number.isFinite(mes) && mes >= 1 && mes <= 12) {
    const mm = MONTH_SHORT_PT[mes - 1];
    const yy = String(ano).slice(-2);
    return `${mm}/${yy}`;
  }
  if (item.periodo) return String(item.periodo);
  if (item.data) return String(item.data);
  if (item.label) return String(item.label);
  if (Number.isFinite(mes)) return String(mes);
  return "—";
}

function normalizeSeries(data: unknown): TimeSeriesPoint[] {
  return asArray<Record<string, unknown>>(data).map((item) => {
    const ano = Number(item.ano ?? item.year);
    const mes = Number(item.mes ?? item.month);
    return {
      periodo: buildPeriodLabel(item),
      total: Number(item.total ?? item.count ?? item.quantidade ?? 0),
      ano: Number.isFinite(ano) ? ano : undefined,
      mes: Number.isFinite(mes) ? mes : undefined,
    };
  });
}

export const webhooksService = {
  async listLeads(filters: LeadFilters = {}): Promise<Lead[]> {
    const { data } = await api.get<Lead[]>("/webhooks", {
      params: cleanParams({
        ...filters,
        unitId: toInt(filters.clinicId),
      }),
    });

    return asArray<Lead>(data);
  },

  async getLeadById(id: number | string): Promise<LeadDetail> {
    const numericId = toInt(id);
    if (!numericId) throw new Error("id inválido para /webhooks/{id}");

    const { data } = await api.get<LeadDetail>(`/webhooks/${numericId}`);
    return data;
  },

  async getLeadTimeline(id: number | string): Promise<LeadTimeline> {
    const numericId = toInt(id);
    if (!numericId) throw new Error("id inválido para /webhooks/{id}/timeline");

    const { data } = await api.get<LeadTimeline>(`/webhooks/${numericId}/timeline`);
    return data;
  },

  async consultas(clinicId?: number | string): Promise<number> {
    const { data } = await api.get<ApiCountPayload | number>("/webhooks/consultas", {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });
    return extractCount(data);
  },

  async semPagamento(clinicId?: number | string): Promise<number> {
    const { data } = await api.get<ApiCountPayload | number>("/webhooks/sem-pagamento", {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });
    return extractCount(data);
  },

  async comPagamento(clinicId?: number | string): Promise<number> {
    const { data } = await api.get<ApiCountPayload | number>("/webhooks/com-pagamento", {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });
    return extractCount(data);
  },

  async sourceFinal(clinicId?: number | string): Promise<Array<{ source: string; count: number }>> {
    const { data } = await api.get<unknown>("/webhooks/source-final", {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });

    return normalizeSourceGroup(data);
  },

  async origemCloudia(clinicId?: number | string): Promise<OrigemAgrupada[]> {
    const { data } = await api.get<OrigemAgrupada[]>("/webhooks/origem-cloudia", {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });

    return asArray<OrigemAgrupada>(data);
  },

  async fimDeSemana(clinicId?: number | string): Promise<Lead[]> {
    const { data } = await api.get<Lead[]>("/webhooks/fim-de-semana", {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });

    return asArray<Lead>(data);
  },

  async etapaAgrupada(clinicId?: number | string): Promise<StageCount[]> {
    const { data } = await api.get<unknown>("/webhooks/etapa-agrupada", {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });

    return normalizeStageGroup(data);
  },

  async buscarInicioFim(params: {
    clinicId?: number | string;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<TimeSeriesPoint[]> {
    const { data } = await api.get<unknown>("/webhooks/buscar-inicio-fim", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
      }),
    });

    return normalizeSeries(data);
  },

  /**
   * Swagger exige query params com inicial maiúscula: ClinicId, Ano, Mes, Semana, Dia.
   */
  async consultaPeriodos(params: ConsultaPeriodosParams): Promise<TimeSeriesPoint[]> {
    const { data } = await api.get<unknown>("/webhooks/consulta-periodos", {
      params: cleanParams({
        ClinicId: toInt(params.ClinicId),
        Ano: params.Ano,
        Mes: params.Mes,
        Semana: params.Semana,
        Dia: params.Dia,
      }),
    });

    return normalizeSeries(data);
  },

  async activeLeads(params: { limit?: number; unitId?: number | string } = {}): Promise<ActiveLeadDto[]> {
    const { data } = await api.get<ActiveLeadDto[]>("/webhooks/active", {
      params: cleanParams({
        limit: params.limit,
        unitId: toInt(params.unitId),
      }),
    });

    return asArray<ActiveLeadDto>(data);
  },

  async countByState(unitId?: number | string, tenantId?: number | string): Promise<LeadsCountDto> {
    const { data } = await api.get<LeadsCountDto>("/webhooks/count-by-state", {
      params: cleanParams({ unitId: toInt(unitId), tenantId: toInt(tenantId) }),
    });

    return data ?? { bot: 0, queue: 0, service: 0, concluido: 0, total: 0 };
  },

  async evolutionAdvanced(params: {
    clinicId?: number | string;
    dataInicio: string;
    dataFim: string;
  }): Promise<EvolutionAdvancedDto> {
    const { data } = await api.get<EvolutionAdvancedDto>("/webhooks/evolution/advanced", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
      }),
    });
    return data;
  },

  async amanheceu(params: {
    clinicId?: number | string;
    startHour?: number;
    endHour?: number;
  } = {}): Promise<OvernightLeadsDto> {
    const { data } = await api.get<OvernightLeadsDto>("/webhooks/amanheceu", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        startHour: params.startHour,
        endHour: params.endHour,
      }),
    });

    return data;
  },

  async dashboardOverview(params: {
    clinicId?: number | string;
    dateFrom: string;
    dateTo: string;
    unitId?: number | string;
    attendantId?: number | string;
    source?: string;
  }): Promise<DashboardOverview> {
    const { data } = await api.get<DashboardOverview>("/webhooks/dashboard-overview", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        unitId: toInt(params.unitId),
        attendantId: toInt(params.attendantId),
        source: params.source && params.source.length > 0 ? params.source : undefined,
      }),
    });
    return data;
  },

  async recentLeads(params: {
    clinicId?: number | string;
    hours?: number;
    limit?: number;
    unitId?: number | string;
  }): Promise<RecentLeadsResponse> {
    const { data } = await api.get<RecentLeadsResponse>("/webhooks/recent", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        hours: params.hours ?? 24,
        limit: params.limit ?? 50,
        unitId: toInt(params.unitId),
      }),
    });
    return data ?? { hours: params.hours ?? 24, total: 0, since: new Date().toISOString(), items: [] };
  },

  async evolutionRange(params: {
    clinicId?: number | string;
    dateFrom: string;
    dateTo: string;
    groupBy?: GroupByGranularity;
    compare?: CompareMode;
    unitId?: number | string;
    attendantId?: number | string;
    source?: string;
  }): Promise<DashboardEvolutionResponse> {
    const { data } = await api.get<DashboardEvolutionResponse>("/webhooks/evolution-range", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        groupBy: params.groupBy ?? "day",
        compare: params.compare ?? "none",
        unitId: toInt(params.unitId),
        attendantId: toInt(params.attendantId),
        source: params.source && params.source.length > 0 ? params.source : undefined,
      }),
    });
    return data;
  },

  async dashboardScheduledLeads(params: {
    clinicId?: number | string;
    dateFrom: string;
    dateTo: string;
    unitId?: number | string;
    attendantId?: number | string;
    source?: string;
  }): Promise<DashboardLeadListItem[]> {
    const { data } = await api.get<DashboardLeadListItem[]>(
      "/webhooks/dashboard/scheduled",
      {
        params: cleanParams({
          clinicId: toInt(params.clinicId),
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          unitId: toInt(params.unitId),
          attendantId: toInt(params.attendantId),
          source: params.source && params.source.length > 0 ? params.source : undefined,
        }),
      },
    );
    return asArray<DashboardLeadListItem>(data);
  },

  async dashboardAttendedLeads(params: {
    clinicId?: number | string;
    dateFrom: string;
    dateTo: string;
    unitId?: number | string;
    attendantId?: number | string;
    source?: string;
  }): Promise<DashboardLeadListItem[]> {
    const { data } = await api.get<DashboardLeadListItem[]>(
      "/webhooks/dashboard/attended",
      {
        params: cleanParams({
          clinicId: toInt(params.clinicId),
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          unitId: toInt(params.unitId),
          attendantId: toInt(params.attendantId),
          source: params.source && params.source.length > 0 ? params.source : undefined,
        }),
      },
    );
    return asArray<DashboardLeadListItem>(data);
  },

  async distinctSources(params: { clinicId?: number | string; unitId?: number | string } = {}): Promise<string[]> {
    const { data } = await api.get<string[]>("/webhooks/sources", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        unitId: toInt(params.unitId),
      }),
    });
    return Array.isArray(data) ? data : [];
  },

  async syncHealth(): Promise<unknown> {
    const { data } = await api.get<unknown>("/webhooks/sync/health");
    return data;
  },

  async heatmap(params: {
    unitId?: number; dateFrom?: string; dateTo?: string; source?: string;
  } = {}): Promise<HeatmapCell[]> {
    const { data } = await api.get<HeatmapCell[]>("/webhooks/dashboard/heatmap", {
      params: cleanParams(params),
    });
    return Array.isArray(data) ? data : [];
  },

  async campaigns(params: {
    unitId?: number; dateFrom?: string; dateTo?: string; source?: string; top?: number;
  } = {}): Promise<CampaignCell[]> {
    const { data } = await api.get<CampaignCell[]>("/webhooks/dashboard/campaigns", {
      params: cleanParams(params),
    });
    return Array.isArray(data) ? data : [];
  },

  async byUnitEvolution(params: {
    dateFrom: string; dateTo: string; source?: string;
  }): Promise<ByUnitEvolutionSeries[]> {
    const { data } = await api.get<ByUnitEvolutionSeries[]>(
      "/webhooks/dashboard/by-unit-evolution",
      { params: cleanParams(params) },
    );
    return Array.isArray(data) ? data : [];
  },

  async getTotalLeads(tenantId: number): Promise<number> {
  const { data } = await api.get<{ total: number }>("/webhooks/total-leads", {
    params: { clinicId: tenantId },
  });

  return data.total;
  },

  async patchLead(id: number | string, patch: Record<string, unknown>): Promise<LeadDetail> {
    const numericId = toInt(id);
    if (!numericId) throw new Error("id inválido para PATCH /webhooks/{id}");

    const { data } = await api.patch<LeadDetail>(`/webhooks/${numericId}`, patch);
    return data;
  },

  async markAttendance(id: number | string, payload: MarkAttendancePayload): Promise<LeadProcessResponse> {
    const numericId = toInt(id);
    if (!numericId) throw new Error("id inválido para POST /webhooks/{id}/attendance");

    const body: MarkAttendancePayload = {
      attended: payload.attended,
      ...(payload.attended && payload.outcome ? { outcome: payload.outcome } : {}),
      ...(payload.notes ? { notes: payload.notes } : {}),
    };

    const { data } = await api.post<LeadProcessResponse>(`/webhooks/${numericId}/attendance`, body);
    return data;
  },

  async recoveryQueue(params: {
    clinicId?: number | string;
    unitId?: number | string;
    dateFrom?: string;
    dateTo?: string;
    attendantId?: number | string;
    attempts?: "with" | "without";
  } = {}): Promise<RecoveryLead[]> {
    const { data } = await api.get<RecoveryLead[]>("/webhooks/recuperacao", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        unitId: toInt(params.unitId),
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        attendantId: toInt(params.attendantId),
        attempts: params.attempts,
      }),
    });
    return asArray<RecoveryLead>(data);
  },

  async listRecoveryAttempts(leadId: number | string): Promise<RecoveryAttempt[]> {
    const id = toInt(leadId);
    if (!id) throw new Error("id inválido para /webhooks/{id}/recovery-attempts");
    const { data } = await api.get<RecoveryAttempt[]>(`/webhooks/${id}/recovery-attempts`);
    return asArray<RecoveryAttempt>(data);
  },

  async createRecoveryAttempt(
    leadId: number | string,
    payload: CreateRecoveryAttempt,
  ): Promise<RecoveryAttempt> {
    const id = toInt(leadId);
    if (!id) throw new Error("id inválido para POST /webhooks/{id}/recovery-attempts");
    const { data } = await api.post<RecoveryAttempt>(
      `/webhooks/${id}/recovery-attempts`,
      payload,
    );
    return data;
  },

  async markRecovered(leadId: number | string, notes?: string): Promise<RecoveryAttempt> {
    const id = toInt(leadId);
    if (!id) throw new Error("id inválido para POST /webhooks/{id}/mark-recovered");
    const { data } = await api.post<RecoveryAttempt>(`/webhooks/${id}/mark-recovered`, { notes });
    return data;
  },

  async conversionAnalytics(params: {
    clinicId?: number | string;
    unitId?: number | string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<ConversionAnalytics> {
    const { data } = await api.get<ConversionAnalytics>("/webhooks/conversion-analytics", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        unitId: toInt(params.unitId),
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
    });
    return data;
  },

  async stageChanges(params: {
    clinicId?: number | string;
    unitId?: number | string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {}): Promise<StageChangesSummary> {
    const { data } = await api.get<StageChangesSummary>("/webhooks/stage-changes", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        unitId: toInt(params.unitId),
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        limit: params.limit ?? 100,
      }),
    });
    return data ?? { total: 0, daily: [], byDestination: [], items: [] };
  },
};

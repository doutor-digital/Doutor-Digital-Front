import { api } from "@/lib/api";
import { cleanParams, toInt, asArray } from "@/lib/http";
import type { LeadMetrics, UnitAlert, UnitAlertsResponse, UnitSummary } from "@/types";

/** Envelope cru que o back devolve em /api/analytics/units/{id}/alerts */
interface RawUnitAlertsEnvelope {
  unitId: number;
  totalDelayed: number;
  limits?: { bot?: string; queue?: string; service?: string };
  leads: UnitAlert[];
}

export interface UnitLeadsMetricsFilters {
  startDate?: string;
  endDate?: string;
  state?: string;
}

export interface UnitSummaryFilters {
  startDate?: string;
  endDate?: string;
}

export interface UnitTodayDashboard {
  summary: UnitSummary;
  alerts: LeadMetrics[];
  topAttendants: Array<{ name: string; conversions: number; total: number }>;
}

export const analyticsService = {
  async leadMetrics(leadId: number | string): Promise<LeadMetrics> {
    const id = toInt(leadId);
    if (!id) throw new Error("leadId inválido para /api/analytics/leads/{id}/metrics");

    const { data } = await api.get<LeadMetrics>(`/api/analytics/leads/${id}/metrics`);
    return data;
  },

  async unitLeadsMetrics(
    unitId: number | string,
    params: UnitLeadsMetricsFilters = {}
  ): Promise<LeadMetrics[]> {
    const id = toInt(unitId);
    if (!id) throw new Error("unitId inválido para /api/analytics/units/{unitId}/leads-metrics");

    const { data } = await api.get<LeadMetrics[]>(`/api/analytics/units/${id}/leads-metrics`, {
      params: cleanParams(params),
    });

    return asArray<LeadMetrics>(data);
  },

  async unitSummary(
    unitId: number | string,
    params: UnitSummaryFilters = {}
  ): Promise<UnitSummary> {
    const id = toInt(unitId);
    if (!id) throw new Error("unitId inválido para /api/analytics/units/{unitId}/summary");

    const { data } = await api.get<UnitSummary>(`/api/analytics/units/${id}/summary`, {
      params: cleanParams(params),
    });

    return data;
  },

  async unitAlerts(unitId: number | string): Promise<UnitAlertsResponse> {
    const id = toInt(unitId);
    if (!id) throw new Error("unitId inválido para /api/analytics/units/{unitId}/alerts");

    const { data } = await api.get<RawUnitAlertsEnvelope>(`/api/analytics/units/${id}/alerts`);

    // O back envelopa em { unitId, totalDelayed, limits, leads }.
    // Desembrulhamos pra uma forma mais idiomática ({ ..., alerts }).
    return {
      unitId: data?.unitId ?? id,
      totalDelayed: data?.totalDelayed ?? 0,
      limits: data?.limits ?? {},
      alerts: asArray<UnitAlert>(data?.leads),
    };
  },

  async unitDashboardToday(unitId: number | string): Promise<UnitTodayDashboard> {
    const id = toInt(unitId);
    if (!id) throw new Error("unitId inválido para /api/analytics/units/{unitId}/dashboard/today");

    const { data } = await api.get<UnitTodayDashboard>(`/api/analytics/units/${id}/dashboard/today`);
    return data;
  },
};

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

/** Shape cru do ClinicSummaryDto vindo do backend. */
interface RawClinicSummaryDto {
  clinicId: number;
  clinicName: string;
  periodStart: string;
  periodEnd: string;
  totalLeads: number;
  leadsInBot: number;
  leadsInQueue: number;
  leadsInService: number;
  leadsConcluded: number;
  averageTimeToFirstResponseMinutes: number | null;
  averageTimeToResolutionMinutes: number | null;
  averageTimeInBotMinutes: number | null;
  averageTimeInQueueMinutes: number | null;
  averageTimeInServiceMinutes: number | null;
  delayedLeadsCount: number;
  attendantsPerformance: Array<{
    attendantId: number;
    attendantName: string;
    totalLeadsHandled: number;
    currentActiveLeads: number;
    leadsConcluded: number;
    averageServiceTimeMinutes: number | null;
    averageResolutionTimeMinutes: number | null;
    conversionRate: number | null;
  }>;
  leadsByState: Record<string, number>;
  lastCalculatedAt: string;
}

/** Envelope cru de /api/analytics/units/{id}/leads-metrics */
interface RawLeadsMetricsEnvelope {
  unitId: number;
  period: { start: string | null; end: string | null };
  state: string | null;
  totalLeads: number;
  metrics: RawLeadMetricsDto[];
}

interface RawLeadMetricsDto {
  leadId: number;
  externalId?: number;
  name?: string | null;
  phone?: string | null;
  currentState?: string | null;
  createdAt?: string;
  lastUpdatedAt?: string;
  timeInBotMinutes?: number | null;
  timeInQueueMinutes?: number | null;
  timeInServiceMinutes?: number | null;
  timeInConcluidoMinutes?: number | null;
  timeToFirstResponseMinutes?: number | null;
  timeToResolutionMinutes?: number | null;
  totalTransitions?: number;
  currentAttendantId?: number | null;
  currentAttendantName?: string | null;
  isDelayed?: boolean;
  delayReason?: string | null;
  timeline?: Array<{
    conversationId: number;
    state: string;
    startedAt: string;
    endedAt: string | null;
    durationMinutes: number | null;
    isActive: boolean;
  }>;
}

function mapClinicSummaryToUnitSummary(raw: RawClinicSummaryDto): UnitSummary {
  const totals: UnitSummary["totals"] = {
    bot: raw.leadsInBot ?? 0,
    queue: raw.leadsInQueue ?? 0,
    service: raw.leadsInService ?? 0,
    concluido: raw.leadsConcluded ?? 0,
  };

  const averages: UnitSummary["averages"] = {
    bot: raw.averageTimeInBotMinutes ?? undefined,
    queue: raw.averageTimeInQueueMinutes ?? undefined,
    service: raw.averageTimeInServiceMinutes ?? undefined,
    firstAttendance: raw.averageTimeToFirstResponseMinutes ?? undefined,
    resolution: raw.averageTimeToResolutionMinutes ?? undefined,
  };

  const topAttendants = (raw.attendantsPerformance ?? [])
    .map((a) => ({
      attendantName: a.attendantName,
      total: a.totalLeadsHandled ?? 0,
      conversions: a.leadsConcluded ?? 0,
    }))
    .filter((a) => a.total > 0 || a.conversions > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    totalLeads: raw.totalLeads ?? 0,
    totals,
    averages,
    alertsCount: raw.delayedLeadsCount ?? 0,
    topAttendants,
  };
}

function mapLeadMetrics(raw: RawLeadMetricsDto): LeadMetrics {
  const bot = raw.timeInBotMinutes ?? 0;
  const queue = raw.timeInQueueMinutes ?? 0;
  const service = raw.timeInServiceMinutes ?? 0;
  const concluido = raw.timeInConcluidoMinutes ?? 0;
  const total = bot + queue + service + concluido;

  return {
    leadId: raw.leadId,
    name: raw.name ?? null,
    currentState: (raw.currentState ?? undefined) as LeadMetrics["currentState"],
    timeInBot: raw.timeInBotMinutes ?? undefined,
    timeInQueue: raw.timeInQueueMinutes ?? undefined,
    timeInService: raw.timeInServiceMinutes ?? undefined,
    totalTime: total > 0 ? total : undefined,
    timeToFirstAttendance: raw.timeToFirstResponseMinutes ?? null,
    timeToResolution: raw.timeToResolutionMinutes ?? null,
    alerts: raw.isDelayed && raw.delayReason ? [raw.delayReason] : [],
  };
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

    const { data } = await api.get<RawLeadsMetricsEnvelope | RawLeadMetricsDto[]>(
      `/api/analytics/units/${id}/leads-metrics`,
      { params: cleanParams(params) }
    );

    const rawList = Array.isArray(data)
      ? asArray<RawLeadMetricsDto>(data)
      : asArray<RawLeadMetricsDto>(data?.metrics);

    return rawList.map(mapLeadMetrics);
  },

  async unitSummary(
    unitId: number | string,
    params: UnitSummaryFilters = {}
  ): Promise<UnitSummary> {
    const id = toInt(unitId);
    if (!id) throw new Error("unitId inválido para /api/analytics/units/{unitId}/summary");

    const { data } = await api.get<RawClinicSummaryDto>(
      `/api/analytics/units/${id}/summary`,
      { params: cleanParams(params) }
    );

    return mapClinicSummaryToUnitSummary(data);
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

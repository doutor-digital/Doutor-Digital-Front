import { api } from "@/lib/api";
import { cleanParams } from "@/lib/http";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PeriodFilters {
  unitId?: number;
  startDate?: string;
  endDate?: string;
}

export interface CapiEvent {
  id: string;
  eventName: string;
  status: "received" | "sent" | "failed" | "deduped" | "pending";
  eventTime: string;
  sentAt?: string | null;
  source?: string | null;
  pixelId?: string | null;
  leadId?: number | null;
  leadName?: string | null;
  phone?: string | null;
  hasEmailHash: boolean;
  hasPhoneHash: boolean;
  hasIp: boolean;
  hasFbp: boolean;
  hasFbc: boolean;
  emqScore?: number | null;
  matchQuality?: string | null;
  isDeduped: boolean;
  dedupedWith?: string | null;
  retryCount: number;
  errorMessage?: string | null;
  fbtraceId?: string | null;
  value?: number | null;
  currency?: string | null;
  campaign?: string | null;
  adId?: string | null;
}

export interface CapiTimeBucket {
  bucket: string;
  sent: number;
  failed: number;
  deduped: number;
}

export interface CapiEventStats {
  received: number;
  sent: number;
  failed: number;
  deduped: number;
  pending: number;
  successRate: number;
  dedupRate: number;
  averageEmqScore: number;
  byEventName: Record<string, number>;
  byStatus: Record<string, number>;
  timeline: CapiTimeBucket[];
}

export interface CapiEventList {
  total: number;
  page: number;
  pageSize: number;
  items: CapiEvent[];
  stats: CapiEventStats;
}

export interface PixelHealthByUnit {
  unitId: number;
  unitName: string;
  totalEvents: number;
  emqScore: number;
  coverage: number;
}

export interface PixelHealthAlert {
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
}

export interface PixelHealth {
  periodStart: string;
  periodEnd: string;
  totalEvents: number;
  emailHashCoverage: number;
  phoneHashCoverage: number;
  ipCoverage: number;
  fbpCoverage: number;
  fbcCoverage: number;
  averageEmqScore: number;
  deduplicationRate: number;
  byUnit: PixelHealthByUnit[];
  alerts: PixelHealthAlert[];
}

export interface AttributionTouch {
  order: number;
  at: string;
  source?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  campaign?: string | null;
  headline?: string | null;
  confidence: string;
}

export interface AttributionScore {
  source?: string | null;
  campaign?: string | null;
  weight: number;
}

export interface AttributionPath {
  leadId: number;
  leadName: string;
  phone?: string | null;
  firstTouchAt?: string | null;
  lastTouchAt?: string | null;
  convertedAt?: string | null;
  totalTouches: number;
  touches: AttributionTouch[];
  firstTouch: AttributionScore;
  lastTouch: AttributionScore;
  linear: AttributionScore[];
}

export interface AttributionModelBreakdown {
  source: string;
  score: number;
  leads: number;
  conversions: number;
}

export interface AttributionSummary {
  periodStart: string;
  periodEnd: string;
  totalLeads: number;
  totalConverted: number;
  firstTouchBreakdown: AttributionModelBreakdown[];
  lastTouchBreakdown: AttributionModelBreakdown[];
  linearBreakdown: AttributionModelBreakdown[];
}

export interface UtmGroup {
  key: string;
  leads: number;
  conversions: number;
  conversionRate: number;
  mockedSpend: number;
  mockedCpl: number;
  mockedRoas: number;
}

export interface UtmExplorer {
  periodStart: string;
  periodEnd: string;
  totalLeads: number;
  totalConversions: number;
  mockedAdSpend: number;
  mockedCpl: number;
  sources: UtmGroup[];
  mediums: UtmGroup[];
  campaigns: UtmGroup[];
  contents: UtmGroup[];
  terms: UtmGroup[];
}

export interface SlaByAttendant {
  attendantId: number;
  attendantName: string;
  totalLeads: number;
  averageMinutes: number;
  medianMinutes: number;
  withinTarget: number;
  withinTargetRate: number;
}

export interface SlaBucket {
  range: string;
  count: number;
  percent: number;
}

export interface SlaResponse {
  periodStart: string;
  periodEnd: string;
  totalLeads: number;
  leadsWithFirstResponse: number;
  averageFirstResponseMinutes: number;
  medianFirstResponseMinutes: number;
  p90FirstResponseMinutes: number;
  withinTargetCount: number;
  outsideTargetCount: number;
  targetMinutes: number;
  byAttendant: SlaByAttendant[];
  buckets: SlaBucket[];
}

export interface HeatmapCell {
  weekday: number;
  hour: number;
  count: number;
}

export interface HeatmapWeekdaySummary {
  weekday: number;
  label: string;
  count: number;
}

export interface HeatmapHourSummary {
  hour: number;
  count: number;
}

export interface Heatmap {
  periodStart: string;
  periodEnd: string;
  totalLeads: number;
  max: number;
  cells: HeatmapCell[];
  byWeekday: HeatmapWeekdaySummary[];
  byHour: HeatmapHourSummary[];
}

export interface CohortCell {
  daysSinceCohort: number;
  converted: number;
  rate: number;
}

export interface CohortRow {
  cohortStart: string;
  label: string;
  size: number;
  cells: CohortCell[];
}

export interface Cohort {
  periodStart: string;
  periodEnd: string;
  granularity: "week" | "month";
  days: number[];
  rows: CohortRow[];
}

export interface LostReasonItem {
  reason: string;
  category: string;
  count: number;
  percent: number;
  keywords: string[];
}

export interface LostReasonByStage {
  stage: string;
  count: number;
  topReason: string;
}

export interface LostReasons {
  periodStart: string;
  periodEnd: string;
  totalLost: number;
  totalAnalyzed: number;
  reasons: LostReasonItem[];
  byStage: LostReasonByStage[];
}

export interface ForecastByStage {
  stage: string;
  openLeads: number;
  historicalConversionRate: number;
  projectedConversions: number;
  projectedRevenue: number;
}

export interface ForecastTimeline {
  date: string;
  projected: number;
  lowerBound: number;
  upperBound: number;
}

export interface Forecast {
  asOf: string;
  horizonDays: number;
  openLeadsTotal: number;
  projectedConversions: number;
  projectedRevenue: number;
  overallConversionRate: number;
  byStage: ForecastByStage[];
  timeline: ForecastTimeline[];
}

export interface GeoCity {
  city: string;
  state: string;
  leads: number;
  conversions: number;
  conversionRate: number;
  lat: number;
  lng: number;
}

export interface GeoState {
  state: string;
  stateName: string;
  leads: number;
  conversions: number;
}

export interface GeoPoint {
  leadId: number;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  converted: boolean;
}

export interface GeoLeads {
  periodStart: string;
  periodEnd: string;
  totalLeads: number;
  leadsWithGeo: number;
  cities: GeoCity[];
  states: GeoState[];
  points: GeoPoint[];
}

export interface QualityScoreItem {
  source: string;
  leads: number;
  conversions: number;
  conversionRate: number;
  qualityScore: number;
  tier: "S" | "A" | "B" | "C" | "D";
  avgTimeToConvertHours: number;
  responseRate: number;
}

export interface QualityScore {
  periodStart: string;
  periodEnd: string;
  totalLeads: number;
  totalConversions: number;
  sources: QualityScoreItem[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

const BASE = "/api/insights";

export const insightsService = {
  async listCapiEvents(params: PeriodFilters & {
    eventName?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<CapiEventList> {
    const { data } = await api.get<CapiEventList>(`${BASE}/capi/events`, {
      params: cleanParams(params),
    });
    return data;
  },

  async getCapiEvent(id: string): Promise<CapiEvent> {
    const { data } = await api.get<CapiEvent>(`${BASE}/capi/events/${encodeURIComponent(id)}`);
    return data;
  },

  async retryCapiEvent(id: string): Promise<CapiEvent> {
    const { data } = await api.post<CapiEvent>(`${BASE}/capi/events/${encodeURIComponent(id)}/retry`);
    return data;
  },

  async pixelHealth(params: PeriodFilters = {}): Promise<PixelHealth> {
    const { data } = await api.get<PixelHealth>(`${BASE}/capi/pixel-health`, {
      params: cleanParams(params),
    });
    return data;
  },

  async leadAttributionPath(leadId: number): Promise<AttributionPath> {
    const { data } = await api.get<AttributionPath>(`${BASE}/attribution/leads/${leadId}/path`);
    return data;
  },

  async attributionSummary(params: PeriodFilters = {}): Promise<AttributionSummary> {
    const { data } = await api.get<AttributionSummary>(`${BASE}/attribution/summary`, {
      params: cleanParams(params),
    });
    return data;
  },

  async utm(params: PeriodFilters = {}): Promise<UtmExplorer> {
    const { data } = await api.get<UtmExplorer>(`${BASE}/utm`, {
      params: cleanParams(params),
    });
    return data;
  },

  async sla(params: PeriodFilters & { targetMinutes?: number } = {}): Promise<SlaResponse> {
    const { data } = await api.get<SlaResponse>(`${BASE}/sla`, {
      params: cleanParams(params),
    });
    return data;
  },

  async heatmap(params: PeriodFilters = {}): Promise<Heatmap> {
    const { data } = await api.get<Heatmap>(`${BASE}/heatmap`, {
      params: cleanParams(params),
    });
    return data;
  },

  async cohort(params: PeriodFilters & { granularity?: "week" | "month" } = {}): Promise<Cohort> {
    const { data } = await api.get<Cohort>(`${BASE}/cohort`, {
      params: cleanParams(params),
    });
    return data;
  },

  async lostReasons(params: PeriodFilters = {}): Promise<LostReasons> {
    const { data } = await api.get<LostReasons>(`${BASE}/lost-reasons`, {
      params: cleanParams(params),
    });
    return data;
  },

  async forecast(params: { unitId?: number; horizonDays?: number } = {}): Promise<Forecast> {
    const { data } = await api.get<Forecast>(`${BASE}/forecast`, {
      params: cleanParams(params),
    });
    return data;
  },

  async geo(params: PeriodFilters = {}): Promise<GeoLeads> {
    const { data } = await api.get<GeoLeads>(`${BASE}/geo`, {
      params: cleanParams(params),
    });
    return data;
  },

  async qualityScore(params: PeriodFilters = {}): Promise<QualityScore> {
    const { data } = await api.get<QualityScore>(`${BASE}/quality-score`, {
      params: cleanParams(params),
    });
    return data;
  },
};

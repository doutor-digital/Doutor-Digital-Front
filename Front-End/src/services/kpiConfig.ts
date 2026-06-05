import { api } from "@/lib/api";
import { toInt } from "@/lib/http";

/** Tipos de fonte de um KPI (devem casar com KpiSourceTypes no back-end). */
export type KpiSourceType =
  | "kommo_stage"
  | "custom_field_count"
  | "custom_field_sum"
  | "stage_field_filter";

/** Parâmetros da fonte — o shape usado varia conforme o source_type. */
export interface KpiSourceConfig {
  /** kommo_stage / stage_field_filter: status_ids da Kommo. */
  stageIds?: number[];
  /** custom_field_*: id do campo customizado da Kommo. */
  fieldId?: number;
  /** custom_field_*: code do campo (alternativa ao fieldId). */
  fieldCode?: string | null;
  /** custom_field_count / stage_field_filter: valores que contam como match. */
  matchValues?: string[];
}

export interface KpiCatalogItem {
  key: string;
  label: string;
  description: string;
}

/** Como o KPI custom é exibido. */
export type KpiDisplayType = "number" | "source_chart";

export interface KpiConfigItem {
  kpi_key: string;
  source_type: KpiSourceType;
  config: KpiSourceConfig;
  /** KPI criado do zero (chave gerada + nome/cor próprios). */
  is_custom?: boolean;
  display_name?: string | null;
  accent_color?: string | null;
  display_type?: KpiDisplayType;
  sort_order?: number;
  updated_by_email?: string | null;
  updated_at?: string | null;
}

/** Item para salvar (upsert) — inclui os campos de KPI custom. */
export interface KpiConfigSaveItem {
  kpi_key: string;
  source_type: KpiSourceType;
  config: KpiSourceConfig;
  is_custom?: boolean;
  display_name?: string | null;
  accent_color?: string | null;
  display_type?: KpiDisplayType;
  sort_order?: number;
}

/** Uma fatia do gráfico de um KPI custom (ex.: "Instagram" → 42). */
export interface KpiBreakdownItem {
  label: string;
  value: number;
}

/** KPI custom já resolvido (vem no dashboard-overview, com o valor do período). */
export interface CustomKpi {
  key: string;
  label: string;
  color?: string | null;
  value: number;
  source_type: KpiSourceType;
  display_type?: KpiDisplayType;
  breakdown?: KpiBreakdownItem[];
  sort_order: number;
}

export interface KpiPreviewResult {
  value: number;
  sample_size: number;
  note?: string | null;
}

/** Um lead na lista de drill-down de um KPI. */
export interface KpiLeadItem {
  id: number;
  external_id: number;
  name: string;
  phone?: string | null;
  source?: string | null;
  channel?: string | null;
  current_stage?: string | null;
  current_stage_id?: number | null;
  lead_type?: string | null;
  has_appointment: boolean;
  has_payment: boolean;
  created_at: string;
  matched_value?: string | null;
}

export interface KpiLeadsResult {
  items: KpiLeadItem[];
  total: number;
  truncated: boolean;
  note?: string | null;
}

export interface CustomFieldValueCount {
  value: string;
  count: number;
}

export interface CustomFieldSummary {
  field_id: number;
  field_name: string;
  field_code?: string | null;
  type: string;
  filled: number;
  distinct_values: number;
  top_values: CustomFieldValueCount[];
}

export interface CustomFieldsSummaryResult {
  total_leads: number;
  fields: CustomFieldSummary[];
  truncated: boolean;
}

export interface SexoOutcomeRow {
  sexo: string;
  total: number;
  agendou: number;
  compareceu: number;
  fechou: number;
  faltou: number;
}

export interface ValueCount {
  value: string;
  count: number;
}

export interface CustomFieldsCrossAnalysis {
  total_leads: number;
  sexo_by_outcome: SexoOutcomeRow[];
  tratamento_indicado: ValueCount[];
  tratamento_fechado: ValueCount[];
  motivo_nao_agendamento: ValueCount[];
  profissao: ValueCount[];
  origem: ValueCount[];
  responsavel_agendamento: ValueCount[];
  qualificacao: ValueCount[];
}

export interface AgeStat {
  avg: number;
  count: number;
}

export interface UpcomingAppt {
  lead_id: number;
  name: string;
  phone?: string | null;
  scheduled_at: string;
  days_until: number;
}

export interface LeadProfileFieldConfig {
  birthdate_field_id?: number | null;
  appointment_field_id?: number | null;
  doctor_field_id?: number | null;
}

export interface LeadProfileAnalytics {
  total_leads: number;
  age: {
    overall: AgeStat;
    agendou: AgeStat;
    compareceu: AgeStat;
    fechou: AgeStat;
    faltou: AgeStat;
  };
  upcoming: UpcomingAppt[];
  doctors: Array<{ label: string; count: number }>;
  outcomes: { contato: number; agendou: number; compareceu: number; fechou: number; faltou: number };
}

export const kpiConfigService = {
  /** Catálogo dos KPIs mapeáveis + tipos de fonte disponíveis. */
  async catalog(): Promise<{ items: KpiCatalogItem[]; source_types: KpiSourceType[] }> {
    const { data } = await api.get<{ items: KpiCatalogItem[]; source_types: KpiSourceType[] }>(
      "/api/config/kpis/catalog",
    );
    return { items: data?.items ?? [], source_types: data?.source_types ?? [] };
  },

  /** Mapeamentos salvos de uma unidade. */
  async list(unitId: number | string): Promise<KpiConfigItem[]> {
    const id = toInt(unitId);
    if (!id) return [];
    const { data } = await api.get<{ items: KpiConfigItem[] }>("/api/config/kpis", {
      params: { unitId: id },
    });
    return data?.items ?? [];
  },

  /** Salva (upsert) os mapeamentos da unidade. */
  async save(
    unitId: number | string,
    items: KpiConfigSaveItem[],
  ): Promise<{ count: number }> {
    const id = toInt(unitId);
    const { data } = await api.put<{ count: number }>(
      "/api/config/kpis",
      { items },
      { params: { unitId: id } },
    );
    return data;
  },

  /** Remove um KPI (custom) da unidade. */
  async remove(unitId: number | string, kpiKey: string): Promise<void> {
    const id = toInt(unitId);
    await api.delete(`/api/config/kpis/${encodeURIComponent(kpiKey)}`, {
      params: { unitId: id },
    });
  },

  /** Drill-down: os leads por trás de um KPI (resolve a fonte salva por kpi_key). */
  async drillLeads(
    unitId: number | string | null | undefined,
    payload: {
      kpi_key: string;
      source_type?: KpiSourceType;
      config?: KpiSourceConfig;
      date_from?: string;
      date_to?: string;
    },
  ): Promise<KpiLeadsResult> {
    const id = toInt(unitId ?? 0);
    const { data } = await api.post<KpiLeadsResult>("/webhooks/dashboard/kpi-leads", payload, {
      params: id ? { unitId: id } : {},
    });
    return {
      items: data?.items ?? [],
      total: data?.total ?? 0,
      truncated: Boolean(data?.truncated),
      note: data?.note ?? null,
    };
  },

  /** Métricas de todos os campos customizados do período (perfil do lead). */
  async customFieldsSummary(
    unitId: number | string | null | undefined,
    range?: { date_from?: string; date_to?: string },
  ): Promise<CustomFieldsSummaryResult> {
    const id = toInt(unitId ?? 0);
    const { data } = await api.get<CustomFieldsSummaryResult>(
      "/webhooks/dashboard/custom-fields-summary",
      { params: { ...(id ? { unitId: id } : {}), dateFrom: range?.date_from, dateTo: range?.date_to } },
    );
    return {
      total_leads: data?.total_leads ?? 0,
      fields: data?.fields ?? [],
      truncated: Boolean(data?.truncated),
    };
  },

  /** Análises cruzadas: Sexo × desfecho + top values de Tratamento/Motivo/Profissão/etc. */
  async customFieldsCrossAnalysis(
    unitId: number | string | null | undefined,
    range?: { date_from?: string; date_to?: string },
  ): Promise<CustomFieldsCrossAnalysis> {
    const id = toInt(unitId ?? 0);
    const { data } = await api.get<CustomFieldsCrossAnalysis>(
      "/webhooks/dashboard/custom-fields-cross-analysis",
      { params: { ...(id ? { unitId: id } : {}), dateFrom: range?.date_from, dateTo: range?.date_to } },
    );
    return {
      total_leads: data?.total_leads ?? 0,
      sexo_by_outcome: data?.sexo_by_outcome ?? [],
      tratamento_indicado: data?.tratamento_indicado ?? [],
      tratamento_fechado: data?.tratamento_fechado ?? [],
      motivo_nao_agendamento: data?.motivo_nao_agendamento ?? [],
      profissao: data?.profissao ?? [],
      origem: data?.origem ?? [],
      responsavel_agendamento: data?.responsavel_agendamento ?? [],
      qualificacao: data?.qualificacao ?? [],
    };
  },

  /** Lê o mapeamento de campos do Perfil do Lead (nascimento/agendamento/doutor). */
  async getLeadProfileConfig(unitId: number | string): Promise<LeadProfileFieldConfig> {
    const id = toInt(unitId);
    if (!id) return {};
    const { data } = await api.get<LeadProfileFieldConfig>("/api/config/kpis/lead-profile", {
      params: { unitId: id },
    });
    return data ?? {};
  },

  /** Salva o mapeamento de campos do Perfil do Lead. */
  async saveLeadProfileConfig(unitId: number | string, body: LeadProfileFieldConfig): Promise<void> {
    const id = toInt(unitId);
    await api.put("/api/config/kpis/lead-profile", body, { params: { unitId: id } });
  },

  /** Leads com agendamento nos próximos N dias (sino global). */
  async upcomingAppointments(
    unitId: number | string | null | undefined,
    days = 7,
  ): Promise<{ items: UpcomingAppt[] }> {
    const id = toInt(unitId ?? 0);
    const { data } = await api.get<{ items: UpcomingAppt[] }>(
      "/webhooks/dashboard/upcoming-appointments",
      { params: { ...(id ? { unitId: id } : {}), days } },
    );
    return { items: data?.items ?? [] };
  },

  /** Perfil avançado do lead (idade por desfecho, alertas de agendamento, doutor). */
  async leadProfile(
    unitId: number | string | null | undefined,
    range?: { date_from?: string; date_to?: string; upcoming_days?: number },
  ): Promise<LeadProfileAnalytics> {
    const id = toInt(unitId ?? 0);
    const { data } = await api.get<LeadProfileAnalytics>("/webhooks/dashboard/lead-profile", {
      params: {
        ...(id ? { unitId: id } : {}),
        dateFrom: range?.date_from,
        dateTo: range?.date_to,
        upcomingDays: range?.upcoming_days,
      },
    });
    return data;
  },

  /** Calcula o número de um KPI ao vivo (pré-visualização antes de salvar). */
  async preview(
    unitId: number | string,
    payload: {
      source_type: KpiSourceType;
      config: KpiSourceConfig;
      date_from?: string;
      date_to?: string;
    },
  ): Promise<KpiPreviewResult> {
    const id = toInt(unitId);
    const { data } = await api.post<KpiPreviewResult>("/api/config/kpis/preview", payload, {
      params: { unitId: id },
    });
    return data;
  },
};

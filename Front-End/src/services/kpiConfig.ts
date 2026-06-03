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

export interface KpiConfigItem {
  kpi_key: string;
  source_type: KpiSourceType;
  config: KpiSourceConfig;
  updated_by_email?: string | null;
  updated_at?: string | null;
}

export interface KpiPreviewResult {
  value: number;
  sample_size: number;
  note?: string | null;
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
    items: Array<{ kpi_key: string; source_type: KpiSourceType; config: KpiSourceConfig }>,
  ): Promise<{ count: number }> {
    const id = toInt(unitId);
    const { data } = await api.put<{ count: number }>(
      "/api/config/kpis",
      { items },
      { params: { unitId: id } },
    );
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

import { api } from "@/lib/api";
import { asArray, cleanParams, toInt } from "@/lib/http";
import type {
  ApiCountPayload,
  CreateUnitInput,
  Unit,
  UpdateUnitInput,
} from "@/types";

export interface KommoPipelineStatus {
  id: number;
  name: string;
  color?: string | null;
  type: number;
  pipeline_id: number;
}

export interface KommoPipeline {
  id: number;
  name: string;
  is_main: boolean;
  statuses: KommoPipelineStatus[];
}

export interface KommoCustomFieldEnum {
  id: number;
  value: string;
  code?: string | null;
}

export interface KommoCustomField {
  id: number;
  name: string;
  /** "text" | "select" | "multiselect" | "date" | "numeric" | "checkbox" | … */
  type: string;
  code?: string | null;
  is_api_only: boolean;
  enums: KommoCustomFieldEnum[];
}

export const unitsService = {
  async list(): Promise<Unit[]> {
    const { data } = await api.get<Unit[]>("/units");
    return asArray<Unit>(data);
  },

  /** Lista os pipelines/funis da Kommo da unidade — usado pra traduzir status_id em nome. */
  async kommoPipelines(unitId: number | string): Promise<KommoPipeline[]> {
    const id = toInt(unitId);
    if (!id) return [];
    const { data } = await api.get<KommoPipeline[]>(`/units/${id}/kommo-pipelines`);
    return asArray<KommoPipeline>(data);
  },

  /** Lista as definições de custom fields da Kommo (texto/select/multiselect/etc.). */
  async kommoCustomFields(unitId: number | string): Promise<KommoCustomField[]> {
    const id = toInt(unitId);
    if (!id) return [];
    const { data } = await api.get<KommoCustomField[]>(`/units/${id}/kommo-custom-fields`);
    return asArray<KommoCustomField>(data);
  },

  /** Busca uma unidade pelo seu Id interno (não clinicId). */
  async getById(id: number | string): Promise<Unit> {
    const unitId = toInt(id);
    if (!unitId) throw new Error("id inválido para /units/{id}");
    const { data } = await api.get<Unit>(`/units/${unitId}`);
    return data;
  },

  /** Cria uma nova unidade. O backend gera o slug e a URL do webhook. */
  async create(input: CreateUnitInput): Promise<Unit> {
    const { data } = await api.post<Unit>("/units", input);
    return data;
  },

  /**
   * Upload da foto/logo da unidade pra API. Retorna a URL absoluta
   * já hospedada em /uploads/units/. Cola essa URL em `photoUrl`
   * ao chamar `create`/`update`.
   */
  async uploadPhoto(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post<{ url: string }>("/units/upload-photo", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.url;
  },

  /**
   * Puxa leads/contatos existentes da Kommo via REST e ingere pelo mesmo
   * pipeline do webhook (idempotente). Aceita o token via body ou usa o
   * que ja esteja salvo na unidade.
   */
  /**
   * Por padrão usa fast=true (pula re-fetch de custom_fields nulos), que evita
   * o timeout de 5min do gateway do Railway em unidades grandes. Passa
   * `deep: true` em opts pra rodar o modo completo (lento, pode 502).
   */
  async syncFromKommo(
    unitId: number | string,
    opts: { accessToken?: string; persistToken?: boolean; maxLeads?: number; deep?: boolean } = {},
  ): Promise<{
    success: boolean;
    error?: string | null;
    pagesFetched: number;
    leadsFetched: number;
    contactsFetched: number;
    leadsPersisted: number;
    durationMs: number;
  }> {
    const id = toInt(unitId);
    if (!id) throw new Error("id inválido para sync");
    const fast = !opts.deep; // default = fast
    const { data } = await api.post(
      `/units/${id}/sync-from-kommo`,
      {
        accessToken: opts.accessToken,
        persistToken: opts.persistToken ?? true,
        maxLeads: opts.maxLeads,
      },
      {
        params: fast ? { fast: true } : undefined,
        // Sync rápido completa em <1min, modo deep pode levar até 10min.
        timeout: opts.deep ? 600_000 : 120_000,
      },
    );
    return data;
  },

  /** Atualiza os dados de uma unidade (por Id interno). */
  async update(id: number | string, input: UpdateUnitInput): Promise<Unit> {
    const unitId = toInt(id);
    if (!unitId) throw new Error("id inválido para /units/{id}");
    const { data } = await api.put<Unit>(`/units/${unitId}`, input);
    return data;
  },

  /** Remove uma unidade (só se não houver leads vinculados). */
  async remove(id: number | string): Promise<void> {
    const unitId = toInt(id);
    if (!unitId) throw new Error("id inválido para /units/{id}");
    await api.delete(`/units/${unitId}`);
  },

  /** Compat: get-or-create por clinicId (tenant). */
  async getOrCreate(clinicId: number | string): Promise<Unit> {
    const id = toInt(clinicId);
    if (!id) throw new Error("clinicId inválido para /units/by-clinic/{clinicId}");

    const { data } = await api.get<Unit>(`/units/by-clinic/${id}`);
    return data;
  },

  /** Compat: renomeia por clinicId (body = string simples). */
  async updateName(clinicId: number | string, name: string): Promise<Unit> {
    const id = toInt(clinicId);
    if (!id) throw new Error("clinicId inválido para /units/by-clinic/{clinicId}");

    const { data } = await api.put<Unit>(`/units/by-clinic/${id}`, name, {
      headers: { "Content-Type": "application/json" },
    });

    return data;
  },

  /**
   * Dispara o backfill do KPI Resgate sob demanda (em vez de esperar o job de 24h).
   * Lê os eventos de mudança do campo "Tentativas de resgastes" da Kommo e grava
   * em recovery_attempts. Idempotente — rerodar não duplica.
   */
  async runResgateBackfill(
    unitId: number | string,
    opts: { maxPages?: number } = {},
  ): Promise<{
    unit: { id: number; name: string };
    scanned: number;
    inserted: number;
    hitCap: boolean;
    oldest: string | null;
    error?: string | null;
  }> {
    const id = toInt(unitId);
    if (!id) throw new Error("id inválido para resgate-backfill");
    const { data } = await api.post(
      `/api/admin/resgate-backfill/${id}`,
      null,
      {
        params: cleanParams({ maxPages: opts.maxPages }),
        timeout: 120_000,
      },
    );
    return data;
  },

  async quantityLeads(clinicId?: number | string): Promise<number> {
    const { data } = await api.get<ApiCountPayload | number>("/units/quantity-leads", {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });

    if (typeof data === "number") return data;
    return data?.total ?? data?.count ?? 0;
  },
};

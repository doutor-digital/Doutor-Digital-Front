import { api } from "@/lib/api";
import { asArray, cleanParams, toInt } from "@/lib/http";
import type {
  ApiCountPayload,
  CreateUnitInput,
  Unit,
  UpdateUnitInput,
} from "@/types";

export const unitsService = {
  async list(): Promise<Unit[]> {
    const { data } = await api.get<Unit[]>("/units");
    return asArray<Unit>(data);
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
  async syncFromKommo(
    unitId: number | string,
    opts: { accessToken?: string; persistToken?: boolean; maxLeads?: number } = {},
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
    const { data } = await api.post(
      `/units/${id}/sync-from-kommo`,
      {
        accessToken: opts.accessToken,
        persistToken: opts.persistToken ?? true,
        maxLeads: opts.maxLeads,
      },
      // Sync pode demorar — pagina 250/vez na Kommo + busca contatos em lote.
      // 5k leads ≈ 1-3 min; o backend roda até 10min mesmo se a conexão cair.
      { timeout: 600_000 },
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

  async quantityLeads(clinicId?: number | string): Promise<number> {
    const { data } = await api.get<ApiCountPayload | number>("/units/quantity-leads", {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });

    if (typeof data === "number") return data;
    return data?.total ?? data?.count ?? 0;
  },
};

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

import { api } from "@/lib/api";

/**
 * Payload completo de um filtro salvo — espelha o estado dos filtros do dashboard.
 * `stageFilter` é serializado como array (o estado na tela é um Set<string>).
 */
export interface SavedFilterPayload {
  rangeKey: "ano" | "mes" | "semana" | "dia";
  customFrom: string;       // "yyyy-mm-dd" ou ""
  customTo: string;         // "yyyy-mm-dd" ou ""
  customFromTime: string;   // "HH:mm" ou ""
  customToTime: string;     // "HH:mm" ou ""
  sourceFilter: string;
  attendantFilter: string;
  responsibleFilter: string;
  stageFilter: string[];
}

/** Filtro salvo (leitura da API). */
export interface SavedFilterItem {
  id: number;
  name: string;
  filter: SavedFilterPayload;
  sort_order: number;
  updated_by_email?: string | null;
  updated_at: string;
}

export interface SavedFilterSaveBody {
  name: string;
  filter: SavedFilterPayload;
  sort_order: number;
}

export const savedFiltersService = {
  async list(): Promise<SavedFilterItem[]> {
    const { data } = await api.get<{ items: SavedFilterItem[] }>("/api/saved-filters");
    return data?.items ?? [];
  },

  async create(body: SavedFilterSaveBody): Promise<SavedFilterItem> {
    const { data } = await api.post<SavedFilterItem>("/api/saved-filters", body);
    return data;
  },

  async update(id: number, body: SavedFilterSaveBody): Promise<SavedFilterItem> {
    const { data } = await api.put<SavedFilterItem>(`/api/saved-filters/${id}`, body);
    return data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/api/saved-filters/${id}`);
  },
};

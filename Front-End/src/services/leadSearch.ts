import { api } from "@/lib/api";

export interface FilterEntry {
  campo: string;
  operador: string;
  valor: unknown;
}

export interface ParsedFilters {
  operadorLogico: "E" | "OU";
  filtros: FilterEntry[];
  observation?: string | null;
}

export interface LeadResultDto {
  id: number;
  externalId: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  currentStage?: string | null;
  currentStageId?: number | null;
  /** Nome humano resolvido via Kommo pipelines (ex.: "Lead de entrada"). */
  currentStageName?: string | null;
  source?: string | null;
  campaign?: string | null;
  price?: number | null;
  createdAt: string;
  updatedAt: string;
  tagsJson?: string | null;
}

export interface LeadSearchResult {
  parsedFilters: ParsedFilters;
  appliedSlugs: string[];
  ignoredSlugs: string[];
  leads: LeadResultDto[];
  totalMatched: number;
  limitedTo: number;
  durationSec: number;
  observation?: string | null;
}

export const leadSearchService = {
  async search(payload: {
    query: string;
    unitId: number;
    tenantId?: number | null;
    limit?: number;
  }): Promise<LeadSearchResult> {
    const { data } = await api.post<LeadSearchResult>(
      "/api/ai/search-leads",
      {
        query: payload.query,
        unitId: payload.unitId,
        limit: payload.limit ?? 50,
      },
      {
        timeout: 90_000,
        params: payload.tenantId ? { tenantId: payload.tenantId } : {},
      },
    );
    return data;
  },
};

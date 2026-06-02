import { api } from "@/lib/api";
import { cleanParams } from "@/lib/http";
import type {
  KommoDedupJob,
  LeadDuplicateDeleteJob,
  LeadDuplicatesReport,
  StartKommoDedupResponse,
  StartLeadDuplicateDeleteJobResponse,
} from "@/types/leadDuplicates";

/** Consome /leads/admin/duplicates* — dedup de leads (mantém o mais avançado). */
export const leadDuplicatesService = {
  async listDuplicates(params: {
    tenantId?: number;
    ignoreTenant?: boolean;
    mode?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<LeadDuplicatesReport> {
    const { data } = await api.get<LeadDuplicatesReport>("/leads/admin/duplicates", {
      params: cleanParams(params),
    });
    return data;
  },

  async startDeleteJob(params: {
    tenantId?: number;
    ignoreTenant?: boolean;
    batchSize?: number;
    tagInKommo?: boolean;
    mode?: string;
  }): Promise<StartLeadDuplicateDeleteJobResponse> {
    const { data } = await api.post<StartLeadDuplicateDeleteJobResponse>(
      "/leads/admin/duplicates/jobs",
      params,
    );
    return data;
  },

  async getDeleteJob(jobId: string): Promise<LeadDuplicateDeleteJob> {
    const { data } = await api.get<LeadDuplicateDeleteJob>(
      `/leads/admin/duplicates/jobs/${encodeURIComponent(jobId)}`,
    );
    return data;
  },

  async cancelDeleteJob(jobId: string): Promise<LeadDuplicateDeleteJob> {
    const { data } = await api.delete<LeadDuplicateDeleteJob>(
      `/leads/admin/duplicates/jobs/${encodeURIComponent(jobId)}`,
    );
    return data;
  },

  // ─── Dedup DIRETO na Kommo (lê a API ao vivo, marca a tag DUPLICADO lá) ───
  async startKommoDedup(params: { unitId: number; mode?: string }): Promise<StartKommoDedupResponse> {
    const { data } = await api.post<StartKommoDedupResponse>("/leads/kommo-dedup/jobs", params);
    return data;
  },

  async getKommoDedupJob(jobId: string): Promise<KommoDedupJob> {
    const { data } = await api.get<KommoDedupJob>(
      `/leads/kommo-dedup/jobs/${encodeURIComponent(jobId)}`,
    );
    return data;
  },
};

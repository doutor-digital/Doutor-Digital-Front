import { api } from "@/lib/api";
import { cleanParams } from "@/lib/http";
import type {
  LeadDuplicateDeleteJob,
  LeadDuplicatesReport,
  StartLeadDuplicateDeleteJobResponse,
} from "@/types/leadDuplicates";

/** Consome /leads/admin/duplicates* — dedup de leads (mantém o mais avançado). */
export const leadDuplicatesService = {
  async listDuplicates(params: {
    tenantId?: number;
    ignoreTenant?: boolean;
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
};

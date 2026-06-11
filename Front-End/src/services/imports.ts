import { api } from "@/lib/api";

export interface CloudiaSampleMatch {
  csvName: string;
  dbName: string;
  dataOrigem: string;
  dbLeadId: number;
}

export interface CloudiaImportResult {
  total_rows: number;
  duplicates_removed: number;
  unique_rows: number;
  matched: number;
  ambiguous: number;
  missed: number;
  invalid_input: number;
  updated: number;
  dry_run: boolean;
  distribution_by_month: Record<string, number>;
  sample_matches: CloudiaSampleMatch[];
  sample_duplicates: string[];
  sample_missed: string[];
  duration_ms: number;
  batch_id?: number | null;
}

export interface CloudiaImportBatch {
  id: number;
  unit_id: number;
  filename?: string | null;
  status: "applied" | "reverted";
  total_rows: number;
  matched: number;
  updated: number;
  update_lead_type: boolean;
  created_at: string;
  uploaded_by_user_id?: number | null;
  reverted_at?: string | null;
  reverted_by_user_id?: number | null;
}

export interface CloudiaRevertResult {
  batch_id: number;
  leads_restored: number;
  duration_ms: number;
}

export type KommoPatchField =
  | "tipo_lead" | "data_criacao" | "origem" | "interacao"
  | "motivo" | "tipo_resgate" | "data_agendamento"
  | "sexo" | "qualificacao" | "observacao";

export interface CloudiaKommoJob {
  id: string;
  batch_id: number;
  unit_id: number;
  status: "queued" | "running" | "completed" | "failed" | "cancelling" | "cancelled";
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  error_message?: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  cancel_requested?: boolean;
}

export interface ImportCloudiaParams {
  file: File;
  unitId: number;
  /** Se true (default), só simula — não escreve no banco. */
  dryRun?: boolean;
  /** Se true (default), marca os leads como `LeadType = "resgate"`. */
  updateLeadType?: boolean;
}

export const importsService = {
  async cloudiaCsv(params: ImportCloudiaParams): Promise<CloudiaImportResult> {
    const form = new FormData();
    form.append("file", params.file);
    form.append("unitId", String(params.unitId));
    form.append("dryRun", String(params.dryRun ?? true));
    form.append("updateLeadType", String(params.updateLeadType ?? true));

    const { data } = await api.post<CloudiaImportResult>(
      "/api/imports/cloudia-csv",
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300_000,
      }
    );
    return data;
  },

  async listBatches(unitId: number): Promise<CloudiaImportBatch[]> {
    const { data } = await api.get<CloudiaImportBatch[]>(
      `/api/imports/cloudia-csv/batches`,
      { params: { unitId } }
    );
    return Array.isArray(data) ? data : [];
  },

  async revertBatch(batchId: number): Promise<CloudiaRevertResult> {
    const { data } = await api.post<CloudiaRevertResult>(
      `/api/imports/cloudia-csv/batches/${batchId}/revert`,
      undefined,
      { timeout: 300_000 }
    );
    return data;
  },

  async startKommoPatch(batchId: number, fields: KommoPatchField[]): Promise<{ job_id: string; status: string; total: number }> {
    const { data } = await api.post(`/api/imports/cloudia-csv/batches/${batchId}/kommo-patch`, { fields });
    return data;
  },

  async getKommoJob(jobId: string): Promise<CloudiaKommoJob> {
    const { data } = await api.get<CloudiaKommoJob>(`/api/imports/cloudia-csv/kommo-jobs/${jobId}`);
    return data;
  },

  async listKommoJobs(unitId: number): Promise<CloudiaKommoJob[]> {
    const { data } = await api.get<CloudiaKommoJob[]>(`/api/imports/cloudia-csv/kommo-jobs`, { params: { unitId } });
    return Array.isArray(data) ? data : [];
  },

  async cancelKommoJob(jobId: string): Promise<void> {
    await api.post(`/api/imports/cloudia-csv/kommo-jobs/${jobId}/cancel`);
  },
};

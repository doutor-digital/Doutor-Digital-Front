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
};

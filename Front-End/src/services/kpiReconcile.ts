import { api } from "@/lib/api";

export type ReconcileKpi = "tratamentos" | "agendados" | "compareceu";

export interface SampleCorrection {
  leadId: number;
  leadName: string;
  from: string;
  to: string;
}
export interface SampleExclusion {
  leadId: number;
  leadName: string;
  currentStage: string;
}

export interface ReconcileResult {
  dryRun: boolean;
  kpiKey: string;
  unitId: number;
  csvRows: number;
  uniqueRows: number;
  matched: number;
  ambiguous: number;
  missed: number;
  matchedNoHistory: number;
  datesCorrected: number;
  exclusionsAdded: number;
  attendanceMarked: number;
  durationMs: number;
  sampleMissed: string[];
  sampleAmbiguous: string[];
  sampleNoHistory: string[];
  sampleCorrections: SampleCorrection[];
  sampleExclusions: SampleExclusion[];
}

const ENDPOINT: Record<ReconcileKpi, string> = {
  tratamentos: "/api/admin/kpi-reconcile/tratamentos",
  agendados: "/api/admin/kpi-reconcile/agendados",
  compareceu: "/api/admin/kpi-reconcile/compareceu",
};

export const kpiReconcileService = {
  async run(
    kpi: ReconcileKpi,
    params: { unitId: number; file: File; dryRun: boolean },
  ): Promise<ReconcileResult> {
    const fd = new FormData();
    fd.append("file", params.file);
    const { data } = await api.post<ReconcileResult>(ENDPOINT[kpi], fd, {
      params: { unitId: params.unitId, dryRun: params.dryRun },
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};

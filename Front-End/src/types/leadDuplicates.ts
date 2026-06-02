import type { DuplicateDeleteJobStatus } from "@/types";

export interface LeadDuplicateGroup {
  tenantId: number;
  phoneNormalized: string;
  count: number;
  keepLeadId: number;
  keepName: string;
  keepStage?: string | null;
  keepHasPayment: boolean;
  keepHasAppointment: boolean;
  keepPrice?: number | null;
  keepCreatedAt: string;
  deleteLeadIds: number[];
  deleteNames: string[];
}

export type LeadDedupMode = "phone" | "name";

export interface LeadDuplicatesReport {
  dryRun: boolean;
  mode: string;
  leadsScanned: number;
  groupsFound: number;
  leadsToDelete: number;
  page: number;
  pageSize: number;
  totalPages: number;
  groups: LeadDuplicateGroup[];
}

export interface LeadDuplicateDeleteJob {
  id: string;
  status: DuplicateDeleteJobStatus;
  tenantId: number | null;
  ignoreTenant: boolean;
  batchSize: number;
  tagInKommo: boolean;
  leadsToDeleteTotal: number;
  leadsDeleted: number;
  taggedInKommo: number;
  tagConfirmed: number;
  tagFailures: number;
  tagSkipped: number;
  groupsFound: number;
  batchesExecuted: number;
  progressPct: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  createdBy: string;
}

export interface StartLeadDuplicateDeleteJobResponse {
  jobId: string;
  status: DuplicateDeleteJobStatus;
}

/** Job que lê a Kommo ao vivo e marca a tag DUPLICADO lá (não depende do nosso banco). */
export interface KommoDedupJob {
  id: string;
  status: DuplicateDeleteJobStatus;
  unitId: number;
  tenantId: number | null;
  mode: string;
  leadsFetched: number;
  groupsFound: number;
  leadsToTag: number;
  tagged: number;
  confirmed: number;
  failed: number;
  progressPct: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  createdBy: string;
}

export interface StartKommoDedupResponse {
  jobId: string;
  status: DuplicateDeleteJobStatus;
}

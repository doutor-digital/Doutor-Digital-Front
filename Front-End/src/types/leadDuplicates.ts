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

export interface LeadDuplicatesReport {
  dryRun: boolean;
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
  tagFailures: number;
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

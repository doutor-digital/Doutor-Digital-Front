import { api } from "@/lib/api";

export interface WebhookExecutionSummary {
  id: number;
  provider: string;
  slug: string | null;
  unitId: number | null;
  unitName: string | null;
  tenantId: number | null;
  kommoSubdomain: string | null;
  receivedAt: string;
  durationMs: number;
  status: "success" | "failed" | "ignored" | string;
  statusCode: number;
  success: boolean;
  errorMessage: string | null;
  eventsParsed: number;
  leadsPersisted: number;
  formKeys: string | null;
  ip: string | null;
}

export interface WebhookExecutionDetail extends WebhookExecutionSummary {
  method: string;
  path: string;
  userAgent: string | null;
  contentType: string | null;
  contentLength: number | null;
  kommoAccountId: string | null;
  rawPayload: string | null;
  payloadTruncated: boolean;
  eventsSummary: string | null;
  responseBody: string | null;
  errorStack: string | null;
  formKeyCount: number;
}

export interface WebhookExecutionStats {
  total: number;
  success: number;
  failed: number;
  ignored: number;
  leadsPersisted: number;
  avgDurationMs: number;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
}

export interface WebhookExecutionListResponse {
  items: WebhookExecutionSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WebhookListFilters {
  unitId?: number;
  status?: "success" | "failed" | "ignored";
  provider?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export const webhooksMonitorService = {
  async list(filters: WebhookListFilters = {}): Promise<WebhookExecutionListResponse> {
    const { data } = await api.get<WebhookExecutionListResponse>(
      "/api/webhooks/executions",
      { params: filters },
    );
    return data;
  },

  async stats(filters: Pick<WebhookListFilters, "unitId" | "dateFrom" | "dateTo"> = {}): Promise<WebhookExecutionStats> {
    const { data } = await api.get<WebhookExecutionStats>(
      "/api/webhooks/executions/stats",
      { params: filters },
    );
    return data;
  },

  async getById(id: number): Promise<WebhookExecutionDetail> {
    const { data } = await api.get<WebhookExecutionDetail>(
      `/api/webhooks/executions/${id}`,
    );
    return data;
  },
};

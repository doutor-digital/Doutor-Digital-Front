import { api } from "@/lib/api";

export interface AuditLogItem {
  id: number;
  userId?: number;
  email?: string;
  userName?: string;
  role?: string;
  tenantId?: number;
  authMethod?: string;
  ip?: string;
  userAgent?: string;
  method: string;
  path: string;
  queryString?: string;
  statusCode: number;
  durationMs: number;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogQuery {
  from?: string;
  to?: string;
  userId?: number;
  email?: string;
  path?: string;
  ip?: string;
  statusCode?: number;
  page?: number;
  pageSize?: number;
}

export const auditService = {
  async query(filter: AuditLogQuery = {}): Promise<AuditLogPage> {
    const { data } = await api.get<AuditLogPage>("/api/audit-logs", {
      params: filter,
    });
    return data;
  },
};

import { api } from "@/lib/api";

export interface LoginSession {
  id: number;
  userId: number;
  email?: string | null;
  userName?: string | null;
  role?: string | null;
  tenantId?: number | null;
  authMethod?: string | null;
  ip?: string | null;
  device?: string | null;
  geoCountry?: string | null;
  geoRegion?: string | null;
  geoCity?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  geoConsent: boolean;
  geoConsentAt?: string | null;
  loginAt: string;
  lastSeenAt: string;
  activeSeconds: number;
  activeMinutes: number;
  endedAt?: string | null;
  endReason?: string | null;
  isActive: boolean;
}

export interface LoginSessionPage {
  items: LoginSession[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EntityChange {
  id: number;
  userId?: number | null;
  email?: string | null;
  role?: string | null;
  tenantId?: number | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  changesJson?: string | null;
  createdAt: string;
}

export interface EntityChangePage {
  items: EntityChange[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LocationConsent {
  userId: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  consentAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  lastSeenAt?: string | null;
  geoCity?: string | null;
}

export interface LoginSessionQuery {
  from?: string;
  to?: string;
  userId?: number;
  email?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface EntityChangeQuery {
  from?: string;
  to?: string;
  entityType?: string;
  entityId?: string;
  userId?: number;
  page?: number;
  pageSize?: number;
}

export const adminLogsService = {
  async loginSessions(filter: LoginSessionQuery): Promise<LoginSessionPage> {
    const { data } = await api.get<LoginSessionPage>("/api/admin/login-sessions", {
      params: filter,
      silent401: true,
    });
    return data;
  },

  async entityChanges(filter: EntityChangeQuery): Promise<EntityChangePage> {
    const { data } = await api.get<EntityChangePage>("/api/admin/entity-changes", {
      params: filter,
      silent401: true,
    });
    return data;
  },

  async locationConsents(): Promise<LocationConsent[]> {
    const { data } = await api.get<LocationConsent[]>("/api/admin/location-consents", {
      silent401: true,
    });
    return data;
  },
};

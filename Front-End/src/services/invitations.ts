import { api } from "@/lib/api";
import type { LoginResponse } from "@/services/auth";

export interface InvitationCreatePayload {
  email: string;
  unitId: number;
  role: "unit_user" | "sdr" | "manager";
}

export interface InvitationCreateResponse {
  id: number;
  email: string;
  acceptUrl: string;
  expiresAt: string;
}

export interface InvitationListItem {
  id: number;
  email: string;
  tenantId: number;
  unitId: number;
  unitName?: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  createdByName?: string;
}

export interface InvitationInfo {
  email: string;
  unitName?: string;
  role: string;
  expiresAt: string;
}

export const invitationsService = {
  async create(payload: InvitationCreatePayload): Promise<InvitationCreateResponse> {
    const { data } = await api.post<InvitationCreateResponse>(
      "/api/invitations",
      payload,
    );
    return data;
  },

  async list(unitId?: number): Promise<InvitationListItem[]> {
    const { data } = await api.get<InvitationListItem[]>("/api/invitations", {
      params: unitId ? { unitId } : undefined,
      silent401: true,
    });
    return data;
  },

  async revoke(id: number): Promise<void> {
    await api.delete(`/api/invitations/${id}`);
  },

  async getInfo(token: string): Promise<InvitationInfo> {
    const { data } = await api.get<InvitationInfo>(
      `/api/invitations/${encodeURIComponent(token)}/info`,
    );
    return data;
  },

  async accept(token: string, idToken: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>(
      `/api/invitations/${encodeURIComponent(token)}/accept`,
      { idToken },
    );
    return data;
  },
};

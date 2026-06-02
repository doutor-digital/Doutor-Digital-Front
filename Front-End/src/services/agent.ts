import { api } from "@/lib/api";
import { cleanParams } from "@/lib/http";
import type {
  AgentConversationDetail,
  AgentConversationList,
  AgentOverview,
} from "@/types/agent";

export interface AgentQuery {
  unitId?: number | null;
  dateFrom?: string;
  dateTo?: string;
}

export interface AgentListQuery extends AgentQuery {
  status?: string; // active | closed | handoff
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Consome os endpoints /api/agent/* (dados do agente-Dt). */
export const agentService = {
  async overview(q: AgentQuery = {}): Promise<AgentOverview> {
    const { data } = await api.get("/api/agent/overview", {
      params: cleanParams({ ...q, unitId: q.unitId ?? undefined }),
    });
    return data as AgentOverview;
  },

  async list(q: AgentListQuery = {}): Promise<AgentConversationList> {
    const { data } = await api.get("/api/agent/conversations", {
      params: cleanParams({ ...q, unitId: q.unitId ?? undefined }),
    });
    return data as AgentConversationList;
  },

  async detail(id: number, unitId?: number | null): Promise<AgentConversationDetail> {
    const { data } = await api.get(`/api/agent/conversations/${id}`, {
      params: cleanParams({ unitId: unitId ?? undefined }),
    });
    return data as AgentConversationDetail;
  },
};

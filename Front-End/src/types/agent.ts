// Tipos da I.A. (agente-Dt) — espelham os DTOs de AgentController no back-end.

export interface AgentDayPoint {
  date: string;
  count: number;
}

export interface AgentOverview {
  totalConversations: number;
  activeConversations: number;
  closedConversations: number;
  handoffConversations: number;
  totalMessages: number;
  avgMessagesPerConversation: number;
  handoffRate: number;
  leadsLinked: number;
  contactsLinked: number;
  tokensIn: number;
  tokensOut: number;
  seriesByDay: AgentDayPoint[];
}

export type AgentRole = "user" | "assistant" | "system" | "tool";

export interface AgentConversationListItem {
  id: number;
  externalId: string;
  agentName?: string | null;
  channel?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  status: string; // active | closed | handoff
  handedOff: boolean;
  messageCount: number;
  intent?: string | null;
  sentiment?: string | null;
  summary?: string | null;
  startedAt: string;
  lastMessageAt?: string | null;
  leadId?: number | null;
  contactId?: number | null;
}

export interface AgentConversationList {
  page: number;
  pageSize: number;
  total: number;
  items: AgentConversationListItem[];
}

export interface AgentMessage {
  id: number;
  role: AgentRole | string;
  content?: string | null;
  sentAt: string;
  toolName?: string | null;
}

export interface AgentConversationDetail extends AgentConversationListItem {
  handoffAt?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  endedAt?: string | null;
  firstMessageAt?: string | null;
  messages: AgentMessage[];
}

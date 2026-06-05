import { api } from "@/lib/api";
import { cleanParams } from "@/lib/http";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type Direcao = "entrada" | "saida";
export type TipoMensagem = "texto" | "imagem" | "audio" | "video" | "documento";

/**
 * Evento de mensagem — espelha 1:1 a linha da tabela `webhook_whatsapp_messages`
 * gravada pela API .NET a partir do webhook oficial do WhatsApp (sem n8n).
 *
 * Naming em snake_case porque é o contrato do backend; o front respeita.
 */
export interface MessageEvent {
  mensagem_id: string;
  lead_id: string;
  direcao: Direcao;
  timestamp: string;              // ISO 8601 UTC
  tipo: TipoMensagem;
  agente: string | null;          // null quando direcao = "entrada"
  campanha: string;               // herdada do lead na hora do ingest
}

export interface MessagesListParams {
  unitId?: number;
  from?: string;                  // ISO
  to?: string;                    // ISO
  campanha?: string;              // omitir/"todas" => sem filtro
  agente?: string;                // omitir/"todos" => sem filtro
  /** Paginação opcional — backend define o default. */
  limit?: number;
  cursor?: string;
}

export interface MessagesListResponse {
  items: MessageEvent[];
  nextCursor?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Serviço — endpoint ainda não implementado no backend (.NET)
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "/api/conversations";

export const messagesService = {
  /**
   * Lista eventos brutos. A página `ConversasAtendimentoPage` agrega no cliente
   * (1ª resposta, sem-resposta, heatmap, tabela por agente, eficiência).
   *
   * Quando o volume crescer, considere mover as agregações para o backend
   * em endpoints derivados (ex.: `/api/conversations/summary`).
   */
  async list(params: MessagesListParams = {}): Promise<MessagesListResponse> {
    const { data } = await api.get<MessagesListResponse>(`${BASE}/messages`, {
      params: cleanParams(params),
    });
    return data;
  },
};

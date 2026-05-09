// Camada de API do dashboard SDR.
// Por enquanto cobre apenas o endpoint de sincronização (botão "Sincronizar com Cloudia").
// Quando trocar o store de localStorage por backend, adicionar aqui os outros métodos
// (list/get/upsert/review/delete por entidade).

import { api } from "@/lib/api";
import type { SdrLead } from "@/types/sdr";

/**
 * Resposta do POST /api/sdr/leads/sync-from-cloudia.
 * O backend lê a tabela `leads` (legada, populada pelo webhook) e cria SdrLead
 * para cada um que ainda não existe em `sdr_leads`.
 */
export interface SdrSyncSummary {
  created: number;
  skipped: number;
  updated: number;
  failed: number;
  /** Os SdrLead recém-criados — pra mergiar imediatamente no localStorage. */
  items: SdrLeadResponseDto[];
}

export interface SdrLeadResponseDto {
  id: number;
  tenantId: number;
  externalId?: number;
  nome: string;
  telefone: string;
  tipo: string;
  origem: string;
  tipoResgate?: string;
  interacao: boolean;
  agendouConsulta: boolean;
  dataAgendamento?: string;
  motivoNaoAgendamento?: string;
  nomeResponsavel: string;
  login?: string;
  observacao?: string;
  situacao?: string;
  clinica?: string;
  dataOrigem: string;
  dataModificacao?: string;
  source: "cloudia" | "manual" | "importado";
  status: "pendente_revisao" | "aprovado" | "rejeitado";
  reviewedAt?: string;
  reviewedByUserId?: number;
  reviewedByName?: string;
  rejectionReason?: string;
  cloudiaFields: string[];
  cloudiaReceivedAt?: string;
  cloudiaWebhookEvent?: string;
  unitId?: number;
  attendantId?: number;
  importBatchId?: number;
  createdAt: string;
  updatedAt: string;
}

export const sdrService = {
  /**
   * Dispara backfill no backend: copia leads da tabela legada que ainda não estão
   * em sdr_leads. Idempotente — pode chamar quantas vezes quiser.
   */
  async syncFromCloudia(): Promise<SdrSyncSummary> {
    const r = await api.post<SdrSyncSummary>("/api/sdr/leads/sync-from-cloudia");
    return r.data;
  },
};

/**
 * Converte um SdrLeadResponseDto (formato do backend, IDs numéricos) para o formato
 * SdrLead do store local (IDs string, mesmas chaves PT-BR). Permite mesclar leads
 * vindos do sync com os leads que a SDR já tem em localStorage.
 */
export function sdrLeadFromBackend(dto: SdrLeadResponseDto): SdrLead {
  return {
    id: `sdr_be_${dto.id}`,
    externalId: dto.externalId,
    tenantId: dto.tenantId,
    nome: dto.nome,
    telefone: dto.telefone,
    tipo: (dto.tipo === "Resgate" ? "Resgate" : "Cadastro") as SdrLead["tipo"],
    origem: dto.origem,
    tipoResgate: dto.tipoResgate,
    interacao: dto.interacao,
    agendouConsulta: dto.agendouConsulta,
    dataAgendamento: dto.dataAgendamento,
    motivoNaoAgendamento: dto.motivoNaoAgendamento,
    nomeResponsavel: dto.nomeResponsavel,
    login: dto.login,
    observacao: dto.observacao,
    situacao: dto.situacao,
    clinica: dto.clinica,
    dataOrigem: dto.dataOrigem,
    dataModificacao: dto.dataModificacao,
    source: dto.source,
    status: dto.status,
    reviewedAt: dto.reviewedAt,
    reviewedByUserId: dto.reviewedByUserId?.toString(),
    reviewedByName: dto.reviewedByName,
    rejectionReason: dto.rejectionReason,
    cloudiaFields: (dto.cloudiaFields ?? []) as SdrLead["cloudiaFields"],
    cloudiaProvenance: dto.cloudiaReceivedAt
      ? {
          receivedAt: dto.cloudiaReceivedAt,
          webhookEvent: dto.cloudiaWebhookEvent,
          tenantId: dto.tenantId,
        }
      : undefined,
    createdAt: dto.createdAt,
  };
}

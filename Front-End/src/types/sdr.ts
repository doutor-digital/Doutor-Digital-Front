// Tipos do dashboard SDR unificado.
// Espelha a estrutura da planilha que as secretárias preenchiam manualmente,
// agora alimentada pelo webhook Kommo em tempo real.
//
// Convenções:
// - `sourceFields` é um set de chaves indicando quais campos vieram do webhook.
//   Se a chave está no set, o campo foi auto-preenchido e a UI deve renderizá-lo
//   com o indicador emerald (SourceFieldShell origin="crm").
// - `sourceProvenance.receivedAt` é a hora do recebimento do webhook — tooltip.

export type SourceProvenance = {
  receivedAt: string;
  webhookEvent?: string;
  tenantId?: string | number;
};

// ---------------------------------------------------------------------------
// SEÇÃO 1 — Cadastro Geral (Leads)
// ---------------------------------------------------------------------------
// 19 campos da planilha, mais 4 derivados (Ano/Mês de createdAt, etc.).
// Campos auto-preenchidos pelo Kommo: nome, telefone, origem, dataAgendamento
// (via stage), nomeResponsavel (assigned_user_name), login (assigned_user_email),
// observacao, situacao, clinica, dataOrigem, dataModificacao, interacao.
export interface SdrLead {
  id: string;
  externalId?: number; // data.id do payload Cloudia
  tenantId?: number; // data.clinic_id

  // Campos da planilha
  nome: string;
  telefone: string;
  tipo: "Cadastro" | "Resgate";
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

  dataOrigem: string; // data.created_at
  dataModificacao?: string; // data.last_updated_at

  // Origem do registro (define se passa por revisão ou já entra aprovado)
  source: "crm" | "manual" | "importado";

  // Status no fluxo de revisão CRM
  status: "pendente_revisao" | "aprovado" | "rejeitado";
  reviewedAt?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  rejectionReason?: string;

  // Provenance
  sourceFields: SdrSourceFieldKey[];
  sourceProvenance?: SourceProvenance;

  createdAt: string;
}

export type SdrSourceFieldKey =
  | "nome"
  | "telefone"
  | "origem"
  | "tipo"
  | "tipoResgate"
  | "interacao"
  | "agendouConsulta"
  | "dataAgendamento"
  | "nomeResponsavel"
  | "login"
  | "observacao"
  | "situacao"
  | "clinica"
  | "dataOrigem"
  | "dataModificacao";

// ---------------------------------------------------------------------------
// SEÇÃO 2 — Consultas Realizadas
// ---------------------------------------------------------------------------
export interface SdrConsulta {
  id: string;
  leadId: string;

  // Dados da consulta (todos manuais — Cloudia não traz)
  dataConsulta: string;
  valorConsulta: number;
  pago: boolean;

  recebimento1?: SdrRecebimento;
  recebimento2?: SdrRecebimento;

  status?: "compareceu" | "faltou" | "remarcou";
  tipoTratamentoIndicado?: string;
  valorTratamento?: number;
  fechouTratamento?: boolean;
  motivoNaoFechamento?: string;

  observacao?: string;
  createdAt: string;
}

export interface SdrRecebimento {
  valor: number;
  formaPagamento: string;
  data: string;
}

// ---------------------------------------------------------------------------
// SEÇÃO 3 — Tratamentos / Recebimentos
// ---------------------------------------------------------------------------
export interface SdrTratamento {
  id: string;
  consultaId: string;
  leadId: string;

  valor: number;
  recebimentos: SdrRecebimento[]; // até 4

  status?: "em_andamento" | "concluido" | "cancelado";
  tipoTratamento?: "longo_3m" | "curto_1m" | "medio_2m";
  descricao?: string;
  observacao?: string;
  situacao?: string;

  createdAt: string;
}

// ---------------------------------------------------------------------------
// SEÇÃO 4 — Tarefas
// ---------------------------------------------------------------------------
export interface SdrTarefa {
  id: string;
  dataVencimento: string; // ISO date
  nome: string;
  descricao?: string;
  prioridade: "baixa" | "media" | "alta";
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
  observacao?: string;
  createdAt: string;
  responsavel?: string; // login da SDR
}

// ---------------------------------------------------------------------------
// SEÇÃO 5 — Agenda / Eventos
// ---------------------------------------------------------------------------
export interface SdrAgendaEvento {
  id: string;
  data: string; // ISO date
  horaInicio: string; // "HH:MM"
  horaFim: string;
  descricao: string;
  nome: string;
  status: "agendado" | "confirmado" | "cancelado" | "realizado";
  observacao?: string;
  createdAt: string;
  responsavel?: string;
}

// ---------------------------------------------------------------------------
// SEÇÃO 6 — Metas das Secretárias
// ---------------------------------------------------------------------------
export interface SdrMeta {
  id: string;
  unidade: string;
  mes: string; // "YYYY-MM"
  login: string;
  secretaria: string;
  metaValor: number; // R$
  realCadastro: number;
  realResgate: number;
  qtdTotal: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// SDR Audit Log
// ---------------------------------------------------------------------------
// Toda ação importante (aprovação, rejeição, edição, criação manual, deleção)
// gera um SdrAuditLog. A chefe consulta na página /sdr/auditoria.
export interface SdrAuditLog {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  /** "sdr_lead.review_approved" | "sdr_lead.review_rejected" | "sdr_lead.created_manual"
   * | "sdr_lead.updated" | "sdr_lead.deleted" | etc. */
  action: string;
  /** "SdrLead" | "SdrConsulta" | "SdrTratamento" | ... */
  entityType: string;
  entityId: string;
  /** Resumo legível, ex.: "Aprovou revisão de João da Silva". */
  summary: string;
  beforeJson?: string;
  afterJson?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Estado completo do store SDR
// ---------------------------------------------------------------------------
export interface SdrState {
  leads: SdrLead[];
  consultas: SdrConsulta[];
  tratamentos: SdrTratamento[];
  tarefas: SdrTarefa[];
  agenda: SdrAgendaEvento[];
  metas: SdrMeta[];
  auditLogs: SdrAuditLog[];
}

// ---------------------------------------------------------------------------
// Listas de domínio
// ---------------------------------------------------------------------------
export const SDR_FORMAS_PAGAMENTO = [
  "Pix",
  "Dinheiro",
  "Débito",
  "Boleto",
  "Crédito 1x",
  "Crédito 2x",
  "Crédito 3x",
  "Crédito 4x",
  "Crédito 5x",
  "Crédito 6x",
  "Crédito 9x",
  "Crédito 12x",
  "Crédito 18x",
] as const;

export const SDR_TIPOS_TRATAMENTO = [
  { id: "longo_3m", label: "Longo (3 meses)", duracao: 90 },
  { id: "medio_2m", label: "Médio (2 meses)", duracao: 60 },
  { id: "curto_1m", label: "Curto (1 mês)", duracao: 30 },
] as const;

export const SDR_PRIORIDADES = ["baixa", "media", "alta"] as const;

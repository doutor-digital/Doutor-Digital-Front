// Mapeamento autoritativo Cloudia → cadastraai → LeadAnalytics.Api → Vite Dashboard.
//
// Como funciona o fluxo:
//   1. Empresa cola a URL `/api/empresas/{empresaId}/cloudia/webhook` no painel da Cloudia
//   2. Cloudia faz POST com CloudiaWebhookDto a cada evento (criar/atualizar/etc.)
//   3. Backend (.NET) valida secret HMAC, lê data.clinic_id, salva como Lead+Contact
//      tageado com o TenantId da empresa
//   4. cadastraai mostra no inbox para a secretária verificar e promover
//   5. Doutor-Digital-Front (Vite) lê o mesmo banco em modo read-only para os dashboards
//
// Cada empresa só vê suas próprias linhas — isolamento server-side via tenant_id no JWT.
// Para o webhook (sem JWT), o tenant é inferido pelo empresaId no path E pelo data.clinic_id
// salvo na config. Webhook com clinic_id divergente é rejeitado (defesa em profundidade).

import type { KommoFieldTarget } from '@/lib/cadastra/api'

export type CadastroFieldTarget =
  | KommoFieldTarget
  | 'observacao'
  | 'situacao'
  | 'clinica'
  | 'login'
  | 'dataOrigem'
  | 'dataModificacao'

// ----------------------------------------------------------------------------
// Mapeamento canônico: campos do payload do webhook Cloudia
// ----------------------------------------------------------------------------
// Este é o mapeamento REAL que o backend usa. As colunas das planilhas são
// derivadas destes campos.
export interface WebhookField {
  // Caminho dentro do payload da Cloudia (ex.: "data.name", "data.tags[].name").
  path: string
  cadastroTarget: CadastroFieldTarget | null
  netEntity: 'Lead' | 'Contact' | 'Unit' | 'Attendant' | 'User' | 'Payment' | null
  netField: string | null
  notes?: string
}

export const CLOUDIA_WEBHOOK_FIELDS: WebhookField[] = [
  { path: 'type',                            cadastroTarget: null,                   netEntity: null,        netField: null,                  notes: 'Evento (CUSTOMER_CREATED, CUSTOMER_UPDATED, etc.). Decide se é insert ou update.' },
  { path: 'data.id',                         cadastroTarget: null,                   netEntity: 'Lead',      netField: 'ExternalId',          notes: 'ID Cloudia. Chave de deduplicação.' },
  { path: 'data.clinic_id',                  cadastroTarget: 'clinica',              netEntity: 'Unit',      netField: 'ClinicId',            notes: 'CHAVE DE TENANT. Validado contra cloudiaClinicId da empresa antes de aceitar.' },
  { path: 'data.name',                       cadastroTarget: 'nome',                 netEntity: 'Lead',      netField: 'Name' },
  { path: 'data.phone',                      cadastroTarget: 'telefone',             netEntity: 'Contact',   netField: 'PhoneRaw',            notes: 'Normalizar p/ E.164 → Contact.PhoneNormalized (chave de dedup interna).' },
  { path: 'data.email',                      cadastroTarget: null,                   netEntity: 'Lead',      netField: 'Email' },
  { path: 'data.cpf',                        cadastroTarget: null,                   netEntity: 'Lead',      netField: 'Cpf' },
  { path: 'data.gender',                     cadastroTarget: null,                   netEntity: 'Lead',      netField: 'Gender' },
  { path: 'data.origin',                     cadastroTarget: 'origem',               netEntity: 'Lead',      netField: 'Source',              notes: 'Casado contra CLOUDIA_ORIGENS — fallback "Sem origem".' },
  { path: 'data.has_health_insurance_plan',  cadastroTarget: null,                   netEntity: 'Lead',      netField: 'HasHealthInsurancePlan' },
  { path: 'data.created_at',                 cadastroTarget: 'dataOrigem',           netEntity: 'Lead',      netField: 'CreatedAt' },
  { path: 'data.last_updated_at',            cadastroTarget: 'dataModificacao',      netEntity: 'Lead',      netField: 'LastUpdatedAt' },
  { path: 'data.observations',               cadastroTarget: 'observacao',           netEntity: 'Lead',      netField: 'Observations' },
  { path: 'data.stage',                      cadastroTarget: 'situacao',             netEntity: 'Lead',      netField: 'CurrentStage',        notes: 'Texto da etapa (ex.: "Agendado").' },
  { path: 'data.id_stage',                   cadastroTarget: null,                   netEntity: 'Lead',      netField: 'CurrentStageId' },
  { path: 'data.conversationState',          cadastroTarget: 'interacao',            netEntity: 'Lead',      netField: 'ConversationState',   notes: 'Sim/Não derivado: "active" ou "bot" → true.' },
  { path: 'data.id_whatsapp',                cadastroTarget: null,                   netEntity: 'Contact',   netField: 'IdChannelIntegration' },
  { path: 'data.registered_on_whatsapp',     cadastroTarget: null,                   netEntity: null,        netField: null,                  notes: 'Flag — só para enriquecer canal.' },
  { path: 'data.tags[].name',                cadastroTarget: null,                   netEntity: 'Lead',      netField: 'Tags',                notes: 'Array → tipoResgate via regras de tag-mapping.' },
  { path: 'data.ad_data',                    cadastroTarget: null,                   netEntity: 'Lead',      netField: 'IdFacebookApp',       notes: 'Atribuição Meta. Vai para Insights/CAPI.' },
  { path: 'data.last_ad_id',                 cadastroTarget: null,                   netEntity: 'Lead',      netField: 'LastAdId' },
  { path: 'assigned_user_id',                cadastroTarget: null,                   netEntity: 'Attendant', netField: 'ExternalId',          notes: 'Só vem em USER_ASSIGNED_TO_CUSTOMER.' },
  { path: 'assigned_user_name',              cadastroTarget: 'nomeResponsavel',      netEntity: 'Attendant', netField: 'Name' },
  { path: 'assigned_user_email',             cadastroTarget: 'login',                netEntity: 'Attendant', netField: 'Email' },
]

// Eventos que a Cloudia dispara — o que esperar de cada um.
export const CLOUDIA_EVENT_TYPES: { type: import('@/lib/cadastra/api').CloudiaEventType; label: string; description: string; recommended: boolean }[] = [
  { type: 'CUSTOMER_CREATED',           label: 'Lead criado',          description: 'Novo lead aparece na Cloudia. Vai p/ inbox como pendente.',     recommended: true },
  { type: 'CUSTOMER_UPDATED',           label: 'Lead atualizado',      description: 'Mudança em qualquer campo do lead. Atualiza pelo data.id.',     recommended: true },
  { type: 'CUSTOMER_STAGE_UPDATED',     label: 'Etapa alterada',       description: 'Lead mudou de stage. Atualiza Lead.CurrentStage e StageHistory.', recommended: true },
  { type: 'CUSTOMER_TAGS_UPDATED',      label: 'Tags alteradas',       description: 'Aplicar regras tag→tipoResgate (resgate, fechado, etc.).',      recommended: true },
  { type: 'USER_ASSIGNED_TO_CUSTOMER',  label: 'Atendente atribuído',  description: 'Define nomeResponsavel via assigned_user_*.',                    recommended: true },
]

// Payload de exemplo (igual ao que a Cloudia envia).
export const CLOUDIA_SAMPLE_PAYLOAD = {
  type: 'CUSTOMER_CREATED',
  data: {
    id: 12345,
    clinic_id: 789,
    name: 'João da Silva',
    phone: '+55 11 98765-4321',
    email: 'joao@example.com',
    cpf: '123.456.789-00',
    gender: 'M',
    origin: 'Campanha Meta (Instagram)',
    has_health_insurance_plan: false,
    created_at: '2026-05-08T10:30:00Z',
    last_updated_at: '2026-05-08T10:30:00Z',
    observations: 'Lead chegou pelo Instagram',
    stage: 'Aguardando contato',
    id_stage: 42,
    conversationState: 'active',
    id_whatsapp: '5511987654321',
    registered_on_whatsapp: 1,
    tags: [{ id: 1, name: 'instagram' }],
    ad_data: [],
    last_ad_id: 'ad_98765',
  },
  customer: null,
  assigned_user_id: 99,
  assigned_user_name: 'Maria',
  assigned_user_email: 'maria@clinic.com',
}

// ----------------------------------------------------------------------------
// Mapeamento auxiliar: colunas das planilhas (mesmo conteúdo, visão derivada)
// ----------------------------------------------------------------------------
// As planilhas que a Cloudia exporta usam labels em PT-BR. Mantenho aqui
// para a UI mostrar a equivalência com os campos do webhook.
export interface SpreadsheetField {
  column: string
  cadastroTarget: CadastroFieldTarget | null
  netEntity: 'Lead' | 'Contact' | 'Unit' | 'Attendant' | 'User' | 'Payment' | null
  netField: string | null
  notes?: string
}

export const CLOUDIA_LEADS: SpreadsheetField[] = [
  { column: 'ID',                          cadastroTarget: null,                    netEntity: 'Contact', netField: 'ExternalId',          notes: 'GUID curto da Cloudia. Vai para Lead.ExternalId / Contact.ImportBatchId.' },
  { column: 'Data',                        cadastroTarget: null,                    netEntity: 'Lead',    netField: 'CreatedAt',           notes: 'Data do cadastro (dia, sem hora).' },
  { column: 'Nome do Cliente',             cadastroTarget: 'nome',                  netEntity: 'Lead',    netField: 'Name' },
  { column: 'Telefone',                    cadastroTarget: 'telefone',              netEntity: 'Contact', netField: 'PhoneRaw',            notes: 'Normalizar p/ E.164 antes de gravar em Contact.PhoneNormalized.' },
  { column: 'Tipo',                        cadastroTarget: 'tipo',                  netEntity: 'Lead',    netField: 'Status',              notes: 'Cadastro | Resgate.' },
  { column: 'Origem Cadastro',             cadastroTarget: 'origem',                netEntity: 'Lead',    netField: 'Source',              notes: 'Lista fixa (ver CLOUDIA_ORIGENS abaixo).' },
  { column: 'Tipo de Resgate',             cadastroTarget: 'tipoResgate',           netEntity: 'Lead',    netField: 'Channel',             notes: 'Disparo em massa, Ligação 3C etc — só preenche se Tipo=Resgate.' },
  { column: 'Interação',                   cadastroTarget: 'interacao',             netEntity: 'Lead',    netField: 'ConversationState',   notes: 'Sim/Não → bool.' },
  { column: 'Cliente Agendou?',            cadastroTarget: 'agendouConsulta',       netEntity: 'Lead',    netField: 'HasAppointment',      notes: 'Sim/Não → bool.' },
  { column: 'Data do Agendamento',         cadastroTarget: 'dataAgendamento',       netEntity: 'Contact', netField: 'ConsultationAt' },
  { column: 'Motivo para Não Agendamento', cadastroTarget: 'motivoNaoAgendamento',  netEntity: 'Lead',    netField: 'Observations',        notes: 'Lista fixa (ver CLOUDIA_MOTIVOS_NAO_AGENDAMENTO abaixo).' },
  { column: 'Nome Responsável',            cadastroTarget: 'nomeResponsavel',       netEntity: 'Attendant', netField: 'Name' },
  { column: 'Login',                       cadastroTarget: 'login',                 netEntity: 'User',    netField: 'Email' },
  { column: 'Observação',                  cadastroTarget: 'observacao',            netEntity: 'Lead',    netField: 'Observations' },
  { column: 'Situação',                    cadastroTarget: 'situacao',              netEntity: 'Lead',    netField: 'AttendanceStatus',    notes: 'Compareceu | Faltou | Aguardando.' },
  { column: 'Clínica',                     cadastroTarget: 'clinica',               netEntity: 'Unit',    netField: 'Name' },
  { column: 'Ano',                         cadastroTarget: null,                    netEntity: null,      netField: null,                  notes: 'Derivado de CreatedAt. Não persistir.' },
  { column: 'Mês',                         cadastroTarget: null,                    netEntity: null,      netField: null,                  notes: 'Derivado de CreatedAt. Não persistir.' },
  { column: 'Data Origem',                 cadastroTarget: 'dataOrigem',            netEntity: 'Lead',    netField: 'CreatedAt' },
  { column: 'Data Modificação',            cadastroTarget: 'dataModificacao',       netEntity: 'Lead',    netField: 'LastUpdatedAt' },
]

// ---- Planilha 2: "Consultas Comparecidas" ----
export const CLOUDIA_CONSULTAS: SpreadsheetField[] = [
  { column: 'ID',                       cadastroTarget: null, netEntity: 'Lead',    netField: 'ExternalId' },
  { column: 'Data',                     cadastroTarget: null, netEntity: 'Lead',    netField: 'CreatedAt' },
  { column: 'Nome',                     cadastroTarget: 'nome',     netEntity: 'Lead', netField: 'Name' },
  { column: 'Telefone',                 cadastroTarget: 'telefone', netEntity: 'Contact', netField: 'PhoneRaw' },
  { column: 'Tipo',                     cadastroTarget: 'tipo',     netEntity: 'Lead', netField: 'Status' },
  { column: 'Origem',                   cadastroTarget: 'origem',   netEntity: 'Lead', netField: 'Source' },
  { column: 'Data do Agendamento',      cadastroTarget: 'dataAgendamento', netEntity: 'Contact', netField: 'ConsultationAt' },
  { column: 'Valor da Consulta',        cadastroTarget: null, netEntity: 'Payment', netField: 'Amount' },
  { column: 'Pagamento Antecipado',     cadastroTarget: 'pagamentoAntecipado', netEntity: 'Lead', netField: 'HasPayment' },
  { column: 'Valor 1° Recebimento',     cadastroTarget: null, netEntity: 'Payment', netField: 'Amount',          notes: 'Vira PaymentSplit #1.' },
  { column: 'Forma 1° Pagamento',       cadastroTarget: null, netEntity: 'Payment', netField: 'PaymentMethod' },
  { column: 'Data 1° Recebimento',      cadastroTarget: null, netEntity: 'Payment', netField: 'PaidAt' },
  { column: 'Valor 2° Recebimento',     cadastroTarget: null, netEntity: 'Payment', netField: 'Amount',          notes: 'Vira PaymentSplit #2.' },
  { column: 'Forma 2° Pagamento',       cadastroTarget: null, netEntity: 'Payment', netField: 'PaymentMethod' },
  { column: 'Data 2° Recebimento',      cadastroTarget: null, netEntity: 'Payment', netField: 'PaidAt' },
  { column: 'Total Recebido',           cadastroTarget: null, netEntity: null,      netField: null,              notes: 'Calculado (soma dos splits).' },
  { column: 'Falta Receber',            cadastroTarget: null, netEntity: null,      netField: null,              notes: 'Calculado (Valor da Consulta - Total Recebido).' },
  { column: 'Status',                   cadastroTarget: 'situacao', netEntity: 'Lead', netField: 'AttendanceStatus' },
  { column: 'Tratamento Indicado',      cadastroTarget: null, netEntity: 'Payment', netField: 'Treatment' },
  { column: 'Orçamento',                cadastroTarget: null, netEntity: 'Payment', netField: 'TreatmentValue' },
  { column: 'Fechou Tratamento?',       cadastroTarget: null, netEntity: 'Lead',    netField: 'ConvertedAt',     notes: 'Se Sim → set ConvertedAt = agora.' },
  { column: 'Motivo para não Fechamento', cadastroTarget: null, netEntity: 'Lead',  netField: 'Observations' },
  { column: 'Observação',               cadastroTarget: 'observacao', netEntity: 'Lead', netField: 'Observations' },
  { column: 'Nome Responsável',         cadastroTarget: 'nomeResponsavel', netEntity: 'Attendant', netField: 'Name' },
  { column: 'Login',                    cadastroTarget: 'login', netEntity: 'User', netField: 'Email' },
  { column: 'Situação',                 cadastroTarget: 'situacao', netEntity: 'Lead', netField: 'AttendanceStatus' },
  { column: 'Clínica',                  cadastroTarget: 'clinica', netEntity: 'Unit', netField: 'Name' },
  { column: 'Data Origem',              cadastroTarget: 'dataOrigem', netEntity: 'Lead', netField: 'CreatedAt' },
  { column: 'Data de Modificação',      cadastroTarget: 'dataModificacao', netEntity: 'Lead', netField: 'LastUpdatedAt' },
]

// ---- Planilha 3: "Tratamentos Realizados" ----
export const CLOUDIA_TRATAMENTOS: SpreadsheetField[] = [
  { column: 'ID',                  cadastroTarget: null, netEntity: 'Lead',    netField: 'ExternalId' },
  { column: 'Data',                cadastroTarget: null, netEntity: 'Payment', netField: 'CreatedAt' },
  { column: 'Nome',                cadastroTarget: 'nome',     netEntity: 'Lead', netField: 'Name' },
  { column: 'Telefone',            cadastroTarget: 'telefone', netEntity: 'Contact', netField: 'PhoneRaw' },
  { column: 'Tipo',                cadastroTarget: 'tipo',     netEntity: 'Lead', netField: 'Status' },
  { column: 'Origem',              cadastroTarget: 'origem',   netEntity: 'Lead', netField: 'Source' },
  { column: 'Valor',               cadastroTarget: null, netEntity: 'Payment', netField: 'TreatmentValue' },
  { column: 'Valor Recebimento',   cadastroTarget: null, netEntity: 'Payment', netField: 'Amount',         notes: 'Splits 1..4 viram PaymentSplit.' },
  { column: 'Forma de Pagamento',  cadastroTarget: null, netEntity: 'Payment', netField: 'PaymentMethod' },
  { column: 'Total Recebido',      cadastroTarget: null, netEntity: null,      netField: null,              notes: 'Calculado.' },
  { column: 'Falta Receber',       cadastroTarget: null, netEntity: null,      netField: null,              notes: 'Calculado.' },
  { column: 'Status',              cadastroTarget: 'situacao', netEntity: 'Lead', netField: 'AttendanceStatus' },
  { column: 'Descrição',           cadastroTarget: null, netEntity: 'Payment', netField: 'Notes' },
]

// ---- Lista canônica de origens (como está na Cloudia) ----
export const CLOUDIA_ORIGENS = [
  'Sem origem',
  'Campanha Meta (Instagram)',
  'Campanha Meta (Facebook)',
  'Campanha Google',
  'Ligação Google',
  'Fachada',
  'Panfleto',
  'Revista',
  'Indicação',
  'Site Oficial Doutor Hérnia',
  'Rádio',
  'TV',
  'Outdoor',
  'Eventos',
  'Direto Instagram',
  'Vendedor Externo',
  'Carro de Som',
  'Transferência de outra Unidade',
  'Blogueiros',
  'E-mail Marketing',
  'SMS',
  'WhatsApp',
  'Cheque Anjo',
  'Convênios/Parceiros',
  'Resgate: Disparo em massa',
  'Resgate: Disparo de agendamento',
  'Resgate: Ligação',
  'Resgate: Mensagem',
  'Resgate:Ligação 3C',
] as const

export type CloudiaOrigem = (typeof CLOUDIA_ORIGENS)[number]

// Origens que automaticamente classificam o lead como "Resgate"
export const CLOUDIA_RESGATE_ORIGENS: CloudiaOrigem[] = [
  'Resgate: Disparo em massa',
  'Resgate: Disparo de agendamento',
  'Resgate: Ligação',
  'Resgate: Mensagem',
  'Resgate:Ligação 3C',
]

// Mapa "Origem Cloudia" → "Tipo de Resgate" exibido no lead-form
export const CLOUDIA_RESGATE_TIPO: Record<string, string> = {
  'Resgate: Disparo em massa':      'Disparo em massa',
  'Resgate: Disparo de agendamento':'Disparo de agendamento',
  'Resgate: Ligação':               'Ligação',
  'Resgate: Mensagem':              'Mensagem',
  'Resgate:Ligação 3C':             'Ligação 3C',
}

// ---- Motivos para não agendamento (lista fixa da Cloudia) ----
export const CLOUDIA_MOTIVOS_NAO_AGENDAMENTO = [
  'Não deu continuidade ao atendimento',
  'Clicou por engano',
  'Sem condições financeiras',
  'Distância da clínica',
  'Já agendou em outra clínica',
  'Não é o tratamento que precisa',
  'Apenas pesquisa de preço',
  'Indeciso',
  'Não atende telefone',
  'Telefone inválido',
  'Bloqueou contato',
  'Pediu para não ligar mais',
  'Vai pensar e retorna',
  'Aguardando familiar',
  'Sem interesse no momento',
  'Outro',
] as const

// ---- Formas de pagamento (vão para Payment.PaymentMethod) ----
export const CLOUDIA_FORMAS_PAGAMENTO = ['pix', 'dinheiro', 'debito', 'credito', 'boleto'] as const

// ---- Helper: dado o payload do webhook Cloudia, retorna o que preencher no lead-form ----
// Espelha a lógica do CloudiaAdapter.cs no backend (.NET) — útil para:
//   (a) preview na UI antes do evento ir pro inbox,
//   (b) testes unitários do mapeamento.
import type { CloudiaWebhookEventDto } from '@/lib/cadastra/api'

interface CloudiaPayloadShape {
  type?: string
  data?: {
    id?: number
    clinic_id?: number
    name?: string
    phone?: string
    origin?: string
    stage?: string
    conversationState?: string
    tags?: { id: number; name: string }[]
    created_at?: string
    last_updated_at?: string
    observations?: string
  }
  assigned_user_name?: string
  assigned_user_email?: string
}

export function cloudiaWebhookToLeadForm(payload: CloudiaPayloadShape) {
  const data = payload.data ?? {}
  const origem = (data.origin ?? '').trim()
  const isResgate = CLOUDIA_RESGATE_ORIGENS.includes(origem as CloudiaOrigem)
  const interacao = data.conversationState === 'active' || data.conversationState === 'bot'
  return {
    nome: (data.name ?? '').trim(),
    telefone: (data.phone ?? '').trim(),
    origem: origem || 'Sem origem',
    tipo: isResgate ? 'Resgate' : 'Cadastro',
    tipoResgate: isResgate ? CLOUDIA_RESGATE_TIPO[origem] : undefined,
    interacao,
    agendouConsulta: (data.stage ?? '').toLowerCase().includes('agendad'),
    pagamentoAntecipado: false,
    nomeResponsavel: (payload.assigned_user_name ?? '').trim(),
    observacao: (data.observations ?? '').trim() || undefined,
  }
}

// Para o histórico de eventos: parse seguro do raw JSON.
export function parseCloudiaEvent(event: CloudiaWebhookEventDto): CloudiaPayloadShape | null {
  try {
    return JSON.parse(event.rawPayload) as CloudiaPayloadShape
  } catch {
    return null
  }
}

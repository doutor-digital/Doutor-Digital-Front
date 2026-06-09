// API client for the CadastraAI .NET backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5299'

interface RequestConfig extends RequestInit {
  params?: Record<string, string>
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('cadastra_auth_token')
    }
  }

  setToken(token: string | null) {
    this.token = token
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('cadastra_auth_token', token)
      else localStorage.removeItem('cadastra_auth_token')
    }
  }

  getToken() {
    return this.token
  }

  async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { params, ...fetchConfig } = config

    let url = `${this.baseUrl}${endpoint}`
    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config.headers as Record<string, string> | undefined),
    }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`

    const response = await fetch(url, { ...fetchConfig, headers })

    if (!response.ok) {
      if (response.status === 401) {
        this.setToken(null)
      }
      const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    if (response.status === 204) return undefined as T
    return response.json()
  }

  get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params })
  }

  post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const api = new ApiClient(API_BASE_URL)

/**
 * Resolve a server-relative path (e.g. "/uploads/empresa-logos/abc.png") into an absolute URL
 * pointing at the API host. External URLs (Google avatars, etc.) pass through unchanged.
 */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^(https?:|data:)/i.test(path)) return path
  const base = API_BASE_URL.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed') ||
      msg.includes('load failed')
    )
  }
  return false
}

async function uploadMultipart<T>(endpoint: string, file: File, fieldName = 'file'): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const fd = new FormData()
  fd.append(fieldName, file)
  const headers: Record<string, string> = {}
  const token = api.getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const response = await fetch(url, { method: 'POST', headers, body: fd })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }))
    throw new Error(err.message || `HTTP ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

// ----- DTOs mirroring the backend -----
export interface UserDto {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  createdAt: string
  lastLoginAt?: string | null
}

export interface AuthResponseDto {
  token: string
  expiresIn: number
  user: UserDto
}

export type MembershipRole = 'Owner' | 'Admin' | 'Member' | 0 | 1 | 2

export interface EmpresaDto {
  id: string
  nome: string
  tipo?: string | null
  logoUrl?: string | null
  ownerUserId: string
  ownerName: string
  createdAt: string
  memberCount: number
  myRole: MembershipRole
  // Código curto (base62, ~8 chars) usado nas URLs públicas de webhook.
  // Trocamos `/api/cadastra/empresas/{uuid}/cloudia/webhook` (98 chars) por
  // `/wh/c/{shortCode}` (~46 chars) porque a Cloudia limita o webhook a 100 chars.
  // Backend gera no momento da criação e nunca muda. Único globalmente.
  webhookShortCode?: string | null
}

export interface MemberDto {
  userId: string
  email: string
  name: string
  avatarUrl?: string | null
  role: MembershipRole
  joinedAt: string
}

export type InviteStatus = 'Pending' | 'Accepted' | 'Revoked' | 'Expired' | 0 | 1 | 2 | 3

export interface InviteDto {
  id: string
  empresaId: string
  empresaNome: string
  email: string
  role: MembershipRole
  token: string
  inviteUrl: string
  status: InviteStatus
  createdAt: string
  expiresAt: string
  acceptedAt?: string | null
  emailDelivered?: boolean | null
  emailError?: string | null
}

export interface InvitePreviewDto {
  empresaNome: string
  email: string
  role: MembershipRole
  status: InviteStatus
  expiresAt: string
  existingUser: boolean
}

// ----- Auth -----
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post<AuthResponseDto>('/api/cadastra/auth/register', data),

  login: (email: string, password: string) =>
    api.post<AuthResponseDto>('/api/cadastra/auth/login', { email, password }),

  google: (idToken: string) =>
    api.post<AuthResponseDto>('/api/cadastra/auth/google', { idToken }),

  me: () => api.get<UserDto>('/api/cadastra/auth/me'),

  logout: () => api.post('/api/cadastra/auth/logout'),
}

// ----- Empresas -----
export const empresasApi = {
  list: () => api.get<EmpresaDto[]>('/api/cadastra/empresas'),
  create: (data: { nome: string; tipo?: string }) =>
    api.post<EmpresaDto>('/api/cadastra/empresas', data),
  members: (empresaId: string) =>
    api.get<MemberDto[]>(`/api/cadastra/empresas/${empresaId}/members`),
  removeMember: (empresaId: string, userId: string) =>
    api.delete<void>(`/api/cadastra/empresas/${empresaId}/members/${userId}`),
  invites: (empresaId: string) =>
    api.get<InviteDto[]>(`/api/cadastra/empresas/${empresaId}/invites`),
  invite: (empresaId: string, data: { email: string; role?: MembershipRole }) =>
    api.post<InviteDto>(`/api/cadastra/empresas/${empresaId}/invites`, data),
  revokeInvite: (empresaId: string, inviteId: string) =>
    api.delete<void>(`/api/cadastra/empresas/${empresaId}/invites/${inviteId}`),
  uploadLogo: (empresaId: string, file: File) =>
    uploadMultipart<EmpresaDto>(`/api/cadastra/empresas/${empresaId}/logo`, file),
  removeLogo: (empresaId: string) =>
    api.delete<void>(`/api/cadastra/empresas/${empresaId}/logo`),
}

// ----- Invites (public + acceptance) -----
export const invitesApi = {
  preview: (token: string) => api.get<InvitePreviewDto>(`/api/cadastra/invites/${token}`),
  acceptWithPassword: (token: string, data: { name: string; password: string }) =>
    api.post<AuthResponseDto>(`/api/cadastra/invites/${token}/accept-password`, data),
  acceptWithGoogle: (token: string, idToken: string) =>
    api.post<AuthResponseDto>(`/api/cadastra/invites/${token}/accept-google`, { idToken }),
}

// ============================================================================
// Domínio: Lead / Consulta / Tratamento / Recebimento / MotivoNaoFechamento
// ============================================================================

export type CorSemaforoDto = 'verde' | 'amarelo' | 'vermelho'

export interface RecebimentoDto {
  id: string
  consultaId?: string | null
  tratamentoId?: string | null
  valorRecebimento: number
  formaPagamento: string
  dataRecebimento: string
  // Auditoria — populados quando o backend tem a migration AddAuditAndCreatedBy aplicada.
  createdByUserId?: string | null
  createdByName?: string | null
  createdAt?: string | null
}

export interface TratamentoDto {
  id: string
  consultaId: string
  planoTratamento: string
  planoPilates?: string | null
  musculacao?: string | null
  procedimento?: string | null
  valorPlano: number
  createdAt: string
  createdByUserId?: string | null
  createdByName?: string | null
  recebimentos: RecebimentoDto[]
}

export interface ConsultaDto {
  id: string
  leadId: string
  valorConsulta: number
  pagamentoAntecipado: boolean
  tratamentoIndicado: string
  orcamento: number
  compareceu: boolean
  fechouTratamento: boolean
  motivoNaoFechamento?: string | null
  createdAt: string
  createdByUserId?: string | null
  createdByName?: string | null
  tratamento?: TratamentoDto | null
  recebimentos: RecebimentoDto[]
}

export interface LeadSummaryDto {
  id: string
  empresaId: string
  nome: string
  telefone: string
  origem: string
  tipo: string
  tipoResgate?: string | null
  interacao: boolean
  agendouConsulta: boolean
  pagamentoAntecipado: boolean
  dataAgendamento?: string | null
  motivoNaoAgendamento?: string | null
  nomeResponsavel: string
  createdAt: string
  importado: boolean
  createdByUserId?: string | null
  createdByName?: string | null
  temConsulta: boolean
  compareceu?: boolean | null
  fechouTratamento?: boolean | null
  motivoNaoFechamento?: string | null
  consultaId?: string | null
  temTratamento: boolean
  consultaOrcamento?: number | null
}

export interface LeadDetailDto {
  id: string
  empresaId: string
  nome: string
  telefone: string
  origem: string
  tipo: string
  tipoResgate?: string | null
  interacao: boolean
  agendouConsulta: boolean
  pagamentoAntecipado: boolean
  dataAgendamento?: string | null
  motivoNaoAgendamento?: string | null
  nomeResponsavel: string
  createdAt: string
  importado: boolean
  createdByUserId?: string | null
  createdByName?: string | null
  consulta?: ConsultaDto | null
}

export interface MotivoNaoFechamentoDto {
  id: string
  empresaId: string
  nome: string
  cor: CorSemaforoDto
  isDefault: boolean
  createdAt: string
}

export interface CreateLeadPayload {
  nome: string
  telefone: string
  origem: string
  tipo: string
  tipoResgate?: string
  interacao: boolean
  agendouConsulta: boolean
  pagamentoAntecipado: boolean
  dataAgendamento?: string
  motivoNaoAgendamento?: string
  nomeResponsavel: string
  createdAt?: string
}

export type UpdateLeadPayload = Partial<CreateLeadPayload>

export interface CreateConsultaPayload {
  valorConsulta: number
  pagamentoAntecipado: boolean
  tratamentoIndicado: string
  orcamento: number
  compareceu: boolean
  fechouTratamento: boolean
  motivoNaoFechamento?: string
}

export type UpdateConsultaPayload = Partial<CreateConsultaPayload>

export interface CreateTratamentoPayload {
  planoTratamento: string
  planoPilates?: string
  musculacao?: string
  procedimento?: string
  valorPlano: number
}

export type UpdateTratamentoPayload = Partial<CreateTratamentoPayload>

export interface CreateRecebimentoPayload {
  valorRecebimento: number
  formaPagamento: string
  dataRecebimento: string
}

export interface BulkLeadErrorDto {
  index: number
  error: string
}

export interface BulkCreateLeadsResponse {
  totalReceived: number
  createdCount: number
  failedCount: number
  created: LeadDetailDto[]
  failed: BulkLeadErrorDto[]
}

export interface PaginatedLeads {
  items: LeadSummaryDto[]
  total: number
  page: number
  pageSize: number
}

export type FonteFiltro = 'manual' | 'importado'

export interface ListLeadsParams {
  page?: number
  pageSize?: number
  search?: string
  status?: 'todos' | 'agendados' | 'nao_agendados'
  fonte?: FonteFiltro
}

export interface LeadsStatsPeriod {
  leads: number
  agendados: number
  comConsulta: number
  compareceram: number
  fecharam: number
  cadastros: number
  resgates: number
  leadsManuais: number
  leadsImportados: number
}

export interface OrigemBucket {
  nome: string
  count: number
}

export interface ResponsavelBucket {
  nome: string
  leads: number
  compareceram: number
  fecharam: number
}

export interface LeadsStatsResponse {
  current: LeadsStatsPeriod
  previous: LeadsStatsPeriod | null
  topOrigens: OrigemBucket[]
  topResponsaveis: ResponsavelBucket[]
}

export interface StatsParams {
  from?: string
  to?: string
  prevFrom?: string
  prevTo?: string
  fonte?: FonteFiltro
}

// ----- Leads -----
export const leadsApi = {
  list: (empresaId: string, params: ListLeadsParams = {}) => {
    const q: Record<string, string> = {}
    if (params.page !== undefined) q.page = String(params.page)
    if (params.pageSize !== undefined) q.pageSize = String(params.pageSize)
    if (params.search) q.search = params.search
    if (params.status && params.status !== 'todos') q.status = params.status
    if (params.fonte) q.fonte = params.fonte
    return api.get<PaginatedLeads>(`/api/cadastra/empresas/${empresaId}/leads`, q)
  },
  stats: (empresaId: string, params: StatsParams) => {
    const q: Record<string, string> = {}
    if (params.from) q.from = params.from
    if (params.to) q.to = params.to
    if (params.prevFrom) q.prevFrom = params.prevFrom
    if (params.prevTo) q.prevTo = params.prevTo
    if (params.fonte) q.fonte = params.fonte
    return api.get<LeadsStatsResponse>(`/api/cadastra/empresas/${empresaId}/leads/stats`, q)
  },
  get: (leadId: string) => api.get<LeadDetailDto>(`/api/cadastra/leads/${leadId}`),
  create: (empresaId: string, data: CreateLeadPayload) =>
    api.post<LeadDetailDto>(`/api/cadastra/empresas/${empresaId}/leads`, data),
  bulkCreate: (empresaId: string, leads: CreateLeadPayload[]) =>
    api.post<BulkCreateLeadsResponse>(`/api/cadastra/empresas/${empresaId}/leads/bulk`, { leads }),
  update: (leadId: string, data: UpdateLeadPayload) =>
    api.patch<LeadDetailDto>(`/api/cadastra/leads/${leadId}`, data),
  delete: (leadId: string) => api.delete<void>(`/api/cadastra/leads/${leadId}`),
  // #10: detecção de duplicata pré-promote. Reusa o endpoint de listagem com search.
  searchByPhone: async (empresaId: string, telefone: string): Promise<LeadDuplicateMatchDto[]> => {
    if (!telefone || telefone.replace(/\D/g, '').length < 4) return []
    const r = await api.get<PaginatedLeads>(`/api/cadastra/empresas/${empresaId}/leads`, {
      page: '1',
      pageSize: '5',
      search: telefone,
    })
    const onlyDigits = telefone.replace(/\D/g, '')
    return r.items
      .filter((l) => l.telefone.replace(/\D/g, '').includes(onlyDigits) || onlyDigits.includes(l.telefone.replace(/\D/g, '')))
      .map((l) => ({ id: l.id, nome: l.nome, telefone: l.telefone, createdAt: l.createdAt }))
  },
  bulkDelete: (empresaId: string, opts: { fonte?: FonteFiltro } = {}) => {
    const q: Record<string, string> = { confirm: 'APAGAR' }
    if (opts.fonte) q.fonte = opts.fonte
    return api.request<{ deleted: number }>(
      `/api/cadastra/empresas/${empresaId}/leads`,
      { method: 'DELETE', params: q },
    )
  },
}

// ----- Consultas -----
export const consultasApi = {
  create: (leadId: string, data: CreateConsultaPayload) =>
    api.post<ConsultaDto>(`/api/cadastra/leads/${leadId}/consulta`, data),
  update: (consultaId: string, data: UpdateConsultaPayload) =>
    api.patch<ConsultaDto>(`/api/cadastra/consultas/${consultaId}`, data),
  delete: (consultaId: string) => api.delete<void>(`/api/cadastra/consultas/${consultaId}`),
}

// ----- Tratamentos -----
export const tratamentosApi = {
  create: (consultaId: string, data: CreateTratamentoPayload) =>
    api.post<TratamentoDto>(`/api/cadastra/consultas/${consultaId}/tratamento`, data),
  update: (tratamentoId: string, data: UpdateTratamentoPayload) =>
    api.patch<TratamentoDto>(`/api/cadastra/tratamentos/${tratamentoId}`, data),
  delete: (tratamentoId: string) => api.delete<void>(`/api/cadastra/tratamentos/${tratamentoId}`),
}

// ----- Recebimentos -----
export const recebimentosApi = {
  createForConsulta: (consultaId: string, data: CreateRecebimentoPayload) =>
    api.post<RecebimentoDto>(`/api/cadastra/consultas/${consultaId}/recebimentos`, data),
  createForTratamento: (tratamentoId: string, data: CreateRecebimentoPayload) =>
    api.post<RecebimentoDto>(`/api/cadastra/tratamentos/${tratamentoId}/recebimentos`, data),
  delete: (recebimentoId: string) => api.delete<void>(`/api/cadastra/recebimentos/${recebimentoId}`),
}

// ----- Motivos de não fechamento -----
export const motivosNaoFechamentoApi = {
  list: (empresaId: string) =>
    api.get<MotivoNaoFechamentoDto[]>(`/api/cadastra/empresas/${empresaId}/motivos-nao-fechamento`),
  create: (empresaId: string, data: { nome: string; cor: CorSemaforoDto }) =>
    api.post<MotivoNaoFechamentoDto>(`/api/cadastra/empresas/${empresaId}/motivos-nao-fechamento`, data),
  delete: (empresaId: string, motivoId: string) =>
    api.delete<void>(`/api/cadastra/empresas/${empresaId}/motivos-nao-fechamento/${motivoId}`),
}

// ----- Audit log -----
export interface AuditLogEntryDto {
  id: string
  empresaId: string
  userId?: string | null
  userName?: string | null
  userEmail?: string | null
  action: string
  entityType: string
  entityId?: string | null
  entityLabel?: string | null
  changedFields?: string[] | null
  ip?: string | null
  at: string
}

export interface AuditLogPageDto {
  items: AuditLogEntryDto[]
  total: number
  page: number
  pageSize: number
}

export interface ListAuditLogParams {
  from?: string
  to?: string
  actions?: string
  userId?: string
  entityType?: string
  page?: number
  pageSize?: number
}

export const auditApi = {
  list: (empresaId: string, params: ListAuditLogParams = {}) => {
    const q: Record<string, string> = {}
    if (params.from) q.from = params.from
    if (params.to) q.to = params.to
    if (params.actions) q.actions = params.actions
    if (params.userId) q.userId = params.userId
    if (params.entityType) q.entityType = params.entityType
    if (params.page !== undefined) q.page = String(params.page)
    if (params.pageSize !== undefined) q.pageSize = String(params.pageSize)
    return api.get<AuditLogPageDto>(`/api/cadastra/empresas/${empresaId}/audit-log`, q)
  },
}

// ----- Kommo (backend-managed, per-empresa) -----
export interface KommoConfigDto {
  subdomain: string
  hasToken: boolean
  tokenSuffix?: string | null
  hasWebhookSecret: boolean
  lastSyncAt?: string | null
}

export interface SaveKommoConfigPayload {
  subdomain: string
  accessToken: string
  webhookSecret?: string
}

export interface KommoSyncResponseDto {
  received: number
  stored: number
  lastSyncAt: string
}

export interface KommoInboxItemDto {
  id: string
  empresaId: string
  kommoLeadId?: number | null
  source: 'webhook' | 'sync'
  receivedAt: string
  status: 'pending' | 'imported' | 'discarded'
  importedLeadId?: string | null
  note?: string | null
  raw: string
}

// ----- Kommo: pipelines, statuses, responsáveis (proxied via CadastraAi.API) -----
export interface KommoPipelineDto {
  id: number
  name: string
  isMain: boolean
  statuses: KommoStatusDto[]
}

export interface KommoStatusDto {
  id: number
  pipelineId: number
  name: string
  color?: string | null
  type?: number | null
}

export interface KommoUserDto {
  id: number
  name: string
  email?: string | null
}

// ----- Kommo: mapeamento de campos / responsáveis (overrides salvos por empresa) -----
export type KommoFieldTarget =
  | 'nome'
  | 'telefone'
  | 'origem'
  | 'tipo'
  | 'tipoResgate'
  | 'interacao'
  | 'agendouConsulta'
  | 'pagamentoAntecipado'
  | 'dataAgendamento'
  | 'motivoNaoAgendamento'
  | 'nomeResponsavel'

export interface KommoFieldMappingRuleDto {
  target: KommoFieldTarget
  // chave do campo Kommo: field_code, field_name OR "lead.name" / "contact.phone"
  sourceKey: string
  // se o valor da Kommo é "X", força para Y (ex: "vendas" → "Cadastro")
  valueMap?: Record<string, string>
}

export interface KommoFieldMappingDto {
  empresaId: string
  rules: KommoFieldMappingRuleDto[]
  updatedAt?: string | null
}

export interface KommoResponsibleMappingDto {
  empresaId: string
  // kommoUserId → nome usado no CadastraAi
  rules: { kommoUserId: number; kommoUserName?: string | null; nomeResponsavel: string }[]
  // fallback quando não há match
  fallbackNome?: string | null
  updatedAt?: string | null
}

// ----- Kommo: auto-sync agendado -----
export type AutoSyncInterval = '15m' | '1h' | '6h' | 'daily' | 'off'

export interface KommoAutoSyncDto {
  empresaId: string
  enabled: boolean
  interval: AutoSyncInterval
  // opcional: limitar a um pipeline/statuses específicos
  pipelineId?: number | null
  statusIds?: number[] | null
  limit: number
  lastRunAt?: string | null
  nextRunAt?: string | null
}

// ----- Kommo: histórico de syncs -----
export interface KommoSyncHistoryEntryDto {
  id: string
  empresaId: string
  triggeredByUserId?: string | null
  triggeredByName?: string | null
  source: 'manual' | 'auto' | 'webhook'
  startedAt: string
  finishedAt?: string | null
  received: number
  stored: number
  promoted: number
  discarded: number
  errorMessage?: string | null
  filters?: {
    pipelineId?: number | null
    statusIds?: number[] | null
    createdAtFrom?: string | null
    createdAtTo?: string | null
    query?: string | null
    limit?: number | null
  } | null
}

export interface KommoTestConnectionResultDto {
  ok: boolean
  account?: { id: number; name: string; subdomain: string } | null
  errorMessage?: string | null
  pipelinesCount?: number | null
  usersCount?: number | null
}

export interface KommoSyncOptions {
  limit?: number
  page?: number
  query?: string
  createdAtFrom?: string
  createdAtTo?: string
  pipelineId?: number
  statusIds?: number[]
  // #2: sync incremental — backend retorna apenas leads com updated_at/created_at > since.
  since?: string
}

// ----- #3: Mapeamento de tags Kommo → tipo/origem do Cadastro -----
export interface KommoTagMappingRuleDto {
  // Tag exata na Kommo (case-insensitive). Ex: "site", "instagram", "indicacao".
  tag: string
  // Override aplicado ao lead promovido. target diz qual campo do Cadastro recebe value.
  target: 'origem' | 'tipo' | 'tipoResgate'
  value: string
}

export interface KommoTagMappingDto {
  empresaId: string
  rules: KommoTagMappingRuleDto[]
  updatedAt?: string | null
}

// ----- #4: Notas/comentários Kommo -----
export interface KommoLeadNoteDto {
  id: number
  leadId: number
  // common, call_in, call_out, sms_in, sms_out, mail_message, geolocation, attachment, etc.
  noteType: string
  text?: string | null
  // metadata bruto (varia por noteType — ex: durat, link, file_name)
  metadata?: Record<string, unknown> | null
  createdAt: string
  createdByName?: string | null
}

// ----- #5: Eventos da timeline Kommo -----
export interface KommoLeadEventDto {
  id: string
  type: string
  // Ex: "lead_status_changed", "incoming_call", "common_note_added".
  entityId: number
  entityType: 'lead' | 'contact' | 'company'
  createdAt: string
  createdByName?: string | null
  valueBefore?: string | null
  valueAfter?: string | null
  rawSummary?: string | null
}

// ----- #7: Mensagens / WhatsApp -----
export type KommoMessageDirection = 'in' | 'out'
export interface KommoLeadMessageDto {
  id: string
  leadId: number
  channel: 'whatsapp' | 'telegram' | 'instagram' | 'email' | 'sms' | 'other'
  direction: KommoMessageDirection
  text: string
  attachments?: { type: string; url: string; name?: string | null }[] | null
  authorName?: string | null
  createdAt: string
}

// ----- #6 / #8: Push reverso (mover status, linkar custom_field) -----
export interface KommoMoveStatusPayload {
  pipelineId?: number
  statusId: number
  // Ex: "ganho", "perdido". Backend resolve pelo nome se statusId não vier.
  statusName?: string
}

// ----- #10: Dedup por telefone -----
export interface LeadDuplicateMatchDto {
  id: string
  nome: string
  telefone: string
  createdAt: string
}

// Endpoints novos esperados em CadastraAi.API. Onde não existirem ainda, o front
// captura o erro 404 e segue funcionando com o que já há.
export const kommoApi = {
  getConfig: (empresaId: string) =>
    api.get<KommoConfigDto | null>(`/api/cadastra/empresas/${empresaId}/kommo/config`),
  saveConfig: (empresaId: string, data: SaveKommoConfigPayload) =>
    api.put<KommoConfigDto>(`/api/cadastra/empresas/${empresaId}/kommo/config`, data),
  deleteConfig: (empresaId: string) =>
    api.delete<void>(`/api/cadastra/empresas/${empresaId}/kommo/config`),

  // TODO(CadastraAi.API): GET /api/empresas/{id}/kommo/test-connection — usa o token salvo,
  // chama https://{subdomain}.kommo.com/api/v4/account?with=users e devolve resumo.
  testConnection: (empresaId: string) =>
    api.get<KommoTestConnectionResultDto>(`/api/cadastra/empresas/${empresaId}/kommo/test-connection`),

  sync: (empresaId: string, opts: KommoSyncOptions = {}) =>
    api.post<KommoSyncResponseDto>(`/api/cadastra/empresas/${empresaId}/kommo/sync`, opts),
  inbox: (empresaId: string, status?: 'pending' | 'imported' | 'discarded') =>
    api.get<KommoInboxItemDto[]>(
      `/api/cadastra/empresas/${empresaId}/kommo/inbox`,
      status ? { status } : undefined,
    ),
  clearInbox: (empresaId: string) =>
    api.delete<{ deleted: number }>(`/api/cadastra/empresas/${empresaId}/kommo/inbox`),
  patchItem: (
    empresaId: string,
    itemId: string,
    patch: { status?: 'pending' | 'imported' | 'discarded'; note?: string },
  ) => api.patch<KommoInboxItemDto>(`/api/cadastra/empresas/${empresaId}/kommo/inbox/${itemId}`, patch),
  deleteItem: (empresaId: string, itemId: string) =>
    api.delete<void>(`/api/cadastra/empresas/${empresaId}/kommo/inbox/${itemId}`),
  promote: (empresaId: string, itemId: string, lead: CreateLeadPayload) =>
    api.post<LeadDetailDto>(`/api/cadastra/empresas/${empresaId}/kommo/inbox/${itemId}/promote`, { lead }),

  // TODO(CadastraAi.API): GET /api/empresas/{id}/kommo/pipelines — proxy para
  // /api/v4/leads/pipelines (Kommo). Retorna pipelines + statuses cacheados.
  pipelines: (empresaId: string) =>
    api.get<KommoPipelineDto[]>(`/api/cadastra/empresas/${empresaId}/kommo/pipelines`),

  // TODO(CadastraAi.API): GET /api/empresas/{id}/kommo/users — proxy para /api/v4/users (Kommo).
  users: (empresaId: string) =>
    api.get<KommoUserDto[]>(`/api/cadastra/empresas/${empresaId}/kommo/users`),

  // TODO(CadastraAi.API): GET/PUT /api/empresas/{id}/kommo/field-mapping — persiste regras
  // de override que sobrescrevem o auto-detect do kommo-mapping.ts.
  getFieldMapping: (empresaId: string) =>
    api.get<KommoFieldMappingDto | null>(`/api/cadastra/empresas/${empresaId}/kommo/field-mapping`),
  saveFieldMapping: (empresaId: string, data: { rules: KommoFieldMappingRuleDto[] }) =>
    api.put<KommoFieldMappingDto>(`/api/cadastra/empresas/${empresaId}/kommo/field-mapping`, data),

  // TODO(CadastraAi.API): GET/PUT /api/empresas/{id}/kommo/responsible-mapping
  getResponsibleMapping: (empresaId: string) =>
    api.get<KommoResponsibleMappingDto | null>(`/api/cadastra/empresas/${empresaId}/kommo/responsible-mapping`),
  saveResponsibleMapping: (
    empresaId: string,
    data: { rules: KommoResponsibleMappingDto['rules']; fallbackNome?: string | null },
  ) => api.put<KommoResponsibleMappingDto>(`/api/cadastra/empresas/${empresaId}/kommo/responsible-mapping`, data),

  // TODO(CadastraAi.API): GET/PUT /api/empresas/{id}/kommo/auto-sync. Backend deve rodar um
  // BackgroundService/HostedService que checa empresas com autoSync.enabled e dispara sync
  // quando nextRunAt <= now. Atualizar lastRunAt/nextRunAt depois de rodar.
  getAutoSync: (empresaId: string) =>
    api.get<KommoAutoSyncDto | null>(`/api/cadastra/empresas/${empresaId}/kommo/auto-sync`),
  saveAutoSync: (
    empresaId: string,
    data: Omit<KommoAutoSyncDto, 'empresaId' | 'lastRunAt' | 'nextRunAt'>,
  ) => api.put<KommoAutoSyncDto>(`/api/cadastra/empresas/${empresaId}/kommo/auto-sync`, data),

  // TODO(CadastraAi.API): GET /api/empresas/{id}/kommo/sync-history?page=&pageSize=
  syncHistory: (empresaId: string, opts: { page?: number; pageSize?: number } = {}) => {
    const q: Record<string, string> = {}
    if (opts.page !== undefined) q.page = String(opts.page)
    if (opts.pageSize !== undefined) q.pageSize = String(opts.pageSize)
    return api.get<{ items: KommoSyncHistoryEntryDto[]; total: number }>(
      `/api/cadastra/empresas/${empresaId}/kommo/sync-history`,
      q,
    )
  },

  // #3: TODO(CadastraAi.API): GET/PUT /api/empresas/{id}/kommo/tag-mapping
  getTagMapping: (empresaId: string) =>
    api.get<KommoTagMappingDto | null>(`/api/cadastra/empresas/${empresaId}/kommo/tag-mapping`),
  saveTagMapping: (empresaId: string, data: { rules: KommoTagMappingRuleDto[] }) =>
    api.put<KommoTagMappingDto>(`/api/cadastra/empresas/${empresaId}/kommo/tag-mapping`, data),

  // #4: TODO(CadastraAi.API): GET /api/empresas/{id}/kommo/leads/{kommoLeadId}/notes
  // proxy para /api/v4/leads/{id}/notes (ordenado desc por created_at).
  leadNotes: (empresaId: string, kommoLeadId: number) =>
    api.get<KommoLeadNoteDto[]>(`/api/cadastra/empresas/${empresaId}/kommo/leads/${kommoLeadId}/notes`),

  // #5: TODO(CadastraAi.API): GET /api/empresas/{id}/kommo/events?leadId=&page=
  // proxy para /api/v4/events?filter[entity]=lead&filter[entity_id]=...
  events: (empresaId: string, opts: { leadId?: number; page?: number; pageSize?: number } = {}) => {
    const q: Record<string, string> = {}
    if (opts.leadId !== undefined) q.leadId = String(opts.leadId)
    if (opts.page !== undefined) q.page = String(opts.page)
    if (opts.pageSize !== undefined) q.pageSize = String(opts.pageSize)
    return api.get<{ items: KommoLeadEventDto[]; total: number }>(
      `/api/cadastra/empresas/${empresaId}/kommo/events`,
      q,
    )
  },

  // #6: TODO(CadastraAi.API): POST /api/empresas/{id}/kommo/leads/{kommoLeadId}/move-status
  moveLeadStatus: (empresaId: string, kommoLeadId: number, data: KommoMoveStatusPayload) =>
    api.post<{ ok: true; pipelineId: number; statusId: number }>(
      `/api/cadastra/empresas/${empresaId}/kommo/leads/${kommoLeadId}/move-status`,
      data,
    ),

  // #7: TODO(CadastraAi.API): GET /api/empresas/{id}/kommo/leads/{kommoLeadId}/messages
  // proxy para /api/v4/chats/{chat_id}/messages — backend resolve chat_id pelo lead.
  leadMessages: (
    empresaId: string,
    kommoLeadId: number,
    opts: { page?: number; pageSize?: number } = {},
  ) => {
    const q: Record<string, string> = {}
    if (opts.page !== undefined) q.page = String(opts.page)
    if (opts.pageSize !== undefined) q.pageSize = String(opts.pageSize)
    return api.get<{ items: KommoLeadMessageDto[]; total: number }>(
      `/api/cadastra/empresas/${empresaId}/kommo/leads/${kommoLeadId}/messages`,
      q,
    )
  },

  // #8: TODO(CadastraAi.API): POST /api/empresas/{id}/kommo/leads/{kommoLeadId}/link-cadastro
  // grava custom_field "ID Cadastro" no lead Kommo e devolve a URL do lead Kommo.
  linkCadastroId: (empresaId: string, kommoLeadId: number, cadastroLeadId: string) =>
    api.post<{ ok: true; kommoLeadUrl: string }>(
      `/api/cadastra/empresas/${empresaId}/kommo/leads/${kommoLeadId}/link-cadastro`,
      { cadastroLeadId },
    ),

  // #9: TODO(CadastraAi.API): DELETE /api/empresas/{id}/kommo/inbox?olderThan=ISO&status=pending
  bulkDiscard: (empresaId: string, opts: { olderThan?: string; status?: 'pending' | 'discarded' }) => {
    const q: Record<string, string> = {}
    if (opts.olderThan) q.olderThan = opts.olderThan
    if (opts.status) q.status = opts.status
    return api.request<{ deleted: number }>(
      `/api/cadastra/empresas/${empresaId}/kommo/inbox/bulk-discard`,
      { method: 'POST', params: q },
    )
  },

  // Promoção em massa — front itera nos endpoints existentes. Quando o backend expor
  // POST /api/empresas/{id}/kommo/inbox/bulk-promote, basta trocar a implementação aqui.
  bulkPromote: async (
    empresaId: string,
    items: { itemId: string; lead: CreateLeadPayload }[],
  ): Promise<{ ok: { itemId: string; leadId: string }[]; failed: { itemId: string; error: string }[] }> => {
    const ok: { itemId: string; leadId: string }[] = []
    const failed: { itemId: string; error: string }[] = []
    for (const it of items) {
      try {
        const created = await api.post<LeadDetailDto>(
          `/api/cadastra/empresas/${empresaId}/kommo/inbox/${it.itemId}/promote`,
          { lead: it.lead },
        )
        ok.push({ itemId: it.itemId, leadId: created.id })
      } catch (err) {
        failed.push({ itemId: it.itemId, error: err instanceof Error ? err.message : 'erro' })
      }
    }
    return { ok, failed }
  },
}

// Helper: detecta se o erro indica endpoint inexistente (backend ainda não implementado).
// Usado pela UI para mostrar um aviso "feature pendente no backend" sem quebrar.
export function isBackendNotImplemented(error: unknown): boolean {
  if (error instanceof Error) {
    const m = error.message.toLowerCase()
    return m.includes('http 404') || m.includes('http 501') || m.includes('not implemented')
  }
  return false
}

// URL pública do webhook. CRÍTICO: Cloudia (e outras CRMs) limitam a URL a 100 chars.
// Por isso preferimos a forma curta `/wh/{provider}/{shortCode}` quando o backend
// já gerou o shortCode da empresa. O secret NUNCA vai na URL — é a chave de HMAC
// que a Cloudia usa para assinar o payload (header x-kommo-signature).
type ShortProvider = 'c' /* cloudia */ | 'k' /* kommo */ | 'm' /* meta */ | 'g' /* google */ | 'n' /* n8n */ | 'w' /* webhook */

function buildShortWebhook(empresa: { id: string; webhookShortCode?: string | null }, provider: ShortProvider, longTail: string): string {
  const base = API_BASE_URL.replace(/\/$/, '')
  if (empresa.webhookShortCode) {
    return `${base}/wh/${provider}/${empresa.webhookShortCode}`
  }
  // Fallback: forma longa por UUID. Usado enquanto o backend não popula shortCode.
  return `${base}/api/empresas/${empresa.id}/${longTail}`
}

export function buildKommoWebhookUrl(
  empresaOrId: string | { id: string; webhookShortCode?: string | null },
): string {
  const empresa = typeof empresaOrId === 'string' ? { id: empresaOrId } : empresaOrId
  return buildShortWebhook(empresa, 'k', 'kommo/webhook')
}

// ============================================================================
// Centro de Integrações — provedores além da Kommo
// ============================================================================
// Cada provider segue o mesmo formato: status de conexão por empresa, save de
// credenciais, webhook URL pública e sync manual. O backend .NET já tem rotas
// para Cloudia, Kommo, Meta e N8N (em /api/webhooks/*). Onde a rota de status
// ainda não existir, a UI captura 404 com isBackendNotImplemented().

export type IntegrationProvider = 'crm' | 'kommo' | 'meta' | 'google' | 'n8n' | 'webhook'

export interface IntegrationStatusDto {
  provider: IntegrationProvider
  empresaId: string
  connected: boolean
  // Resumo "humano" da conexão (ex.: "subdomain: araguaina • last sync: há 12min").
  summary?: string | null
  lastSyncAt?: string | null
  webhookUrl?: string | null
  // Quando o backend reporta erro (token inválido/expirado).
  errorMessage?: string | null
}

// ----- Cloudia (CRM externo, webhook-only) -----
// A Cloudia NÃO é consultada por API: ela faz POST p/ a URL que a empresa cola
// no painel dela. O backend recebe, valida o secret (opcional, HMAC) e despacha
// para o inbox. O `clinic_id` que vem no payload é a chave de isolamento.
export interface CloudiaWebhookConfigDto {
  empresaId: string
  // Secret HMAC opcional. Se preenchido, o backend exige header
  // x-kommo-signature em cada requisição recebida.
  hasWebhookSecret: boolean
  webhookSecretSuffix?: string | null
  // clinic_id do Kommo que esta empresa "possui". Webhooks com clinic_id
  // diferente são rejeitados (defesa em profundidade).
  cloudiaClinicId?: number | null
  lastReceivedAt?: string | null
  totalReceived: number
  totalProcessed: number
  totalRejected: number
}

export interface SaveCloudiaWebhookPayload {
  webhookSecret?: string
  cloudiaClinicId?: number | null
}

// Tipos exatos do que a Cloudia manda (espelha CloudiaWebhookDto no backend).
export type LeadEventType =
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_STAGE_UPDATED'
  | 'CUSTOMER_TAGS_UPDATED'
  | 'USER_ASSIGNED_TO_CUSTOMER'

export interface SourceWebhookEventDto {
  id: string
  empresaId: string
  receivedAt: string
  eventType: LeadEventType
  cloudiaClinicId?: number | null
  cloudiaCustomerId?: number | null
  status: 'processed' | 'rejected' | 'pending'
  rejectionReason?: string | null
  // Lead que foi promovido a partir do evento (se houve).
  cadastroLeadId?: string | null
  rawPayload: string
}

export const cloudiaApi = {
  getWebhookConfig: (empresaId: string) =>
    api.get<CloudiaWebhookConfigDto | null>(`/api/cadastra/empresas/${empresaId}/cloudia/webhook-config`),
  saveWebhookConfig: (empresaId: string, data: SaveCloudiaWebhookPayload) =>
    api.put<CloudiaWebhookConfigDto>(`/api/cadastra/empresas/${empresaId}/cloudia/webhook-config`, data),
  // Histórico dos últimos eventos recebidos.
  history: (empresaId: string, params?: { status?: 'processed' | 'rejected' | 'pending'; limit?: number }) =>
    api.get<SourceWebhookEventDto[]>(`/api/cadastra/empresas/${empresaId}/cloudia/webhook-events`, {
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.limit ? { limit: String(params.limit) } : {}),
    }),
  // Reprocessa um evento que falhou.
  retry: (empresaId: string, eventId: string) =>
    api.post<SourceWebhookEventDto>(
      `/api/cadastra/empresas/${empresaId}/cloudia/webhook-events/${eventId}/retry`,
    ),
}

export function buildCloudiaWebhookUrl(
  empresaOrId: string | { id: string; webhookShortCode?: string | null },
): string {
  const empresa = typeof empresaOrId === 'string' ? { id: empresaOrId } : empresaOrId
  return buildShortWebhook(empresa, 'c', 'cloudia/webhook')
}

// ----- Webhook genérico (Meta, N8N, Zapier, Make, etc.) -----
// Endpoint único, com header x-source que diferencia o provider.
const PROVIDER_SHORT: Record<IntegrationProvider, ShortProvider> = {
  crm: 'c',
  kommo: 'k',
  meta: 'm',
  google: 'g',
  n8n: 'n',
  webhook: 'w',
}

export function buildGenericWebhookUrl(
  empresaOrId: string | { id: string; webhookShortCode?: string | null },
  provider: IntegrationProvider,
): string {
  const empresa = typeof empresaOrId === 'string' ? { id: empresaOrId } : empresaOrId
  return buildShortWebhook(empresa, PROVIDER_SHORT[provider], `webhooks/${provider}`)
}

// Hub: status agregado de todas as integrações de uma empresa.
export const integrationsApi = {
  list: (empresaId: string) =>
    api.get<IntegrationStatusDto[]>(`/api/cadastra/empresas/${empresaId}/integrations`),
}

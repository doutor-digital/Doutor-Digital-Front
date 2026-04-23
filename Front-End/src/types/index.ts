export type EntityId = number;
export type ConversationState = "bot" | "queue" | "service" | "concluido";

export interface ProblemDetails {
  type?: string | null;
  title?: string | null;
  status?: number | null;
  detail?: string | null;
  instance?: string | null;
  [key: string]: unknown;
}

/** Swagger: ActiveLeadDto */
export interface ActiveLeadDto {
  id: number;
  externalId?: number;
  name?: string | null;
  phone?: string | null;
  conversationState?: string | null;
  attendantId?: number | null;
  unitId?: number | null;
  updatedAt: string;
  createdAt: string;
}

/** Swagger: LeadsCountDto */
export interface LeadsCountDto {
  bot: number;
  queue: number;
  service: number;
  concluido: number;
  total: number;
}

/** Swagger: SyncLeadDto */
export interface SyncLeadDto {
  externalId: number;
  tags?: string[] | null;
  name?: string | null;
  phone?: string | null;
  stage?: string | null;
  tenantId: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Lead {
  id: number;
  externalId?: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  currentStage?: string | null;
  conversationState?: ConversationState | null;
  tags?: string[] | string | null;
  clinicId?: number | null;
  unitId?: number | null;
  attendantId?: number | null;
  attendantName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  firstAttendanceAt?: string | null;
  concludedAt?: string | null;
  [key: string]: unknown;
}

export interface StageCount {
  stage: string;
  count: number;
}

export interface SourceCount {
  source: string;
  count: number;
}

export interface OrigemAgrupada {
  origem: string;
  quantidade: number;
  porcentagem?: number;
}

export interface StateCount extends LeadsCountDto {}

export interface TimeSeriesPoint {
  periodo: string;
  total: number;
  ano?: number;
  mes?: number;
}

export interface LeadMetrics {
  leadId: number;
  name?: string | null;
  currentState?: ConversationState;
  timeInBot?: number;
  timeInQueue?: number;
  timeInService?: number;
  totalTime?: number;
  timeToFirstAttendance?: number | null;
  timeToResolution?: number | null;
  alerts?: string[];
  transitions?: Array<{
    from: ConversationState;
    to: ConversationState;
    at: string;
  }>;
  interactions?: Array<{
    id: string;
    type: string;
    content?: string;
    at: string;
  }>;
  [key: string]: unknown;
}

export interface UnitSummary {
  totalLeads: number;
  totals: Partial<Record<ConversationState, number>>;
  averages: Partial<Record<ConversationState, number>> & {
    firstAttendance?: number;
    resolution?: number;
  };
  alertsCount?: number;
  topAttendants?: Array<{
    attendantName: string;
    conversions: number;
    total: number;
  }>;
  [key: string]: unknown;
}

export interface Attendant {
  id: number;
  name: string;
  email?: string | null;
  totalAssignments?: number;
  conversions?: number;
}

export interface AttendantRanking {
  attendantId: number;
  name: string;
  email?: string | null;
  total: number;
  agendado: number;
  pago: number;
  tratamento: number;
  conversions: number;
  active: number;
  agendadoRate: number;
  pagoRate: number;
  conversionRate: number;
  firstAssignedAt?: string | null;
  lastAssignedAt?: string | null;
}

export interface Unit {
  id: number | string;
  clinicId: number | string;
  logo_url?: string | null;
  name?: string | null;
  leadsCount?: number;
}

export interface LiveMetrics {
  atendentes?: Array<{
    name: string;
    status?: string;
    emAtendimento?: number;
    naFila?: number;
    tempoMedio?: number;
  }>;
  fila?: Array<{
    name: string;
    phone?: string;
    waitingSince?: string;
    waitingMinutes?: number;
  }>;
  totalEmAtendimento?: number;
  totalNaFila?: number;
  tempoMedio?: number;
  [key: string]: unknown;
}

export interface ApiCountPayload {
  count?: number;
  total?: number;
  quantidade?: number;
}

export interface LeadStageHistoryDto {
  id: number;
  stageId: number;
  stageLabel: string;
  changedAt: string;
}

export interface LeadInteractionDto {
  id: number;
  type: string;
  content?: string | null;
  createdAt: string;
}

export interface LeadConversationDto {
  id: number;
  channel: string;
  source?: string | null;
  conversationState: string;
  startedAt: string;
  endedAt?: string | null;
  attendantId?: number | null;
  attendantName?: string | null;
  interactions: LeadInteractionDto[];
}

export interface LeadAssignmentDto {
  id: number;
  attendantId: number;
  attendantName?: string | null;
  stage?: string | null;
  assignedAt: string;
}

export interface LeadPaymentDto {
  id: number;
  amount: number;
  paidAt: string;
}

export interface TimelineLeadHeader {
  id: number;
  externalId: number;
  name: string;
  phone: string;
  source: string;
  channel: string;
  currentStage: string;
  conversationState?: string | null;
  hasAppointment: boolean;
  hasPayment: boolean;
  createdAt: string;
  convertedAt?: string | null;
}

export interface TimelineAttribution {
  phone: string;
  ctwaClid: string;
  sourceId?: string | null;
  sourceType?: string | null;
  matchType: string;
  confidence: string;
  matchedAt: string;
}

export interface TimelineStage {
  label: string;
  stageId: number;
  enteredAt: string;
  exitedAt?: string | null;
  durationMinutes?: number | null;
  isCurrent: boolean;
}

export interface TimelineAssignment {
  attendantId: number;
  attendantName: string;
  stageAtAssignment?: string | null;
  assignedAt: string;
  minutesUntilFirstReply?: number | null;
}

export interface TimelineConversation {
  id: number;
  channel: string;
  source?: string | null;
  conversationState: string;
  attendantName?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationMinutes?: number | null;
  interactionsCount: number;
}

export interface TimelineInteraction {
  id: number;
  conversationId: number;
  type: string;
  content?: string | null;
  createdAt: string;
}

export interface TimelineInsights {
  totalMinutesUntilConversion?: number | null;
  minutesUntilFirstAssignment?: number | null;
  minutesInBot: number;
  minutesInQueue: number;
  minutesInService: number;
  stageChanges: number;
  reassignments: number;
  longestStageLabel?: string | null;
  longestStageMinutes?: number | null;
}

export interface LeadTimeline {
  lead: TimelineLeadHeader;
  attribution?: TimelineAttribution | null;
  stages: TimelineStage[];
  assignments: TimelineAssignment[];
  conversations: TimelineConversation[];
  interactions: TimelineInteraction[];
  insights: TimelineInsights;
}

export interface DuplicateContactGroup {
  tenantId: number;
  phoneNormalized: string;
  count: number;
  keepContactId: number;
  keepName: string;
  keepCreatedAt: string;
  deleteContactIds: number[];
}

export interface DuplicateContactsReport {
  dryRun: boolean;
  groupsFound: number;
  contactsToDelete: number;
  groups: DuplicateContactGroup[];
}

export interface OvernightLeadItemDto {
  id: number;
  name: string;
  phone?: string | null;
  source: string;
  channel: string;
  currentStage: string;
  conversationState?: string | null;
  createdAt: string;
  createdAtLocal: string;
}

export interface OvernightHourBucketDto {
  hour: number;
  count: number;
}

export interface OvernightSourceBucketDto {
  source: string;
  count: number;
}

export interface OvernightLeadsDto {
  total: number;
  unitId?: number | null;
  clinicId?: number | null;
  unitName: string;
  periodStartLocal: string;
  periodEndLocal: string;
  startHour: number;
  endHour: number;
  leads: OvernightLeadItemDto[];
  hourBreakdown: OvernightHourBucketDto[];
  sourceBreakdown: OvernightSourceBucketDto[];
}

export interface EvolutionMonthPointDto {
  year: number;
  month: number;
  label: string;
  total: number;
  cumulative: number;
  momGrowthPercent: number | null;
  movingAverage3: number | null;
}

export interface EvolutionWeekdayDto {
  weekday: number;
  label: string;
  total: number;
}

export interface EvolutionHourDto {
  hour: number;
  total: number;
}

export interface EvolutionSourceMonthDto {
  year: number;
  month: number;
  label: string;
  count: number;
}

export interface EvolutionSourceSerieDto {
  source: string;
  total: number;
  points: EvolutionSourceMonthDto[];
}

export interface EvolutionConversionPointDto {
  year: number;
  month: number;
  label: string;
  total: number;
  agendado: number;
  pago: number;
  tratamento: number;
  agendadoRate: number;
  pagoRate: number;
}

export interface EvolutionAdvancedDto {
  startDateLocal: string;
  endDateLocal: string;
  clinicId?: number | null;
  totalLeads: number;
  averageMonthly: number;
  medianMonthly: number;
  stdDevMonthly: number;
  bestMonthTotal: number;
  bestMonthLabel: string;
  worstMonthTotal: number;
  worstMonthLabel: string;
  growthPercentFirstToLast: number;
  monthly: EvolutionMonthPointDto[];
  weekday: EvolutionWeekdayDto[];
  hour: EvolutionHourDto[];
  sourcesOverTime: EvolutionSourceSerieDto[];
  conversionOverTime: EvolutionConversionPointDto[];
}

export type AttendanceStatus = "compareceu" | "faltou" | "aguardando";

export interface Contact {
  id: string;
  name: string;
  phone_normalized: string;
  origem: "webhook_cloudia" | "import_csv" | "manual";
  etapa?: string | null;
  tags?: string[];
  last_message_at?: string | null;
  blocked?: boolean;
  imported_at?: string | null;
  attendance_status?: AttendanceStatus | null;
  attendance_status_at?: string | null;
}

export interface ContactDetail extends Contact {
  email?: string | null;
  phone_raw?: string | null;
  source_file?: string | null;
  batch_id?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  notes?: string | null;
  custom_fields?: Record<string, unknown> | null;
  raw?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface ContactPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ContactCounts {
  all: number;
  webhook_cloudia: number;
  import_csv: number;
  manual?: number;
  compareceu?: number;
  faltou?: number;
  aguardando?: number;
  filtered?: number;
}

export interface ContactsListResponse {
  data: Contact[];
  pagination: ContactPagination;
  counts: ContactCounts;
}

/* ─── DSL de filtros avançados (POST /contacts/search) ─── */

export type FilterOperator =
  | "contains" | "not_contains" | "equals" | "starts_with"
  | "is_empty" | "is_not_empty"
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between"
  | "is_true" | "is_false"
  | "is" | "is_not"
  | "in" | "not_in"
  | "on" | "before" | "after" | "last_n_days" | "next_n_days";

export interface FilterCriterion {
  field: string;
  op: FilterOperator;
  value: unknown;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterOptionsResponse {
  key: string;
  options: FilterOption[];
}

export interface ContactImportError {
  row: number;
  reason: string;
  value?: string | null;
}

export interface ContactImportResult {
  batch_id: number | string;
  filename: string;
  total_rows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  error_samples?: ContactImportError[];
}

/* ─── Alertas de SLA (unidade) ─── */

export interface UnitAlert {
  leadId: number;
  externalId?: number;
  name: string;
  phone?: string | null;
  currentState: string;
  createdAt: string;
  lastUpdatedAt: string;
  timeInBotMinutes?: number | null;
  timeInQueueMinutes?: number | null;
  timeInServiceMinutes?: number | null;
  timeInConcluidoMinutes?: number | null;
  timeToFirstResponseMinutes?: number | null;
  timeToResolutionMinutes?: number | null;
  isDelayed: boolean;
  delayReason?: string | null;
  currentAttendantId?: number | null;
  currentAttendantName?: string | null;
}

export interface UnitAlertsResponse {
  unitId: number;
  totalDelayed: number;
  limits: {
    bot?: string;
    queue?: string;
    service?: string;
  };
  alerts: UnitAlert[];
}

/* ─── Recent leads (notificação + página /recent-leads) ─── */

export interface RecentLead {
  id: number;
  external_id: number;
  name: string;
  phone?: string | null;
  source?: string | null;
  channel?: string | null;
  current_stage?: string | null;
  conversation_state?: string | null;
  unit_id?: number | null;
  unit_name?: string | null;
  created_at: string;
}

export interface RecentLeadsResponse {
  hours: number;
  total: number;
  since: string;
  items: RecentLead[];
}

/* ─── Dashboard overview consolidado (KPIs + etapas + origens) ─── */

export interface DashboardOverview {
  date_from: string;
  date_to: string;
  total_leads: number;
  consultas: number;
  com_pagamento: number;
  sem_pagamento: number;
  conversao_rate: number;
  pagamento_rate: number;
  sem_pagamento_rate: number;
  states: LeadsCountDto;
  etapas: Array<{ etapa: string; quantidade: number }>;
  origens: OrigemAgrupada[];
}

/* ─── Dashboard evolução com group_by + compare ─── */

export type GroupByGranularity = "day" | "week" | "month" | "quarter";
export type CompareMode = "none" | "previous_period" | "previous_year";

export interface EvolutionPoint {
  bucket: string;
  label: string;
  count: number;
}

export interface DashboardEvolutionResponse {
  date_from: string;
  date_to: string;
  group_by: GroupByGranularity;
  compare: CompareMode;
  total_current: number;
  total_compare: number;
  change_percent: number | null;
  current: EvolutionPoint[];
  comparison: EvolutionPoint[] | null;
  comparison_date_from: string | null;
  comparison_date_to: string | null;
}

export interface LeadDetail {
  id: number;
  externalId: number;
  tenantId: number;

  name: string;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  gender?: string | null;

  source: string;
  channel: string;
  campaign: string;
  ad?: string | null;
  trackingConfidence: string;

  currentStage: string;
  currentStageId?: number | null;
  status: string;
  conversationState?: ConversationState | string | null;

  hasAppointment: boolean;
  hasPayment: boolean;
  hasHealthInsurancePlan?: boolean | null;
  observations?: string | null;
  tags: string[];

  unitId?: number | null;
  unitName?: string | null;

  attendantId?: number | null;
  attendantName?: string | null;
  attendantEmail?: string | null;

  createdAt: string;
  updatedAt: string;
  convertedAt?: string | null;

  stageHistory: LeadStageHistoryDto[];
  conversations: LeadConversationDto[];
  assignments: LeadAssignmentDto[];
  payments: LeadPaymentDto[];
}

/* ─── Relatórios (Daily + Monthly resumo) ─── */

export interface DailyRelatoryDto {
  unidade: string;
  totalLeads: number;
  agendamentos: number;
  comPagamento: number;
  resgastes: number;
  observacoes: string;
  atendentes: string[];
}

export interface OrigemAgrupadaRelatorioDto {
  origem: string;
  quantidade: number;
}

export interface EtapaAgrupadaRelatorioDto {
  etapa: string;
  quantidade: number;
}

export interface UnidadeRelatorioItemDto {
  unitId: number | null;
  nome: string;
  quantidadeLeads: number;
}

export interface LeadsPorDiaItemDto {
  dia: number;
  quantidade: number;
}

export interface LeadRelatorioDetalheDto {
  nome: string;
  telefone: string;
  origem: string;
  stage: string;
  criadoEm: string;
}

export interface RelatorioMensalResumoDto {
  nomeClinica: string;
  mes: number;
  ano: number;
  geradoEm: string;
  totalLeads: number;
  taxaConversaoPercent: number;
  ticketMedio: number;
  leadsPorOrigem: OrigemAgrupadaRelatorioDto[];
  leadsPorUnidade: UnidadeRelatorioItemDto[];
  leadsPorEtapa: EtapaAgrupadaRelatorioDto[];
  leadsPorDia: LeadsPorDiaItemDto[];
  leads: LeadRelatorioDetalheDto[];
}

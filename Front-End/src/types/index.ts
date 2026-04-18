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
}

export interface ContactsListResponse {
  data: Contact[];
  pagination: ContactPagination;
  counts: ContactCounts;
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

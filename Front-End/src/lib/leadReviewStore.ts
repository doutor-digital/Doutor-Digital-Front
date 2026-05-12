/**
 * Persistência local dos campos de revisão de lead que ainda não existem
 * no backend. Permite que as SDR comecem a usar o formulário hoje, sem
 * depender da migração do backend.
 *
 * Quando o backend ganhar suporte aos campos, basta substituir as chamadas
 * por endpoints reais (mantendo a mesma forma do tipo `LeadReviewLocal`).
 */

const NAMESPACE = "lead-review";
const KEY_PREFIX = `${NAMESPACE}:v1:`;
const INDEX_KEY = `${NAMESPACE}:v1:index`;

export interface LeadReviewLocalReceipt {
  amount: number | null;
  method: string | null;       // pix | dinheiro | cartao_credito | ...
  receivedAt: string | null;   // ISO date (yyyy-MM-dd)
  isAdvance: boolean;
}

export interface LeadReviewLocal {
  leadId: number;
  leadType: "cadastro" | "resgate" | null;
  rescueType: "mensagem" | "ligacao" | "disparo_massa" | null;
  hadInteraction: boolean | null;
  scheduledConsultation: boolean | null;
  hasPaymentAdvance: boolean | null;
  appointmentScheduledAt: string | null;        // datetime-local (yyyy-MM-ddTHH:mm)
  noAppointmentReason: string | null;
  noAppointmentCity: string | null;

  consultationValue: number | null;
  consultationReceipts: LeadReviewLocalReceipt[]; // length 2
  indicatedTreatment: string | null;
  treatmentBudget: number | null;
  closedTreatment: boolean | null;
  noCloseReason: string | null;

  treatmentPlanCategory: string | null;
  treatmentPlanValue: number | null;
  treatmentReceipts: LeadReviewLocalReceipt[];   // length 6

  updatedAt: string; // ISO
}

export const EMPTY_RECEIPT: LeadReviewLocalReceipt = {
  amount: null,
  method: null,
  receivedAt: null,
  isAdvance: false,
};

export function emptyReview(leadId: number): LeadReviewLocal {
  return {
    leadId,
    leadType: null,
    rescueType: null,
    hadInteraction: null,
    scheduledConsultation: null,
    hasPaymentAdvance: null,
    appointmentScheduledAt: null,
    noAppointmentReason: null,
    noAppointmentCity: null,
    consultationValue: null,
    consultationReceipts: Array.from({ length: 2 }, () => ({ ...EMPTY_RECEIPT })),
    indicatedTreatment: null,
    treatmentBudget: null,
    closedTreatment: null,
    noCloseReason: null,
    treatmentPlanCategory: null,
    treatmentPlanValue: null,
    treatmentReceipts: Array.from({ length: 6 }, () => ({ ...EMPTY_RECEIPT })),
    updatedAt: new Date().toISOString(),
  };
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readIndex(): number[] {
  const ls = safeLocalStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === "number") : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: number[]) {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(INDEX_KEY, JSON.stringify([...new Set(ids)].sort((a, b) => a - b)));
  } catch {
    /* quota ou outro erro — segue em silêncio */
  }
}

export function loadReview(leadId: number): LeadReviewLocal | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY_PREFIX + leadId);
    if (!raw) return null;
    return JSON.parse(raw) as LeadReviewLocal;
  } catch {
    return null;
  }
}

export function saveReview(leadId: number, data: Omit<LeadReviewLocal, "leadId" | "updatedAt">) {
  const ls = safeLocalStorage();
  if (!ls) return;
  const payload: LeadReviewLocal = {
    leadId,
    ...data,
    updatedAt: new Date().toISOString(),
  };
  try {
    ls.setItem(KEY_PREFIX + leadId, JSON.stringify(payload));
    const idx = readIndex();
    if (!idx.includes(leadId)) writeIndex([...idx, leadId]);
    window.dispatchEvent(new CustomEvent("lead-review:saved", { detail: payload }));
  } catch {
    /* segue em silêncio */
  }
}

export function listAllReviews(): LeadReviewLocal[] {
  const ids = readIndex();
  return ids
    .map((id) => loadReview(id))
    .filter((r): r is LeadReviewLocal => r !== null);
}

// ─── Agregações pro dashboard ────────────────────────────────────────────────

export interface ReviewAggregates {
  total: number;
  cadastros: number;
  resgates: number;
  rescueTypes: Record<string, number>;       // mensagem|ligacao|disparo_massa → n
  noAppointmentReasons: Record<string, number>;
  noCloseReasons: Record<string, number>;
  responsibles: Record<number, number>;      // attendantId não fica aqui — fica no Lead
  closedCount: number;
  scheduledCount: number;
  attendedCount: number;
  // Financeiro
  expectedConsultaTotal: number;             // soma de receipts de consulta
  expectedTratamentoTotal: number;           // soma de receipts de tratamento
  advanceConsultaTotal: number;              // soma adiantados de consulta
  advanceTratamentoTotal: number;            // soma adiantados de tratamento
  byMethod: Record<string, number>;          // pix/dinheiro/... → soma
}

export function aggregateReviews(reviews: LeadReviewLocal[]): ReviewAggregates {
  const out: ReviewAggregates = {
    total: reviews.length,
    cadastros: 0,
    resgates: 0,
    rescueTypes: {},
    noAppointmentReasons: {},
    noCloseReasons: {},
    responsibles: {},
    closedCount: 0,
    scheduledCount: 0,
    attendedCount: 0,
    expectedConsultaTotal: 0,
    expectedTratamentoTotal: 0,
    advanceConsultaTotal: 0,
    advanceTratamentoTotal: 0,
    byMethod: {},
  };

  for (const r of reviews) {
    if (r.leadType === "cadastro") out.cadastros++;
    if (r.leadType === "resgate") {
      out.resgates++;
      if (r.rescueType) out.rescueTypes[r.rescueType] = (out.rescueTypes[r.rescueType] ?? 0) + 1;
    }
    if (r.noAppointmentReason)
      out.noAppointmentReasons[r.noAppointmentReason] =
        (out.noAppointmentReasons[r.noAppointmentReason] ?? 0) + 1;
    if (r.noCloseReason)
      out.noCloseReasons[r.noCloseReason] = (out.noCloseReasons[r.noCloseReason] ?? 0) + 1;
    if (r.closedTreatment === true) out.closedCount++;
    if (r.scheduledConsultation === true) out.scheduledCount++;
    if (r.consultationValue) out.attendedCount++;

    for (const rc of r.consultationReceipts) {
      const v = rc.amount ?? 0;
      if (!v) continue;
      out.expectedConsultaTotal += v;
      if (rc.isAdvance) out.advanceConsultaTotal += v;
      if (rc.method) out.byMethod[rc.method] = (out.byMethod[rc.method] ?? 0) + v;
    }
    for (const rc of r.treatmentReceipts) {
      const v = rc.amount ?? 0;
      if (!v) continue;
      out.expectedTratamentoTotal += v;
      if (rc.isAdvance) out.advanceTratamentoTotal += v;
      if (rc.method) out.byMethod[rc.method] = (out.byMethod[rc.method] ?? 0) + v;
    }
  }

  return out;
}

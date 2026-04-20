import { api } from "@/lib/api";
import { cleanParams, toInt } from "@/lib/http";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PaymentMethod =
  | "pix"
  | "dinheiro"
  | "debito"
  | "credito"
  | "boleto"
  | "transferencia";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

export const COMPOSITE_METHOD_LABEL = "Múltiplas formas";

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  if (method === "composite") return COMPOSITE_METHOD_LABEL;
  return PAYMENT_METHOD_LABEL[method as PaymentMethod] ?? method;
}

export interface TreatmentOption {
  key: string;
  name: string;
  defaultDurationMonths: number;
  defaultValue: number;
}

export interface PaymentSplitInput {
  paymentMethod: PaymentMethod;
  amount: number;
  installments: number;
  notes?: string;
}

export interface PaymentSplit {
  id: number;
  paymentMethod: PaymentMethod;
  amount: number;
  installments: number;
  installmentValue: number;
  notes?: string | null;
}

export interface PaymentCreateInput {
  leadId: number;
  clinicId?: number | string;
  treatment: string;
  treatmentDurationMonths: number;
  treatmentValue?: number;
  paymentMethod?: PaymentMethod;
  downPayment: number;
  installments: number;
  paidAt?: string;
  notes?: string;
  splits?: PaymentSplitInput[];
}

export interface Payment {
  id: number;
  leadId: number;
  leadName: string;
  unitId: number | null;
  unitName: string | null;
  treatment: string;
  treatmentDurationMonths: number;
  treatmentValue: number;
  paymentMethod: PaymentMethod | "composite";
  downPayment: number;
  installments: number;
  installmentValue: number;
  amount: number;
  notes: string | null;
  paidAt: string;
  createdAt: string;
  splits?: PaymentSplit[];
}

export interface PaymentMethodBreakdown {
  paymentMethod: PaymentMethod;
  quantity: number;
  total: number;
}

export interface UnitRevenue {
  unitId: number;
  clinicId: number;
  unitName: string;
  paymentsCount: number;
  totalRevenue: number;
  totalDownPayment: number;
  pendingBalance: number;
  byMethod: PaymentMethodBreakdown[];
}

export interface RevenueSummary {
  grandTotal: number;
  totalPayments: number;
  units: UnitRevenue[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface ListPaymentsParams {
  clinicId?: number | string;
  dateFrom?: string | null;
  dateTo?: string | null;
  treatment?: string | null;
  method?: PaymentMethod | null;
}

export interface RevenueParams {
  clinicId?: number | string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export const paymentsService = {
  async treatments(): Promise<TreatmentOption[]> {
    const { data } = await api.get<TreatmentOption[]>("/payments/treatments");
    return Array.isArray(data) ? data : [];
  },

  async create(input: PaymentCreateInput): Promise<Payment> {
    const { data } = await api.post<Payment>("/payments", {
      leadId: input.leadId,
      clinicId: toInt(input.clinicId),
      treatment: input.treatment,
      treatmentDurationMonths: input.treatmentDurationMonths,
      treatmentValue: input.treatmentValue,
      paymentMethod: input.paymentMethod,
      downPayment: input.downPayment,
      installments: input.installments,
      paidAt: input.paidAt,
      notes: input.notes,
      splits: input.splits?.length
        ? input.splits.map((s) => ({
            paymentMethod: s.paymentMethod,
            amount: s.amount,
            installments: s.installments,
            notes: s.notes,
          }))
        : undefined,
    });
    return data;
  },

  async list(params: ListPaymentsParams): Promise<Payment[]> {
    const { data } = await api.get<Payment[]>("/payments", {
      params: cleanParams({
        clinicId: toInt(params.clinicId),
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        treatment: params.treatment,
        method: params.method,
      }),
    });
    return Array.isArray(data) ? data : [];
  },

  async byLead(leadId: number, clinicId?: number | string): Promise<Payment[]> {
    const { data } = await api.get<Payment[]>(`/payments/lead/${leadId}`, {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });
    return Array.isArray(data) ? data : [];
  },

  async revenueByUnit(params: RevenueParams): Promise<RevenueSummary> {
    const { data } = await api.get<RevenueSummary>("/payments/revenue/by-unit", {
      params: cleanParams({
        clinicId: toInt(params.clinicId ?? undefined),
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
    });
    return data ?? { grandTotal: 0, totalPayments: 0, units: [] };
  },

  async remove(paymentId: number, clinicId?: number | string): Promise<void> {
    await api.delete(`/payments/${paymentId}`, {
      params: cleanParams({ clinicId: toInt(clinicId) }),
    });
  },
};

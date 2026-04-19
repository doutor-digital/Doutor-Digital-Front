import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { paymentsService, type PaymentCreateInput } from "@/services/payments";
import { qk } from "@/hooks/queries/keys";

export function useTreatments() {
  return useQuery({
    queryKey: qk.payments.treatments(),
    queryFn: () => paymentsService.treatments(),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePayments(params: {
  clinicId?: number;
  dateFrom?: string | null;
  dateTo?: string | null;
  treatment?: string | null;
  method?: string | null;
}) {
  return useQuery({
    queryKey: qk.payments.list(
      params.clinicId,
      params.dateFrom,
      params.dateTo,
      params.treatment,
      params.method
    ),
    queryFn: () =>
      paymentsService.list({
        clinicId: params.clinicId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        treatment: params.treatment,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        method: params.method as any,
      }),
    enabled: !!params.clinicId,
  });
}

export function useRevenueByUnit(params: {
  clinicId?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  return useQuery({
    queryKey: qk.payments.revenue(params.clinicId, params.dateFrom, params.dateTo),
    queryFn: () =>
      paymentsService.revenueByUnit({
        clinicId: params.clinicId ?? undefined,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
  });
}

export function useLeadPayments(leadId: number | null | undefined, clinicId?: number) {
  return useQuery({
    queryKey: qk.payments.byLead(leadId ?? 0, clinicId),
    queryFn: () => paymentsService.byLead(leadId ?? 0, clinicId),
    enabled: !!leadId,
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PaymentCreateInput) => paymentsService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.payments.all() });
      toast.success("Pagamento registrado com sucesso!");
    },
    onError: () => {
      // api interceptor já mostra toast em 4xx/5xx com detail
    },
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clinicId }: { id: number; clinicId?: number }) =>
      paymentsService.remove(id, clinicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.payments.all() });
      toast.success("Pagamento removido");
    },
  });
}

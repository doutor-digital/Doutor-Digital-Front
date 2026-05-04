import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { qk } from "@/hooks/queries/keys";
import {
  cashMovementsService,
  type CreateCashMovementInput,
  type FindAllCashMovementInput,
  type UpdateCashMovementInput,
} from "@/services/cashMovements";

export function useCashMovementsHistory(input: FindAllCashMovementInput) {
  return useQuery({
    queryKey: qk.cashMovements.history(input),
    queryFn: () => cashMovementsService.history(input),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useCashMovementsDashboard(date?: string | null) {
  return useQuery({
    queryKey: qk.cashMovements.dashboard(date),
    queryFn: () => cashMovementsService.dashboardStats(date),
    staleTime: 60_000,
  });
}

export function useCreateCashMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCashMovementInput) =>
      cashMovementsService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cashMovements.all() });
      toast.success("Movimentação registrada com sucesso!");
    },
  });
}

export function useUpdateCashMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateCashMovementInput;
    }) => cashMovementsService.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cashMovements.all() });
      toast.success("Movimentação atualizada");
    },
  });
}

export function useDeleteCashMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cashMovementsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cashMovements.all() });
      toast.success("Movimentação excluída");
    },
  });
}

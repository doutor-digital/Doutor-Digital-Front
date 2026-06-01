import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  canEdit,
  canInvite,
  canViewAdvancedLogs,
  isAdminLevel,
  isReadOnly,
} from "@/lib/roles";

/**
 * Permissões derivadas do papel do usuário logado. A barreira real de escrita
 * está no back (ReadOnlyRoleMiddleware); aqui é UX — esconder botões de
 * editar/salvar/excluir para papéis somente-leitura (trafego_pago).
 */
export function usePermissions() {
  const role = useAuth((s) => s.user?.role);

  return useMemo(
    () => ({
      role,
      canEdit: canEdit(role),
      isReadOnly: isReadOnly(role),
      isAdminLevel: isAdminLevel(role),
      canViewAdvancedLogs: canViewAdvancedLogs(role),
      canInvite: canInvite(role),
    }),
    [role],
  );
}

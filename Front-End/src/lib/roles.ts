/**
 * Fonte única de verdade dos papéis no front. Espelha o helper `Roles.cs` do back.
 * As checagens normalizam para lowercase e aceitam variantes com hífen.
 */
export type Role =
  | "super_admin"
  | "analista_ti"
  | "trafego_pago"
  | "sdr"
  | "manager"
  | "unit_user";

const norm = (role?: string | null) => (role ?? "").trim().toLowerCase();

export function isSuperAdmin(role?: string | null): boolean {
  const r = norm(role);
  return r === "super_admin" || r === "super-admin" || r === "superadmin";
}

export function isAnalistaTi(role?: string | null): boolean {
  const r = norm(role);
  return r === "analista_ti" || r === "analista-ti";
}

/** super_admin OU analista_ti — acesso total + logs avançados. */
export function isAdminLevel(role?: string | null): boolean {
  return isSuperAdmin(role) || isAnalistaTi(role);
}

/** trafego_pago — só visualiza números, somente leitura. */
export function isReadOnly(role?: string | null): boolean {
  const r = norm(role);
  return r === "trafego_pago" || r === "trafego-pago";
}

/**
 * Rotas que o papel somente-leitura (trafego_pago) pode acessar — "só os números".
 * Tudo fora daqui fica não-clicável na sidebar e bloqueado por URL.
 */
export const READONLY_ALLOWED_PATHS = ["/", "/desempenho", "/analytics", "/evolution", "/sources"] as const;

/** A rota é permitida pro papel somente-leitura? (exata ou sub-rota). */
export function isPathAllowedForReadOnly(path: string): boolean {
  if (path === "/") return true;
  return READONLY_ALLOWED_PATHS.some((p) => p !== "/" && (path === p || path.startsWith(`${p}/`)));
}

/** Pode ver o painel de logs/auditoria avançada. */
export function canViewAdvancedLogs(role?: string | null): boolean {
  return isAdminLevel(role);
}

/** Pode editar/criar/excluir (qualquer papel que não seja somente-leitura). */
export function canEdit(role?: string | null): boolean {
  return !isReadOnly(role);
}

/** Pode criar convites. */
export function canInvite(role?: string | null): boolean {
  const r = norm(role);
  return isAdminLevel(role) || r === "sdr" || r === "manager";
}

/** Rótulo amigável (pt-BR) para exibir o papel. */
export function roleLabel(role?: string | null): string {
  const r = norm(role);
  if (isSuperAdmin(r)) return "Super-admin";
  if (isAnalistaTi(r)) return "Analista de TI";
  if (isReadOnly(r)) return "Tráfego pago";
  switch (r) {
    case "sdr":
      return "SDR";
    case "manager":
      return "Gerente";
    case "unit_user":
      return "Usuário";
    default:
      return role ?? "—";
  }
}

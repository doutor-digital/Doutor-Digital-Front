import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy as CopyIcon,
  Mail,
  Plug,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { configurationService } from "@/services/configuration";
import {
  invitationsService,
  type InvitationListItem,
} from "@/services/invitations";
import { unitsService } from "@/services/units";
import type { Unit } from "@/types";
import type { CloudiaKeyStatusDto } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";

const CLOUDIA_LOGO =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-L72aOKqwGjo2c3mVSTj-Y0EAuUiOJNXDAQ&s";

export default function IntegracoesPage() {
  const { user } = useAuth();
  const { unitId, tenantId } = useClinic();

  const [status, setStatus] = useState<CloudiaKeyStatusDto | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [units, setUnits] = useState<Unit[]>([]);
  const [invitations, setInvitations] = useState<InvitationListItem[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUnitId, setInviteUnitId] = useState<number | "">(unitId ?? "");
  const [inviteRole, setInviteRole] =
    useState<"unit_user" | "sdr" | "manager">("unit_user");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const isPrivileged = useMemo(() => {
    const r = (user?.role || "").toLowerCase();
    return ["super_admin", "super-admin", "superadmin", "sdr", "manager"].includes(r);
  }, [user?.role]);

  async function loadStatus() {
    setStatusLoading(true);
    try {
      const s = await configurationService.getCloudiaStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }

  async function loadUnits() {
    try {
      const list = await unitsService.list();
      setUnits(list);
    } catch {
      setUnits([]);
    }
  }

  async function loadInvitations() {
    if (!isPrivileged) return;
    setInvitesLoading(true);
    try {
      const list = await invitationsService.list(
        typeof inviteUnitId === "number" ? inviteUnitId : undefined,
      );
      setInvitations(list);
    } catch {
      setInvitations([]);
    } finally {
      setInvitesLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    loadUnits();
  }, []);

  useEffect(() => {
    loadInvitations();
  }, [inviteUnitId, isPrivileged]);

  async function handleSendInvite() {
    if (!inviteEmail || typeof inviteUnitId !== "number") {
      toast.error("Informe email e unidade.");
      return;
    }
    setInviteSubmitting(true);
    try {
      const res = await invitationsService.create({
        email: inviteEmail.trim().toLowerCase(),
        unitId: inviteUnitId,
        role: inviteRole,
      });
      toast.success("Convite enviado!");
      setInviteEmail("");
      try {
        await navigator.clipboard.writeText(res.acceptUrl);
        toast.message("Link de aceite copiado para a área de transferência.");
      } catch {
        /* clipboard pode estar bloqueado */
      }
      loadInvitations();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Falha ao enviar convite";
      toast.error(msg);
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleRevoke(id: number) {
    try {
      await invitationsService.revoke(id);
      toast.success("Convite revogado.");
      loadInvitations();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Falha ao revogar");
    }
  }

  const cloudiaConnected = Boolean(status?.configured);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-50">Integrações</h1>
        <p className="text-sm text-slate-400">
          Conecte serviços externos e gerencie convites por unidade.
        </p>
      </header>

      {/* ── Card Cloudia ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-white/[0.06] bg-[#0a0a0d] p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-white/10">
            <img
              src={CLOUDIA_LOGO}
              alt="Cloudia"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-50">Cloudia</h2>
              {cloudiaConnected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                  <CheckCircle2 className="h-3 w-3" /> Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-inset ring-amber-400/20">
                  <XCircle className="h-3 w-3" /> Não conectado
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Recebe leads via webhook (TenantId + payload). A Cloudia não
              expõe API key — você só precisa configurar o webhook do lado
              dela apontando para este backend.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">
                  Tenant atual
                </div>
                <div className="mt-1 text-sm text-slate-100">
                  {tenantId ?? "—"}
                </div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">
                  Status do webhook
                </div>
                <div className="mt-1 text-sm text-slate-100">
                  {statusLoading
                    ? "Verificando…"
                    : cloudiaConnected
                      ? "Configurado"
                      : "Não configurado"}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                onClick={loadStatus}
                className="bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar status
              </Button>
              <a
                href="/cadastro/integracoes"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-slate-200 hover:bg-white/[0.06]"
              >
                <Plug className="h-3.5 w-3.5" /> Configurar conexão
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Convites ─────────────────────────────────────────────────── */}
      {isPrivileged && (
        <section className="rounded-xl border border-white/[0.06] bg-[#0a0a0d] p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-semibold text-slate-50">
              Convidar usuário
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Email
              </label>
              <Input
                icon={<Mail className="h-4 w-4" />}
                type="email"
                placeholder="usuario@empresa.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="md:col-span-4">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Unidade
              </label>
              <select
                value={inviteUnitId}
                onChange={(e) =>
                  setInviteUnitId(
                    e.target.value ? Number(e.target.value) : "",
                  )
                }
                className="mt-1.5 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-slate-100 focus:border-emerald-400/30 focus:outline-none"
              >
                <option value="">Selecione…</option>
                {units.map((u) => (
                  <option key={String(u.id)} value={Number(u.id)}>
                    {u.name ?? `Unidade ${u.id}`} (#{u.clinicId ?? u.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Papel
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="mt-1.5 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-slate-100 focus:border-emerald-400/30 focus:outline-none"
              >
                <option value="unit_user">Usuário (só esta unidade)</option>
                <option value="sdr">SDR (todas do tenant)</option>
                <option value="manager">Gerente</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button
              loading={inviteSubmitting}
              onClick={handleSendInvite}
              className="bg-[#0077CC] hover:bg-[#0088EE] text-white"
            >
              Enviar convite
            </Button>
            <p className="text-[11px] text-slate-500">
              O convite é enviado por email e expira em 72 horas. A pessoa entra
              com a conta Google deste mesmo email.
            </p>
          </div>

          {/* Lista de convites */}
          <div className="mt-6 rounded-md border border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between bg-white/[0.02] px-4 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Convites pendentes
                {typeof inviteUnitId === "number" ? " (filtrado por unidade)" : ""}
              </p>
              <button
                onClick={loadInvitations}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                <RefreshCw className="inline-block h-3 w-3 mr-1" /> recarregar
              </button>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {invitesLoading && (
                <p className="px-4 py-4 text-sm text-slate-500">Carregando…</p>
              )}
              {!invitesLoading && invitations.length === 0 && (
                <p className="px-4 py-4 text-sm text-slate-500">
                  Sem convites pendentes.
                </p>
              )}
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-slate-100 truncate">
                      {inv.email}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {inv.unitName ?? `Unit #${inv.unitId}`} ·{" "}
                      {inv.role.toUpperCase()} · expira em{" "}
                      {new Date(inv.expiresAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard
                        .writeText(
                          `${window.location.origin}/invite/${"<token enviado por email>"}`,
                        )
                        .catch(() => undefined);
                      toast.message(
                        "O link com o token está apenas no email enviado.",
                      );
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                    title="O token é exposto apenas no email enviado"
                  >
                    <CopyIcon className="inline-block h-3 w-3" /> copiar link
                  </button>
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-3 w-3" /> revogar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {!isPrivileged && (
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-400">
          <ShieldAlert className="inline-block h-4 w-4 mr-1 text-amber-400" />
          Você não tem permissão para gerenciar convites. Fale com um SDR ou
          super-admin.
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  XCircle,
  Mail,
  Trash2,
  UserPlus,
  ShieldAlert,
  Plug,
} from "@/components/icons";
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
import { CloudiaConnectModal } from "@/components/integracoes/CloudiaConnectModal";
import { toast } from "sonner";

type Category = "all" | "crm" | "ads" | "automation" | "webhook";
type ProviderId = "cloudia" | "kommo" | "meta" | "google" | "n8n" | "webhook";
type ProviderStatus = "available" | "beta" | "coming-soon";

interface Provider {
  id: ProviderId;
  name: string;
  category: Exclude<Category, "all">;
  status: ProviderStatus;
  description: string;
  logoUrl?: string;
  /** Cor de destaque do card (Tailwind tone). */
  tone:
    | "cyan"
    | "fuchsia"
    | "blue"
    | "amber"
    | "violet"
    | "emerald"
    | "rose";
}

const PROVIDERS: Provider[] = [
  {
    id: "cloudia",
    name: "Cloudia",
    category: "crm",
    status: "available",
    description:
      "CRM principal — recebe leads via webhook em tempo real. Sem polling.",
    logoUrl:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-L72aOKqwGjo2c3mVSTj-Y0EAuUiOJNXDAQ&s",
    tone: "cyan",
  },
  {
    id: "kommo",
    name: "Kommo",
    category: "crm",
    status: "available",
    description:
      "Pipeline e mensagens (WhatsApp, Instagram). Sincroniza leads e tags.",
    logoUrl:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSSlQHmQRY_KuFZVSs4YtikJ7j0S1Qdq0tB5w&s",
    tone: "fuchsia",
  },
  {
    id: "meta",
    name: "Meta Ads",
    category: "ads",
    status: "beta",
    description:
      "Lead Ads e Pixel via webhook. Atribui campanha, conjunto e criativo. Envia eventos para CAPI.",
    logoUrl: "https://www.facebook.com/images/fb_icon_325x325.png",
    tone: "blue",
  },
  {
    id: "google",
    name: "Google Ads",
    category: "ads",
    status: "coming-soon",
    description:
      "Lead Form Extensions e Call Ads. UTM e campanha automáticos.",
    logoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Google_Ads_logo.svg/240px-Google_Ads_logo.svg.png",
    tone: "amber",
  },
  {
    id: "n8n",
    name: "n8n",
    category: "automation",
    status: "beta",
    description:
      "Workflows de automação. Resgates, follow-up e relatórios diários no WhatsApp.",
    logoUrl: "https://docs.n8n.io/_images/n8n-logo.png",
    tone: "violet",
  },
  {
    id: "webhook",
    name: "Webhook genérico",
    category: "webhook",
    status: "available",
    description:
      "Endpoint público para Zapier, Make e outros. Aceita JSON com campos da Cloudia.",
    tone: "emerald",
  },
];

const CATEGORY_LABEL: Record<Category, string> = {
  all: "Todas",
  crm: "CRM",
  ads: "Anúncios",
  automation: "Automação",
  webhook: "Webhook",
};

export default function IntegracoesPage() {
  const { user } = useAuth();
  const { unitId } = useClinic();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");

  const [cloudiaStatus, setCloudiaStatus] = useState<CloudiaKeyStatusDto | null>(
    null,
  );
  const [statusLoading, setStatusLoading] = useState(false);
  const [cloudiaModalOpen, setCloudiaModalOpen] = useState(false);

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
      setCloudiaStatus(s);
    } catch {
      setCloudiaStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }

  async function loadUnits() {
    try {
      setUnits(await unitsService.list());
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        toast.message("Link copiado.");
      } catch {
        /* clipboard pode estar bloqueado */
      }
      loadInvitations();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Falha ao enviar convite");
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

  function statusOf(p: Provider): {
    label: string;
    connected?: boolean;
    soon?: boolean;
  } {
    if (p.status === "coming-soon") return { label: "Em breve", soon: true };
    if (p.id === "cloudia") {
      return cloudiaStatus?.configured
        ? { label: "Conectado", connected: true }
        : { label: "Disponível" };
    }
    return p.status === "beta" ? { label: "Beta" } : { label: "Disponível" };
  }

  const visibleProviders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PROVIDERS.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [search, category]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">
            Marketplace de Integrações
          </h1>
          <p className="text-sm text-slate-400">
            Conecte a Doutor Digital a CRMs, ferramentas de anúncios e
            automações.
          </p>
        </div>
        <Button
          onClick={loadStatus}
          className="bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${statusLoading ? "animate-spin" : ""}`}
          />
          Atualizar status
        </Button>
      </header>

      {/* busca + filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <Input
            icon={<Search className="h-4 w-4" />}
            placeholder="Buscar integração…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={[
                "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                category === c
                  ? "bg-emerald-400/10 text-emerald-200 ring-1 ring-inset ring-emerald-400/20"
                  : "bg-white/[0.03] text-slate-400 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.06] hover:text-slate-200",
              ].join(" ")}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      {/* grid de cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleProviders.map((p) => {
          const st = statusOf(p);
          return (
            <ProviderCard
              key={p.id}
              provider={p}
              status={st}
              onConnect={() => {
                if (p.id === "cloudia") setCloudiaModalOpen(true);
                else if (p.status === "coming-soon")
                  toast.message("Em breve — fica de olho!");
                else
                  toast.message(
                    `Conexão com ${p.name} ainda não está habilitada por aqui.`,
                  );
              }}
            />
          );
        })}
        {visibleProviders.length === 0 && (
          <div className="col-span-full rounded-md border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-slate-500">
            Nenhuma integração encontrada para "{search}".
          </div>
        )}
      </div>

      {/* equipe / convites */}
      <section className="rounded-2xl border border-white/[0.06] bg-[#0a0a0d] p-6">
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="h-5 w-5 text-emerald-300" />
          <h2 className="text-lg font-semibold text-slate-50">Equipe</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Convide pessoas pra unidades específicas. SDR vê tudo do tenant;{" "}
          <em>unit_user</em> só enxerga a unidade convidada.
        </p>

        {!isPrivileged ? (
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-400">
            <ShieldAlert className="inline-block h-4 w-4 mr-1 text-amber-400" />
            Só super-admin, SDR ou gerente pode convidar.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <label className="text-[10px] uppercase tracking-widest text-slate-500">
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
                <label className="text-[10px] uppercase tracking-widest text-slate-500">
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
                <label className="text-[10px] uppercase tracking-widest text-slate-500">
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
                Convite expira em 72h. A pessoa entra com Google.
              </p>
            </div>

            <div className="mt-6 rounded-md border border-white/[0.06] overflow-hidden">
              <div className="flex items-center justify-between bg-white/[0.02] px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Pendentes
                  {typeof inviteUnitId === "number"
                    ? " (filtrado por unidade)"
                    : ""}
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
                  <p className="px-4 py-4 text-sm text-slate-500">
                    Carregando…
                  </p>
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
                      onClick={() => handleRevoke(inv.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3 w-3" /> revogar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      <CloudiaConnectModal
        open={cloudiaModalOpen}
        onClose={() => setCloudiaModalOpen(false)}
        onConnected={loadStatus}
      />
    </div>
  );
}

interface ProviderCardProps {
  provider: Provider;
  status: { label: string; connected?: boolean; soon?: boolean };
  onConnect: () => void;
}

function ProviderCard({ provider, status, onConnect }: ProviderCardProps) {
  const tone = TONE_PALETTE[provider.tone];
  return (
    <div
      className={[
        "group relative flex flex-col rounded-2xl border bg-white/[0.02] p-5 transition-all",
        "hover:bg-white/[0.04]",
        tone.border,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={[
              "h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white",
              "ring-1 ring-white/10",
              "flex items-center justify-center",
            ].join(" ")}
          >
            {provider.logoUrl ? (
              <img
                src={provider.logoUrl}
                alt={provider.name}
                className="h-full w-full object-contain"
                onError={(e) => {
                  // se a logo falhar, esconde a img — fundo branco basta
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Plug className={`h-6 w-6 ${tone.text}`} />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-50">
              {provider.name}
            </h3>
            <p
              className={`text-[10px] uppercase tracking-widest ${tone.text}`}
            >
              {CATEGORY_LABEL[provider.category]}
            </p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
        {provider.description}
      </p>

      <div className="mt-auto pt-4">
        {status.soon ? (
          <button
            disabled
            className="w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] text-slate-500"
          >
            <Sparkles className="mr-1 inline-block h-3.5 w-3.5" />
            Em breve
          </button>
        ) : status.connected ? (
          <button
            onClick={onConnect}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12.5px] font-medium text-slate-100 hover:bg-white/[0.08]"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Configurar
          </button>
        ) : (
          <button
            onClick={onConnect}
            className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-semibold transition-colors ${tone.btn}`}
          >
            Conectar
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: { label: string; connected?: boolean; soon?: boolean };
}) {
  if (status.soon) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-inset ring-amber-400/20">
        {status.label}
      </span>
    );
  }
  if (status.connected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
        <CheckCircle2 className="h-3 w-3" /> {status.label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-slate-400 ring-1 ring-inset ring-white/[0.06]">
      <XCircle className="h-3 w-3" /> {status.label}
    </span>
  );
}

const TONE_PALETTE: Record<
  Provider["tone"],
  { border: string; text: string; btn: string }
> = {
  cyan: {
    border: "border-cyan-500/20",
    text: "text-cyan-300",
    btn: "bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25",
  },
  fuchsia: {
    border: "border-fuchsia-500/20",
    text: "text-fuchsia-300",
    btn: "bg-fuchsia-500/15 text-fuchsia-100 hover:bg-fuchsia-500/25",
  },
  blue: {
    border: "border-blue-500/20",
    text: "text-blue-300",
    btn: "bg-blue-500/15 text-blue-100 hover:bg-blue-500/25",
  },
  amber: {
    border: "border-amber-500/20",
    text: "text-amber-300",
    btn: "bg-amber-500/15 text-amber-100 hover:bg-amber-500/25",
  },
  violet: {
    border: "border-violet-500/20",
    text: "text-violet-300",
    btn: "bg-violet-500/15 text-violet-100 hover:bg-violet-500/25",
  },
  emerald: {
    border: "border-emerald-500/20",
    text: "text-emerald-300",
    btn: "bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25",
  },
  rose: {
    border: "border-rose-500/20",
    text: "text-rose-300",
    btn: "bg-rose-500/15 text-rose-100 hover:bg-rose-500/25",
  },
};

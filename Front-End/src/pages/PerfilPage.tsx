import { useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  UserCircle,
} from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { authService, type MeResponse } from "@/services/auth";
import { Loader2 } from "@/components/icons";

export default function PerfilPage() {
  const { user } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authService
      .me()
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        // Em caso de erro, mostra só o que já tinha do useAuth
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const photoUrl = me?.photoUrl ?? user?.photoUrl ?? null;
  const name = me?.name ?? user?.name ?? "—";
  const email = me?.email ?? user?.email ?? "—";
  const role = me?.role ?? user?.role ?? "—";
  const phone = me?.phone ?? user?.phone ?? null;
  const authMethod = me?.authMethod ?? "password";

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-50">Meu perfil</h1>
        <p className="text-sm text-slate-400">
          Suas informações de acesso e permissões.
        </p>
      </header>

      {/* Card principal */}
      <section className="rounded-2xl border border-white/[0.06] bg-[#0a0a0d] p-6">
        <div className="flex flex-wrap items-center gap-5">
          {/* Avatar grande */}
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-100">
                {initials}
              </div>
            )}
            <span
              aria-label="online"
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#0a0a0d]"
            />
          </div>

          {/* Identidade */}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-slate-50 truncate">
              {name}
            </h2>
            <p className="text-sm text-slate-400 truncate">{email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <RoleBadge role={role} />
              <AuthMethodBadge method={authMethod} />
              {me?.tenantId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-slate-300 ring-1 ring-inset ring-white/[0.06]">
                  <Building2 className="h-3 w-3" />
                  Tenant {me.tenantId}
                </span>
              )}
            </div>
          </div>

          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          )}
        </div>
      </section>

      {/* Detalhes em grid */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DetailCard
          icon={<UserCircle className="h-4 w-4 text-cyan-300" />}
          label="Nome completo"
          value={name}
        />
        <DetailCard
          icon={<Mail className="h-4 w-4 text-cyan-300" />}
          label="Email"
          value={email}
        />
        <DetailCard
          icon={<Phone className="h-4 w-4 text-cyan-300" />}
          label="Telefone"
          value={phone ?? "—"}
        />
        <DetailCard
          icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />}
          label="Papel"
          value={role}
        />
        <DetailCard
          icon={<KeyRound className="h-4 w-4 text-amber-300" />}
          label="Método de autenticação"
          value={authMethod === "google" ? "Google" : "Email + senha"}
        />
        <DetailCard
          icon={<Clock className="h-4 w-4 text-slate-300" />}
          label="Último login"
          value={
            me?.lastLoginAt
              ? new Date(me.lastLoginAt).toLocaleString()
              : "—"
          }
        />
        <DetailCard
          icon={<Calendar className="h-4 w-4 text-slate-300" />}
          label="Conta criada em"
          value={
            me?.createdAt ? new Date(me.createdAt).toLocaleString() : "—"
          }
        />
        <DetailCard
          icon={<Building2 className="h-4 w-4 text-slate-300" />}
          label="Unidades acessíveis"
          value={
            me?.unitIds && me.unitIds.length
              ? me.unitIds.join(", ")
              : "Todas (super-admin / SDR)"
          }
        />
      </section>

      <p className="text-[11px] text-slate-500">
        Os dados acima vêm de <code>GET /api/auth/me</code>. Quem entrou via
        Google tem o avatar sincronizado automaticamente do{" "}
        <code>id_token</code>.
      </p>
    </div>
  );
}

function DetailCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0d] p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 text-[14px] text-slate-100 break-words">{value}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    super_admin: {
      label: "Super-admin",
      cls: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    },
    sdr: {
      label: "SDR",
      cls: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    },
    manager: {
      label: "Gerente",
      cls: "bg-cyan-400/10 text-cyan-300 ring-cyan-400/20",
    },
    unit_user: {
      label: "Usuário de unidade",
      cls: "bg-white/[0.04] text-slate-200 ring-white/[0.08]",
    },
  };
  const m = map[role.toLowerCase()] ?? {
    label: role,
    cls: "bg-white/[0.04] text-slate-200 ring-white/[0.08]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${m.cls}`}
    >
      <CheckCircle2 className="h-3 w-3" />
      {m.label}
    </span>
  );
}

function AuthMethodBadge({ method }: { method: string }) {
  const isGoogle = method === "google";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
        isGoogle
          ? "bg-blue-400/10 text-blue-200 ring-blue-400/20"
          : "bg-white/[0.04] text-slate-200 ring-white/[0.08]"
      }`}
    >
      <KeyRound className="h-3 w-3" />
      {isGoogle ? "Google" : "Senha"}
    </span>
  );
}

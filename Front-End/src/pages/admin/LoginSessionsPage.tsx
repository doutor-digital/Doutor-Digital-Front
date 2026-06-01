import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Globe, MapPin, Smartphone } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/Input";
import { adminLogsService, type LoginSession } from "@/services/adminLogs";
import { roleLabel } from "@/lib/roles";

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR");
}

function fmtMinutes(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}min`;
}

function geoLabel(s: LoginSession) {
  const parts = [s.geoCity, s.geoRegion, s.geoCountry].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export default function LoginSessionsPage() {
  const [email, setEmail] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-login-sessions", email, onlyActive],
    queryFn: () =>
      adminLogsService.loginSessions({
        email: email || undefined,
        active: onlyActive || undefined,
        pageSize: 200,
      }),
    refetchInterval: 30_000,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Sessões de login"
        description="De onde acessaram (IP + localização) e quanto tempo ficaram ativas."
        badge="Logs avançados"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filtrar por email…"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-[13px] text-slate-300">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
          />
          Somente ativas agora
        </label>
        <span className="text-[12px] text-slate-500">
          {data?.total ?? 0} sessões
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-slate-900/40">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-slate-400">
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-2.5 font-medium">Usuária</th>
              <th className="px-3 py-2.5 font-medium">Papel</th>
              <th className="px-3 py-2.5 font-medium"><Globe className="inline h-3.5 w-3.5" /> IP</th>
              <th className="px-3 py-2.5 font-medium"><MapPin className="inline h-3.5 w-3.5" /> Localização</th>
              <th className="px-3 py-2.5 font-medium"><Smartphone className="inline h-3.5 w-3.5" /> Dispositivo</th>
              <th className="px-3 py-2.5 font-medium">Login</th>
              <th className="px-3 py-2.5 font-medium"><Clock className="inline h-3.5 w-3.5" /> Ativo</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">Carregando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">Nenhuma sessão.</td></tr>
            ) : (
              items.map((s) => (
                <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5">
                    <div className="text-slate-100">{s.userName ?? "—"}</div>
                    <div className="text-[11px] text-slate-500">{s.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300">{roleLabel(s.role)}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-300">{s.ip ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-300">
                    {geoLabel(s)}
                    {s.geoConsent && s.latitude != null && (
                      <a
                        className="ml-1.5 text-emerald-300 hover:underline"
                        href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        (GPS)
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400">{s.device ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-400">{fmtDate(s.loginAt)}</td>
                  <td className="px-3 py-2.5 text-slate-200">{fmtMinutes(s.activeMinutes)}</td>
                  <td className="px-3 py-2.5">
                    {s.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                        ● online
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">encerrada</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

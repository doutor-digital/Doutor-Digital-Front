import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, Calendar, Loader2, Stethoscope, Users } from "@/components/icons";
import { kpiConfigService, type AgeStat } from "@/services/kpiConfig";
import { formatNumber } from "@/lib/utils";

const SEGMENTS: Array<{ key: keyof Ages; label: string; color: string }> = [
  { key: "overall", label: "Contato (todos)", color: "#22d3ee" },
  { key: "agendou", label: "Agendou", color: "#60a5fa" },
  { key: "compareceu", label: "Compareceu", color: "#a78bfa" },
  { key: "fechou", label: "Fechou", color: "#34d399" },
  { key: "faltou", label: "Faltou", color: "#f87171" },
];

interface Ages {
  overall: AgeStat;
  agendou: AgeStat;
  compareceu: AgeStat;
  fechou: AgeStat;
  faltou: AgeStat;
}

function diaLabel(d: number) {
  if (d <= 0) return "hoje";
  if (d === 1) return "amanhã";
  return `em ${d} dias`;
}

/**
 * Perfil avançado do lead na dashboard: alerta de agendamentos próximos (notificação),
 * idade média por desfecho e ranking do doutor responsável. Autocontido (próprio fetch).
 */
export function LeadProfilePanel({
  unitId,
  dateFrom,
  dateTo,
}: {
  unitId: number | null;
  dateFrom: string;
  dateTo: string;
}) {
  const from = dateFrom.slice(0, 10);
  const to = dateTo.slice(0, 10);

  const q = useQuery({
    queryKey: ["lead-profile", unitId, from, to],
    queryFn: () => kpiConfigService.leadProfile(unitId, { date_from: from, date_to: to, upcoming_days: 7 }),
  });

  const [showAllAppts, setShowAllAppts] = useState(false);
  const data = q.data;
  const upcoming = data?.upcoming ?? [];
  const docMax = data?.doctors[0]?.count ?? 1;

  return (
    <div
      className="mt-4 rounded-2xl bg-[#0f1f3a]/80 p-5 ring-1 ring-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      style={{ borderTop: "4px solid #a78bfa" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
        Perfil do lead · análise avançada
      </p>

      {q.isLoading ? (
        <div className="grid h-28 place-items-center text-white/40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Alerta de agendamentos próximos ── */}
          {upcoming.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] p-3.5">
              <p className="flex items-center gap-2 text-[12.5px] font-semibold text-amber-200">
                <Bell className="h-4 w-4" />
                {upcoming.length} lead(s) com agendamento nos próximos 7 dias
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {(showAllAppts ? upcoming : upcoming.slice(0, 5)).map((u) => (
                  <li key={u.lead_id}>
                    <Link
                      to={`/leads/${u.lead_id}`}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-[12px] transition hover:bg-white/[0.04]"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-slate-200">
                        <Calendar className="h-3 w-3 shrink-0 text-amber-300" />
                        <span className="truncate">{u.name || "Lead"}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-amber-200/90">
                        {diaLabel(u.days_until)} ·{" "}
                        {new Date(u.scheduled_at).toLocaleDateString("pt-BR")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {upcoming.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllAppts((v) => !v)}
                  className="mt-1.5 text-[11px] text-amber-200/70 hover:text-amber-100"
                >
                  {showAllAppts ? "ver menos" : `ver todos (${upcoming.length})`}
                </button>
              )}
            </div>
          )}

          {/* ── Idade média por desfecho ── */}
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
            Idade média por desfecho
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {SEGMENTS.map((s) => {
              const stat = data?.age[s.key];
              const has = (stat?.count ?? 0) > 0;
              return (
                <div
                  key={s.key}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                  style={{ borderTop: `3px solid ${s.color}` }}
                >
                  <p className="text-[10px] uppercase tracking-wider text-white/45">{s.label}</p>
                  <p className="mt-1.5 text-2xl font-semibold tabular-nums text-white">
                    {has ? Math.round(stat!.avg) : "—"}
                    {has && <span className="ml-1 text-[11px] font-normal text-white/40">anos</span>}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-white/35">
                    {has ? `${formatNumber(stat!.count)} c/ idade` : "sem dado de idade"}
                  </p>
                </div>
              );
            })}
          </div>

          {/* ── Doutor responsável ── */}
          {(data?.doctors.length ?? 0) > 0 && (
            <>
              <p className="mt-5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                <Stethoscope className="h-3 w-3" /> Doutor responsável
              </p>
              <ul className="mt-2.5 space-y-2">
                {data!.doctors.map((d) => (
                  <li key={d.label} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-[12px] text-slate-200">{d.label}</span>
                    <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-violet-400/70"
                        style={{ width: `${Math.max(4, (d.count / docMax) * 100)}%` }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-white/55">
                      {formatNumber(d.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="mt-4 flex items-center gap-1.5 text-[10.5px] text-white/30">
            <Users className="h-3 w-3" /> {formatNumber(data?.total_leads ?? 0)} leads analisados no período
          </p>
        </>
      )}
    </div>
  );
}

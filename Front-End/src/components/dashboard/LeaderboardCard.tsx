import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { assignmentsService } from "@/services/assignments";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatNumber } from "@/lib/utils";

const LEADERBOARD_ICON =
  "https://cdn-icons-png.freepik.com/512/3976/3976403.png";

const RANK_COLORS = [
  "from-amber-400/20 to-amber-500/5 ring-amber-400/30 text-amber-200",
  "from-slate-300/15 to-slate-400/5 ring-slate-300/25 text-slate-200",
  "from-orange-500/15 to-orange-600/5 ring-orange-500/25 text-orange-200",
];

const RANK_EMOJI = ["🥇", "🥈", "🥉"];

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "—"
  );
}

export function LeaderboardCard() {
  const { tenantId, unitId } = useClinic();
  const clinicId = unitId ?? tenantId ?? undefined;

  const query = useQuery({
    queryKey: ["assignments-ranking", clinicId],
    queryFn: () => assignmentsService.ranking(clinicId ?? undefined),
    enabled: !!clinicId,
  });

  const ranking = useMemo(() => {
    const data = query.data ?? [];
    return [...data]
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
      .slice(0, 5);
  }, [query.data]);

  const max = ranking[0]?.total ?? 0;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-white/[0.02] to-white/[0.005]">
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-400/10 ring-1 ring-inset ring-amber-400/20 overflow-hidden">
          <img
            src={LEADERBOARD_ICON}
            alt="Leaderboard"
            className="h-6 w-6 object-contain"
          />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[13px] font-semibold text-slate-100">
            Leaderboard de atendentes
          </p>
          <p className="text-[10.5px] text-slate-500">
            Top 5 por leads atribuídos
          </p>
        </div>
      </div>

      <div className="px-3 py-3">
        {!clinicId ? (
          <div className="px-3 py-6 text-center text-[12px] text-slate-500">
            Selecione uma unidade pra ver o ranking.
          </div>
        ) : query.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md bg-white/[0.03]"
              />
            ))}
          </div>
        ) : query.isError ? (
          <div className="px-3 py-6 text-center text-[12px] text-rose-300/80">
            Não foi possível carregar o ranking.
          </div>
        ) : ranking.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-slate-500">
            Sem atendentes com leads atribuídos.
          </div>
        ) : (
          <ul className="space-y-1">
            {ranking.map((r, i) => {
              const pct = max > 0 ? ((r.total ?? 0) / max) * 100 : 0;
              const rankStyle =
                RANK_COLORS[i] ??
                "from-white/[0.03] to-transparent ring-white/[0.06] text-slate-300";
              const convPct = (r.conversionRate ?? 0) * 100;
              return (
                <li key={r.attendantId}>
                  <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.025]">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ring-1 ring-inset text-[14px] font-bold tabular-nums",
                        rankStyle,
                      )}
                    >
                      {RANK_EMOJI[i] ?? `#${i + 1}`}
                    </div>

                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/20 to-sky-500/15 text-[10px] font-bold text-slate-100 ring-1 ring-inset ring-white/[0.08]">
                      {initialsOf(r.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-slate-100">
                        {r.name}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[9.5px] tabular-nums text-emerald-300/80">
                          {convPct.toFixed(0)}% conv
                        </span>
                      </div>
                    </div>

                    <div className="text-right leading-tight">
                      <p className="text-[14px] font-semibold tabular-nums text-slate-100">
                        {formatNumber(r.total ?? 0)}
                      </p>
                      <p className="text-[9.5px] text-slate-500 uppercase tracking-wider">
                        leads
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

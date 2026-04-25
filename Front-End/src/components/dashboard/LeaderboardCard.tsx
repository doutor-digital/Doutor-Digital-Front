import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import type { ActiveLeadDto } from "@/types";

interface LeaderboardCardProps {
  leads?: ActiveLeadDto[];
  loading?: boolean;
}

const RANK_COLORS = [
  "from-amber-400/20 to-amber-500/5 ring-amber-400/30 text-amber-200",
  "from-slate-300/15 to-slate-400/5 ring-slate-300/25 text-slate-200",
  "from-orange-500/15 to-orange-600/5 ring-orange-500/25 text-orange-200",
];

const RANK_EMOJI = ["🥇", "🥈", "🥉"];

export function LeaderboardCard({ leads, loading }: LeaderboardCardProps) {
  const ranking = useMemo(() => {
    if (!leads || leads.length === 0) return [];
    const counts = new Map<string, { id: number; count: number }>();
    for (const l of leads) {
      if (!l.attendantId) continue;
      const key = String(l.attendantId);
      const cur = counts.get(key);
      if (cur) cur.count++;
      else counts.set(key, { id: l.attendantId, count: 1 });
    }
    return Array.from(counts.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [leads]);

  const max = ranking[0]?.count ?? 0;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-white/[0.02] to-white/[0.005]">
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-400/10 ring-1 ring-inset ring-amber-400/20">
          <Trophy className="h-4 w-4 text-amber-300" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[13px] font-semibold text-slate-100">
            Leaderboard de atendentes
          </p>
          <p className="text-[10.5px] text-slate-500">
            Top 5 por atendimentos ativos
          </p>
        </div>
      </div>

      <div className="px-3 py-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md bg-white/[0.03]"
              />
            ))}
          </div>
        ) : ranking.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-slate-500">
            Sem atendentes com leads ativos no momento.
          </div>
        ) : (
          <ul className="space-y-1">
            {ranking.map((r, i) => {
              const pct = max > 0 ? (r.count / max) * 100 : 0;
              const rankStyle = RANK_COLORS[i] ?? "from-white/[0.03] to-transparent ring-white/[0.06] text-slate-300";
              return (
                <li key={r.key}>
                  <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.025]">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ring-1 ring-inset text-[14px] font-bold tabular-nums",
                        rankStyle,
                      )}
                    >
                      {RANK_EMOJI[i] ?? `#${i + 1}`}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-slate-100">
                        Atendente #{r.id}
                      </p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right leading-tight">
                      <p className="text-[14px] font-semibold tabular-nums text-slate-100">
                        {formatNumber(r.count)}
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

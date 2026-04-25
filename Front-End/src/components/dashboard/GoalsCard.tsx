import { useEffect, useMemo, useState } from "react";
import { Check, Flame, Pencil, TrendingUp, X } from "lucide-react";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { Confetti } from "@/components/global/Confetti";
import { useStreak, useRecordStreakOnGoal } from "@/hooks/useStreak";
import { useEvaluateBadges } from "@/hooks/useBadges";

const GOALS_ICON =
  "https://cdn-icons-png.flaticon.com/512/12306/12306882.png";

interface Goals {
  monthlyLeads: number;
  conversionPct: number;
  monthlyRevenue?: number;
}

const STORAGE_KEY = "dashboard-goals-v1";
const DEFAULT_GOALS: Goals = {
  monthlyLeads: 200,
  conversionPct: 35,
};

function loadGoals(): Goals {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GOALS;
    const parsed = JSON.parse(raw);
    return {
      monthlyLeads: Number(parsed.monthlyLeads) || DEFAULT_GOALS.monthlyLeads,
      conversionPct: Number(parsed.conversionPct) || DEFAULT_GOALS.conversionPct,
      monthlyRevenue: parsed.monthlyRevenue,
    };
  } catch {
    return DEFAULT_GOALS;
  }
}

function saveGoals(g: Goals): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(g));
  } catch {
    /* ignore */
  }
}

interface GoalsCardProps {
  currentLeads: number;
  currentConversion: number;
  loading?: boolean;
}

export function GoalsCard({ currentLeads, currentConversion, loading }: GoalsCardProps) {
  const [goals, setGoals] = useState<Goals>(() => loadGoals());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Goals>(goals);
  const [confetti, setConfetti] = useState(false);

  const streak = useStreak();
  const goalReached =
    !loading && currentLeads >= goals.monthlyLeads && goals.monthlyLeads > 0;

  // Registra streak quando bate a meta
  useRecordStreakOnGoal(goalReached);

  // Avalia badges
  useEvaluateBadges({
    totalLeads: currentLeads,
    conversionPct: currentConversion,
    streakDays: streak.current,
  });

  // Dispara confetti quando atinge 100% (uma vez por sessão por nível)
  useEffect(() => {
    if (goalReached) {
      const key = `dashboard-goal-celebrated-${new Date().toISOString().slice(0, 10)}`;
      try {
        if (!sessionStorage.getItem(key)) {
          setConfetti(true);
          sessionStorage.setItem(key, "1");
          const t = setTimeout(() => setConfetti(false), 2600);
          return () => clearTimeout(t);
        }
      } catch {
        /* ignore */
      }
    }
  }, [goalReached]);

  useEffect(() => {
    if (editing) setDraft(goals);
  }, [editing, goals]);

  // Projeção: assumindo ritmo atual no que falta do mês
  const projection = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const ratio = day / daysInMonth;
    if (ratio <= 0) return { leads: 0, daysLeft: daysInMonth };
    const projected = Math.round(currentLeads / ratio);
    return { leads: projected, daysLeft: daysInMonth - day };
  }, [currentLeads]);

  const leadsPct = goals.monthlyLeads > 0 ? Math.min(100, (currentLeads / goals.monthlyLeads) * 100) : 0;
  const convPct = goals.conversionPct > 0 ? Math.min(100, (currentConversion / goals.conversionPct) * 100) : 0;
  const projPct = goals.monthlyLeads > 0 ? Math.min(100, (projection.leads / goals.monthlyLeads) * 100) : 0;

  const projectionVerdict =
    projection.leads >= goals.monthlyLeads
      ? { tone: "good" as const, label: "no caminho" }
      : projection.leads >= goals.monthlyLeads * 0.85
        ? { tone: "warn" as const, label: "atenção" }
        : { tone: "bad" as const, label: "abaixo do alvo" };

  const verdictStyles = {
    good: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/25",
    warn: "bg-amber-400/15 text-amber-200 ring-amber-400/25",
    bad: "bg-rose-400/15 text-rose-200 ring-rose-400/25",
  };

  const handleSave = () => {
    const cleaned: Goals = {
      monthlyLeads: Math.max(1, Math.floor(draft.monthlyLeads || 0)),
      conversionPct: Math.max(0, Math.min(100, Number(draft.conversionPct) || 0)),
      monthlyRevenue: draft.monthlyRevenue,
    };
    setGoals(cleaned);
    saveGoals(cleaned);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-white/[0.07] bg-gradient-to-br from-white/[0.02] to-white/[0.005]">
      <Confetti trigger={confetti} />

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-violet-400/10 ring-1 ring-inset ring-violet-400/20">
          <img
            src={GOALS_ICON}
            alt="Metas"
            className="h-6 w-6 object-contain"
          />
        </div>

        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[13px] font-semibold text-slate-100">Metas do mês</p>
          <p className="text-[10.5px] text-slate-500">
            faltam {projection.daysLeft} dia{projection.daysLeft === 1 ? "" : "s"} ·
            projeção: {formatNumber(projection.leads)} leads
          </p>
        </div>

        {streak.current > 0 && (
          <div
            className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/25"
            title={`Melhor: ${streak.best} dias`}
          >
            <Flame className="h-3 w-3" />
            {streak.current}d
          </div>
        )}

        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/[0.05]"
          >
            <Pencil className="h-3 w-3" />
            Editar
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-200"
              aria-label="Cancelar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              <Check className="mr-0.5 inline h-3 w-3" />
              Salvar
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="space-y-4 px-5 py-4">
        {/* Editor inline */}
        {editing && (
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Meta de leads
              </label>
              <input
                type="number"
                min={1}
                value={draft.monthlyLeads}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, monthlyLeads: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[13px] text-slate-100 outline-none focus:border-emerald-400/40"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Meta de conversão (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={draft.conversionPct}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, conversionPct: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[13px] text-slate-100 outline-none focus:border-emerald-400/40"
              />
            </div>
          </div>
        )}

        {/* Meta de leads */}
        <ProgressRow
          label="Leads"
          current={currentLeads}
          target={goals.monthlyLeads}
          pct={leadsPct}
          loading={loading}
          unit=""
          tone="emerald"
        />

        {/* Meta de conversão */}
        <ProgressRow
          label="Conversão"
          current={currentConversion}
          target={goals.conversionPct}
          pct={convPct}
          loading={loading}
          unit="%"
          tone="sky"
          formatter={(n) => formatPercent(n)}
        />

        {/* Projeção */}
        <div className="rounded-lg border border-white/[0.05] bg-black/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-[11.5px] font-medium text-slate-200">
                Projeção do mês
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                verdictStyles[projectionVerdict.tone],
              )}
            >
              {projectionVerdict.label}
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-1">
            <p className="text-[18px] font-semibold tabular-nums text-slate-100">
              {formatNumber(projection.leads)}
            </p>
            <p className="text-[11px] text-slate-500">
              leads previstos · meta {formatNumber(goals.monthlyLeads)}
            </p>
          </div>

          {/* Mini barra com marcador de meta */}
          <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className={cn(
                "h-full transition-all duration-500",
                projection.leads >= goals.monthlyLeads
                  ? "bg-emerald-400"
                  : projection.leads >= goals.monthlyLeads * 0.85
                    ? "bg-amber-400"
                    : "bg-rose-400",
              )}
              style={{ width: `${projPct}%` }}
            />
            <span
              aria-hidden
              className="absolute top-0 h-full w-px bg-white/40"
              style={{ left: "100%" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  current,
  target,
  pct,
  loading,
  unit,
  tone,
  formatter,
}: {
  label: string;
  current: number;
  target: number;
  pct: number;
  loading?: boolean;
  unit: string;
  tone: "emerald" | "sky";
  formatter?: (n: number) => string;
}) {
  const fmt = formatter ?? ((n: number) => formatNumber(n));
  const barColor =
    pct >= 100
      ? "bg-emerald-400"
      : pct >= 70
        ? tone === "emerald"
          ? "bg-emerald-400"
          : "bg-sky-400"
        : pct >= 40
          ? "bg-amber-400"
          : "bg-rose-400";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="text-[11px] tabular-nums text-slate-400">
          <span className="text-slate-100 font-semibold">
            {loading ? "…" : fmt(current)}
          </span>
          <span className="mx-1 text-slate-600">/</span>
          {fmt(target)}
          {unit}
        </p>
      </div>

      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={cn("h-full transition-all duration-500", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-1 text-[10.5px] tabular-nums text-slate-500">
        {pct.toFixed(1)}% concluído
      </p>
    </div>
  );
}

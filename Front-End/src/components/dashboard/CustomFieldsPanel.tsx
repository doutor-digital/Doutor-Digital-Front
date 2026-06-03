import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Loader2, Users } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { KpiDrillDown, type KpiDrillTarget } from "@/components/kpi/KpiDrillDown";
import { kpiConfigService, type CustomFieldSummary } from "@/services/kpiConfig";
import { unitsService } from "@/services/units";
import { cn, formatNumber } from "@/lib/utils";

const VALUE_COLORS = ["#34d399", "#60a5fa", "#a78bfa", "#fbbf24", "#22d3ee", "#f87171", "#f472b6", "#94a3b8"];

type PeriodKey = "dia" | "semana" | "mes" | "ano";
const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
];

function rangeFor(key: PeriodKey): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (key === "semana") from.setDate(from.getDate() - 6);
  else if (key === "mes") from.setDate(1);
  else if (key === "ano") from.setMonth(0, 1);
  // "dia" → from = hoje
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/**
 * Painel "Campos da Kommo": pra cada campo customizado, preenchimento + distribuição de
 * valores, com drill-down. Cruza com o schema da unidade pra mostrar TODOS os campos
 * (mesmo vazios). Autocontido. `withPeriodPicker` liga o seletor Dia/Semana/Mês/Ano.
 */
export function CustomFieldsPanel({
  unitId,
  dateFrom,
  dateTo,
  rangeLabel,
  withPeriodPicker = false,
}: {
  unitId: number | null;
  dateFrom?: string;
  dateTo?: string;
  rangeLabel?: string;
  withPeriodPicker?: boolean;
}) {
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const eff = withPeriodPicker ? rangeFor(period) : { from: (dateFrom ?? "").slice(0, 10), to: (dateTo ?? "").slice(0, 10) };
  const from = eff.from;
  const to = eff.to;

  const [drill, setDrill] = useState<KpiDrillTarget | null>(null);

  const summary = useQuery({
    queryKey: ["custom-fields-summary", "dash", unitId, from, to],
    queryFn: () => kpiConfigService.customFieldsSummary(unitId, { date_from: from, date_to: to }),
  });

  // Schema da unidade (todos os campos definidos na Kommo) — pra mostrar os vazios também.
  const schema = useQuery({
    queryKey: ["kommo-custom-fields-schema", unitId],
    queryFn: () => unitsService.kommoCustomFields(unitId!),
    enabled: unitId != null,
    retry: false,
    staleTime: 10 * 60_000,
  });

  const total = summary.data?.total_leads ?? 0;

  // Preenchidos primeiro (ordem do backend, por preenchimento), depois os vazios do schema.
  const fields = useMemo<CustomFieldSummary[]>(() => {
    const filled = summary.data?.fields ?? [];
    const seen = new Set(filled.map((f) => f.field_id));
    const empties: CustomFieldSummary[] = (schema.data ?? [])
      .filter((s) => !seen.has(s.id))
      .map((s) => ({
        field_id: s.id,
        field_name: s.name,
        field_code: s.code ?? null,
        type: s.type,
        filled: 0,
        distinct_values: 0,
        top_values: [],
      }));
    return [...filled, ...empties];
  }, [summary.data, schema.data]);

  return (
    <div
      className="mt-4 rounded-2xl bg-[#0f1f3a]/80 p-5 ring-1 ring-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      style={{ borderTop: "4px solid #22d3ee" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
            Campos da Kommo · Perfil do lead
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/40">
            <Users className="h-3 w-3" /> {formatNumber(total)} leads
            {!withPeriodPicker && rangeLabel ? ` · ${rangeLabel}` : ""}
          </p>
        </div>
        {withPeriodPicker && (
          <div className="inline-flex items-center rounded-lg border border-white/[0.06] bg-white/[0.03] p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "rounded-md px-3 py-1 text-[11px] font-medium transition",
                  period === p.key ? "bg-white/[0.1] text-slate-50" : "text-slate-400 hover:text-slate-200",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {summary.isLoading ? (
        <div className="grid h-32 place-items-center text-white/40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : fields.length === 0 ? (
        <p className="mt-4 text-[12px] text-white/40">
          {total === 0
            ? "Nenhum lead com campos da Kommo no período. Rode o sync da unidade."
            : "Nenhum campo customizado no período."}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <FieldCard
              key={f.field_id}
              field={f}
              totalLeads={total}
              onDrillValue={(value) =>
                setDrill({
                  kpiKey: `field_${f.field_id}`,
                  label: `${f.field_name}: ${value}`,
                  source: {
                    source_type: "custom_field_count",
                    config: { fieldId: f.field_id, fieldCode: f.field_code, matchValues: [value] },
                  },
                })
              }
            />
          ))}
        </div>
      )}

      <KpiDrillDown target={drill} unitId={unitId} dateFrom={from} dateTo={to} onClose={() => setDrill(null)} />
    </div>
  );
}

function FieldCard({
  field,
  totalLeads,
  onDrillValue,
}: {
  field: CustomFieldSummary;
  totalLeads: number;
  onDrillValue: (value: string) => void;
}) {
  const fillPct = totalLeads > 0 ? Math.round((field.filled / totalLeads) * 100) : 0;
  const maxCount = field.top_values[0]?.count ?? 1;
  const empty = field.filled === 0;

  return (
    <div className={cn("rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5", empty && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-semibold text-slate-100">{field.field_name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
            <Layers className="h-3 w-3" /> {field.distinct_values} valores
          </p>
        </div>
        <Badge tone="slate">{field.type}</Badge>
      </div>

      <div className="mt-2.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>preenchido</span>
          <span className="tabular-nums">{formatNumber(field.filled)} ({fillPct}%)</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
          <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${Math.max(2, fillPct)}%` }} />
        </div>
      </div>

      {empty ? (
        <p className="mt-2.5 text-[10.5px] text-slate-600">sem preenchimento no período</p>
      ) : (
        <ul className="mt-2.5 space-y-1.5">
          {field.top_values.map((v, i) => {
            const pct = Math.round((v.count / maxCount) * 100);
            const color = VALUE_COLORS[i % VALUE_COLORS.length];
            return (
              <li key={v.value}>
                <button
                  type="button"
                  onClick={() => onDrillValue(v.value)}
                  className="group w-full text-left"
                  title="Ver os leads com esse valor"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-slate-300 group-hover:text-slate-100">{v.value}</span>
                    <span className="shrink-0 tabular-nums text-slate-500 group-hover:text-slate-300">
                      {formatNumber(v.count)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.03]">
                    <div
                      className="h-full rounded-full transition-all group-hover:opacity-90"
                      style={{ width: `${Math.max(3, pct)}%`, background: color }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

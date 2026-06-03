import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Filter, Layers, Loader2, Users } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { KpiDrillDown, type KpiDrillTarget } from "@/components/kpi/KpiDrillDown";
import { useClinic } from "@/hooks/useClinic";
import { kpiConfigService, type CustomFieldSummary } from "@/services/kpiConfig";
import { cn, formatNumber } from "@/lib/utils";

const RANGES: Array<{ key: string; label: string; days: number }> = [
  { key: "7", label: "7 dias", days: 7 },
  { key: "30", label: "30 dias", days: 30 },
  { key: "90", label: "90 dias", days: 90 },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const VALUE_COLORS = ["#34d399", "#60a5fa", "#a78bfa", "#fbbf24", "#22d3ee", "#f87171", "#f472b6", "#94a3b8"];

export default function CustomFieldsPage() {
  const { unitId } = useClinic();
  const [rangeKey, setRangeKey] = useState("30");
  const [search, setSearch] = useState("");
  const [drill, setDrill] = useState<KpiDrillTarget | null>(null);

  const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 30;
  const dateFrom = useMemo(() => isoDaysAgo(days), [days]);
  const dateTo = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const summary = useQuery({
    queryKey: ["custom-fields-summary", unitId, dateFrom, dateTo],
    queryFn: () =>
      kpiConfigService.customFieldsSummary(unitId, { date_from: dateFrom, date_to: dateTo }),
  });

  const total = summary.data?.total_leads ?? 0;
  const fields = useMemo(() => {
    const list = summary.data?.fields ?? [];
    const q = search.trim().toLowerCase();
    return q ? list.filter((f) => f.field_name.toLowerCase().includes(q)) : list;
  }, [summary.data, search]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Campos Customizados · Perfil do Lead"
        description="Métricas de todos os campos da Kommo: preenchimento e distribuição dos valores. Clique num valor para ver os leads."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRangeKey(r.key)}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium transition",
                rangeKey === r.key
                  ? "bg-emerald-400/[0.12] text-emerald-200 ring-1 ring-inset ring-emerald-400/25"
                  : "bg-white/[0.03] text-slate-400 ring-1 ring-inset ring-white/[0.06] hover:text-slate-200",
              )}
            >
              {r.label}
            </button>
          ))}
          <span className="ml-2 flex items-center gap-1.5 text-[12px] text-slate-400">
            <Users className="h-3.5 w-3.5" /> {formatNumber(total)} leads no período
          </span>
        </div>
        <div className="relative">
          <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="filtrar campo…"
            className="w-48 rounded-md border border-white/[0.08] bg-white/[0.02] py-1.5 pl-8 pr-3 text-[12.5px] text-slate-100 outline-none focus:border-white/[0.18]"
          />
        </div>
      </div>

      {summary.isLoading ? (
        <div className="grid h-48 place-items-center text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : fields.length === 0 ? (
        <Card>
          <CardBody className="flex items-center gap-3 py-8 text-[13px] text-slate-300">
            <FileText className="h-5 w-5 text-slate-500" />
            {total === 0
              ? "Nenhum lead com campos customizados sincronizados neste período. Rode o sync da unidade na Kommo."
              : "Nenhum campo encontrado para o filtro."}
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
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

      {summary.data?.truncated && (
        <p className="text-center text-[11px] text-amber-300/80">
          Amostra grande — análise considerou os leads mais recentes do período.
        </p>
      )}

      <KpiDrillDown
        target={drill}
        unitId={unitId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onClose={() => setDrill(null)}
      />
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

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-100">{field.field_name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-slate-500">
              <Layers className="h-3 w-3" /> {field.distinct_values} valores distintos
            </p>
          </div>
          <Badge tone="slate">{field.type}</Badge>
        </div>

        {/* preenchimento */}
        <div>
          <div className="flex items-center justify-between text-[10.5px] text-slate-400">
            <span>preenchido</span>
            <span className="tabular-nums">
              {formatNumber(field.filled)} ({fillPct}%)
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
            <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${Math.max(2, fillPct)}%` }} />
          </div>
        </div>

        {/* distribuição dos valores */}
        <ul className="space-y-1.5 pt-1">
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
                  <div className="flex items-center justify-between gap-2 text-[11.5px]">
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
      </CardBody>
    </Card>
  );
}

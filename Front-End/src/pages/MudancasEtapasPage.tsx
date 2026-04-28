import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, ArrowRight, GitBranch, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StageBadge } from "@/components/ui/Badge";
import { webhooksService } from "@/services/webhooks";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatDate, formatNumber } from "@/lib/utils";

const RANGES: { value: string; label: string; days: number }[] = [
  { value: "7", label: "7 dias", days: 7 },
  { value: "14", label: "14 dias", days: 14 },
  { value: "30", label: "30 dias", days: 30 },
  { value: "60", label: "60 dias", days: 60 },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MudancasEtapasPage() {
  const { tenantId, unitId } = useClinic();
  const clinicId = tenantId ?? undefined;

  const [range, setRange] = useState("30");
  const days = Number(range);

  const dateFrom = isoDaysAgo(days);
  const dateTo = todayIso();

  const query = useQuery({
    queryKey: ["stage-changes", clinicId, unitId, dateFrom, dateTo],
    queryFn: () =>
      webhooksService.stageChanges({
        clinicId,
        unitId: unitId ?? undefined,
        dateFrom,
        dateTo,
        limit: 200,
      }),
    enabled: !!clinicId,
    placeholderData: (prev) => prev,
  });

  const data = query.data;

  const dailySeries = useMemo(
    () =>
      (data?.daily ?? []).map((p) => ({
        day: p.date.slice(5, 10),
        count: p.count,
      })),
    [data?.daily],
  );

  const destinationSeries = useMemo(
    () =>
      (data?.byDestination ?? []).map((p) => ({
        stage: p.stage.replace(/_/g, " ").slice(0, 22),
        full: p.stage,
        count: p.count,
      })),
    [data?.byDestination],
  );

  return (
    <>
      <PageHeader
        title="Mudanças de etapa"
        description="Feed de transições no funil. Use os gráficos pra ver o ritmo, as etapas mais alvo e clique em qualquer linha pra abrir a jornada completa do lead."
        actions={
          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", query.isFetching && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRange(r.value)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-[12px] transition",
              range === r.value
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]",
            )}
          >
            {r.label}
          </button>
        ))}
        <span className="ml-2 text-[11px] text-slate-500">
          {formatNumber(data?.total ?? 0)} mudanças no período
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
              Volume por dia
            </h3>
            <div className="mt-3 h-48">
              {dailySeries.length === 0 ? (
                <div className="grid h-full place-items-center text-[11.5px] text-slate-500">
                  Sem dados no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySeries}>
                    <defs>
                      <linearGradient id="gradStage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} stroke="transparent" />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="transparent" />
                    <Tooltip
                      contentStyle={{
                        background: "#0d0d12",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#34d399"
                      fill="url(#gradStage)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
              Top etapas de destino
            </h3>
            <div className="mt-3 h-48">
              {destinationSeries.length === 0 ? (
                <div className="grid h-full place-items-center text-[11.5px] text-slate-500">
                  Sem dados no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={destinationSeries.slice(0, 8)} layout="vertical">
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} stroke="transparent" />
                    <YAxis
                      type="category"
                      dataKey="stage"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      stroke="transparent"
                      width={140}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0d0d12",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                      formatter={(v: number, _n, p: { payload?: { full?: string } }) => [v, p?.payload?.full ?? ""]}
                    />
                    <Bar dataKey="count" fill="#38bdf8" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardBody>
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
            <GitBranch className="h-3.5 w-3.5" />
            Últimas mudanças ({(data?.items ?? []).length})
          </div>

          {query.isLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-white/[0.02]" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              title="Sem mudanças de etapa"
              description="Nenhuma transição registrada no período selecionado."
            />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {data.items.map((it) => (
                <li key={it.id} className="px-1 py-3 transition hover:bg-white/[0.02]">
                  <Link
                    to={`/leads/${it.leadId}/journey`}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-slate-100">
                          {it.leadName || `Lead #${it.leadId}`}
                        </span>
                        {it.unitName && (
                          <span className="text-[10.5px] text-slate-500">· {it.unitName}</span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                        {it.fromStage ? (
                          <StageBadge stage={it.fromStage} />
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                        <ArrowRight className="h-3 w-3 text-slate-500" />
                        <StageBadge stage={it.toStage} />
                      </div>
                    </div>
                    <div className="text-right text-[10.5px] tabular-nums text-slate-500">
                      <div>{formatDate(it.changedAt)}</div>
                      {it.source && <div className="opacity-70">{it.source}</div>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}

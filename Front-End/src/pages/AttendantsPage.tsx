import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { assignmentsService } from "@/services/assignments";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { AttendantRanking } from "@/types";

const MODE_BASIC = "basic";
const MODE_ADVANCED = "advanced";

const AXIS_COLOR = "#64748b";
const GRID_COLOR = "rgba(148,163,184,.08)";

export default function AttendantsPage() {
  const { tenantId } = useClinic();
  const [mode, setMode] = useState<string>(MODE_BASIC);

  const atts = useQuery({
    queryKey: ["attendants"],
    queryFn: () => assignmentsService.listAttendants(),
  });

  const rank = useQuery({
    queryKey: ["attendants-ranking", tenantId],
    queryFn: () => assignmentsService.ranking(tenantId || undefined),
  });

  const ranking = rank.data ?? [];
  const totals = useMemo(() => aggregate(ranking), [ranking]);

  return (
    <>
      <PageHeader
        title="Atendentes"
        description="Ranking por conversão e produtividade da equipe."
      />

      <div className="mb-6">
        <Tabs
          value={mode}
          onChange={setMode}
          tabs={[
            { value: MODE_BASIC, label: "Ranking" },
            { value: MODE_ADVANCED, label: "Análise detalhada" },
          ]}
        />
      </div>

      {mode === MODE_BASIC ? (
        <BasicMode
          ranking={ranking}
          loading={rank.isLoading}
          attendants={atts.data ?? []}
          attendantsLoading={atts.isLoading}
          totals={totals}
        />
      ) : (
        <AdvancedMode
          ranking={ranking}
          loading={rank.isLoading}
          totals={totals}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  BÁSICO — ranking claro e lista completa da equipe
 * ═══════════════════════════════════════════════════════════════ */

function BasicMode({
  ranking,
  loading,
  attendants,
  attendantsLoading,
  totals,
}: {
  ranking: AttendantRanking[];
  loading: boolean;
  attendants: Array<{ id: number; name: string; email?: string | null; totalAssignments?: number }>;
  attendantsLoading: boolean;
  totals: ReturnType<typeof aggregate>;
}) {
  const top = ranking.slice(0, 10);
  const maxTotal = Math.max(1, ...top.map((r) => r.total));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Atendentes ativos"
          value={formatNumber(ranking.length)}
          hint="com atribuições"
        />
        <Kpi
          label="Leads atribuídos"
          value={formatNumber(totals.total)}
          hint="soma geral"
        />
        <Kpi
          label="Conversões"
          value={formatNumber(totals.conversions)}
          hint={formatPercent(totals.conversionRate) + " do total"}
        />
        <Kpi
          label="Pagos"
          value={formatNumber(totals.pago)}
          hint={formatPercent(totals.pagoRate) + " pagam"}
        />
      </div>

      <Card>
        <CardHeader
          title="Top 10 por conversão"
          subtitle="Ordenado por número de leads convertidos"
        />
        <CardBody className="p-0">
          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-10 w-full rounded" />
              ))}
            </div>
          ) : top.length === 0 ? (
            <EmptyState title="Sem atribuições para exibir" />
          ) : (
            <ul className="divide-y divide-slate-800/60">
              {top.map((r, i) => (
                <RankRow
                  key={r.attendantId}
                  position={i + 1}
                  item={r}
                  maxTotal={maxTotal}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Equipe cadastrada"
          subtitle={`${attendants.length} atendente${attendants.length === 1 ? "" : "s"}`}
        />
        <CardBody className="p-0">
          {attendantsLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-8 w-full rounded" />
              ))}
            </div>
          ) : attendants.length === 0 ? (
            <EmptyState title="Nenhum atendente cadastrado" />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Nome</Th>
                  <Th>Email</Th>
                  <Th className="text-right">Atribuições</Th>
                </Tr>
              </THead>
              <TBody>
                {attendants.map((a) => (
                  <Tr key={a.id}>
                    <Td className="font-medium">{a.name}</Td>
                    <Td className="text-slate-400">{a.email ?? "—"}</Td>
                    <Td className="text-right tabular-nums">
                      {formatNumber(a.totalAssignments ?? 0)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  AVANÇADO — distribuição, taxas, scatter, tabela completa
 * ═══════════════════════════════════════════════════════════════ */

function AdvancedMode({
  ranking,
  loading,
  totals,
}: {
  ranking: AttendantRanking[];
  loading: boolean;
  totals: ReturnType<typeof aggregate>;
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-80 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="skeleton h-64 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (ranking.length === 0) {
    return <EmptyState title="Sem dados de atendentes no período" />;
  }

  const top = ranking.slice(0, 10);

  const stacked = top.map((r) => ({
    name: shortName(r.name),
    pago: r.pago,
    agendado: Math.max(0, r.agendado - r.pago),
    outros: Math.max(0, r.total - r.agendado),
  }));

  const ratesByAttendant = top
    .filter((r) => r.total >= 3)
    .map((r) => ({
      name: shortName(r.name),
      rate: r.conversionRate,
      total: r.total,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);

  const bestConverter = [...ranking]
    .filter((r) => r.total >= 3)
    .sort((a, b) => b.conversionRate - a.conversionRate)[0];

  const busiest = [...ranking].sort((a, b) => b.active - a.active)[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Atendentes"
          value={formatNumber(ranking.length)}
          hint="com atribuições"
        />
        <Kpi
          label="Total atribuído"
          value={formatNumber(totals.total)}
          hint="soma geral"
        />
        <Kpi
          label="Conversão média"
          value={formatPercent(totals.conversionRate)}
          hint="pagos ou em tratamento"
        />
        <Kpi
          label="Por atendente"
          value={formatNumber(Math.round(totals.total / Math.max(1, ranking.length)))}
          hint="leads / pessoa"
        />
        <Kpi
          label="Melhor taxa"
          value={bestConverter ? formatPercent(bestConverter.conversionRate) : "—"}
          hint={bestConverter ? shortName(bestConverter.name) : "—"}
        />
        <Kpi
          label="Mais ativos"
          value={busiest ? formatNumber(busiest.active) : "—"}
          hint={busiest ? shortName(busiest.name) : "—"}
        />
      </div>

      <Card>
        <CardHeader
          title="Composição dos atendimentos"
          subtitle="Top 10 — pago, apenas agendado e demais etapas"
        />
        <CardBody>
          <div className="h-80 w-full">
            <ResponsiveContainer>
              <BarChart
                data={stacked}
                margin={{ top: 12, right: 16, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(99,102,241,.05)" }} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="pago" name="Pago" stackId="a" fill="#10b981" />
                <Bar dataKey="agendado" name="Agendado" stackId="a" fill="#f59e0b" />
                <Bar dataKey="outros" name="Outros" stackId="a" fill="#475569" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Taxa de conversão"
            subtitle="Apenas atendentes com 3+ leads"
          />
          <CardBody>
            {ratesByAttendant.length === 0 ? (
              <EmptyState title="Dados insuficientes" />
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer>
                  <BarChart
                    data={ratesByAttendant}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ fill: "rgba(99,102,241,.05)" }} />
                    <Bar dataKey="rate" name="Taxa" radius={[0, 4, 4, 0]}>
                      {ratesByAttendant.map((r, i) => (
                        <Cell
                          key={i}
                          fill={r.rate >= totals.conversionRate ? "#10b981" : "#64748b"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Volume × conversão"
            subtitle="Quem combina volume com boa taxa"
          />
          <CardBody>
            <div className="h-80 w-full">
              <Scatter data={ranking.slice(0, 20)} avgRate={totals.conversionRate} />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Tabela completa"
          subtitle={`${ranking.length} atendente${ranking.length === 1 ? "" : "s"}`}
        />
        <CardBody className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th>#</Th>
                <Th>Atendente</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Agendado</Th>
                <Th className="text-right">Pago</Th>
                <Th className="text-right">Tratamento</Th>
                <Th className="text-right">Ativos</Th>
                <Th className="text-right">Conversão</Th>
              </Tr>
            </THead>
            <TBody>
              {ranking.map((r, i) => (
                <Tr key={r.attendantId}>
                  <Td className="text-slate-500 tabular-nums">{i + 1}</Td>
                  <Td className="font-medium">
                    {r.name}
                    {r.email && (
                      <div className="text-[11px] text-slate-500">{r.email}</div>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{formatNumber(r.total)}</Td>
                  <Td className="text-right tabular-nums text-amber-300">
                    {formatNumber(r.agendado)}
                  </Td>
                  <Td className="text-right tabular-nums text-emerald-300">
                    {formatNumber(r.pago)}
                  </Td>
                  <Td className="text-right tabular-nums">{formatNumber(r.tratamento)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(r.active)}</Td>
                  <Td className="text-right tabular-nums">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[11px] font-medium",
                        r.conversionRate >= totals.conversionRate
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-slate-700/30 text-slate-400"
                      )}
                    >
                      {formatPercent(r.conversionRate)}
                    </span>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  COMPONENTES AUXILIARES
 * ═══════════════════════════════════════════════════════════════ */

function RankRow({
  position,
  item,
  maxTotal,
}: {
  position: number;
  item: AttendantRanking;
  maxTotal: number;
}) {
  const barTotal = (item.total / maxTotal) * 100;
  const segPago = item.total > 0 ? (item.pago / item.total) * barTotal : 0;
  const segAgendado = item.total > 0 ? ((item.agendado - item.pago) / item.total) * barTotal : 0;
  const segOutros = Math.max(0, barTotal - segPago - segAgendado);

  return (
    <li className="px-5 py-4 transition-colors hover:bg-slate-800/20">
      <div className="flex items-center gap-4">
        <div className="w-8 shrink-0 text-center">
          <span
            className={cn(
              "text-[13px] font-semibold tabular-nums",
              position === 1
                ? "text-amber-300"
                : position === 2
                  ? "text-slate-300"
                  : position === 3
                    ? "text-orange-400"
                    : "text-slate-500"
            )}
          >
            #{position}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[13px] font-medium text-slate-100">
              {item.name}
            </p>
            <span className="shrink-0 text-[12px] tabular-nums text-slate-400">
              <span className="font-semibold text-slate-100">{formatNumber(item.total)}</span>{" "}
              leads
            </span>
          </div>

          <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-emerald-500" style={{ width: `${segPago}%` }} />
            <div className="h-full bg-amber-500" style={{ width: `${segAgendado}%` }} />
            <div className="h-full bg-slate-600" style={{ width: `${segOutros}%` }} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span>
              <span className="text-emerald-300 tabular-nums">{formatNumber(item.pago)}</span> pago
            </span>
            <span>
              <span className="text-amber-300 tabular-nums">{formatNumber(item.agendado)}</span> agendado
            </span>
            <span>
              <span className="text-slate-300 tabular-nums">{formatPercent(item.conversionRate)}</span> conversão
            </span>
            {item.active > 0 && (
              <span>
                <span className="text-sky-300 tabular-nums">{item.active}</span> ativo agora
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 px-5 py-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-[1.65rem] font-semibold leading-none tabular-nums text-slate-50">
        {value ?? <span className="skeleton inline-block h-7 w-20 rounded" />}
      </div>
      {hint && <div className="mt-1.5 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

function ChartTooltip({ active, payload, label, suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1.5 font-medium text-slate-200">{label}</p>
      <div className="space-y-0.5">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-slate-400">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span>{p.name}</span>
            <span className="ml-auto font-medium tabular-nums text-slate-100">
              {typeof p.value === "number"
                ? suffix === "%"
                  ? `${p.value.toFixed(1)}%`
                  : formatNumber(p.value)
                : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Scatter simples feito em SVG — eixo X = total, Y = taxa de conversão. */
function Scatter({
  data,
  avgRate,
}: {
  data: AttendantRanking[];
  avgRate: number;
}) {
  if (data.length === 0) return <EmptyState title="Sem dados" />;

  const W = 600;
  const H = 280;
  const padding = { top: 16, right: 16, bottom: 32, left: 40 };
  const maxX = Math.max(1, ...data.map((d) => d.total));
  const maxY = 100;

  const x = (v: number) => padding.left + (v / maxX) * (W - padding.left - padding.right);
  const y = (v: number) => H - padding.bottom - (v / maxY) * (H - padding.top - padding.bottom);
  const avgY = y(avgRate);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line
            x1={padding.left}
            y1={y(v)}
            x2={W - padding.right}
            y2={y(v)}
            stroke={GRID_COLOR}
            strokeDasharray="3 3"
          />
          <text x={padding.left - 6} y={y(v) + 3} textAnchor="end" fill={AXIS_COLOR} fontSize="10">
            {v}%
          </text>
        </g>
      ))}

      <line
        x1={padding.left}
        y1={avgY}
        x2={W - padding.right}
        y2={avgY}
        stroke="#6366f1"
        strokeDasharray="4 4"
        strokeWidth={1}
      />
      <text x={W - padding.right} y={avgY - 4} textAnchor="end" fill="#818cf8" fontSize="10">
        média {formatPercent(avgRate)}
      </text>

      {data.map((d) => {
        const cx = x(d.total);
        const cy = y(d.conversionRate);
        const above = d.conversionRate >= avgRate;
        return (
          <g key={d.attendantId}>
            <circle
              cx={cx}
              cy={cy}
              r={Math.min(12, 4 + Math.sqrt(d.total))}
              fill={above ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.13)"}
              stroke={above ? "#10b981" : "#f43f5e"}
              strokeWidth={1.5}
            />
            <title>{`${d.name} · ${d.total} leads · ${formatPercent(d.conversionRate)}`}</title>
          </g>
        );
      })}

      <text x={W / 2} y={H - 6} textAnchor="middle" fill={AXIS_COLOR} fontSize="10">
        Total de leads →
      </text>
      <text
        transform={`translate(12 ${H / 2}) rotate(-90)`}
        textAnchor="middle"
        fill={AXIS_COLOR}
        fontSize="10"
      >
        Taxa de conversão ↑
      </text>

      <text x={padding.left} y={H - padding.bottom + 14} fill={AXIS_COLOR} fontSize="10">
        0
      </text>
      <text
        x={W - padding.right}
        y={H - padding.bottom + 14}
        textAnchor="end"
        fill={AXIS_COLOR}
        fontSize="10"
      >
        {formatNumber(maxX)}
      </text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  HELPERS
 * ═══════════════════════════════════════════════════════════════ */

function aggregate(ranking: AttendantRanking[]) {
  const total = ranking.reduce((a, r) => a + r.total, 0);
  const agendado = ranking.reduce((a, r) => a + r.agendado, 0);
  const pago = ranking.reduce((a, r) => a + r.pago, 0);
  const tratamento = ranking.reduce((a, r) => a + r.tratamento, 0);
  const conversions = ranking.reduce((a, r) => a + r.conversions, 0);
  return {
    total,
    agendado,
    pago,
    tratamento,
    conversions,
    agendadoRate: total === 0 ? 0 : (agendado / total) * 100,
    pagoRate: total === 0 ? 0 : (pago / total) * 100,
    conversionRate: total === 0 ? 0 : (conversions / total) * 100,
  };
}

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

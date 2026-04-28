import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Hourglass,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StageBadge } from "@/components/ui/Badge";
import { webhooksService } from "@/services/webhooks";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatDate, formatNumber, formatPercent } from "@/lib/utils";
import type { ConversionAnalytics } from "@/types";

const RANGES: { value: string; label: string; days: number }[] = [
  { value: "7", label: "7 dias", days: 7 },
  { value: "30", label: "30 dias", days: 30 },
  { value: "60", label: "60 dias", days: 60 },
  { value: "90", label: "90 dias", days: 90 },
];

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const REASON_COLORS: Record<string, string> = {
  preco: "#fb7185",
  vai_pensar: "#fbbf24",
  convenio: "#a78bfa",
  familia: "#60a5fa",
  tempo_distancia: "#22d3ee",
  medo: "#f472b6",
  concorrente: "#f87171",
  nao_atendeu: "#94a3b8",
  desistiu: "#475569",
  sem_motivo: "#1e293b",
};

export default function ConversaoPage() {
  const { tenantId, unitId } = useClinic();
  const clinicId = tenantId ?? undefined;

  const [range, setRange] = useState("30");
  const days = Number(range);
  const dateFrom = isoDaysAgo(days);
  const dateTo = todayIso();

  const query = useQuery({
    queryKey: ["conversion-analytics", clinicId, unitId, dateFrom, dateTo],
    queryFn: () =>
      webhooksService.conversionAnalytics({
        clinicId,
        unitId: unitId ?? undefined,
        dateFrom,
        dateTo,
      }),
    enabled: !!clinicId,
    placeholderData: (prev) => prev,
  });

  const data = query.data;

  const donutData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Convertidos", value: data.totalConvertidos, fill: "#34d399" },
      { name: "Não convertidos", value: data.totalNaoConvertidos, fill: "#fb7185" },
      { name: "Em andamento", value: data.totalEmAndamento, fill: "#94a3b8" },
    ].filter((x) => x.value > 0);
  }, [data]);

  const motivoBars = useMemo(
    () =>
      (data?.motivos ?? []).map((m) => ({
        label: m.motivo,
        categoria: m.categoria,
        count: m.quantidade,
        pct: m.percentual,
      })),
    [data?.motivos],
  );

  return (
    <>
      <PageHeader
        title="Conversão"
        description="Quanto entra, quanto fecha tratamento e por que os outros não fecham. Motivos extraídos automaticamente das observações dos leads."
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
      </div>

      {/* ── KPIs hero ─────────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiHero
          tone="sky"
          icon={<ClipboardList className="h-4 w-4" />}
          label="Entraram no funil"
          value={formatNumber(data?.totalEntradas ?? 0)}
          loading={query.isLoading}
        />
        <KpiHero
          tone="emerald"
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Converteram"
          value={formatNumber(data?.totalConvertidos ?? 0)}
          sub={data ? `${formatPercent(data.taxaConversao)} de conversão` : undefined}
          loading={query.isLoading}
        />
        <KpiHero
          tone="rose"
          icon={<XCircle className="h-4 w-4" />}
          label="Não converteram"
          value={formatNumber(data?.totalNaoConvertidos ?? 0)}
          sub={data ? `${formatPercent(data.taxaNaoConversao)} de descarte` : undefined}
          loading={query.isLoading}
        />
        <KpiHero
          tone="slate"
          icon={<Hourglass className="h-4 w-4" />}
          label="Em andamento"
          value={formatNumber(data?.totalEmAndamento ?? 0)}
          loading={query.isLoading}
        />
      </div>

      {/* ── Tempo até conversão ──────────────────────────────────── */}
      {data && (data.mediaDiasAteConversao != null || data.medianaDiasAteConversao != null) && (
        <Card className="mt-3">
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                Tempo até conversão
              </div>
              <div className="flex flex-wrap gap-6 text-[12.5px] text-slate-300">
                <span>
                  <span className="text-slate-500">Média:</span>{" "}
                  <span className="font-semibold text-slate-100">
                    {data.mediaDiasAteConversao?.toFixed(1) ?? "—"} dias
                  </span>
                </span>
                <span>
                  <span className="text-slate-500">Mediana:</span>{" "}
                  <span className="font-semibold text-slate-100">
                    {data.medianaDiasAteConversao?.toFixed(1) ?? "—"} dias
                  </span>
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Donut + Motivos ──────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardBody>
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
              Distribuição
            </h3>
            <div className="mt-3 h-56">
              {donutData.length === 0 ? (
                <div className="grid h-full place-items-center text-[11.5px] text-slate-500">
                  Sem dados
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {donutData.map((d, i) => (
                        <Cell key={i} fill={d.fill} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#0d0d12",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                Motivos de não-conversão
              </h3>
              <span className="text-[10.5px] text-slate-500">
                Heurística sobre as observações dos leads
              </span>
            </div>
            <div className="mt-3 h-56">
              {motivoBars.length === 0 ? (
                <div className="grid h-full place-items-center text-[11.5px] text-slate-500">
                  Sem motivos identificados no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={motivoBars} layout="vertical">
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} stroke="transparent" />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={170}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      stroke="transparent"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0d0d12",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                      formatter={(v: number) => [`${v} lead(s)`, ""]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {motivoBars.map((m, i) => (
                        <Cell key={i} fill={REASON_COLORS[m.categoria] ?? "#64748b"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* Legend with percentages */}
            <ul className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-3">
              {(data?.motivos ?? []).slice(0, 6).map((m) => (
                <li key={m.categoria} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: REASON_COLORS[m.categoria] ?? "#64748b" }}
                  />
                  <span className="truncate text-slate-300">{m.motivo}</span>
                  <span className="font-mono tabular-nums text-slate-500">{m.percentual.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {/* ── Funil bruto por etapa ────────────────────────────────── */}
      {data && data.funil.length > 0 && (
        <Card className="mt-3">
          <CardBody>
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
              Onde os leads estão agora
            </h3>
            <ul className="mt-3 space-y-1.5">
              {data.funil.map((f) => {
                const pct = data.totalEntradas > 0 ? (f.quantidade * 100) / data.totalEntradas : 0;
                return (
                  <li key={f.stage} className="flex items-center gap-3">
                    <div className="w-44 truncate">
                      <StageBadge stage={f.stage} />
                    </div>
                    <div className="flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
                        <div
                          className="h-full rounded-full bg-emerald-500/60 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-20 text-right font-mono text-[11px] tabular-nums text-slate-300">
                      {formatNumber(f.quantidade)}
                    </span>
                    <span className="w-12 text-right font-mono text-[10.5px] tabular-nums text-slate-500">
                      {pct.toFixed(0)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* ── Exemplos de leads não convertidos ────────────────────── */}
      <Card className="mt-3">
        <CardBody>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
              Leads não convertidos · observações
            </h3>
            <span className="text-[10.5px] text-slate-500">
              {(data?.exemplos ?? []).length} exemplos · clique para abrir o perfil
            </span>
          </div>

          {query.isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-white/[0.02]" />
              ))}
            </div>
          ) : !data || data.exemplos.length === 0 ? (
            <EmptyState
              title="Sem observações registradas"
              description="Para extrair motivos automaticamente, preencha o campo 'Observações' nos leads não convertidos."
            />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {data.exemplos.map((ex) => (
                <li key={ex.leadId}>
                  <Link
                    to={`/leads/${ex.leadId}/journey`}
                    className="flex flex-col gap-1.5 px-1 py-3 transition hover:bg-white/[0.02] sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-slate-100">{ex.name}</span>
                        <StageBadge stage={ex.currentStage} />
                        {ex.motivoCategoria && (
                          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10.5px] font-medium text-rose-300 ring-1 ring-inset ring-rose-500/20">
                            {ex.motivoCategoria}
                          </span>
                        )}
                      </div>
                      {ex.observations && (
                        <p className="mt-1.5 max-w-3xl text-[11.5px] leading-relaxed text-slate-300">
                          “{ex.observations}”
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[10.5px] text-slate-500">
                        {ex.phone && <span className="font-mono tabular-nums">{ex.phone}</span>}
                        {ex.source && <span>· {ex.source}</span>}
                        <span>· criado {formatDate(ex.createdAt)}</span>
                      </div>
                    </div>
                    <ArrowRight className="hidden h-4 w-4 self-center text-slate-500 sm:block" />
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

interface KpiHeroProps {
  tone: "sky" | "emerald" | "rose" | "slate";
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}

function KpiHero({ tone, icon, label, value, sub, loading }: KpiHeroProps) {
  const tones: Record<KpiHeroProps["tone"], string> = {
    sky: "from-sky-500/[0.10] ring-sky-500/20 text-sky-300",
    emerald: "from-emerald-500/[0.10] ring-emerald-500/20 text-emerald-300",
    rose: "from-rose-500/[0.10] ring-rose-500/20 text-rose-300",
    slate: "from-slate-500/[0.05] ring-slate-500/20 text-slate-400",
  };
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-gradient-to-b to-transparent px-5 py-4 ring-1 ring-inset",
        tones[tone],
      )}
    >
      <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-[28px] font-bold leading-none tabular-nums text-slate-50">
        {loading ? "…" : value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px] text-slate-400">
          {tone === "emerald" && <TrendingUp className="mr-1 inline h-3 w-3" />}
          {tone === "rose" && <TrendingDown className="mr-1 inline h-3 w-3" />}
          {sub}
        </div>
      )}
    </div>
  );
}

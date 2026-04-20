import { useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  Trash2,
  Building2,
  Inbox,
  TrendingUp,
  Target,
  Wallet,
  Clock,
  Search,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Kpi } from "@/components/ui/Kpi";
import { RankBadge } from "@/components/ui/RankBadge";
import { FilterChip } from "@/components/ui/FilterChip";
import { TabButton } from "@/components/ui/SegmentButton";
import {
  PeriodFilter,
  PERIOD_PRESETS,
  todayIso,
} from "@/components/ui/PeriodFilter";
import { PaymentModal } from "@/components/finance/PaymentModal";
import {
  METHOD_META,
  MethodPill,
} from "@/components/finance/PaymentMethodMark";
import { useClinic } from "@/hooks/useClinic";
import {
  useDeletePayment,
  usePayments,
  useRevenueByUnit,
} from "@/hooks/useFinance";
import {
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "@/services/payments";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// PÁGINA
// ═══════════════════════════════════════════════════════════════════════════

export default function FinancePage() {
  const { tenantId, unitId } = useClinic();
  const clinicId = unitId || tenantId || undefined;

  const [tab, setTab] = useState<"basico" | "avancado">("basico");
  const [openModal, setOpenModal] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>(todayIso(-30));
  const [dateTo, setDateTo] = useState<string>(todayIso(1));
  const [method, setMethod] = useState<string>("");
  const [treatment, setTreatment] = useState<string>("");

  const revenue = useRevenueByUnit({ clinicId, dateFrom, dateTo });
  const payments = usePayments({
    clinicId, dateFrom, dateTo,
    method: method || null,
    treatment: treatment || null,
  });
  const deleteMutation = useDeletePayment();

  const summary = revenue.data ?? { grandTotal: 0, totalPayments: 0, units: [] };
  const list = payments.data ?? [];

  const avgTicket = summary.totalPayments > 0 ? summary.grandTotal / summary.totalPayments : 0;
  const totalDown = useMemo(
    () => summary.units.reduce((a, u) => a + (u.totalDownPayment ?? 0), 0),
    [summary.units]
  );
  const pendingBalance = useMemo(
    () => summary.units.reduce((a, u) => a + (u.pendingBalance ?? 0), 0),
    [summary.units]
  );

  const revenueByUnitChart = useMemo(
    () =>
      [...summary.units]
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10)
        .map((u) => ({
          name: u.unitName,
          entrada: u.totalDownPayment,
          pendente: u.pendingBalance,
          total: u.totalRevenue,
        })),
    [summary.units]
  );

  const methodAggregate = useMemo(() => {
    const acc = new Map<PaymentMethod, { quantity: number; total: number }>();
    summary.units.forEach((u) =>
      u.byMethod.forEach((m) => {
        const prev = acc.get(m.paymentMethod) ?? { quantity: 0, total: 0 };
        acc.set(m.paymentMethod, {
          quantity: prev.quantity + m.quantity,
          total: prev.total + m.total,
        });
      })
    );
    return Array.from(acc.entries())
      .map(([k, v]) => ({
        name: PAYMENT_METHOD_LABEL[k], method: k,
        value: v.total, qty: v.quantity,
      }))
      .sort((a, b) => b.value - a.value);
  }, [summary.units]);

  const treatmentAggregate = useMemo(() => {
    const acc = new Map<string, { qty: number; total: number }>();
    list.forEach((p) => {
      const prev = acc.get(p.treatment) ?? { qty: 0, total: 0 };
      acc.set(p.treatment, { qty: prev.qty + 1, total: prev.total + p.amount });
    });
    return Array.from(acc.entries())
      .map(([name, v]) => ({ name, qty: v.qty, total: v.total }))
      .sort((a, b) => b.total - a.total);
  }, [list]);

  const loading = revenue.isLoading || payments.isLoading;
  const activePreset = PERIOD_PRESETS.find(
    (p) => p.from === dateFrom && dateTo === todayIso(1)
  )?.key;
  const hasActiveFilters = method !== "" || treatment !== "";

  function applyPreset(from: string) {
    setDateFrom(from);
    setDateTo(todayIso(1));
  }
  function clearFilters() {
    setMethod("");
    setTreatment("");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Financeiro"
        description="Registre pagamentos dos leads, acompanhe faturamento e parcelamentos por unidade."
        badge="Financeiro"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => { revenue.refetch(); payments.refetch(); }}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Atualizar
            </Button>
            <Button
              onClick={() => setOpenModal(true)}
              className="gap-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold shadow-[0_4px_14px_-4px_rgba(16,185,129,0.35)]"
            >
              <Plus className="h-4 w-4" />
              Registrar pagamento
            </Button>
          </>
        }
      />

      {/* ═════════ Filtros ═════════ */}
      <FilterBar
        dateFrom={dateFrom} dateTo={dateTo}
        method={method} treatment={treatment}
        activePreset={activePreset}
        tab={tab}
        onDateFrom={setDateFrom} onDateTo={setDateTo}
        onMethod={setMethod} onTreatment={setTreatment}
        onPreset={applyPreset}
        onTab={setTab}
      />

      {/* Chips de filtros ativos */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap -mt-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Filtros ativos
          </span>
          {method && (
            <FilterChip
              label={PAYMENT_METHOD_LABEL[method as PaymentMethod]}
              dot={METHOD_META[method as PaymentMethod]?.dot}
              onRemove={() => setMethod("")}
            />
          )}
          {treatment && (
            <FilterChip label={treatment} onRemove={() => setTreatment("")} />
          )}
          <button
            onClick={clearFilters}
            className="text-[11px] text-slate-500 hover:text-slate-300 underline-offset-2 hover:underline transition"
          >
            limpar tudo
          </button>
        </div>
      )}

      {/* ═════════ KPIs ═════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi
          label="Faturamento total"
          value={formatCurrency(summary.grandTotal)}
          hint={`${formatNumber(summary.totalPayments)} pagamentos no período`}
          tone="emerald"
          icon={<TrendingUp className="h-4 w-4" />}
          loading={loading}
        />
        <Kpi
          label="Ticket médio"
          value={formatCurrency(avgTicket)}
          hint="Valor médio contratado por lead"
          tone="slate"
          icon={<Target className="h-4 w-4" />}
          loading={loading}
        />
        <Kpi
          label="Entradas recebidas"
          value={formatCurrency(totalDown)}
          hint="Soma dos sinais pagos"
          tone="sky"
          icon={<Wallet className="h-4 w-4" />}
          loading={loading}
        />
        <Kpi
          label="Saldo a receber"
          value={formatCurrency(pendingBalance)}
          hint="Contratado − entradas"
          tone="amber"
          icon={<Clock className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      {/* ═════════ Conteúdo por aba ═════════ */}
      {tab === "basico" ? (
        <BasicView
          units={summary.units}
          loading={loading}
          payments={list}
          onDelete={(id) => deleteMutation.mutate({ id, clinicId })}
        />
      ) : (
        <AdvancedView
          units={summary.units}
          revenueByUnitChart={revenueByUnitChart}
          methodAggregate={methodAggregate}
          treatmentAggregate={treatmentAggregate}
          payments={list}
          loading={loading}
          onDelete={(id) => deleteMutation.mutate({ id, clinicId })}
        />
      )}

      <PaymentModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        clinicId={clinicId}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FILTER BAR
// ═══════════════════════════════════════════════════════════════════════════

function FilterBar({
  dateFrom, dateTo, method, treatment, activePreset, tab,
  onDateFrom, onDateTo, onMethod, onTreatment, onPreset, onTab,
}: {
  dateFrom: string;
  dateTo: string;
  method: string;
  treatment: string;
  activePreset?: string;
  tab: "basico" | "avancado";
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onMethod: (v: string) => void;
  onTreatment: (v: string) => void;
  onPreset: (from: string) => void;
  onTab: (t: "basico" | "avancado") => void;
}) {
  return (
    <Panel>
      <div className="flex flex-col lg:flex-row gap-4 p-5">
        <div className="flex-1 space-y-3">
          <PeriodFilter activePreset={activePreset} onPreset={onPreset} />

          {/* Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FilterField label="De">
              <Input
                type="date" value={dateFrom}
                onChange={(e) => onDateFrom(e.target.value)}
                className="tabular-nums"
              />
            </FilterField>
            <FilterField label="Até">
              <Input
                type="date" value={dateTo}
                onChange={(e) => onDateTo(e.target.value)}
                className="tabular-nums"
              />
            </FilterField>
            <FilterField label="Forma">
              <Select value={method} onChange={(e) => onMethod(e.target.value)}>
                <option value="">Todas</option>
                {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((k) => (
                  <option key={k} value={k}>{PAYMENT_METHOD_LABEL[k]}</option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Tratamento">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                <Input
                  placeholder="Ex.: Ortodontia"
                  value={treatment}
                  onChange={(e) => onTreatment(e.target.value)}
                  className="pl-9"
                />
              </div>
            </FilterField>
          </div>
        </div>

        <div className="hidden lg:block w-px bg-white/[0.05] mx-1" />
        <div className="lg:self-start">
          <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 mb-2">
            Vista
          </span>
          <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <TabButton active={tab === "basico"} onClick={() => onTab("basico")}>
              Básico
            </TabButton>
            <TabButton active={tab === "avancado"} onClick={() => onTab("avancado")}>
              Avançado
            </TabButton>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BASIC VIEW
// ═══════════════════════════════════════════════════════════════════════════

function BasicView({
  units, payments, loading, onDelete,
}: {
  units: import("@/services/payments").UnitRevenue[];
  payments: import("@/services/payments").Payment[];
  loading: boolean;
  onDelete: (id: number) => void;
}) {
  const sortedUnits = [...units].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const totalUnitsRevenue = units.reduce((a, x) => a + x.totalRevenue, 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Panel className="xl:col-span-2">
        <PanelHeader
          eyebrow="Distribuição"
          eyebrowTone="bg-emerald-400"
          title="Faturamento por unidade"
          subtitle="Ranking por valor contratado no período"
        />
        <div className="p-5">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-white/[0.02] animate-pulse" />
              ))}
            </div>
          ) : sortedUnits.length === 0 ? (
            <EmptyState
              title="Ainda sem pagamentos"
              description="Registre o primeiro pagamento clicando em 'Registrar pagamento'."
              icon={<Inbox className="h-5 w-5 text-slate-500" />}
            />
          ) : (
            <div className="space-y-2.5">
              {sortedUnits.map((u, idx) => {
                const rank = idx + 1;
                const pct = totalUnitsRevenue > 0
                  ? (u.totalRevenue / totalUnitsRevenue) * 100
                  : 0;
                const paidPct = u.totalRevenue > 0
                  ? (u.totalDownPayment / u.totalRevenue) * 100
                  : 0;
                const isTop = rank <= 3;

                return (
                  <div
                    key={u.unitId}
                    className={cn(
                      "rounded-lg border bg-white/[0.015] px-4 py-3.5 transition",
                      isTop
                        ? "border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.025]"
                        : "border-white/[0.05] hover:bg-white/[0.02]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        <RankBadge rank={rank} />
                        <div className="h-8 w-8 shrink-0 grid place-items-center rounded-md bg-white/[0.03] text-slate-400 ring-1 ring-inset ring-white/[0.05]">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold text-slate-50">
                            {u.unitName}
                          </p>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {formatNumber(u.paymentsCount)} pagamentos · {pct.toFixed(1)}% do total
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[17px] font-bold text-slate-50 tabular-nums tracking-tight leading-none">
                          {formatCurrency(u.totalRevenue)}
                        </p>
                        <p className="mt-1 text-[10.5px] tabular-nums flex items-center gap-1.5 justify-end">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full bg-sky-400" />
                            <span className="text-sky-300">{formatCurrency(u.totalDownPayment)}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full bg-amber-400" />
                            <span className="text-amber-300">{formatCurrency(u.pendingBalance)}</span>
                          </span>
                        </p>
                      </div>
                    </div>
                    {/* Barra empilhada: pago + pendente */}
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04] flex">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 to-sky-400 transition-all"
                        style={{ width: `${paidPct}%` }}
                      />
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400/70 transition-all"
                        style={{ width: `${100 - paidPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Panel>

      {/* Últimos pagamentos */}
      <Panel>
        <PanelHeader
          eyebrow="Feed"
          eyebrowTone="bg-sky-400"
          title="Últimos pagamentos"
          subtitle="Transações mais recentes"
        />
        <div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded bg-white/[0.02] animate-pulse" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Nenhum pagamento no período"
                icon={<Inbox className="h-5 w-5 text-slate-500" />}
              />
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {payments.slice(0, 8).map((p) => (
                <li
                  key={p.id}
                  className="group flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-100">
                      {p.leadName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MethodPill methodKey={p.paymentMethod as PaymentMethod} />
                      <span className="text-[11px] text-slate-500 truncate">
                        {p.treatment}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13.5px] font-bold text-emerald-300 tabular-nums">
                      {formatCurrency(p.amount)}
                    </p>
                    <p className="text-[10.5px] text-slate-500 tabular-nums">
                      {formatDate(p.paidAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(p.id)}
                    className="h-7 w-7 shrink-0 grid place-items-center rounded-md text-slate-600 hover:bg-rose-500/10 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remover pagamento"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED VIEW
// ═══════════════════════════════════════════════════════════════════════════

function AdvancedView({
  units, revenueByUnitChart, methodAggregate, treatmentAggregate,
  payments, loading, onDelete,
}: {
  units: import("@/services/payments").UnitRevenue[];
  revenueByUnitChart: Array<{ name: string; entrada: number; pendente: number; total: number }>;
  methodAggregate: Array<{ name: string; method: PaymentMethod; value: number; qty: number }>;
  treatmentAggregate: Array<{ name: string; qty: number; total: number }>;
  payments: import("@/services/payments").Payment[];
  loading: boolean;
  onDelete: (id: number) => void;
}) {
  const tooltipStyle = {
    background: "rgba(10,10,13,.96)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    fontSize: 12,
    padding: "8px 10px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  };

  return (
    <div className="space-y-4">
      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel className="xl:col-span-2">
          <PanelHeader
            eyebrow="Composição"
            eyebrowTone="bg-sky-400"
            title="Faturamento por unidade"
            subtitle="Entrada recebida + saldo pendente, ordenado por faturamento"
          />
          <div className="p-5">
            {loading ? (
              <div className="h-72 rounded bg-white/[0.02] animate-pulse" />
            ) : revenueByUnitChart.length === 0 ? (
              <EmptyState
                title="Sem dados no período"
                icon={<Inbox className="h-5 w-5 text-slate-500" />}
              />
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <LegendDot gradient="linear-gradient(180deg, #38bdf8, #0284c7)" label="Entrada recebida" />
                  <LegendDot gradient="linear-gradient(180deg, #fbbf24, #b45309)" label="Saldo pendente" />
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <BarChart data={revenueByUnitChart} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                      <defs>
                        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95}/>
                          <stop offset="100%" stopColor="#0284c7" stopOpacity={0.75}/>
                        </linearGradient>
                        <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.95}/>
                          <stop offset="100%" stopColor="#b45309" stopOpacity={0.7}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                        tickLine={false} axisLine={false}
                        angle={-12} textAnchor="end"
                        height={40}
                      />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        tickLine={false} axisLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                        formatter={(v: number, k: string) => [formatCurrency(v), k === "entrada" ? "Entrada" : "Pendente"]}
                      />
                      <Bar dataKey="entrada"  stackId="a" fill="url(#skyGrad)" />
                      <Bar dataKey="pendente" stackId="a" fill="url(#amberGrad)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Mix"
            eyebrowTone="bg-indigo-400"
            title="Formas de pagamento"
            subtitle="Distribuição do volume"
          />
          <div className="p-5">
            {methodAggregate.length === 0 ? (
              <EmptyState
                title="Sem dados"
                icon={<Inbox className="h-5 w-5 text-slate-500" />}
              />
            ) : (
              <>
                <div className="h-52 relative">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={methodAggregate}
                        dataKey="value" nameKey="name"
                        innerRadius={54} outerRadius={82}
                        paddingAngle={3}
                        stroke="rgba(10,10,13,1)" strokeWidth={2}
                      >
                        {methodAggregate.map((m) => (
                          <Cell key={m.method} fill={METHOD_META[m.method]?.hex ?? "#64748b"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2 mt-3">
                  {methodAggregate.map((m) => {
                    const meta = METHOD_META[m.method];
                    const Mark = meta.mark;
                    return (
                      <li key={m.method} className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-2">
                          <span className={cn("h-6 w-6 grid place-items-center rounded-md ring-1 ring-inset", meta.bg, meta.ring)}>
                            <Mark className={cn("h-3.5 w-3.5", meta.text)} />
                          </span>
                          <span className="text-slate-200 font-medium">{meta.short}</span>
                          <span className="text-slate-600 tabular-nums">
                            · {formatNumber(m.qty)}
                          </span>
                        </span>
                        <span className="tabular-nums font-semibold text-slate-100">
                          {formatCurrency(m.value)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </Panel>
      </div>

      {/* Detalhes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader
            eyebrow="Quebra"
            eyebrowTone="bg-emerald-400"
            title="Detalhe por unidade"
            subtitle="Faturamento e método de pagamento"
          />
          <div>
            {units.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Sem unidades com pagamentos" />
              </div>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    <th className="text-left px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Unidade</th>
                    <th className="text-right px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Pagtos.</th>
                    <th className="text-right px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Faturamento</th>
                    <th className="text-right px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Entrada</th>
                    <th className="text-right px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Pendente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {units.map((u) => (
                    <tr key={u.unitId} className="hover:bg-white/[0.02] transition">
                      <td className="px-5 py-3">
                        <div>
                          <span className="font-semibold text-slate-100">{u.unitName}</span>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {u.byMethod.slice(0, 4).map((m) => (
                              <MethodPill key={m.paymentMethod} methodKey={m.paymentMethod} />
                            ))}
                            {u.byMethod.length > 4 && (
                              <span className="text-[11px] text-slate-500 self-center">
                                +{u.byMethod.length - 4}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-right px-5 py-3 tabular-nums text-slate-300">
                        {formatNumber(u.paymentsCount)}
                      </td>
                      <td className="text-right px-5 py-3 tabular-nums font-bold text-slate-50">
                        {formatCurrency(u.totalRevenue)}
                      </td>
                      <td className="text-right px-5 py-3 tabular-nums text-sky-300">
                        {formatCurrency(u.totalDownPayment)}
                      </td>
                      <td className="text-right px-5 py-3 tabular-nums text-amber-300">
                        {formatCurrency(u.pendingBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Ranking"
            eyebrowTone="bg-amber-400"
            title="Tratamentos mais contratados"
            subtitle="Por volume financeiro no período"
          />
          <div className="p-5">
            {treatmentAggregate.length === 0 ? (
              <EmptyState title="Sem tratamentos no período" />
            ) : (
              <div className="space-y-3">
                {treatmentAggregate.slice(0, 10).map((t, i) => {
                  const max = treatmentAggregate[0]?.total ?? 1;
                  const pct = (t.total / Math.max(1, max)) * 100;
                  const rank = i + 1;
                  return (
                    <div key={t.name}>
                      <div className="flex items-center justify-between text-[12px] mb-1.5 gap-3">
                        <span className="flex items-center gap-2 min-w-0">
                          <RankBadge rank={rank} />
                          <span className="text-slate-100 font-medium truncate">{t.name}</span>
                          <span className="text-slate-600 tabular-nums shrink-0">
                            · {formatNumber(t.qty)}
                          </span>
                        </span>
                        <span className="tabular-nums font-semibold text-slate-100 shrink-0">
                          {formatCurrency(t.total)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Tabela completa */}
      <Panel>
        <PanelHeader
          eyebrow="Log"
          eyebrowTone="bg-slate-400"
          title="Todos os pagamentos"
          subtitle="Lista detalhada com parcelamento e duração"
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-0.5 text-[11px] tabular-nums text-slate-300">
              {formatNumber(payments.length)} registros
            </span>
          }
        />
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-5 space-y-2">
              {[0,1,2,3,4].map((i) => (
                <div key={i} className="h-10 rounded bg-white/[0.02] animate-pulse" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Nenhum pagamento encontrado" />
            </div>
          ) : (
            <table className="w-full text-[12.5px] min-w-[900px]">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="text-left px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Lead</th>
                  <th className="text-left px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Tratamento</th>
                  <th className="text-center px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Duração</th>
                  <th className="text-left px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Forma</th>
                  <th className="text-right px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Entrada</th>
                  <th className="text-right px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Parcelas</th>
                  <th className="text-right px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Total</th>
                  <th className="text-left px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Data</th>
                  <th className="text-left px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">Unidade</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {payments.map((p) => (
                  <tr key={p.id} className="group hover:bg-white/[0.02] transition">
                    <td className="px-5 py-3">
                      <span className="font-medium text-slate-100">{p.leadName}</span>
                      <span className="block text-[10.5px] text-slate-600 tabular-nums">#{p.leadId}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-300">{p.treatment}</td>
                    <td className="text-center px-5 py-3 text-slate-400 tabular-nums">
                      {p.treatmentDurationMonths
                        ? `${p.treatmentDurationMonths} mês${p.treatmentDurationMonths > 1 ? "es" : ""}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <MethodPill methodKey={p.paymentMethod as PaymentMethod} />
                    </td>
                    <td className="text-right px-5 py-3 tabular-nums text-sky-300">
                      {formatCurrency(p.downPayment)}
                    </td>
                    <td className="text-right px-5 py-3 tabular-nums text-slate-300">
                      {p.installments}× <span className="text-slate-500">{formatCurrency(p.installmentValue)}</span>
                    </td>
                    <td className="text-right px-5 py-3 tabular-nums font-bold text-emerald-300">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-[11px] tabular-nums">
                      {formatDate(p.paidAt)}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-[11px]">{p.unitName ?? "—"}</td>
                    <td className="pr-5">
                      <button
                        onClick={() => onDelete(p.id)}
                        className="h-7 w-7 grid place-items-center rounded-md text-slate-600 hover:bg-rose-500/10 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition"
                        aria-label="Remover pagamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}

function LegendDot({ gradient, label }: { gradient: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: gradient }} />
      <span className="text-[11px] text-slate-300 font-medium">{label}</span>
    </div>
  );
}
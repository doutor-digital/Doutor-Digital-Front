import { useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  CalendarDays,
  CreditCard,
  DollarSign,
  Plus,
  Receipt,
  RefreshCw,
  TrendingUp,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiCard } from "@/components/kpi/KpiCard";
import { PaymentModal } from "@/components/finance/PaymentModal";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<PaymentMethod, string> = {
  pix: "#22d3ee",
  dinheiro: "#10b981",
  debito: "#3b82f6",
  credito: "#a855f7",
  boleto: "#f97316",
  transferencia: "#f43f5e",
};

function todayIso(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { tenantId, unitId } = useClinic();
  const clinicId = unitId || tenantId || undefined;

  const [tab, setTab] = useState<"basico" | "avancado">("basico");
  const [openModal, setOpenModal] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>(todayIso(-30));
  const [dateTo, setDateTo] = useState<string>(todayIso(1));
  const [method, setMethod] = useState<string>("");
  const [treatment, setTreatment] = useState<string>("");

  const revenue = useRevenueByUnit({
    clinicId,
    dateFrom,
    dateTo,
  });

  const payments = usePayments({
    clinicId,
    dateFrom,
    dateTo,
    method: method || null,
    treatment: treatment || null,
  });

  const deleteMutation = useDeletePayment();

  const summary = revenue.data ?? { grandTotal: 0, totalPayments: 0, units: [] };
  const list = payments.data ?? [];

  const avgTicket =
    summary.totalPayments > 0 ? summary.grandTotal / summary.totalPayments : 0;

  const totalDown = useMemo(
    () => summary.units.reduce((a, u) => a + (u.totalDownPayment ?? 0), 0),
    [summary.units]
  );
  const pendingBalance = useMemo(
    () => summary.units.reduce((a, u) => a + (u.pendingBalance ?? 0), 0),
    [summary.units]
  );

  // Agregados para gráficos avançados
  const revenueByUnitChart = useMemo(
    () =>
      [...summary.units]
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10)
        .map((u) => ({
          name: u.unitName,
          faturamento: u.totalRevenue,
          entrada: u.totalDownPayment,
          pendente: u.pendingBalance,
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
        name: PAYMENT_METHOD_LABEL[k],
        method: k,
        value: v.total,
        qty: v.quantity,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Registre pagamentos dos leads, acompanhe faturamento e parcelamentos por unidade."
        badge="Financeiro"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                revenue.refetch();
                payments.refetch();
              }}
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Button onClick={() => setOpenModal(true)}>
              <Plus className="h-4 w-4" /> Registrar pagamento
            </Button>
          </>
        }
      />

      {/* Filtros de período — comuns às duas abas */}
      <Card>
        <CardBody className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                De
              </label>
              <Input
                type="date"
                className="mt-1"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Até
              </label>
              <Input
                type="date"
                className="mt-1"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Forma
              </label>
              <Select
                className="mt-1"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="">Todas</option>
                {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((k) => (
                  <option key={k} value={k}>
                    {PAYMENT_METHOD_LABEL[k]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Tratamento
              </label>
              <Input
                className="mt-1"
                placeholder="Ex.: Ortodontia"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
              />
            </div>
          </div>
          <Tabs
            value={tab}
            onChange={(v) => setTab(v as "basico" | "avancado")}
            tabs={[
              { value: "basico", label: "Básico" },
              { value: "avancado", label: "Avançado" },
            ]}
          />
        </CardBody>
      </Card>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          label="Faturamento total"
          value={formatCurrency(summary.grandTotal)}
          tone="green"
          icon={<DollarSign />}
          subtitle={`${formatNumber(summary.totalPayments)} pagamentos registrados no período`}
          loading={loading}
        />
        <KpiCard
          label="Ticket médio"
          value={formatCurrency(avgTicket)}
          tone="blue"
          icon={<TrendingUp />}
          subtitle="Valor médio contratado por lead convertido"
          loading={loading}
        />
        <KpiCard
          label="Entradas recebidas"
          value={formatCurrency(totalDown)}
          tone="violet"
          icon={<Wallet />}
          subtitle="Soma das entradas (sinais) pagas"
          loading={loading}
        />
        <KpiCard
          label="Saldo a receber"
          value={formatCurrency(pendingBalance)}
          tone="amber"
          icon={<Receipt />}
          subtitle="Total contratado − entradas"
          loading={loading}
        />
      </div>

      {/* ── Conteúdo por aba ── */}
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

// ─── Basic view ───────────────────────────────────────────────────────────────

function BasicView({
  units,
  payments,
  loading,
  onDelete,
}: {
  units: import("@/services/payments").UnitRevenue[];
  payments: import("@/services/payments").Payment[];
  loading: boolean;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Faturamento por unidade */}
      <Card className="xl:col-span-2">
        <CardHeader
          title="Faturamento por unidade"
          subtitle="Total contratado em cada unidade no período selecionado"
        />
        <CardBody>
          {loading ? (
            <div className="skeleton h-40 rounded-xl" />
          ) : units.length === 0 ? (
            <EmptyState
              title="Ainda sem pagamentos"
              description="Registre o primeiro pagamento clicando em 'Registrar pagamento'."
              icon={<Building2 className="h-5 w-5 text-slate-400" />}
            />
          ) : (
            <div className="space-y-3">
              {units.map((u) => {
                const pct =
                  units.length > 0
                    ? (u.totalRevenue /
                        Math.max(1, units.reduce((a, x) => a + x.totalRevenue, 0))) *
                      100
                    : 0;
                return (
                  <div
                    key={u.unitId}
                    className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-brand-300" />
                          <p className="truncate text-sm font-semibold text-slate-50">
                            {u.unitName}
                          </p>
                          <Badge tone="slate">ID {u.clinicId}</Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {formatNumber(u.paymentsCount)} pagamentos
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-300 tabular-nums">
                          {formatCurrency(u.totalRevenue)}
                        </p>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {pct.toFixed(1)}% do total
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Resumo rápido */}
      <Card>
        <CardHeader
          title="Últimos pagamentos"
          subtitle="Visão rápida das transações recentes"
        />
        <CardBody className="p-0">
          {loading ? (
            <div className="skeleton h-60 rounded-xl mx-4 my-3" />
          ) : payments.length === 0 ? (
            <EmptyState
              title="Nenhum pagamento no período"
              icon={<CreditCard className="h-5 w-5 text-slate-400" />}
            />
          ) : (
            <ul className="divide-y divide-white/5">
              {payments.slice(0, 8).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {p.leadName}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {p.treatment} · {PAYMENT_METHOD_LABEL[p.paymentMethod]}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-300 tabular-nums">
                      {formatCurrency(p.amount)}
                    </p>
                    <p className="text-[10.5px] text-slate-500 tabular-nums">
                      {formatDate(p.paidAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(p.id)}
                    className="ml-1 h-7 w-7 grid place-items-center rounded-md text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Advanced view ────────────────────────────────────────────────────────────

function AdvancedView({
  units,
  revenueByUnitChart,
  methodAggregate,
  treatmentAggregate,
  payments,
  loading,
  onDelete,
}: {
  units: import("@/services/payments").UnitRevenue[];
  revenueByUnitChart: Array<{
    name: string;
    faturamento: number;
    entrada: number;
    pendente: number;
  }>;
  methodAggregate: Array<{
    name: string;
    method: PaymentMethod;
    value: number;
    qty: number;
  }>;
  treatmentAggregate: Array<{ name: string; qty: number; total: number }>;
  payments: import("@/services/payments").Payment[];
  loading: boolean;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Gráficos cruzados */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Faturamento × entradas × pendente por unidade"
            subtitle="Comparativo financeiro ordenado pelo maior faturamento"
          />
          <CardBody>
            {loading ? (
              <div className="skeleton h-72 rounded-xl" />
            ) : revenueByUnitChart.length === 0 ? (
              <EmptyState
                title="Sem dados no período"
                icon={<TrendingUp className="h-5 w-5 text-slate-400" />}
              />
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer>
                  <BarChart
                    data={revenueByUnitChart}
                    margin={{ top: 10, right: 10, left: 0, bottom: 30 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgb(148 163 184 / 0.15)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(11,16,32,.95)",
                        border: "1px solid rgba(148,163,184,.2)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      formatter={(v: number, k: string) => [formatCurrency(v), k]}
                    />
                    <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 11 }} />
                    <Bar
                      dataKey="faturamento"
                      fill="#22c55e"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="entrada"
                      fill="#a855f7"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="pendente"
                      fill="#f59e0b"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Formas de pagamento"
            subtitle="Distribuição do volume recebido"
          />
          <CardBody>
            {methodAggregate.length === 0 ? (
              <EmptyState
                title="Sem dados"
                icon={<Banknote className="h-5 w-5 text-slate-400" />}
              />
            ) : (
              <>
                <div className="h-60">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={methodAggregate}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {methodAggregate.map((m) => (
                          <Cell
                            key={m.method}
                            fill={METHOD_COLORS[m.method] ?? "#94a3b8"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "rgba(11,16,32,.95)",
                          border: "1px solid rgba(148,163,184,.2)",
                          borderRadius: 10,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-1.5 mt-2">
                  {methodAggregate.map((m) => (
                    <li
                      key={m.method}
                      className="flex items-center justify-between text-[12px]"
                    >
                      <span className="flex items-center gap-2 text-slate-300">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: METHOD_COLORS[m.method] ?? "#94a3b8" }}
                        />
                        {m.name}
                        <span className="text-slate-500">
                          ({formatNumber(m.qty)})
                        </span>
                      </span>
                      <span className="tabular-nums font-semibold text-slate-100">
                        {formatCurrency(m.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Breakdown por unidade + tratamentos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Detalhe por unidade"
            subtitle="Quebra por forma de pagamento"
          />
          <CardBody className="p-0">
            {units.length === 0 ? (
              <EmptyState title="Sem unidades com pagamentos" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>Unidade</Th>
                    <Th className="text-right">Pagamentos</Th>
                    <Th className="text-right">Faturamento</Th>
                    <Th className="text-right">Entrada</Th>
                    <Th className="text-right">Pendente</Th>
                  </tr>
                </THead>
                <TBody>
                  {units.map((u) => (
                    <Tr key={u.unitId}>
                      <Td>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-100">
                            {u.unitName}
                          </span>
                          <span className="flex gap-1 mt-1 flex-wrap">
                            {u.byMethod.map((m) => (
                              <Badge
                                key={m.paymentMethod}
                                tone="slate"
                                className={cn("text-[10px]")}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    background:
                                      METHOD_COLORS[m.paymentMethod] ?? "#94a3b8",
                                  }}
                                />
                                {PAYMENT_METHOD_LABEL[m.paymentMethod]}{" "}
                                <span className="text-slate-400">
                                  · {formatCurrency(m.total)}
                                </span>
                              </Badge>
                            ))}
                          </span>
                        </div>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {formatNumber(u.paymentsCount)}
                      </Td>
                      <Td className="text-right tabular-nums text-emerald-300 font-semibold">
                        {formatCurrency(u.totalRevenue)}
                      </Td>
                      <Td className="text-right tabular-nums text-violet-200">
                        {formatCurrency(u.totalDownPayment)}
                      </Td>
                      <Td className="text-right tabular-nums text-amber-300">
                        {formatCurrency(u.pendingBalance)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Tratamentos mais contratados"
            subtitle="Por volume financeiro no período"
          />
          <CardBody>
            {treatmentAggregate.length === 0 ? (
              <EmptyState title="Sem tratamentos no período" />
            ) : (
              <div className="space-y-2">
                {treatmentAggregate.slice(0, 10).map((t) => {
                  const max = treatmentAggregate[0]?.total ?? 1;
                  const pct = (t.total / Math.max(1, max)) * 100;
                  return (
                    <div key={t.name}>
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span className="text-slate-200">
                          {t.name}
                          <span className="text-slate-500 ml-1">
                            ({formatNumber(t.qty)})
                          </span>
                        </span>
                        <span className="tabular-nums font-semibold text-slate-100">
                          {formatCurrency(t.total)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-500 to-accent-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Tabela completa */}
      <Card>
        <CardHeader
          title="Todos os pagamentos"
          subtitle="Lista detalhada com parcelamento e duração"
          action={
            <Badge tone="blue">
              <CalendarDays className="h-3 w-3" />
              {formatNumber(payments.length)} registros
            </Badge>
          }
        />
        <CardBody className="p-0">
          {loading ? (
            <div className="skeleton h-40 rounded-xl mx-4 my-3" />
          ) : payments.length === 0 ? (
            <EmptyState title="Nenhum pagamento encontrado" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Lead</Th>
                  <Th>Tratamento</Th>
                  <Th className="text-center">Duração</Th>
                  <Th>Forma</Th>
                  <Th className="text-right">Entrada</Th>
                  <Th className="text-right">Parcelas</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Data</Th>
                  <Th>Unidade</Th>
                  <Th></Th>
                </tr>
              </THead>
              <TBody>
                {payments.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <span className="font-medium text-slate-100">
                        {p.leadName}
                      </span>
                      <span className="block text-[10.5px] text-slate-500">
                        #{p.leadId}
                      </span>
                    </Td>
                    <Td>{p.treatment}</Td>
                    <Td className="text-center text-slate-300 tabular-nums">
                      {p.treatmentDurationMonths
                        ? `${p.treatmentDurationMonths} mês${
                            p.treatmentDurationMonths > 1 ? "es" : ""
                          }`
                        : "—"}
                    </Td>
                    <Td>
                      <Badge tone="neutral">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background:
                              METHOD_COLORS[p.paymentMethod] ?? "#94a3b8",
                          }}
                        />
                        {PAYMENT_METHOD_LABEL[p.paymentMethod]}
                      </Badge>
                    </Td>
                    <Td className="text-right tabular-nums text-violet-200">
                      {formatCurrency(p.downPayment)}
                    </Td>
                    <Td className="text-right tabular-nums text-slate-200">
                      {p.installments}× {formatCurrency(p.installmentValue)}
                    </Td>
                    <Td className="text-right tabular-nums font-semibold text-emerald-300">
                      {formatCurrency(p.amount)}
                    </Td>
                    <Td className="text-slate-400 text-[11px]">
                      {formatDate(p.paidAt)}
                    </Td>
                    <Td className="text-slate-400 text-[11px]">
                      {p.unitName ?? "—"}
                    </Td>
                    <Td>
                      <button
                        onClick={() => onDelete(p.id)}
                        className="h-7 w-7 grid place-items-center rounded-md text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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

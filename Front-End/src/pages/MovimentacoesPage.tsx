import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Plus,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Kpi } from "@/components/ui/Kpi";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { FilterChip } from "@/components/ui/FilterChip";
import { useDebounce } from "@/hooks/useDebounce";
import { cn, formatCurrency } from "@/lib/utils";
import {
  CASH_MOVEMENT_CATEGORIES,
  CASH_MOVEMENT_STATUSES,
  CATEGORY_LABEL,
  MOVEMENT_PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  STATUS_LABEL,
  type CashMovement,
  type CashMovementCategory,
  type CashMovementSortField,
  type CashMovementStatus,
  type CashMovementType,
  type FindAllCashMovementInput,
  type MovementTypePayment,
  type SortDirection,
} from "@/services/cashMovements";
import {
  useCashMovementsHistory,
  useDeleteCashMovement,
} from "@/hooks/useCashMovements";
import { MovimentacaoFormModal } from "@/components/movements/MovimentacaoFormModal";
import { MovimentacoesTable } from "@/components/movements/MovimentacoesTable";

type PeriodPreset = "7d" | "30d" | "90d" | "month" | "all";

function presetToRange(preset: PeriodPreset): {
  startDate: string | null;
  endDate: string | null;
} {
  if (preset === "all") return { startDate: null, endDate: null };
  const end = new Date();
  const start = new Date();
  if (preset === "7d") start.setDate(end.getDate() - 7);
  else if (preset === "30d") start.setDate(end.getDate() - 30);
  else if (preset === "90d") start.setDate(end.getDate() - 90);
  else if (preset === "month") start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

export default function MovimentacoesPage() {
  // Filtros
  const [period, setPeriod] = useState<PeriodPreset>("30d");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<CashMovementType | "">("");
  const [categories, setCategories] = useState<CashMovementCategory[]>([]);
  const [statuses, setStatuses] = useState<CashMovementStatus[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<MovementTypePayment[]>([]);
  const [sortBy, setSortBy] = useState<CashMovementSortField>("DATE");
  const [sortDirection, setSortDirection] = useState<SortDirection>("DESC");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CashMovement | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const range = useMemo(() => presetToRange(period), [period]);

  const queryInput: FindAllCashMovementInput = useMemo(
    () => ({
      search: debouncedSearch || null,
      type: type || null,
      categories: categories.length ? categories : undefined,
      statuses: statuses.length ? statuses : undefined,
      paymentMethods: paymentMethods.length ? paymentMethods : undefined,
      startDate: range.startDate,
      endDate: range.endDate,
      sortBy,
      sortDirection,
      page,
      pageSize,
    }),
    [
      debouncedSearch,
      type,
      categories,
      statuses,
      paymentMethods,
      range.startDate,
      range.endDate,
      sortBy,
      sortDirection,
      page,
      pageSize,
    ],
  );

  const history = useCashMovementsHistory(queryInput);
  const deleteMutation = useDeleteCashMovement();

  const data = history.data;
  const summary = data?.summary;

  function clearFilters() {
    setSearch("");
    setType("");
    setCategories([]);
    setStatuses([]);
    setPaymentMethods([]);
    setPage(1);
  }

  const hasActiveFilters =
    !!debouncedSearch ||
    !!type ||
    categories.length > 0 ||
    statuses.length > 0 ||
    paymentMethods.length > 0;

  function toggle<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  async function handleDelete(m: CashMovement) {
    const ok = window.confirm(
      `Excluir a movimentação "${m.description}"?\nEsta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    await deleteMutation.mutateAsync(m.id);
    history.refetch();
  }

  function openEdit(m: CashMovement) {
    setEditing(m);
    setModalOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function exportCsv() {
    if (!data?.items?.length) return;
    const headers = [
      "data",
      "tipo",
      "categoria",
      "status",
      "forma_pagamento",
      "valor",
      "descricao",
      "codigo_referencia",
      "contato",
      "documento_contato",
      "vencimento",
      "pago_em",
      "observacoes",
      "anexo_url",
    ];
    const rows = data.items.map((m) => [
      m.date,
      m.type,
      m.category,
      m.status,
      m.typePayment ?? "",
      Number(m.value).toFixed(2),
      m.description,
      m.referenceCode ?? "",
      m.counterpartyName ?? "",
      m.counterpartyDocument ?? "",
      m.dueDate ?? "",
      m.paidAt ?? "",
      m.notes ?? "",
      m.attachmentUrl ?? "",
    ]);
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv =
      "﻿" +
      [headers.join(";"), ...rows.map((r) => r.map(escape).join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimentacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const totalPages = data?.totalPages ?? 1;

  return (
    <div>
      <PageHeader
        badge="Financeiro"
        title="Movimentações"
        description="Registre entradas e saídas, acompanhe o saldo e auditoria do caixa em tempo real."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => history.refetch()}
              disabled={history.isFetching}
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  history.isFetching && "animate-spin",
                )}
              />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!data?.items?.length}
            >
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova movimentação
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi
          label="Saldo do período"
          value={formatCurrency(summary?.balance ?? 0)}
          tone={(summary?.balance ?? 0) >= 0 ? "emerald" : "rose"}
          icon={<Wallet className="h-3.5 w-3.5" />}
          loading={history.isLoading}
          hint={`${summary?.totalCount ?? 0} lançamento(s)`}
        />
        <Kpi
          label="Entradas"
          value={formatCurrency(summary?.totalEntries ?? 0)}
          tone="emerald"
          icon={<ArrowDownLeft className="h-3.5 w-3.5" />}
          loading={history.isLoading}
        />
        <Kpi
          label="Saídas"
          value={formatCurrency(summary?.totalExits ?? 0)}
          tone="rose"
          icon={<ArrowUpRight className="h-3.5 w-3.5" />}
          loading={history.isLoading}
        />
        <Kpi
          label="Pendentes"
          value={formatCurrency(summary?.pendingTotal ?? 0)}
          tone="amber"
          icon={<Clock className="h-3.5 w-3.5" />}
          loading={history.isLoading}
        />
        <Kpi
          label="Vencidas"
          value={formatCurrency(summary?.overdueTotal ?? 0)}
          tone="rose"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          loading={history.isLoading}
        />
      </section>

      {/* Filtros */}
      <Panel className="mt-5">
        <PanelHeader
          eyebrow="Filtros"
          title="Refine o histórico"
          subtitle="Combine período, tipo e categorias para encontrar exatamente o que precisa."
          action={
            hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar tudo
              </Button>
            )
          }
        />
        <div className="px-5 py-4 space-y-4">
          {/* Linha 1: período + busca */}
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-3 items-center">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.05] w-max">
              {(
                [
                  ["7d", "7 dias"],
                  ["30d", "30 dias"],
                  ["90d", "90 dias"],
                  ["month", "Este mês"],
                  ["all", "Tudo"],
                ] as Array<[PeriodPreset, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setPeriod(key);
                    setPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 text-[11.5px] font-medium rounded-md transition",
                    period === key
                      ? "bg-white/[0.06] text-slate-100"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <Input
              icon={<Search className="h-3.5 w-3.5" />}
              placeholder="Buscar por descrição, contato, referência ou observação…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />

            <div className="flex items-center gap-2">
              <Select
                value={`${sortBy}:${sortDirection}`}
                onChange={(e) => {
                  const [a, b] = e.target.value.split(":");
                  setSortBy(a as CashMovementSortField);
                  setSortDirection(b as SortDirection);
                }}
                className="!py-1.5 !text-[12px] w-[180px]"
              >
                <option value="DATE:DESC">Data (mais recentes)</option>
                <option value="DATE:ASC">Data (mais antigas)</option>
                <option value="VALUE:DESC">Valor (maior)</option>
                <option value="VALUE:ASC">Valor (menor)</option>
                <option value="CREATED_AT:DESC">Criação (recentes)</option>
                <option value="DUE_DATE:ASC">Vencimento (próximos)</option>
              </Select>
            </div>
          </div>

          {/* Linha 2: facetas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <FacetSelect
              label="Tipo"
              value={type}
              onChange={(v) => {
                setType(v as CashMovementType | "");
                setPage(1);
              }}
              options={[
                { value: "", label: "Todos" },
                { value: "ENTRY", label: "Entradas" },
                { value: "EXIT", label: "Saídas" },
              ]}
            />

            <FacetMulti
              label="Categorias"
              selected={categories}
              onToggle={(v) => {
                setCategories(toggle(categories, v as CashMovementCategory));
                setPage(1);
              }}
              options={CASH_MOVEMENT_CATEGORIES.map((c) => ({
                value: c,
                label: CATEGORY_LABEL[c],
              }))}
            />

            <FacetMulti
              label="Status"
              selected={statuses}
              onToggle={(v) => {
                setStatuses(toggle(statuses, v as CashMovementStatus));
                setPage(1);
              }}
              options={CASH_MOVEMENT_STATUSES.map((s) => ({
                value: s,
                label: STATUS_LABEL[s],
              }))}
            />

            <FacetMulti
              label="Pagamento"
              selected={paymentMethods}
              onToggle={(v) => {
                setPaymentMethods(toggle(paymentMethods, v as MovementTypePayment));
                setPage(1);
              }}
              options={MOVEMENT_PAYMENT_METHODS.map((m) => ({
                value: m,
                label: PAYMENT_METHOD_LABEL[m],
              }))}
            />
          </div>

          {/* Chips ativos */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {type && (
                <FilterChip
                  label={`Tipo: ${type === "ENTRY" ? "Entradas" : "Saídas"}`}
                  onRemove={() => setType("")}
                />
              )}
              {categories.map((c) => (
                <FilterChip
                  key={c}
                  label={CATEGORY_LABEL[c]}
                  onRemove={() =>
                    setCategories(categories.filter((x) => x !== c))
                  }
                />
              ))}
              {statuses.map((s) => (
                <FilterChip
                  key={s}
                  label={STATUS_LABEL[s]}
                  onRemove={() => setStatuses(statuses.filter((x) => x !== s))}
                />
              ))}
              {paymentMethods.map((p) => (
                <FilterChip
                  key={p}
                  label={PAYMENT_METHOD_LABEL[p]}
                  onRemove={() =>
                    setPaymentMethods(paymentMethods.filter((x) => x !== p))
                  }
                />
              ))}
              {debouncedSearch && (
                <FilterChip
                  label={`Busca: "${debouncedSearch}"`}
                  onRemove={() => setSearch("")}
                />
              )}
            </div>
          )}
        </div>
      </Panel>

      {/* Tabela */}
      <Panel className="mt-5">
        <PanelHeader
          eyebrow="Histórico"
          title="Lançamentos"
          subtitle={
            data
              ? `${data.total.toLocaleString("pt-BR")} registro(s) encontrados`
              : "Carregando…"
          }
        />
        <div className="p-4">
          <MovimentacoesTable
            items={data?.items ?? []}
            loading={history.isLoading}
            onEdit={openEdit}
            onDelete={handleDelete}
          />

          {/* Paginação */}
          {data && data.total > pageSize && (
            <div className="flex items-center justify-between gap-3 px-1 pt-4">
              <div className="text-[11.5px] text-slate-500">
                Página{" "}
                <span className="text-slate-300 tabular-nums">{data.page}</span>{" "}
                de{" "}
                <span className="text-slate-300 tabular-nums">
                  {totalPages}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="!py-1.5 !text-[12px] w-[110px]"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} / página
                    </option>
                  ))}
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1 || history.isFetching}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages || history.isFetching}
                >
                  Próxima <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <MovimentacaoFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        movement={editing}
      />
    </div>
  );
}

// ─── Subcomponentes locais ───────────────────────────────────────────────────

function FacetSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 mb-1.5">
        {label}
      </p>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function FacetMulti({
  label,
  selected,
  onToggle,
  options,
}: {
  label: string;
  selected: string[];
  onToggle: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 mb-1.5">
        {label}{" "}
        {selected.length > 0 && (
          <span className="ml-1 text-slate-300 tabular-nums">
            · {selected.length}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              aria-pressed={active}
              className={cn(
                "px-2 py-1 text-[11px] rounded-full border transition",
                active
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  : "bg-white/[0.02] border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

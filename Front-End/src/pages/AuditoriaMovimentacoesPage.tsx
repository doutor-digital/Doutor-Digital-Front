import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  Calendar,
  Check,
  GitBranch,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import {
  stageHistoryAuditService,
  type StageTransitionItem,
} from "@/services/stageHistoryAudit";
import { kpiExclusionsService } from "@/services/kpiExclusions";
import { cn, formatDate, formatNumber } from "@/lib/utils";

type KpiFilter = "all" | "agendados" | "no_show" | "tratamentos";

const KPI_FILTERS: { value: KpiFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "agendados", label: "Agendados" },
  { value: "no_show", label: "No-show" },
  { value: "tratamentos", label: "Tratamentos" },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function dateTimeBR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function isoForDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // <input type="datetime-local"> espera YYYY-MM-DDTHH:mm em hora local.
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function AuditoriaMovimentacoesPage() {
  const { unitId } = useClinic();
  const qc = useQueryClient();

  const [dateFrom, setDateFrom] = useState(isoDaysAgo(30));
  const [dateTo, setDateTo] = useState(todayIso());
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>("all");
  const [leadName, setLeadName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");

  const audit = useQuery({
    queryKey: ["stage-history-audit", unitId, dateFrom, dateTo, kpiFilter, leadName],
    queryFn: () =>
      stageHistoryAuditService.audit({
        unitId: unitId!,
        dateFrom,
        dateTo,
        kpiKey: kpiFilter === "all" ? undefined : kpiFilter,
        leadName: leadName.trim() || undefined,
      }),
    enabled: unitId != null,
    placeholderData: (prev) => prev,
  });

  const items = audit.data?.items ?? [];
  const summary = useMemo(() => {
    const total = items.length;
    const corrected = items.filter((i) => i.corrected_changed_at).length;
    const excluded = items.filter((i) => i.excluded).length;
    return { total, corrected, excluded };
  }, [items]);

  const toggleExclude = useMutation({
    mutationFn: async (row: StageTransitionItem) => {
      if (!row.kpi_key) throw new Error("Esta etapa não está mapeada a um KPI.");
      if (row.excluded) {
        return kpiExclusionsService.remove({
          unitId: unitId!,
          kpiKey: row.kpi_key,
          leadId: row.lead_id,
        });
      }
      return kpiExclusionsService.add({
        unitId: unitId!,
        kpiKey: row.kpi_key,
        leadId: row.lead_id,
      });
    },
    onSuccess: (_data, row) => {
      toast.success(
        row.excluded ? "Lead voltou a contar no KPI." : "Lead marcado como 'não contar'.",
      );
      qc.invalidateQueries({ queryKey: ["stage-history-audit"] });
      qc.invalidateQueries({ queryKey: ["dash-amo"] });
    },
    onError: (e) => toast.error(`Falha ao atualizar exclusão: ${(e as Error).message}`),
  });

  const correctDate = useMutation({
    mutationFn: async (vars: { id: number; correctedAt: string; reason?: string }) =>
      stageHistoryAuditService.correctDate(vars),
    onSuccess: () => {
      toast.success("Data corrigida. KPI passa a contar no dia certo.");
      setEditingId(null);
      setEditValue("");
      setEditReason("");
      qc.invalidateQueries({ queryKey: ["stage-history-audit"] });
      qc.invalidateQueries({ queryKey: ["dash-amo"] });
    },
    onError: (e) => toast.error(`Falha ao corrigir data: ${(e as Error).message}`),
  });

  const resetCorrection = useMutation({
    mutationFn: async (id: number) => stageHistoryAuditService.resetCorrection(id),
    onSuccess: () => {
      toast.success("Correção removida. Vale a data original da Kommo.");
      qc.invalidateQueries({ queryKey: ["stage-history-audit"] });
      qc.invalidateQueries({ queryKey: ["dash-amo"] });
    },
    onError: (e) => toast.error(`Falha ao remover correção: ${(e as Error).message}`),
  });

  const startEdit = (row: StageTransitionItem) => {
    setEditingId(row.id);
    setEditValue(isoForDateInput(row.corrected_changed_at ?? row.original_changed_at));
    setEditReason(row.correction_reason ?? "");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
    setEditReason("");
  };
  const saveEdit = (id: number) => {
    if (!editValue) {
      toast.error("Informe a data corrigida.");
      return;
    }
    const iso = new Date(editValue).toISOString();
    correctDate.mutate({ id, correctedAt: iso, reason: editReason.trim() || undefined });
  };

  return (
    <>
      <PageHeader
        title="Auditoria de movimentações"
        description="Revise transições de etapa que a SDR pode ter feito no dia errado. Corrija a data pra contar no dia real, ou marque 'não contar' pra tirar do KPI."
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
              onClick={() => audit.refetch()}
              disabled={audit.isFetching || unitId == null}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", audit.isFetching && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        }
      />

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-[11px] text-slate-300">
          De
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-[13px] text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-300">
          Até
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-[13px] text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-300">
          KPI
          <select
            value={kpiFilter}
            onChange={(e) => setKpiFilter(e.target.value as KpiFilter)}
            className="rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-[13px] text-slate-100"
          >
            {KPI_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-300">
          Lead
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              placeholder="busca por nome…"
              className="w-full rounded-md border border-white/10 bg-slate-950 py-1.5 pl-7 pr-2 text-[13px] text-slate-100"
            />
          </div>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[11.5px] text-slate-300">
        <span className="rounded-full bg-white/[0.04] px-3 py-1 ring-1 ring-white/[0.06]">
          {formatNumber(summary.total)} transições
        </span>
        {summary.corrected > 0 && (
          <span className="rounded-full bg-sky-400/[0.1] px-3 py-1 text-sky-200 ring-1 ring-sky-400/20">
            {summary.corrected} com data corrigida
          </span>
        )}
        {summary.excluded > 0 && (
          <span className="rounded-full bg-red-400/[0.08] px-3 py-1 text-red-200 ring-1 ring-red-400/20">
            {summary.excluded} marcadas "não contar"
          </span>
        )}
        {audit.data?.truncated && (
          <span className="rounded-full bg-amber-400/[0.1] px-3 py-1 text-amber-100 ring-1 ring-amber-400/20">
            mostrando os primeiros 500
          </span>
        )}
      </div>

      <Card className="mt-4">
        <CardBody className="p-0">
          {unitId == null ? (
            <EmptyState
              icon={<GitBranch className="h-8 w-8" />}
              title="Selecione uma unidade"
              description="Escolha a unidade no topo pra ver as transições."
            />
          ) : audit.isLoading ? (
            <div className="grid h-40 place-items-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<GitBranch className="h-8 w-8" />}
              title="Nenhuma transição no período"
              description="Ajuste o filtro de data ou KPI."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Lead</th>
                    <th className="px-4 py-2 text-left">Etapa</th>
                    <th className="px-4 py-2 text-left">Original (Kommo)</th>
                    <th className="px-4 py-2 text-left">Efetiva (no KPI)</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {items.map((row) => {
                    const isEditing = editingId === row.id;
                    const isCorrected = !!row.corrected_changed_at;
                    return (
                      <tr key={row.id} className={cn(row.excluded && "opacity-50")}>
                        <td className="px-4 py-2 align-top">
                          <Link
                            to={`/leads/${row.lead_id}`}
                            className="font-medium text-slate-100 hover:text-emerald-300"
                          >
                            {row.lead_name || "(sem nome)"}
                          </Link>
                          {row.kpi_key && (
                            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                              KPI: {row.kpi_key}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 align-top">
                          <Badge tone="slate">{row.stage_label}</Badge>
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            via {row.entry_source}
                          </div>
                        </td>
                        <td className="px-4 py-2 align-top text-slate-300">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {dateTimeBR(row.original_changed_at)}
                          </span>
                        </td>
                        <td className="px-4 py-2 align-top">
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <input
                                type="datetime-local"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-[12px] text-slate-100"
                              />
                              <input
                                type="text"
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                                placeholder="motivo (opcional)"
                                className="rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-[11px] text-slate-100"
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span
                                className={cn(
                                  "flex items-center gap-1",
                                  isCorrected ? "text-sky-200" : "text-slate-300",
                                )}
                              >
                                <Calendar className="h-3 w-3" />
                                {dateTimeBR(row.effective_changed_at)}
                              </span>
                              {isCorrected && (
                                <span className="mt-0.5 text-[10px] text-sky-300/80">
                                  corrigida por {row.corrected_by_email}
                                  {row.correction_reason ? ` · ${row.correction_reason}` : ""}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 align-top">
                          <div className="flex justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => saveEdit(row.id)}
                                  disabled={correctDate.isPending}
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-400/[0.1] px-2 py-0.5 text-[10.5px] font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-400/20 disabled:opacity-50"
                                >
                                  <Check className="h-3 w-3" /> Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-slate-300 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.08]"
                                >
                                  <X className="h-3 w-3" /> Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEdit(row)}
                                  title="Editar a data efetiva da transição"
                                  className="inline-flex items-center gap-1 rounded-full bg-sky-400/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-sky-200 ring-1 ring-inset ring-sky-400/25 hover:bg-sky-400/20"
                                >
                                  <Pencil className="h-3 w-3" />
                                  {isCorrected ? "Editar" : "Corrigir data"}
                                </button>
                                {isCorrected && (
                                  <button
                                    type="button"
                                    onClick={() => resetCorrection.mutate(row.id)}
                                    disabled={resetCorrection.isPending}
                                    title="Volta pra data original"
                                    className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-slate-300 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.08] disabled:opacity-50"
                                  >
                                    <RotateCcw className="h-3 w-3" /> Reset
                                  </button>
                                )}
                                {row.kpi_key && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExclude.mutate(row)}
                                    disabled={toggleExclude.isPending}
                                    title={
                                      row.excluded
                                        ? "Voltar a contar no KPI"
                                        : "Marcar como 'não contar' neste KPI"
                                    }
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 ring-inset disabled:opacity-50",
                                      row.excluded
                                        ? "bg-emerald-400/[0.1] text-emerald-200 ring-emerald-400/30 hover:bg-emerald-400/20"
                                        : "bg-red-400/[0.08] text-red-300/90 ring-red-400/25 hover:bg-red-400/20",
                                    )}
                                  >
                                    <Ban className="h-3 w-3" />
                                    {row.excluded ? "Voltar" : "Não contar"}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <p className="mt-3 text-[11px] text-slate-500">
        Dica: corrigir a data faz a transição contar no dia certo no dashboard.{" "}
        <span className="text-slate-400">{formatDate(new Date().toISOString())}</span>
      </p>
    </>
  );
}

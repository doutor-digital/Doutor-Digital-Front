import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Calendar,
  Check,
  CreditCard,
  Loader2,
  Pencil,
  Phone as PhoneIcon,
  Tag,
  Users,
  X,
} from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import {
  kpiConfigService,
  type KpiLeadItem,
  type KpiSourceConfig,
  type KpiSourceType,
} from "@/services/kpiConfig";
import { kpiExclusionsService } from "@/services/kpiExclusions";
import { stageHistoryAuditService } from "@/services/stageHistoryAudit";
import { useStageNames } from "@/hooks/useStageNames";
import { useAuth } from "@/hooks/useAuth";
import { isAdminLevel } from "@/lib/roles";
import { formatDate, formatNumber } from "@/lib/utils";

// KPIs que suportam exclusão manual via kpi_exclusions (admin marca "não contar").
const EXCLUDABLE_KPIS = new Set<string>(["agendados", "tratamentos"]);
// KPIs que suportam edição inline da data da transição (PATCH stage-history corrected-date).
// Só faz sentido para fontes KommoStage (history_id volta populado no DTO).
const DATE_EDITABLE_KPIS = new Set<string>(["agendados", "tratamentos"]);

function isoForDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

const moneyBR = (v?: number | null) =>
  v == null ? null : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const dateTimeBR = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const leadTypeLabel = (t?: string | null) => {
  if (!t) return null;
  const v = t.toLowerCase();
  if (v.includes("resgate")) return "Resgate";
  if (v.includes("cadastro") || v.includes("novo")) return "Cadastro";
  return t;
};

const isCadastroLead = (l: KpiLeadItem) => {
  const t = (l.lead_type || "").toLowerCase();
  return !t || t.includes("cadastro") || t.includes("novo");
};
const isResgateLead = (l: KpiLeadItem) => (l.lead_type || "").toLowerCase().includes("resgate");

/** Linhas de detalhe por KPI — chips embaixo do card do lead. */
function detailChipsFor(kpiKey: string, l: KpiLeadItem): Array<{ key: string; label: string; tone?: "ok" | "warn" | "neutral" }> {
  const out: Array<{ key: string; label: string; tone?: "ok" | "warn" | "neutral" }> = [];
  const origem = l.origem_custom || l.source;
  const tipo = leadTypeLabel(l.lead_type);
  const ag = dateTimeBR(l.appointment_at);
  const motivo = l.motivo_nao_agendamento;
  const fisio = l.responsavel_agendamento;
  const trat = l.tratamento_fechado;
  const vConsulta = moneyBR(l.consultation_value);

  switch (kpiKey) {
    case "cadastro":
      if (origem) out.push({ key: "origem", label: `Origem: ${origem}` });
      if (motivo) out.push({ key: "motivo", label: `Sem agendar: ${motivo}`, tone: "warn" });
      break;
    case "resgate":
      if (tipo) out.push({ key: "tipo", label: tipo });
      if (origem) out.push({ key: "origem", label: `Origem: ${origem}` });
      break;
    case "agendados":
      if (tipo) out.push({ key: "tipo", label: tipo });
      if (origem) out.push({ key: "origem", label: `Origem: ${origem}` });
      out.push({
        key: "pago",
        label: l.has_payment ? "Pagamento antecipado" : "Sem pagamento antecipado",
        tone: l.has_payment ? "ok" : "neutral",
      });
      break;
    case "tratamentos": {
      const vTrat = moneyBR(l.treatment_value);
      if (origem) out.push({ key: "origem", label: `Origem: ${origem}` });
      if (fisio) out.push({ key: "fisio", label: `Fechou: ${fisio}`, tone: "ok" });
      if (trat) out.push({ key: "trat", label: `Tratamento: ${trat}` });
      if (vConsulta) out.push({ key: "vc", label: `Consulta: ${vConsulta}`, tone: "ok" });
      if (vTrat) out.push({ key: "vt", label: `Tratamento: ${vTrat}`, tone: "ok" });
      break;
    }
    case "consultas":
      if (tipo) out.push({ key: "tipo", label: tipo });
      if (ag) out.push({ key: "ag", label: `Agendado: ${ag}` });
      if (vConsulta) out.push({ key: "valor", label: `Valor: ${vConsulta}`, tone: "ok" });
      break;
    default:
      if (origem) out.push({ key: "origem", label: origem });
      break;
  }
  return out;
}

type Pair = { label: string; count: number };
const sortDesc = (a: Pair, b: Pair) => b.count - a.count;

/** Resumo agregado, calculado dos itens da lista. */
function DrillSummary({ kpiKey, items }: { kpiKey: string; items: KpiLeadItem[] }) {
  if (!items.length) return null;

  const originOf = (l: KpiLeadItem) => l.origem_custom || l.source || "—";

  // ── Cadastro: origem × top motivo de não agendamento ───────────────
  if (kpiKey === "cadastro") {
    const byOrigem = new Map<string, { total: number; motivos: Map<string, number> }>();
    for (const l of items) {
      const o = originOf(l);
      const row = byOrigem.get(o) ?? { total: 0, motivos: new Map() };
      row.total++;
      const m = l.motivo_nao_agendamento?.trim();
      if (m) row.motivos.set(m, (row.motivos.get(m) ?? 0) + 1);
      byOrigem.set(o, row);
    }
    const rows = Array.from(byOrigem.entries())
      .map(([origem, v]) => {
        const topMotivo = Array.from(v.motivos.entries()).sort((a, b) => b[1] - a[1])[0];
        return { origem, total: v.total, motivo: topMotivo?.[0] ?? null, motivoCount: topMotivo?.[1] ?? 0 };
      })
      .sort((a, b) => b.total - a.total);

    return (
      <SummaryShell title="Cadastros por origem">
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.origem} className="flex items-start justify-between gap-3 text-[12px]">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-100">{r.origem}</p>
                {r.motivo && (
                  <p className="truncate text-[10.5px] text-amber-200/80">
                    Sem agendar: {r.motivo} ({r.motivoCount})
                  </p>
                )}
              </div>
              <span className="shrink-0 tabular-nums text-slate-200">{r.total}</span>
            </li>
          ))}
        </ul>
      </SummaryShell>
    );
  }

  // ── Resgate: tipo + origens ────────────────────────────────────────
  if (kpiKey === "resgate") {
    const tipos = new Map<string, number>();
    const origens = new Map<string, number>();
    for (const l of items) {
      tipos.set(l.lead_type || "resgate", (tipos.get(l.lead_type || "resgate") ?? 0) + 1);
      origens.set(originOf(l), (origens.get(originOf(l)) ?? 0) + 1);
    }
    return (
      <SummaryShell title={`${items.length} resgates`}>
        <BreakdownRow label="Tipo" pairs={mapPairs(tipos)} />
        <BreakdownRow label="Origem" pairs={mapPairs(origens)} />
      </SummaryShell>
    );
  }

  // ── Agendados: tipo + origens + pagamento ──────────────────────────
  if (kpiKey === "agendados") {
    let cadastro = 0, resgate = 0, pago = 0, semPag = 0;
    const origens = new Map<string, number>();
    for (const l of items) {
      if (isResgateLead(l)) resgate++; else if (isCadastroLead(l)) cadastro++;
      if (l.has_payment) pago++; else semPag++;
      origens.set(originOf(l), (origens.get(originOf(l)) ?? 0) + 1);
    }
    return (
      <SummaryShell title={`${items.length} agendamentos`}>
        <BreakdownRow label="Tipo" pairs={[
          { label: "Cadastro", count: cadastro },
          { label: "Resgate", count: resgate },
        ].filter((p) => p.count > 0)} />
        <BreakdownRow label="Pagamento" pairs={[
          { label: "Antecipado", count: pago },
          { label: "Sem antecipado", count: semPag },
        ].filter((p) => p.count > 0)} />
        <BreakdownRow label="Origem" pairs={mapPairs(origens)} />
      </SummaryShell>
    );
  }

  // ── Tratamentos: origem + fisio + valores ──────────────────────────
  if (kpiKey === "tratamentos") {
    const origens = new Map<string, number>();
    const fisios = new Map<string, number>();
    let totalConsulta = 0, totalTratamento = 0;
    for (const l of items) {
      origens.set(originOf(l), (origens.get(originOf(l)) ?? 0) + 1);
      const f = l.responsavel_agendamento?.trim();
      if (f) fisios.set(f, (fisios.get(f) ?? 0) + 1);
      if (l.consultation_value) totalConsulta += l.consultation_value;
      if (l.treatment_value) totalTratamento += l.treatment_value;
    }
    return (
      <SummaryShell title={`${items.length} tratamentos`}>
        <BreakdownRow label="Origem" pairs={mapPairs(origens)} />
        {fisios.size > 0 && <BreakdownRow label="Fechou" pairs={mapPairs(fisios)} />}
        {(totalConsulta > 0 || totalTratamento > 0) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {totalConsulta > 0 && (
              <span className="rounded-full bg-emerald-400/[0.1] px-2.5 py-1 text-[11px] text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
                Consulta: {moneyBR(totalConsulta)}
              </span>
            )}
            {totalTratamento > 0 && (
              <span className="rounded-full bg-emerald-400/[0.1] px-2.5 py-1 text-[11px] text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
                Tratamento: {moneyBR(totalTratamento)}
              </span>
            )}
          </div>
        )}
      </SummaryShell>
    );
  }

  // ── Consultas: tipo + valor total ──────────────────────────────────
  if (kpiKey === "consultas") {
    let cadastro = 0, resgate = 0, totalValor = 0;
    for (const l of items) {
      if (isResgateLead(l)) resgate++; else if (isCadastroLead(l)) cadastro++;
      if (l.consultation_value) totalValor += l.consultation_value;
    }
    return (
      <SummaryShell title={`${items.length} consultas`}>
        <BreakdownRow label="Tipo" pairs={[
          { label: "Cadastro", count: cadastro },
          { label: "Resgate", count: resgate },
        ].filter((p) => p.count > 0)} />
        {totalValor > 0 && (
          <div className="pt-1">
            <span className="rounded-full bg-emerald-400/[0.1] px-2.5 py-1 text-[11px] text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
              Valor total: {moneyBR(totalValor)}
            </span>
          </div>
        )}
      </SummaryShell>
    );
  }

  return null;
}

function SummaryShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300/80">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function BreakdownRow({ label, pairs }: { label: string; pairs: Pair[] }) {
  if (pairs.length === 0) return null;
  return (
    <div className="flex items-start gap-2 text-[11.5px]">
      <span className="mt-0.5 w-16 shrink-0 text-[10px] font-medium uppercase tracking-wide text-white/50">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {pairs.slice(0, 6).map((p) => (
          <span key={p.label} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-slate-200 ring-1 ring-inset ring-white/[0.06]">
            {p.label} · <span className="tabular-nums text-white">{p.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function mapPairs(m: Map<string, number>): Pair[] {
  return Array.from(m.entries()).map(([label, count]) => ({ label, count })).sort(sortDesc);
}

export interface KpiDrillTarget {
  kpiKey: string;
  label: string;
  /** Fonte inline opcional — usada p/ drill-down arbitrário (ex.: valor de campo). */
  source?: { source_type: KpiSourceType; config: KpiSourceConfig };
}

/**
 * Drawer lateral que mostra QUEM são os leads por trás de um KPI do dashboard.
 * Clica no card → abre aqui a lista (nome, telefone, etapa, origem, data), cada um
 * com link para o detalhe do lead.
 */
export function KpiDrillDown({
  target,
  unitId,
  dateFrom,
  dateTo,
  onClose,
}: {
  target: KpiDrillTarget | null;
  unitId: number | null;
  dateFrom?: string;
  dateTo?: string;
  onClose: () => void;
}) {
  const open = target != null;

  const leads = useQuery({
    queryKey: ["kpi-drill", unitId, target?.kpiKey, target?.source, dateFrom, dateTo],
    queryFn: () =>
      kpiConfigService.drillLeads(unitId, {
        kpi_key: target!.kpiKey,
        source_type: target!.source?.source_type,
        config: target!.source?.config,
        date_from: dateFrom,
        date_to: dateTo,
      }),
    enabled: open,
  });

  const { resolve: resolveStage } = useStageNames(unitId);

  // Fecha no ESC.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Exclusão admin ("não contar"): SDR não vê o botão.
  const { user } = useAuth();
  const isAdmin = isAdminLevel(user?.role);
  const qc = useQueryClient();
  const canExclude = isAdmin && unitId != null && target?.kpiKey != null && EXCLUDABLE_KPIS.has(target!.kpiKey);
  const canEditDate = isAdmin && unitId != null && target?.kpiKey != null && DATE_EDITABLE_KPIS.has(target!.kpiKey);

  // Editor inline de data da transição (PATCH /api/admin/stage-history/{id}/corrected-date).
  // editingHistoryId guarda o id da transição que está aberta pra edição.
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");

  const toggle = useMutation({
    mutationFn: async (vars: { leadId: number; nowExcluded: boolean }) => {
      if (vars.nowExcluded) {
        return kpiExclusionsService.remove({ unitId: unitId!, kpiKey: target!.kpiKey, leadId: vars.leadId });
      }
      return kpiExclusionsService.add({ unitId: unitId!, kpiKey: target!.kpiKey, leadId: vars.leadId });
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.nowExcluded ? "Lead voltou a contar no KPI." : "Lead marcado como 'não contar'.");
      qc.invalidateQueries({ queryKey: ["kpi-drill"] });
      qc.invalidateQueries({ queryKey: ["dash-amo"] });
    },
    onError: (e) => toast.error(`Falha ao atualizar exclusão: ${(e as Error).message}`),
  });

  const correctDate = useMutation({
    mutationFn: async (vars: { id: number; correctedAt: string; reason?: string }) =>
      stageHistoryAuditService.correctDate(vars),
    onSuccess: () => {
      toast.success("Data corrigida. KPI passa a contar no dia certo.");
      setEditingHistoryId(null);
      setEditValue("");
      setEditReason("");
      qc.invalidateQueries({ queryKey: ["kpi-drill"] });
      qc.invalidateQueries({ queryKey: ["dash-amo"] });
    },
    onError: (e) => toast.error(`Falha ao corrigir data: ${(e as Error).message}`),
  });

  const startEditDate = (item: KpiLeadItem) => {
    if (item.history_id == null) return;
    setEditingHistoryId(item.history_id);
    setEditValue(isoForDateInput(item.effective_changed_at ?? item.created_at));
    setEditReason("");
  };
  const cancelEditDate = () => {
    setEditingHistoryId(null);
    setEditValue("");
    setEditReason("");
  };
  const saveEditDate = (historyId: number) => {
    if (!editValue) {
      toast.error("Informe a data corrigida.");
      return;
    }
    const iso = new Date(editValue).toISOString();
    correctDate.mutate({ id: historyId, correctedAt: iso, reason: editReason.trim() || undefined });
  };

  if (!open) return null;

  const data = leads.data;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* painel */}
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0a0a0d] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/90">
              Leads do KPI
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-50">{target!.label}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-400">
              <Users className="h-3.5 w-3.5" />
              {leads.isLoading
                ? "carregando…"
                : `${formatNumber(data?.total ?? 0)} lead${(data?.total ?? 0) === 1 ? "" : "s"}`}
              {data?.truncated && <span className="text-amber-300">· mostrando os primeiros 500</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {leads.isLoading ? (
            <div className="grid h-40 place-items-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : data?.note ? (
            <div className="m-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-4 text-[12.5px] text-amber-100">
              {data.note}
            </div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="grid h-40 place-items-center text-[12.5px] text-slate-500">
              Nenhum lead neste KPI no período.
            </div>
          ) : (
            <>
            <DrillSummary kpiKey={target!.kpiKey} items={data!.items} />
            <ul className="space-y-1.5">
              {data!.items.map((l) => {
                const isEditingDate = editingHistoryId != null && l.history_id === editingHistoryId;
                const hasHistory = l.history_id != null;
                return (
                <li key={l.id} className={l.excluded ? "opacity-50" : ""}>
                  <div className="group flex flex-col gap-1 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 transition hover:border-white/[0.12] hover:bg-white/[0.04]">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/leads/${l.id}`}
                        className={`truncate text-[13px] font-medium text-slate-100 hover:text-emerald-300 ${l.excluded ? "line-through decoration-red-400/60" : ""}`}
                      >
                        {l.name || "(sem nome)"}
                      </Link>
                      <div className="flex shrink-0 items-center gap-2">
                        {canEditDate && hasHistory && !isEditingDate && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              startEditDate(l);
                            }}
                            title="Corrigir a data efetiva desta transição no KPI"
                            className="inline-flex items-center gap-1 rounded-full bg-sky-400/[0.08] px-2 py-0.5 text-[9.5px] font-medium text-sky-200 ring-1 ring-inset ring-sky-400/25 transition hover:bg-sky-400/20"
                          >
                            <Pencil className="h-2.5 w-2.5" /> corrigir data
                          </button>
                        )}
                        {canExclude && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggle.mutate({ leadId: l.id, nowExcluded: !!l.excluded });
                            }}
                            disabled={toggle.isPending}
                            title={l.excluded ? "Voltar a contar este lead no KPI" : "Marcar como 'não contar' neste KPI (SDR errou)"}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-medium ring-1 ring-inset transition disabled:opacity-50 ${
                              l.excluded
                                ? "bg-emerald-400/[0.1] text-emerald-200 ring-emerald-400/30 hover:bg-emerald-400/20"
                                : "bg-red-400/[0.08] text-red-300/90 ring-red-400/25 hover:bg-red-400/20"
                            }`}
                          >
                            {l.excluded ? "↺ voltar" : "🚫 não contar"}
                          </button>
                        )}
                        <Link to={`/leads/${l.id}`}>
                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-600 transition hover:text-emerald-300" />
                        </Link>
                      </div>
                    </div>

                    {isEditingDate && (
                      <div className="mt-1 flex flex-col gap-1.5 rounded-md border border-sky-400/20 bg-sky-400/[0.05] p-2">
                        <p className="text-[10px] text-sky-200/80">
                          Data efetiva (quando o tratamento aconteceu de verdade):
                        </p>
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
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveEditDate(editingHistoryId!)}
                            disabled={correctDate.isPending}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-400/[0.1] px-2 py-0.5 text-[10.5px] font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/30 hover:bg-emerald-400/20 disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" /> Salvar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditDate}
                            className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-slate-300 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.08]"
                          >
                            <X className="h-3 w-3" /> Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      {l.phone && (
                        <span className="flex items-center gap-1">
                          <PhoneIcon className="h-3 w-3" /> {l.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(l.created_at)}
                      </span>
                      {l.has_payment && (
                        <span className="flex items-center gap-1 text-emerald-300">
                          <CreditCard className="h-3 w-3" /> pago
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <Badge tone="slate">
                        {resolveStage(l.current_stage, l.current_stage_id)}
                      </Badge>
                      {detailChipsFor(target!.kpiKey, l).map((c) => {
                        const cls =
                          c.tone === "ok"
                            ? "bg-emerald-400/[0.1] text-emerald-200 ring-emerald-400/20"
                            : c.tone === "warn"
                              ? "bg-amber-400/[0.1] text-amber-100 ring-amber-400/20"
                              : "bg-white/[0.04] text-slate-300 ring-white/[0.06]";
                        return (
                          <span
                            key={c.key}
                            className={`rounded-full px-2 py-0.5 text-[10px] tracking-wide ring-1 ring-inset ${cls}`}
                          >
                            {c.label}
                          </span>
                        );
                      })}
                      {l.matched_value && (
                        <span className="flex items-center gap-1 rounded-full bg-cyan-400/[0.1] px-2 py-0.5 text-[10px] text-cyan-200 ring-1 ring-inset ring-cyan-400/20">
                          <Tag className="h-2.5 w-2.5" /> {l.matched_value}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

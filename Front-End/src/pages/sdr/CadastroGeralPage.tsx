import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  LayoutGrid,
  ListChecks,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  TableProperties,
  Tag,
  Target,
  TrendingUp,
  UserCog,
  Users,
  XCircle,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CloudiaCell,
  CloudiaColumnHeader,
  CloudiaLegendBanner,
} from "@/components/sdr/CloudiaField";
import { SyncFilterSheet } from "@/components/sdr/SyncFilterSheet";
import { mergeSdrLeadsFromBackend, useSdrStore, useIsClient } from "@/lib/sdr/sdr-store";
import { sdrLeadFromBackend, sdrService, type SdrSyncFilters } from "@/services/sdr";
import { useClinic } from "@/hooks/useClinic";
import type { SdrLead, SdrCloudiaFieldKey } from "@/types/sdr";
import { cn, formatDate, formatNumber } from "@/lib/utils";

type FilterTipo = "todos" | "Cadastro" | "Resgate";
type FilterOrigem = "todas" | "cloudia" | "manual";
type ViewMode = "cards" | "tabela";

export default function CadastroGeralPage() {
  const ready = useIsClient();
  const navigate = useNavigate();
  const { leads } = useSdrStore();
  const { unitId: contextUnitId } = useClinic();
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<FilterTipo>("todos");
  const [filterOrigem, setFilterOrigem] = useState<FilterOrigem>("todas");
  const [view, setView] = useState<ViewMode>("cards");
  const [syncing, setSyncing] = useState(false);
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState<{
    unitId?: number;
    from?: string;
    to?: string;
    shiftStart?: string;
    shiftEnd?: string;
  } | null>(null);

  const handleSyncWithFilters = async (filters: SdrSyncFilters) => {
    if (syncing) return;
    setSyncing(true);
    const desc =
      `Unidade ${filters.unitId} · ` +
      (filters.shift === "morning"
        ? "08:00–12:00"
        : filters.shift === "overnight"
          ? "20:00–07:50"
          : filters.shift === "custom"
            ? `${filters.timeStart}–${filters.timeEnd}`
            : "todo o dia");
    const t = toast.loading(`Sincronizando Cloudia · ${desc}…`);
    try {
      const summary = await sdrService.syncFromCloudia(filters);
      const localLeads = summary.items.map(sdrLeadFromBackend);
      const added = mergeSdrLeadsFromBackend(localLeads);
      setLastSyncInfo({
        unitId: summary.unitId,
        from: summary.from,
        to: summary.to,
        shiftStart: summary.shiftStart,
        shiftEnd: summary.shiftEnd,
      });
      if (summary.created === 0) toast.info("Nenhum lead nessa janela.", { id: t });
      else
        toast.success(
          `${summary.created} lead(s) na janela · ${added} novo(s) na revisão.`,
          { id: t },
        );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = e?.response?.data?.message ?? e?.message ?? "Erro desconhecido";
      toast.error(`Falha na sincronização: ${msg}`, { id: t });
    } finally {
      setSyncing(false);
    }
  };

  // Esta página é a etapa de REVISÃO: só mostra leads pendentes.
  const pendingLeads = useMemo(
    () => leads.filter((l) => l.status === "pendente_revisao"),
    [leads],
  );

  const filtered = useMemo(() => {
    let r = pendingLeads;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (l) =>
          l.nome.toLowerCase().includes(q) ||
          l.telefone.toLowerCase().includes(q) ||
          (l.observacao ?? "").toLowerCase().includes(q),
      );
    }
    if (filterTipo !== "todos") r = r.filter((l) => l.tipo === filterTipo);
    if (filterOrigem === "cloudia") r = r.filter((l) => l.cloudiaFields.length > 0);
    if (filterOrigem === "manual") r = r.filter((l) => l.cloudiaFields.length === 0);
    return r;
  }, [pendingLeads, search, filterTipo, filterOrigem]);

  // KPIs do topo (sempre baseados no universo de leads pendentes, não nos filtrados)
  const totalCloudia = pendingLeads.filter((l) => l.cloudiaFields.length > 0).length;
  const totalManual = pendingLeads.length - totalCloudia;
  const totalResgate = pendingLeads.filter((l) => l.tipo === "Resgate").length;
  const totalCadastro = pendingLeads.filter((l) => l.tipo === "Cadastro").length;
  const totalAgendou = pendingLeads.filter((l) => l.agendouConsulta).length;
  const totalRevisados = leads.length - pendingLeads.length;

  return (
    <div className="space-y-5">
      <PageHeader
        badge="Seção 1 · Cadastro Geral · Revisão pendente"
        title="Revisar leads"
        description="Cada cartão é um lead que chegou na sua unidade. Clique em Revisar para conferir, completar e aprovar."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSyncSheetOpen(true)}
              disabled={syncing}
              title="Escolha unidade, intervalo de datas e turno antes de sincronizar"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                syncing
                  ? "cursor-not-allowed border-white/[0.08] bg-white/[0.02] text-slate-500"
                  : "border-emerald-400/30 bg-emerald-400/15 text-emerald-200 hover:border-emerald-400/50 hover:bg-emerald-400/25",
              )}
            >
              {syncing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sincronizando…
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sincronizar Cloudia…
                </>
              )}
            </button>
          </div>
        }
      />

      {/* ── KPIs ricos no topo ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi
          tone="amber"
          icon={<Clock className="h-4 w-4" />}
          label="Pendentes"
          value={formatNumber(pendingLeads.length)}
          hint="Aguardando revisão"
        />
        <Kpi
          tone="emerald"
          icon={<Sparkles className="h-4 w-4" />}
          label="Via Cloudia"
          value={formatNumber(totalCloudia)}
          hint={`${pct(totalCloudia, pendingLeads.length)}% automáticos`}
        />
        <Kpi
          tone="slate"
          icon={<UserCog className="h-4 w-4" />}
          label="Manuais"
          value={formatNumber(totalManual)}
          hint="Cadastrados pela equipe"
        />
        <Kpi
          tone="sky"
          icon={<Users className="h-4 w-4" />}
          label="Cadastros"
          value={formatNumber(totalCadastro)}
          hint={`${pct(totalCadastro, pendingLeads.length)}%`}
        />
        <Kpi
          tone="violet"
          icon={<TrendingUp className="h-4 w-4" />}
          label="Resgates"
          value={formatNumber(totalResgate)}
          hint={`${pct(totalResgate, pendingLeads.length)}%`}
        />
        <Kpi
          tone="cyan"
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Agendaram"
          value={formatNumber(totalAgendou)}
          hint={`${pct(totalAgendou, pendingLeads.length)}% do pendente`}
        />
      </div>

      <CloudiaLegendBanner />

      {lastSyncInfo && (
        <div className="rounded-md border border-emerald-400/20 bg-emerald-400/[0.04] px-4 py-2.5 text-[12px] text-emerald-100">
          <span className="font-semibold">Última sincronização: </span>
          Unidade <code className="rounded bg-white/[0.04] px-1 text-[11px]">{lastSyncInfo.unitId}</code>
          {" · "}
          {lastSyncInfo.from && new Date(lastSyncInfo.from).toLocaleString()} →{" "}
          {lastSyncInfo.to && new Date(lastSyncInfo.to).toLocaleString()}
          {lastSyncInfo.shiftStart && (
            <> · turno <code className="rounded bg-white/[0.04] px-1 text-[11px]">
              {lastSyncInfo.shiftStart}–{lastSyncInfo.shiftEnd}
            </code></>
          )}
        </div>
      )}

      {/* ── Toolbar: busca + filtros + view toggle ── */}
      <div className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, observação…"
            className="h-9 w-full rounded-md border border-white/[0.06] bg-white/[0.02] pl-8 pr-3 text-[12px] text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/30 focus:outline-none"
          />
        </div>
        <FilterChips
          label="Tipo"
          options={[
            { value: "todos", label: "Todos" },
            { value: "Cadastro", label: "Cadastro" },
            { value: "Resgate", label: "Resgate" },
          ]}
          value={filterTipo}
          onChange={(v) => setFilterTipo(v as FilterTipo)}
        />
        <FilterChips
          label="Origem"
          options={[
            { value: "todas", label: "Todas" },
            { value: "cloudia", label: "Auto · Cloudia" },
            { value: "manual", label: "Manual" },
          ]}
          value={filterOrigem}
          onChange={(v) => setFilterOrigem(v as FilterOrigem)}
        />

        <div className="ml-auto inline-flex items-center gap-0.5 rounded-md border border-white/[0.06] bg-white/[0.02] p-0.5">
          <ViewToggleBtn
            active={view === "cards"}
            onClick={() => setView("cards")}
            icon={<LayoutGrid className="h-3.5 w-3.5" />}
            label="Cards"
          />
          <ViewToggleBtn
            active={view === "tabela"}
            onClick={() => setView("tabela")}
            icon={<TableProperties className="h-3.5 w-3.5" />}
            label="Tabela"
          />
        </div>
      </div>

      {/* ── Conteúdo: cards (default) ou tabela ── */}
      {!ready ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] px-6 py-16 text-center">
          <ListChecks className="mx-auto h-8 w-8 text-slate-600" />
          <h3 className="mt-3 text-[13px] font-semibold text-slate-200">
            Nenhum lead encontrado
          </h3>
          <p className="mt-1 text-[11.5px] text-slate-500">
            Ajuste os filtros ou sincronize com o Cloudia.
          </p>
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onReview={() => navigate(`/sdr/cadastro-geral/${lead.id}`)}
            />
          ))}
        </div>
      ) : (
        <TableView leads={filtered} />
      )}

      <div className="rounded-md border border-white/[0.06] bg-white/[0.015] px-4 py-2.5 text-[11px] text-slate-500">
        Mostrando {formatNumber(filtered.length)} de {formatNumber(pendingLeads.length)} pendentes ·{" "}
        {formatNumber(totalRevisados)} já revisados em{" "}
        <Link to="/sdr/leads-aprovados" className="text-emerald-300 hover:underline">
          Leads Aprovados
        </Link>
      </div>

      <SyncFilterSheet
        open={syncSheetOpen}
        onClose={() => setSyncSheetOpen(false)}
        onSubmit={handleSyncWithFilters}
        defaultUnitId={contextUnitId ?? undefined}
      />
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

// ─── KPI tone palette ───────────────────────────────────────────────────────

type Tone = "emerald" | "amber" | "sky" | "violet" | "cyan" | "slate" | "rose";

const TONE_BG: Record<Tone, string> = {
  emerald: "bg-emerald-500/[0.04]",
  amber: "bg-amber-500/[0.04]",
  sky: "bg-sky-500/[0.04]",
  violet: "bg-violet-500/[0.04]",
  cyan: "bg-cyan-500/[0.04]",
  slate: "bg-white/[0.02]",
  rose: "bg-rose-500/[0.04]",
};
const TONE_ICON: Record<Tone, string> = {
  emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  sky: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  violet: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  cyan: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
  slate: "bg-white/[0.06] text-slate-300 ring-white/[0.08]",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

function Kpi({
  tone,
  icon,
  label,
  value,
  hint,
}: {
  tone: Tone;
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] p-3.5 transition hover:border-white/[0.12]",
        TONE_BG[tone],
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md ring-1 ring-inset",
            TONE_ICON[tone],
          )}
        >
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {label}
        </span>
      </div>
      <p className="mt-2 text-[24px] font-bold leading-none tabular-nums text-slate-50">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[10.5px] text-slate-500">{hint}</p>}
    </div>
  );
}

// ─── View toggle button ─────────────────────────────────────────────────────

function ViewToggleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11.5px] font-medium transition-colors",
        active
          ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/30"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Card (visualização principal) ──────────────────────────────────────────

function LeadCard({ lead, onReview }: { lead: SdrLead; onReview: () => void }) {
  const isFromCloudia = (k: SdrCloudiaFieldKey): "cloudia" | "manual" =>
    lead.cloudiaFields.includes(k) ? "cloudia" : "manual";
  const isResgate = lead.tipo === "Resgate";

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-xl border bg-white/[0.015] p-4 transition",
        "border-white/[0.06] hover:border-emerald-400/30 hover:bg-white/[0.025]",
        "hover:shadow-[0_8px_28px_-12px_rgba(16,185,129,0.18)]",
      )}
    >
      {/* Ribbon de tipo */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1 ring-inset",
            isResgate
              ? "bg-amber-400/10 text-amber-200 ring-amber-400/25"
              : "bg-sky-400/10 text-sky-200 ring-sky-400/25",
          )}
        >
          {isResgate ? <TrendingUp className="h-3 w-3" /> : <Users className="h-3 w-3" />}
          {lead.tipo}
          {isResgate && lead.tipoResgate && <span className="text-slate-400">· {lead.tipoResgate}</span>}
        </span>
        {lead.cloudiaProvenance && (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-emerald-300"
            title={`Recebido em ${formatDate(lead.cloudiaProvenance.receivedAt)}`}
          >
            <Sparkles className="h-2.5 w-2.5" />
            Cloudia
          </span>
        )}
      </div>

      {/* Identidade */}
      <CloudiaCell origin={isFromCloudia("nome")} className="!block">
        <h3 className="truncate text-[14.5px] font-semibold text-slate-50">{lead.nome}</h3>
      </CloudiaCell>

      <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-400">
        <Phone className="h-3 w-3 shrink-0 text-slate-500" />
        <CloudiaCell origin={isFromCloudia("telefone")}>
          <span className="font-mono tabular-nums">{lead.telefone}</span>
        </CloudiaCell>
      </div>

      {/* Linha de metadados */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-400">
        {lead.origem && (
          <span className="inline-flex items-center gap-1">
            <Target className="h-3 w-3 text-slate-500" />
            <CloudiaCell origin={isFromCloudia("origem")}>{lead.origem}</CloudiaCell>
          </span>
        )}
        {lead.clinica && (
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3 w-3 text-slate-500" />
            <CloudiaCell origin={isFromCloudia("clinica")}>{lead.clinica}</CloudiaCell>
          </span>
        )}
        {lead.nomeResponsavel && (
          <span className="inline-flex items-center gap-1">
            <UserCog className="h-3 w-3 text-slate-500" />
            <CloudiaCell origin={isFromCloudia("nomeResponsavel")}>
              {lead.nomeResponsavel}
            </CloudiaCell>
          </span>
        )}
      </div>

      {/* Status pills */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusPill
          ok={lead.interacao}
          okLabel="Interagiu"
          noLabel="Sem interação"
          cloudia={isFromCloudia("interacao") === "cloudia"}
        />
        <StatusPill
          ok={lead.agendouConsulta}
          okLabel="Agendou"
          noLabel="Não agendou"
        />
        {lead.dataAgendamento && (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.06]">
            <Calendar className="h-2.5 w-2.5 text-slate-500" />
            {formatDate(lead.dataAgendamento)}
          </span>
        )}
        {lead.situacao && (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] font-medium text-slate-300 ring-1 ring-inset ring-white/[0.06]">
            <Tag className="h-2.5 w-2.5 text-slate-500" />
            {lead.situacao}
          </span>
        )}
      </div>

      {/* Observação preview */}
      {lead.observacao && (
        <p className="mt-3 line-clamp-2 rounded-md bg-white/[0.025] px-2.5 py-1.5 text-[11px] italic text-slate-400">
          "{lead.observacao}"
        </p>
      )}

      {/* Footer com data e ação */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3">
        <span className="text-[10.5px] tabular-nums text-slate-500">
          Origem em {formatDate(lead.dataOrigem)}
        </span>
        <button
          type="button"
          onClick={onReview}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-400/20"
        >
          <Eye className="h-3 w-3" />
          Revisar
          <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
}

function StatusPill({
  ok,
  okLabel,
  noLabel,
  cloudia,
}: {
  ok: boolean;
  okLabel: string;
  noLabel: string;
  cloudia?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset",
        ok
          ? "bg-emerald-400/10 text-emerald-200 ring-emerald-400/25"
          : "bg-slate-500/10 text-slate-400 ring-slate-500/20",
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {ok ? okLabel : noLabel}
      {cloudia && <Sparkles className="h-2.5 w-2.5 text-emerald-300" />}
    </span>
  );
}

// ─── Tabela (visualização alternativa) ──────────────────────────────────────

function TableView({ leads }: { leads: SdrLead[] }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015]">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-white/[0.025] text-left">
            <tr>
              <Th><CloudiaColumnHeader label="Nome" origin="cloudia" /></Th>
              <Th><CloudiaColumnHeader label="Telefone" origin="cloudia" /></Th>
              <Th><CloudiaColumnHeader label="Tipo" origin="cloudia" /></Th>
              <Th><CloudiaColumnHeader label="Origem" origin="cloudia" /></Th>
              <Th><CloudiaColumnHeader label="Agendou" origin="manual" /></Th>
              <Th><CloudiaColumnHeader label="Responsável" origin="cloudia" /></Th>
              <Th><CloudiaColumnHeader label="Data origem" origin="cloudia" /></Th>
              <Th className="text-right pr-3"><span className="text-[11px] text-slate-500">Ação</span></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {leads.map((lead) => (
              <TableRow
                key={lead.id}
                lead={lead}
                onReview={() => navigate(`/sdr/cadastro-geral/${lead.id}`)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2.5 align-bottom font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5", className)}>{children}</td>;
}

function TableRow({ lead, onReview }: { lead: SdrLead; onReview: () => void }) {
  const isFromCloudia = (k: SdrCloudiaFieldKey): "cloudia" | "manual" =>
    lead.cloudiaFields.includes(k) ? "cloudia" : "manual";
  return (
    <tr className="transition-colors hover:bg-white/[0.025]">
      <Td>
        <CloudiaCell origin={isFromCloudia("nome")}>{lead.nome}</CloudiaCell>
      </Td>
      <Td>
        <CloudiaCell origin={isFromCloudia("telefone")}>
          <span className="font-mono text-[11.5px]">{lead.telefone}</span>
        </CloudiaCell>
      </Td>
      <Td>
        <span
          className={cn(
            "inline-flex rounded-md px-1.5 py-0.5 text-[10.5px] font-medium",
            lead.tipo === "Resgate"
              ? "bg-amber-400/10 text-amber-200 ring-1 ring-inset ring-amber-400/20"
              : "bg-sky-400/10 text-sky-200 ring-1 ring-inset ring-sky-400/20",
          )}
        >
          {lead.tipo}
        </span>
      </Td>
      <Td>
        <CloudiaCell origin={isFromCloudia("origem")} className="text-[11.5px]">
          {lead.origem}
        </CloudiaCell>
      </Td>
      <Td>
        <StatusPill ok={lead.agendouConsulta} okLabel="Sim" noLabel="Não" />
      </Td>
      <Td>
        <CloudiaCell origin={isFromCloudia("nomeResponsavel")}>{lead.nomeResponsavel}</CloudiaCell>
      </Td>
      <Td className="text-slate-400 tabular-nums">{formatDate(lead.dataOrigem)}</Td>
      <Td className="text-right">
        <button
          type="button"
          onClick={onReview}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[11px] font-medium text-emerald-200 transition-colors hover:border-emerald-400/40 hover:bg-emerald-400/15"
        >
          <Eye className="h-3 w-3" />
          Revisar
        </button>
      </Td>
    </tr>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-56 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]"
        />
      ))}
    </div>
  );
}

// ─── Filter chips ───────────────────────────────────────────────────────────

function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-1 py-1">
      <span className="px-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        <Filter className="-mt-px mr-1 inline h-3 w-3" />
        {label}
      </span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2 py-1 text-[11px] font-medium transition-colors",
            value === o.value
              ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/30"
              : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

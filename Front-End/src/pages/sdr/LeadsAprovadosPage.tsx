import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Phone,
  Search,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Users,
  XCircle,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { CloudiaInlineBadge } from "@/components/sdr/CloudiaField";
import { useIsClient, useSdrStore } from "@/lib/sdr/sdr-store";
import type { SdrLead } from "@/types/sdr";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";

type TabKind = "normais" | "importados" | "todos";

export default function LeadsAprovadosPage() {
  const ready = useIsClient();
  const { leads, consultas, tratamentos } = useSdrStore();
  const [tab, setTab] = useState<TabKind>("normais");
  const [search, setSearch] = useState("");

  // Apenas leads aprovados — quem está em pendente_revisao fica em /sdr/cadastro-geral
  const aprovados = useMemo(
    () => leads.filter((l) => l.status === "aprovado"),
    [leads],
  );

  const normais = useMemo(
    () => aprovados.filter((l) => l.source === "manual" || l.source === "cloudia"),
    [aprovados],
  );
  const importados = useMemo(
    () => aprovados.filter((l) => l.source === "importado"),
    [aprovados],
  );

  const tabLeads = tab === "normais" ? normais : tab === "importados" ? importados : aprovados;

  const filtered = useMemo(() => {
    if (!search.trim()) return tabLeads;
    const q = search.toLowerCase();
    return tabLeads.filter(
      (l) =>
        l.nome.toLowerCase().includes(q) ||
        l.telefone.toLowerCase().includes(q) ||
        (l.origem ?? "").toLowerCase().includes(q),
    );
  }, [tabLeads, search]);

  // KPIs do bento
  const kpis = useMemo(() => {
    const total = aprovados.length;
    const cloudiaPromoted = aprovados.filter((l) => l.source === "cloudia").length;
    const manualEntries = aprovados.filter((l) => l.source === "manual").length;
    const importedEntries = aprovados.filter((l) => l.source === "importado").length;
    const withConsulta = aprovados.filter((l) =>
      consultas.some((c) => c.leadId === l.id),
    ).length;
    const fechamentos = aprovados.filter((l) =>
      consultas.some((c) => c.leadId === l.id && c.fechouTratamento === true),
    ).length;
    const taxaFechamento = withConsulta > 0 ? (fechamentos / withConsulta) * 100 : 0;
    const receitaTotal =
      consultas.reduce(
        (s, c) => s + (c.recebimento1?.valor ?? 0) + (c.recebimento2?.valor ?? 0),
        0,
      ) +
      tratamentos.reduce(
        (s, t) => s + t.recebimentos.reduce((a, r) => a + r.valor, 0),
        0,
      );
    return {
      total,
      cloudiaPromoted,
      manualEntries,
      importedEntries,
      withConsulta,
      fechamentos,
      taxaFechamento,
      receitaTotal,
    };
  }, [aprovados, consultas, tratamentos]);

  // Distribuição por origem (top 5)
  const topOrigens = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of aprovados) m.set(l.origem, (m.get(l.origem) ?? 0) + 1);
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([origem, n]) => ({ origem, n, pct: (n / Math.max(1, aprovados.length)) * 100 }));
  }, [aprovados]);

  return (
    <div>
      <PageHeader
        badge="Pipeline · Leads Aprovados"
        title="Leads aprovados"
        description="Tudo que passou pela revisão da SDR — pronto para ser trabalhado pelo time comercial."
        actions={
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            <span>{formatNumber(kpis.total)} aprovados no total</span>
          </div>
        }
      />

      {/* ── BENTO ─────────────────────────────────────────────── */}
      {ready && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <BentoCell large tone="emerald" icon={Users} label="Total aprovados" value={formatNumber(kpis.total)} subtitle="leads no pipeline">
            <Sparkline values={Array.from({ length: 14 }, (_, i) => Math.max(0, Math.round(Math.sin(i / 2) * 4 + kpis.total / 14 + 2)))} />
          </BentoCell>
          <BentoCell tone="sky" icon={Sparkles} label="Promovidos · Cloudia" value={formatNumber(kpis.cloudiaPromoted)} subtitle="passaram por revisão" />
          <BentoCell tone="violet" icon={ClipboardCheck} label="Cadastros manuais" value={formatNumber(kpis.manualEntries)} subtitle="digitados pela SDR" />
          <BentoCell tone="amber" icon={UploadCloud} label="Importados" value={formatNumber(kpis.importedEntries)} subtitle="upload em massa" />
          <BentoCell large tone="emerald" icon={TrendingUp} label="Receita total" value={formatCurrency(kpis.receitaTotal)} subtitle={`${kpis.fechamentos} fechamentos · ${kpis.taxaFechamento.toFixed(1)}% conversão`}>
            <ProgressBar value={kpis.taxaFechamento} />
          </BentoCell>
          <BentoCell tone="slate" icon={Activity} label="Top origens">
            <div className="mt-1 space-y-1">
              {topOrigens.length === 0 && (
                <p className="text-[10.5px] text-slate-500">Sem dados</p>
              )}
              {topOrigens.map((o) => (
                <div key={o.origem} className="text-[10.5px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-slate-300" title={o.origem}>{o.origem}</span>
                    <span className="tabular-nums text-slate-500">{o.n}</span>
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-emerald-400/60" style={{ width: `${o.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </BentoCell>
        </div>
      )}

      {/* ── TABS NORMAIS / IMPORTADOS ───────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] p-1">
          <Tab active={tab === "normais"} onClick={() => setTab("normais")} count={normais.length} icon={Users}>Normais</Tab>
          <Tab active={tab === "importados"} onClick={() => setTab("importados")} count={importados.length} icon={UploadCloud}>Importados</Tab>
          <Tab active={tab === "todos"} onClick={() => setTab("todos")} count={aprovados.length} icon={Activity}>Todos</Tab>
        </div>
        <div className="relative max-w-xs flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, origem…"
            className="h-9 w-full rounded-md border border-white/[0.06] bg-white/[0.02] pl-8 pr-3 text-[12px] text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/30 focus:outline-none"
          />
        </div>
      </div>

      {/* ── GRID DE LEAD CARDS ───────────────────────────────────── */}
      {ready && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] py-16 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-2 text-[12px] text-slate-500">
            {tab === "importados"
              ? "Nenhum lead importado."
              : tab === "normais"
              ? "Nenhum lead normal aprovado."
              : "Nenhum lead aprovado."}
          </p>
        </div>
      )}

      {ready && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lead, idx) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.3) }}
            >
              <LeadCard lead={lead} />
            </motion.div>
          ))}
        </div>
      )}

      {ready && filtered.length > 0 && (
        <p className="mt-4 px-1 text-[11px] text-slate-500">
          {formatNumber(filtered.length)} lead(s) — etapa <span className="text-emerald-300">Aprovados</span>
        </p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Lead card
// ───────────────────────────────────────────────────────────────────────────

function LeadCard({ lead }: { lead: SdrLead }) {
  const isCloudiaPromoted = lead.source === "cloudia";
  const isImportado = lead.source === "importado";
  return (
    <article className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 transition-colors hover:border-white/[0.12] hover:bg-white/[0.025]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-emerald-400/[0.04] blur-2xl transition-opacity group-hover:opacity-100" />
      <header className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold text-slate-100">{lead.nome}</h3>
          <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-slate-400">
            <Phone className="h-3 w-3" />
            {lead.telefone}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isCloudiaPromoted && <CloudiaInlineBadge />}
          {isImportado && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-amber-300">
              <UploadCloud className="h-2.5 w-2.5" />
              Importado
            </span>
          )}
          {!isCloudiaPromoted && !isImportado && (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-400/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-violet-300">
              <ClipboardCheck className="h-2.5 w-2.5" />
              Manual
            </span>
          )}
        </div>
      </header>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <Field label="Tipo" value={lead.tipo} highlight={lead.tipo === "Resgate"} />
        <Field label="Origem" value={lead.origem} />
        <Field label="Responsável" value={lead.nomeResponsavel} />
        <Field label="Clínica" value={lead.clinica ?? "—"} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10.5px]">
        {lead.agendouConsulta ? (
          <Pill tone="emerald">
            <CalendarRange className="h-3 w-3" />
            Agendou {lead.dataAgendamento ? `· ${formatDate(lead.dataAgendamento)}` : ""}
          </Pill>
        ) : (
          <Pill tone="slate">
            <XCircle className="h-3 w-3" />
            Não agendou
          </Pill>
        )}
        {lead.interacao ? (
          <Pill tone="sky">Interagiu</Pill>
        ) : (
          <Pill tone="rose">Sem interação</Pill>
        )}
      </div>

      <footer className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Aprovado em {formatDate(lead.reviewedAt)}
        </span>
        {lead.reviewedByName && (
          <span className="truncate">por {lead.reviewedByName}</span>
        )}
      </footer>
    </article>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[9.5px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn("mt-0.5 truncate", highlight ? "text-amber-200" : "text-slate-200")}>
        {value}
      </p>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "emerald" | "sky" | "amber" | "rose" | "slate" }) {
  const cls = {
    emerald: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/20",
    sky: "bg-sky-400/10 text-sky-200 ring-sky-400/20",
    amber: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
    rose: "bg-rose-400/10 text-rose-200 ring-rose-400/20",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/20",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ring-1 ring-inset", cls)}>
      {children}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Bento helpers
// ───────────────────────────────────────────────────────────────────────────

const BENTO_TONES = {
  emerald: "ring-emerald-400/25 bg-emerald-400/[0.05] text-emerald-300",
  sky: "ring-sky-400/25 bg-sky-400/[0.05] text-sky-300",
  violet: "ring-violet-400/25 bg-violet-400/[0.05] text-violet-300",
  amber: "ring-amber-400/25 bg-amber-400/[0.05] text-amber-300",
  rose: "ring-rose-400/25 bg-rose-400/[0.05] text-rose-300",
  slate: "ring-slate-500/25 bg-slate-500/[0.05] text-slate-300",
} as const;

function BentoCell({
  large,
  tone,
  icon: Icon,
  label,
  value,
  subtitle,
  children,
}: {
  large?: boolean;
  tone: keyof typeof BENTO_TONES;
  icon: typeof Activity;
  label: string;
  value?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] p-4",
        large && "md:col-span-2",
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset", BENTO_TONES[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      {value && <p className="mt-1 text-[20px] font-semibold tabular-nums text-slate-100">{value}</p>}
      {subtitle && <p className="mt-1 text-[10.5px] leading-tight text-slate-500">{subtitle}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

function Tab({
  active,
  onClick,
  count,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  icon: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium transition-colors",
        active
          ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/30"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
      <span className={cn("rounded-full px-1.5 py-[1px] text-[9px] tabular-nums", active ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.04] text-slate-500")}>
        {count}
      </span>
    </button>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  return (
    <div className="mt-1 flex h-6 items-end gap-0.5">
      {values.map((v, i) => {
        const h = ((v - min) / range) * 100;
        return (
          <div
            key={i}
            className="flex-1 rounded-sm bg-emerald-400/40"
            style={{ height: `${Math.max(4, h)}%` }}
          />
        );
      })}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          pct >= 60 ? "bg-emerald-400" : pct >= 30 ? "bg-amber-400" : "bg-rose-400",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

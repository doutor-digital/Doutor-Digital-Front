import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileBarChart,
  Lightbulb,
  Loader2,
  Printer,
  Sparkles,
  TrendingUp,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CloudiaLegendBanner } from "@/components/sdr/CloudiaField";
import { useIsClient, useSdrStore } from "@/lib/sdr/sdr-store";
import { analyzeDashboard, type AiAnalysisResponse, type AiInsight } from "@/services/sdr-ai";
import { cn, formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/utils";

type ViewKind = "mensal-origem" | "diario" | "mensal";

const TONE_CLASSES: Record<AiInsight["tone"], string> = {
  positive: "border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-200",
  warning: "border-amber-400/30 bg-amber-400/[0.05] text-amber-200",
  alert: "border-rose-400/30 bg-rose-400/[0.05] text-rose-200",
  neutral: "border-white/[0.08] bg-white/[0.02] text-slate-200",
};

const TONE_ICON: Record<AiInsight["tone"], typeof Brain> = {
  positive: CheckCircle2,
  warning: AlertTriangle,
  alert: XCircle,
  neutral: Lightbulb,
};

export default function RelatoriosPage() {
  const ready = useIsClient();
  const [view, setView] = useState<ViewKind>("mensal-origem");
  const [analysis, setAnalysis] = useState<AiAnalysisResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const printRootRef = useRef<HTMLDivElement>(null);
  const store = useSdrStore();

  // ─── Resumo Mensal por Origem ──────────────────────────────────────
  const resumoOrigem = useMemo(() => {
    const m = new Map<string, { total: number; cadastro: number; resgate: number }>();
    for (const l of store.leads) {
      const cur = m.get(l.origem) ?? { total: 0, cadastro: 0, resgate: 0 };
      cur.total++;
      if (l.tipo === "Resgate") cur.resgate++;
      else cur.cadastro++;
      m.set(l.origem, cur);
    }
    return Array.from(m.entries())
      .map(([origem, v]) => ({ origem, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [store.leads]);

  const totalLeads = store.leads.length;

  // ─── Consolidado Diário ────────────────────────────────────────────
  const consolDiario = useMemo(() => {
    const m = new Map<string, { leads: number; consultas: number; receita: number }>();
    for (const l of store.leads) {
      const k = l.dataOrigem.slice(0, 10);
      const cur = m.get(k) ?? { leads: 0, consultas: 0, receita: 0 };
      cur.leads++;
      m.set(k, cur);
    }
    for (const c of store.consultas) {
      const k = c.dataConsulta.slice(0, 10);
      const cur = m.get(k) ?? { leads: 0, consultas: 0, receita: 0 };
      cur.consultas++;
      cur.receita += (c.recebimento1?.valor ?? 0) + (c.recebimento2?.valor ?? 0);
      m.set(k, cur);
    }
    for (const t of store.tratamentos) {
      for (const r of t.recebimentos) {
        const k = r.data.slice(0, 10);
        const cur = m.get(k) ?? { leads: 0, consultas: 0, receita: 0 };
        cur.receita += r.valor;
        m.set(k, cur);
      }
    }
    return Array.from(m.entries())
      .map(([data, v]) => ({ data, ...v }))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [store]);

  // ─── Consolidado Mensal ────────────────────────────────────────────
  const consolMensal = useMemo(() => {
    const m = new Map<string, { leads: number; consultas: number; receita: number }>();
    for (const l of store.leads) {
      const k = l.dataOrigem.slice(0, 7);
      const cur = m.get(k) ?? { leads: 0, consultas: 0, receita: 0 };
      cur.leads++;
      m.set(k, cur);
    }
    for (const c of store.consultas) {
      const k = c.dataConsulta.slice(0, 7);
      const cur = m.get(k) ?? { leads: 0, consultas: 0, receita: 0 };
      cur.consultas++;
      cur.receita += (c.recebimento1?.valor ?? 0) + (c.recebimento2?.valor ?? 0);
      m.set(k, cur);
    }
    for (const t of store.tratamentos) {
      for (const r of t.recebimentos) {
        const k = r.data.slice(0, 7);
        const cur = m.get(k) ?? { leads: 0, consultas: 0, receita: 0 };
        cur.receita += r.valor;
        m.set(k, cur);
      }
    }
    return Array.from(m.entries())
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => b.mes.localeCompare(a.mes));
  }, [store]);

  // ─── IA · disparo ──────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const res = await analyzeDashboard(store);
      setAnalysis(res);
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div ref={printRootRef} className="sdr-print-root">
      {/* Cabeçalho — escondido na impressão (no PDF aparece o cabeçalho próprio do relatório) */}
      <div className="no-print">
        <PageHeader
          badge="Seção 8 · Relatórios + IA"
          title="Relatórios"
          description="Views agregadas + análise automática de IA. Tudo derivado do estado atual do dashboard SDR."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  analyzing
                    ? "cursor-not-allowed border-white/[0.08] bg-white/[0.02] text-slate-500"
                    : analysis
                    ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200 hover:border-emerald-400/50 hover:bg-emerald-400/25"
                    : "border-violet-400/30 bg-violet-400/15 text-violet-200 hover:border-violet-400/50 hover:bg-violet-400/25",
                )}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analisando…
                  </>
                ) : (
                  <>
                    <Brain className="h-3.5 w-3.5" />
                    {analysis ? "Reanalisar com IA" : "Analisar com IA"}
                  </>
                )}
              </button>
              {analysis && (
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-400/25"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Baixar PDF
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* Cabeçalho de impressão — só aparece no PDF */}
      <div className="hidden print-only print-header">
        <h1 className="text-[22px] font-bold text-black">Relatório SDR · Doutor Digital</h1>
        <p className="text-[11px] text-slate-700">
          Gerado em {analysis ? formatDate(analysis.generatedAt) : formatDate(new Date().toISOString())}
          {analysis && ` · Análise IA: ${analysis.model}`}
        </p>
        <hr className="my-3 border-slate-300" />
      </div>

      <div className="no-print">
        <CloudiaLegendBanner className="mb-5" />
      </div>

      {/* ─── PAINEL IA ──────────────────────────────────────────────── */}
      {ready && analyzing && <AiLoadingPanel />}
      {ready && !analyzing && analysis && <AiResultPanel analysis={analysis} />}
      {ready && !analyzing && !analysis && <AiCallToActionPanel onAnalyze={handleAnalyze} />}

      {/* Sumário executivo no PDF (extra, mais limpo) */}
      {analysis && (
        <div className="hidden print-only mb-6">
          <h2 className="text-[14px] font-bold text-black">Sumário executivo</h2>
          <p className="mt-1 text-[11px] text-slate-700">{analysis.summary}</p>
        </div>
      )}

      {/* ─── TABS DE VIEWS ──────────────────────────────────────────── */}
      <div className="no-print mb-4 mt-6 flex flex-wrap gap-2">
        <ViewTab active={view === "mensal-origem"} onClick={() => setView("mensal-origem")} icon={Sparkles}>
          Resumo mensal por origem
        </ViewTab>
        <ViewTab active={view === "diario"} onClick={() => setView("diario")} icon={Calendar}>
          Consolidado diário
        </ViewTab>
        <ViewTab active={view === "mensal"} onClick={() => setView("mensal")} icon={TrendingUp}>
          Consolidado mensal
        </ViewTab>
      </div>

      {/* No PDF, mostra TODAS as 3 views em sequência (não só a ativa) */}
      <div className="no-print">
        {ready && view === "mensal-origem" && <ResumoOrigemTable rows={resumoOrigem} totalLeads={totalLeads} />}
        {ready && view === "diario" && <ConsolDiarioTable rows={consolDiario} />}
        {ready && view === "mensal" && <ConsolMensalTable rows={consolMensal} />}
      </div>

      {/* PDF: todas as 3 tabelas */}
      <div className="hidden print-only space-y-6 print-tables">
        <div>
          <h2 className="text-[14px] font-bold text-black">1. Resumo mensal por origem</h2>
          <ResumoOrigemTable rows={resumoOrigem} totalLeads={totalLeads} forPrint />
        </div>
        <div>
          <h2 className="text-[14px] font-bold text-black">2. Consolidado diário</h2>
          <ConsolDiarioTable rows={consolDiario} forPrint />
        </div>
        <div>
          <h2 className="text-[14px] font-bold text-black">3. Consolidado mensal</h2>
          <ConsolMensalTable rows={consolMensal} forPrint />
        </div>
      </div>

      <div className="no-print mt-4 px-1 text-[11px] text-slate-500">
        <FileBarChart className="-mt-px mr-1 inline h-3 w-3" />
        Relatórios são views — atualizam automaticamente conforme leads chegam.
      </div>

      {/* CSS de impressão — esconde sidebar/topbar e formata o PDF */}
      <style>{`
        @media print {
          @page { margin: 1.4cm 1.2cm; size: A4; }
          html, body { background: white !important; color: black !important; }
          /* Esconde tudo fora do conteúdo de relatório */
          aside, header, nav, .no-print, [data-no-print] { display: none !important; }
          /* Layout principal vira full-width */
          .min-h-screen, .flex-1, main, [class*="bg-surface"] { background: white !important; }
          /* Mostra blocos só-print */
          .print-only { display: block !important; }
          .print-only.flex { display: flex !important; }
          /* Reset de cores de tema dark pra texto preto/cinza */
          .sdr-print-root, .sdr-print-root * {
            color: black !important;
            background: transparent !important;
            border-color: #d4d4d8 !important;
          }
          .sdr-print-root .bg-emerald-400\\/\\[0\\.05\\], .sdr-print-root .bg-amber-400\\/\\[0\\.05\\],
          .sdr-print-root .bg-rose-400\\/\\[0\\.05\\], .sdr-print-root .bg-violet-400\\/\\[0\\.05\\] {
            background: #f4f4f5 !important;
          }
          /* Tabelas legíveis */
          .sdr-print-root table { border-collapse: collapse; width: 100%; font-size: 10px; }
          .sdr-print-root th, .sdr-print-root td { border: 1px solid #d4d4d8 !important; padding: 4px 6px !important; }
          .sdr-print-root th { background: #f4f4f5 !important; font-weight: 600; text-align: left; }
          /* Quebras de página */
          .print-tables > div { break-inside: avoid; page-break-inside: avoid; }
          .ai-card { break-inside: avoid; page-break-inside: avoid; }
        }
        .print-only { display: none; }
      `}</style>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Painel IA — 3 estados (CTA / loading / resultado)
// ───────────────────────────────────────────────────────────────────────────

function AiCallToActionPanel({ onAnalyze }: { onAnalyze: () => void }) {
  return (
    <div className="ai-card relative overflow-hidden rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-400/[0.05] via-violet-400/[0.02] to-transparent p-5">
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet-400/[0.08] blur-3xl" />
      <div className="relative flex items-start gap-3 md:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-400/10">
          <Brain className="h-5 w-5 text-violet-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-slate-100">
            Gere uma análise com IA dos seus dados
          </h3>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
            A IA olha todas as 8 seções (Cadastro, Consultas, Tratamentos, Tarefas, Agenda, Metas, Auditoria, Origens),
            identifica gargalos e sugere ações. Demora ~2 segundos. Depois você pode baixar tudo em PDF.
          </p>
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          className="shrink-0 rounded-md border border-violet-400/30 bg-violet-400/15 px-3 py-1.5 text-[12px] font-semibold text-violet-200 transition-colors hover:border-violet-400/50 hover:bg-violet-400/25"
        >
          Analisar agora
        </button>
      </div>
    </div>
  );
}

function AiLoadingPanel() {
  const tasks = [
    "Lendo dados de Cadastro Geral…",
    "Computando taxas de agendamento e fechamento…",
    "Cruzando metas com performance real…",
    "Identificando gargalos e oportunidades…",
    "Montando recomendações…",
  ];
  return (
    <div className="ai-card relative overflow-hidden rounded-xl border border-violet-400/30 bg-violet-400/[0.04] p-5">
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet-400/[0.10] blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}>
            <Brain className="h-5 w-5 text-violet-300" />
          </motion.div>
          <h3 className="text-[14px] font-semibold text-slate-100">IA analisando seus dados…</h3>
        </div>
        <ul className="mt-4 space-y-1.5">
          {tasks.map((t, i) => (
            <motion.li
              key={t}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.18 }}
              className="flex items-center gap-2 text-[11.5px] text-slate-400"
            >
              <Loader2 className="h-3 w-3 animate-spin text-violet-300" />
              {t}
            </motion.li>
          ))}
        </ul>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.05]">
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.0, repeat: Infinity, ease: "easeInOut" }}
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-violet-400/60 to-transparent"
          />
        </div>
      </div>
    </div>
  );
}

function AiResultPanel({ analysis }: { analysis: AiAnalysisResponse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-3"
    >
      {/* Sumário */}
      <div className="ai-card rounded-xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/[0.05] to-transparent p-5">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-emerald-300" />
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-emerald-200">
            Resumo da análise IA
          </h3>
          <span className="ml-auto text-[10px] text-slate-500">
            {analysis.model} · {formatDate(analysis.generatedAt)}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-100">{analysis.summary}</p>
      </div>

      {/* Insights */}
      {analysis.insights.length > 0 && (
        <div className="ai-card rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-300">
            <Lightbulb className="h-3.5 w-3.5 text-amber-300" />
            Insights ({analysis.insights.length})
          </h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {analysis.insights.map((ins, i) => {
              const Icon = TONE_ICON[ins.tone];
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border p-3",
                    TONE_CLASSES[ins.tone],
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold leading-tight">{ins.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed opacity-80">{ins.detail}</p>
                  </div>
                  {ins.value && (
                    <span className="shrink-0 self-start rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums">
                      {ins.value}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recomendações */}
      {analysis.recommendations.length > 0 && (
        <div className="ai-card rounded-xl border border-violet-400/20 bg-violet-400/[0.03] p-4">
          <h3 className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-violet-200">
            <ChevronRight className="h-3.5 w-3.5" />
            Próximas ações sugeridas
          </h3>
          <ul className="space-y-1.5">
            {analysis.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-slate-200">
                <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-violet-300" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Métricas usadas (referência rápida) */}
      <div className="ai-card grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 md:grid-cols-4">
        <Metric label="Total de leads" value={formatNumber(analysis.metrics.totalLeads)} />
        <Metric label="Taxa agendamento" value={formatPercent(analysis.metrics.taxaAgendamento, 1)} />
        <Metric label="Taxa fechamento" value={formatPercent(analysis.metrics.taxaFechamento, 1)} />
        <Metric label="Receita total" value={formatCurrency(analysis.metrics.receitaTotal)} />
      </div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9.5px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Tabelas de relatório
// ───────────────────────────────────────────────────────────────────────────

function ResumoOrigemTable({
  rows,
  totalLeads,
  forPrint,
}: {
  rows: { origem: string; total: number; cadastro: number; resgate: number }[];
  totalLeads: number;
  forPrint?: boolean;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015]", forPrint && "border-slate-300")}>
      <div className="border-b border-white/[0.04] bg-white/[0.02] px-4 py-2.5">
        <h3 className="text-[12px] font-semibold text-slate-200">Distribuição por origem</h3>
        <p className="mt-0.5 text-[10.5px] text-slate-500">Origens vêm da Cloudia (data.origin) — auto-gerado.</p>
      </div>
      <table className="w-full text-[12px]">
        <thead className="bg-white/[0.015] text-left">
          <tr>
            <Th>Origem</Th>
            <Th className="text-right">Total</Th>
            <Th className="text-right">% do total</Th>
            <Th className="text-right">Cadastro</Th>
            <Th className="text-right">Resgate</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center text-[12px] text-slate-500">
                Sem leads.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const pct = totalLeads > 0 ? (r.total / totalLeads) * 100 : 0;
            return (
              <tr key={r.origem}>
                <Td>{r.origem}</Td>
                <Td className="text-right tabular-nums">{formatNumber(r.total)}</Td>
                <Td className="text-right tabular-nums text-emerald-200">{formatPercent(pct, 1)}</Td>
                <Td className="text-right tabular-nums text-sky-200">{formatNumber(r.cadastro)}</Td>
                <Td className="text-right tabular-nums text-amber-200">{formatNumber(r.resgate)}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConsolDiarioTable({
  rows,
  forPrint,
}: {
  rows: { data: string; leads: number; consultas: number; receita: number }[];
  forPrint?: boolean;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015]", forPrint && "border-slate-300")}>
      <div className="border-b border-white/[0.04] bg-white/[0.02] px-4 py-2.5">
        <h3 className="text-[12px] font-semibold text-slate-200">Atividade diária</h3>
      </div>
      <table className="w-full text-[12px]">
        <thead className="bg-white/[0.015] text-left">
          <tr>
            <Th>Data</Th>
            <Th className="text-right">Leads novos</Th>
            <Th className="text-right">Consultas</Th>
            <Th className="text-right">Receita do dia</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-12 text-center text-[12px] text-slate-500">
                Sem dados.
              </td>
            </tr>
          )}
          {rows.map((d) => (
            <tr key={d.data}>
              <Td className="font-mono tabular-nums text-slate-300">
                {new Date(d.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
              </Td>
              <Td className="text-right tabular-nums">{formatNumber(d.leads)}</Td>
              <Td className="text-right tabular-nums text-sky-200">{formatNumber(d.consultas)}</Td>
              <Td className="text-right tabular-nums text-emerald-200">{formatCurrency(d.receita)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConsolMensalTable({
  rows,
  forPrint,
}: {
  rows: { mes: string; leads: number; consultas: number; receita: number }[];
  forPrint?: boolean;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015]", forPrint && "border-slate-300")}>
      <div className="border-b border-white/[0.04] bg-white/[0.02] px-4 py-2.5">
        <h3 className="text-[12px] font-semibold text-slate-200">Atividade mensal</h3>
      </div>
      <table className="w-full text-[12px]">
        <thead className="bg-white/[0.015] text-left">
          <tr>
            <Th>Mês</Th>
            <Th className="text-right">Leads</Th>
            <Th className="text-right">Consultas</Th>
            <Th className="text-right">Receita total</Th>
            <Th className="text-right">Ticket médio</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center text-[12px] text-slate-500">
                Sem dados.
              </td>
            </tr>
          )}
          {rows.map((m) => {
            const ticket = m.consultas > 0 ? m.receita / m.consultas : 0;
            return (
              <tr key={m.mes}>
                <Td className="font-mono tabular-nums">{m.mes}</Td>
                <Td className="text-right tabular-nums">{formatNumber(m.leads)}</Td>
                <Td className="text-right tabular-nums text-sky-200">{formatNumber(m.consultas)}</Td>
                <Td className="text-right tabular-nums text-emerald-200">{formatCurrency(m.receita)}</Td>
                <Td className="text-right tabular-nums">{formatCurrency(ticket)}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2.5 align-bottom font-medium", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5", className)}>{children}</td>;
}

function ViewTab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Calendar;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition-colors",
        active
          ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30"
          : "bg-transparent text-slate-400 ring-white/[0.06] hover:bg-white/[0.03] hover:text-slate-200",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

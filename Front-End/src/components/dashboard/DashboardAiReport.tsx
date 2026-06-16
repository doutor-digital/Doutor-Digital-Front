import { useQuery, useMutation } from "@tanstack/react-query";
import { Brain, Loader2, FileDown, RefreshCw } from "@/components/icons";
import { MarkdownLite } from "@/components/MarkdownLite";
import { aiService } from "@/services/ai";

interface DashboardAiReportProps {
  tenantId: number | null;
  unitId: number | null;
  /** YYYY-MM-DD (dia inclusivo, igual ao que o backend espera). */
  dateFrom: string;
  dateTo: string;
  /** Rótulo já formatado do período (ex.: "01/06/2026 - 16/06/2026"). */
  rangeLabel: string;
  /** Nome da unidade selecionada; ausente = "Todas as unidades". */
  unitName?: string | null;
}

/** Extrai a mensagem real do erro vindo do axios/backend. */
function errMsg(e: unknown): string {
  const ax = e as { response?: { data?: { error?: string } }; message?: string };
  return ax?.response?.data?.error ?? ax?.message ?? "Falha ao gerar a análise.";
}

/**
 * Análise com I.A. + Gerar relatório, embutida na Dashboard principal.
 * Lê o mesmo período/unidade que os cards (inclusive "Todas as unidades", que
 * agrega o tenant inteiro) e chama POST /api/ai/analyze. O resultado sai numa
 * "folha" clara pronta pra impressão/PDF.
 */
export function DashboardAiReport({
  tenantId,
  unitId,
  dateFrom,
  dateTo,
  rangeLabel,
  unitName,
}: DashboardAiReportProps) {
  const scope = unitId == null ? "Todas as unidades" : unitName?.trim() || `Unidade #${unitId}`;

  const settings = useQuery({
    queryKey: ["ai-settings", tenantId],
    queryFn: () => aiService.getSettings(tenantId),
    enabled: tenantId != null,
    staleTime: 5 * 60_000,
  });
  const hasKey = settings.data?.hasKey ?? false;

  const analyze = useMutation({
    mutationFn: () =>
      aiService.analyzeUnit({ unitId, dateFrom, dateTo, tenantId }),
  });

  const handlePrint = () => {
    if (!analyze.data?.markdown) return;
    printReport(scope, rangeLabel, analyze.data.markdown);
  };

  const canAnalyze = tenantId != null && hasKey && !analyze.isPending;

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-[#0f1f3a]/80 ring-1 ring-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      style={{ borderTop: "4px solid #6366f1" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 ring-1 ring-inset ring-indigo-400/25">
            <Brain className="h-4 w-4 text-indigo-200" />
          </span>
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Análise com I.A.
            </h2>
            <p className="text-[11px] text-white/40">
              {scope} · {rangeLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {analyze.data && (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80 ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
            >
              <FileDown className="h-3.5 w-3.5" /> Baixar PDF
            </button>
          )}
          <button
            type="button"
            onClick={() => analyze.mutate()}
            disabled={!canAnalyze}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 px-3.5 py-1.5 text-[11px] font-semibold text-indigo-100 ring-1 ring-inset ring-indigo-400/25 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {analyze.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : analyze.data ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
            {analyze.isPending ? "Analisando…" : analyze.data ? "Gerar novamente" : "Gerar relatório"}
          </button>
        </div>
      </div>

      {/* Chave não configurada */}
      {tenantId != null && !settings.isLoading && !hasKey && (
        <p className="mt-4 text-[12px] text-amber-200/80">
          Configure a chave da OpenAI em{" "}
          <a href="/ia-analytics" className="font-semibold underline decoration-amber-300/40 underline-offset-2 hover:text-amber-100">
            Análise com I.A.
          </a>{" "}
          para liberar o relatório.
        </p>
      )}

      {/* Estado inicial */}
      {hasKey && !analyze.isPending && !analyze.data && !analyze.isError && (
        <p className="mt-4 text-[12px] text-white/50">
          A I.A. lê os números do período selecionado ({scope}) e gera um relatório com
          resumo executivo, conversão &amp; perdas, quem está bombando, perfil do paciente e
          recomendações práticas. Pode levar de 20 a 60 segundos.
        </p>
      )}

      {/* Carregando */}
      {analyze.isPending && (
        <div className="mt-5 flex items-center gap-3 text-[12.5px] text-white/60">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />
          A I.A. está lendo os números de {scope}…
        </div>
      )}

      {/* Erro */}
      {analyze.isError && !analyze.isPending && (
        <p className="mt-4 text-[12px] text-rose-300">{errMsg(analyze.error)}</p>
      )}

      {/* Resultado: folha clara, pronta pra PDF */}
      {analyze.data && !analyze.isPending && (
        <div className="mt-4">
          <div className="rounded-xl bg-white px-6 py-5 text-slate-800 shadow-sm">
            <MarkdownLite text={analyze.data.markdown} />
          </div>
          <p className="mt-2 text-[10.5px] text-white/35">
            Gerado pela I.A. em {analyze.data.durationSec.toFixed(1)}s · ~{analyze.data.tokens} tokens · {rangeLabel}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Impressão / PDF ────────────────────────────────────────────────────────
// Abre uma janela só com o relatório (folha A4) e dispara o print. Evita brigar
// com o layout escuro da dashboard.
function printReport(scope: string, rangeLabel: string, markdown: string) {
  const win = window.open("", "_blank", "width=820,height=1000");
  if (!win) return;
  const body = mdToHtml(markdown);
  win.document.write(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>Relatório I.A. — ${escapeHtml(scope)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 32px 40px; line-height: 1.5; }
  header { border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px; }
  header h1 { font-size: 18px; margin: 0; color: #4f46e5; }
  header p { font-size: 12px; margin: 4px 0 0; color: #64748b; }
  h1 { font-size: 20px; margin: 18px 0 8px; }
  h2 { font-size: 16px; margin: 18px 0 6px; color: #4f46e5; }
  h3 { font-size: 14px; margin: 14px 0 4px; }
  p { font-size: 12.5px; margin: 6px 0; }
  ul { font-size: 12.5px; margin: 6px 0; padding-left: 22px; }
  li { margin: 3px 0; }
  code { background: #eef2f7; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
  @media print { @page { margin: 1.4cm 1.2cm; } body { padding: 0; } }
</style></head>
<body>
  <header>
    <h1>Relatório de I.A. · Doutor Digital</h1>
    <p>${escapeHtml(scope)} · período ${escapeHtml(rangeLabel)}</p>
  </header>
  ${body}
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };<\/script>
</body></html>`);
  win.document.close();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/** Markdown "lite" → HTML, mesmo subconjunto do MarkdownLite. */
function mdToHtml(md: string): string {
  const inline = (t: string) =>
    escapeHtml(t)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
      list = [];
    }
  };
  for (const raw of md.split("\n")) {
    const t = raw.trim();
    if (t.startsWith("### ")) { flush(); out.push(`<h3>${inline(t.slice(4))}</h3>`); }
    else if (t.startsWith("## ")) { flush(); out.push(`<h2>${inline(t.slice(3))}</h2>`); }
    else if (t.startsWith("# ")) { flush(); out.push(`<h1>${inline(t.slice(2))}</h1>`); }
    else if (t.startsWith("- ") || t.startsWith("* ")) { list.push(t.slice(2)); }
    else if (/^\d+\.\s/.test(t)) { list.push(t.replace(/^\d+\.\s/, "")); }
    else if (t === "") { flush(); }
    else { flush(); out.push(`<p>${inline(t)}</p>`); }
  }
  flush();
  return out.join("\n");
}

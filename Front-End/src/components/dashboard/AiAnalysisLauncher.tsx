import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import Lottie from "lottie-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  ArrowLeft,
  Battery,
  Camera,
  CheckCheck,
  Copy,
  FileText,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Signal,
  Sparkles,
  Wifi,
  X,
} from "@/components/icons";
import { aiService } from "@/services/ai";
import { cn } from "@/lib/utils";
import liveChatbot from "@/assets/live-chatbot.json";

/** Período pronto pra análise (já no formato ISO que o backend espera). */
export interface AnalysisPreset {
  key: string;
  label: string;
  from: string;
  to: string;
  rangeLabel: string;
}

interface AiAnalysisLauncherProps {
  tenantId: number | null;
  unitId: number | null;
  /** Nome da unidade; null = "Todas as unidades". */
  unitName?: string | null;
  /** Atalhos de data (Hoje, Ontem, 7 dias…). O 1º é o selecionado por padrão. */
  presets: AnalysisPreset[];
  /** id do elemento do dashboard a ser fotografado pelo botão "Tirar print". */
  captureTargetId: string;
}

const ICON_ANALISE = "https://cdn-icons-png.flaticon.com/512/14313/14313824.png";
const ICON_RELATORIO = "https://cdn-icons-png.flaticon.com/512/10014/10014429.png";

function errMsg(e: unknown): string {
  const ax = e as { response?: { data?: { error?: string } }; message?: string };
  return ax?.response?.data?.error ?? ax?.message ?? "Falha ao gerar a análise.";
}

/**
 * Dois botões ao lado do seletor de datas da dashboard:
 *  • ícone pulsante de I.A. → abre o fluxo de análise (escolhe o dia, roda a
 *    análise com uma tela de carregamento em Lottie e mostra o resultado numa
 *    simulação estilo WhatsApp, com botão de "tirar print" do dashboard).
 *  • ícone de relatório → leva pra /reports já com a unidade selecionada.
 */
export function AiAnalysisLauncher({
  tenantId,
  unitId,
  unitName,
  presets,
  captureTargetId,
}: AiAnalysisLauncherProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [presetKey, setPresetKey] = useState(presets[0]?.key ?? "");
  const [capturing, setCapturing] = useState(false);

  const scope = unitId == null ? "Todas as unidades" : unitName?.trim() || `Unidade #${unitId}`;
  const selected = useMemo(
    () => presets.find((p) => p.key === presetKey) ?? presets[0],
    [presets, presetKey],
  );

  const settings = useQuery({
    queryKey: ["ai-settings", tenantId],
    queryFn: () => aiService.getSettings(tenantId),
    enabled: tenantId != null,
    staleTime: 5 * 60_000,
  });
  const hasKey = settings.data?.hasKey ?? false;

  const analyze = useMutation({
    mutationFn: () =>
      aiService.analyzeUnit({
        unitId,
        dateFrom: selected?.from,
        dateTo: selected?.to,
        tenantId,
      }),
  });

  const waText = useMemo(
    () => (analyze.data ? toWhatsApp(scope, selected?.rangeLabel ?? "", analyze.data.markdown) : ""),
    [analyze.data, scope, selected?.rangeLabel],
  );

  const openModal = () => {
    analyze.reset();
    setPresetKey(presets[0]?.key ?? "");
    setOpen(true);
  };

  const goToReports = () => {
    const params = new URLSearchParams({ mode: "daily" });
    if (unitId != null) params.set("unit", String(unitId));
    params.set("date", todayIso());
    navigate(`/reports?${params.toString()}`);
  };

  // Fotografa o dashboard inteiro e copia pro clipboard (cola no WhatsApp Web).
  const handleScreenshot = async () => {
    const node = document.getElementById(captureTargetId);
    if (!node) {
      toast.error("Não encontrei o dashboard para fotografar.");
      return;
    }
    setCapturing(true);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0c0d10",
        // Não fotografa os próprios botões de I.A. (e evita CORS com os ícones externos).
        filter: (el) => !(el instanceof HTMLElement && el.dataset.noCapture === "true"),
      });
      const blob = await (await fetch(dataUrl)).blob();
      let copied = false;
      try {
        if (navigator.clipboard && "write" in navigator.clipboard) {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          copied = true;
        }
      } catch {
        /* clipboard bloqueado → cai no download abaixo */
      }
      // Sempre deixa o arquivo disponível pra anexar.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-${scope.replace(/\s+/g, "-").toLowerCase()}-${todayIso()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(
        copied
          ? "Print copiado (cole com Ctrl+V no WhatsApp) e baixado."
          : "Print do dashboard baixado — anexe no WhatsApp.",
      );
    } catch {
      toast.error("Falha ao fotografar o dashboard.");
    } finally {
      setCapturing(false);
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(waText);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Falha ao copiar a mensagem.");
    }
  };

  const openWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(waText)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {/* ─── Botões ao lado da data ─────────────────────────────────────── */}
      <div data-no-capture="true" className="flex items-center gap-2">
        {/* Análise com I.A. — pulsante */}
        <button
          type="button"
          onClick={openModal}
          title="Gerar análise com I.A."
          className="group relative flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15 transition hover:bg-white/10"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-indigo-400/30" />
          <span className="absolute inset-0 rounded-full ring-1 ring-indigo-400/40" />
          <img src={ICON_ANALISE} alt="" className="relative h-5 w-5 object-contain" />
        </button>

        {/* Relatório → /reports */}
        <button
          type="button"
          onClick={goToReports}
          title="Abrir relatório da unidade"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15 transition hover:bg-white/10"
        >
          <img src={ICON_RELATORIO} alt="" className="h-5 w-5 object-contain" />
        </button>
      </div>

      {/* ─── Overlay de carregamento (Lottie) ───────────────────────────── */}
      {open && analyze.isPending && createPortal(
        <div className="fixed inset-0 z-[1100] flex flex-col items-center justify-center bg-[#070b16]/95 backdrop-blur-sm">
          <Lottie animationData={liveChatbot} loop className="h-64 w-64 sm:h-80 sm:w-80" />
          <p className="mt-2 text-[15px] font-semibold text-white">A I.A. está analisando {scope}…</p>
          <p className="mt-1 text-[12.5px] text-white/50">{selected?.rangeLabel} · isso pode levar de 20 a 60 segundos</p>
        </div>,
        document.body,
      )}

      {/* ─── Modal ──────────────────────────────────────────────────────── */}
      {open && !analyze.isPending && createPortal(
        <div
          className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-12 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[560px] rounded-2xl bg-[#0f1f3a] ring-1 ring-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 ring-1 ring-inset ring-indigo-400/25">
                  <Sparkles className="h-4 w-4 text-indigo-200" />
                </span>
                <div>
                  <h2 className="text-[13px] font-semibold text-white">Análise com I.A.</h2>
                  <p className="text-[11px] text-white/45">{scope}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="px-5 py-4">
              {/* Sem resultado ainda → escolher data + gerar */}
              {!analyze.data && (
                <>
                  <p className="text-[12.5px] text-white/60">
                    Escolha o período e a I.A. lê os números para montar um resumo executivo,
                    conversão &amp; perdas, destaques e recomendações.
                  </p>

                  <p className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                    Data da análise
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setPresetKey(p.key)}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition",
                          p.key === presetKey
                            ? "bg-white text-slate-900"
                            : "bg-white/5 text-white/70 ring-1 ring-inset ring-white/10 hover:bg-white/10",
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-white/40">{selected?.rangeLabel}</p>

                  {tenantId != null && !settings.isLoading && !hasKey && (
                    <p className="mt-4 text-[12px] text-amber-200/80">
                      Configure a chave da OpenAI em{" "}
                      <a href="/ia-analytics" className="font-semibold underline underline-offset-2">
                        Análise com I.A.
                      </a>{" "}
                      para liberar a análise.
                    </p>
                  )}

                  {analyze.isError && (
                    <p className="mt-4 text-[12px] text-rose-300">{errMsg(analyze.error)}</p>
                  )}

                  <button
                    type="button"
                    onClick={() => analyze.mutate()}
                    disabled={tenantId == null || !hasKey}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500/90 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Sparkles className="h-4 w-4" /> Gerar análise
                  </button>
                </>
              )}

              {/* Resultado → simulação WhatsApp + ações */}
              {analyze.data && (
                <>
                  <WhatsAppPreview scope={scope} text={waText} />

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleScreenshot}
                      disabled={capturing}
                      className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/90 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      {capturing ? "Fotografando…" : "Tirar print do dashboard"}
                    </button>

                    <button
                      type="button"
                      onClick={openWhatsApp}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-[12.5px] font-semibold text-white/85 ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
                    >
                      <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={copyMessage}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-[12.5px] font-semibold text-white/85 ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
                    >
                      <Copy className="h-4 w-4" /> Copiar mensagem
                    </button>

                    <button
                      type="button"
                      onClick={goToReports}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-[12.5px] font-semibold text-white/85 ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
                    >
                      <FileText className="h-4 w-4" /> Relatório completo
                    </button>
                    <button
                      type="button"
                      onClick={() => analyze.mutate()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-[12.5px] font-semibold text-white/85 ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
                    >
                      <RefreshCw className="h-4 w-4" /> Gerar novamente
                    </button>
                  </div>

                  <p className="mt-3 text-center text-[10.5px] text-white/35">
                    Gerado em {analyze.data.durationSec.toFixed(1)}s · ~{analyze.data.tokens} tokens · {selected?.rangeLabel}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ─── Simulação estilo WhatsApp ──────────────────────────────────────────── */
function WhatsAppPreview({ scope, text }: { scope: string; text: string }) {
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-white/10">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-[#1f2c33] px-4 pt-1.5 pb-1 text-[10px] font-medium text-white">
        <span className="tabular-nums">{time}</span>
        <div className="flex items-center gap-1">
          <Signal className="h-2.5 w-2.5" />
          <Wifi className="h-2.5 w-2.5" />
          <Battery className="h-3 w-3" />
        </div>
      </div>
      {/* Header do contato */}
      <div className="flex items-center gap-2.5 bg-[#1f2c33] px-3 py-2 text-white">
        <ArrowLeft className="h-4 w-4 text-white/80" />
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-[11px] font-bold ring-1 ring-white/10">
          DD
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12.5px] font-medium">{scope}</div>
          <div className="text-[10px] text-white/55">online</div>
        </div>
      </div>
      {/* Conversa */}
      <div
        className="max-h-[320px] overflow-y-auto px-3 py-3"
        style={{ background: "#0b141a" }}
      >
        <div className="ml-auto max-w-[90%] rounded-lg rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[12.5px] leading-relaxed text-white shadow">
          {renderWa(text)}
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/60">
            {time} <CheckCheck className="h-3 w-3 text-sky-300" />
          </div>
        </div>
      </div>
      {/* Barra de input fake */}
      <div className="flex items-center gap-2 bg-[#1f2c33] px-3 py-2">
        <div className="flex-1 rounded-full bg-[#2a3942] px-3 py-1.5 text-[11px] text-white/40">
          Mensagem
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Send className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

/** Markdown → texto WhatsApp (*negrito*, • listas), pronto pra colar/enviar. */
function toWhatsApp(scope: string, rangeLabel: string, markdown: string): string {
  const lines: string[] = [`*📊 ${scope}* · ${rangeLabel}`, ""];
  for (const raw of markdown.split("\n")) {
    let t = raw.trimEnd();
    if (!t.trim()) {
      lines.push("");
      continue;
    }
    // Cabeçalhos viram linha em negrito
    const h = t.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      lines.push(`*${h[1].replace(/\*\*/g, "").trim()}*`);
      continue;
    }
    // Listas
    t = t.replace(/^\s*[-*]\s+/, "• ").replace(/^\s*\d+\.\s+/, "• ");
    // **negrito** → *negrito*
    t = t.replace(/\*\*([^*]+)\*\*/g, "*$1*");
    lines.push(t);
  }
  // Colapsa linhas em branco repetidas
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Renderiza *negrito* e quebras de linha numa bolha de chat. */
function renderWa(text: string): React.ReactNode {
  return text.split("\n").map((line, i) => (
    <div key={i} className={line === "" ? "h-2" : undefined}>
      {line.split(/(\*[^*]+\*)/g).map((seg, j) =>
        seg.startsWith("*") && seg.endsWith("*") && seg.length > 2 ? (
          <strong key={j} className="font-semibold">
            {seg.slice(1, -1)}
          </strong>
        ) : (
          <span key={j}>{seg}</span>
        ),
      )}
    </div>
  ));
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

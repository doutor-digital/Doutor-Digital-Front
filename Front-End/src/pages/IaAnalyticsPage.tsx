import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "@/components/icons";
import { useClinic } from "@/hooks/useClinic";
import { aiService } from "@/services/ai";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Paleta (mesma família do redesign de campos customizados)
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: "#EEF1FA",
  panel: "#FFFFFF",
  header: "#4F46E5",
  headerDark: "#3730A3",
  primary: "#4F46E5",
  teal: "#10B981",
  rose: "#EC4899",
  amber: "#F59E0B",
  ink: "#1E293B",
  inkSoft: "#64748B",
  rule: "#E5E7EB",
} as const;

const RANGES: Array<{ key: string; label: string; days: number }> = [
  { key: "7", label: "7 dias", days: 7 },
  { key: "30", label: "30 dias", days: 30 },
  { key: "90", label: "90 dias", days: 90 },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function IaAnalyticsPage() {
  const { unitId, tenantId } = useClinic();
  const queryClient = useQueryClient();
  const [rangeKey, setRangeKey] = useState("30");
  const [keyInput, setKeyInput] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  const settings = useQuery({
    queryKey: ["ai-settings", tenantId],
    queryFn: () => aiService.getSettings(tenantId),
  });

  const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 30;
  const dateFrom = useMemo(() => isoDaysAgo(days), [days]);
  const dateTo = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const setKey = useMutation({
    mutationFn: (k: string) => aiService.setKey(k, tenantId),
    onSuccess: () => {
      setKeyInput("");
      setShowKeyInput(false);
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
    },
  });

  const deleteKey = useMutation({
    mutationFn: () => aiService.deleteKey(tenantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-settings"] }),
  });

  const ping = useMutation({
    mutationFn: () => aiService.test(tenantId),
  });

  const analyze = useMutation({
    mutationFn: () =>
      aiService.analyzeUnit({
        unitId: unitId!,
        dateFrom,
        dateTo,
      }),
  });

  const hasKey = settings.data?.hasKey ?? false;
  const canAnalyze = hasKey && unitId != null;

  return (
    <div className="-mx-4 md:-mx-6 -mt-2" style={{ background: C.bg, minHeight: "calc(100vh - 3rem)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3"
        style={{ background: `linear-gradient(90deg, ${C.headerDark} 0%, ${C.header} 100%)` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded grid place-items-center text-[11px] font-bold text-white"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            IA
          </div>
          <div>
            <h1 className="text-[14px] font-semibold tracking-wide text-white">
              ANÁLISE COM I.A. · GPT-4o-mini
            </h1>
            <p className="text-[10.5px] text-white/70 mt-0.5">
              Relatório profundo da unidade gerado pela OpenAI
            </p>
          </div>
        </div>
      </header>

      <div className="px-6 py-5 space-y-4 max-w-5xl mx-auto" style={{ color: C.ink }}>
        {/* ───── Configuração da chave ───── */}
        <section
          className="rounded-xl p-5 shadow-sm"
          style={{ background: C.panel, border: `1px solid ${C.rule}` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold" style={{ color: C.ink }}>
                Chave OpenAI
              </h2>
              <p className="text-[11.5px] mt-0.5" style={{ color: C.inkSoft }}>
                Sua chave fica cifrada no banco. Só este tenant enxerga. Custa ~$0.0001 por análise.
              </p>
            </div>
            <div>
              {settings.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: C.inkSoft }} />
              ) : hasKey ? (
                <span
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{ background: "#D1FAE5", color: "#065F46" }}
                >
                  ✓ Configurada
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{ background: "#FEE2E2", color: "#991B1B" }}
                >
                  Não configurada
                </span>
              )}
            </div>
          </div>

          {(showKeyInput || !hasKey) && (
            <div className="mt-4 space-y-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-md px-3 py-2 text-[12.5px] outline-none"
                style={{ background: "#F9FAFB", border: `1px solid ${C.rule}`, color: C.ink }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => keyInput.length >= 20 && setKey.mutate(keyInput)}
                  disabled={keyInput.length < 20 || setKey.isPending}
                  className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                  style={{ background: C.primary }}
                >
                  {setKey.isPending ? "Salvando…" : "Salvar chave"}
                </button>
                {hasKey && (
                  <button
                    onClick={() => {
                      setKeyInput("");
                      setShowKeyInput(false);
                    }}
                    className="rounded-md px-3 py-1.5 text-[12px] font-medium"
                    style={{ background: "transparent", color: C.inkSoft }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
              {setKey.isError && (
                <p className="text-[11.5px]" style={{ color: "#B91C1C" }}>
                  Erro ao salvar: {String((setKey.error as Error)?.message ?? "tente novamente")}
                </p>
              )}
            </div>
          )}

          {hasKey && !showKeyInput && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => ping.mutate()}
                disabled={ping.isPending}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium"
                style={{ background: "#F3F4F6", color: C.ink }}
              >
                {ping.isPending ? "Testando…" : "Testar conexão"}
              </button>
              <button
                onClick={() => setShowKeyInput(true)}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium"
                style={{ background: "#F3F4F6", color: C.ink }}
              >
                Trocar chave
              </button>
              <button
                onClick={() => {
                  if (confirm("Remover a chave da OpenAI?")) deleteKey.mutate();
                }}
                disabled={deleteKey.isPending}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium"
                style={{ background: "#FEE2E2", color: "#991B1B" }}
              >
                Remover
              </button>
            </div>
          )}

          {ping.data && (
            <p
              className="mt-3 text-[12px]"
              style={{ color: ping.data.ok ? "#065F46" : "#B91C1C" }}
            >
              {ping.data.ok ? "✓ Chave válida — OpenAI respondeu." : `✗ ${ping.data.error}`}
            </p>
          )}
        </section>

        {/* ───── Análise da unidade ───── */}
        <section
          className="rounded-xl p-5 shadow-sm"
          style={{ background: C.panel, border: `1px solid ${C.rule}` }}
        >
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <h2 className="text-[14px] font-semibold" style={{ color: C.ink }}>
                Análise profunda da unidade
              </h2>
              <p className="text-[11.5px] mt-0.5" style={{ color: C.inkSoft }}>
                Resumo executivo + perdas, ranking de atendentes, perfil dos pacientes e recomendações.
              </p>
            </div>
            <div className="inline-flex items-center rounded-md border" style={{ borderColor: C.rule }}>
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRangeKey(r.key)}
                  className={cn(
                    "px-3 py-1.5 text-[11.5px] font-medium",
                    rangeKey === r.key ? "text-white" : "text-slate-500 hover:text-slate-700",
                  )}
                  style={rangeKey === r.key ? { background: C.primary, borderRadius: 4 } : undefined}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {!hasKey && (
            <p className="text-[12px] py-3" style={{ color: C.inkSoft }}>
              Configure sua chave da OpenAI acima pra liberar a análise.
            </p>
          )}
          {hasKey && unitId == null && (
            <p className="text-[12px] py-3" style={{ color: C.inkSoft }}>
              Selecione uma unidade no topo do painel pra analisar.
            </p>
          )}
          {canAnalyze && (
            <button
              onClick={() => analyze.mutate()}
              disabled={analyze.isPending}
              className="rounded-md px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2"
              style={{ background: C.primary }}
            >
              {analyze.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {analyze.isPending ? "Analisando — pode levar até 1 minuto…" : "✨ Analisar com I.A."}
            </button>
          )}

          {analyze.isError && (
            <p className="mt-3 text-[12px]" style={{ color: "#B91C1C" }}>
              Erro: {String((analyze.error as Error)?.message ?? "falha na análise")}
            </p>
          )}

          {analyze.data && (
            <div className="mt-4">
              <div
                className="flex items-center gap-3 text-[10.5px] uppercase tracking-widest mb-3"
                style={{ color: C.inkSoft }}
              >
                <span>{analyze.data.durationSec.toFixed(1)}s</span>
                <span>•</span>
                <span>~{analyze.data.tokens} tokens</span>
                <span>•</span>
                <span>{dateFrom} → {dateTo}</span>
              </div>
              <article
                className="rounded-lg p-5 prose prose-sm max-w-none"
                style={{ background: "#F9FAFB", border: `1px solid ${C.rule}`, color: C.ink }}
              >
                <MarkdownLite text={analyze.data.markdown} />
              </article>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Renderizador markdown simples — basta pra h1/h2/h3, listas, **bold**, *itálico*, código
 * e quebras de linha. Sem dependência externa.
 */
function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      out.push(
        <ul key={`list-${out.length}`} className="list-disc pl-6 my-2 space-y-1">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-[13px]">
              <InlineMd text={item} />
            </li>
          ))}
        </ul>,
      );
      listBuffer = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      flushList();
      out.push(
        <h1 key={idx} className="text-[20px] font-bold mt-4 mb-2" style={{ color: C.ink }}>
          <InlineMd text={trimmed.slice(2)} />
        </h1>,
      );
    } else if (trimmed.startsWith("## ")) {
      flushList();
      out.push(
        <h2 key={idx} className="text-[16px] font-bold mt-4 mb-1.5" style={{ color: C.primary }}>
          <InlineMd text={trimmed.slice(3)} />
        </h2>,
      );
    } else if (trimmed.startsWith("### ")) {
      flushList();
      out.push(
        <h3 key={idx} className="text-[14px] font-semibold mt-3 mb-1" style={{ color: C.ink }}>
          <InlineMd text={trimmed.slice(4)} />
        </h3>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listBuffer.push(trimmed.slice(2));
    } else if (/^\d+\.\s/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^\d+\.\s/, ""));
    } else if (trimmed === "") {
      flushList();
    } else {
      flushList();
      out.push(
        <p key={idx} className="text-[13px] my-1.5 leading-relaxed">
          <InlineMd text={trimmed} />
        </p>,
      );
    }
  });
  flushList();
  return <>{out}</>;
}

function InlineMd({ text }: { text: string }) {
  // **bold** → <strong>, *italic* → <em>, `code` → <code>
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {tokens.map((t, i) => {
        if (t.startsWith("**") && t.endsWith("**"))
          return <strong key={i}>{t.slice(2, -2)}</strong>;
        if (t.startsWith("*") && t.endsWith("*") && t.length > 2)
          return <em key={i}>{t.slice(1, -1)}</em>;
        if (t.startsWith("`") && t.endsWith("`"))
          return (
            <code
              key={i}
              className="px-1 rounded text-[12px]"
              style={{ background: "#E5E7EB" }}
            >
              {t.slice(1, -1)}
            </code>
          );
        return <span key={i}>{t}</span>;
      })}
    </>
  );
}

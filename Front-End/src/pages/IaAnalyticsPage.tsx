import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "@/components/icons";
import { useClinic } from "@/hooks/useClinic";
import { aiService } from "@/services/ai";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Paleta
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: "#EEF1FA",
  panel: "#FFFFFF",
  header: "#4F46E5",
  headerDark: "#3730A3",
  primary: "#4F46E5",
  primarySoft: "#EEF2FF",
  teal: "#10B981",
  amber: "#F59E0B",
  rose: "#EC4899",
  cyan: "#06B6D4",
  purple: "#A855F7",
  ink: "#1E293B",
  inkSoft: "#64748B",
  rule: "#E5E7EB",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Filtro de período avançado
// ─────────────────────────────────────────────────────────────────────────────

type PresetKey =
  | "hoje"
  | "ontem"
  | "7d"
  | "30d"
  | "90d"
  | "mes-atual"
  | "mes-passado"
  | "este-ano"
  | "custom";

interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
  label: string;
  key: PresetKey;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeRange(key: PresetKey, customFrom?: string, customTo?: string): DateRange {
  const today = new Date();
  const todayStr = isoDate(today);
  switch (key) {
    case "hoje":
      return { from: todayStr, to: todayStr, label: "Hoje", key };
    case "ontem": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const s = isoDate(y);
      return { from: s, to: s, label: "Ontem", key };
    }
    case "7d": {
      const f = new Date(today);
      f.setDate(f.getDate() - 6);
      return { from: isoDate(f), to: todayStr, label: "Últimos 7 dias", key };
    }
    case "30d": {
      const f = new Date(today);
      f.setDate(f.getDate() - 29);
      return { from: isoDate(f), to: todayStr, label: "Últimos 30 dias", key };
    }
    case "90d": {
      const f = new Date(today);
      f.setDate(f.getDate() - 89);
      return { from: isoDate(f), to: todayStr, label: "Últimos 90 dias", key };
    }
    case "mes-atual": {
      const f = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: isoDate(f), to: todayStr, label: "Mês atual", key };
    }
    case "mes-passado": {
      const f = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const t = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: isoDate(f), to: isoDate(t), label: "Mês passado", key };
    }
    case "este-ano": {
      const f = new Date(today.getFullYear(), 0, 1);
      return { from: isoDate(f), to: todayStr, label: "Este ano", key };
    }
    case "custom":
      return {
        from: customFrom ?? todayStr,
        to: customTo ?? todayStr,
        label: customFrom && customTo ? `${customFrom} → ${customTo}` : "Personalizado",
        key,
      };
  }
}

const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "mes-atual", label: "Mês atual" },
  { key: "mes-passado", label: "Mês passado" },
  { key: "este-ano", label: "Este ano" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Perguntas pré-prontas
// ─────────────────────────────────────────────────────────────────────────────

interface PresetQuestion {
  id: string;
  label: string;
  emoji: string;
  color: string;
  prompt: string;
}

const PRESET_QUESTIONS: PresetQuestion[] = [
  {
    id: "resumo-periodo",
    label: "Resumo do período",
    emoji: "📊",
    color: C.primary,
    prompt:
      "Me dá um resumo executivo do período: total de leads, conversão, comparativo com o período anterior, e os 3 destaques principais. Cite números e nomes.",
  },
  {
    id: "melhores-horarios",
    label: "Melhores horários",
    emoji: "🕒",
    color: C.amber,
    prompt:
      "Quais são os MELHORES horários e dias da semana pra captação de leads nesta unidade? Mostre o top 3 horários e top 3 dias. Recomende uma escala de atendimento baseado nisso.",
  },
  {
    id: "campanha-top",
    label: "Campanha mais escolhida",
    emoji: "📣",
    color: C.rose,
    prompt:
      "Qual campanha trouxe MAIS leads no período? Qual delas converteu MAIS em agendamento e fechamento? Mostre o ranking completo das campanhas com leads, agendamentos e fechamentos pra cada uma.",
  },
  {
    id: "conversao-rapida",
    label: "Quem converteu mais rápido",
    emoji: "⚡",
    color: C.teal,
    prompt:
      "Quais leads converteram MAIS RÁPIDO da entrada até o agendamento ou fechamento? Liste o top 10 com nome, fonte e tempo de conversão (em horas). Tem algum padrão?",
  },
  {
    id: "atendente-bombando",
    label: "Atendente bombando",
    emoji: "🔥",
    color: C.purple,
    prompt:
      "Quem é o atendente/responsável que está BOMBANDO nesta unidade? Top 5 atendentes por: leads atribuídos, agendamentos feitos e fechamentos efetivados. Quem está acima da média?",
  },
  {
    id: "perfil-paciente",
    label: "Perfil do paciente",
    emoji: "👥",
    color: C.cyan,
    prompt:
      "Qual o PERFIL do paciente que mais agenda e mais fecha na unidade? Cruze Sexo, Profissão e Qualificação do Lead com o desfecho. Quem é o cliente ideal?",
  },
  {
    id: "tratamentos",
    label: "Tratamentos top",
    emoji: "💊",
    color: C.teal,
    prompt:
      "Quais tratamentos são MAIS indicados vs efetivamente FECHADOS? Mostre o top 8 de cada. Há gaps entre o que é indicado e o que é fechado?",
  },
  {
    id: "motivos-perda",
    label: "Por que perdemos",
    emoji: "❌",
    color: C.rose,
    prompt:
      "Por que os leads NÃO estão agendando? Liste os top motivos do não agendamento e o que isso revela sobre a operação. Sugira 3 ações específicas pra atacar os maiores motivos.",
  },
  {
    id: "campos-customizados",
    label: "Campos customizados",
    emoji: "🏷️",
    color: C.amber,
    prompt:
      "Analise PROFUNDAMENTE os campos customizados da Kommo no período. Quais campos as SDRs estão preenchendo mais? Quais ficam em branco e por quê isso é um problema? O que os valores revelam sobre os leads?",
  },
  {
    id: "comparativo-anterior",
    label: "vs Período anterior",
    emoji: "📈",
    color: C.primary,
    prompt:
      "Compare ESTE período com o anterior de mesma duração. O que melhorou? O que piorou? Em que % e por quê? Olhe leads totais, conversão, atendentes, canais.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

export default function IaAnalyticsPage() {
  const { unitId, tenantId } = useClinic();
  const queryClient = useQueryClient();

  const [presetKey, setPresetKey] = useState<PresetKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = useMemo(
    () => computeRange(presetKey, customFrom, customTo),
    [presetKey, customFrom, customTo],
  );

  const [keyInput, setKeyInput] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Estado das perguntas pré-prontas: cada uma guarda sua resposta + estado
  const [questionStates, setQuestionStates] = useState<
    Record<string, { loading?: boolean; answer?: string; error?: string; toolsCalled?: string[] }>
  >({});

  const settings = useQuery({
    queryKey: ["ai-settings", tenantId],
    queryFn: () => aiService.getSettings(tenantId),
  });

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

  const ping = useMutation({ mutationFn: () => aiService.test(tenantId) });

  const analyze = useMutation({
    mutationFn: () =>
      aiService.analyzeUnit({
        unitId: unitId!,
        dateFrom: range.from,
        dateTo: range.to,
      }),
  });

  async function askPreset(q: PresetQuestion) {
    if (!unitId) return;
    setQuestionStates((s) => ({ ...s, [q.id]: { loading: true } }));
    try {
      const reply = await aiService.chat({
        messages: [{ role: "user", content: q.prompt }],
        unitId,
        dateFrom: range.from,
        dateTo: range.to,
        tenantId,
        currentPath: "/ia-analytics",
      });
      setQuestionStates((s) => ({
        ...s,
        [q.id]: { answer: reply.content, toolsCalled: reply.toolsCalled },
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setQuestionStates((s) => ({ ...s, [q.id]: { error: msg } }));
    }
  }

  function clearQuestion(id: string) {
    setQuestionStates((s) => {
      const { [id]: _omit, ...rest } = s;
      return rest;
    });
  }

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
            <h1 className="font-display text-[16px] font-semibold tracking-wide text-white">
              Análise com I.A. · GPT-4o-mini
            </h1>
            <p className="text-[10.5px] text-white/70 mt-0.5">
              {unitId ? `Unidade #${unitId}` : "Selecione uma unidade no topo do painel"}
            </p>
          </div>
        </div>
      </header>

      <div className="px-6 py-5 space-y-4 max-w-6xl mx-auto" style={{ color: C.ink }}>
        {/* ───── Configuração da chave (compacta) ───── */}
        <section
          className="rounded-xl p-4 shadow-sm"
          style={{ background: C.panel, border: `1px solid ${C.rule}` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-[13.5px] font-semibold" style={{ color: C.ink }}>
                🔑 Chave OpenAI
              </h2>
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
            {hasKey && !showKeyInput && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => ping.mutate()}
                  disabled={ping.isPending}
                  className="rounded-md px-2.5 py-1 text-[11.5px] font-medium"
                  style={{ background: "#F3F4F6", color: C.ink }}
                >
                  {ping.isPending ? "Testando…" : "Testar"}
                </button>
                <button
                  onClick={() => setShowKeyInput(true)}
                  className="rounded-md px-2.5 py-1 text-[11.5px] font-medium"
                  style={{ background: "#F3F4F6", color: C.ink }}
                >
                  Trocar
                </button>
                <button
                  onClick={() => {
                    if (confirm("Remover a chave?")) deleteKey.mutate();
                  }}
                  className="rounded-md px-2.5 py-1 text-[11.5px] font-medium"
                  style={{ background: "#FEE2E2", color: "#991B1B" }}
                >
                  Remover
                </button>
              </div>
            )}
          </div>
          {(showKeyInput || !hasKey) && (
            <div className="mt-3 space-y-2">
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
            </div>
          )}
          {ping.data && (
            <p
              className="mt-2 text-[11.5px]"
              style={{ color: ping.data.ok ? "#065F46" : "#B91C1C" }}
            >
              {ping.data.ok ? "✓ Chave válida" : `✗ ${ping.data.error}`}
            </p>
          )}
        </section>

        {/* ───── Filtro de período avançado ───── */}
        <section
          className="rounded-xl p-4 shadow-sm"
          style={{ background: C.panel, border: `1px solid ${C.rule}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13.5px] font-semibold" style={{ color: C.ink }}>
              📅 Período de análise
            </h2>
            <span className="text-[11.5px] font-medium" style={{ color: C.primary }}>
              {range.label} · {range.from} → {range.to}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPresetKey(p.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[11.5px] font-medium transition",
                  presetKey === p.key
                    ? "text-white"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
                )}
                style={{
                  background: presetKey === p.key ? C.primary : "transparent",
                  border: `1px solid ${presetKey === p.key ? C.primary : C.rule}`,
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setPresetKey("custom")}
              className={cn(
                "rounded-md px-3 py-1.5 text-[11.5px] font-medium transition",
                presetKey === "custom"
                  ? "text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
              )}
              style={{
                background: presetKey === "custom" ? C.primary : "transparent",
                border: `1px solid ${presetKey === "custom" ? C.primary : C.rule}`,
              }}
            >
              Personalizado
            </button>
          </div>

          {presetKey === "custom" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]" style={{ color: C.inkSoft }}>
              <span>de</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md px-2 py-1 text-[12px] outline-none"
                style={{ background: "#F9FAFB", border: `1px solid ${C.rule}`, color: C.ink }}
              />
              <span>até</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md px-2 py-1 text-[12px] outline-none"
                style={{ background: "#F9FAFB", border: `1px solid ${C.rule}`, color: C.ink }}
              />
            </div>
          )}
        </section>

        {/* ───── Perguntas pré-prontas ───── */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="font-display text-[22px] font-semibold tracking-tight" style={{ color: C.ink }}>
                Perguntas rápidas
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: C.inkSoft }}>
                Clica numa pergunta e a I.A. responde com base nos dados desta unidade no período.
              </p>
            </div>
            {Object.keys(questionStates).length > 0 && (
              <button
                onClick={() => setQuestionStates({})}
                className="text-[11.5px] font-medium hover:underline"
                style={{ color: C.inkSoft }}
              >
                limpar todas
              </button>
            )}
          </div>

          {!hasKey && (
            <p className="text-[12px] mb-3 px-3 py-2 rounded-md" style={{ background: "#FEF3C7", color: "#92400E" }}>
              Configure sua chave da OpenAI acima pra liberar as perguntas.
            </p>
          )}
          {hasKey && unitId == null && (
            <p className="text-[12px] mb-3 px-3 py-2 rounded-md" style={{ background: "#DBEAFE", color: "#1E3A8A" }}>
              Selecione uma unidade no topo do painel pra perguntar.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PRESET_QUESTIONS.map((q) => {
              const state = questionStates[q.id];
              const isOpen = !!state;
              const isLoading = state?.loading;
              return (
                <article
                  key={q.id}
                  className={cn(
                    "rounded-xl shadow-sm transition-all",
                    isOpen && "sm:col-span-2 lg:col-span-3",
                  )}
                  style={{
                    background: C.panel,
                    border: `1px solid ${C.rule}`,
                  }}
                >
                  <button
                    onClick={() => (state ? clearQuestion(q.id) : askPreset(q))}
                    disabled={!canAnalyze || isLoading}
                    className="w-full flex items-start gap-3 p-3.5 text-left disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    <span
                      className="h-9 w-9 shrink-0 rounded-lg grid place-items-center text-[18px]"
                      style={{ background: `${q.color}15`, color: q.color }}
                    >
                      {q.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: C.ink }}>
                        {q.label}
                      </p>
                      <p className="text-[11px] line-clamp-2 mt-0.5" style={{ color: C.inkSoft }}>
                        {q.prompt}
                      </p>
                    </div>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: q.color }} />
                    ) : isOpen ? (
                      <span className="text-[14px]" style={{ color: C.inkSoft }}>
                        ×
                      </span>
                    ) : (
                      <span className="text-[14px]" style={{ color: q.color }}>
                        →
                      </span>
                    )}
                  </button>

                  {state?.answer && (
                    <div className="border-t px-4 py-3" style={{ borderColor: C.rule, background: "#F9FAFB" }}>
                      <MarkdownLite text={state.answer} />
                      {state.toolsCalled && state.toolsCalled.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {Array.from(new Set(state.toolsCalled)).map((t) => (
                            <span
                              key={t}
                              className="text-[9.5px] px-1.5 py-0.5 rounded font-mono"
                              style={{ background: "#E5E7EB", color: C.inkSoft }}
                            >
                              🔧 {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {state?.error && (
                    <div className="border-t px-4 py-3 text-[11.5px]" style={{ borderColor: C.rule, color: "#B91C1C" }}>
                      Erro: {state.error}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* ───── Análise profunda ───── */}
        <section
          className="rounded-xl p-5 shadow-sm"
          style={{ background: C.panel, border: `1px solid ${C.rule}` }}
        >
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <h2 className="font-display text-[22px] font-semibold tracking-tight" style={{ color: C.ink }}>
                Análise profunda da unidade
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: C.inkSoft }}>
                Resumo executivo + conversão & perdas + ranking + perfil + insights de campos
                customizados + recomendações práticas. Demora ~30-60s.
              </p>
            </div>
            {canAnalyze && (
              <button
                onClick={() => analyze.mutate()}
                disabled={analyze.isPending}
                className="rounded-md px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2 shrink-0"
                style={{ background: C.primary }}
              >
                {analyze.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {analyze.isPending ? "Analisando…" : "✨ Analisar com I.A."}
              </button>
            )}
          </div>

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
                <span>
                  {range.from} → {range.to}
                </span>
              </div>
              <article
                className="rounded-lg p-5 max-w-none"
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

// ─────────────────────────────────────────────────────────────────────────────
// Markdown lite renderer
// ─────────────────────────────────────────────────────────────────────────────

function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      out.push(
        <ul key={`list-${out.length}`} className="list-disc pl-6 my-2 space-y-1">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-[12.5px]">
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
        <h1 key={idx} className="font-display text-[22px] font-bold mt-3 mb-2 tracking-tight" style={{ color: C.ink }}>
          <InlineMd text={trimmed.slice(2)} />
        </h1>,
      );
    } else if (trimmed.startsWith("## ")) {
      flushList();
      out.push(
        <h2 key={idx} className="font-display text-[18px] font-bold mt-4 mb-1.5 tracking-tight" style={{ color: C.primary }}>
          <InlineMd text={trimmed.slice(3)} />
        </h2>,
      );
    } else if (trimmed.startsWith("### ")) {
      flushList();
      out.push(
        <h3 key={idx} className="font-display text-[15px] font-semibold mt-3 mb-1" style={{ color: C.ink }}>
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
        <p key={idx} className="text-[12.5px] my-1.5 leading-relaxed">
          <InlineMd text={trimmed} />
        </p>,
      );
    }
  });
  flushList();
  return <>{out}</>;
}

function InlineMd({ text }: { text: string }) {
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
            <code key={i} className="px-1 rounded text-[11.5px]" style={{ background: "#E5E7EB" }}>
              {t.slice(1, -1)}
            </code>
          );
        return <span key={i}>{t}</span>;
      })}
    </>
  );
}

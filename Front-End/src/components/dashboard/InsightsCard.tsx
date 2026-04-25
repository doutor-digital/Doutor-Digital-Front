import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  Lightbulb,
  Minus,
  TrendingUp,
} from "lucide-react";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

const INSIGHTS_ICON =
  "https://cdn-icons-png.flaticon.com/512/9506/9506312.png";

type Trend = "up" | "down" | "flat";

type Highlight = {
  label: string;
  value: string;
  trend?: Trend;
  delta?: string;
};

type Recommendation = {
  text: string;
  cta?: { label: string; to: string };
  tone: "good" | "warn" | "info";
};

interface InsightsCardProps {
  loading?: boolean;
  total: number;
  conversao: number;
  comPagamento: number;
  semPagamento: number;
  topOrigem?: { name: string; value: number };
  inService: number;
  inQueue: number;
  yesterdayTotal?: number;
}

function trendOf(cur: number, prev?: number): Trend {
  if (prev === undefined || prev === null) return "flat";
  if (cur > prev * 1.02) return "up";
  if (cur < prev * 0.98) return "down";
  return "flat";
}

export function InsightsCard({
  loading,
  total,
  conversao,
  comPagamento,
  semPagamento,
  topOrigem,
  inService,
  inQueue,
  yesterdayTotal,
}: InsightsCardProps) {
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "manhã";
    if (h < 18) return "tarde";
    return "noite";
  }, []);

  const totalTrend = trendOf(total, yesterdayTotal);
  const deltaPct =
    yesterdayTotal && yesterdayTotal > 0
      ? ((total - yesterdayTotal) / yesterdayTotal) * 100
      : null;

  const narrative = useMemo(() => {
    if (loading) return "Analisando dados…";
    if (total === 0) {
      return `Boa ${greeting}! Ainda não há leads no período selecionado — selecione outra janela para ver as métricas.`;
    }

    const parts: string[] = [];
    parts.push(`Você teve **${formatNumber(total)} leads** no período`);

    if (deltaPct !== null) {
      const sign = deltaPct >= 0 ? "+" : "";
      const word = deltaPct >= 0 ? "acima" : "abaixo";
      parts.push(
        `(${sign}${deltaPct.toFixed(1)}% ${word} do anterior)`,
      );
    }

    parts.push(`com **${formatPercent(conversao)} de conversão**`);

    if (topOrigem && topOrigem.value > 0) {
      parts.push(
        `· top origem: **${topOrigem.name}** (${formatNumber(topOrigem.value)} leads)`,
      );
    }

    return parts.join(" ") + ".";
  }, [loading, total, deltaPct, conversao, topOrigem, greeting]);

  const highlights: Highlight[] = useMemo(
    () => [
      {
        label: "Leads",
        value: formatNumber(total),
        trend: totalTrend,
        delta: deltaPct !== null ? `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : undefined,
      },
      {
        label: "Conversão",
        value: formatPercent(conversao),
      },
      {
        label: "Em atendimento",
        value: formatNumber(inService),
      },
      {
        label: "Na fila",
        value: formatNumber(inQueue),
      },
    ],
    [total, conversao, inService, inQueue, totalTrend, deltaPct],
  );

  const recommendations = useMemo<Recommendation[]>(() => {
    const recs: Recommendation[] = [];

    if (inQueue >= 5) {
      recs.push({
        text: `Há ${inQueue} leads na fila aguardando atendimento — considere realocar atendentes.`,
        cta: { label: "Ver atendentes", to: "/attendants" },
        tone: "warn",
      });
    }

    if (semPagamento > comPagamento && comPagamento + semPagamento > 0) {
      recs.push({
        text: `Mais agendamentos sem pagamento (${formatNumber(semPagamento)}) do que com (${formatNumber(comPagamento)}). Reforce a confirmação do PIX/cartão na conversa.`,
        tone: "info",
      });
    }

    if (totalTrend === "up" && deltaPct !== null && deltaPct >= 20) {
      recs.push({
        text: `Crescimento expressivo de ${deltaPct.toFixed(1)}% — bom momento para escalar campanhas que estão funcionando.`,
        cta: { label: "Ver origens", to: "/sources" },
        tone: "good",
      });
    }

    if (totalTrend === "down" && deltaPct !== null && deltaPct <= -20) {
      recs.push({
        text: `Queda de ${Math.abs(deltaPct).toFixed(1)}% vs período anterior — investigue origens com menor volume.`,
        cta: { label: "Analisar", to: "/analytics" },
        tone: "warn",
      });
    }

    if (recs.length === 0 && total > 0) {
      recs.push({
        text: "Métricas estáveis — bom momento para revisar templates de WhatsApp e otimizar conversão.",
        cta: { label: "Ir aos relatórios", to: "/reports" },
        tone: "info",
      });
    }

    return recs.slice(0, 2);
  }, [inQueue, semPagamento, comPagamento, totalTrend, deltaPct, total]);

  const toneStyles = {
    good: "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-100",
    warn: "border-amber-400/20 bg-amber-400/[0.06] text-amber-100",
    info: "border-sky-400/20 bg-sky-400/[0.05] text-sky-100",
  } as const;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl",
        "border border-emerald-400/15 bg-gradient-to-br from-emerald-500/[0.04] via-sky-500/[0.02] to-violet-500/[0.03]",
      )}
    >
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl" />

      <div className="relative space-y-4 p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-emerald-400/30 to-sky-500/20 ring-1 ring-inset ring-emerald-400/30">
            <img
              src={INSIGHTS_ICON}
              alt="Insights"
              className="h-7 w-7 object-contain"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
              Insights automáticos
            </p>
            <p
              className="mt-1 text-[13px] leading-relaxed text-slate-100"
              dangerouslySetInnerHTML={{
                __html: narrative.replace(
                  /\*\*([^*]+)\*\*/g,
                  '<strong class="text-white font-semibold">$1</strong>',
                ),
              }}
            />
          </div>
        </div>

        {/* Highlights grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {highlights.map((h) => (
            <div
              key={h.label}
              className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2"
            >
              <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">
                {h.label}
              </p>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <p className="text-[15px] font-semibold tabular-nums text-slate-100">
                  {loading ? "…" : h.value}
                </p>
                {h.delta && h.trend && (
                  <span
                    className={cn(
                      "inline-flex items-center text-[10px] font-medium tabular-nums",
                      h.trend === "up" && "text-emerald-300",
                      h.trend === "down" && "text-rose-300",
                      h.trend === "flat" && "text-slate-500",
                    )}
                  >
                    {h.trend === "up" ? (
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    ) : h.trend === "down" ? (
                      <ArrowDownRight className="h-2.5 w-2.5" />
                    ) : (
                      <Minus className="h-2.5 w-2.5" />
                    )}
                    {h.delta}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Recomendações */}
        {recommendations.length > 0 && (
          <div className="space-y-1.5">
            {recommendations.map((r, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border px-3 py-2",
                  toneStyles[r.tone],
                )}
              >
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] leading-relaxed">{r.text}</p>
                </div>
                {r.cta && (
                  <Link
                    to={r.cta.to}
                    className="shrink-0 self-center text-[11px] font-medium underline-offset-2 hover:underline"
                  >
                    {r.cta.label} →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.04] pt-3 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            atualizado há instantes
          </span>
          <span>powered by Doutor Digital Insights</span>
        </div>
      </div>
    </div>
  );
}

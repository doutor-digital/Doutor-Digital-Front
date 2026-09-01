import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Cobertura do rastreio de anúncio, unidade por unidade.
 *
 * POR QUE ESTA TELA EXISTE
 * ------------------------
 * O rastreio de clique é o que preenche campanha, conjunto e anúncio no cartão do lead — e é
 * ele que faz a página de Mídia ter o que mostrar. Quando ele para numa unidade, NADA quebra:
 * a Mídia só passa a listar menos anúncios, com a mesma cara de sempre. Em 01/09/2026 a Serra
 * estava rastreando 7% do que vinha de anúncio havia semanas, com o fluxo ligado e respondendo,
 * e não havia número nenhum na casa que denunciasse isso.
 *
 * A PORCENTAGEM É SOBRE QUEM VEIO DE ANÚNCIO
 * -------------------------------------------
 * Não sobre o total de leads. Indicação e fachada no denominador fariam toda unidade parecer
 * ruim, e — pior — não separariam "o rastreio quebrou" de "esta unidade não está anunciando".
 * Por isso unidade sem lead de anúncio no período aparece sem porcentagem: em branco é honesto,
 * 0% acusaria de quebrado quem só está sem campanha no ar.
 *
 * 100% NÃO É O ALVO
 * -----------------
 * Quem vê o anúncio e depois procura a clínica pela bio ou pela busca chega marcado como
 * Meta-* e sem nada para a Meta nos contar. A Imperatriz, a mais bem configurada, opera perto
 * de 79% — é o teto prático, e é ele que define o verde.
 */

interface Cobertura {
  unidadeId: number;
  unidade: string;
  leads: number;
  deAnuncio: number;
  rastreados: number;
  coberturaPct: number | null;
  ultimoRastreado: string | null;
  status: "ok" | "parcial" | "falha" | "sem_rastreio" | "sem_anuncio";
  detalhe: string;
}

const APARENCIA: Record<Cobertura["status"], { rotulo: string; chip: string; barra: string }> = {
  ok: {
    rotulo: "saudável",
    chip: "bg-emerald-400/15 text-emerald-200",
    barra: "bg-emerald-400/70",
  },
  parcial: {
    rotulo: "parcial",
    chip: "bg-amber-400/15 text-amber-200",
    barra: "bg-amber-400/70",
  },
  falha: {
    rotulo: "deixando passar",
    chip: "bg-rose-400/15 text-rose-200",
    barra: "bg-rose-400/70",
  },
  sem_rastreio: {
    rotulo: "sem rastreio",
    chip: "bg-rose-400/15 text-rose-200",
    barra: "bg-rose-400/70",
  },
  sem_anuncio: {
    rotulo: "sem anúncio",
    chip: "bg-white/[0.06] text-slate-500",
    barra: "bg-white/10",
  },
};

/** Últimos 30 dias — janela curta o bastante para uma queda aparecer, longa o bastante para não oscilar. */
function periodo() {
  const ate = new Date();
  const de = new Date(ate);
  de.setDate(de.getDate() - 30);
  return { de: de.toISOString(), ate: ate.toISOString() };
}

export function RastreioCard() {
  const { de, ate } = useMemo(periodo, []);

  const cobertura = useQuery<Cobertura[]>({
    queryKey: ["saude-rastreio", de.slice(0, 10)],
    queryFn: async () => (await api.get(`/api/saude/rastreio?de=${de}&ate=${ate}`)).data,
    retry: false,
  });

  const linhas = cobertura.data ?? [];

  // Unidade sem lead de anúncio não tem nada a dizer aqui e só ocuparia espaço.
  const comAnuncio = linhas.filter((l) => l.status !== "sem_anuncio");
  const emFalha = comAnuncio.filter((l) => l.status === "falha" || l.status === "sem_rastreio");

  if (cobertura.isError) return null;

  return (
    <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-[14px] font-medium text-slate-100">Rastreio de anúncio</h3>
            {comAnuncio.length > 0 && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em]",
                  emFalha.length > 0
                    ? "bg-rose-400/15 text-rose-200"
                    : "bg-emerald-400/15 text-emerald-200",
                )}
              >
                {emFalha.length > 0
                  ? `${emFalha.length} unidade${emFalha.length > 1 ? "s" : ""} com problema`
                  : "todas saudáveis"}
              </span>
            )}
          </div>
          <p className="mt-1.5 max-w-[62ch] text-[12px] leading-relaxed text-slate-500">
            De cada 100 leads que vieram de anúncio, quantos chegaram com a campanha
            identificada. É o que alimenta a página de Mídia — quando cai, o custo por paciente
            some da tela sem avisar. Últimos 30 dias.
          </p>
        </div>
      </div>

      {cobertura.isLoading ? (
        <p className="mt-5 text-[12px] text-slate-500">Conferindo as unidades…</p>
      ) : comAnuncio.length === 0 ? (
        <p className="mt-5 text-[12px] text-slate-500">
          Nenhum lead de anúncio no período — não há rastreio a conferir.
        </p>
      ) : (
        <ul className="mt-5 space-y-px">
          {comAnuncio.map((l) => {
            const ap = APARENCIA[l.status];
            return (
              <li
                key={l.unidadeId}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-lg px-2 py-2.5 transition hover:bg-white/[0.02] sm:grid-cols-[minmax(0,1fr)_120px_auto]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] text-slate-200">{l.unidade}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em]",
                        ap.chip,
                      )}
                    >
                      {ap.rotulo}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    {l.detalhe}
                    {/* Separa "nunca funcionou" de "funciona e está ruim": as duas dão
                        vermelho, e o conserto de cada uma é em lugar diferente. */}
                    {l.ultimoRastreado && (
                      <span className="text-slate-600">
                        {" "}
                        Último identificado em{" "}
                        {new Date(l.ultimoRastreado).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                        .
                      </span>
                    )}
                  </p>
                </div>

                <div className="hidden h-1.5 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                  <div
                    className={cn("h-full rounded-full transition-all", ap.barra)}
                    style={{ width: `${Math.min(l.coberturaPct ?? 0, 100)}%` }}
                  />
                </div>

                <span
                  className={cn(
                    "text-right text-[13px] tabular-nums",
                    l.status === "ok" ? "text-slate-200" : "text-slate-400",
                  )}
                >
                  {l.coberturaPct}%
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 border-t border-white/[0.05] pt-3 text-[11px] leading-relaxed text-slate-600">
        100% não é o alvo: quem vê o anúncio e depois procura a clínica pela bio ou pela busca
        chega sem nada que a Meta possa nos contar. Perto de 80% é o teto prático.
      </p>
    </section>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClinic } from "@/hooks/useClinic";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  agregar,
  carregarDados,
  cpc,
  cpm,
  ctr,
  custoPorConversa,
  fmtBRL,
  fmtInt,
  fmtPct,
  PERIODO_PRESETS,
  periodoFromKey,
  type Periodo,
  type PeriodoKey,
} from "@/services/desempenho";

/**
 * Desempenho de mídia: para onde foi o dinheiro e o que ele entregou.
 *
 * O INVESTIMENTO É A ÂNCORA, E TEM FORMA
 * --------------------------------------
 * A pergunta desta tela é uma só, e é de dinheiro. Ela abre com o valor investido e,
 * grudado nele, o desenho dia a dia do período — um mês de R$ 6 mil gastos por igual
 * e um mês de R$ 6 mil concentrados em quatro dias exigem decisões opostas, e o total
 * sozinho não distingue os dois.
 *
 * ENTREGA NÃO É KPI, É FICHA TÉCNICA
 * ----------------------------------
 * Impressão, clique, CTR, CPC e CPM não são o objetivo de ninguém: são a conferência
 * de que a verba rodou. Antes ocupavam oito cartões do mesmo tamanho do investimento;
 * aqui viram uma faixa contínua, lida de uma vez, sem competir com o que decide.
 *
 * O QUE NÃO EXISTE NÃO GANHA O MESMO ESPAÇO DO QUE EXISTE
 * -------------------------------------------------------
 * Lead, receita e ROAS por campanha dependem de atribuição CTWA, que não está ligada.
 * Quatro cartões com travessão, um funil de zeros e dois blocos vazios diziam "os
 * números deram zero" — que é falso, e é o pior erro possível numa tela de verba.
 * Viram um bloco só, que diz o que falta e qual é o passo.
 */

interface DiaGasto {
  date: string;
  spend: number;
}

const hojeIso = () => new Date().toISOString().slice(0, 10);
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default function DesempenhoPage() {
  const [periodKey, setPeriodKey] = useState<PeriodoKey>("30d");
  const [custom, setCustom] = useState({ inicio: hojeIso(), fim: hojeIso() });
  const { tenantId } = useClinic();

  const periodo = useMemo<Periodo>(
    () =>
      periodKey === "custom"
        ? { key: "custom", inicio: custom.inicio, fim: custom.fim }
        : periodoFromKey(periodKey),
    [periodKey, custom.inicio, custom.fim],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["desempenho", periodo.key, periodo.inicio, periodo.fim, tenantId],
    queryFn: () => carregarDados(periodo, tenantId),
  });

  // O gasto diário é outra rota porque é outro grão: a de cima soma o período.
  const { data: dias } = useQuery<DiaGasto[]>({
    queryKey: ["desempenho-diario", periodo.inicio, periodo.fim, tenantId],
    queryFn: async () =>
      (
        await api.get("/api/integrations/ads/spend/daily", {
          params: { clinicId: tenantId, from: periodo.inicio, to: periodo.fim },
        })
      ).data?.items ?? [],
    enabled: !!tenantId,
  });

  const totais = useMemo(() => (data ? agregar(data.origens) : null), [data]);
  const origens = useMemo(
    () => [...(data?.origens ?? [])].sort((a, b) => b.investimento - a.investimento),
    [data],
  );
  const semVerba = !isLoading && (!totais || totais.investimento === 0);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-white/[0.07] pb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">
            Mídia paga
          </p>
          <h1 className="mt-2 text-[24px] font-medium leading-none tracking-tight text-slate-100">
            Para onde foi a verba
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-1">
            {PERIODO_PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodKey(p.key)}
                className={cn(
                  "border-b-2 px-2 pb-1 text-[12px] transition",
                  periodKey === p.key
                    ? "border-sky-400/70 text-slate-100"
                    : "border-transparent text-slate-600 hover:text-slate-400",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {periodKey === "custom" && (
            <div className="flex items-center gap-1.5">
              {(["inicio", "fim"] as const).map((k) => (
                <input
                  key={k}
                  type="date"
                  value={custom[k]}
                  onChange={(e) => setCustom((c) => ({ ...c, [k]: e.target.value }))}
                  className="rounded-md border border-white/[0.09] bg-white/[0.02] px-2 py-1 font-mono text-[11.5px] text-slate-200 outline-none focus:border-white/25"
                />
              ))}
            </div>
          )}
        </div>
      </header>

      {isLoading && <p className="mt-10 text-[13px] text-slate-600">carregando o gasto…</p>}

      {semVerba && (
        <p className="mt-10 max-w-[62ch] text-[13px] leading-relaxed text-slate-500">
          Nenhum gasto gravado neste período. A Central de Integrações grava o que o n8n puxa
          da Meta — se a conta de anúncios acabou de ser ligada, o primeiro sync ainda não
          rodou. Aumente o período para conferir.
        </p>
      )}

      {totais && !semVerba && (
        <>
          {/* ─── Investimento, com a forma do período ─────────────────── */}
          <section className="mt-8 grid gap-8 md:grid-cols-[minmax(0,220px)_1fr] md:items-end">
            <div>
              <p className="font-mono text-[42px] leading-none tracking-tight tabular-nums text-slate-50">
                {fmtBRL(totais.investimento)}
              </p>
              <p className="mt-2.5 text-[11.5px] text-slate-500">
                investidos de {diaCurto(periodo.inicio)} a {diaCurto(periodo.fim)}
              </p>
            </div>
            <FormaDoGasto dias={dias ?? []} />
          </section>

          {/* ─── Ficha técnica da entrega ─────────────────────────────── */}
          <section className="mt-8 flex flex-wrap gap-x-10 gap-y-5 border-y border-white/[0.06] py-5">
            <Medida rotulo="Impressões" valor={fmtInt(totais.impressoes)} />
            <Medida rotulo="Cliques" valor={fmtInt(totais.cliques)} />
            <Medida rotulo="CTR" valor={fmtPct(ctr(totais.cliques, totais.impressoes))} />
            <Medida rotulo="CPC" valor={fmtBRL(cpc(totais.investimento, totais.cliques))} />
            <Medida rotulo="CPM" valor={fmtBRL(cpm(totais.investimento, totais.impressoes))} />
            {totais.conversas > 0 && (
              <>
                <Medida rotulo="Conversas" valor={fmtInt(totais.conversas)} />
                <Medida
                  rotulo="Custo por conversa"
                  valor={fmtBRL(custoPorConversa(totais.investimento, totais.conversas))}
                  forte
                />
              </>
            )}
          </section>

          {/* ─── Campanhas ────────────────────────────────────────────── */}
          <section className="mt-9">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Campanhas
              </h2>
              <p className="text-[11px] text-slate-600">
                {origens.length} com entrega · da maior verba para a menor
              </p>
            </div>

            <ul className="mt-4 divide-y divide-white/[0.05]">
              {origens.map((o) => {
                const fatia =
                  totais.investimento > 0 ? (o.investimento / totais.investimento) * 100 : 0;
                const cpcCamp = cpc(o.investimento, o.cliques);
                const ctrCamp = ctr(o.cliques, o.impressoes);
                return (
                  <li key={o.nome} className="grid gap-3 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-slate-200">{o.nome}</p>
                      {/* A barra é a fatia da verba: quem come o orçamento aparece. */}
                      <div className="mt-2 flex items-center gap-2.5">
                        <span className="h-[3px] w-full max-w-[300px] rounded-full bg-white/[0.06]">
                          <span
                            className="block h-full rounded-full bg-sky-400/50"
                            style={{ width: `${fatia}%` }}
                          />
                        </span>
                        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-slate-600">
                          {fatia.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-6 sm:justify-end">
                      <Mini rotulo="CTR" valor={fmtPct(ctrCamp)} />
                      <Mini rotulo="CPC" valor={fmtBRL(cpcCamp)} />
                      <p className="w-[92px] text-right font-mono text-[16px] tabular-nums text-slate-100">
                        {fmtBRL(o.investimento)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ─── O que esta tela ainda não responde ───────────────────── */}
          <section className="mt-9 rounded-lg border border-amber-400/[0.16] bg-amber-400/[0.03] p-5">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/70">
              O que esta tela ainda não responde
            </h2>
            <p className="mt-2.5 max-w-[74ch] text-[12.5px] leading-relaxed text-slate-400">
              Quantos leads cada campanha trouxe, quanto voltou em receita e qual o ROAS. Não é
              que os números deram zero — é que não existe nada que ligue um lead da Kommo ao
              anúncio que o trouxe.
            </p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              <Pendencia
                titulo="Atribuição do clique"
                texto="O referral da CTWA precisa ser gravado no cartão quando a mensagem chega. Hoje nenhum lead da unidade carrega id de anúncio."
                onde="trabalho no n8n"
              />
              {totais.conversas === 0 && (
                <Pendencia
                  titulo="Conversas por campanha"
                  texto="A Meta tem esse número e a página Mídia o busca ao vivo. O sync que grava aqui escreve zero."
                  onde="conserto no sync"
                />
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

/**
 * O gasto dia a dia como faixa. Não é gráfico de análise — é a forma do período,
 * lida junto com o total: mostra concentração, buraco e dia fora da curva.
 */
function FormaDoGasto({ dias }: { dias: DiaGasto[] }) {
  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of dias) m.set(d.date, (m.get(d.date) ?? 0) + d.spend);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [dias]);

  if (porDia.length < 2) return <div />;

  const maior = Math.max(...porDia.map(([, v]) => v));
  const pico = porDia.reduce((a, b) => (b[1] > a[1] ? b : a));

  return (
    <div>
      <div className="flex h-[64px] items-end gap-[2px]">
        {porDia.map(([d, v]) => (
          <span
            key={d}
            title={`${diaCurto(d)} · ${fmtBRL(v)}`}
            className={cn(
              "flex-1 rounded-[1px] transition-colors",
              d === pico[0] ? "bg-sky-300/80" : "bg-white/[0.13] hover:bg-white/25",
            )}
            style={{ height: `${Math.max(3, (v / maior) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between text-[10px] tabular-nums text-slate-600">
        <span>{diaCurto(porDia[0][0])}</span>
        <span className="text-slate-500">
          pico em {diaCurto(pico[0])} · {fmtBRL(pico[1])}
        </span>
        <span>{diaCurto(porDia[porDia.length - 1][0])}</span>
      </div>
    </div>
  );
}

function Medida({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div>
      <p
        className={cn(
          "font-mono text-[17px] leading-none tabular-nums",
          forte ? "text-emerald-300" : "text-slate-100",
        )}
      >
        {valor}
      </p>
      <p className="mt-1.5 text-[10.5px] text-slate-600">{rotulo}</p>
    </div>
  );
}

function Mini({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <p className="text-right">
      <span className="block font-mono text-[12px] leading-none tabular-nums text-slate-400">
        {valor}
      </span>
      <span className="mt-1 block text-[9.5px] uppercase tracking-[0.1em] text-slate-600">
        {rotulo}
      </span>
    </p>
  );
}

function Pendencia({ titulo, texto, onde }: { titulo: string; texto: string; onde: string }) {
  return (
    <li>
      <p className="text-[12.5px] text-slate-200">{titulo}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{texto}</p>
      <p className="mt-1.5 text-[10.5px] uppercase tracking-[0.1em] text-amber-300/50">{onde}</p>
    </li>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronDown } from "@/components/icons";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Campanha {
  campanhaId: string;
  nome?: string | null;
  leads: number;
  agendados: number;
  gasto: number;
  custoPorLead?: number | null;
  melhorAnuncioNome?: string | null;
  melhorAnuncioImagem?: string | null;
}

interface LeadSemCampo {
  leadId: number;
  nome?: string | null;
  telefone?: string | null;
  etapa?: string | null;
  criado: string;
}

interface Lacuna {
  campo: string;
  porque: string;
  faltando: number;
  universo: number;
  percentual: number;
  leads: LeadSemCampo[];
}

interface Anuncio {
  anuncioId: string;
  nome?: string | null;
  campanha?: string | null;
  imagem?: string | null;
  gasto: number;
  alcance: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  conversas: number;
  /** Nulo sem conversa: zero seria lido como "de graça". */
  custoPorConversa?: number | null;
}

interface Relatorio {
  totalLeads: number;
  agendaram: number;
  horariosNaClinica: number;
  compareceram: number;
  horariosPerdidos: number;
  campanhas: Campanha[];
  anuncios: Anuncio[];
  lacunas: Lacuna[];
  origens: { valor: string; contagem: number }[];
}

const nf = new Intl.NumberFormat("pt-BR");
const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(v);
const dataBR = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * O relatório que uma clínica precisa, num lugar só.
 *
 * A DIFERENÇA PARA A ANÁLISE DA IA
 * --------------------------------
 * Lá existe redação, e às vezes a redação mistura período com base inteira — o relatório de
 * 05 a 06/08 listava "não interagiu: 1.576", que é a base toda. Aqui não há texto gerado:
 * cada número sai de uma consulta com o mesmo filtro, e cada lacuna vem com os NOMES.
 *
 * "12 leads sem origem" ninguém consegue conferir. Com a lista, a gerente abre a Kommo,
 * procura o primeiro e vê se bate — é isso que separa relatório de propaganda.
 */
export function RelatorioCompleto({
  unitId,
  de,
  ate,
}: {
  unitId?: number | null;
  /** yyyy-MM-dd */
  de: string;
  ate: string;
}) {
  const [aberta, setAberta] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["relatorio-completo", unitId, de, ate],
    queryFn: async () => {
      const { data } = await api.get<Relatorio>("/api/saude/relatorio-completo", {
        params: { de, ate, unitId },
      });
      return data;
    },
    enabled: !!unitId && !!de && !!ate,
  });

  // Sem unidade a rota devolve 404, e o relatório precisa dos campos mapeados por
  // unidade para saber ler origem, motivo e qualificação.
  if (!unitId)
    return (
      <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[12.5px] text-amber-200">
        Escolha uma unidade no seletor do topo. Este relatório lê os campos do cartão da Kommo,
        e o mapeamento deles é por unidade.
      </p>
    );
  if (isLoading) return <p className="text-[13px] text-slate-600">montando o relatório…</p>;
  // Erro precisa aparecer: em branco, a pessoa conclui que o mês não teve movimento.
  if (isError)
    return (
      <p className="rounded-lg border border-rose-500/20 bg-rose-500/[0.05] px-3 py-2 text-[12.5px] text-rose-200">
        Não foi possível montar o relatório deste período.
      </p>
    );
  if (!data) return null;

  const semAtender = data.horariosNaClinica - data.compareceram - data.horariosPerdidos;

  return (
    <div className="flex flex-col gap-8">
      {/* ─── O movimento ────────────────────────────────────────────── */}
      <section>
        <h3 className="font-boletim text-[15px] font-semibold tracking-tight text-slate-100">
          O movimento
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
          <Numero k="Leads" v={data.totalLeads} />
          <Numero k="Agendaram" v={data.agendaram} alerta={data.agendaram === 0} />
          <Numero k="Horários na clínica" v={data.horariosNaClinica} />
          <Numero k="Compareceram" v={data.compareceram} bom />
          <Numero k="Horários perdidos" v={data.horariosPerdidos} alerta={data.horariosPerdidos > 0} />
        </div>
        {semAtender > 0 && (
          <p className="mt-2 text-[11.5px] text-slate-600">
            {semAtender} horário(s) ainda por acontecer no período.
          </p>
        )}
      </section>

      {/* ─── Anúncios: linha larga ──────────────────────────────────
          Foto à esquerda, as métricas no meio e o custo por conversa isolado à
          direita — é o número que decide se o anúncio fica ou sai, e por isso
          não divide espaço com os outros. */}
      {data.anuncios.length > 0 && (
        <section>
          <h3 className="font-boletim text-[15px] font-semibold tracking-tight text-slate-100">
            Anúncios
          </h3>
          <p className="mt-1 text-[12px] text-slate-500">
            Custo por conversa de WhatsApp iniciada, como a Meta conta. Nem toda conversa vira
            lead no CRM — o custo por lead está no bloco de campanhas.
          </p>

          <ul className="mt-3 flex flex-col gap-2.5">
            {data.anuncios.map((a) => (
              <li
                key={a.anuncioId}
                className="flex overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]"
              >
                {a.imagem ? (
                  /* Volta a ocupar a coluna inteira: com pages_read_engagement a Meta passou
                     a entregar o quadro do vídeo em 720x1280, e o que antes era um 64px
                     esticado agora é imagem de verdade. Anúncio é peça visual — reconhecer o
                     criativo de relance é metade da utilidade da linha. */
                  <img
                    src={a.imagem}
                    alt=""
                    loading="lazy"
                    className="h-[120px] w-[120px] shrink-0 bg-white/[0.03] object-cover"
                  />
                ) : (
                  <span className="grid h-[120px] w-[120px] shrink-0 place-items-center bg-white/[0.03] text-[10px] text-slate-600">
                    sem foto
                  </span>
                )}

                <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-boletim text-[13.5px] font-medium text-slate-100">
                      {a.nome}
                    </p>
                    {a.campanha && (
                      <p className="truncate text-[11px] text-slate-500">{a.campanha}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <Met k="gasto" v={moeda(a.gasto)} />
                    <Met k="alcance" v={nf.format(a.alcance)} />
                    <Met k="cliques" v={nf.format(a.cliques)} />
                    <Met k="CTR" v={`${a.ctr.toFixed(2)}%`} />
                    <Met k="CPC" v={moeda(a.cpc)} />
                    <Met k="conversas" v={nf.format(a.conversas)} />
                  </div>
                </div>

                <div className="flex w-[124px] shrink-0 flex-col items-center justify-center gap-1 border-l border-white/[0.07] bg-white/[0.015] px-2">
                  <p
                    className={cn(
                      "font-boletim text-[19px] font-semibold tabular-nums",
                      a.custoPorConversa == null
                        ? "text-slate-600"
                        : a.custoPorConversa <= 14
                          ? "text-emerald-300"
                          : "text-amber-300",
                    )}
                  >
                    {a.custoPorConversa != null ? moeda(a.custoPorConversa) : "—"}
                  </p>
                  <p className="text-center text-[9.5px] uppercase tracking-[0.08em] text-slate-600">
                    custo por conversa
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── Campanhas ──────────────────────────────────────────────── */}
      <section>
        <h3 className="font-boletim text-[15px] font-semibold tracking-tight text-slate-100">
          Campanhas
        </h3>
        {data.campanhas.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-slate-600">
            Nenhum lead do período tem anúncio identificado. O rastreio começou em 05/08 — só os
            leads a partir daí trazem campanha.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {data.campanhas.slice(0, 8).map((c) => (
              <li
                key={c.campanhaId}
                className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
              >
                {/* A imagem do anúncio, quando existe. Sem ela o bloco não colapsa. */}
                {c.melhorAnuncioImagem ? (
                  <img
                    src={c.melhorAnuncioImagem}
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded bg-white/[0.04] text-[10px] text-slate-600">
                    sem foto
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-slate-200">{c.nome}</p>
                  {c.melhorAnuncioNome && (
                    <p className="truncate text-[11px] text-slate-500">{c.melhorAnuncioNome}</p>
                  )}
                </div>

                <div className="flex shrink-0 gap-5 text-right">
                  <Mini k="leads" v={nf.format(c.leads)} />
                  <Mini k="agendou" v={nf.format(c.agendados)} />
                  <Mini k="gasto" v={c.gasto > 0 ? moeda(c.gasto) : "—"} />
                  <Mini
                    k="custo/lead"
                    v={c.custoPorLead != null ? moeda(c.custoPorLead) : "—"}
                    destaque={c.custoPorLead != null}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─── O que não foi preenchido ───────────────────────────────── */}
      <section>
        <h3 className="font-boletim text-[15px] font-semibold tracking-tight text-slate-100">
          O que não foi preenchido
        </h3>
        <p className="mt-1 text-[12px] text-slate-500">
          Clique para ver os nomes e conferir na Kommo.
        </p>

        {data.lacunas.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-emerald-300/80">
            Nenhum campo em branco no período.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.05]">
            {data.lacunas.map((l) => {
              const abertaAqui = aberta === l.campo;
              return (
                <li key={l.campo} className="py-2.5">
                  <button
                    onClick={() => setAberta(abertaAqui ? null : l.campo)}
                    className="flex w-full items-start gap-4 text-left"
                  >
                    <span className="w-[92px] shrink-0 text-right">
                      <span className="block text-[19px] font-medium leading-none tabular-nums text-amber-400">
                        {nf.format(l.faltando)}
                      </span>
                      <span className="mt-1 block text-[10.5px] tabular-nums text-slate-600">
                        de {nf.format(l.universo)} · {l.percentual}%
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] text-slate-200">{l.campo}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">
                        {l.porque}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "mt-1 h-4 w-4 shrink-0 text-slate-600 transition-transform",
                        abertaAqui && "rotate-180",
                      )}
                    />
                  </button>

                  {abertaAqui && (
                    <ul className="mt-2 max-h-72 overflow-y-auto border-l border-white/[0.08] pl-3">
                      {l.leads.map((p) => (
                        <li key={p.leadId} className="flex items-baseline gap-3 py-1">
                          <Link
                            to={`/leads/${p.leadId}`}
                            className="min-w-0 flex-1 truncate text-[12.5px] text-slate-300 transition hover:text-sky-300"
                          >
                            {p.nome?.trim() || "Sem nome"}
                          </Link>
                          {p.telefone && (
                            <span className="shrink-0 text-[11.5px] tabular-nums text-slate-500">
                              {p.telefone}
                            </span>
                          )}
                          <span className="hidden w-[140px] shrink-0 truncate text-[11px] text-slate-600 sm:block">
                            {(p.etapa ?? "").replace(/_/g, " ")}
                          </span>
                          <span className="w-[38px] shrink-0 text-right text-[11px] tabular-nums text-slate-600">
                            {dataBR(p.criado)}
                          </span>
                        </li>
                      ))}
                      {l.faltando > l.leads.length && (
                        <li className="py-1.5 text-[11.5px] text-slate-600">
                          Mostrando {l.leads.length} de {nf.format(l.faltando)}.
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ─── Origens ────────────────────────────────────────────────── */}
      <section>
        <h3 className="font-boletim text-[15px] font-semibold tracking-tight text-slate-100">
          De onde vieram
        </h3>
        <ul className="mt-3 flex flex-col gap-1">
          {data.origens.slice(0, 10).map((o) => {
            const pct = data.totalLeads === 0 ? 0 : (o.contagem / data.totalLeads) * 100;
            return (
              <li key={o.valor} className="flex items-center gap-3">
                <span className="w-[168px] shrink-0 truncate text-[12.5px] text-slate-300">
                  {o.valor}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <span
                    className="block h-full rounded-full bg-sky-400/60"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-[68px] shrink-0 text-right text-[11.5px] tabular-nums text-slate-400">
                  {o.contagem} · {Math.round(pct)}%
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Met({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[14px] font-medium leading-none tabular-nums text-slate-200">{v}</p>
      <p className="mt-1 text-[10px] text-slate-600">{k}</p>
    </div>
  );
}

function Numero({ k, v, alerta, bom }: { k: string; v: number; alerta?: boolean; bom?: boolean }) {
  return (
    <div>
      <p
        className={cn(
          "font-boletim text-[26px] font-semibold leading-none tabular-nums",
          alerta ? "text-rose-400" : bom ? "text-emerald-300" : "text-slate-100",
        )}
      >
        {nf.format(v)}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">{k}</p>
    </div>
  );
}

function Mini({ k, v, destaque }: { k: string; v: string; destaque?: boolean }) {
  return (
    <div>
      <p
        className={cn(
          "text-[12.5px] font-medium tabular-nums",
          destaque ? "text-emerald-300" : "text-slate-200",
        )}
      >
        {v}
      </p>
      <p className="text-[10px] text-slate-600">{k}</p>
    </div>
  );
}

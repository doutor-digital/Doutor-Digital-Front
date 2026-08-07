import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "@/components/icons";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useClinic } from "@/hooks/useClinic";

interface Anuncio {
  anuncioId: string;
  nome?: string | null;
  campanha?: string | null;
  campanhaId?: string | null;
  conjunto?: string | null;
  imagem?: string | null;
  gasto: number;
  alcance: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  conversas: number;
  custoPorConversa?: number | null;
}

const nf = new Intl.NumberFormat("pt-BR");
const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(v);

/**
 * Mídia: onde o dinheiro entra e o que ele traz.
 *
 * POR QUE PÁGINA PRÓPRIA
 * ----------------------
 * Isto vivia espremido no relatório mensal, e o relatório responde outra pergunta — "como foi
 * o mês". Aqui a pergunta é diária e é uma só: qual criativo continua e qual sai.
 *
 * A HIERARQUIA É A DA META, NÃO UMA INVENTADA
 * -------------------------------------------
 * Campanha → conjunto → anúncio, como no Gerenciador. Quem trabalha com tráfego já pensa
 * nessa árvore; traduzir para outra estrutura só obrigaria a pessoa a converter de cabeça.
 *
 * O CUSTO POR CONVERSA MANDA NA ORDEM
 * -----------------------------------
 * Não é o gasto: gastar muito num anúncio que converte barato é o objetivo, não o problema.
 * A campanha que mais consome aparece primeiro porque é onde uma correção rende mais, e
 * dentro dela os anúncios vêm do mais barato para o mais caro por conversa.
 */
export default function MidiaPage() {
  const { unitId } = useClinic();
  const [dias, setDias] = useState(30);
  const [aberta, setAberta] = useState<string | null>(null);

  const { de, ate } = useMemo(() => {
    const fim = new Date();
    const ini = new Date(fim.getTime() - dias * 24 * 3600_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { de: iso(ini), ate: iso(fim) };
  }, [dias]);

  const { data, isLoading } = useQuery({
    queryKey: ["midia", unitId, de, ate],
    queryFn: async () => {
      const { data } = await api.get<Anuncio[]>("/api/saude/midia", {
        params: { de, ate, unitId },
      });
      return data;
    },
    enabled: !!unitId,
  });

  const campanhas = useMemo(() => {
    const mapa = new Map<string, { nome: string; anuncios: Anuncio[] }>();
    for (const a of data ?? []) {
      const k = a.campanhaId || a.campanha || "—";
      if (!mapa.has(k)) mapa.set(k, { nome: a.campanha || "Sem nome", anuncios: [] });
      mapa.get(k)!.anuncios.push(a);
    }
    return [...mapa.entries()]
      .map(([id, c]) => {
        const gasto = c.anuncios.reduce((s, a) => s + a.gasto, 0);
        const conversas = c.anuncios.reduce((s, a) => s + a.conversas, 0);
        const conjuntos = new Set(c.anuncios.map((a) => a.conjunto).filter(Boolean)).size;
        return {
          id,
          nome: c.nome,
          gasto,
          conversas,
          conjuntos,
          // Anúncio mais barato primeiro: é o que se copia, não o que se corta.
          anuncios: [...c.anuncios].sort(
            (x, y) => (x.custoPorConversa ?? 1e9) - (y.custoPorConversa ?? 1e9),
          ),
          custo: conversas > 0 ? gasto / conversas : null,
        };
      })
      .sort((a, b) => b.gasto - a.gasto);
  }, [data]);

  const total = campanhas.reduce((s, c) => s + c.gasto, 0);
  const conversasTotal = campanhas.reduce((s, c) => s + c.conversas, 0);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="border-b border-white/[0.08] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">Mídia</p>
        <h1 className="mt-2 text-[22px] font-medium tracking-tight text-slate-100">
          Onde o dinheiro entra
        </h1>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDias(d)}
                className={cn(
                  "border-b-2 px-2 pb-1 text-[12px] transition",
                  dias === d
                    ? "border-slate-400 text-slate-200"
                    : "border-transparent text-slate-600 hover:text-slate-400",
                )}
              >
                {d} dias
              </button>
            ))}
          </div>

          {total > 0 && (
            <div className="flex gap-6 text-right">
              <div>
                <p className="font-mono text-[19px] tabular-nums text-slate-100">{moeda(total)}</p>
                <p className="text-[10.5px] text-slate-600">investido</p>
              </div>
              <div>
                <p className="font-mono text-[19px] tabular-nums text-slate-100">
                  {conversasTotal > 0 ? moeda(total / conversasTotal) : "—"}
                </p>
                <p className="text-[10.5px] text-slate-600">média por conversa</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {!unitId && (
        <p className="mt-8 text-[13px] text-slate-500">Escolha uma unidade no seletor do topo.</p>
      )}
      {isLoading && <p className="mt-8 text-[13px] text-slate-600">consultando a Meta…</p>}
      {data && data.length === 0 && (
        <p className="mt-8 text-[13px] text-slate-500">
          Nenhum anúncio com entrega neste período, ou a conta de anúncios não está conectada.
        </p>
      )}

      <div className="divide-y divide-white/[0.05]">
        {campanhas.map((c) => {
          const abertaAqui = aberta === c.id;
          const fatia = total > 0 ? Math.round((c.gasto / total) * 100) : 0;

          return (
            <section key={c.id} className="py-4">
              <button
                onClick={() => setAberta(abertaAqui ? null : c.id)}
                className="flex w-full items-start gap-4 text-left"
              >
                <ChevronDown
                  className={cn(
                    "mt-1 h-4 w-4 shrink-0 text-slate-600 transition-transform",
                    !abertaAqui && "-rotate-90",
                  )}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-slate-100">{c.nome}</span>
                  <span className="mt-0.5 block text-[11.5px] text-slate-600">
                    {c.anuncios.length} anúncio{c.anuncios.length > 1 ? "s" : ""} ·{" "}
                    {c.conjuntos} conjunto{c.conjuntos > 1 ? "s" : ""}
                  </span>
                  {/* A barra dá o tamanho da campanha dentro do investimento. */}
                  <span className="mt-2 block h-[3px] w-full max-w-[280px] rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full bg-sky-400/50"
                      style={{ width: `${fatia}%` }}
                    />
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[16px] tabular-nums text-slate-100">
                    {moeda(c.gasto)}
                  </span>
                  <span className="block text-[10.5px] text-slate-600">{fatia}% do total</span>
                </span>

                <span className="w-[104px] shrink-0 text-right">
                  <span
                    className={cn(
                      "block font-mono text-[16px] tabular-nums",
                      c.custo == null
                        ? "text-slate-600"
                        : c.custo <= 14
                          ? "text-emerald-300"
                          : "text-amber-300",
                    )}
                  >
                    {c.custo != null ? moeda(c.custo) : "—"}
                  </span>
                  <span className="block text-[10.5px] text-slate-600">por conversa</span>
                </span>
              </button>

              {abertaAqui && (
                <ul className="mt-3 flex flex-col gap-2 border-l border-white/[0.07] pl-4">
                  {c.anuncios.map((a) => (
                    <li
                      key={a.anuncioId}
                      className="flex overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]"
                    >
                      {a.imagem ? (
                        <img
                          src={a.imagem}
                          alt=""
                          loading="lazy"
                          className="h-[104px] w-[104px] shrink-0 bg-white/[0.03] object-cover"
                        />
                      ) : (
                        <span className="grid h-[104px] w-[104px] shrink-0 place-items-center bg-white/[0.03] text-[10px] text-slate-600">
                          sem foto
                        </span>
                      )}

                      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] text-slate-200">{a.nome}</p>
                          {a.conjunto && (
                            <p className="truncate text-[10.5px] text-slate-600">{a.conjunto}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                          <Met k="gasto" v={moeda(a.gasto)} />
                          <Met k="alcance" v={nf.format(a.alcance)} />
                          <Met k="cliques" v={nf.format(a.cliques)} />
                          <Met k="CTR" v={`${a.ctr.toFixed(2)}%`} />
                          <Met k="conversas" v={nf.format(a.conversas)} />
                        </div>
                      </div>

                      <div className="flex w-[104px] shrink-0 flex-col items-center justify-center border-l border-white/[0.06] px-2">
                        <p
                          className={cn(
                            "font-mono text-[16px] tabular-nums",
                            a.custoPorConversa == null
                              ? "text-slate-600"
                              : a.custoPorConversa <= 14
                                ? "text-emerald-300"
                                : "text-amber-300",
                          )}
                        >
                          {a.custoPorConversa != null ? moeda(a.custoPorConversa) : "—"}
                        </p>
                        <p className="mt-0.5 text-center text-[9px] uppercase tracking-[0.08em] text-slate-600">
                          por conversa
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {data && data.length > 0 && (
        <p className="mt-6 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-slate-600">
          Conversa é conversa de WhatsApp iniciada, como a Meta conta — nem toda vira lead no
          CRM. Os números vêm da Meta no momento da consulta, com cache de 10 minutos.
        </p>
      )}
    </div>
  );
}

function Met({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[12.5px] font-medium leading-none tabular-nums text-slate-200">{v}</p>
      <p className="mt-0.5 text-[9.5px] text-slate-600">{k}</p>
    </div>
  );
}

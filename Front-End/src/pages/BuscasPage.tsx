import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronDown } from "@/components/icons";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useClinic } from "@/hooks/useClinic";

interface Item {
  leadId: number;
  nome?: string | null;
  telefone?: string | null;
  etapa?: string | null;
  quando: string;
}

interface Busca {
  id: string;
  titulo: string;
  porque: string;
  quantidade: number;
  percentual: number;
  itens: Item[];
}

const nf = new Intl.NumberFormat("pt-BR");

const dataBR = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * Perguntas prontas sobre a base.
 *
 * Filtro em branco exige que a pessoa já saiba o que procurar, e por isso quase ninguém usa.
 * Aqui cada linha é a pergunta escrita por extenso, com o número do lado — quem abre a página
 * descobre o que dava para perguntar.
 *
 * A ordem é pela quantidade: o maior buraco fica em cima sozinho, sem ninguém precisar
 * decidir o que é prioridade.
 */
export default function BuscasPage() {
  const { unitId } = useClinic();
  const [dias, setDias] = useState(30);
  const [aberta, setAberta] = useState<string | null>(null);

  const { de, ate } = useMemo(() => {
    const fim = new Date();
    const ini = new Date(fim.getTime() - dias * 24 * 3600_000);
    return { de: ini.toISOString(), ate: fim.toISOString() };
  }, [dias]);

  const { data, isLoading } = useQuery({
    queryKey: ["buscas", unitId, dias],
    queryFn: async () => {
      const { data } = await api.get<Busca[]>("/api/saude/buscas", {
        params: { de, ate, unitId },
      });
      return data;
    },
    enabled: !!unitId,
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <header className="border-b border-white/[0.08] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
          Buscas
        </p>
        <h1 className="mt-2 text-[22px] font-medium tracking-tight text-slate-100">
          O que dá para perguntar sobre a base
        </h1>
        <p className="mt-1.5 max-w-[56ch] text-[13px] leading-relaxed text-slate-500">
          Cada linha é uma pergunta com a resposta do lado. Clique para ver quem entra nela.
        </p>

        <div className="mt-4 flex gap-1">
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
      </header>

      {!unitId && (
        <p className="mt-8 text-[13px] text-slate-500">
          Escolha uma unidade — cada uma tem campos próprios.
        </p>
      )}

      {isLoading && <p className="mt-8 text-[13px] text-slate-600">contando…</p>}

      <div className="divide-y divide-white/[0.05]">
        {data?.map((b) => {
          const abertaAqui = aberta === b.id;
          const vazia = b.quantidade === 0;

          return (
            <section key={b.id} className={cn("py-4", vazia && "opacity-35")}>
              <button
                onClick={() => !vazia && setAberta(abertaAqui ? null : b.id)}
                className="flex w-full items-start gap-4 text-left"
                disabled={vazia}
              >
                <span className="w-[76px] shrink-0 text-right">
                  <span
                    className={cn(
                      "block font-mono text-[24px] leading-none tabular-nums",
                      vazia ? "text-slate-600" : "text-slate-100",
                    )}
                  >
                    {nf.format(b.quantidade)}
                  </span>
                  {/* O percentual dá tamanho ao número: 40 é muito ou pouco? */}
                  {!vazia && (
                    <span className="mt-1 block text-[10.5px] tabular-nums text-slate-600">
                      {b.percentual}% dos leads
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-slate-200">{b.titulo}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-slate-500">
                    {b.porque}
                  </span>
                </span>

                {!vazia && (
                  <ChevronDown
                    className={cn(
                      "mt-1 h-4 w-4 shrink-0 text-slate-600 transition-transform",
                      abertaAqui && "rotate-180",
                    )}
                  />
                )}
              </button>

              {abertaAqui && (
                <ul className="mt-3 max-h-[340px] overflow-y-auto border-l border-white/[0.07] pl-4">
                  {b.itens.map((i) => (
                    <li key={i.leadId} className="flex items-baseline gap-3 py-1.5">
                      <Link
                        to={`/leads/${i.leadId}`}
                        className="min-w-0 flex-1 truncate text-[12.5px] text-slate-300 transition hover:text-sky-300"
                      >
                        {i.nome?.trim() || "Sem nome"}
                      </Link>
                      {i.telefone && (
                        <span className="shrink-0 text-[11.5px] tabular-nums text-slate-500">
                          {i.telefone}
                        </span>
                      )}
                      <span className="hidden w-[150px] shrink-0 truncate text-[11px] text-slate-600 sm:block">
                        {(i.etapa ?? "").replace(/_/g, " ")}
                      </span>
                      <span className="w-[42px] shrink-0 text-right text-[11px] tabular-nums text-slate-600">
                        {dataBR(i.quando)}
                      </span>
                    </li>
                  ))}
                  {b.quantidade > b.itens.length && (
                    <li className="py-2 text-[11.5px] text-slate-600">
                      Mostrando {b.itens.length} de {nf.format(b.quantidade)}.
                    </li>
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

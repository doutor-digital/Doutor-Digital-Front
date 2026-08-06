import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Item {
  paciente?: string | null;
  profissional?: string | null;
  categoria?: string | null;
  quando: string;
  status?: string | null;
}

interface NoShow {
  agendados: number;
  compareceram: number;
  faltaram: number;
  desmarcados: number;
  remarcados: number;
  aindaPorVir: number;
  resolvidos: number;
  percentualFalta: number;
  percentualComparecimento: number;
  anteriorFaltaram: number;
  anteriorPercentualFalta: number;
  temAnterior: boolean;
  baldeSuspeito: boolean;
  avisoBalde?: string | null;
  faltas: Item[];
  desmarcadas: Item[];
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Falta na agenda da clínica.
 *
 * O CARD ANTIGO MOSTRAVA "1" E PARECIA QUEBRADO
 * ---------------------------------------------
 * Estava certo: existe exatamente um agendamento marcado como "Não compareceu" em 30 dias —
 * contra 48 "Desmarcado". A recepção usa Desmarcado para tudo. Um número correto que ninguém
 * consegue interpretar é pior que um erro, porque erro alguém corrige.
 *
 * Então o card passa a mostrar o desfecho inteiro, e a acusar o balde quando ele mascara.
 * Somar desmarcado à falta seria mais bonito e seria mentira: desmarcar na véspera dá tempo
 * de encaixar outro paciente; não aparecer no dia é hora perdida.
 */
export function NoShowCard({
  unitId,
  de,
  ate,
  className = "",
}: {
  unitId?: number | null;
  /** yyyy-MM-dd */
  de: string;
  ate: string;
  className?: string;
}) {
  const [lista, setLista] = useState<"nenhuma" | "faltas" | "desmarcadas">("nenhuma");

  const { data, isLoading } = useQuery({
    queryKey: ["no-show", unitId, de, ate],
    queryFn: async () => {
      const { data } = await api.get<NoShow>("/api/saude/no-show", {
        params: { de, ate, unitId },
      });
      return data;
    },
    enabled: !!unitId && !!de && !!ate,
  });

  const variacao = useMemo(() => {
    if (!data?.temAnterior) return null;
    const d = data.faltaram - data.anteriorFaltaram;
    return { d, pp: Math.round((data.percentualFalta - data.anteriorPercentualFalta) * 10) / 10 };
  }, [data]);

  if (!unitId) return null;

  const itens = lista === "faltas" ? data?.faltas : lista === "desmarcadas" ? data?.desmarcadas : null;

  return (
    <div className={cn("rounded-2xl bg-[#0f1f3a]/80 p-5 ring-1 ring-white/5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
          Faltas na agenda
        </p>
        {data && data.resolvidos > 0 && (
          <p className="text-[11px] tabular-nums text-white/40">
            {data.percentualComparecimento}% compareceram
          </p>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <p className="text-5xl font-bold leading-none text-rose-400">
          {isLoading ? "—" : data?.faltaram ?? 0}
        </p>
        {data && data.resolvidos > 0 && (
          <p className="text-[13px] tabular-nums text-white/50">
            {data.percentualFalta}% de {data.resolvidos} que já aconteceram
          </p>
        )}
      </div>

      {/* Comparativo: só aparece quando existe período anterior de verdade. */}
      {variacao && (
        <p className="mt-2 text-[11.5px] tabular-nums text-white/45">
          {variacao.d === 0
            ? "igual ao período anterior"
            : `${variacao.d > 0 ? "▲" : "▼"} ${Math.abs(variacao.d)} vs. período anterior`}
          {variacao.pp !== 0 && (
            <span className={cn("ml-1.5", variacao.pp > 0 ? "text-rose-300/80" : "text-emerald-300/80")}>
              ({variacao.pp > 0 ? "+" : ""}
              {variacao.pp} p.p.)
            </span>
          )}
        </p>
      )}

      <div className="mt-3 h-px w-1/3 bg-white/10" />

      {/* O desfecho inteiro: é isso que torna o número interpretável. */}
      {data && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
          <Linha k="Agendados no período" v={data.agendados} />
          <Linha k="Compareceram" v={data.compareceram} tom="ok" />
          <Linha
            k="Faltaram"
            v={data.faltaram}
            tom="ruim"
            onClick={data.faltas.length ? () => setLista(lista === "faltas" ? "nenhuma" : "faltas") : undefined}
          />
          <Linha
            k="Desmarcados"
            v={data.desmarcados}
            tom={data.baldeSuspeito ? "atencao" : undefined}
            onClick={
              data.desmarcadas.length
                ? () => setLista(lista === "desmarcadas" ? "nenhuma" : "desmarcadas")
                : undefined
            }
          />
          {data.remarcados > 0 && <Linha k="Remarcados" v={data.remarcados} />}
          {data.aindaPorVir > 0 && <Linha k="Ainda por vir" v={data.aindaPorVir} />}
        </dl>
      )}

      {/* O aviso que explica por que o número grande é pequeno. */}
      {data?.avisoBalde && (
        <p className="mt-3 border-l-2 border-amber-400/40 pl-2.5 text-[11px] leading-relaxed text-amber-200/80">
          {data.avisoBalde}
        </p>
      )}

      {itens && itens.length > 0 && (
        <ul className="mt-3 max-h-56 divide-y divide-white/[0.05] overflow-y-auto border-t border-white/[0.06] pt-1">
          {itens.map((i, n) => (
            <li key={`${i.paciente}-${n}`} className="py-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12px] text-white/85">
                  {i.paciente?.trim() || "Sem nome"}
                </span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-white/40">
                  {dataHora(i.quando)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-2 text-[10.5px] text-white/40">
                {i.categoria && <span>{i.categoria}</span>}
                {i.profissional && <span>· {i.profissional}</span>}
                {i.status && <span>· {i.status}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[10px] text-white/30">
        Fonte: agenda do CRM da franquia, pelo dia do atendimento.
      </p>
    </div>
  );
}

function Linha({
  k,
  v,
  tom,
  onClick,
}: {
  k: string;
  v: number;
  tom?: "ok" | "ruim" | "atencao";
  onClick?: () => void;
}) {
  const cor =
    tom === "ok" ? "text-emerald-300" : tom === "ruim" ? "text-rose-300" : tom === "atencao" ? "text-amber-300" : "text-white/80";
  const conteudo = (
    <>
      <dt className="text-[11px] text-white/45">{k}</dt>
      <dd className={cn("text-[15px] font-medium tabular-nums", cor)}>{v}</dd>
    </>
  );
  return onClick ? (
    <button onClick={onClick} className="text-left transition hover:opacity-80" title="Ver quem">
      {conteudo}
    </button>
  ) : (
    <div>{conteudo}</div>
  );
}

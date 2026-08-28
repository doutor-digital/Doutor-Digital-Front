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
  anteriorAgendados: number;
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
 * A agenda que não aconteceu.
 *
 * POR QUE O NÚMERO GRANDE NÃO É "FALTA"
 * -------------------------------------
 * Liderar com falta dava ZERO: esta clínica não usa o status "Não compareceu", marca tudo
 * como Desmarcado. O card abria com 0 num período em que 25 horários se perderam — e um card
 * que abre com zero quando há problema ensina a equipe a ignorá-lo.
 *
 * Então o número grande é o horário perdido: desmarcado + remarcado + falta. Todos têm o
 * mesmo efeito prático — a hora ficou vazia e ninguém foi atendido. "Não aconteceu" é
 * literalmente verdade e não inventa classificação nenhuma; a quebra logo abaixo diz o
 * motivo de cada um, e o aviso explica quando o balde está mascarando falta.
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

  // Horário perdido: desmarcado, remarcado ou falta. Todos têm o mesmo efeito na
  // agenda — a hora ficou vazia. O motivo aparece na quebra, mas o total é um só.
  const naoAconteceram = data
    ? data.desmarcados + data.remarcados + data.faltaram
    : 0;
  const pctPerdido =
    data && data.resolvidos > 0
      ? Math.round((naoAconteceram / data.resolvidos) * 1000) / 10
      : 0;

  const variacao = useMemo(() => {
    if (!data?.temAnterior) return null;
    return { agendados: data.anteriorAgendados };
  }, [data]);

  if (!unitId) return null;

  const itens = lista === "faltas" ? data?.faltas : lista === "desmarcadas" ? data?.desmarcadas : null;

  return (
    <div className={cn("rounded-2xl bg-white p-5 ring-1 ring-slate-200", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Agenda que não aconteceu
        </p>
        {data && data.resolvidos > 0 && (
          <p className="text-[11px] tabular-nums text-slate-400">
            {data.compareceram} de {data.resolvidos} atenderam
          </p>
        )}
      </div>

      {/* O número grande é o que NÃO aconteceu, e não só a falta registrada.
          Liderar com "falta" dava zero: esta clínica não usa esse status, marca
          tudo como desmarcado. Um card que abre com 0 num mês em que 25 horários
          foram perdidos ensina a ignorar o card. "Não aconteceu" é literalmente
          verdade e não inventa classificação nenhuma — a quebra logo abaixo diz
          o motivo de cada um. */}
      <div className="mt-3 flex items-baseline gap-3">
        <p className="text-5xl font-bold leading-none text-rose-400">
          {isLoading ? "—" : naoAconteceram}
        </p>
        {data && data.resolvidos > 0 && (
          <p className="text-[13px] leading-snug text-slate-500">
            <span className="tabular-nums">{pctPerdido}%</span> dos {data.resolvidos} horários
            <br />
            que já passaram
          </p>
        )}
      </div>

      {/* Comparativo: só aparece quando existe período anterior de verdade. */}
      {variacao && (
        <p className="mt-2 text-[11.5px] tabular-nums text-slate-400">
          Período anterior: {variacao.agendados} agendados
        </p>
      )}

      <div className="mt-3 h-px w-1/3 bg-slate-100" />

      {/* O desfecho inteiro: é isso que torna o número interpretável. */}
      {data && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
          <Linha k="Agendados no período" v={data.agendados} />
          <Linha k="Compareceram" v={data.compareceram} tom="ok" />
          {/* Estes três somam o número grande. */}
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
        <ul className="mt-3 max-h-56 divide-y divide-slate-200] overflow-y-auto border-t border-slate-200 pt-1">
          {itens.map((i, n) => (
            <li key={`${i.paciente}-${n}`} className="py-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12px] text-slate-700">
                  {i.paciente?.trim() || "Sem nome"}
                </span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-slate-400">
                  {dataHora(i.quando)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-2 text-[10.5px] text-slate-400">
                {i.categoria && <span>{i.categoria}</span>}
                {i.profissional && <span>· {i.profissional}</span>}
                {i.status && <span>· {i.status}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[10px] text-slate-400">
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
    tom === "ok" ? "text-emerald-300" : tom === "ruim" ? "text-rose-300" : tom === "atencao" ? "text-amber-300" : "text-slate-700";
  const conteudo = (
    <>
      <dt className="text-[11px] text-slate-500">{k}</dt>
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

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AgendaCategoria {
  categoria: string;
  quantidade: number;
  compareceram: number;
  faltaram: number;
  /** Ainda vai acontecer — é a fila da recepção. */
  pendentes: number;
}

interface AgendaDoDia {
  dia: string;
  totalNaClinica: number;
  porCategoria: AgendaCategoria[];
  avaliacoesFranquia: number;
  agendadosKommo: number;
  nota: string;
}

/**
 * O que a clínica tem marcado hoje, e o que a Kommo diz do mesmo dia.
 *
 * Em 05/08 a tela da franquia mostrava 4 avaliações e o relatório da Kommo, 0. Os dois
 * estavam certos: são perguntas diferentes — a franquia conta consulta que ACONTECE hoje, a
 * Kommo conta lead que ENTROU hoje e agendou. Um paciente agendado dia 01 para vir dia 05
 * aparece só de um lado.
 *
 * Mas isso só apareceu porque alguém abriu os dois sistemas e comparou na mão. Divergência
 * entre CRM comercial e sistema clínico é o erro mais caro que existe aqui, e é invisível
 * enquanto ninguém faz esse trabalho. Aqui os dois ficam lado a lado, cada um com o rótulo
 * do que mede.
 */
export function AgendaDoDiaCard({ unitId }: { unitId?: number | null }) {
  const { data } = useQuery({
    queryKey: ["agenda-do-dia", unitId],
    queryFn: async () => {
      const { data } = await api.get<AgendaDoDia>("/api/saude/agenda-do-dia", {
        params: unitId ? { unitId } : {},
      });
      return data;
    },
    enabled: !!unitId,
    staleTime: 5 * 60_000,
  });

  if (!data || data.totalNaClinica === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Hoje na clínica
        </p>
        <span className="text-[11.5px] text-slate-500">
          <span className="tabular-nums text-slate-300">{data.avaliacoesFranquia}</span> avaliações
          na franquia
          <span className="mx-1.5 text-slate-700">·</span>
          <span className="tabular-nums text-slate-300">{data.agendadosKommo}</span> agendados hoje
          na Kommo
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.porCategoria.map((c) => (
          <div
            key={c.categoria}
            className="min-w-[132px] flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[11.5px] text-slate-400">{c.categoria}</span>
              <span className="text-[19px] font-semibold leading-none tabular-nums text-slate-100">
                {c.quantidade}
              </span>
            </div>

            {/* Compareceu / faltou / ainda vem: é o que a recepção precisa saber
                às 14h, não no fechamento do mês. */}
            <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px]">
              {c.compareceram > 0 && (
                <Marca cor="emerald" label={`${c.compareceram} compareceu`} />
              )}
              {c.faltaram > 0 && <Marca cor="rose" label={`${c.faltaram} faltou`} />}
              {c.pendentes > 0 && <Marca cor="slate" label={`${c.pendentes} a vir`} />}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-[10.5px] leading-snug text-slate-600">{data.nota}</p>
    </div>
  );
}

function Marca({ cor, label }: { cor: "emerald" | "rose" | "slate"; label: string }) {
  const cores = {
    emerald: "text-emerald-400/80",
    rose: "text-rose-400/80",
    slate: "text-slate-500",
  } as const;
  return <span className={cn("tabular-nums", cores[cor])}>{label}</span>;
}

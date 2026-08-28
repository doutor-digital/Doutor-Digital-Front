import { CalendarDays } from "@/components/icons";
import type { OrigemAgrupada } from "@/types";

interface Props {
  total?: number;
  sabado?: number;
  domingo?: number;
  origens?: OrigemAgrupada[];
  loading?: boolean;
  className?: string;
}

/**
 * Leads que entraram no fim de semana, dentro do período selecionado.
 *
 * Sábado e domingo seguem o relógio comercial (o dia da clínica vai das 19h às
 * 19h), então sexta 22h já conta como sábado — igual ao resto das métricas por
 * dia. O card existe porque esse é o público que ninguém atendeu na hora: mostra
 * o volume e de onde veio, para a retomada de segunda saber por onde começar.
 */
export function LeadsFimDeSemanaCard({
  total = 0,
  sabado = 0,
  domingo = 0,
  origens = [],
  loading = false,
  className = "",
}: Props) {
  const top = origens.slice(0, 6);
  const maior = top[0]?.quantidade ?? 0;

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[#0d1526] p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Leads do fim de semana</h3>
          <p className="text-xs text-slate-400">
            Sábado e domingo no período · dia comercial 19h→19h
          </p>
        </div>
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.08]">
          <CalendarDays className="h-4 w-4" />
        </div>
      </div>

      {loading ? (
        <div className="h-28 w-full animate-pulse rounded-lg bg-white/5" />
      ) : (
        <>
          <div className="flex items-end gap-5">
            <p className="text-5xl font-bold leading-none tabular-nums text-white">
              {total.toLocaleString("pt-BR")}
            </p>
            <div className="mb-1 flex gap-4 text-xs text-slate-400">
              <span>
                Sáb <span className="font-semibold tabular-nums text-slate-200">{sabado}</span>
              </span>
              <span>
                Dom <span className="font-semibold tabular-nums text-slate-200">{domingo}</span>
              </span>
            </div>
          </div>

          {total === 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              Nenhum lead entrou no fim de semana neste período.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {top.map((o) => (
                <div key={o.origem} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-xs text-slate-300" title={o.origem}>
                    {o.origem}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-sky-400/70"
                      style={{ width: `${maior > 0 ? (o.quantidade / maior) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-200">
                    {o.quantidade}
                  </span>
                </div>
              ))}
              {origens.length > top.length && (
                <p className="pt-1 text-[11px] text-slate-500">
                  +{origens.length - top.length} outras origens
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

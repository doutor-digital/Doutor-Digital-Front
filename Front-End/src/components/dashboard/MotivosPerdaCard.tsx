interface Motivo {
  motivo: string;
  quantidade: number;
}

interface Props {
  motivos?: Motivo[];
  loading?: boolean;
  className?: string;
}

/**
 * Por que os leads não agendaram, do campo "Motivo do não agendamento" da Kommo.
 *
 * "Perdemos 3.700 leads" não muda nada; "perdemos 74 por plano de saúde e 2.092 por
 * falta de continuidade" muda — o primeiro vira negociação de convênio, o segundo vira
 * régua de follow-up. Por isso o card ranqueia o motivo, e não o volume.
 */
export function MotivosPerdaCard({ motivos = [], loading = false, className = "" }: Props) {
  const total = motivos.reduce((s, m) => s + m.quantidade, 0);
  const maior = motivos[0]?.quantidade ?? 0;

  return (
    <div className={`rounded-2xl border border-white/10 bg-[#0d1526] p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Motivos de não agendamento</h3>
          <p className="text-xs text-slate-400">Campo preenchido pela SDR no cartão</p>
        </div>
        {total > 0 && (
          <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-medium text-slate-300">
            {total.toLocaleString("pt-BR")} classificados
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-32 w-full animate-pulse rounded-lg bg-white/5" />
      ) : motivos.length === 0 ? (
        <p className="text-xs text-slate-500">
          Nenhum motivo preenchido no período. Sem isso, a perda fica sem diagnóstico.
        </p>
      ) : (
        <div className="space-y-2.5">
          {motivos.map((m) => (
            <div key={m.motivo} className="flex items-center gap-3">
              <span className="w-44 shrink-0 truncate text-xs text-slate-300" title={m.motivo}>
                {m.motivo}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-rose-400/70"
                  style={{ width: `${maior > 0 ? (m.quantidade / maior) * 100 : 0}%` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-200">
                {m.quantidade.toLocaleString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

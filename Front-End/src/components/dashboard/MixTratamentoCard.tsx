interface Item {
  tratamento: string;
  quantidade: number;
}

interface Props {
  itens?: Item[];
  loading?: boolean;
  className?: string;
}

/**
 * Mix de tratamento indicado no período (campo multiselect da Kommo).
 *
 * Preventivo, manutenção, descompressão e crônico têm duração e ticket diferentes:
 * o mix explica variação de receita que o número de fechamentos sozinho não explica —
 * um mês pode fechar menos tratamentos e faturar mais.
 */
export function MixTratamentoCard({ itens = [], loading = false, className = "" }: Props) {
  const total = itens.reduce((s, i) => s + i.quantidade, 0);
  const maior = itens[0]?.quantidade ?? 0;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white border border-slate-200 p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Mix de tratamento indicado</h3>
          <p className="text-xs text-slate-400">O que a clínica está indicando no período</p>
        </div>
        {total > 0 && (
          <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-300">
            {total.toLocaleString("pt-BR")} indicações
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-32 w-full animate-pulse rounded-lg bg-slate-50" />
      ) : itens.length === 0 ? (
        <p className="text-xs text-slate-500">
          Nenhum tratamento indicado preenchido no período.
        </p>
      ) : (
        <div className="space-y-2.5">
          {itens.map((i) => (
            <div key={i.tratamento} className="flex items-center gap-3">
              <span className="w-48 shrink-0 truncate text-xs text-slate-300" title={i.tratamento}>
                {i.tratamento}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-50">
                <div
                  className="h-full rounded-full bg-violet-400/70"
                  style={{ width: `${maior > 0 ? (i.quantidade / maior) * 100 : 0}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-200">
                {i.quantidade.toLocaleString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

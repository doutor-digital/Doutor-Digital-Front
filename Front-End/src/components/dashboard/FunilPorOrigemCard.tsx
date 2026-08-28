interface Linha {
  origem: string;
  total: number;
  agendados: number;
  fechados: number;
}

interface Props {
  linhas?: Linha[];
  loading?: boolean;
  className?: string;
}

const pct = (parte: number, todo: number) => (todo > 0 ? (parte / todo) * 100 : 0);

/**
 * Funil condensado por origem: de cada mídia, quantos leads viraram agendamento e
 * quantos viraram tratamento.
 *
 * O gráfico de origem tradicional mostra volume, e volume engana: a mídia que traz
 * mais lead costuma não ser a que traz mais paciente. Aqui a coluna que importa é a
 * taxa, não o total — é ela que diz onde vale colocar verba.
 *
 * A origem vem do custom field da Kommo. A coluna `Source` do lead não serve: guarda
 * o sistema de origem do dado ("Kommo") e é igual para todo mundo.
 */
export function FunilPorOrigemCard({ linhas = [], loading = false, className = "" }: Props) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[#0d1526] p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Funil por origem</h3>
        <p className="text-xs text-slate-400">
          Quantos de cada mídia chegam a agendar e a fechar
        </p>
      </div>

      {loading ? (
        <div className="h-40 w-full animate-pulse rounded-lg bg-white/5" />
      ) : linhas.length === 0 ? (
        <p className="text-xs text-slate-500">Sem origem preenchida no período.</p>
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[440px] text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-1 pb-2 font-medium">Origem</th>
                  <th className="px-1 pb-2 text-right font-medium">Leads</th>
                  <th className="px-1 pb-2 text-right font-medium">Agendou</th>
                  <th className="px-1 pb-2 text-right font-medium">Fechou</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const taxaAg = pct(l.agendados, l.total);
                  const taxaFe = pct(l.fechados, l.total);
                  return (
                    <tr key={l.origem} className="border-t border-white/[0.06]">
                      <td className="max-w-[180px] truncate px-1 py-2 text-xs text-slate-200" title={l.origem}>
                        {l.origem}
                      </td>
                      <td className="px-1 py-2 text-right text-xs tabular-nums text-slate-400">
                        {l.total.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-1 py-2 text-right text-xs tabular-nums">
                        <span className="font-semibold text-sky-300">{taxaAg.toFixed(1)}%</span>
                        <span className="ml-1 text-slate-600">({l.agendados})</span>
                      </td>
                      <td className="px-1 py-2 text-right text-xs tabular-nums">
                        <span className="font-semibold text-emerald-300">{taxaFe.toFixed(1)}%</span>
                        <span className="ml-1 text-slate-600">({l.fechados})</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Aqui havia uma frase de "melhor taxa de agendamento". Saiu por estar
              errada: ela escolhia a origem por VOLUME e chamava o resultado de melhor
              TAXA — apontava Meta-Facebook com 9,6% enquanto a própria tabela acima
              mostrava Google com 85,7%. A tabela já ordena e já mostra as duas taxas;
              quem lê tira a conclusão sozinho, e sem correr o risco de ler o oposto
              do que o dado diz. */}
        </>
      )}
    </div>
  );
}

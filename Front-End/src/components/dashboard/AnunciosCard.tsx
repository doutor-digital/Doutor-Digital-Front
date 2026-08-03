interface Linha {
  anuncio: string;
  total: number;
  agendados: number;
}

interface Props {
  linhas?: Linha[];
  loading?: boolean;
  className?: string;
}

const pct = (parte: number, todo: number) => (todo > 0 ? (parte / todo) * 100 : 0);

/**
 * A base histórica só guarda o id numérico do anúncio; o nome só existe quando o
 * rastreio conseguiu resolver na Meta. Id cru sozinho parece lixo na tela, então
 * ganha o rótulo — e continua sendo pesquisável no Gerenciador de Anúncios.
 */
const rotulo = (v: string) => (/^\d{8,}$/.test(v) ? `Anúncio ${v}` : v);

/**
 * Ranking dos anúncios que mais trouxeram lead no período, com quantos deles agendaram.
 *
 * O dado vem do rastreio de campanha (Click-to-WhatsApp): quando o paciente chega pelo
 * anúncio, a Meta manda o `referral` junto da primeira mensagem e o fluxo grava o anúncio
 * no cartão da Kommo. Unidade sem esse rastreio ligado não tem o que mostrar — por isso o
 * card some em vez de exibir uma tabela vazia.
 *
 * As duas colunas andam juntas de propósito. Volume sozinho manda verba para o anúncio
 * errado: o que traz mais conversa costuma ser o que traz conversa mais barata, não
 * paciente. Quem decide investimento é a taxa de agendamento.
 */
export function AnunciosCard({ linhas = [], loading = false, className = "" }: Props) {
  if (!loading && linhas.length === 0) return null;

  const maior = Math.max(1, ...linhas.map((l) => l.total));

  // Só compara taxa entre anúncios com volume — com 3 leads a taxa oscila demais
  // para virar decisão de verba.
  const relevantes = linhas.filter((l) => l.total >= 10);
  const melhor = relevantes.reduce<Linha | null>(
    (acc, l) => (acc == null || pct(l.agendados, l.total) > pct(acc.agendados, acc.total) ? l : acc),
    null,
  );
  const pior = relevantes.reduce<Linha | null>(
    (acc, l) => (acc == null || pct(l.agendados, l.total) < pct(acc.agendados, acc.total) ? l : acc),
    null,
  );

  return (
    <div className={`rounded-2xl border border-white/10 bg-[#0d1526] p-5 ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Anúncios que mais trazem lead</h3>
          <p className="text-xs text-slate-400">
            De cada anúncio: quantos pacientes chegaram e quantos agendaram
          </p>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-600">
          Click-to-WhatsApp
        </span>
      </div>

      {loading ? (
        <div className="h-48 w-full animate-pulse rounded-lg bg-white/5" />
      ) : (
        <>
          <div className="space-y-3">
            {linhas.map((l) => {
              const taxa = pct(l.agendados, l.total);
              return (
                <div key={l.anuncio}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="truncate text-xs text-slate-200" title={l.anuncio}>
                      {rotulo(l.anuncio)}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-400">
                      {l.total.toLocaleString("pt-BR")} leads
                      <span className="mx-1.5 text-slate-700">·</span>
                      <span className="font-semibold text-sky-300">{l.agendados}</span>
                      <span className="ml-1 text-slate-500">agendaram ({taxa.toFixed(0)}%)</span>
                    </span>
                  </div>
                  {/* Barra cheia = volume de lead; a parte clara = quem agendou.
                      Ler o vazio entre as duas é o ponto do card. */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-slate-600/70"
                      style={{ width: `${(l.total / maior) * 100}%` }}
                    >
                      <div
                        className="h-full rounded-full bg-sky-400"
                        style={{ width: `${taxa}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {melhor && pior && melhor.anuncio !== pior.anuncio && (
            <p className="mt-4 text-[11px] leading-snug text-slate-500">
              Melhor conversão: <span className="text-slate-300">{rotulo(melhor.anuncio)}</span> (
              {pct(melhor.agendados, melhor.total).toFixed(0)}%). Pior:{" "}
              <span className="text-slate-300">{rotulo(pior.anuncio)}</span> (
              {pct(pior.agendados, pior.total).toFixed(0)}%). Anúncio com muito lead e pouco
              agendamento é verba gastando conversa, não paciente.
            </p>
          )}
        </>
      )}
    </div>
  );
}

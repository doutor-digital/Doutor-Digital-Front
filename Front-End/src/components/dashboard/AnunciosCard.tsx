import { useState } from "react";

interface Linha {
  anuncio: string;
  total: number;
  agendados: number;
  /** Nome do anúncio na Meta — só existe com a conta de anúncios conectada. */
  nome?: string | null;
  /** Miniatura do criativo (CDN da Meta). */
  thumbnail?: string | null;
  /** Link para a peça no Facebook/Instagram. */
  permalink?: string | null;
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
 * Criativo em quadrado, no formato de post.
 *
 * A URL vem assinada pela CDN da Meta e expira; o back revalida por idade, mas entre
 * uma revalidação e outra ela pode morrer. Imagem quebrada cai para o mesmo quadro
 * neutro de quem nunca teve criativo — com o nome dentro, que é mais útil que um
 * ícone de imagem partida.
 */
function Criativo({
  src,
  href,
  alt,
  className = "",
}: {
  src?: string | null;
  href?: string | null;
  alt: string;
  className?: string;
}) {
  const [quebrou, setQuebrou] = useState(false);
  const temImagem = Boolean(src) && !quebrou;

  const quadro = (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 ${className}`}
    >
      {temImagem ? (
        <img
          src={src!}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setQuebrou(true)}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[10px] leading-tight text-slate-600">
          {alt}
        </span>
      )}
    </div>
  );

  if (!href) return quadro;
  return (
    <a href={href} target="_blank" rel="noreferrer" title="Ver a peça no Facebook" className="block">
      {quadro}
    </a>
  );
}

/** Os dois números do card, com o mesmo peso: volume e agendamento. */
function Numeros({ total, agendados }: { total: number; agendados: number }) {
  const taxa = pct(agendados, total);
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <div>
        <div className="text-lg font-semibold leading-none tabular-nums text-slate-100">
          {total.toLocaleString("pt-BR")}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">leads</div>
      </div>
      <div>
        <div className="text-lg font-semibold leading-none tabular-nums text-sky-300">
          {agendados.toLocaleString("pt-BR")}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
          agendaram · {taxa.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

/**
 * Ranking dos anúncios que mais trouxeram lead no período, com quantos deles agendaram.
 *
 * O dado vem do rastreio de campanha (Click-to-WhatsApp): quando o paciente chega pelo
 * anúncio, a Meta manda o `referral` junto da primeira mensagem e o fluxo grava o anúncio
 * no cartão da Kommo. Unidade sem esse rastreio ligado não tem o que mostrar — por isso o
 * card some em vez de exibir uma tabela vazia.
 *
 * Os três primeiros ganham a peça inteira; o resto vira lista. É onde a verba está
 * concentrada, e é o que a pessoa precisa reconhecer de longe. Os dois números andam
 * juntos e com o mesmo peso de propósito: volume sozinho manda verba para o anúncio
 * errado — o que traz mais conversa costuma trazer conversa barata, não paciente.
 */
export function AnunciosCard({ linhas = [], loading = false, className = "" }: Props) {
  if (!loading && linhas.length === 0) return null;

  const podio = linhas.slice(0, 3);
  const resto = linhas.slice(3);

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

  const titulo = (l: Linha) => l.nome?.trim() || rotulo(l.anuncio);

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white border border-slate-200 p-5 ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Anúncios que mais trazem lead</h3>
          <p className="text-xs text-slate-400">
            De cada anúncio: quantos pacientes chegaram e quantos agendaram
          </p>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-600">
          Click-to-WhatsApp
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-square w-full animate-pulse rounded-lg bg-slate-50" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {podio.map((l) => (
              <div key={l.anuncio} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <Criativo src={l.thumbnail} href={l.permalink} alt={titulo(l)} />
                <p className="mt-2 truncate text-xs text-slate-200" title={titulo(l)}>
                  {titulo(l)}
                </p>
                <Numeros total={l.total} agendados={l.agendados} />
              </div>
            ))}
          </div>

          {resto.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-1">
              {resto.map((l) => (
                <div
                  key={l.anuncio}
                  className="flex items-center gap-3 border-b border-slate-200 py-2 last:border-b-0"
                >
                  <div className="w-8 shrink-0">
                    <Criativo src={l.thumbnail} href={l.permalink} alt="" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-300" title={titulo(l)}>
                    {titulo(l)}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">
                    {l.total.toLocaleString("pt-BR")} leads
                    <span className="mx-1.5 text-slate-700">·</span>
                    <span className="text-sky-300">{l.agendados}</span> agendaram
                  </span>
                </div>
              ))}
            </div>
          )}

          {melhor && pior && melhor.anuncio !== pior.anuncio && (
            <p className="mt-4 text-[11px] leading-snug text-slate-500">
              Melhor conversão: <span className="text-slate-300">{titulo(melhor)}</span> (
              {pct(melhor.agendados, melhor.total).toFixed(0)}%). Pior:{" "}
              <span className="text-slate-300">{titulo(pior)}</span> (
              {pct(pior.agendados, pior.total).toFixed(0)}%). Anúncio com muito lead e pouco
              agendamento é verba gastando conversa, não paciente.
            </p>
          )}
        </>
      )}
    </div>
  );
}

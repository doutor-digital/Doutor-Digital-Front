import { useState, type ReactNode } from "react";
import { ChevronDown } from "@/components/icons";

interface Props {
  titulo: string;
  /** Uma linha dizendo que pergunta a seção responde. */
  subtitulo?: string;
  /** Começa fechada — para seções de consulta, não de acompanhamento diário. */
  recolhivel?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Faixa do dashboard: um título curto e o conjunto de cards que responde à mesma
 * pergunta.
 *
 * A página tinha vinte e poucos cards em sequência, sem nenhuma marcação de assunto —
 * quem abria precisava ler todos para achar o que queria. O agrupamento não remove nem
 * altera card nenhum; só diz onde cada assunto começa.
 *
 * Seções marcadas como recolhíveis nascem fechadas. São as que alguém abre quando tem
 * uma pergunta específica, não as que se olha todo dia — e é o que devolve o topo da
 * página para os números de gestão.
 */
export function SecaoDashboard({
  titulo,
  subtitulo,
  recolhivel = false,
  children,
  className = "",
}: Props) {
  const [aberta, setAberta] = useState(!recolhivel);

  return (
    <section className={`mt-8 ${className}`}>
      <div className="mb-3 flex items-center gap-3">
        {recolhivel ? (
          <button
            type="button"
            onClick={() => setAberta((v) => !v)}
            className="group flex items-center gap-2 text-left"
            aria-expanded={aberta}
          >
            <ChevronDown
              className={`h-4 w-4 text-white/40 transition-transform group-hover:text-white/70 ${
                aberta ? "" : "-rotate-90"
              }`}
            />
            <span>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                {titulo}
              </h2>
              {subtitulo && <p className="text-[11px] text-white/35">{subtitulo}</p>}
            </span>
          </button>
        ) : (
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              {titulo}
            </h2>
            {subtitulo && <p className="text-[11px] text-white/35">{subtitulo}</p>}
          </div>
        )}
        <div className="h-px flex-1 bg-white/[0.07]" />
      </div>

      {aberta && children}
    </section>
  );
}

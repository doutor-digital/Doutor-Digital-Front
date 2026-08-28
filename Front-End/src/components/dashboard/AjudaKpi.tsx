import { useEffect, useId, useRef, useState } from "react";

interface Props {
  /** Nome do KPI, repetido no rótulo acessível e no topo da explicação. */
  titulo: string;
  /** O que o número é, em uma ou duas frases, sem jargão. */
  texto: string;
}

/**
 * O "?" ao lado do nome de um KPI.
 *
 * POR QUE ELE EXISTE
 * ------------------
 * Todo número desta tela responde a uma pergunta específica, e quase todos têm um
 * recorte que não é óbvio pelo nome. "Agendados" não conta sessão de tratamento;
 * "Consultas" é quem compareceu de verdade, não quem marcou. Sem isso escrito, cada
 * pessoa preenche a lacuna com um palpite diferente — e é assim que duas pessoas
 * olham o mesmo painel e discordam do que ele diz.
 *
 * ABRE POR CLIQUE, NÃO POR PASSAR O MOUSE
 * ---------------------------------------
 * Hover não existe no celular e some antes de terminar a leitura. Clique fica aberto
 * até a pessoa fechar — Esc, clicar fora, ou clicar de novo no "?".
 */
export function AjudaKpi({ titulo, texto }: Props) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!aberto) return;

    const foraDaCaixa = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };

    document.addEventListener("mousedown", foraDaCaixa);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", foraDaCaixa);
      document.removeEventListener("keydown", escape);
    };
  }, [aberto]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        aria-label={`O que é ${titulo}`}
        className={`grid h-[15px] w-[15px] place-items-center rounded-full text-[9.5px] font-bold leading-none transition ${
          aberto
            ? "bg-[#0086f7] text-white"
            : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
        }`}
      >
        ?
      </button>

      {aberto && (
        <span
          id={id}
          role="note"
          className="absolute left-0 top-[21px] z-30 block w-[min(19rem,72vw)] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-[0_8px_28px_rgba(14,22,32,.14)]"
        >
          <b className="mb-1 block text-[11.5px] font-extrabold tracking-tight text-slate-900">
            {titulo}
          </b>
          <span className="block text-[11.5px] leading-relaxed text-slate-600">{texto}</span>
        </span>
      )}
    </span>
  );
}

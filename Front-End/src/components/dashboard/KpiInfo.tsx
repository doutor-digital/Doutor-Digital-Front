import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GLOSSARIO_KPI, ORDEM_TUTORIAL, type VerbeteKpi } from "@/lib/kpi-glossario";

/* ─────────────────────────────────────────────────────────────────────────────
   O "?" ao lado de cada KPI, o modal que ele abre, e o tutorial que percorre
   todos eles. Os três leem o MESMO glossário — ver o comentário em
   src/lib/kpi-glossario.ts sobre por que isso importa.
   ───────────────────────────────────────────────────────────────────────────── */

/** Fecha no Esc e trava o scroll do fundo enquanto o modal está aberto. */
function useModalAberto(aberto: boolean, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("keydown", esc);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = overflowAntes;
    };
  }, [aberto, fechar]);
}

function Moldura({
  children,
  fechar,
  rotulo,
}: {
  children: React.ReactNode;
  fechar: () => void;
  rotulo: string;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={fechar}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={rotulo}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0f1f3a] p-6 shadow-2xl sm:rounded-3xl"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

const CORES_FONTE: Record<VerbeteKpi["fonte"], string> = {
  Kommo: "bg-amber-400/15 text-amber-300 ring-amber-400/25",
  Franquia: "bg-sky-400/15 text-sky-300 ring-sky-400/25",
  "Kommo + Franquia": "bg-violet-400/15 text-violet-300 ring-violet-400/25",
};

function Verbete({ v }: { v: VerbeteKpi }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[19px] font-bold tracking-tight text-white">{v.titulo}</h2>
        <span
          className={`rounded-md px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] ring-1 ${CORES_FONTE[v.fonte]}`}
        >
          {v.fonte}
        </span>
      </div>

      <p className="mt-4 text-[14px] leading-relaxed text-white/85">{v.resumo}</p>

      <div className="mt-5 flex flex-col gap-4 border-t border-white/[0.08] pt-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
            Como ler
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{v.comoLer}</p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
            De onde vem
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{v.fonteDetalhe}</p>
        </div>

        {/* O "cuidado" só aparece quando existe. Um aviso em todo card ensina a ignorar avisos. */}
        {v.cuidado && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/80">
              Cuidado
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-amber-100/80">{v.cuidado}</p>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * O rótulo de um KPI com o "?" do lado. Substitui o `<p>` do rótulo no card.
 * `kpiKey` casa com uma chave do glossário; sem verbete, só o rótulo aparece.
 */
export function RotuloKpi({
  kpiKey,
  children,
  className = "",
}: {
  kpiKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const v = GLOSSARIO_KPI[kpiKey];
  useModalAberto(aberto, () => setAberto(false));

  return (
    <>
      <p
        className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60 ${className}`}
      >
        {children}
        {v && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-label={`O que é ${v.titulo}`}
            className="grid h-[15px] w-[15px] flex-none place-items-center rounded-full bg-white/10 text-[9.5px] font-bold normal-case tracking-normal text-white/50 transition hover:bg-white/20 hover:text-white"
          >
            ?
          </button>
        )}
      </p>

      {aberto && v && (
        <Moldura fechar={() => setAberto(false)} rotulo={v.titulo}>
          <Verbete v={v} />
          <div className="mt-6 flex flex-wrap gap-2.5 border-t border-white/[0.08] pt-5">
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                setTutorial(true);
              }}
              className="rounded-xl bg-sky-500 px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-sky-400"
            >
              Ver tutorial
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-[12.5px] font-bold text-white/70 transition hover:bg-white/5"
            >
              Fechar
            </button>
          </div>
        </Moldura>
      )}

      {tutorial && <Tutorial fechar={() => setTutorial(false)} inicial={kpiKey} />}
    </>
  );
}

/**
 * O tutorial: percorre os mesmos verbetes, na ordem do funil.
 *
 * Não é um documento à parte nem um vídeo. É a mesma explicação do "?", em
 * sequência — quem já leu um card reconhece o texto, e não existe versão "do
 * tutorial" divergente da versão "da tela".
 */
export function Tutorial({ fechar, inicial }: { fechar: () => void; inicial?: string }) {
  const partida = Math.max(0, ORDEM_TUTORIAL.indexOf(inicial ?? ""));
  const [i, setI] = useState(partida);
  useModalAberto(true, fechar);

  const chave = ORDEM_TUTORIAL[i];
  const v = GLOSSARIO_KPI[chave];
  const ultimo = i === ORDEM_TUTORIAL.length - 1;

  return (
    <Moldura fechar={fechar} rotulo={`Tutorial: ${v.titulo}`}>
      <div className="mb-5 flex items-center gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300">
          Tutorial · o funil, passo a passo
        </p>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-white/40">
          {i + 1}/{ORDEM_TUTORIAL.length}
        </span>
      </div>

      {/* A barra é a ordem do funil: cada passo é uma etapa, não um slide solto. */}
      <div className="mb-6 flex gap-1">
        {ORDEM_TUTORIAL.map((k, idx) => (
          <button
            key={k}
            type="button"
            onClick={() => setI(idx)}
            aria-label={`Ir para ${GLOSSARIO_KPI[k].titulo}`}
            className={`h-1 flex-1 rounded-full transition ${
              idx <= i ? "bg-sky-400" : "bg-white/12"
            }`}
          />
        ))}
      </div>

      <Verbete v={v} />

      <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-white/[0.08] pt-5">
        <button
          type="button"
          onClick={() => setI((n) => Math.max(0, n - 1))}
          disabled={i === 0}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-[12.5px] font-bold text-white/70 transition enabled:hover:bg-white/5 disabled:opacity-30"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={() => (ultimo ? fechar() : setI((n) => n + 1))}
          className="rounded-xl bg-sky-500 px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-sky-400"
        >
          {ultimo ? "Terminei" : "Próximo"}
        </button>
        <button
          type="button"
          onClick={fechar}
          className="ml-auto text-[12.5px] font-semibold text-white/40 transition hover:text-white/70"
        >
          Sair do tutorial
        </button>
      </div>
    </Moldura>
  );
}

/**
 * O "?" sozinho, sem o rótulo junto. Serve onde o rótulo já tem estilo próprio —
 * o funil, por exemplo, cujos nomes não são maiúsculas de 10px como os dos cards.
 */
export function BotaoAjuda({ kpiKey, className = "" }: { kpiKey: string; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const v = GLOSSARIO_KPI[kpiKey];
  useModalAberto(aberto, () => setAberto(false));
  if (!v) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={`O que é ${v.titulo}`}
        className={`grid h-[15px] w-[15px] flex-none place-items-center rounded-full bg-white/10 text-[9.5px] font-bold text-white/50 transition hover:bg-white/20 hover:text-white ${className}`}
      >
        ?
      </button>

      {aberto && (
        <Moldura fechar={() => setAberto(false)} rotulo={v.titulo}>
          <Verbete v={v} />
          <div className="mt-6 flex flex-wrap gap-2.5 border-t border-white/[0.08] pt-5">
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                setTutorial(true);
              }}
              className="rounded-xl bg-sky-500 px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-sky-400"
            >
              Ver tutorial
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-[12.5px] font-bold text-white/70 transition hover:bg-white/5"
            >
              Fechar
            </button>
          </div>
        </Moldura>
      )}

      {tutorial && <Tutorial fechar={() => setTutorial(false)} inicial={kpiKey} />}
    </>
  );
}

/** O botão "Ver tutorial" que fica no cabeçalho da página. */
export function BotaoTutorial({ className = "" }: { className?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[12px] font-semibold text-white/70 transition hover:bg-white/5 hover:text-white ${className}`}
      >
        <span
          aria-hidden="true"
          className="grid h-[15px] w-[15px] place-items-center rounded-full bg-sky-500/20 text-[9.5px] font-bold text-sky-300"
        >
          ?
        </span>
        Ver tutorial
      </button>
      {aberto && <Tutorial fechar={() => setAberto(false)} />}
    </>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useClinic } from "@/hooks/useClinic";

interface Checagem {
  id: string;
  titulo: string;
  explica: string;
  valorA: number;
  rotuloA: string;
  valorB: number;
  rotuloB: string;
  detalhe: string;
  passou: boolean;
}

interface Conferencia {
  de: string;
  ate: string;
  checagens: Checagem[];
  falharam: number;
}

const nf = new Intl.NumberFormat("pt-BR");

/**
 * Conferência: cada linha é uma afirmação que tem de ser verdade.
 *
 * O DESENHO SEGUE O ASSUNTO
 * -------------------------
 * Conferência é palavra de contabilidade, e o gesto é o mesmo: dois valores frente a frente e
 * uma linha entre eles. A linha é o instrumento — inteira quando os dois lados fecham,
 * partida quando não fecham. A quebra na linha É o alerta; não existe pílula vermelha, selo
 * nem ícone de erro.
 *
 * QUANDO ESTÁ TUDO CERTO, A PÁGINA FICA QUASE VAZIA
 * -------------------------------------------------
 * As afirmações que passam ficam apagadas a ponto de quase sumir; só as que falham têm
 * presença. É deliberado: uma tela de conferência cheia de verde ensina a não olhar, e o
 * único resultado aceitável aqui é zero falhas — então zero falhas tem que parecer silêncio.
 */
export default function ConferenciaPage() {
  const { unitId } = useClinic();
  const [dias, setDias] = useState(30);

  const { de, ate } = useMemo(() => {
    const fim = new Date();
    const ini = new Date(fim.getTime() - dias * 24 * 3600_000);
    return { de: ini.toISOString(), ate: fim.toISOString() };
  }, [dias]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["conferencia", unitId, dias],
    queryFn: async () => {
      const { data } = await api.get<Conferencia>("/api/saude/conferencia", {
        params: { de, ate, unitId },
      });
      return data;
    },
    enabled: !!unitId,
  });

  const falharam = data?.falharam ?? 0;
  const total = data?.checagens.length ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      {/* ─── Cabeçalho: o veredito é o número de falhas, não um placar ─── */}
      <header className="border-b border-white/[0.08] pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              Conferência
            </p>
            <h1 className="mt-2 text-[22px] font-medium tracking-tight text-slate-100">
              Os números batem entre si?
            </h1>
            <p className="mt-1.5 max-w-[54ch] text-[13px] leading-relaxed text-slate-500">
              Cada linha abaixo é uma afirmação que tem de ser verdade. Teste prova que a regra
              está certa; isto prova que o número da tela bate.
            </p>
          </div>

          <div className="text-right">
            <p
              className={cn(
                "font-mono text-[34px] leading-none tabular-nums",
                falharam > 0 ? "text-rose-400" : "text-slate-300",
              )}
            >
              {isLoading ? "—" : falharam}
            </p>
            <p className="mt-1.5 text-[11px] text-slate-600">
              {isLoading
                ? "conferindo"
                : falharam === 0
                  ? `de ${total} não fecham`
                  : `de ${total} não ${falharam === 1 ? "fecha" : "fecham"}`}
            </p>
          </div>
        </div>

        {/* Janela: conferência muda de resposta conforme o período, então ele fica visível. */}
        <div className="mt-4 flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className={cn(
                "border-b-2 px-2 pb-1 text-[12px] transition",
                dias === d
                  ? "border-slate-400 text-slate-200"
                  : "border-transparent text-slate-600 hover:text-slate-400",
              )}
            >
              {d} dias
            </button>
          ))}
        </div>
      </header>

      {isError && (
        <p className="mt-8 text-[13px] text-amber-400/90">
          A conferência não respondeu. Sem ela não dá para afirmar que os números estão certos —
          nem que estão errados.
        </p>
      )}

      {!unitId && (
        <p className="mt-8 text-[13px] text-slate-500">
          Escolha uma unidade. Conferência é por unidade: cada uma tem funil e campos próprios.
        </p>
      )}

      <div className="divide-y divide-white/[0.05]">
        {data?.checagens.map((c) => (
          <Linha key={c.id} c={c} />
        ))}
      </div>

      {data && falharam === 0 && total > 0 && (
        <p className="mt-8 text-[12.5px] text-slate-600">
          Tudo fecha nesta janela. Não quer dizer que todo número do dashboard está certo — quer
          dizer que nenhuma das {total} afirmações acima está sendo violada.
        </p>
      )}
    </div>
  );
}

/**
 * Uma afirmação.
 *
 * O instrumento é a linha entre os dois valores: inteira quando fecham, partida quando não.
 * Passou fica apagado de propósito — ver o que está certo não muda o que alguém faz.
 */
function Linha({ c }: { c: Checagem }) {
  const falhou = !c.passou;

  return (
    <section className={cn("py-6", !falhou && "opacity-40")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2
          className={cn(
            "text-[14.5px] tracking-tight",
            falhou ? "text-slate-100" : "text-slate-400",
          )}
        >
          {c.titulo}
        </h2>
        {falhou && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-400/90">
            não fecha
          </span>
        )}
      </div>

      <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-slate-500">
        {c.explica}
      </p>

      {/* ─── O instrumento ──────────────────────────────────────────────
          Dois valores frente a frente e a linha entre eles. A quebra na
          linha é o alerta — sem selo, sem ícone, sem pílula. */}
      <div className="mt-5 flex items-center gap-4">
        <Valor n={c.valorA} rotulo={c.rotuloA} destaque={falhou} alinhar="right" />

        <div className="relative flex-1 pb-4">
          <div
            className={cn(
              "h-px w-full",
              falhou
                ? "bg-[repeating-linear-gradient(90deg,rgba(242,119,138,.85)_0_5px,transparent_5px_13px)]"
                : "bg-white/[0.14]",
            )}
          />
          <span
            className={cn(
              "absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap font-mono text-[10.5px] tabular-nums",
              falhou ? "text-rose-400/90" : "text-slate-600",
            )}
          >
            {c.valorA === c.valorB
              ? "iguais"
              : `diferença ${nf.format(Math.abs(c.valorA - c.valorB))}`}
          </span>
        </div>

        <Valor n={c.valorB} rotulo={c.rotuloB} destaque={falhou} alinhar="left" />
      </div>

      {c.detalhe && (
        <p
          className={cn(
            "mt-4 border-l-2 pl-3 text-[12.5px] leading-relaxed",
            falhou ? "border-rose-400/40 text-slate-300" : "border-white/[0.08] text-slate-600",
          )}
        >
          {c.detalhe}
        </p>
      )}
    </section>
  );
}

function Valor({
  n,
  rotulo,
  destaque,
  alinhar,
}: {
  n: number;
  rotulo: string;
  destaque: boolean;
  alinhar: "left" | "right";
}) {
  return (
    <div className={cn("w-[136px] shrink-0", alinhar === "right" ? "text-right" : "text-left")}>
      <p
        className={cn(
          "font-mono text-[26px] leading-none tabular-nums",
          destaque ? "text-slate-100" : "text-slate-400",
        )}
      >
        {nf.format(n)}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-600">{rotulo}</p>
    </div>
  );
}

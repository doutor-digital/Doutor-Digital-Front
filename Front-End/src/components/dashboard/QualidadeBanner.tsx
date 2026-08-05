import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "@/components/icons";
import { qualidadeService, type QualidadeCampo } from "@/services/qualidade";
import { cn } from "@/lib/utils";

/**
 * Faixa de preenchimento no topo do dashboard.
 *
 * POR QUE FICA NO PRINCIPAL, E NÃO NUMA TELA À PARTE
 * --------------------------------------------------
 * Tela que só quem procura encontra não muda comportamento. O número do dashboard vale o
 * que o cartão preenchido vale, e quando o campo está vazio a conversa vira "o dashboard
 * está errado" — quando o dashboard está certo. A faixa existe para tirar o "eu não vi"
 * da mesa.
 *
 * CADA CAMPO CONTRA A PRÓPRIA ETAPA
 * ---------------------------------
 * O percentual sai de quem CHEGOU na etapa em que o campo é exigido, não da base inteira.
 * Medido errado, "Data de agendamento" dava 8% — porque a maioria dos leads nunca saiu da
 * qualificação. No denominador certo são 71%, e o que sobra é buraco de verdade.
 *
 * QUANDO ESTÁ TUDO CERTO, ELA SOME
 * --------------------------------
 * Aviso permanente vira paisagem. Sem campo abaixo da meta, o componente não renderiza.
 */
export function QualidadeBanner({
  unitId,
  de,
  ate,
}: {
  unitId?: number | null;
  de?: string;
  ate?: string;
}) {
  const [aberto, setAberto] = useState(false);

  const { data } = useQuery({
    queryKey: ["qualidade-preenchimento", unitId, de, ate],
    queryFn: () => qualidadeService.preenchimento({ unitId, de, ate }),
    enabled: !!unitId,
    staleTime: 60_000,
  });

  const { abaixo, semMapeamento, pior } = useMemo(() => {
    const campos = data?.porCampo ?? [];
    const ab = campos
      .filter((c) => c.mapeado && !c.atingiuMeta && c.universo > 0)
      .sort((a, b) => a.percentual - b.percentual);
    return {
      abaixo: ab,
      semMapeamento: campos.filter((c) => !c.mapeado),
      pior: ab[0],
    };
  }, [data]);

  if (!data || (abaixo.length === 0 && semMapeamento.length === 0)) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-amber-400/25 bg-amber-400/[0.06]">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-amber-400/[0.04]"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/15 text-[15px] font-semibold text-amber-300">
          {abaixo.length}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-amber-100">
            {abaixo.length === 1
              ? "1 campo abaixo da meta de preenchimento"
              : `${abaixo.length} campos abaixo da meta de preenchimento`}
          </p>
          {pior && (
            <p className="truncate text-[11.5px] text-amber-100/70">
              O mais crítico: {pior.rotulo} — {pior.preenchidos} de {pior.universo} ({pior.percentual}%)
            </p>
          )}
        </div>

        {aberto ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-amber-300/70" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-amber-300/70" />
        )}
      </button>

      {aberto && (
        <div className="border-t border-amber-400/15 px-4 py-3">
          <div className="space-y-2">
            {abaixo.map((c) => (
              <LinhaCampo key={c.campo} campo={c} meta={data.meta} />
            ))}
          </div>

          {semMapeamento.length > 0 && (
            <p className="mt-3 border-t border-amber-400/10 pt-2.5 text-[11px] text-amber-100/50">
              {semMapeamento.length} campo{semMapeamento.length > 1 ? "s" : ""} sem mapeamento em
              Configurações Técnicas ({semMapeamento.map((c) => c.rotulo).join(", ")}). Isso é
              configuração, não preenchimento — não conta contra a equipe.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LinhaCampo({ campo, meta }: { campo: QualidadeCampo; meta: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-amber-50/90">
        {campo.rotulo}
        <span className="ml-1.5 text-[11px] text-amber-100/45">{campo.etapa}</span>
      </span>

      {/* Barra com a meta marcada: o alvo fica visível ao lado do que se atingiu. */}
      <div className="relative h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-amber-400/10">
        <div
          className={cn(
            "h-full rounded-full",
            campo.percentual >= meta ? "bg-emerald-400/70" : "bg-amber-400/70",
          )}
          style={{ width: `${Math.min(100, campo.percentual)}%` }}
        />
        <span
          className="absolute top-0 h-full w-px bg-amber-100/40"
          style={{ left: `${meta}%` }}
          title={`meta ${meta}%`}
        />
      </div>

      <span className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-amber-100/70">
        {campo.preenchidos}/{campo.universo}
      </span>
      <span className="w-11 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-amber-200">
        {campo.percentual}%
      </span>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { fmtInt, fmtPct, taxaNoShow } from "@/services/desempenho";

interface EtapaFunil {
  chave: string;
  label: string;
  valor: number;
}

/**
 * Funil horizontal em barras: cada etapa com largura proporcional ao topo (Leads = 100%)
 * e a % de conversão em relação à etapa ANTERIOR. "Compareceram" é destacada em âmbar.
 * Abaixo, a taxa de no-show.
 */
export function FunilHorizontal({
  totais,
}: {
  totais: {
    leads: number;
    qualificados: number;
    agendados: number;
    compareceram: number;
    indicados: number;
    fechados: number;
  };
}) {
  const etapas: EtapaFunil[] = [
    { chave: "leads", label: "Leads", valor: totais.leads },
    { chave: "qualificados", label: "Qualificados", valor: totais.qualificados },
    { chave: "agendados", label: "Agendados", valor: totais.agendados },
    { chave: "compareceram", label: "Compareceram", valor: totais.compareceram },
    { chave: "indicados", label: "Indicados", valor: totais.indicados },
    { chave: "fechados", label: "Fechados", valor: totais.fechados },
  ];

  const topo = etapas[0].valor || 1;
  const noShow = taxaNoShow(totais.agendados, totais.compareceram);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
        Funil de conversão
      </p>

      <div className="mt-4 space-y-2.5">
        {etapas.map((etapa, i) => {
          const anterior = i === 0 ? null : etapas[i - 1].valor;
          const conv = anterior == null ? null : anterior > 0 ? etapa.valor / anterior : null;
          const largura = Math.max(4, (etapa.valor / topo) * 100);
          const destaque = etapa.chave === "compareceram";

          return (
            <div key={etapa.chave} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-right text-[11.5px] font-medium text-white/70">
                {etapa.label}
              </div>
              <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-white/[0.03]">
                <div
                  className={cn(
                    "flex h-full items-center rounded-lg px-2.5 transition-all",
                    destaque
                      ? "bg-gradient-to-r from-amber-500/35 to-amber-400/20 ring-1 ring-inset ring-amber-400/40"
                      : "bg-gradient-to-r from-emerald-500/30 to-emerald-400/15 ring-1 ring-inset ring-emerald-400/25",
                  )}
                  style={{ width: `${largura}%` }}
                >
                  <span
                    className={cn(
                      "text-[12px] font-semibold tabular-nums",
                      destaque ? "text-amber-200" : "text-emerald-100",
                    )}
                  >
                    {fmtInt(etapa.valor)}
                  </span>
                </div>
              </div>
              <div className="w-16 shrink-0 text-right text-[11px] tabular-nums text-white/45">
                {conv == null ? "—" : fmtPct(conv)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-amber-200/80">
          Taxa de no-show
        </span>
        <span className="text-[15px] font-semibold tabular-nums text-amber-300">
          {fmtPct(noShow)}
        </span>
      </div>
    </div>
  );
}

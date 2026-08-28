interface Props {
  receitaFechada?: number;
  ticketMedio?: number;
  comValor?: number;
  fechados?: number;
  /** fechou ÷ compareceu, em % — vem pronto do back (fechamento_rate). */
  taxaAceitacao?: number;
  loading?: boolean;
  className?: string;
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Dinheiro do tratamento no período: receita fechada, ticket médio e a taxa de
 * aceitação (dos que compareceram, quantos fecharam).
 *
 * A taxa de aceitação é o indicador mais perto da receita que o funil produz —
 * separa problema de mídia (poucos comparecem) de problema de consultório (muitos
 * comparecem e não fecham). O card mostra a cobertura do ticket porque média sobre
 * poucos valores preenchidos é ruído, e esconder isso produziria número bonito e falso.
 */
export function ReceitaTratamentoCard({
  receitaFechada = 0,
  ticketMedio = 0,
  comValor = 0,
  fechados = 0,
  taxaAceitacao = 0,
  loading = false,
  className = "",
}: Props) {
  const cobertura = fechados > 0 ? Math.round((comValor / fechados) * 100) : 0;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white border border-slate-200 p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Tratamento fechado</h3>
        <p className="text-xs text-slate-400">Receita, ticket médio e aceitação no período</p>
      </div>

      {loading ? (
        <div className="h-24 w-full animate-pulse rounded-lg bg-slate-50" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Receita</p>
              <p className="mt-1 text-2xl font-bold leading-none tabular-nums text-emerald-400">
                {brl(receitaFechada)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Ticket médio</p>
              <p className="mt-1 text-2xl font-bold leading-none tabular-nums text-slate-900">
                {brl(ticketMedio)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Aceitação</p>
              <p className="mt-1 text-2xl font-bold leading-none tabular-nums text-sky-400">
                {taxaAceitacao.toFixed(1)}%
              </p>
            </div>
          </div>

          <p className="mt-4 text-[11px] leading-snug text-slate-500">
            {fechados > 0 ? (
              <>
                {fechados.toLocaleString("pt-BR")} fechamento
                {fechados > 1 ? "s" : ""} no período · valor preenchido em {cobertura}% deles
                {cobertura < 60 && (
                  <span className="text-amber-400/80">
                    {" "}
                    — ticket pouco confiável enquanto o valor não for preenchido
                  </span>
                )}
              </>
            ) : (
              "Nenhum tratamento fechado no período."
            )}
          </p>
          <p className="mt-1 text-[11px] text-slate-600">
            Aceitação = fechou ÷ compareceu
          </p>
        </>
      )}
    </div>
  );
}

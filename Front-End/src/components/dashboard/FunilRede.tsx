const nf = new Intl.NumberFormat("pt-BR");

interface Etapa {
  nome: string;
  valor: number | null;
  fonte: "kommo" | "franquia";
  /** Por que não há número. Só aparece quando `valor` é null. */
  porque?: string;
}

interface Props {
  leads: number;
  agendados: number | null;
  consultas: number | null;
  tratamentos: number | null;
  carregando?: boolean;
}

/**
 * O funil da rede em uma linha: Leads → Agendados → Consultas → Tratamentos → Receita.
 *
 * POR QUE ELE ABRE A PÁGINA
 * -------------------------
 * O dashboard tinha vinte e poucos cards e nenhuma frase de abertura. Esta faixa é a
 * resposta à única pergunta que se faz todo dia — quantos chegaram e quanto virou
 * paciente — e tudo o mais na página passa a ser detalhe dela.
 *
 * O SELO DA FONTE É O ASSUNTO, NÃO UM RODAPÉ
 * ------------------------------------------
 * Cada etapa diz de onde veio o número. Só "Leads" é da Kommo; o resto vem da agenda da
 * franquia. Isso importa porque é a diferença entre um número que depende de alguém ter
 * arrastado um card e um número que depende do paciente ter aparecido na clínica. Quem
 * bate o olho vê, em dois tons, quanto da tela é opinião e quanto é fato.
 *
 * ETAPA SEM FONTE MOSTRA O PORQUÊ, NÃO ZERO
 * -----------------------------------------
 * Zero seria lido como "não aconteceu". Onde não existe fonte, a etapa fica hachurada e
 * escreve o motivo — o que a transforma na lista do que ainda falta ligar.
 *
 * A PRIMEIRA TAXA PODE PASSAR DE 100%, E ISSO É INFORMAÇÃO
 * --------------------------------------------------------
 * Leads são da Kommo; agendados são da agenda inteira da clínica, que inclui indicação,
 * telefone e balcão — gente que nunca foi lead. Quando a taxa fura os 100%, ela não está
 * quebrada: está dizendo que a clínica atende além do que a mídia traz. Por isso a faixa
 * marca o caso em vez de escondê-lo.
 */
export function FunilRede({ leads, agendados, consultas, tratamentos, carregando }: Props) {
  const etapas: Etapa[] = [
    { nome: "Leads", valor: leads, fonte: "kommo" },
    {
      nome: "Agendados",
      valor: agendados,
      fonte: "franquia",
      porque: "Sem autorização da franquia nesta unidade.",
    },
    {
      nome: "Consultas",
      valor: consultas,
      fonte: "franquia",
      porque: "Sem autorização da franquia nesta unidade.",
    },
    {
      nome: "Tratamentos",
      valor: tratamentos,
      fonte: "franquia",
      porque: "Sem autorização da franquia nesta unidade.",
    },
    {
      nome: "Receita",
      valor: null,
      fonte: "franquia",
      porque: "Sem fonte: a franquia não expõe o valor do tratamento.",
    },
  ];

  // Uma taxa só existe quando as duas pontas existem.
  const taxa = (de: number | null, para: number | null): number | null =>
    de == null || para == null || de === 0 ? null : (para / de) * 100;

  const taxas = [
    { v: taxa(leads, agendados), rot: "agendamento" },
    { v: taxa(agendados, consultas), rot: "comparecimento" },
    { v: taxa(consultas, tratamentos), rot: "fechamento" },
    { v: null as number | null, rot: "ticket médio" },
  ];

  const furou = taxas[0].v != null && taxas[0].v > 100;

  return (
    <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex flex-wrap">
        {etapas.map((e) => (
          <div
            key={e.nome}
            className={`flex min-w-[150px] flex-1 flex-col gap-2 border-l border-white/[0.07] px-4 first:border-l-0 first:pl-0 ${
              e.valor == null ? "rounded-xl bg-white/[0.02]" : ""
            }`}
          >
            <span className="text-[12px] font-semibold tracking-tight text-white/70">
              {e.nome}
            </span>
            <span
              className={`font-mono text-[30px] leading-none tabular-nums tracking-tight ${
                e.valor == null ? "text-white/25" : "text-white"
              }`}
            >
              {carregando ? "—" : e.valor == null ? "—" : nf.format(e.valor)}
            </span>
            <span
              className={`self-start rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] ${
                e.fonte === "kommo"
                  ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/25"
                  : "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/25"
              }`}
            >
              {e.fonte === "kommo" ? "Kommo" : "Franquia"}
            </span>
            {e.valor == null && !carregando && (
              <span className="text-[10.5px] leading-snug text-white/30">{e.porque}</span>
            )}
          </div>
        ))}
      </div>

      {/* As setas ficam nos vãos entre as etapas. Seta sem número não é erro
          escondido: é a conversão que ainda não dá para calcular. */}
      <div className="mt-4 hidden border-t border-dashed border-white/[0.08] pt-3 sm:flex">
        {taxas.map((t, i) => (
          <div key={i} className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <span
              className={`text-[14px] font-bold tracking-tight ${
                t.v == null ? "text-white/25" : i === 0 && furou ? "text-amber-300" : "text-white/80"
              }`}
            >
              {t.v == null ? "—" : `${Math.round(t.v)}%`}
            </span>
            <span
              className={`h-px flex-1 ${
                t.v == null ? "bg-white/10" : i === 0 && furou ? "bg-amber-400/60" : "bg-sky-400/60"
              }`}
            />
            <span className="whitespace-nowrap text-[10px] font-medium text-white/30">{t.rot}</span>
          </div>
        ))}
      </div>

      {furou && (
        <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11.5px] leading-relaxed text-amber-200/80">
          <b className="font-bold">A primeira taxa passou de 100%</b> porque os dois números
          não são da mesma população: a agenda da franquia conta todo mundo que ocupou
          horário — inclusive indicação, telefone e balcão, que nunca viraram lead na Kommo.
        </p>
      )}
    </section>
  );
}

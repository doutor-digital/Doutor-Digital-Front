import { AjudaKpi } from "./AjudaKpi";

const nf = new Intl.NumberFormat("pt-BR");

interface Etapa {
  nome: string;
  valor: number | null;
  fonte: "kommo" | "franquia";
  /** Por que não há número. Só aparece quando `valor` é null. */
  porque?: string;
  /** O recorte que o nome esconde, no "?" ao lado do rótulo. */
  ajuda: string;
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
 * franquia. É a diferença entre um número que depende de alguém ter arrastado um card e
 * um número que depende do paciente ter aparecido na clínica.
 *
 * CADA ETAPA CARREGA O PRÓPRIO "?"
 * --------------------------------
 * O nome esconde o recorte: "Agendados" não conta sessão de tratamento nem retorno, e
 * "Consultas" é quem sentou na cadeira, não quem marcou. Sem isso escrito ao lado do
 * número, cada pessoa preenche a lacuna com um palpite diferente.
 *
 * ETAPA SEM FONTE MOSTRA O PORQUÊ, NÃO ZERO
 * -----------------------------------------
 * Zero seria lido como "não aconteceu". Onde não existe fonte, a etapa fica apagada e
 * escreve o motivo — o que a transforma na lista do que ainda falta ligar.
 */
export function FunilRede({ leads, agendados, consultas, tratamentos, carregando }: Props) {
  const etapas: Etapa[] = [
    {
      nome: "Leads",
      valor: leads,
      fonte: "kommo",
      ajuda:
        "Pessoas que chegaram no período e viraram card na Kommo — anúncio, WhatsApp, " +
        "indicação registrada. É o único número desta linha que depende de alguém ter " +
        "mexido no CRM; todos os outros vêm da agenda da clínica.",
    },
    {
      nome: "Agendados",
      valor: agendados,
      fonte: "franquia",
      porque: "Sem autorização da franquia nesta unidade.",
      ajuda:
        "Avaliações marcadas na agenda da franquia para o período. Conta SÓ avaliação: " +
        "sessão de tratamento e retorno ficam de fora, porque não são paciente novo. " +
        "O que foi desmarcado ou remarcado também sai da conta.",
    },
    {
      nome: "Consultas",
      valor: consultas,
      fonte: "franquia",
      porque: "Sem autorização da franquia nesta unidade.",
      ajuda:
        "Das avaliações marcadas, quantas o paciente de fato compareceu — situação " +
        "ATENDIDO na agenda da franquia. Não é quem marcou: é quem sentou na cadeira.",
    },
    {
      nome: "Tratamentos",
      valor: tratamentos,
      fonte: "franquia",
      porque: "Sem autorização da franquia nesta unidade.",
      ajuda:
        "Tratamentos lançados no período, pela rota oficial da franquia. Conta o que foi " +
        "lançado no mês mesmo que depois vire desistência — senão o número do passado " +
        "mudaria sozinho conforme a recepção edita a situação.",
    },
    {
      nome: "Receita",
      valor: null,
      fonte: "franquia",
      porque: "Sem fonte: a franquia não expõe o valor do tratamento.",
      ajuda:
        "Ainda não existe. A franquia não expõe o valor do tratamento em nenhuma rota, e " +
        "o campo de valor está vazio em todas as linhas do nosso banco. Fica em branco de " +
        "propósito: um zero aqui seria lido como 'não vendeu nada'.",
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
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap">
        {etapas.map((e) => (
          <div
            key={e.nome}
            className={`flex min-w-[150px] flex-1 flex-col gap-2 border-l border-slate-200 px-4 first:border-l-0 first:pl-0 ${
              e.valor == null ? "rounded-xl bg-slate-50" : ""
            }`}
          >
            <span className="flex items-center gap-1.5 text-[12.5px] font-bold tracking-tight text-slate-900">
              {e.nome}
              <AjudaKpi titulo={e.nome} texto={e.ajuda} />
            </span>
            <span
              className={`text-[30px] font-extrabold leading-none tracking-tight tabular-nums ${
                e.valor == null ? "text-slate-300" : "text-slate-900"
              }`}
            >
              {carregando ? "—" : e.valor == null ? "—" : nf.format(e.valor)}
            </span>
            <span
              className={`self-start rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.06em] ${
                e.fonte === "kommo"
                  ? "bg-[#fff8e6] text-[#664800] ring-1 ring-[#F0D290]"
                  : "bg-[#e6f3ff] text-[#004f91] ring-1 ring-[#B9DCFA]"
              }`}
            >
              {e.fonte === "kommo" ? "Kommo" : "Franquia"}
            </span>
            {e.valor == null && !carregando && (
              <span className="text-[10.5px] leading-snug text-slate-400">{e.porque}</span>
            )}
          </div>
        ))}
      </div>

      {/* As setas ficam nos vãos entre as etapas. Seta sem número não é erro
          escondido: é a conversão que ainda não dá para calcular. */}
      <div className="mt-4 hidden border-t border-dashed border-slate-200 pt-3 sm:flex">
        {taxas.map((t, i) => (
          <div key={i} className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <span
              className={`text-[15px] font-extrabold tracking-tight ${
                t.v == null
                  ? "text-slate-300"
                  : i === 0 && furou
                    ? "text-[#8a5a00]"
                    : "text-slate-800"
              }`}
            >
              {t.v == null ? "—" : `${Math.round(t.v)}%`}
            </span>
            <span
              className={`h-0.5 flex-1 rounded ${
                t.v == null ? "bg-slate-200" : i === 0 && furou ? "bg-[#cc9100]" : "bg-[#0086f7]"
              }`}
            />
            <span className="whitespace-nowrap text-[10px] font-semibold text-slate-400">
              {t.rot}
            </span>
          </div>
        ))}
      </div>

      {furou && (
        <p className="mt-3.5 rounded-xl border border-[#F5DFA8] bg-[#fff8e6] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#6b4e05]">
          <b className="font-extrabold">A primeira taxa passou de 100%</b> porque os dois
          números não são da mesma população: a agenda da franquia conta todo mundo que ocupou
          horário — inclusive indicação, telefone e balcão, que nunca viraram lead na Kommo.
        </p>
      )}
    </section>
  );
}

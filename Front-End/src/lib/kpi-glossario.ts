/**
 * O que cada número do dashboard é — em um lugar só.
 *
 * POR QUE UM ARQUIVO ÚNICO
 * ------------------------
 * O "?" ao lado do KPI e o tutorial contam a MESMA história. Se cada um tivesse o
 * próprio texto, os dois começariam iguais e terminariam diferentes — e aí o painel
 * passaria a mentir de um jeito novo: duas explicações para o mesmo número. Tudo sai
 * daqui; a tela e o tutorial só mudam a forma de apresentar.
 *
 * O QUE CADA CAMPO RESPONDE
 * -------------------------
 * `resumo`    — a frase que a pessoa leva embora.
 * `comoLer`   — o que fazer com o número quando ele sobe ou desce.
 * `fonte`     — de onde vem, porque isso decide se dá para confiar.
 * `cuidado`   — a armadilha. Só existe quando existe de verdade; campo opcional,
 *               não enfeite. É o que evita a discussão de "esse número está errado".
 */
export interface VerbeteKpi {
  titulo: string;
  resumo: string;
  comoLer: string;
  fonte: "Kommo" | "Franquia" | "Kommo + Franquia";
  fonteDetalhe: string;
  cuidado?: string;
}

export const GLOSSARIO_KPI: Record<string, VerbeteKpi> = {
  total_leads: {
    titulo: "Total de leads",
    resumo:
      "Todo mundo que chegou no período e virou card na Kommo — anúncio, WhatsApp, indicação registrada.",
    comoLer:
      "É a boca do funil. Se cai, o problema é de mídia ou de campanha, não da clínica. Se sobe e o resto não acompanha, o problema é do atendimento.",
    fonte: "Kommo",
    fonteDetalhe: "Contado pela data de criação do lead na Kommo.",
    cuidado:
      "Depende de o lead ter entrado no CRM. Paciente que ligou direto para a clínica ou apareceu no balcão não está aqui — ele aparece na agenda da franquia, mais adiante no funil.",
  },

  leads_qualificados: {
    titulo: "Leads qualificados",
    resumo:
      "Leads marcados como Quente no campo de qualificação — os que a SDR julgou com real chance de virar paciente.",
    comoLer:
      "Compare com o total: se você tem muito lead e pouco Quente, a mídia está trazendo volume sem intenção. Melhor 40 quentes do que 400 frios.",
    fonte: "Kommo",
    fonteDetalhe: 'Campo "★ Qualificação (Quente/Morno/Frio)", valor Quente.',
    cuidado:
      "É julgamento humano, não fato. Duas SDRs qualificam diferente, então o número compara mal entre unidades — use para ver tendência dentro da mesma clínica.",
  },

  cadastro: {
    titulo: "Cadastro",
    resumo: "Leads do tipo cadastro — paciente novo, primeira vez na clínica.",
    comoLer: "Separado do resgate para você saber quanto do resultado é gente nova e quanto é base antiga reativada.",
    fonte: "Kommo",
    fonteDetalhe: 'Campo "⬢ Tipo de lead", valor Cadastro.',
  },

  resgate: {
    titulo: "Resgate",
    resumo: "Lead antigo reativado — já estava na base e voltou a conversar.",
    comoLer:
      "Resgate é o mais barato que existe: não custa mídia. Se está zerado, tem dinheiro parado na base.",
    fonte: "Kommo",
    fonteDetalhe: 'Campo "⬢ Tipo de lead", valor Resgate.',
  },

  agendados: {
    titulo: "Agendados",
    resumo:
      "Avaliações marcadas na agenda da clínica para o período. Conta SÓ avaliação — sessão de tratamento e retorno ficam de fora.",
    comoLer:
      "É a primeira prova de que a conversa virou compromisso. Se o lead sobe e o agendado não, a perda está no atendimento.",
    fonte: "Franquia",
    fonteDetalhe: "Agenda do Doutor Hérnia, categoria Avaliação.",
    cuidado:
      "Sessão de tratamento não entra: paciente que já fechou e vai à clínica toda semana não é agendamento novo. Numa unidade típica as sessões são a maior parte da agenda — contá-las aqui inflaria o número várias vezes. O que foi desmarcado ou remarcado também sai da conta.",
  },

  consultas: {
    titulo: "Consultas",
    resumo: "Das avaliações marcadas, quantas o paciente de fato compareceu.",
    comoLer:
      "Consultas ÷ agendados é a taxa de comparecimento. Abaixo de 65% a agenda está sendo reservada e desperdiçada — o problema é confirmação, não venda.",
    fonte: "Franquia",
    fonteDetalhe: "Situação ATENDIDO na agenda do Doutor Hérnia.",
    cuidado: "Não é quem marcou: é quem sentou na cadeira.",
  },

  no_show: {
    titulo: "No-show",
    resumo: "Avaliações em que o paciente não apareceu e a recepção registrou como falta.",
    comoLer:
      "Cada falta é uma hora de médico paga e não usada. Se o número está suspeito de baixo, desconfie antes de comemorar.",
    fonte: "Franquia",
    fonteDetalhe: 'Situação "NÃO COMPARECEU" na agenda do Doutor Hérnia.',
    cuidado:
      "Zero falta quase nunca é bom sinal — costuma significar que a recepção usa DESMARCADO para tudo, inclusive para quem simplesmente não veio. Quando isso acontece, a falta some do relatório sem ter sumido da clínica.",
  },

  tratamentos: {
    titulo: "Tratamentos",
    resumo: "Tratamentos lançados no período — a consulta que virou venda.",
    comoLer:
      "Tratamentos ÷ consultas é a taxa de fechamento. É o número que liga o marketing ao caixa.",
    fonte: "Franquia",
    fonteDetalhe: "Rota oficial de tratamentos do Doutor Hérnia, lançados no período.",
    cuidado:
      "Conta o que foi lançado no mês mesmo que depois vire desistência. É proposital: se filtrasse por situação, o número do passado mudaria sozinho toda vez que a recepção editasse um cadastro.",
  },

  interacoes: {
    titulo: "Interações",
    resumo: "Leads que tiveram pelo menos uma troca de mensagem de verdade.",
    comoLer:
      "Separa quem foi atendido de quem só entrou na lista. Lead sem interação não é lead perdido: é lead não trabalhado.",
    fonte: "Kommo",
    fonteDetalhe: 'Campo "✓ Interação", valor Sim.',
  },

  origens: {
    titulo: "Origens",
    resumo: "De onde os leads vieram — Meta-Instagram, Meta-Facebook, indicação, Google, e assim por diante.",
    comoLer:
      "Serve para decidir onde colocar verba. Repare no fatiamento entre pago e orgânico: o que é Meta você comprou, o que é Org apareceu sozinho.",
    fonte: "Kommo",
    fonteDetalhe: 'Campo "⚑ Origem" do lead.',
    cuidado:
      '"Sem origem" grande é falha de rastreio, não uma origem real. Cada lead sem origem é verba que você não sabe se funcionou.',
  },

  receita: {
    titulo: "Receita",
    resumo:
      "Soma do valor dos tratamentos lançados no período, direto do sistema da clínica.",
    comoLer:
      "Receita ÷ tratamentos é o ticket médio, que aparece no último vão do funil. Ticket caindo com volume estável costuma ser desconto para fechar.",
    fonte: "Franquia",
    fonteDetalhe: "Soma do preço de cada tratamento lançado, pela rota oficial do Doutor Hérnia.",
    cuidado:
      "É valor CONTRATADO, não recebido: quem fechou e ainda não pagou entra aqui igual. Até 28/08 este número saía do campo digitado na Kommo e capturava cerca de um terço do real — em Marabá, R$ 22.520 contra R$ 64.140. Se você comparar com um relatório antigo, é por isso que ele subiu.",
  },

  semaforo: {
    titulo: "Semáforo",
    resumo:
      "O desfecho da consulta, em cores: fechou e pagou, fechou e não pagou, não fechou por dinheiro, não fechou por exame, não era caso para a clínica.",
    comoLer:
      "É o único lugar que diz POR QUE não fechou. Muito amarelo é objeção de preço; muito laranja é processo travado em exame; muito vermelho é mídia trazendo o público errado.",
    fonte: "Kommo",
    fonteDetalhe:
      'Campo "◉ Semáforo", contado da consulta em diante — COMPARECEU, NEGOCIAÇÃO, EM TRATAMENTO e ALTA — pela data em que o card entrou na etapa.',
    cuidado:
      "Quem não veio à consulta fica de fora: semáforo de quem faltou é sobra de card antigo. A contagem é pela ENTRADA na etapa, não pela criação do lead — o lead nasce em julho e a consulta acontece em agosto. E hoje o campo é pouquíssimo preenchido: enquanto a equipe não usar, o card mostra quase nada.",
  },
};

/** A ordem em que o tutorial percorre os KPIs: a ordem do funil, não do alfabeto. */
export const ORDEM_TUTORIAL: string[] = [
  "total_leads",
  "leads_qualificados",
  "origens",
  "agendados",
  "consultas",
  "no_show",
  "tratamentos",
  "semaforo",
];

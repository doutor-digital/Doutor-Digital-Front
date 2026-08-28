import { BotaoAjuda } from "./KpiInfo";

const nf = new Intl.NumberFormat("pt-BR");
// Sem centavos: o campo vem como inteiro e o card é de leitura rápida, não de extrato.
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
});

interface Etapa {
  nome: string;
  /** SVG em /public/kpi-icons (Tabler, MIT). Ver CREDITOS.txt na pasta. */
  icone: string;
  /** Cor da faixa no topo do card — a mesma gravada dentro do SVG. */
  cor: string;
  /** Chave do glossário — alimenta o "?" e o tutorial. */
  chave: string;
  valor: number | null;
  fonte: "kommo" | "franquia";
  /** Por que não há número. Só aparece quando `valor` é null. */
  porque?: string;
  /** Formata em reais em vez de contagem. */
  moeda?: boolean;
}

interface Props {
  leads: number;
  agendados: number | null;
  consultas: number | null;
  tratamentos: number | null;
  /** Soma do campo de valor do tratamento, em reais. */
  receita: number | null;
  carregando?: boolean;
}

/**
 * O funil em uma linha: Leads → Agendados → Consultas → Tratamentos → Receita.
 *
 * A TAXA FICA SOBRE A LINHA, O RÓTULO EMBAIXO
 * -------------------------------------------
 * Antes o rótulo de uma seta ficava colado no número da seta seguinte e a linha
 * lia "agendamento90%" — duas informações diferentes grudadas. Agora cada vão é
 * uma coluna: a linha atravessa, a taxa fica no meio dela, e o nome da taxa vai
 * embaixo, centralizado. Não existe posição em que dois textos se encostem.
 *
 * O SELO DA FONTE É O ASSUNTO
 * ---------------------------
 * Leads e Receita vêm da KOMMO — dependem de alguém ter digitado. Agendados,
 * Consultas e Tratamentos vêm da agenda da clínica: dependem do paciente ter
 * aparecido. Ler os selos da esquerda para a direita mostra onde o dado é opinião
 * e onde é fato.
 *
 * ETAPA SEM FONTE MOSTRA O PORQUÊ, NÃO ZERO
 * -----------------------------------------
 * Zero seria lido como "não aconteceu". Onde não existe fonte, a etapa fica
 * apagada e escreve o motivo.
 */
export function FunilRede({ leads, agendados, consultas, tratamentos, receita, carregando }: Props) {
  const etapas: Etapa[] = [
    {
      nome: "Leads",
      chave: "total_leads",
      icone: "users",
      cor: "#fbbf24",
      valor: leads,
      fonte: "kommo",
    },
    {
      nome: "Agendados", icone: "calendar-check", cor: "#38bdf8",
      chave: "agendados",
      valor: agendados,
      fonte: "franquia",
      porque: "Sem autorização da franquia nesta unidade.",
    },
    {
      nome: "Consultas", icone: "stethoscope", cor: "#34d399",
      chave: "consultas",
      valor: consultas,
      fonte: "franquia",
      porque: "Sem autorização da franquia nesta unidade.",
    },
    {
      nome: "Tratamentos", icone: "clipboard-check", cor: "#a78bfa",
      chave: "tratamentos",
      valor: tratamentos,
      fonte: "franquia",
      porque: "Sem autorização da franquia nesta unidade.",
    },
    {
      nome: "Receita", icone: "wallet", cor: "#4ade80",
      chave: "receita",
      valor: receita,
      // Vem da KOMMO, não da franquia: a rota da franquia não expõe valor, mas a
      // equipe preenche "¤ Valor do tratamento" no card. É o único numero desta
      // linha que depende de digitação além de Leads — por isso o selo muda.
      fonte: "kommo",
      porque: "Ninguém preencheu o valor do tratamento no período.",
      moeda: true,
    },
  ];

  // Uma taxa só existe quando as duas pontas existem.
  const taxa = (de: number | null, para: number | null): number | null =>
    de == null || para == null || de === 0 ? null : (para / de) * 100;

  const taxas: { v: number | null; rot: string; moeda?: boolean }[] = [
    { v: taxa(leads, agendados), rot: "agendamento" },
    { v: taxa(agendados, consultas), rot: "comparecimento" },
    { v: taxa(consultas, tratamentos), rot: "fechamento" },
    // O último vão não é taxa, é dinheiro por tratamento fechado. Fica no mesmo
    // lugar porque a pergunta é a mesma — o que a etapa anterior virou.
    {
      v: receita != null && tratamentos ? receita / tratamentos : null,
      rot: "ticket médio",
      moeda: true,
    },
  ];

  const furou = taxas[0].v != null && taxas[0].v > 100;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {etapas.map((e) => (
          <div
            key={e.nome}
            className="flex flex-col gap-2 border-b border-l border-t-2 border-white/[0.07] p-4 first:border-l-0 lg:border-b-0"
            style={{ borderTopColor: e.cor }}
          >
            <span className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-tight text-white/60">
              {e.nome}
              <BotaoAjuda kpiKey={e.chave} />
              {/* O ícone fica à direita e é decorativo: o rótulo já nomeia o KPI,
                  então repetir no alt só faria o leitor de tela ler duas vezes. */}
              <img
                src={`/kpi-icons/${e.icone}.svg`}
                alt=""
                aria-hidden="true"
                className="ml-auto h-[18px] w-[18px] opacity-80"
              />
            </span>

            <span
              className={`text-[28px] font-bold leading-none tracking-tight tabular-nums ${
                e.valor == null ? "text-white/25" : "text-white"
              }`}
            >
              {carregando || e.valor == null
                ? "—"
                : e.moeda
                  ? brl.format(e.valor)
                  : nf.format(e.valor)}
            </span>

            <span
              className={`self-start rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${
                e.fonte === "kommo"
                  ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/25"
                  : "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/25"
              }`}
            >
              {e.fonte === "kommo" ? "Kommo" : "Franquia"}
            </span>

            {e.valor == null && !carregando && (
              <span className="text-[10px] leading-snug text-white/30">{e.porque}</span>
            )}
          </div>
        ))}
      </div>

      {/* Os vãos: uma coluna por conversão, a taxa centrada na própria linha e o
          nome embaixo. Some no celular — quatro taxas em 360px viram sopa. */}
      <div className="hidden border-t border-white/[0.07] bg-black/10 lg:grid lg:grid-cols-4">
        {taxas.map((t, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 px-4 py-3">
            <div className="flex w-full items-center gap-2.5">
              <span
                className={`h-px flex-1 ${
                  t.v == null ? "bg-white/10" : i === 0 && furou ? "bg-amber-400/50" : "bg-sky-400/40"
                }`}
              />
              <b
                className={`text-[13px] font-bold tabular-nums ${
                  t.v == null ? "text-white/25" : i === 0 && furou ? "text-amber-300" : "text-white/85"
                }`}
              >
                {t.v == null ? "—" : t.moeda ? brl.format(t.v) : `${Math.round(t.v)}%`}
              </b>
              <span
                className={`h-px flex-1 ${
                  t.v == null ? "bg-white/10" : i === 0 && furou ? "bg-amber-400/50" : "bg-sky-400/40"
                }`}
              />
            </div>
            <span className="text-[10px] font-medium text-white/35">{t.rot}</span>
          </div>
        ))}
      </div>

      {furou && (
        <p className="border-t border-amber-400/20 bg-amber-400/[0.06] px-5 py-3 text-[11.5px] leading-relaxed text-amber-100/80">
          <b className="font-bold">A taxa de agendamento passou de 100%</b> porque os dois
          números não são da mesma população: a agenda da clínica conta todo mundo que ocupou
          horário — inclusive indicação, telefone e balcão, que nunca viraram lead na Kommo.
        </p>
      )}
    </section>
  );
}

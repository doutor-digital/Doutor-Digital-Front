import { BotaoTutorial } from "./KpiInfo";

const nf = new Intl.NumberFormat("pt-BR");

interface Props {
  /** Nome da clínica — o veredito é sobre ELA, não sobre a rede. */
  unidade: string;
  periodo: string;
  agendados: number | null;
  consultas: number | null;
  carregando?: boolean;
}

/**
 * O veredito: "a clínica está bem hoje?", respondido em dois segundos.
 *
 * POR QUE UM NÚMERO SÓ, GRANDE
 * ----------------------------
 * Quem abre isto é o dono de UMA clínica, e a primeira coisa que ele quer não é um
 * relatório: é saber se precisa agir hoje. Um painel que responde isso em dois
 * segundos ganha o direito de ter o resto embaixo.
 *
 * O NÚMERO ESCOLHIDO É CONSULTA REALIZADA
 * ---------------------------------------
 * Não é lead, que ainda é promessa, nem tratamento, que depende de negociação.
 * Consulta realizada é o momento em que a clínica de fato trabalhou: o paciente
 * sentou na cadeira. Tudo antes é funil; tudo depois é venda.
 *
 * O VEREDITO É O COMPARECIMENTO, NÃO O VOLUME
 * -------------------------------------------
 * Uma clínica com 20 consultas pode estar ótima e outra com 200 pode estar sangrando.
 * O que separa as duas é quanto da agenda reservada virou atendimento — por isso a
 * cor vem da taxa, e o volume fica como contexto. Agenda reservada e não usada é
 * hora de médico paga sem receita.
 */
const FAIXAS = [
  { min: 70, rotulo: "Vai bem", classe: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25" },
  { min: 55, rotulo: "Atenção", classe: "bg-amber-400/15 text-amber-300 ring-amber-400/25" },
  { min: 0, rotulo: "Crítico", classe: "bg-red-400/15 text-red-300 ring-red-400/25" },
];

export function VeredictoClinica({
  unidade,
  periodo,
  agendados,
  consultas,
  carregando,
}: Props) {
  const temDado = !carregando && agendados != null && consultas != null && agendados > 0;
  const taxa = temDado ? (consultas! / agendados!) * 100 : null;
  const faixa = taxa == null ? null : FAIXAS.find((f) => taxa >= f.min)!;
  const perdidos = temDado ? Math.max(0, agendados! - consultas!) : null;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <div className="flex flex-wrap items-start gap-6 p-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
              {unidade}
            </p>
            {faixa && (
              <span
                className={`rounded-md px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] ring-1 ${faixa.classe}`}
              >
                {faixa.rotulo}
              </span>
            )}
          </div>

          <p className="mt-3 flex items-baseline gap-3 text-white">
            <span className="text-[52px] font-bold leading-none tracking-tight tabular-nums">
              {carregando || consultas == null ? "—" : nf.format(consultas)}
            </span>
            <span className="text-[15px] font-semibold text-white/50">consultas realizadas</span>
          </p>

          <p className="mt-2.5 text-[13px] leading-relaxed text-white/50">
            {!temDado
              ? "Sem dado da agenda da clínica para este período."
              : `de ${nf.format(agendados!)} horários reservados · ${Math.round(taxa!)}% compareceram`}
          </p>

          {/* A frase só aparece quando há o que fazer. Um conselho em todo estado
              ensina a não ler o conselho. */}
          {temDado && taxa! < 70 && (
            <p className="mt-3 text-[12.5px] leading-relaxed text-amber-200/70">
              {nf.format(perdidos!)} horários foram reservados e não usados. Confirmação na
              véspera é o que mais move esse número.
            </p>
          )}

          <div className="mt-4">
            <BotaoTutorial />
          </div>
        </div>

        {/* A barra é a mesma informação em forma: quanto da agenda virou atendimento. */}
        <div className="flex w-full min-w-[220px] flex-1 flex-col justify-center gap-2 sm:w-auto">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
            <span
              className="block bg-sky-400 transition-all"
              style={{ width: `${taxa == null ? 0 : Math.min(100, taxa)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-white/40">
            <span>compareceram</span>
            <span className="tabular-nums">{taxa == null ? "—" : `${Math.round(taxa)}%`}</span>
          </div>
          <p className="mt-1 text-[11px] text-white/30">{periodo}</p>
        </div>
      </div>
    </section>
  );
}

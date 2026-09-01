import { BotaoAjuda } from "./KpiInfo";

const nf = new Intl.NumberFormat("pt-BR");

interface Props {
  leadsQualificados: number | null;
  noShow: number | null;
  /** Distribuição do "◉ Semáforo" dentro de COMPARECEU. */
  semaforo?: Array<{ label: string; value: number }>;
  carregando?: boolean;
}

/**
 * A segunda faixa: o que o funil não conta.
 *
 * POR QUE FICA SEPARADA DO FUNIL
 * ------------------------------
 * O funil é uma sequência — cada etapa alimenta a próxima, e as taxas entre elas só
 * fazem sentido nessa ordem. Estes três não são etapas: são leituras laterais.
 * Qualificado explica a QUALIDADE do que entrou, no-show explica o que se perdeu
 * entre marcar e comparecer, e o semáforo explica POR QUE não fechou. Misturar com
 * o funil sugeriria uma sequência que não existe.
 *
 * O SEMÁFORO É UMA DISTRIBUIÇÃO, NÃO UM NÚMERO
 * --------------------------------------------
 * "12 semáforos" não diz nada; o que importa é a cor. Por isso este é o único dos
 * três que mostra barras em vez de um número grande — a forma segue a pergunta.
 */

/** A cor da fatia sai do nome da própria opção: VERDE, AMARELO, LARANJA… */
function corDaOpcao(rotulo: string): string {
  const r = rotulo.toUpperCase();
  if (r.startsWith("VERDE")) return "bg-emerald-400";
  if (r.startsWith("PARCIAL")) return "bg-teal-400";
  if (r.startsWith("AZUL")) return "bg-sky-400";
  if (r.startsWith("AMARELO")) return "bg-amber-400";
  if (r.startsWith("LARANJA")) return "bg-orange-400";
  if (r.startsWith("VERMELHO")) return "bg-red-400";
  return "bg-white/30";
}

/** "AMARELO — não fechou: dinheiro, família" → "AMARELO". O resto vive no "?". */
const curto = (rotulo: string) => rotulo.split("—")[0].trim();

/** Ícone do card (SVG livre em /public/kpi-icons — Tabler, MIT). Decorativo: o
 *  rótulo ao lado já nomeia o KPI, então o alt vazio evita leitura dobrada. */
function Icone({ nome }: { nome: string }) {
  return (
    <img
      src={`/kpi-icons/${nome}.svg`}
      alt=""
      aria-hidden="true"
      className="ml-auto h-[18px] w-[18px] opacity-80"
    />
  );
}

function Selo({ fonte }: { fonte: "kommo" | "franquia" }) {
  return (
    <span
      className={`self-start rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${
        fonte === "kommo"
          ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/25"
          : "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/25"
      }`}
    >
      {fonte === "kommo" ? "Kommo" : "Franquia"}
    </span>
  );
}

export function KpisApoio({ leadsQualificados, noShow, semaforo, carregando }: Props) {
  const temSemaforo = (semaforo?.length ?? 0) > 0;
  const totalSemaforo = (semaforo ?? []).reduce((a, s) => a + s.value, 0);
  const topo = [...(semaforo ?? [])].sort((a, b) => b.value - a.value).slice(0, 4);

  const numero = (v: number | null) =>
    carregando || v == null ? "—" : nf.format(v);

  return (
    <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* 1. Qualidade do que entrou */}
        <div
          className="flex flex-col gap-2 rounded-xl border border-t-2 border-white/[0.08] bg-white/[0.02] p-4"
          style={{ borderTopColor: "#fb923c" }}
        >
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-tight text-white/60">
            Leads qualificados
            <BotaoAjuda kpiKey="leads_qualificados" />
            <Icone nome="flame" />
          </span>
          <span
            className={`text-[28px] font-bold leading-none tracking-tight tabular-nums ${
              leadsQualificados == null ? "text-white/25" : "text-white"
            }`}
          >
            {numero(leadsQualificados)}
          </span>
          <Selo fonte="kommo" />
          <span className="text-[10px] leading-snug text-white/30">
            marcados como Quente na qualificação
          </span>
        </div>

        {/* 2. O que se perdeu entre marcar e comparecer */}
        <div
          className="flex flex-col gap-2 rounded-xl border border-t-2 border-white/[0.08] bg-white/[0.02] p-4"
          style={{ borderTopColor: "#f87171" }}
        >
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-tight text-white/60">
            No-show
            <BotaoAjuda kpiKey="no_show" />
            <Icone nome="calendar-x" />
          </span>
          <span
            className={`text-[28px] font-bold leading-none tracking-tight tabular-nums ${
              noShow == null ? "text-white/25" : "text-red-400"
            }`}
          >
            {numero(noShow)}
          </span>
          <Selo fonte="franquia" />
          <span className="text-[10px] leading-snug text-white/30">
            faltas em toda a agenda: avaliação, sessão e retorno
          </span>
        </div>

        {/* 3. Por que não fechou */}
        <div className="flex flex-col gap-2 rounded-xl border border-t-2 border-white/[0.08] bg-white/[0.02] p-4" style={{ borderTopColor: "#22d3ee" }}>
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-tight text-white/60">
            Semáforo
            <BotaoAjuda kpiKey="semaforo" />
            <Icone nome="traffic-lights" />
          </span>

          {carregando ? (
            <span className="text-[28px] font-bold leading-none text-white/25">—</span>
          ) : temSemaforo ? (
            <>
              <div className="mt-0.5 flex flex-col gap-1.5">
                {topo.map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className={`h-2 w-2 flex-none rounded-full ${corDaOpcao(s.label)}`} />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-white/60">
                      {curto(s.label)}
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-white/80">
                      {nf.format(s.value)}
                    </span>
                  </div>
                ))}
              </div>
              <Selo fonte="kommo" />
              <span className="text-[10px] leading-snug text-white/30">
                {nf.format(totalSemaforo)} preenchidos, da consulta em diante
              </span>
            </>
          ) : (
            <>
              <span className="text-[28px] font-bold leading-none tracking-tight text-white/25">
                —
              </span>
              <Selo fonte="kommo" />
              {/* Vazio aqui não é erro: é o campo que a equipe ainda não preenche.
                  Dizer isso evita a conclusão de que o painel está quebrado. */}
              <span className="text-[10px] leading-snug text-white/30">
                Ninguém preencheu o campo nesta unidade e período.
              </span>
            </>
          )}
      </div>
    </section>
  );
}

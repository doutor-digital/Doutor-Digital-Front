import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { historicoAvaliacoes, type SpineHistoricoMes } from "@/services/spine";

interface Props {
  unitId?: number;
  className?: string;
}

const COR = {
  compareceu: "#34d399",
  resto: "#94a3b8",
  taxa: "#5b9bd5",
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotulo = (comp: string) => {
  const [ano, mes] = comp.split("-").map(Number);
  return `${MESES[mes - 1]}/${String(ano).slice(2)}`;
};

function Dica({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p: SpineHistoricoMes = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-[11px] shadow-xl">
      <p className="mb-1 font-medium text-white/70">{label}</p>
      <p className="text-white/85">
        <span className="tabular-nums text-emerald-400">{p.compareceram}</span> de{" "}
        <span className="tabular-nums">{p.agendadas}</span> compareceram
      </p>
      <p className="text-white/50">
        {p.naoCompareceram} faltas · {p.desmarcadas} desmarques ·{" "}
        <span className="text-sky-400">{p.taxaComparecimento}%</span>
      </p>
    </div>
  );
}

/**
 * Tendência de avaliações mês a mês — a série longa que só existe porque
 * capturamos a agenda no nosso banco (a API do Doutor Hérnia só olha 100 dias).
 * Barras = volume (compareceram vs resto), linha = taxa de comparecimento.
 */
export function HistoricoAvaliacoesCard({ unitId, className }: Props) {
  const q = useQuery({
    queryKey: ["spine-historico", unitId],
    queryFn: () => historicoAvaliacoes(unitId!, 12),
    enabled: !!unitId,
    staleTime: 10 * 60_000,
    retry: false,
  });

  if (!unitId) return null;

  const serie = (q.data?.serie ?? []).map((m) => ({
    ...m,
    mes: rotulo(m.competencia),
    resto: m.agendadas - m.compareceram,
  }));

  const vazio = !q.isLoading && serie.length === 0;

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
            Avaliações — tendência
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            Série longa preservada no dashboard, além dos 100 dias do sistema clínico
          </p>
        </div>
      </div>

      {q.isLoading && <div className="mt-4 h-56 animate-pulse rounded-xl bg-white/5" />}

      {q.isError && (
        <p className="mt-4 text-[11px] text-white/40">Não foi possível carregar o histórico.</p>
      )}

      {vazio && (
        <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center">
          <p className="text-[13px] text-white/70">Ainda sem histórico.</p>
          <p className="mt-1 text-[11px] text-white/40">
            A captura preserva a agenda a partir do dia em que é ligada. Assim que a
            rotina diária rodar, os meses começam a aparecer aqui.
          </p>
        </div>
      )}

      {!q.isLoading && serie.length > 0 && (
        <div className="mt-4 h-56">
          <ResponsiveContainer>
            <ComposedChart data={serie} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="mes"
                stroke="rgba(255,255,255,0.25)"
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="vol"
                stroke="rgba(255,255,255,0.25)"
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis yAxisId="taxa" hide domain={[0, 100]} />
              <Tooltip content={<Dica />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar yAxisId="vol" dataKey="compareceram" stackId="a" radius={[0, 0, 0, 0]}>
                {serie.map((_, i) => (
                  <Cell key={i} fill={COR.compareceu} />
                ))}
              </Bar>
              <Bar yAxisId="vol" dataKey="resto" stackId="a" radius={[3, 3, 0, 0]}>
                {serie.map((_, i) => (
                  <Cell key={i} fill={COR.resto} fillOpacity={0.35} />
                ))}
              </Bar>
              <Line
                yAxisId="taxa"
                dataKey="taxaComparecimento"
                stroke={COR.taxa}
                strokeWidth={2}
                dot={{ r: 3, fill: COR.taxa }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {q.data?.capturandoDesde && (
        <p className="mt-3 text-[11px] text-white/35">
          Capturando desde {new Date(q.data.capturandoDesde).toLocaleDateString("pt-BR")} ·
          barras: comparecimento vs. resto · linha: taxa (%)
        </p>
      )}
    </div>
  );
}

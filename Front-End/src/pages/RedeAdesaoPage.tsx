/**
 * Adesão ao tratamento da rede: quantas sessões foram feitas, quantas o paciente faltou ou desmarcou e quantos
 * horários passaram sem baixa, unidade por unidade. É a tela de quem compara clínicas (chefe, dono), não de quem cuida do paciente.
 *
 * LGPD — por que a tela é assim:
 *  - só agregados: nenhum nome, CPF ou id de paciente chega aqui (o back nem monta esses campos);
 *  - unidade com poucos pacientes na janela vem oculta, sem número nenhum: numa clínica pequena,
 *    "1 falta" aponta uma pessoa;
 *  - a janela é fixa (30, 60 ou 90 dias terminando ontem): datas livres permitiriam subtrair duas
 *    respostas vizinhas e isolar um dia de uma unidade;
 *  - a evolução clínica de cada paciente NÃO é mostrada aqui. Ela terá tela própria, só para a unidade
 *    dona do paciente, com login individual e registro de quem abriu a ficha.
 *
 * Pior adesão no topo: é onde o dono precisa olhar primeiro.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Lock, RefreshCw } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { redeAdesao, type JanelaAdesao, type SpineRedeAdesaoUnidade } from "@/services/spine";
import { cn, formatNumber } from "@/lib/utils";

const PERIODOS: { dias: JanelaAdesao; label: string }[] = [
  { dias: 30, label: "30 dias" },
  { dias: 60, label: "60 dias" },
  { dias: 90, label: "90 dias" },
];

/** Verde a partir de 85%, âmbar de 70 a 85, vermelho abaixo. */
function corDaAdesao(taxa: number | null): string {
  if (taxa === null) return "text-slate-500";
  if (taxa >= 85) return "text-emerald-400";
  if (taxa >= 70) return "text-amber-300";
  return "text-rose-400";
}

const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1).replace(".", ",")}%`);
const dia = (s: string) => s.split("-").reverse().slice(0, 2).join("/");

function Kpi({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{rotulo}</p>
        <p className={cn("mt-2 text-3xl font-semibold tracking-tight text-slate-50", destaque)}>{valor}</p>
      </CardBody>
    </Card>
  );
}

function LinhaDaUnidade({ u }: { u: SpineRedeAdesaoUnidade }) {
  if (u.erro) {
    return (
      <tr className="border-t border-white/[0.05] text-slate-500">
        <td className="px-4 py-3 text-slate-300">{u.unidade}</td>
        <td colSpan={7} className="px-4 py-3 text-xs">Sem dados agora: {u.erro}</td>
      </tr>
    );
  }
  if (u.oculto) {
    return (
      <tr className="border-t border-white/[0.05] text-slate-500">
        <td className="px-4 py-3 text-slate-300">{u.unidade}</td>
        <td colSpan={7} className="px-4 py-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Poucos pacientes no período — números ocultos por privacidade (LGPD)
          </span>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-white/[0.05]">
      <td className="px-4 py-3 text-slate-200">
        {u.unidade}
        {u.incompleto && (
          <span className="ml-2 text-[11px] text-amber-300" title="A franquia devolveu o limite de linhas: os números podem estar abaixo do real.">
            dados parciais
          </span>
        )}
      </td>
      <td className={cn("px-4 py-3 text-right font-semibold tabular-nums", corDaAdesao(u.taxaAdesao))}>{pct(u.taxaAdesao)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatNumber(u.sessoesRealizadas)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatNumber(u.faltas)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatNumber(u.desmarcadas)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatNumber(u.semBaixa)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">
        {u.sessoesPorPaciente === null ? "—" : u.sessoesPorPaciente.toFixed(1).replace(".", ",")}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatNumber(u.tratamentosIniciados)}</td>
    </tr>
  );
}

export default function RedeAdesaoPage() {
  const [dias, setDias] = useState<JanelaAdesao>(30);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["spine", "rede", "adesao", dias],
    queryFn: () => redeAdesao(dias),
    staleTime: 5 * 60_000,
  });

  const serie = useMemo(
    () => (data?.serieSemanal ?? []).map((s) => ({ semana: dia(s.semanaInicio), Realizadas: s.realizadas, Horários: s.horarios })),
    [data],
  );

  return (
    <div>
      <PageHeader
        badge="Rede"
        title="Adesão ao tratamento"
        description="Sessões realizadas, faltas, desmarcações e horários sem baixa por unidade, até ontem. Só números agregados: nenhum paciente é identificado."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {PERIODOS.map((p) => (
              <Button key={p.dias} variant={dias === p.dias ? "primary" : "outline"} size="sm" onClick={() => setDias(p.dias)}>
                {p.label}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>
        }
      />

      {isLoading && <p className="text-sm text-slate-400">Consultando a franquia de cada unidade…</p>}
      {isError && (
        <EmptyState title="Não consegui carregar a adesão" description="A franquia pode estar fora do ar. Tente de novo em instantes." />
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Kpi rotulo="Adesão da rede" valor={pct(data.totais.taxaAdesao)} destaque={corDaAdesao(data.totais.taxaAdesao)} />
            <Kpi rotulo="Sessões realizadas" valor={formatNumber(data.totais.sessoesRealizadas)} />
            <Kpi rotulo="Faltas" valor={formatNumber(data.totais.faltas)} />
            <Kpi rotulo="Desmarcadas" valor={formatNumber(data.totais.desmarcadas)} />
            <Kpi rotulo="Sem baixa" valor={formatNumber(data.totais.semBaixa)} />
            <Kpi rotulo="Tratamentos iniciados" valor={formatNumber(data.totais.tratamentosIniciados)} />
          </div>

          <Card>
            <CardBody>
              <p className="mb-3 text-sm font-medium text-slate-200">Sessões por semana (rede)</p>
              {serie.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma semana inteira com sessões no período.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serie}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="semana" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <Bar dataKey="Realizadas" fill="#34d399" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500">Só semanas inteiras (segunda a domingo) dentro do período: as pontas incompletas ficam fora.</p>
            </CardBody>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-4 py-3 font-medium">Unidade</th>
                    <th className="px-4 py-3 text-right font-medium">Adesão</th>
                    <th className="px-4 py-3 text-right font-medium">Realizadas</th>
                    <th className="px-4 py-3 text-right font-medium">Faltas</th>
                    <th className="px-4 py-3 text-right font-medium">Desmarcadas</th>
                    <th className="px-4 py-3 text-right font-medium">Sem baixa</th>
                    <th className="px-4 py-3 text-right font-medium">Sessões / paciente</th>
                    <th className="px-4 py-3 text-right font-medium">Trat. iniciados</th>
                  </tr>
                </thead>
                <tbody>
                  {data.unidades.map((u) => (
                    <LinhaDaUnidade key={u.unitId} u={u} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {data.semToken.length > 0 && (
            <p className="text-xs text-slate-500">
              Sem conexão com a franquia: {data.semToken.map((s) => s.unidade).join(", ")}.
            </p>
          )}

          <p className="text-xs leading-relaxed text-slate-500">
            Período de {dia(data.de)} a {dia(data.ate)} (termina ontem). Adesão = realizadas ÷ (realizadas + faltas + desmarcadas + sem baixa).
            Remarcada não conta: ela gera outro horário, que conta por si. "Sem baixa" é horário que já passou e continua agendado na franquia.
            Unidades com menos de {data.sigiloMinimo} pacientes no período aparecem ocultas e não entram nos totais nem no gráfico, para ninguém ser identificado.
          </p>
        </div>
      )}
    </div>
  );
}

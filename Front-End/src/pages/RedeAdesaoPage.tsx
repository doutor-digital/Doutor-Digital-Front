/**
 * Adesão ao tratamento da rede: quantas sessões foram feitas, quantas o paciente faltou ou desmarcou,
 * unidade por unidade. É a tela de quem compara clínicas (chefe, dono), não de quem cuida do paciente.
 *
 * LGPD — por que a tela é assim:
 *  - só agregados: nenhum nome, CPF ou id de paciente chega aqui (o back nem monta esses campos);
 *  - unidade com poucos pacientes na janela vem oculta, sem número nenhum: numa clínica pequena,
 *    "1 falta" aponta uma pessoa;
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
import { redeAdesao, type SpineRedeAdesaoUnidade } from "@/services/spine";
import { cn, formatNumber } from "@/lib/utils";

const PERIODOS = [
  { dias: 30, label: "30 dias" },
  { dias: 60, label: "60 dias" },
  { dias: 90, label: "90 dias" },
] as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);

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
        <td colSpan={6} className="px-4 py-3 text-xs">Sem dados agora: {u.erro}</td>
      </tr>
    );
  }
  if (u.oculto) {
    return (
      <tr className="border-t border-white/[0.05] text-slate-500">
        <td className="px-4 py-3 text-slate-300">{u.unidade}</td>
        <td colSpan={6} className="px-4 py-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Poucos pacientes no período — números ocultos por privacidade (LGPD)
          </span>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-white/[0.05]">
      <td className="px-4 py-3 text-slate-200">{u.unidade}</td>
      <td className={cn("px-4 py-3 text-right font-semibold tabular-nums", corDaAdesao(u.taxaAdesao))}>{pct(u.taxaAdesao)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatNumber(u.sessoesRealizadas)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatNumber(u.faltas)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatNumber(u.desmarcadas)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">
        {u.sessoesPorPaciente === null ? "—" : u.sessoesPorPaciente.toFixed(1).replace(".", ",")}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{formatNumber(u.tratamentosEmAndamento)}</td>
    </tr>
  );
}

export default function RedeAdesaoPage() {
  const [dias, setDias] = useState<number>(30);
  const { de, ate } = useMemo(() => {
    const fim = new Date();
    const ini = new Date(fim);
    ini.setDate(ini.getDate() - dias);
    return { de: iso(ini), ate: iso(fim) };
  }, [dias]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["spine", "rede", "adesao", de, ate],
    queryFn: () => redeAdesao(de, ate),
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
        description="Sessões realizadas, faltas e desmarcações por unidade. Só números agregados: nenhum paciente é identificado."
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi rotulo="Adesão da rede" valor={pct(data.totais.taxaAdesao)} destaque={corDaAdesao(data.totais.taxaAdesao)} />
            <Kpi rotulo="Sessões realizadas" valor={formatNumber(data.totais.sessoesRealizadas)} />
            <Kpi rotulo="Faltas" valor={formatNumber(data.totais.faltas)} />
            <Kpi rotulo="Desmarcadas" valor={formatNumber(data.totais.desmarcadas)} />
            <Kpi rotulo="Tratamentos em andamento" valor={formatNumber(data.totais.tratamentosEmAndamento)} />
          </div>

          <Card>
            <CardBody>
              <p className="mb-3 text-sm font-medium text-slate-200">Sessões por semana (rede)</p>
              {serie.length === 0 ? (
                <p className="text-sm text-slate-500">Sem sessões no período.</p>
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
              <p className="mt-2 text-xs text-slate-500">Semana começa na segunda-feira. A semana atual ainda está em andamento.</p>
            </CardBody>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-4 py-3 font-medium">Unidade</th>
                    <th className="px-4 py-3 text-right font-medium">Adesão</th>
                    <th className="px-4 py-3 text-right font-medium">Realizadas</th>
                    <th className="px-4 py-3 text-right font-medium">Faltas</th>
                    <th className="px-4 py-3 text-right font-medium">Desmarcadas</th>
                    <th className="px-4 py-3 text-right font-medium">Sessões / paciente</th>
                    <th className="px-4 py-3 text-right font-medium">Trat. em andamento</th>
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
            Adesão = realizadas ÷ (realizadas + faltas + desmarcadas). Horário que ainda não chegou fica fora da conta.
            Unidades com menos de {data.sigiloMinimo} pacientes no período aparecem ocultas e não entram nos totais, para ninguém ser identificado.
          </p>
        </div>
      )}
    </div>
  );
}

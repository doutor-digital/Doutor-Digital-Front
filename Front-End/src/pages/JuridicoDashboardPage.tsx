import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bot,
  Clock,
  DollarSign,
  Loader2,
  Percent,
  Target,
  UserCheck,
  Users,
  Wallet,
} from "@/components/icons";
import { useClinic } from "@/hooks/useClinic";
import { KpiCard } from "@/components/kpi/KpiCard";
import { FunnelChart, type FunnelStage } from "@/components/charts/FunnelChart";
import { SourceDonut } from "@/components/charts/SourceDonut";
import { PeriodFilter, todayIso } from "@/components/ui/PeriodFilter";
import { juridicoService } from "@/services/juridico";
import { cn, formatNumber } from "@/lib/utils";

const fmtBRL = (n: number | null | undefined) =>
  typeof n === "number"
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "—";

const pct = (n: number | null | undefined) =>
  typeof n === "number" ? `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";

const mins = (n: number | null | undefined) =>
  typeof n === "number" ? `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min` : "—";

// ─── Bloco de seção no idioma dark-glass do app ──────────────────────────────
function Section({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
          {title}
        </h2>
        {hint && <span className="ml-auto text-[11px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, right, strong }: { children: React.ReactNode; right?: boolean; strong?: boolean }) {
  return (
    <td
      className={cn(
        "px-3 py-2 text-[12px] tabular-nums",
        right ? "text-right" : "text-left",
        strong ? "text-slate-100 font-medium" : "text-slate-300",
      )}
    >
      {children}
    </td>
  );
}

export default function JuridicoDashboardPage() {
  const { tenantId, unitId } = useClinic();
  const [from, setFrom] = useState<string>(todayIso(-30));
  const [presetKey, setPresetKey] = useState<string>("30d");
  const to = todayIso();

  const onPreset = (newFrom: string) => {
    setFrom(newFrom);
    const match = [
      ["7d", todayIso(-7)],
      ["30d", todayIso(-30)],
      ["90d", todayIso(-90)],
    ].find(([, f]) => f === newFrom);
    setPresetKey(match ? (match[0] as string) : "ytd");
  };

  const q = useQuery({
    queryKey: ["juridico", "dashboard", tenantId, unitId, from, to],
    queryFn: () =>
      juridicoService.dashboard({ clinicId: tenantId as number, unitId, from, to }),
    enabled: tenantId != null,
  });

  const d = q.data;

  const funnelStages = useMemo<FunnelStage[]>(() => {
    if (!d) return [];
    const c = d.conversao;
    return [
      { label: "Leads", count: c.lead, tone: "sky" },
      { label: "Qualificados", count: c.qualificado, tone: "indigo" },
      { label: "Agendados", count: c.agendado, tone: "amber" },
      { label: "Compareceram", count: c.compareceu, tone: "teal" },
      { label: "Contratos", count: c.contrato, tone: "emerald" },
    ];
  }, [d]);

  const areaDonut = useMemo(
    () => (d?.areaCaso ?? []).map((a) => ({ name: a.area, value: a.leads })),
    [d],
  );

  if (tenantId == null) {
    return <p className="text-sm text-slate-400">Selecione uma unidade para ver o dashboard.</p>;
  }

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando dashboard jurídico…
      </div>
    );
  }

  if (q.isError || !d) {
    return (
      <p className="text-sm text-rose-300">
        Não foi possível carregar o dashboard jurídico.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Dashboard Jurídico</h1>
          <p className="text-[12px] text-slate-500">
            {formatNumber(d.totalLeads)} leads no período · {from} → {to}
          </p>
        </div>
        <PeriodFilter activePreset={presetKey} onPreset={onPreset} />
      </div>

      {/* Aviso de campos não mapeados */}
      {d.camposNaoMapeados.length > 0 && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3 text-[12px] text-amber-100/90">
          <span className="font-medium">Configuração pendente:</span> mapeie estes campos da Kommo
          em Configurações Técnicas para as métricas saírem do zero —{" "}
          {d.camposNaoMapeados.join(", ")}.
        </div>
      )}

      {/* KPIs headline */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total de Leads" value={d.totalLeads} icon={<Users className="h-4 w-4" />} tone="sky" />
        <KpiCard
          label="Taxa de qualificação"
          value={pct(d.qualificacao.taxaQualificacao)}
          icon={<UserCheck className="h-4 w-4" />}
          tone="indigo"
          subtitle={`${d.qualificacao.qualificados} qualif. · ${d.qualificacao.desqualificados} desqualif.`}
        />
        <KpiCard
          label="Agendados"
          value={d.conversao.agendado}
          icon={<Target className="h-4 w-4" />}
          tone="amber"
          subtitle={`${pct(d.conversao.taxaAgendamento)} dos qualificados`}
        />
        <KpiCard
          label="Contratos"
          value={d.conversao.contrato}
          icon={<BarChart3 className="h-4 w-4" />}
          tone="emerald"
          subtitle={`${pct(d.conversao.taxaGeral)} do total`}
        />
        <KpiCard
          label="Honorário de êxito"
          value={fmtBRL(d.roi.honorarioExitoTotal)}
          icon={<DollarSign className="h-4 w-4" />}
          tone="emerald"
          subtitle={d.roi.roiGeral != null ? `ROI ${d.roi.roiGeral.toFixed(1)}x` : "sem investimento"}
        />
        <KpiCard
          label="SLA 1ª resposta"
          value={mins(d.sla.mediaMinutos)}
          icon={<Clock className="h-4 w-4" />}
          tone="violet"
          subtitle={`mediana ${mins(d.sla.medianaMinutos)}`}
        />
      </div>

      {/* Conversão + Área */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Conversão" icon={<Target className="h-3.5 w-3.5 text-slate-400" />} hint={d.conversao.gargalo ? `gargalo: ${d.conversao.gargalo}` : undefined}>
          <FunnelChart stages={funnelStages} />
        </Section>
        <Section title="Área de cada lead" icon={<BarChart3 className="h-3.5 w-3.5 text-slate-400" />}>
          {areaDonut.length > 0 ? (
            <SourceDonut data={areaDonut} />
          ) : (
            <p className="text-[12px] text-slate-500">Sem dados de área no período.</p>
          )}
        </Section>
      </div>

      {/* Qualidade das secretárias */}
      <Section title="Qualidade de vendas das secretárias" icon={<Users className="h-3.5 w-3.5 text-slate-400" />}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <Th>Secretária</Th>
                <Th right>Leads</Th>
                <Th right>Agend.</Th>
                <Th right>% Agend.</Th>
                <Th right>No-show</Th>
                <Th right>Contratos</Th>
                <Th right>% Fech.</Th>
                <Th>Onde perde</Th>
              </tr>
            </thead>
            <tbody>
              {d.secretarias.map((s) => (
                <tr key={s.nome} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <Td strong>{s.nome}</Td>
                  <Td right>{s.leads}</Td>
                  <Td right>{s.agendados}</Td>
                  <Td right>{pct(s.taxaAgendamento)}</Td>
                  <Td right>{pct(s.taxaNoShow)}</Td>
                  <Td right>{s.contratos}</Td>
                  <Td right>{pct(s.taxaFechamento)}</Td>
                  <Td>{s.principalMotivoPerda ?? "—"}</Td>
                </tr>
              ))}
              {d.secretarias.length === 0 && (
                <tr>
                  <Td>—</Td><Td right>0</Td><Td right>0</Td><Td right>—</Td>
                  <Td right>—</Td><Td right>0</Td><Td right>—</Td><Td>—</Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* IA + SLA por grupo */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Qualidade da I.A." icon={<Bot className="h-3.5 w-3.5 text-slate-400" />}>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Leads atendidos" value={d.ia.leadsAtendidos} tone="sky" />
            <KpiCard label="Qualificados pela IA" value={d.ia.qualificados} tone="indigo" subtitle={pct(d.ia.taxaQualificacao)} />
            <KpiCard label="IA → agendamento" value={pct(d.ia.taxaIaAgendamento)} tone="amber" subtitle={`${d.ia.agendadosPelaIa} agend.`} />
            <KpiCard label="Handoffs" value={d.ia.handoffs} tone="rose" subtitle={pct(d.ia.taxaHandoff)} />
            <KpiCard label="Contribui p/ contrato" value={d.ia.contribuiContratos} tone="emerald" />
            <KpiCard label="Onde a IA perde" value={d.ia.principalPerda ?? "—"} tone="slate" />
          </div>
        </Section>
        <Section title="SLA de 1ª resposta" icon={<Clock className="h-3.5 w-3.5 text-slate-400" />} hint={`${d.sla.leadsComResposta} leads com resposta`}>
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Média" value={mins(d.sla.mediaMinutos)} tone="violet" />
            <KpiCard label="Mediana" value={mins(d.sla.medianaMinutos)} tone="violet" />
            <KpiCard label="P90" value={mins(d.sla.p90Minutos)} tone="violet" />
          </div>
          {d.sla.porGrupo.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {d.sla.porGrupo.map((g) => (
                <div key={g.grupo} className="flex items-center justify-between text-[12px]">
                  <span className="text-slate-300">{g.grupo}</span>
                  <span className="tabular-nums text-slate-100">{mins(g.mediaMinutos)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Qualificado × Desqualificado por criativo */}
      <Section title="Qualificado × Desqualificado por criativo" icon={<Percent className="h-3.5 w-3.5 text-slate-400" />}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <Th>Criativo</Th>
                <Th right>Leads</Th>
                <Th right>Qualif.</Th>
                <Th right>Desqualif.</Th>
                <Th right>% Qualif.</Th>
              </tr>
            </thead>
            <tbody>
              {d.qualificacao.porCriativo.map((c) => (
                <tr key={c.criativo} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <Td strong>{c.criativo}</Td>
                  <Td right>{c.leads}</Td>
                  <Td right>{c.qualificados}</Td>
                  <Td right>{c.desqualificados}</Td>
                  <Td right>{pct(c.taxaQualificacao)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.qualificacao.motivosDesqualificacao.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {d.qualificacao.motivosDesqualificacao.map((m) => (
              <span key={m.label} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300">
                {m.label} · <span className="tabular-nums text-slate-100">{m.count}</span>
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* ROI por criativo */}
      <Section
        title="Receita real / ROI por criativo"
        icon={<Wallet className="h-3.5 w-3.5 text-slate-400" />}
        hint={`investimento ${fmtBRL(d.roi.investimentoTotal)}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <Th>Criativo</Th>
                <Th right>Leads</Th>
                <Th right>Contratos</Th>
                <Th right>Valor estimado</Th>
                <Th right>Honorário êxito</Th>
                <Th right>Investimento</Th>
                <Th right>ROI</Th>
              </tr>
            </thead>
            <tbody>
              {d.roi.porCriativo.map((c) => (
                <tr key={c.criativo} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <Td strong>{c.criativo}</Td>
                  <Td right>{c.leads}</Td>
                  <Td right>{c.contratos}</Td>
                  <Td right>{fmtBRL(c.valorEstimado)}</Td>
                  <Td right>{fmtBRL(c.honorarioExito)}</Td>
                  <Td right>{c.investimento > 0 ? fmtBRL(c.investimento) : "—"}</Td>
                  <Td right>{c.roi != null ? `${c.roi.toFixed(1)}x` : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

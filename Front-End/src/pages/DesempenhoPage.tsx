import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  DollarSign,
  Filter,
  Loader2,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { KpiDesempenhoCard } from "@/components/desempenho/KpiDesempenhoCard";
import { FunilHorizontal } from "@/components/desempenho/FunilHorizontal";
import { TabelaOrigens } from "@/components/desempenho/TabelaOrigens";
import { MotivosPerda } from "@/components/desempenho/MotivosPerda";
import {
  agregar,
  cac,
  carregarDados,
  cpl,
  fmtBRL,
  fmtInt,
  fmtRoas,
  PERIODO_PRESETS,
  periodoFromKey,
  roas,
  ticketMedio,
  type Periodo,
  type PeriodoKey,
} from "@/services/desempenho";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Seletor de período (Hoje / 7d / 30d / Mês / Personalizado). Estado em memória. */
function SeletorPeriodo({
  periodKey,
  onPreset,
  custom,
  onCustom,
}: {
  periodKey: PeriodoKey;
  onPreset: (k: PeriodoKey) => void;
  custom: { inicio: string; fim: string };
  onCustom: (r: { inicio: string; fim: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3 w-3 text-slate-500" />
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Período
        </span>
      </div>
      <div className="inline-flex items-center rounded-lg border border-white/[0.06] bg-white/[0.03] p-0.5">
        {PERIODO_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPreset(p.key)}
            className={cn(
              "rounded-md px-3 py-1 text-[11px] font-medium transition",
              periodKey === p.key
                ? "bg-white/[0.08] text-slate-50 shadow-sm"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {periodKey === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={custom.inicio}
            max={custom.fim}
            onChange={(e) => onCustom({ ...custom, inicio: e.target.value })}
            className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-slate-200 focus:border-brand-400/50 focus:outline-none"
          />
          <span className="text-[11px] text-slate-500">até</span>
          <input
            type="date"
            value={custom.fim}
            min={custom.inicio}
            max={todayIso()}
            onChange={(e) => onCustom({ ...custom, fim: e.target.value })}
            className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-slate-200 focus:border-brand-400/50 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}

function SkeletonDesempenho() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-7 w-24" />
            <Skeleton className="mt-3 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <Skeleton className="h-3 w-28" />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <Skeleton className="h-3 w-40" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DesempenhoPage() {
  const [periodKey, setPeriodKey] = useState<PeriodoKey>("30d");
  const [custom, setCustom] = useState({ inicio: todayIso(), fim: todayIso() });

  const periodo = useMemo<Periodo>(() => {
    if (periodKey === "custom") return { key: "custom", inicio: custom.inicio, fim: custom.fim };
    return periodoFromKey(periodKey);
  }, [periodKey, custom.inicio, custom.fim]);

  const { data, isLoading } = useQuery({
    queryKey: ["desempenho", periodo.key, periodo.inicio, periodo.fim],
    queryFn: () => carregarDados(periodo),
  });

  const totais = useMemo(() => (data ? agregar(data.origens) : null), [data]);
  const vazio = !totais || totais.leads === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <PageHeader
        badge="Mídia paga"
        title="Desempenho de Mídia"
        description="Investimento, receita e ROAS por origem — funil de conversão e motivos de perda. Investimento vem das APIs de Ads (via planilha/n8n); funil e receita, da Kommo."
        actions={
          <SeletorPeriodo
            periodKey={periodKey}
            onPreset={setPeriodKey}
            custom={custom}
            onCustom={setCustom}
          />
        }
      />

      {isLoading ? (
        <SkeletonDesempenho />
      ) : vazio ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 py-10">
          <EmptyState
            title="Sem dados no período"
            description="Nenhuma origem com leads no intervalo selecionado. Ajuste o período ou verifique a integração de Ads."
          />
        </div>
      ) : (
        <>
          {/* ─── Linha de KPIs (agregação de todas as origens) ─── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiDesempenhoCard label="Investimento" value={fmtBRL(totais.investimento)} icon={DollarSign} hint="Total em mídia paga" />
            <KpiDesempenhoCard label="Receita" value={fmtBRL(totais.receita)} icon={TrendingUp} hint="Tratamentos fechados" />
            <KpiDesempenhoCard
              label="ROAS"
              value={fmtRoas(roas(totais.receita, totais.investimento))}
              icon={Target}
              destaque
              hint="Receita ÷ investimento"
            />
            <KpiDesempenhoCard label="Leads" value={fmtInt(totais.leads)} icon={Users} hint="Total no período" />
            <KpiDesempenhoCard label="CPL" value={fmtBRL(cpl(totais.investimento, totais.leads))} icon={Filter} hint="Custo por lead" />
            <KpiDesempenhoCard label="Vendas" value={fmtInt(totais.fechados)} icon={UserCheck} hint="Tratamentos fechados" />
            <KpiDesempenhoCard label="CAC" value={fmtBRL(cac(totais.investimento, totais.fechados))} icon={Wallet} hint="Custo por cliente" />
            <KpiDesempenhoCard label="Ticket médio" value={fmtBRL(ticketMedio(totais.receita, totais.fechados))} icon={DollarSign} hint="Receita ÷ vendas" />
          </div>

          {/* ─── Funil horizontal ─── */}
          <FunilHorizontal totais={totais} />

          {/* ─── Tabela por origem ─── */}
          <TabelaOrigens origens={data!.origens} />

          {/* ─── Motivos de perda ─── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MotivosPerda titulo="Por que não agenda" motivos={data!.motivosNaoAgendamento} cor="amber" />
            <MotivosPerda titulo="Por que não fecha" motivos={data!.motivosNaoFechamento} cor="rose" />
          </div>
        </>
      )}
    </div>
  );
}

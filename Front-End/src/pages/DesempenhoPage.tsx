import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClinic } from "@/hooks/useClinic";
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
  carregarDados,
  cpc,
  cpl,
  cpm,
  ctr,
  custoPorConversa,
  fmtBRL,
  fmtInt,
  fmtPct,
  fmtRoas,
  PERIODO_PRESETS,
  periodoFromKey,
  roas,
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

  const { tenantId } = useClinic();

  const { data, isLoading } = useQuery({
    queryKey: ["desempenho", periodo.key, periodo.inicio, periodo.fim, tenantId],
    queryFn: () => carregarDados(periodo, tenantId),
  });

  const totais = useMemo(() => (data ? agregar(data.origens) : null), [data]);
  // Passa a considerar investimento: hoje a tela mostra gasto real por campanha,
  // com o funil ainda zerado — checar só `leads` mandaria tudo pro estado vazio.
  const vazio = !totais || (totais.leads === 0 && totais.investimento === 0);

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
          {/* Entrega — 100% real, vem do Meta junto com o gasto. */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiDesempenhoCard label="Investimento" value={fmtBRL(totais.investimento)} icon={DollarSign} hint="Gasto real no período" />
            <KpiDesempenhoCard label="Impressões" value={fmtInt(totais.impressoes)} icon={TrendingUp} hint="Vezes que o anúncio apareceu" />
            <KpiDesempenhoCard label="Cliques" value={fmtInt(totais.cliques)} icon={Users} hint="Cliques no anúncio" />
            <KpiDesempenhoCard label="CTR" value={fmtPct(ctr(totais.cliques, totais.impressoes))} icon={Filter} hint="Cliques ÷ impressões" />
            <KpiDesempenhoCard label="CPC" value={fmtBRL(cpc(totais.investimento, totais.cliques))} icon={Wallet} hint="Custo por clique" />
            <KpiDesempenhoCard label="CPM" value={fmtBRL(cpm(totais.investimento, totais.impressoes))} icon={DollarSign} hint="Custo por mil impressões" />
            <KpiDesempenhoCard label="Conversas" value={fmtInt(totais.conversas)} icon={UserCheck} hint="WhatsApp iniciados (Meta)" />
            <KpiDesempenhoCard
              label="Custo/conversa"
              value={fmtBRL(custoPorConversa(totais.investimento, totais.conversas))}
              icon={Target}
              destaque
              hint="Investimento ÷ conversas"
            />
          </div>

          {/* Negócio — depende de atribuir lead→campanha (CTWA). Ainda não ligado:
              mostramos "—" em vez de número inventado. */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiDesempenhoCard label="Leads (CRM)" value={fmtInt(totais.leads || null)} icon={Users} hint="Requer atribuição CTWA" />
            <KpiDesempenhoCard label="CPL real" value={fmtBRL(cpl(totais.investimento, totais.leads))} icon={Filter} hint="Requer atribuição CTWA" />
            <KpiDesempenhoCard label="Receita" value={fmtBRL(totais.receita || null)} icon={TrendingUp} hint="Requer atribuição CTWA" />
            <KpiDesempenhoCard
              label="ROAS"
              value={fmtRoas(roas(totais.receita, totais.investimento))}
              icon={Target}
              hint="Requer atribuição CTWA"
            />
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

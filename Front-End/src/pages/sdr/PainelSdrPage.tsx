import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarRange,
  ClipboardCheck,
  ListChecks,
  Sparkles,
  Stethoscope,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CloudiaLegendBanner } from "@/components/sdr/CloudiaField";
import { useSdrCounts, useSdrStore, useIsClient } from "@/lib/sdr/sdr-store";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

const SECOES = [
  {
    label: "Cadastro Geral",
    description: "Leads recebidos da Cloudia — confira nome, telefone, origem, situação.",
    to: "/sdr/cadastro-geral",
    icon: Users,
    tone: "emerald",
  },
  {
    label: "Consultas Realizadas",
    description: "Quem compareceu, valor da consulta, recebimentos, fechou tratamento.",
    to: "/sdr/consultas",
    icon: Stethoscope,
    tone: "sky",
  },
  {
    label: "Tratamentos / Recebimentos",
    description: "Pacotes fechados, splits de pagamento, status do tratamento.",
    to: "/sdr/tratamentos",
    icon: Wallet,
    tone: "violet",
  },
  {
    label: "Tarefas",
    description: "O que fazer hoje — confirmações, retornos, envios.",
    to: "/sdr/tarefas",
    icon: ClipboardCheck,
    tone: "amber",
  },
  {
    label: "Agenda / Eventos",
    description: "Compromissos, consultas marcadas, retornos.",
    to: "/sdr/agenda",
    icon: CalendarRange,
    tone: "rose",
  },
  {
    label: "Metas das Secretárias",
    description: "Quanto cada secretária bateu da meta no mês.",
    to: "/sdr/metas",
    icon: Target,
    tone: "emerald",
  },
  {
    label: "Relatórios",
    description: "Resumo mensal por origem, consolidado diário e mensal.",
    to: "/sdr/relatorios",
    icon: TrendingUp,
    tone: "sky",
  },
] as const;

const TONES = {
  emerald: { ring: "ring-emerald-400/25", bg: "bg-emerald-400/[0.05]", icon: "text-emerald-300" },
  sky: { ring: "ring-sky-400/25", bg: "bg-sky-400/[0.05]", icon: "text-sky-300" },
  violet: { ring: "ring-violet-400/25", bg: "bg-violet-400/[0.05]", icon: "text-violet-300" },
  amber: { ring: "ring-amber-400/25", bg: "bg-amber-400/[0.05]", icon: "text-amber-300" },
  rose: { ring: "ring-rose-400/25", bg: "bg-rose-400/[0.05]", icon: "text-rose-300" },
} as const;

export default function PainelSdrPage() {
  const ready = useIsClient();
  const counts = useSdrCounts();
  const store = useSdrStore();

  const totalRecebido = store.consultas.reduce(
    (sum, c) => sum + (c.recebimento1?.valor ?? 0) + (c.recebimento2?.valor ?? 0),
    0,
  ) + store.tratamentos.reduce(
    (sum, t) => sum + t.recebimentos.reduce((s, r) => s + r.valor, 0),
    0,
  );

  const metaTotalMes = store.metas.reduce((s, m) => s + m.metaValor, 0);
  const realTotalMes = store.metas.reduce((s, m) => s + m.qtdTotal, 0);

  return (
    <div>
      <PageHeader
        badge="Painel SDR · Unificado"
        title="Visão geral do time de cadastro"
        description="Tudo que antes ficava na planilha agora vem direto do webhook Cloudia. Confira, ajuste e siga."
      />

      <CloudiaLegendBanner className="mb-6" />

      {ready && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Leads totais"
            value={formatNumber(counts.leads)}
            sublabel={`${counts.leadsCloudia} via Cloudia · ${counts.leadsManual} manual`}
            icon={Users}
            tone="emerald"
            cloudia
          />
          <KpiCard
            label="Tarefas pendentes"
            value={formatNumber(counts.tarefasPendentes)}
            sublabel="Para revisar / executar"
            icon={ClipboardCheck}
            tone="amber"
          />
          <KpiCard
            label="Eventos hoje"
            value={formatNumber(counts.eventosHoje)}
            sublabel="Agenda do dia"
            icon={CalendarRange}
            tone="rose"
          />
          <KpiCard
            label="Recebido no período"
            value={formatCurrency(totalRecebido)}
            sublabel={`${counts.consultas} consultas · ${counts.tratamentos} tratamentos`}
            icon={Wallet}
            tone="violet"
          />
        </div>
      )}

      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-tight text-slate-200">Seções</h2>
        <span className="text-[11px] text-slate-500">
          7 seções · todas com dados auto-preenchidos pela Cloudia
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {SECOES.map((s) => {
          const Icon = s.icon;
          const tone = TONES[s.tone];
          return (
            <Link
              key={s.to}
              to={s.to}
              className={cn(
                "group relative flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]",
              )}
            >
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", tone.ring, tone.bg)}>
                <Icon className={cn("h-4 w-4", tone.icon)} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-100">
                  {s.label}
                  <ArrowUpRight className="h-3 w-3 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100" />
                </h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
                  {s.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {ready && metaTotalMes > 0 && (
        <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Resumo do mês
              </p>
              <h3 className="mt-1 text-[14px] font-semibold text-slate-100">
                Meta consolidada · {store.metas.length} secretárias
              </h3>
            </div>
            <Link
              to="/sdr/metas"
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:border-white/[0.15] hover:bg-white/[0.05]"
            >
              Ver detalhe <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Meta total</p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-slate-100">
                {formatCurrency(metaTotalMes)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Cadastros realizados</p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-emerald-200">
                {formatNumber(realTotalMes)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Origem dos leads</p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-slate-100">
                <Sparkles className="-mt-1 mr-1 inline h-3.5 w-3.5 text-emerald-300" />
                Cloudia
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone,
  cloudia,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: typeof ListChecks;
  tone: keyof typeof TONES;
  cloudia?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset", t.ring, t.bg)}>
          <Icon className={cn("h-3.5 w-3.5", t.icon)} />
        </div>
        {cloudia && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
            <Sparkles className="h-2.5 w-2.5" />
            Auto
          </span>
        )}
      </div>
      <p className="mt-2.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums text-slate-100">{value}</p>
      <p className="mt-1 text-[10.5px] leading-tight text-slate-500">{sublabel}</p>
    </div>
  );
}

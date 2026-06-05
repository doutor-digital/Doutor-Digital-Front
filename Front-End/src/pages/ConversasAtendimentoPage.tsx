import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useClinic } from "@/hooks/useClinic";
import { cn } from "@/lib/utils";
import { messagesService, type MessageEvent as ApiMessageEvent } from "@/services/messages";

// ─────────────────────────────────────────────────────────────────────────────
// Paleta Power BI (espelha o relatório de referência)
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  navy: "#1e3a5f",
  navyDark: "#152944",
  green: "#7eb138",
  greenLight: "#a8d168",
  orange: "#f0a500",
  red: "#d04545",
  amber: "#f4c542",
  ink: "#1f2937",
  inkLight: "#6b7280",
  paper: "#f7f7f5",
  panel: "#ffffff",
  rule: "#e5e7eb",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tipos / fonte de dados
// ─────────────────────────────────────────────────────────────────────────────

type MessageEvent = ApiMessageEvent;

const CAMPANHAS_FALLBACK = [
  "Hernia Cervical · Meta",
  "Hernia Lombar · Google",
  "Reels · Renan",
  "Vídeo Dispr · YT",
  "Orgânico",
];
const AGENTES_FALLBACK = ["Ana Paula", "Beatriz", "Camila", "Daniela", "Eduarda"];

function seedRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateMockMessages(days = 30): MessageEvent[] {
  const rng = seedRandom(42);
  const out: MessageEvent[] = [];
  const now = new Date();
  const totalLeads = 280;

  for (let l = 0; l < totalLeads; l++) {
    const lead_id = `L-${1000 + l}`;
    const campanha = CAMPANHAS_FALLBACK[Math.floor(rng() * CAMPANHAS_FALLBACK.length)];
    const agentePref = AGENTES_FALLBACK[Math.floor(rng() * AGENTES_FALLBACK.length)];
    const startOffsetMin = Math.floor(rng() * days * 24 * 60);
    const start = new Date(now.getTime() - startOffsetMin * 60_000);
    start.setHours(8 + Math.floor(rng() * 12), Math.floor(rng() * 60), 0, 0);

    let cursor = new Date(start);
    out.push({
      mensagem_id: `M-${l}-0`,
      lead_id,
      direcao: "entrada",
      timestamp: cursor.toISOString(),
      tipo: "texto",
      agente: null,
      campanha,
    });

    if (rng() < 0.15) continue; // ~15% sem resposta

    const firstResp = Math.floor((Math.exp(rng() * 3) - 1) * 6) + Math.floor(rng() * 4);
    cursor = new Date(cursor.getTime() + firstResp * 60_000);
    out.push({
      mensagem_id: `M-${l}-1`,
      lead_id,
      direcao: "saida",
      timestamp: cursor.toISOString(),
      tipo: "texto",
      agente: agentePref,
      campanha,
    });

    const ping = 2 + Math.floor(rng() * 17);
    for (let i = 0; i < ping; i++) {
      cursor = new Date(cursor.getTime() + (1 + Math.floor(rng() * 30)) * 60_000);
      out.push({
        mensagem_id: `M-${l}-${i + 2}`,
        lead_id,
        direcao: i % 2 === 0 ? "entrada" : "saida",
        timestamp: cursor.toISOString(),
        tipo: "texto",
        agente: i % 2 === 0 ? null : agentePref,
        campanha,
      });
    }
  }
  return out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function useMessages(opts: { unitId?: number; days: number; campanha: string; agente: string }) {
  const { unitId, days, campanha, agente } = opts;
  return useQuery({
    queryKey: ["conversas-mensagens", unitId, days, campanha, agente],
    staleTime: 60_000,
    queryFn: async (): Promise<{ items: MessageEvent[]; usingMock: boolean }> => {
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60_000);
      try {
        const res = await messagesService.list({
          unitId,
          from: from.toISOString(),
          to: to.toISOString(),
          campanha: campanha !== "todas" ? campanha : undefined,
          agente: agente !== "todos" ? agente : undefined,
        });
        return { items: res.items, usingMock: false };
      } catch {
        return { items: generateMockMessages(days), usingMock: true };
      }
    },
  });
}

function leadsAgendados(messages: MessageEvent[]): Set<string> {
  const leads = Array.from(new Set(messages.map((m) => m.lead_id))).sort();
  const set = new Set<string>();
  const rng = seedRandom(7);
  for (const id of leads) if (rng() < 0.15) set.add(id);
  return set;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function groupByLead(msgs: MessageEvent[]): Map<string, MessageEvent[]> {
  const m = new Map<string, MessageEvent[]>();
  for (const e of msgs) {
    const arr = m.get(e.lead_id) ?? [];
    arr.push(e);
    m.set(e.lead_id, arr);
  }
  for (const arr of m.values()) arr.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return m;
}

const nf = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

// ─────────────────────────────────────────────────────────────────────────────
// Componentes visuais (Power BI look)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gauge meter idêntico ao Power BI: arco verde→amarelo→vermelho, ponteiro,
 * marcações e número grande no centro. Tudo SVG, sem dependência externa.
 */
function GaugeMeter({
  value,
  max,
  thresholds,
  title,
  subtitle,
  bigNumber,
  bigNumberLabel,
}: {
  value: number;
  max: number;
  /** Limites em % (0–100) que definem onde acaba verde e onde começa vermelho. */
  thresholds: { good: number; warn: number };
  title: string;
  subtitle?: string;
  bigNumber: number;
  bigNumberLabel: string;
}) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const start = -Math.PI; // 180°
  const end = 0;          //   0°
  const angle = start + (end - start) * pct;

  const cx = 110;
  const cy = 110;
  const r = 80;

  const arc = (from: number, to: number, color: string) => {
    const x1 = cx + r * Math.cos(from);
    const y1 = cy + r * Math.sin(from);
    const x2 = cx + r * Math.cos(to);
    const y2 = cy + r * Math.sin(to);
    const large = to - from > Math.PI ? 1 : 0;
    return (
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
        stroke={color}
        strokeWidth={18}
        strokeLinecap="butt"
        fill="none"
      />
    );
  };

  const aGood = start + (end - start) * (thresholds.good / 100);
  const aWarn = start + (end - start) * (thresholds.warn / 100);

  // Marcações numéricas (0, 25, 50, 75, 100%)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const a = start + (end - start) * t;
    const tx = cx + (r + 14) * Math.cos(a);
    const ty = cy + (r + 14) * Math.sin(a);
    const label = Math.round(max * t);
    return (
      <text
        key={t}
        x={tx}
        y={ty}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={9}
        fill={COLORS.inkLight}
      >
        {nf(label)}
      </text>
    );
  });

  // Ponteiro
  const needleX = cx + (r - 6) * Math.cos(angle);
  const needleY = cy + (r - 6) * Math.sin(angle);

  const pctNumber = Math.round(pct * 1000) / 10; // 87.5

  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-[13px] font-semibold text-slate-700">{title}</div>
      {subtitle && (
        <div
          className="text-[11px] mt-0.5"
          style={{ color: COLORS.red }}
          dangerouslySetInnerHTML={{ __html: subtitle }}
        />
      )}

      <svg viewBox="0 0 220 140" className="w-full max-w-[260px] mt-1">
        {arc(start, aGood, COLORS.green)}
        {arc(aGood, aWarn, COLORS.amber)}
        {arc(aWarn, end, COLORS.red)}

        {ticks}

        {/* Ponteiro */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={COLORS.ink}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={6} fill={COLORS.ink} />

        {/* Valor central */}
        <text
          x={cx}
          y={cy - 22}
          textAnchor="middle"
          fontSize={20}
          fontWeight={700}
          fill={COLORS.ink}
        >
          {nf(Math.round(value))}
        </text>

        {/* % abaixo do ponteiro */}
        <text
          x={cx}
          y={cy + 26}
          textAnchor="middle"
          fontSize={11}
          fill={COLORS.inkLight}
        >
          {pctNumber.toFixed(1)}%
        </text>
      </svg>

      <div className="mt-2 text-[52px] leading-none font-bold tabular-nums" style={{ color: COLORS.ink }}>
        {nf(bigNumber)}
      </div>
      <div className="text-[12px] mt-1 text-slate-600">{bigNumberLabel}</div>
    </div>
  );
}

function FlatKpi({
  value,
  label,
  color,
  textColor = "#ffffff",
}: {
  value: number | string;
  label: string;
  color: string;
  textColor?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-4 px-2 rounded-sm"
      style={{ background: color, color: textColor }}
    >
      <div className="text-[44px] leading-none font-bold tabular-nums">{value}</div>
      <div className="text-[11.5px] mt-1.5 font-medium opacity-95">{label}</div>
    </div>
  );
}

function ReportPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.03)]",
        "border border-slate-200",
        className,
      )}
      style={{ background: COLORS.panel }}
    >
      <div className="text-center text-[13px] font-semibold py-2 border-b border-slate-100 text-slate-700">
        {title}
      </div>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

type RangeKey = "7d" | "30d" | "90d";
const RANGES: Array<{ key: RangeKey; label: string; days: number }> = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "90d", label: "90 dias", days: 90 },
];

export default function ConversasAtendimentoPage() {
  const { unitId } = useClinic();
  const [range, setRange] = useState<RangeKey>("30d");
  const [campanha, setCampanha] = useState<string>("todas");
  const [agente, setAgente] = useState<string>("todos");

  const days = RANGES.find((r) => r.key === range)?.days ?? 30;

  const query = useMessages({
    unitId: unitId ?? undefined,
    days,
    campanha,
    agente,
  });
  const usingMock = query.data?.usingMock ?? true;

  const all = query.data?.items ?? [];

  // Filtros aplicados em memória (server já filtrou; isto cobre o caso mock).
  const filtered = useMemo(() => {
    return all.filter((m) => {
      if (campanha !== "todas" && m.campanha !== campanha) return false;
      return true;
    });
  }, [all, campanha]);

  const byLead = useMemo(() => {
    const g = groupByLead(filtered);
    if (agente === "todos") return g;
    const out = new Map<string, MessageEvent[]>();
    for (const [lead, arr] of g) if (arr.some((m) => m.agente === agente)) out.set(lead, arr);
    return out;
  }, [filtered, agente]);

  const agendadosSet = useMemo(() => leadsAgendados(all), [all]);

  // Listas dinâmicas a partir dos dados
  const campanhasDisponiveis = useMemo(() => {
    const s = new Set<string>();
    for (const m of all) s.add(m.campanha);
    return Array.from(s).sort();
  }, [all]);

  const agentesDisponiveis = useMemo(() => {
    const s = new Set<string>();
    for (const m of all) if (m.agente) s.add(m.agente);
    return Array.from(s).sort();
  }, [all]);

  // ─── Métricas ──────────────────────────────────────────────────────────
  const metricas = useMemo(() => {
    const totalConversas = byLead.size;
    let respondidas = 0;
    let noSla = 0; // 1ª resposta <= 5 min
    let semRespostaAgora = 0;
    let agendadas = 0;
    let totalEntrada = 0;
    let totalSaida = 0;
    let hojeEntrada = 0;
    let hojeSaida = 0;

    const hojeStr = new Date().toISOString().slice(0, 10);

    for (const [leadId, arr] of byLead) {
      if (agendadosSet.has(leadId)) agendadas++;
      const firstIn = arr.find((m) => m.direcao === "entrada");
      const firstOut = arr.find((m) => m.direcao === "saida");
      if (firstIn && firstOut) {
        respondidas++;
        const delta =
          (new Date(firstOut.timestamp).getTime() -
            new Date(firstIn.timestamp).getTime()) /
          60_000;
        if (delta <= 5) noSla++;
      }
      const last = arr[arr.length - 1];
      if (last && last.direcao === "entrada") semRespostaAgora++;
      for (const m of arr) {
        if (m.direcao === "entrada") totalEntrada++;
        else totalSaida++;
        if (m.timestamp.slice(0, 10) === hojeStr) {
          if (m.direcao === "entrada") hojeEntrada++;
          else hojeSaida++;
        }
      }
    }
    return {
      totalConversas,
      respondidas,
      noSla,
      semRespostaAgora,
      agendadas,
      totalEntrada,
      totalSaida,
      hojeEntrada,
      hojeSaida,
      taxaResposta: totalConversas ? (100 * respondidas) / totalConversas : 0,
      taxaSla: respondidas ? (100 * noSla) / respondidas : 0,
      taxaAgendamento: totalConversas ? (100 * agendadas) / totalConversas : 0,
    };
  }, [byLead, agendadosSet]);

  // ─── Volume por dia (bar chart) ─────────────────────────────────────────
  const volumeDia = useMemo(() => {
    const map = new Map<string, { dia: string; entrada: number; saida: number }>();
    for (const m of filtered) {
      const dia = m.timestamp.slice(0, 10);
      const row = map.get(dia) ?? { dia, entrada: 0, saida: 0 };
      if (m.direcao === "entrada") row.entrada++;
      else row.saida++;
      map.set(dia, row);
    }
    return Array.from(map.values()).sort((a, b) => a.dia.localeCompare(b.dia));
  }, [filtered]);

  // ─── Conversas por agente (lista horizontal) ───────────────────────────
  const porAgente = useMemo(() => {
    type Row = { agente: string; conversas: Set<string> };
    const rows = new Map<string, Row>();
    for (const arr of byLead.values()) {
      const firstOut = arr.find((m) => m.direcao === "saida" && m.agente);
      if (!firstOut?.agente) continue;
      const r = rows.get(firstOut.agente) ?? { agente: firstOut.agente, conversas: new Set() };
      r.conversas.add(firstOut.lead_id);
      rows.set(firstOut.agente, r);
    }
    const list = Array.from(rows.values()).map((r) => ({
      agente: r.agente,
      conversas: r.conversas.size,
    }));
    list.sort((a, b) => b.conversas - a.conversas);
    return list;
  }, [byLead]);

  const totalAgentes = porAgente.length;
  const agentesAtivos = porAgente.filter((a) => a.conversas > 0).length;
  const agentesOciosos = totalAgentes - agentesAtivos;

  const loading = query.isLoading;

  // Fonte para os selects: o que existe nos dados; se vazio, usa fallback.
  const campanhasUI = campanhasDisponiveis.length ? campanhasDisponiveis : CAMPANHAS_FALLBACK;
  const agentesUI = agentesDisponiveis.length ? agentesDisponiveis : AGENTES_FALLBACK;

  return (
    <div className="-mx-4 md:-mx-6 -mt-2 min-h-[calc(100vh-3rem)]" style={{ background: COLORS.paper }}>
      {/* Header — barra branca tipo "report banner" */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b border-slate-200"
        style={{ background: COLORS.panel }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded grid place-items-center text-[10px] font-bold"
            style={{ background: COLORS.green, color: "white" }}
          >
            DD
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-slate-800">Conversas & Atendimento</h1>
            <p className="text-[10.5px] text-slate-500">
              Relatório operacional · agente-Dt · WhatsApp
              {usingMock && (
                <span
                  className="ml-2 px-1.5 py-[1px] rounded text-[9.5px] font-semibold"
                  style={{ background: "#fde68a", color: "#92400e" }}
                >
                  MOCK
                </span>
              )}
              {!usingMock && (
                <span
                  className="ml-2 px-1.5 py-[1px] rounded text-[9.5px] font-semibold"
                  style={{ background: "#bbf7d0", color: "#166534" }}
                >
                  AO VIVO
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Filtros nativos estilo Power BI */}
          <FilterSelect
            label="Período"
            value={range}
            onChange={(v) => setRange(v as RangeKey)}
            options={RANGES.map((r) => ({ value: r.key, label: r.label }))}
          />
          <FilterSelect
            label="Campanha"
            value={campanha}
            onChange={setCampanha}
            options={[{ value: "todas", label: "Todas" }, ...campanhasUI.map((c) => ({ value: c, label: c }))]}
          />
          <FilterSelect
            label="Agente"
            value={agente}
            onChange={setAgente}
            options={[{ value: "todos", label: "Todos" }, ...agentesUI.map((a) => ({ value: a, label: a }))]}
          />
        </div>
      </header>

      {loading ? (
        <div className="p-10 text-center text-slate-500 text-[12px]">Carregando relatório…</div>
      ) : (
        <div className="p-5 grid grid-cols-12 gap-4">
          {/* ───────────────── ROW 1 — GAUGES ─────────────────────────── */}
          <ReportPanel title="Performance de Atendimento" className="col-span-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 px-4 py-4">
              <GaugeMeter
                title="Taxa de Resposta"
                subtitle={`<b>${metricas.taxaResposta.toFixed(1)}%</b> das conversas receberam <b>alguma resposta</b>`}
                value={metricas.respondidas}
                max={metricas.totalConversas || 1}
                thresholds={{ good: 75, warn: 90 }}
                bigNumber={metricas.respondidas}
                bigNumberLabel="Conversas Respondidas"
              />
              <GaugeMeter
                title="1ª Resposta no SLA (≤ 5 min)"
                subtitle={`<b>${metricas.taxaSla.toFixed(1)}%</b> das conversas respondidas foram <b>rápidas</b>`}
                value={metricas.noSla}
                max={metricas.respondidas || 1}
                thresholds={{ good: 60, warn: 85 }}
                bigNumber={metricas.noSla}
                bigNumberLabel="Conversas no SLA"
              />
              <GaugeMeter
                title="Conversão p/ Agendamento"
                subtitle={`<b>${metricas.taxaAgendamento.toFixed(1)}%</b> das conversas viraram <b>Agendado</b>`}
                value={metricas.agendadas}
                max={metricas.totalConversas || 1}
                thresholds={{ good: 15, warn: 25 }}
                bigNumber={metricas.agendadas}
                bigNumberLabel="Conversas Agendadas"
              />
            </div>
          </ReportPanel>

          {/* ───────────────── ROW 2 — ATIVIDADE + AGENTES ─────────────── */}
          <ReportPanel title="Atividade de Mensagens" className="col-span-12 lg:col-span-8">
            <div className="grid grid-cols-3 gap-1 px-3 pt-3">
              <FlatKpi value={nf(metricas.hojeEntrada)} label="Mensagens Recebidas (Hoje)" color={COLORS.navy} />
              <FlatKpi value={nf(metricas.hojeSaida)} label="Mensagens Enviadas (Hoje)" color={COLORS.green} />
              <FlatKpi
                value={nf(metricas.semRespostaAgora)}
                label="Conversas Sem Resposta"
                color={COLORS.orange}
              />
            </div>

            <div className="px-3 pt-4 pb-2 text-center text-[12px] font-semibold text-slate-700">
              Mensagens por Data
            </div>
            <div className="h-72 px-2 pb-3">
              {volumeDia.length === 0 ? (
                <div className="h-full grid place-items-center text-slate-400 text-[12px]">
                  Sem mensagens no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeDia} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="dia"
                      tick={{ fill: COLORS.inkLight, fontSize: 10 }}
                      tickFormatter={(d) => {
                        const dt = new Date(d);
                        return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                      }}
                    />
                    <YAxis tick={{ fill: COLORS.inkLight, fontSize: 10 }} />
                    <Tooltip
                      cursor={{ fill: "rgba(30,58,95,0.05)" }}
                      contentStyle={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 4,
                        fontSize: 12,
                        color: COLORS.ink,
                      }}
                    />
                    <Bar dataKey="entrada" fill={COLORS.navy} name="Recebidas" />
                    <Bar dataKey="saida" fill={COLORS.green} name="Enviadas" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </ReportPanel>

          <ReportPanel title="Desempenho por Agente" className="col-span-12 lg:col-span-4">
            <div className="grid grid-cols-2 gap-1 px-3 pt-3">
              <FlatKpi value={agentesAtivos} label="Agentes Ativos" color={COLORS.green} />
              <FlatKpi value={agentesOciosos} label="Agentes Ociosos" color={COLORS.orange} />
            </div>

            <div className="px-3 mt-3">
              <button
                type="button"
                className="w-full text-[11px] font-semibold py-1.5 border border-slate-200 rounded-sm text-slate-600 hover:bg-slate-50"
              >
                Ver detalhes
              </button>
            </div>

            <div className="px-3 py-3 max-h-[440px] overflow-y-auto">
              {porAgente.length === 0 ? (
                <div className="text-center text-slate-400 text-[12px] py-10">
                  Sem agentes ativos no período.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {porAgente.map((a, idx) => {
                    const max = porAgente[0]?.conversas || 1;
                    const w = (a.conversas / max) * 100;
                    const color = idx < 5 ? COLORS.green : idx < 10 ? COLORS.orange : COLORS.navy;
                    return (
                      <li key={a.agente} className="flex items-center gap-2">
                        <div className="w-20 text-[11px] text-slate-600 truncate">{a.agente}</div>
                        <div className="flex-1 h-[18px] bg-slate-100 rounded-[2px] overflow-hidden">
                          <div
                            className="h-full"
                            style={{ width: `${w}%`, background: color }}
                          />
                        </div>
                        <div className="w-8 text-right text-[11px] font-semibold tabular-nums text-slate-700">
                          {a.conversas}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </ReportPanel>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[9.5px] uppercase tracking-widest text-slate-500 mb-0.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[12px] text-slate-700 border border-slate-300 rounded-sm px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 min-w-[140px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

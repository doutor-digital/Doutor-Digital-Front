import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronRight,
  Clock,
  Filter,
  Flame,
  Gauge,
  Inbox,
  Timer,
  TrendingUp,
  Users2,
} from "@/components/icons";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { messagesService, type MessageEvent as ApiMessageEvent } from "@/services/messages";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

// Reaproveita o contrato exposto pelo service.
type MessageEvent = ApiMessageEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Mock realista (substituir por endpoint real)
// ─────────────────────────────────────────────────────────────────────────────

const CAMPANHAS = ["Hernia Cervical · Meta", "Hernia Lombar · Google", "Reels · Renan", "Vídeo Dispr · YT", "Orgânico"];
const AGENTES = ["Ana Paula", "Beatriz", "Camila", "Daniela", "Eduarda"];

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
    const campanha = CAMPANHAS[Math.floor(rng() * CAMPANHAS.length)];
    const agentePref = AGENTES[Math.floor(rng() * AGENTES.length)];

    const startOffsetMin =
      Math.floor(rng() * days * 24 * 60); // entre 0 e `days` dias atrás
    const start = new Date(now.getTime() - startOffsetMin * 60_000);
    // Concentra mensagens em horário comercial
    start.setHours(8 + Math.floor(rng() * 12), Math.floor(rng() * 60), 0, 0);

    // Primeira mensagem do lead = "entrada"
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

    // ~15% das conversas ficam sem resposta (objetivo de negócio)
    const ficaSemResposta = rng() < 0.15;
    if (ficaSemResposta) continue;

    // Tempo de 1ª resposta: distribuição log-normal-ish (mediana ~7min, cauda longa)
    const firstResp =
      Math.floor((Math.exp(rng() * 3) - 1) * 6) + Math.floor(rng() * 4);
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

    // 2–18 mensagens de ping-pong
    const ping = 2 + Math.floor(rng() * 17);
    for (let i = 0; i < ping; i++) {
      cursor = new Date(cursor.getTime() + (1 + Math.floor(rng() * 30)) * 60_000);
      out.push({
        mensagem_id: `M-${l}-${i + 2}`,
        lead_id,
        direcao: i % 2 === 0 ? "entrada" : "saida",
        timestamp: cursor.toISOString(),
        tipo: rng() < 0.85 ? "texto" : rng() < 0.5 ? "imagem" : "audio",
        agente: i % 2 === 0 ? null : agentePref,
        campanha,
      });
    }
  }

  return out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Tenta o endpoint real (`messagesService.list`). Enquanto o backend não
 * implementa, cai no mock — o badge âmbar na barra de filtros sinaliza isso
 * pra todo mundo que abrir a tela.
 */
function useMessages(opts: {
  unitId?: number;
  days: number;
  campanha: string;
  agente: string;
}) {
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
        // Endpoint ainda não existe — backend devolve 404. Mantém UX viva.
        return { items: generateMockMessages(days), usingMock: true };
      }
    },
  });
}

// 🔌 Mock realista: ~15% das conversas marcadas como "agendaram".
function leadsAgendados(messages: MessageEvent[]): Set<string> {
  const leads = Array.from(new Set(messages.map((m) => m.lead_id))).sort();
  const set = new Set<string>();
  const rng = seedRandom(7);
  for (const id of leads) {
    if (rng() < 0.15) set.add(id);
  }
  return set;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de agregação
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

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fmtMin(min: number): string {
  if (!isFinite(min) || min <= 0) return "—";
  if (min < 60) return `${min.toFixed(1)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h < 24) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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

  const filtered = useMemo(() => {
    const all = query.data?.items ?? [];
    return all.filter((m) => {
      if (campanha !== "todas" && m.campanha !== campanha) return false;
      if (agente !== "todos") {
        // Para "agente" filtramos as conversas em que esse agente respondeu pelo menos uma vez.
        // O filtro real é resolvido na sequência (agrupando por lead).
      }
      return true;
    });
  }, [query.data, campanha, agente]);

  // Para filtros por agente, agrupamos por lead e mantemos a conversa
  // se o agente respondeu nela ao menos uma vez.
  const byLead = useMemo(() => {
    const grouped = groupByLead(filtered);
    if (agente === "todos") return grouped;
    const out = new Map<string, MessageEvent[]>();
    for (const [lead, arr] of grouped) {
      if (arr.some((m) => m.agente === agente)) out.set(lead, arr);
    }
    return out;
  }, [filtered, agente]);

  const agendadosSet = useMemo(
    () => leadsAgendados(query.data?.items ?? []),
    [query.data],
  );

  // ─── HERO 1 — Primeira resposta ────────────────────────────────────────
  const firstResponse = useMemo(() => {
    const tempos: number[] = [];
    for (const arr of byLead.values()) {
      const firstIn = arr.find((m) => m.direcao === "entrada");
      if (!firstIn) continue;
      const firstOut = arr.find(
        (m) =>
          m.direcao === "saida" &&
          new Date(m.timestamp).getTime() >= new Date(firstIn.timestamp).getTime(),
      );
      if (!firstOut) continue;
      const diff =
        (new Date(firstOut.timestamp).getTime() -
          new Date(firstIn.timestamp).getTime()) /
        60_000;
      tempos.push(diff);
    }
    const avg = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
    return { avg, mediana: median(tempos), n: tempos.length };
  }, [byLead]);

  // ─── HERO 2 — Conversas sem resposta agora ─────────────────────────────
  const semResposta = useMemo(() => {
    const list: Array<{ leadId: string; ultima: string; campanha: string; mensagens: number }> = [];
    for (const [leadId, arr] of byLead) {
      const last = arr[arr.length - 1];
      if (last.direcao === "entrada") {
        list.push({
          leadId,
          ultima: last.timestamp,
          campanha: last.campanha,
          mensagens: arr.length,
        });
      }
    }
    list.sort((a, b) => b.ultima.localeCompare(a.ultima));
    return list;
  }, [byLead]);

  // ─── Volume por dia ────────────────────────────────────────────────────
  const volumeDia = useMemo(() => {
    const map = new Map<string, { dia: string; entrada: number; saida: number; novas: number }>();
    const novasLeads = new Set<string>();
    for (const m of filtered) {
      const dia = m.timestamp.slice(0, 10);
      const row = map.get(dia) ?? { dia, entrada: 0, saida: 0, novas: 0 };
      if (m.direcao === "entrada") row.entrada++;
      else row.saida++;
      map.set(dia, row);
    }
    // Conversas novas/dia = primeira mensagem (entrada) por lead
    for (const [leadId, arr] of byLead) {
      const first = arr[0];
      if (!first) continue;
      if (novasLeads.has(leadId)) continue;
      novasLeads.add(leadId);
      const dia = first.timestamp.slice(0, 10);
      const row = map.get(dia) ?? { dia, entrada: 0, saida: 0, novas: 0 };
      row.novas++;
      map.set(dia, row);
    }
    return Array.from(map.values()).sort((a, b) => a.dia.localeCompare(b.dia));
  }, [filtered, byLead]);

  // ─── Heatmap (entrada) ─────────────────────────────────────────────────
  const heatmap = useMemo(() => {
    const cells: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const m of filtered) {
      if (m.direcao !== "entrada") continue;
      const d = new Date(m.timestamp);
      const w = d.getDay();
      const h = d.getHours();
      cells[w][h]++;
      if (cells[w][h] > max) max = cells[w][h];
    }
    return { cells, max };
  }, [filtered]);

  // ─── Tabela por agente ─────────────────────────────────────────────────
  const porAgente = useMemo(() => {
    type Row = { agente: string; conversas: Set<string>; tempos: number[] };
    const rows = new Map<string, Row>();
    for (const arr of byLead.values()) {
      const firstIn = arr.find((m) => m.direcao === "entrada");
      if (!firstIn) continue;
      const firstOut = arr.find(
        (m) =>
          m.direcao === "saida" &&
          new Date(m.timestamp).getTime() >= new Date(firstIn.timestamp).getTime(),
      );
      if (!firstOut || !firstOut.agente) continue;
      const r = rows.get(firstOut.agente) ?? {
        agente: firstOut.agente,
        conversas: new Set(),
        tempos: [],
      };
      r.conversas.add(firstIn.lead_id);
      r.tempos.push(
        (new Date(firstOut.timestamp).getTime() -
          new Date(firstIn.timestamp).getTime()) /
          60_000,
      );
      rows.set(firstOut.agente, r);
    }
    const list = Array.from(rows.values()).map((r) => ({
      agente: r.agente,
      conversas: r.conversas.size,
      media: r.tempos.length ? r.tempos.reduce((a, b) => a + b, 0) / r.tempos.length : 0,
    }));
    list.sort((a, b) => a.media - b.media);
    return list;
  }, [byLead]);

  // ─── Eficiência por campanha ───────────────────────────────────────────
  const porCampanha = useMemo(() => {
    type Row = { campanha: string; conversas: number; agendadas: number; msgsAteAgendar: number[] };
    const rows = new Map<string, Row>();
    for (const [leadId, arr] of byLead) {
      const camp = arr[0]?.campanha ?? "—";
      const r = rows.get(camp) ?? { campanha: camp, conversas: 0, agendadas: 0, msgsAteAgendar: [] };
      r.conversas++;
      if (agendadosSet.has(leadId)) {
        r.agendadas++;
        r.msgsAteAgendar.push(arr.length);
      }
      rows.set(camp, r);
    }
    return Array.from(rows.values())
      .map((r) => ({
        campanha: r.campanha,
        conversas: r.conversas,
        agendadas: r.agendadas,
        taxa: r.conversas ? (100 * r.agendadas) / r.conversas : 0,
        mediaMsgs: r.msgsAteAgendar.length
          ? r.msgsAteAgendar.reduce((a, b) => a + b, 0) / r.msgsAteAgendar.length
          : 0,
      }))
      .sort((a, b) => b.taxa - a.taxa);
  }, [byLead, agendadosSet]);

  const loading = query.isLoading;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Conversas & Atendimento"
        description="Volume, primeira resposta, gargalos por agente e eficiência por campanha — feed em tempo real do webhook do WhatsApp."
        badge="Operacional · WhatsApp"
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <span className="text-[11px] uppercase tracking-widest text-slate-500">Período</span>
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              "rounded-md px-3 py-1 text-[11.5px] font-medium",
              range === r.key
                ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            {r.label}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-white/10" />

        <span className="text-[11px] uppercase tracking-widest text-slate-500">Campanha</span>
        <select
          value={campanha}
          onChange={(e) => setCampanha(e.target.value)}
          className="rounded-md bg-slate-900/70 px-2 py-1 text-[12px] text-slate-200 ring-1 ring-slate-700/60 focus:outline-none focus:ring-emerald-500/40"
        >
          <option value="todas">Todas</option>
          {CAMPANHAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <span className="mx-1 h-4 w-px bg-white/10" />

        <span className="text-[11px] uppercase tracking-widest text-slate-500">Agente</span>
        <select
          value={agente}
          onChange={(e) => setAgente(e.target.value)}
          className="rounded-md bg-slate-900/70 px-2 py-1 text-[12px] text-slate-200 ring-1 ring-slate-700/60 focus:outline-none focus:ring-emerald-500/40"
        >
          <option value="todos">Todos</option>
          {AGENTES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        {usingMock ? (
          <div className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[10.5px] text-amber-200 ring-1 ring-amber-500/30">
            <Filter className="h-3 w-3" /> Mock — endpoint <code className="font-mono">GET /api/conversations/messages</code> ainda não disponível
          </div>
        ) : (
          <div className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[10.5px] text-emerald-200 ring-1 ring-emerald-500/30">
            <Filter className="h-3 w-3" /> Dados ao vivo · <code className="font-mono">webhook_whatsapp_messages</code>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 rounded-2xl bg-white/[0.02] animate-pulse" />
          <div className="h-48 rounded-2xl bg-white/[0.02] animate-pulse" />
        </div>
      ) : (
        <>
          {/* HERO */}
          <div className="grid gap-4 md:grid-cols-2">
            <HeroFirstResponse
              avg={firstResponse.avg}
              mediana={firstResponse.mediana}
              n={firstResponse.n}
            />
            <HeroNoReply lista={semResposta} />
          </div>

          {/* VOLUME */}
          <SectionCard
            title="Volume · entradas, respostas e novas conversas"
            description="Barras empilhadas: entradas (cinza) + saídas (verde). Linha: conversas novas/dia."
            icon={<TrendingUp className="h-4 w-4 text-emerald-300" />}
          >
            {volumeDia.length === 0 ? (
              <div className="p-8"><EmptyState title="Sem mensagens no período" /></div>
            ) : (
              <div className="h-72 px-2 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeDia} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="dia" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,23,42,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="entrada" stackId="a" fill="#475569" name="Entrada" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="saida" stackId="a" fill="#10b981" name="Saída" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {volumeDia.length > 0 && (
              <div className="h-44 px-2 pb-4 border-t border-slate-800/60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volumeDia} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="dia" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,23,42,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="novas" stroke="#a78bfa" strokeWidth={2} dot={false} name="Conversas novas" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          {/* HEATMAP */}
          <SectionCard
            title="Horário de pico · mensagens recebidas"
            description="Hora × dia da semana. Use para dimensionar escala de atendimento."
            icon={<Flame className="h-4 w-4 text-orange-300" />}
          >
            <div className="p-5 overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="grid" style={{ gridTemplateColumns: "60px repeat(24, 1fr)" }}>
                  <div />
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="text-[9px] text-slate-500 text-center tabular-nums">
                      {h}
                    </div>
                  ))}
                  {Array.from({ length: 7 }).map((_, w) => (
                    <div key={`row-${w}`} className="contents">
                      <div className="text-[10px] text-slate-500 pr-2 flex items-center">{WEEKDAYS[w]}</div>
                      {Array.from({ length: 24 }).map((_, h) => {
                        const count = heatmap.cells[w][h];
                        const intensity = heatmap.max > 0 ? count / heatmap.max : 0;
                        return (
                          <div
                            key={`c${w}-${h}`}
                            title={`${WEEKDAYS[w]} ${h}h — ${count} entradas`}
                            className="aspect-square m-px rounded-sm"
                            style={{
                              backgroundColor:
                                intensity === 0
                                  ? "rgba(255,255,255,0.03)"
                                  : `rgba(251, 146, 60, ${0.15 + intensity * 0.85})`,
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* TABELA POR AGENTE */}
          <SectionCard
            title="Tempo de 1ª resposta por agente"
            description="Conversas em que cada agente foi a primeira voz da clínica. Lentos em vermelho."
            icon={<Users2 className="h-4 w-4 text-sky-300" />}
          >
            {porAgente.length === 0 ? (
              <div className="p-8"><EmptyState title="Sem agentes no período" /></div>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="bg-slate-900/40 text-[10px] text-slate-500 uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Agente</th>
                    <th className="px-4 py-2.5 text-right">Conversas</th>
                    <th className="px-4 py-2.5 text-right">Média 1ª resposta</th>
                    <th className="px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {porAgente.map((r) => {
                    const lento = r.media > 30;     // > 30 min = vermelho
                    const atencao = r.media > 10;   // 10–30 min = amarelo
                    return (
                      <tr key={r.agente} className="border-t border-slate-800/40 hover:bg-slate-800/20">
                        <td className="px-4 py-2.5 text-slate-200">{r.agente}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(r.conversas)}</td>
                        <td
                          className={cn(
                            "px-4 py-2.5 text-right tabular-nums font-bold",
                            lento ? "text-rose-300" : atencao ? "text-amber-300" : "text-emerald-300",
                          )}
                        >
                          {fmtMin(r.media)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] ring-1 ring-inset",
                              lento
                                ? "bg-rose-500/10 text-rose-200 ring-rose-500/30"
                                : atencao
                                  ? "bg-amber-500/10 text-amber-200 ring-amber-500/30"
                                  : "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30",
                            )}
                          >
                            {lento ? "Lento" : atencao ? "Atenção" : "Bom"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </SectionCard>

          {/* EFICIÊNCIA POR CAMPANHA */}
          <SectionCard
            title="Eficiência por campanha"
            description="Quantas mensagens, em média, até virar Agendado — e o % de conversas que agendam."
            icon={<Gauge className="h-4 w-4 text-violet-300" />}
          >
            {porCampanha.length === 0 ? (
              <div className="p-8"><EmptyState title="Sem campanhas no período" /></div>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="bg-slate-900/40 text-[10px] text-slate-500 uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Campanha</th>
                    <th className="px-4 py-2.5 text-right">Conversas</th>
                    <th className="px-4 py-2.5 text-right">Agendadas</th>
                    <th className="px-4 py-2.5 text-right">Msgs até agendar</th>
                    <th className="px-4 py-2.5 text-right">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {porCampanha.map((r) => (
                    <tr key={r.campanha} className="border-t border-slate-800/40 hover:bg-slate-800/20">
                      <td className="px-4 py-2.5 text-slate-200">{r.campanha}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(r.conversas)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(r.agendadas)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {r.mediaMsgs > 0 ? r.mediaMsgs.toFixed(1) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-right tabular-nums font-bold",
                          r.taxa >= 20
                            ? "text-emerald-300"
                            : r.taxa >= 10
                              ? "text-amber-300"
                              : "text-rose-300",
                        )}
                      >
                        {formatPercent(r.taxa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function HeroFirstResponse({ avg, mediana, n }: { avg: number; mediana: number; n: number }) {
  const tone =
    avg <= 5 ? "emerald" : avg <= 15 ? "sky" : avg <= 30 ? "amber" : "rose";
  const toneClasses: Record<string, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/5 ring-emerald-500/30 text-emerald-200",
    sky: "from-sky-500/15 to-sky-500/5 ring-sky-500/30 text-sky-200",
    amber: "from-amber-500/15 to-amber-500/5 ring-amber-500/30 text-amber-200",
    rose: "from-rose-500/15 to-rose-500/5 ring-rose-500/30 text-rose-200",
  };
  return (
    <div
      className={cn(
        "rounded-2xl p-6 ring-1 ring-inset bg-gradient-to-br",
        toneClasses[tone],
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
            1ª Resposta
          </p>
          <h3 className="mt-1 text-[14px] font-semibold text-slate-100">Tempo médio até a primeira saída</h3>
        </div>
        <div className="h-10 w-10 rounded-lg bg-white/5 grid place-items-center">
          <Timer className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 flex items-end gap-4">
        <p className="text-5xl font-extrabold tabular-nums tracking-tight text-slate-50">
          {fmtMin(avg)}
        </p>
        <div className="pb-1">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Mediana</p>
          <p className="text-lg font-bold tabular-nums text-slate-200">{fmtMin(mediana)}</p>
        </div>
      </div>
      <p className="mt-4 text-[11px] text-slate-400">
        Base: {formatNumber(n)} conversas com pelo menos uma resposta.
      </p>
    </div>
  );
}

function HeroNoReply({
  lista,
}: {
  lista: Array<{ leadId: string; ultima: string; campanha: string; mensagens: number }>;
}) {
  const total = lista.length;
  const top = lista.slice(0, 6);
  return (
    <div className="rounded-2xl ring-1 ring-inset ring-rose-500/30 bg-gradient-to-br from-rose-500/15 to-rose-500/5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-rose-300/80">
            Sem resposta agora
          </p>
          <h3 className="mt-1 text-[14px] font-semibold text-slate-100">Última mensagem é entrada — esperando saída</h3>
        </div>
        <div className="h-10 w-10 rounded-lg bg-white/5 grid place-items-center">
          <AlertCircle className="h-5 w-5 text-rose-200" />
        </div>
      </div>

      <p className="mt-5 text-5xl font-extrabold tabular-nums tracking-tight text-slate-50">
        {formatNumber(total)}
      </p>

      <ul className="mt-5 space-y-1.5">
        {top.length === 0 ? (
          <li className="text-[11px] text-slate-400">Nenhuma conversa pendente — bom trabalho.</li>
        ) : (
          top.map((c) => (
            <li key={c.leadId}>
              <a
                href={`/leads/${c.leadId}`}
                className="group flex items-center justify-between rounded-md bg-white/[0.03] px-3 py-1.5 ring-1 ring-white/[0.04] hover:bg-white/[0.06]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Inbox className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="truncate text-[12px] text-slate-200">{c.leadId}</span>
                  <span className="hidden truncate text-[10.5px] text-slate-500 md:inline">{c.campanha}</span>
                </span>
                <span className="flex items-center gap-2 text-[10.5px] text-slate-500">
                  <Clock className="h-3 w-3" />
                  {new Date(c.ultima).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-300" />
                </span>
              </a>
            </li>
          ))
        )}
      </ul>
      {total > top.length && (
        <p className="mt-3 text-[10.5px] text-slate-400">
          + {formatNumber(total - top.length)} pendentes não listadas.
        </p>
      )}
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800/80 overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-5 py-3 border-b border-slate-800/80">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-semibold text-slate-100">{title}</span>
          </div>
          {description && (
            <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

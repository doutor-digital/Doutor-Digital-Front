// Service de análise de IA do dashboard SDR.
//
// Por enquanto MOCKADO — computa insights diretamente do snapshot do store local.
// O shape da resposta espelha o que retornaria de um LLM real (Anthropic Claude),
// então quando trocar pelo SDK do Anthropic basta substituir a implementação de
// `analyzeDashboard` mantendo a mesma interface.
//
// Para a versão real:
//   1. Backend cria endpoint POST /api/sdr/ai/analyze que injeta o Anthropic SDK
//   2. Backend monta o contexto (KPIs do banco) + system prompt
//   3. Frontend troca a impl. abaixo por uma chamada `api.post("/api/sdr/ai/analyze")`
//   4. Resposta vem com mesma estrutura (summary/insights/recommendations/metrics)

import type { SdrState } from "@/types/sdr";

// ───────────────────────────────────────────────────────────────────────────
// Public types — espelham o shape esperado de um LLM
// ───────────────────────────────────────────────────────────────────────────

export type AiInsightTone = "positive" | "warning" | "neutral" | "alert";

export interface AiInsight {
  tone: AiInsightTone;
  title: string;
  detail: string;
  /** Métrica numérica relevante (opcional). */
  value?: string;
}

export interface AiMetrics {
  totalLeads: number;
  leadsCloudia: number;
  leadsAprovados: number;
  leadsPendentesRevisao: number;
  taxaAprovacao: number;
  taxaAgendamento: number;
  taxaFechamento: number;
  receitaTotal: number;
  ticketMedio: number;
  consultas: number;
  tratamentos: number;
  tarefasPendentes: number;
  tarefasAtrasadas: number;
  eventosProximos7Dias: number;
  metaConsolidada: number;
  realConsolidado: number;
  topOrigens: { origem: string; total: number; pct: number }[];
}

export interface AiAnalysisResponse {
  /** Resumo executivo em 1-2 frases. */
  summary: string;
  /** Lista de insights priorizados (positivos, warnings, alerts). */
  insights: AiInsight[];
  /** Recomendações de ação (bullet points). */
  recommendations: string[];
  /** Métricas usadas na análise — disponíveis pra o relatório/PDF. */
  metrics: AiMetrics;
  /** ISO timestamp. */
  generatedAt: string;
  /** Modelo utilizado — útil pra mostrar no PDF e auditar trocas futuras. */
  model: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers de cálculo
// ───────────────────────────────────────────────────────────────────────────

function safePct(num: number, den: number): number {
  if (den <= 0) return 0;
  return (num / den) * 100;
}

function computeMetrics(state: SdrState): AiMetrics {
  const leads = state.leads;
  const leadsCloudia = leads.filter((l) => l.source === "crm").length;
  const leadsAprovados = leads.filter((l) => l.status === "aprovado").length;
  const leadsPendentes = leads.filter((l) => l.status === "pendente_revisao").length;
  const leadsAgendados = leads.filter((l) => l.agendouConsulta).length;

  const consultas = state.consultas.length;
  const fechamentos = state.consultas.filter((c) => c.fechouTratamento === true).length;

  const receitaConsultas = state.consultas.reduce(
    (s, c) => s + (c.recebimento1?.valor ?? 0) + (c.recebimento2?.valor ?? 0),
    0,
  );
  const receitaTratamentos = state.tratamentos.reduce(
    (s, t) => s + t.recebimentos.reduce((a, r) => a + r.valor, 0),
    0,
  );
  const receitaTotal = receitaConsultas + receitaTratamentos;
  const ticketMedio = consultas > 0 ? receitaTotal / consultas : 0;

  const hojeIso = new Date().toISOString().slice(0, 10);
  const tarefasPendentes = state.tarefas.filter(
    (t) => t.status === "pendente" || t.status === "em_andamento",
  ).length;
  const tarefasAtrasadas = state.tarefas.filter(
    (t) => t.status !== "concluida" && t.status !== "cancelada" && t.dataVencimento.slice(0, 10) < hojeIso,
  ).length;

  const seteDiasFrente = new Date();
  seteDiasFrente.setDate(seteDiasFrente.getDate() + 7);
  const seteDiasIso = seteDiasFrente.toISOString().slice(0, 10);
  const eventosProximos7Dias = state.agenda.filter(
    (e) => e.data.slice(0, 10) >= hojeIso && e.data.slice(0, 10) <= seteDiasIso && e.status !== "cancelado",
  ).length;

  const mesAtual = new Date().toISOString().slice(0, 7);
  const metasMes = state.metas.filter((m) => m.mes === mesAtual);
  const metaConsolidada = metasMes.reduce((s, m) => s + m.metaValor, 0);
  const realConsolidado = metasMes.reduce((s, m) => s + m.qtdTotal, 0);

  // Top origens
  const origemMap = new Map<string, number>();
  for (const l of leads) origemMap.set(l.origem, (origemMap.get(l.origem) ?? 0) + 1);
  const topOrigens = Array.from(origemMap.entries())
    .map(([origem, total]) => ({ origem, total, pct: safePct(total, leads.length) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    totalLeads: leads.length,
    leadsCloudia,
    leadsAprovados,
    leadsPendentesRevisao: leadsPendentes,
    taxaAprovacao: safePct(leadsAprovados, leads.length),
    taxaAgendamento: safePct(leadsAgendados, leads.length),
    taxaFechamento: safePct(fechamentos, consultas),
    receitaTotal,
    ticketMedio,
    consultas,
    tratamentos: state.tratamentos.length,
    tarefasPendentes,
    tarefasAtrasadas,
    eventosProximos7Dias,
    metaConsolidada,
    realConsolidado,
    topOrigens,
  };
}

function buildInsights(m: AiMetrics): AiInsight[] {
  const out: AiInsight[] = [];

  // Aprovação
  if (m.totalLeads === 0) {
    out.push({
      tone: "neutral",
      title: "Sem leads no período",
      detail:
        "Ainda não há leads no dashboard SDR. Ative o webhook Kommo ou clique em Sincronizar Kommo na tela de revisão para puxar leads existentes.",
    });
  } else if (m.leadsPendentesRevisao > 0) {
    const tone: AiInsightTone = m.leadsPendentesRevisao > 10 ? "alert" : "warning";
    out.push({
      tone,
      title: `${m.leadsPendentesRevisao} lead(s) aguardando revisão`,
      detail:
        m.leadsPendentesRevisao > 10
          ? "Acúmulo grande na fila de revisão. Sugestão: priorize aprovações para que os leads entrem no pipeline antes que esfriem."
          : "Pequeno acúmulo na fila de revisão — reserve 15 min para zerar.",
      value: String(m.leadsPendentesRevisao),
    });
  } else {
    out.push({
      tone: "positive",
      title: "Fila de revisão zerada",
      detail: "Toda a entrada do Kommo foi revisada. Ótimo trabalho da equipe SDR.",
    });
  }

  // Taxa de agendamento
  if (m.totalLeads >= 5) {
    if (m.taxaAgendamento >= 60) {
      out.push({
        tone: "positive",
        title: "Taxa de agendamento alta",
        detail: `${m.taxaAgendamento.toFixed(1)}% dos leads agendaram consulta — acima da média esperada (40-50%).`,
        value: `${m.taxaAgendamento.toFixed(1)}%`,
      });
    } else if (m.taxaAgendamento < 30) {
      out.push({
        tone: "warning",
        title: "Taxa de agendamento abaixo do esperado",
        detail: `Apenas ${m.taxaAgendamento.toFixed(1)}% dos leads agendaram. Investigue motivos de não agendamento na seção Cadastro Geral — pode haver fricção no script ou baixa qualidade de origem.`,
        value: `${m.taxaAgendamento.toFixed(1)}%`,
      });
    }
  }

  // Taxa de fechamento
  if (m.consultas >= 3) {
    if (m.taxaFechamento >= 50) {
      out.push({
        tone: "positive",
        title: "Conversão de consulta para tratamento sólida",
        detail: `${m.taxaFechamento.toFixed(1)}% das consultas viraram tratamento.`,
        value: `${m.taxaFechamento.toFixed(1)}%`,
      });
    } else if (m.taxaFechamento < 20) {
      out.push({
        tone: "alert",
        title: "Conversão consulta → tratamento baixa",
        detail: `Só ${m.taxaFechamento.toFixed(1)}% fecharam tratamento. Revise o relatório de Motivos de Não Fechamento.`,
      });
    }
  }

  // Tarefas atrasadas
  if (m.tarefasAtrasadas > 0) {
    out.push({
      tone: m.tarefasAtrasadas >= 5 ? "alert" : "warning",
      title: `${m.tarefasAtrasadas} tarefa(s) atrasada(s)`,
      detail: "Tarefas com data de vencimento no passado e ainda pendentes. Veja a seção Tarefas.",
      value: String(m.tarefasAtrasadas),
    });
  }

  // Receita
  if (m.receitaTotal > 0) {
    out.push({
      tone: "neutral",
      title: "Receita acumulada no período",
      detail: `Total recebido: ${currency(m.receitaTotal)} · Ticket médio: ${currency(m.ticketMedio)} (${m.consultas} consulta(s)).`,
      value: currency(m.receitaTotal),
    });
  }

  // Top origens
  if (m.topOrigens.length > 0 && m.topOrigens[0].pct >= 40) {
    const top = m.topOrigens[0];
    out.push({
      tone: top.origem === "Sem origem" ? "warning" : "neutral",
      title: top.origem === "Sem origem" ? "Muitos leads sem origem definida" : `Origem dominante: ${top.origem}`,
      detail:
        top.origem === "Sem origem"
          ? `${top.pct.toFixed(0)}% dos leads estão sem origem. Configure tagging no Kommo para melhorar atribuição.`
          : `${top.pct.toFixed(0)}% dos leads vêm de "${top.origem}". Boa concentração — explore como diversificar.`,
    });
  }

  // Eventos
  if (m.eventosProximos7Dias > 0) {
    out.push({
      tone: "neutral",
      title: `${m.eventosProximos7Dias} compromisso(s) nos próximos 7 dias`,
      detail: "Confira a Agenda para confirmações.",
      value: String(m.eventosProximos7Dias),
    });
  }

  return out;
}

function buildRecommendations(m: AiMetrics): string[] {
  const recs: string[] = [];
  if (m.leadsPendentesRevisao > 5)
    recs.push(
      `Zerar a fila de revisão hoje (${m.leadsPendentesRevisao} lead(s) pendentes) para evitar perda de oportunidades.`,
    );
  if (m.tarefasAtrasadas > 0)
    recs.push(`Resolver ${m.tarefasAtrasadas} tarefa(s) atrasada(s) ou reagendar a data de vencimento.`);
  if (m.taxaAgendamento < 40 && m.totalLeads >= 5)
    recs.push("Revisar o script de primeira abordagem com o time — taxa de agendamento abaixo da meta.");
  if (m.taxaFechamento < 30 && m.consultas >= 3)
    recs.push("Mapear top motivos de não fechamento e ajustar a apresentação do orçamento.");
  if (m.topOrigens[0]?.origem === "Sem origem" && m.topOrigens[0].pct >= 30)
    recs.push("Padronizar a marcação de origem no Kommo para melhorar atribuição e ROI.");
  if (m.metaConsolidada > 0 && m.realConsolidado < m.metaConsolidada * 0.5)
    recs.push("Time SDR está abaixo de 50% da meta consolidada do mês — verificar causa raiz.");
  if (recs.length === 0)
    recs.push(
      "Continuar o ritmo atual — nenhum gargalo crítico detectado. Foque em manter a fila de revisão zerada e taxa de fechamento acima de 50%.",
    );
  return recs;
}

function buildSummary(m: AiMetrics): string {
  if (m.totalLeads === 0) {
    return "Sem dados suficientes para análise. Ative o webhook Kommo ou faça uma sincronização inicial.";
  }
  const partes: string[] = [];
  partes.push(`${m.totalLeads} lead(s) no dashboard`);
  if (m.leadsCloudia > 0) partes.push(`${m.leadsCloudia} via Kommo`);
  if (m.leadsPendentesRevisao > 0) partes.push(`${m.leadsPendentesRevisao} aguardando revisão`);
  partes.push(`taxa de agendamento de ${m.taxaAgendamento.toFixed(1)}%`);
  if (m.consultas > 0) partes.push(`${m.consultas} consulta(s) realizadas`);
  if (m.receitaTotal > 0) partes.push(`receita acumulada de ${currency(m.receitaTotal)}`);
  return partes.join(" · ") + ".";
}

function currency(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

// ───────────────────────────────────────────────────────────────────────────
// API pública
// ───────────────────────────────────────────────────────────────────────────

/**
 * Analisa o dashboard SDR e retorna insights, recomendações e métricas.
 *
 * MOCK: roda local em ~1.5s. Trocar por chamada ao Anthropic SDK quando o backend
 * tiver endpoint POST /api/sdr/ai/analyze que invoque Claude.
 */
export async function analyzeDashboard(state: SdrState): Promise<AiAnalysisResponse> {
  // Simula latência da API + processamento do LLM (real seria 2-5s)
  await new Promise((r) => setTimeout(r, 1500));

  const metrics = computeMetrics(state);
  const insights = buildInsights(metrics);
  const recommendations = buildRecommendations(metrics);
  const summary = buildSummary(metrics);

  return {
    summary,
    insights,
    recommendations,
    metrics,
    generatedAt: new Date().toISOString(),
    model: "mock-analyzer-v1",
  };
}

/**
 * Versão sincrônica (sem delay) para previews/preloads. Útil pra mostrar números
 * no Painel SDR sem precisar acionar a IA.
 */
export function computeAiMetrics(state: SdrState): AiMetrics {
  return computeMetrics(state);
}

import type { Lead, Consulta, Tratamento } from '@/types/cadastra'
import type { LeadSummaryDto } from '@/lib/cadastra/api'

// =================== Tipos ===================

export type Periodo = 'hoje' | 'ontem' | 'semana' | 'mes' | 'trimestre' | 'ano' | 'tudo' | 'custom'

export interface ReportSections {
  cabecalho: boolean
  resumoExecutivo: boolean
  kpis: boolean
  comparativo: boolean
  funil: boolean
  responsaveis: boolean
  origens: boolean
  tipos: boolean
  tiposResgate: boolean
  planos: boolean
  formasPagamento: boolean
  motivosNaoAgendamento: boolean
  motivosNaoFechamento: boolean
  pipeline: boolean
  tendencias: boolean
  insights: boolean
  recomendacoes: boolean
  rodape: boolean
}

export interface ReportConfig {
  empresaId: string
  empresaNome: string
  periodo: Periodo
  customFrom?: string
  customTo?: string
  comparePeriod: 'previous' | 'none'
  filterResponsavel?: string
  filterOrigem?: string
  filterTipo?: 'todos' | 'Cadastro' | 'Resgate'
  sections: ReportSections
  tom: 'formal' | 'casual' | 'direto'
  verbosidade: 'compacto' | 'medio' | 'detalhado'
  emojis: boolean
  topN: number
  saudacao: string
  destinatario: 'equipe' | 'gestor' | 'socios' | 'cliente'
  formato: 'whatsapp' | 'plain' | 'markdown'
}

export interface ReportInput {
  config: ReportConfig
  leads: Lead[]
  apiSummaries: LeadSummaryDto[]
  consultas: Consulta[]
  tratamentos: Tratamento[]
}

interface PeriodWindow {
  start: Date
  end: Date
  label: string
}

// =================== Período ===================

const dayMs = 24 * 60 * 60 * 1000

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/** "yyyy-MM-dd" → Date no fuso LOCAL (new Date(s) interpretaria como UTC e geraria shift de ±1 dia). */
function parseDateLocal(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s)
}

export function periodWindowFor(
  periodo: Periodo,
  customFrom?: string,
  customTo?: string,
): PeriodWindow {
  const today = startOfDay(new Date())
  switch (periodo) {
    case 'hoje':
      return { start: today, end: endOfDay(today), label: 'hoje' }
    case 'ontem': {
      const y = new Date(today.getTime() - dayMs)
      return { start: y, end: endOfDay(y), label: 'ontem' }
    }
    case 'semana':
      return { start: new Date(today.getTime() - 6 * dayMs), end: endOfDay(new Date()), label: 'últimos 7 dias' }
    case 'mes':
      return { start: new Date(today.getTime() - 29 * dayMs), end: endOfDay(new Date()), label: 'últimos 30 dias' }
    case 'trimestre':
      return { start: new Date(today.getTime() - 89 * dayMs), end: endOfDay(new Date()), label: 'últimos 90 dias' }
    case 'ano':
      return { start: new Date(today.getTime() - 364 * dayMs), end: endOfDay(new Date()), label: 'últimos 12 meses' }
    case 'tudo':
      return { start: new Date(0), end: endOfDay(new Date()), label: 'desde o início' }
    case 'custom': {
      const from = customFrom ? startOfDay(parseDateLocal(customFrom)) : today
      const to = customTo ? endOfDay(parseDateLocal(customTo)) : endOfDay(new Date())
      return { start: from, end: to, label: `${formatDateBR(from)} – ${formatDateBR(to)}` }
    }
  }
}

function previousWindow(win: PeriodWindow): PeriodWindow {
  const span = win.end.getTime() - win.start.getTime()
  return {
    start: new Date(win.start.getTime() - span - 1),
    end: new Date(win.start.getTime() - 1),
    label: 'período anterior',
  }
}

// =================== Helpers ===================

export function brl(n: number): string {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 100)
}

export function formatDateBR(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTimeBR(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function inWindow(iso: string | undefined | null, win: PeriodWindow): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  return t >= win.start.getTime() && t <= win.end.getTime()
}

function deltaPct(curr: number, prev: number): number {
  if (prev === 0 && curr === 0) return 0
  if (prev === 0) return 100
  return Math.round(((curr - prev) / prev) * 100)
}

function topByCount<T>(map: Map<string, T>, getCount: (v: T) => number, n: number): { key: string; value: T }[] {
  const arr = [...map.entries()].map(([key, value]) => ({ key, value }))
  arr.sort((a, b) => getCount(b.value) - getCount(a.value))
  return n > 0 ? arr.slice(0, n) : arr
}

// =================== Cálculo ===================

interface Computed {
  leadsTotal: number
  leadsAgendou: number
  leadsCompareceu: number
  leadsFechou: number
  leadsCadastro: number
  leadsResgate: number
  leadsPagAntecip: number
  leadsInteragiu: number
  receita: number
  ticketMedio: number
  byResponsavel: Map<string, { leads: number; agendou: number; compareceu: number; fechou: number; receita: number }>
  byOrigem: Map<string, { count: number; agendou: number; compareceu: number; fechou: number }>
  byTipoResgate: Map<string, number>
  byPlano: Map<string, { count: number; valor: number }>
  byFormaPag: Map<string, number>
  byMotivoNaoAg: Map<string, number>
  byMotivoNaoFe: Map<string, number>
  byDiaSemana: number[] // 0..6
  porDia: Map<string, number> // YYYY-MM-DD → count
}

function emptyComputed(): Computed {
  return {
    leadsTotal: 0, leadsAgendou: 0, leadsCompareceu: 0, leadsFechou: 0,
    leadsCadastro: 0, leadsResgate: 0, leadsPagAntecip: 0, leadsInteragiu: 0,
    receita: 0, ticketMedio: 0,
    byResponsavel: new Map(),
    byOrigem: new Map(),
    byTipoResgate: new Map(),
    byPlano: new Map(),
    byFormaPag: new Map(),
    byMotivoNaoAg: new Map(),
    byMotivoNaoFe: new Map(),
    byDiaSemana: [0, 0, 0, 0, 0, 0, 0],
    porDia: new Map(),
  }
}

function compute(input: ReportInput, win: PeriodWindow): Computed {
  const { config, leads, apiSummaries, consultas, tratamentos } = input
  const c = emptyComputed()

  // Index summaries por id pra puxar compareceu/fechouTratamento dos importados.
  const apiById = new Map(apiSummaries.map((s) => [s.id, s]))

  for (const l of leads) {
    if (!inWindow(l.createdAt, win)) continue
    if (config.filterResponsavel && l.nomeResponsavel !== config.filterResponsavel) continue
    if (config.filterOrigem && l.origem !== config.filterOrigem) continue
    if (config.filterTipo && config.filterTipo !== 'todos' && l.tipo !== config.filterTipo) continue

    c.leadsTotal++
    if (l.agendouConsulta) c.leadsAgendou++
    if (l.tipo === 'Cadastro') c.leadsCadastro++
    else if (l.tipo === 'Resgate') c.leadsResgate++
    if (l.pagamentoAntecipado) c.leadsPagAntecip++
    if (l.interacao) c.leadsInteragiu++

    // Compareceu / fechou: vêm da API (importados) ou do localStorage (consulta vinculada).
    const sum = apiById.get(l.id)
    let compareceu = false
    let fechou = false
    if (sum) {
      compareceu = sum.compareceu === true
      fechou = sum.fechouTratamento === true
    } else {
      const cons = consultas.find((cn) => cn.leadId === l.id)
      if (cons) {
        compareceu = cons.compareceu
        fechou = cons.fechouTratamento
      }
    }
    if (compareceu) c.leadsCompareceu++
    if (fechou) c.leadsFechou++

    // Responsável
    const respKey = l.nomeResponsavel || 'Sem responsável'
    const r = c.byResponsavel.get(respKey) ?? { leads: 0, agendou: 0, compareceu: 0, fechou: 0, receita: 0 }
    r.leads++
    if (l.agendouConsulta) r.agendou++
    if (compareceu) r.compareceu++
    if (fechou) r.fechou++
    c.byResponsavel.set(respKey, r)

    // Origem
    const oKey = (l.origem || 'Sem origem').trim() || 'Sem origem'
    const o = c.byOrigem.get(oKey) ?? { count: 0, agendou: 0, compareceu: 0, fechou: 0 }
    o.count++
    if (l.agendouConsulta) o.agendou++
    if (compareceu) o.compareceu++
    if (fechou) o.fechou++
    c.byOrigem.set(oKey, o)

    // Tipo de resgate
    if (l.tipo === 'Resgate' && l.tipoResgate) {
      c.byTipoResgate.set(l.tipoResgate, (c.byTipoResgate.get(l.tipoResgate) ?? 0) + 1)
    }

    // Motivo não agendamento
    if (!l.agendouConsulta && l.motivoNaoAgendamento) {
      c.byMotivoNaoAg.set(l.motivoNaoAgendamento, (c.byMotivoNaoAg.get(l.motivoNaoAgendamento) ?? 0) + 1)
    }

    // Motivo não fechamento
    const motivoNF = sum?.motivoNaoFechamento ?? consultas.find((cn) => cn.leadId === l.id)?.motivoNaoFechamento
    if (!fechou && motivoNF) {
      c.byMotivoNaoFe.set(motivoNF, (c.byMotivoNaoFe.get(motivoNF) ?? 0) + 1)
    }

    // Tendências
    const dt = new Date(l.createdAt)
    if (!isNaN(dt.getTime())) {
      c.byDiaSemana[dt.getDay()]++
      const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      c.porDia.set(ymd, (c.porDia.get(ymd) ?? 0) + 1)
    }
  }

  // Receita / planos / formas — só dispõe pros dados que tem consulta+tratamento (localStorage por enquanto).
  const consultasNoPeriodo = consultas.filter((cn) => inWindow(cn.createdAt, win))
  const tratamentosNoPeriodo = tratamentos.filter((t) => inWindow(t.createdAt, win))

  for (const t of tratamentosNoPeriodo) {
    const k = (t.planoTratamento || 'Sem plano').trim() || 'Sem plano'
    const cur = c.byPlano.get(k) ?? { count: 0, valor: 0 }
    cur.count++
    cur.valor += t.valorPlano
    c.byPlano.set(k, cur)
  }

  const allRecs = [
    ...consultasNoPeriodo.flatMap((cn) => cn.recebimentos),
    ...tratamentosNoPeriodo.flatMap((t) => t.recebimentos),
  ]
  for (const r of allRecs) {
    c.byFormaPag.set(r.formaPagamento, (c.byFormaPag.get(r.formaPagamento) ?? 0) + r.valorRecebimento)
    c.receita += r.valorRecebimento
  }
  c.ticketMedio = tratamentosNoPeriodo.length > 0 ? c.receita / tratamentosNoPeriodo.length : 0

  // Vincular receita ao responsável (só pra dados locais)
  for (const t of tratamentosNoPeriodo) {
    const cons = consultas.find((cn) => cn.id === t.consultaId)
    if (!cons) continue
    const lead = leads.find((l) => l.id === cons.leadId)
    if (!lead) continue
    const rec = c.byResponsavel.get(lead.nomeResponsavel)
    if (rec) {
      rec.receita += t.recebimentos.reduce((s, r) => s + r.valorRecebimento, 0)
    }
  }

  return c
}

// =================== Renderização ===================

function emoji(cfg: ReportConfig, e: string): string {
  return cfg.emojis ? e : ''
}

function bold(cfg: ReportConfig, text: string): string {
  if (cfg.formato === 'whatsapp') return `*${text}*`
  if (cfg.formato === 'markdown') return `**${text}**`
  return text.toUpperCase()
}

function bullet(cfg: ReportConfig): string {
  return cfg.formato === 'plain' ? '-' : '•'
}

function progressBar(pct: number, width = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
  return '▰'.repeat(filled) + '▱'.repeat(width - filled)
}

function deltaText(curr: number, prev: number, cfg: ReportConfig): string {
  const d = deltaPct(curr, prev)
  const arrow = d > 0 ? emoji(cfg, '📈 ') : d < 0 ? emoji(cfg, '📉 ') : ''
  const sign = d > 0 ? '+' : ''
  return `${arrow}${sign}${d}%`
}

const SAUDACOES_DEFAULT: Record<ReportConfig['destinatario'], { formal: string; casual: string; direto: string }> = {
  equipe: {
    formal: 'Prezada equipe,',
    casual: 'Pessoal, bora ver os números!',
    direto: 'Equipe,',
  },
  gestor: {
    formal: 'Prezado gestor,',
    casual: 'Chefia, segue o resumo do período:',
    direto: 'Gestor,',
  },
  socios: {
    formal: 'Prezados sócios,',
    casual: 'Galera, segue a apuração do período:',
    direto: 'Sócios,',
  },
  cliente: {
    formal: 'Prezado cliente,',
    casual: 'Olá!',
    direto: 'Cliente,',
  },
}

function getSaudacao(cfg: ReportConfig): string {
  if (cfg.saudacao.trim()) return cfg.saudacao.trim()
  return SAUDACOES_DEFAULT[cfg.destinatario][cfg.tom]
}

interface RenderCtx {
  cfg: ReportConfig
  win: PeriodWindow
  prevWin: PeriodWindow | null
  curr: Computed
  prev: Computed | null
}

function renderCabecalho(ctx: RenderCtx): string {
  const { cfg, win } = ctx
  const lines: string[] = []
  lines.push(`${emoji(cfg, '📊 ')}${bold(cfg, `RELATÓRIO ${cfg.empresaNome.toUpperCase()}`)}`)
  lines.push(`${emoji(cfg, '📅 ')}Período: ${win.label} (${formatDateBR(win.start)} – ${formatDateBR(win.end)})`)
  lines.push(`${emoji(cfg, '🕐 ')}Gerado em: ${formatDateTimeBR(new Date())}`)
  if (cfg.filterResponsavel) lines.push(`${emoji(cfg, '🔎 ')}Filtro responsável: ${cfg.filterResponsavel}`)
  if (cfg.filterOrigem) lines.push(`${emoji(cfg, '🔎 ')}Filtro origem: ${cfg.filterOrigem}`)
  if (cfg.filterTipo && cfg.filterTipo !== 'todos') lines.push(`${emoji(cfg, '🔎 ')}Filtro tipo: ${cfg.filterTipo}`)
  return lines.join('\n')
}

function renderResumo(ctx: RenderCtx): string {
  const { cfg, curr, win } = ctx
  if (curr.leadsTotal === 0) return `${emoji(cfg, '⚠️ ')}Nenhum lead no período (${win.label}).`

  const taxaAg = pct(curr.leadsAgendou, curr.leadsTotal)
  const taxaCom = pct(curr.leadsCompareceu, curr.leadsTotal)
  const taxaFe = pct(curr.leadsFechou, curr.leadsTotal)

  if (cfg.verbosidade === 'compacto') {
    return `${curr.leadsTotal} leads · ${curr.leadsAgendou} agendaram (${taxaAg}%) · ${curr.leadsCompareceu} compareceram · ${curr.leadsFechou} fecharam${cfg.verbosidade === 'compacto' && curr.receita > 0 ? ` · ${brl(curr.receita)}` : ''}`
  }

  const linhas: string[] = []
  linhas.push(`${emoji(cfg, '📌 ')}${bold(cfg, 'Resumo executivo')}`)
  linhas.push(`No período de ${win.label}, captamos ${bold(cfg, String(curr.leadsTotal))} leads.`)
  linhas.push(`Desses, ${curr.leadsAgendou} (${taxaAg}%) agendaram consulta, ${curr.leadsCompareceu} (${taxaCom}%) compareceram e ${curr.leadsFechou} (${taxaFe}%) fecharam tratamento.`)
  if (curr.receita > 0) linhas.push(`Receita acumulada: ${bold(cfg, brl(curr.receita))} · Ticket médio: ${brl(curr.ticketMedio)}.`)
  return linhas.join(' ')
}

function renderKPIs(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  const b = bullet(cfg)
  const lines: string[] = []
  lines.push(`${emoji(cfg, '📈 ')}${bold(cfg, 'KPIs principais')}`)
  lines.push(`${b} Leads: ${curr.leadsTotal}`)
  lines.push(`${b} Agendaram: ${curr.leadsAgendou} (${pct(curr.leadsAgendou, curr.leadsTotal)}%)`)
  lines.push(`${b} Compareceram: ${curr.leadsCompareceu} (${pct(curr.leadsCompareceu, curr.leadsTotal)}%)`)
  lines.push(`${b} Fecharam: ${curr.leadsFechou} (${pct(curr.leadsFechou, curr.leadsTotal)}%)`)
  if (cfg.verbosidade !== 'compacto') {
    lines.push(`${b} Cadastros novos: ${curr.leadsCadastro}`)
    lines.push(`${b} Resgates: ${curr.leadsResgate}`)
    lines.push(`${b} Tiveram interação: ${curr.leadsInteragiu} (${pct(curr.leadsInteragiu, curr.leadsTotal)}%)`)
    lines.push(`${b} Pagamento antecipado: ${curr.leadsPagAntecip}`)
  }
  if (curr.receita > 0) {
    lines.push(`${b} Receita: ${brl(curr.receita)}`)
    lines.push(`${b} Ticket médio: ${brl(curr.ticketMedio)}`)
  }
  return lines.join('\n')
}

function renderComparativo(ctx: RenderCtx): string {
  const { cfg, curr, prev } = ctx
  if (!prev) return ''
  const b = bullet(cfg)
  const lines: string[] = []
  lines.push(`${emoji(cfg, '🔄 ')}${bold(cfg, 'Comparativo vs período anterior')}`)
  lines.push(`${b} Leads: ${curr.leadsTotal} vs ${prev.leadsTotal} (${deltaText(curr.leadsTotal, prev.leadsTotal, cfg)})`)
  lines.push(`${b} Agendaram: ${curr.leadsAgendou} vs ${prev.leadsAgendou} (${deltaText(curr.leadsAgendou, prev.leadsAgendou, cfg)})`)
  lines.push(`${b} Compareceram: ${curr.leadsCompareceu} vs ${prev.leadsCompareceu} (${deltaText(curr.leadsCompareceu, prev.leadsCompareceu, cfg)})`)
  lines.push(`${b} Fecharam: ${curr.leadsFechou} vs ${prev.leadsFechou} (${deltaText(curr.leadsFechou, prev.leadsFechou, cfg)})`)
  if (curr.receita > 0 || prev.receita > 0) {
    lines.push(`${b} Receita: ${brl(curr.receita)} vs ${brl(prev.receita)} (${deltaText(curr.receita, prev.receita, cfg)})`)
  }
  return lines.join('\n')
}

function renderFunil(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  if (curr.leadsTotal === 0) return ''
  const lines: string[] = []
  lines.push(`${emoji(cfg, '🪜 ')}${bold(cfg, 'Funil de conversão')}`)
  const stages = [
    { label: 'Leads',        n: curr.leadsTotal },
    { label: 'Agendaram',    n: curr.leadsAgendou },
    { label: 'Compareceram', n: curr.leadsCompareceu },
    { label: 'Fecharam',     n: curr.leadsFechou },
  ]
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i]
    const p = pct(s.n, curr.leadsTotal)
    const stepDrop = i === 0 ? '' : ` (${pct(s.n, stages[i - 1].n)}% do anterior)`
    lines.push(`${progressBar(p)} ${s.label}: ${s.n} (${p}%${stepDrop})`)
  }
  return lines.join('\n')
}

function renderResponsaveis(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  const top = topByCount(curr.byResponsavel, (v) => v.leads, cfg.topN)
  if (top.length === 0) return ''
  const b = bullet(cfg)
  const lines: string[] = []
  lines.push(`${emoji(cfg, '🏆 ')}${bold(cfg, 'Performance por responsável')}`)
  for (let i = 0; i < top.length; i++) {
    const { key, value } = top[i]
    const medal = cfg.emojis ? ['🥇', '🥈', '🥉'][i] ?? '·' : `${i + 1}.`
    const conv = pct(value.fechou, value.leads)
    const txt = `${medal} ${key}: ${value.leads} leads · ${value.agendou} agendaram · ${value.fechou} fecharam (${conv}%)`
    const detail = cfg.verbosidade === 'detalhado' && value.receita > 0 ? ` · ${brl(value.receita)}` : ''
    lines.push(b === '·' ? `${txt}${detail}` : `${txt}${detail}`)
  }
  return lines.join('\n')
}

function renderOrigens(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  const top = topByCount(curr.byOrigem, (v) => v.count, cfg.topN)
  if (top.length === 0) return ''
  const b = bullet(cfg)
  const lines: string[] = []
  lines.push(`${emoji(cfg, '🎯 ')}${bold(cfg, 'Análise de origens')}`)
  for (const { key, value } of top) {
    const p = pct(value.count, curr.leadsTotal)
    const conv = pct(value.fechou, value.count)
    const detail = cfg.verbosidade === 'detalhado' ? ` · ${value.fechou} fecharam (${conv}%)` : ''
    lines.push(`${b} ${key}: ${value.count} leads (${p}%)${detail}`)
  }
  return lines.join('\n')
}

function renderTipos(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  if (curr.leadsTotal === 0) return ''
  const b = bullet(cfg)
  const lines: string[] = []
  lines.push(`${emoji(cfg, '🏷️ ')}${bold(cfg, 'Por tipo')}`)
  lines.push(`${b} Cadastros: ${curr.leadsCadastro} (${pct(curr.leadsCadastro, curr.leadsTotal)}%)`)
  lines.push(`${b} Resgates: ${curr.leadsResgate} (${pct(curr.leadsResgate, curr.leadsTotal)}%)`)
  return lines.join('\n')
}

function renderTiposResgate(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  if (curr.byTipoResgate.size === 0) return ''
  const b = bullet(cfg)
  const lines: string[] = []
  lines.push(`${emoji(cfg, '♻️ ')}${bold(cfg, 'Tipos de resgate')}`)
  const arr = [...curr.byTipoResgate.entries()].sort((a, b) => b[1] - a[1])
  for (const [k, v] of arr) lines.push(`${b} ${k}: ${v} (${pct(v, curr.leadsResgate)}%)`)
  return lines.join('\n')
}

function renderPlanos(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  const top = topByCount(curr.byPlano, (v) => v.count, cfg.topN)
  if (top.length === 0) return ''
  const b = bullet(cfg)
  const lines: string[] = []
  lines.push(`${emoji(cfg, '💼 ')}${bold(cfg, 'Planos de tratamento fechados')}`)
  for (const { key, value } of top) {
    lines.push(`${b} ${key}: ${value.count}× · ${brl(value.valor)}`)
  }
  return lines.join('\n')
}

function renderFormas(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  if (curr.byFormaPag.size === 0) return ''
  const b = bullet(cfg)
  const lines: string[] = []
  lines.push(`${emoji(cfg, '💳 ')}${bold(cfg, 'Formas de pagamento')}`)
  const arr = [...curr.byFormaPag.entries()].sort((a, b) => b[1] - a[1])
  for (const [k, v] of arr) lines.push(`${b} ${k}: ${brl(v)} (${pct(v, curr.receita)}%)`)
  return lines.join('\n')
}

function renderMotivosNaoAg(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  const top = topByCount(curr.byMotivoNaoAg, (v) => v, cfg.topN)
  if (top.length === 0) return ''
  const b = bullet(cfg)
  const naoAgendaram = curr.leadsTotal - curr.leadsAgendou
  const lines: string[] = []
  lines.push(`${emoji(cfg, '❌ ')}${bold(cfg, 'Motivos de não agendamento')}`)
  for (const { key, value } of top) {
    lines.push(`${b} ${key}: ${value} (${pct(value, naoAgendaram)}%)`)
  }
  return lines.join('\n')
}

function renderMotivosNaoFe(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  const top = topByCount(curr.byMotivoNaoFe, (v) => v, cfg.topN)
  if (top.length === 0) return ''
  const b = bullet(cfg)
  const naoFecharam = curr.leadsCompareceu - curr.leadsFechou
  const lines: string[] = []
  lines.push(`${emoji(cfg, '⚠️ ')}${bold(cfg, 'Motivos de não fechamento')}`)
  for (const { key, value } of top) {
    lines.push(`${b} ${key}: ${value}${naoFecharam > 0 ? ` (${pct(value, naoFecharam)}%)` : ''}`)
  }
  return lines.join('\n')
}

function renderPipeline(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  if (curr.leadsTotal === 0) return ''
  const b = bullet(cfg)
  const ativos = curr.leadsAgendou - curr.leadsCompareceu
  const lines: string[] = []
  lines.push(`${emoji(cfg, '🔄 ')}${bold(cfg, 'Pipeline ativo')}`)
  lines.push(`${b} Leads sem agendamento: ${curr.leadsTotal - curr.leadsAgendou}`)
  lines.push(`${b} Agendados aguardando consulta: ${ativos}`)
  lines.push(`${b} Compareceram aguardando fechamento: ${curr.leadsCompareceu - curr.leadsFechou}`)
  return lines.join('\n')
}

function renderTendencias(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  if (curr.leadsTotal === 0) return ''
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  let bestDay = 0
  for (let i = 1; i < 7; i++) if (curr.byDiaSemana[i] > curr.byDiaSemana[bestDay]) bestDay = i

  const dailyArr = [...curr.porDia.entries()].sort()
  const recent = dailyArr.slice(-7)
  const avgRecent = recent.length > 0 ? recent.reduce((s, [, v]) => s + v, 0) / recent.length : 0
  const lastDay = recent[recent.length - 1]

  const b = bullet(cfg)
  const lines: string[] = []
  lines.push(`${emoji(cfg, '📅 ')}${bold(cfg, 'Tendências')}`)
  lines.push(`${b} Melhor dia da semana: ${dias[bestDay]} (${curr.byDiaSemana[bestDay]} leads)`)
  if (lastDay) lines.push(`${b} Último dia: ${formatDateBR(lastDay[0])} → ${lastDay[1]} leads (média 7d: ${avgRecent.toFixed(1)})`)
  lines.push(`${b} Distribuição semanal: ${dias.map((d, i) => `${d} ${curr.byDiaSemana[i]}`).join(' · ')}`)
  return lines.join('\n')
}

function renderInsights(ctx: RenderCtx): string {
  const { cfg, curr, prev } = ctx
  const insights: string[] = []
  if (curr.leadsTotal === 0) return ''

  // Conversão geral
  const conv = pct(curr.leadsFechou, curr.leadsTotal)
  if (conv >= 25) insights.push(`Excelente taxa de fechamento de ${conv}% — acima da média de mercado.`)
  else if (conv >= 10) insights.push(`Taxa de fechamento de ${conv}% — saudável, mas há espaço pra crescer.`)
  else if (curr.leadsTotal >= 20) insights.push(`Taxa de fechamento de ${conv}% está abaixo do esperado; vale revisar etapas do funil.`)

  // Top responsável vs média
  const topResp = topByCount(curr.byResponsavel, (v) => v.fechou, 1)[0]
  if (topResp && topResp.value.fechou > 0) {
    const totalFechou = curr.leadsFechou
    const sharePct = pct(topResp.value.fechou, totalFechou)
    if (sharePct >= 40) insights.push(`${topResp.key} responde por ${sharePct}% dos fechamentos — alta concentração em uma pessoa.`)
  }

  // Origem campeã
  const topOri = topByCount(curr.byOrigem, (v) => v.count, 1)[0]
  if (topOri) {
    const sharePct = pct(topOri.value.count, curr.leadsTotal)
    insights.push(`${topOri.key} é a origem #1, trazendo ${sharePct}% dos leads.`)
    const convOri = pct(topOri.value.fechou, topOri.value.count)
    if (convOri < conv && curr.leadsTotal >= 20) {
      insights.push(`Apesar do volume, ${topOri.key} converte abaixo da média geral (${convOri}% vs ${conv}%).`)
    }
  }

  // Compareceu vs agendou
  if (curr.leadsAgendou > 0) {
    const noShow = pct(curr.leadsAgendou - curr.leadsCompareceu, curr.leadsAgendou)
    if (noShow >= 30) insights.push(`No-show alto: ${noShow}% dos agendados não compareceram. Confirmar via WhatsApp pode reduzir.`)
  }

  // Comparativo
  if (prev) {
    const dLeads = deltaPct(curr.leadsTotal, prev.leadsTotal)
    if (dLeads >= 20) insights.push(`Captação cresceu ${dLeads}% vs período anterior — algo está funcionando, mantenha.`)
    else if (dLeads <= -20) insights.push(`Captação caiu ${Math.abs(dLeads)}% vs período anterior — revisar campanhas.`)
  }

  // Motivo número 1 de não fechamento
  const topMotivoNF = topByCount(curr.byMotivoNaoFe, (v) => v, 1)[0]
  if (topMotivoNF && topMotivoNF.value >= 3) {
    insights.push(`Principal motivo de não fechamento: "${topMotivoNF.key}" (${topMotivoNF.value} casos).`)
  }

  if (insights.length === 0) return ''
  const lines: string[] = []
  lines.push(`${emoji(cfg, '💡 ')}${bold(cfg, 'Insights automáticos')}`)
  for (const i of insights) lines.push(`${bullet(cfg)} ${i}`)
  return lines.join('\n')
}

function renderRecomendacoes(ctx: RenderCtx): string {
  const { cfg, curr } = ctx
  const recs: string[] = []
  if (curr.leadsTotal === 0) {
    recs.push('Sem leads no período — verificar canais de captação.')
  }

  if (curr.leadsAgendou > 0) {
    const noShow = pct(curr.leadsAgendou - curr.leadsCompareceu, curr.leadsAgendou)
    if (noShow >= 25) recs.push('Implementar lembrete automático 24h antes da consulta pra reduzir no-show.')
  }

  if (curr.leadsTotal > 0) {
    const taxaInteracao = pct(curr.leadsInteragiu, curr.leadsTotal)
    if (taxaInteracao < 60) recs.push('Acelerar follow-up: baixa taxa de interação está custando agendamentos.')
  }

  const topMotivoNA = topByCount(curr.byMotivoNaoAg, (v) => v, 1)[0]
  if (topMotivoNA && topMotivoNA.value >= 5) {
    recs.push(`Tratar a objeção "${topMotivoNA.key}" — ela aparece em ${topMotivoNA.value} casos no período.`)
  }

  const topResp = topByCount(curr.byResponsavel, (v) => (v.leads > 0 ? v.fechou / v.leads : 0), 1)[0]
  if (topResp && topResp.value.leads >= 5 && curr.byResponsavel.size >= 2) {
    const topConv = pct(topResp.value.fechou, topResp.value.leads)
    recs.push(`Replicar a abordagem de ${topResp.key} (${topConv}% de conversão) com a equipe.`)
  }

  if (recs.length === 0) return ''
  const lines: string[] = []
  lines.push(`${emoji(cfg, '🚀 ')}${bold(cfg, 'Recomendações')}`)
  for (const r of recs) lines.push(`${bullet(cfg)} ${r}`)
  return lines.join('\n')
}

function renderRodape(ctx: RenderCtx): string {
  const { cfg } = ctx
  const lines: string[] = []
  if (cfg.tom === 'formal') lines.push('Atenciosamente,')
  else if (cfg.tom === 'casual') lines.push('Bora pra cima! 💪')
  lines.push(`— ${cfg.empresaNome} via cadastra.ai`)
  return lines.join('\n')
}

// =================== Pipeline ===================

const SECTION_RENDERERS: { key: keyof ReportSections; render: (ctx: RenderCtx) => string }[] = [
  { key: 'cabecalho', render: renderCabecalho },
  { key: 'resumoExecutivo', render: renderResumo },
  { key: 'kpis', render: renderKPIs },
  { key: 'comparativo', render: renderComparativo },
  { key: 'funil', render: renderFunil },
  { key: 'responsaveis', render: renderResponsaveis },
  { key: 'origens', render: renderOrigens },
  { key: 'tipos', render: renderTipos },
  { key: 'tiposResgate', render: renderTiposResgate },
  { key: 'planos', render: renderPlanos },
  { key: 'formasPagamento', render: renderFormas },
  { key: 'motivosNaoAgendamento', render: renderMotivosNaoAg },
  { key: 'motivosNaoFechamento', render: renderMotivosNaoFe },
  { key: 'pipeline', render: renderPipeline },
  { key: 'tendencias', render: renderTendencias },
  { key: 'insights', render: renderInsights },
  { key: 'recomendacoes', render: renderRecomendacoes },
  { key: 'rodape', render: renderRodape },
]

export function generateReport(input: ReportInput): string {
  const { config } = input
  const win = periodWindowFor(config.periodo, config.customFrom, config.customTo)
  const prevWin = config.comparePeriod === 'previous' ? previousWindow(win) : null
  const curr = compute(input, win)
  const prev = prevWin ? compute(input, prevWin) : null

  const ctx: RenderCtx = { cfg: config, win, prevWin, curr, prev }
  const blocks: string[] = []

  // Saudação só se tem cabeçalho
  if (config.sections.cabecalho) {
    const saud = getSaudacao(config)
    if (saud) blocks.push(saud)
  }

  for (const r of SECTION_RENDERERS) {
    if (!config.sections[r.key]) continue
    const block = r.render(ctx)
    if (block && block.trim()) blocks.push(block)
  }

  return blocks.join('\n\n').trim()
}

// =================== Defaults ===================

export const DEFAULT_SECTIONS: ReportSections = {
  cabecalho: true,
  resumoExecutivo: true,
  kpis: true,
  comparativo: true,
  funil: true,
  responsaveis: true,
  origens: true,
  tipos: false,
  tiposResgate: false,
  planos: false,
  formasPagamento: false,
  motivosNaoAgendamento: true,
  motivosNaoFechamento: true,
  pipeline: false,
  tendencias: true,
  insights: true,
  recomendacoes: true,
  rodape: true,
}

export const SECTION_LABELS: Record<keyof ReportSections, string> = {
  cabecalho: 'Cabeçalho + saudação',
  resumoExecutivo: 'Resumo executivo',
  kpis: 'KPIs principais',
  comparativo: 'Comparativo período anterior',
  funil: 'Funil de conversão',
  responsaveis: 'Performance por responsável',
  origens: 'Análise de origens',
  tipos: 'Cadastro vs Resgate',
  tiposResgate: 'Tipos de resgate',
  planos: 'Planos de tratamento',
  formasPagamento: 'Formas de pagamento',
  motivosNaoAgendamento: 'Motivos de não agendamento',
  motivosNaoFechamento: 'Motivos de não fechamento',
  pipeline: 'Pipeline ativo',
  tendencias: 'Tendências (dia/semana)',
  insights: 'Insights automáticos',
  recomendacoes: 'Recomendações',
  rodape: 'Rodapé / assinatura',
}

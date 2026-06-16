
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { DashboardHeader, type DashboardFonte } from '@/components/cadastro/dashboard/header'
import { useCadastroStore, useIsClient } from '@/lib/cadastra/cadastro-store'
import { empresasApi, leadsApi, type EmpresaDto, type LeadsStatsResponse } from '@/lib/cadastra/api'
import { AnimatedNumber } from '@/cadastra-ui/animated-number'
import { cn } from '@/lib/utils'
import type { DashboardFilters, Consulta, Tratamento } from '@/types/cadastra'
import { Sparkles } from '@/components/icons'
import { AiReportModal, type DashboardSnapshot } from '@/components/cadastro/dashboard/ai-report-modal'

const dayMs = 24 * 60 * 60 * 1000

function periodWindow(periodo: DashboardFilters['periodo']) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todayMs = startOfToday.getTime()
  switch (periodo) {
    case 'hoje':       return { startMs: todayMs,                prevStartMs: todayMs - dayMs,           prevEndMs: todayMs }
    case 'ontem':      return { startMs: todayMs - dayMs,        prevStartMs: todayMs - 2 * dayMs,       prevEndMs: todayMs - dayMs }
    case 'semana':     return { startMs: todayMs - 6 * dayMs,    prevStartMs: todayMs - 13 * dayMs,      prevEndMs: todayMs - 6 * dayMs }
    case 'mes':        return { startMs: todayMs - 29 * dayMs,   prevStartMs: todayMs - 59 * dayMs,      prevEndMs: todayMs - 29 * dayMs }
    case 'trimestre':  return { startMs: todayMs - 89 * dayMs,   prevStartMs: todayMs - 179 * dayMs,     prevEndMs: todayMs - 89 * dayMs }
    case 'tudo':       return { startMs: 0,                       prevStartMs: 0,                          prevEndMs: 0 }
    default:           return { startMs: 0,                       prevStartMs: 0,                          prevEndMs: Date.now() }
  }
}

function inWindow(iso: string | undefined, startMs: number, endMs?: number): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  if (endMs !== undefined) return t >= startMs && t < endMs
  return t >= startMs
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function deltaPct(curr: number, prev: number): { value: string; positive: boolean } {
  if (prev === 0 && curr === 0) return { value: '0%', positive: true }
  if (prev === 0) return { value: '+100%', positive: true }
  const pct = Math.round(((curr - prev) / prev) * 100)
  return {
    value: `${pct >= 0 ? '+' : ''}${pct}%`,
    positive: pct >= 0,
  }
}

interface Computed {
  leads: number
  prevLeads: number
  leadsManuais: number
  leadsImportados: number
  agendados: number
  consultas: number
  prevConsultas: number
  comparecidas: number
  prevComparecidas: number
  tratamentos: number
  prevTratamentos: number
  receita: number
  prevReceita: number
  ticketMedio: number
  origens: { nome: string; count: number; pct: number }[]
  responsaveis: { nome: string; leads: number; fechados: number; receita: number }[]
  formas: { forma: string; valor: number; pct: number }[]
  planos: { nome: string; count: number; valor: number; pct: number }[]
}

interface ApiAggregated {
  leads: number
  prevLeads: number
  leadsManuais: number
  leadsImportados: number
  agendados: number
  consultas: number
  prevConsultas: number
  comparecidas: number
  prevComparecidas: number
  tratamentos: number
  prevTratamentos: number
  origens: { nome: string; count: number; pct: number }[]
  responsaveis: { nome: string; leads: number; fechados: number; receita: number }[]
}

function emptyApiAggregated(): ApiAggregated {
  return {
    leads: 0, prevLeads: 0,
    leadsManuais: 0, leadsImportados: 0,
    agendados: 0,
    consultas: 0, prevConsultas: 0,
    comparecidas: 0, prevComparecidas: 0,
    tratamentos: 0, prevTratamentos: 0,
    origens: [], responsaveis: [],
  }
}

function aggregateStats(stats: LeadsStatsResponse[]): ApiAggregated {
  const out = emptyApiAggregated()
  const origensMap = new Map<string, number>()
  const responsaveisMap = new Map<string, { leads: number; fechados: number }>()
  for (const s of stats) {
    out.leads += s.current.leads
    out.leadsManuais += s.current.leadsManuais
    out.leadsImportados += s.current.leadsImportados
    out.agendados += s.current.agendados
    out.consultas += s.current.comConsulta
    out.comparecidas += s.current.compareceram
    out.tratamentos += s.current.fecharam
    if (s.previous) {
      out.prevLeads += s.previous.leads
      out.prevConsultas += s.previous.comConsulta
      out.prevComparecidas += s.previous.compareceram
      out.prevTratamentos += s.previous.fecharam
    }
    for (const o of s.topOrigens) origensMap.set(o.nome, (origensMap.get(o.nome) ?? 0) + o.count)
    for (const r of s.topResponsaveis) {
      const cur = responsaveisMap.get(r.nome) ?? { leads: 0, fechados: 0 }
      cur.leads += r.leads
      cur.fechados += r.fecharam
      responsaveisMap.set(r.nome, cur)
    }
  }
  const origemTotal = out.leads || 1
  out.origens = [...origensMap.entries()]
    .map(([nome, count]) => ({ nome, count, pct: Math.round((count / origemTotal) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
  out.responsaveis = [...responsaveisMap.entries()]
    .map(([nome, v]) => ({ nome, leads: v.leads, fechados: v.fechados, receita: 0 }))
    .sort((a, b) => b.fechados - a.fechados || b.leads - a.leads)
  return out
}

function computeLocal(
  consultas: Consulta[],
  tratamentos: Tratamento[],
  win: ReturnType<typeof periodWindow>,
): Pick<Computed, 'consultas' | 'prevConsultas' | 'tratamentos' | 'prevTratamentos' | 'comparecidas' | 'prevComparecidas' | 'receita' | 'prevReceita' | 'ticketMedio' | 'formas' | 'planos'> {
  const consultasCurr = consultas.filter((c) => inWindow(c.createdAt, win.startMs))
  const consultasPrev = consultas.filter((c) => inWindow(c.createdAt, win.prevStartMs, win.prevEndMs))
  const tratamentosCurr = tratamentos.filter((t) => inWindow(t.createdAt, win.startMs))
  const tratamentosPrev = tratamentos.filter((t) => inWindow(t.createdAt, win.prevStartMs, win.prevEndMs))

  const sumRecs = (list: Array<{ recebimentos: { valorRecebimento: number }[] }>) =>
    list.reduce((s, item) => s + item.recebimentos.reduce((a, r) => a + r.valorRecebimento, 0), 0)

  const receitaCurr = sumRecs(consultasCurr) + sumRecs(tratamentosCurr)
  const receitaPrev = sumRecs(consultasPrev) + sumRecs(tratamentosPrev)
  const ticketMedio = tratamentosCurr.length > 0 ? receitaCurr / tratamentosCurr.length : 0

  const formaMap = new Map<string, number>()
  const allRecs = [...consultasCurr.flatMap((c) => c.recebimentos), ...tratamentosCurr.flatMap((t) => t.recebimentos)]
  for (const r of allRecs) {
    formaMap.set(r.formaPagamento, (formaMap.get(r.formaPagamento) ?? 0) + r.valorRecebimento)
  }
  const formaTotal = receitaCurr || 1
  const formas = [...formaMap.entries()]
    .map(([forma, valor]) => ({ forma, valor, pct: Math.round((valor / formaTotal) * 100) }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 4)

  const planoMap = new Map<string, { count: number; valor: number }>()
  for (const t of tratamentosCurr) {
    const k = (t.planoTratamento || 'Não informado').trim() || 'Não informado'
    const cur = planoMap.get(k) ?? { count: 0, valor: 0 }
    planoMap.set(k, { count: cur.count + 1, valor: cur.valor + t.valorPlano })
  }
  const planoCountTotal = tratamentosCurr.length || 1
  const planos = [...planoMap.entries()]
    .map(([nome, v]) => ({ nome, count: v.count, valor: v.valor, pct: Math.round((v.count / planoCountTotal) * 100) }))
    .sort((a, b) => b.count - a.count || b.valor - a.valor)
    .slice(0, 4)

  return {
    consultas: consultasCurr.length,
    prevConsultas: consultasPrev.length,
    comparecidas: consultasCurr.filter((c) => c.compareceu).length,
    prevComparecidas: consultasPrev.filter((c) => c.compareceu).length,
    tratamentos: tratamentosCurr.length,
    prevTratamentos: tratamentosPrev.length,
    receita: receitaCurr,
    prevReceita: receitaPrev,
    ticketMedio,
    formas,
    planos,
  }
}

export function DashboardView() {
  const [filters, setFilters] = useState<DashboardFilters>({ periodo: 'mes' })
  const [fonte, setFonte] = useState<DashboardFonte>('todos')
  const [tickNow, setTickNow] = useState(() => Date.now())
  const store = useCadastroStore()
  const isClient = useIsClient()
  const [empresas, setEmpresas] = useState<EmpresaDto[]>([])
  const [apiAgg, setApiAgg] = useState<ApiAggregated>(emptyApiAggregated())
  const [statsLoading, setStatsLoading] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const reqIdRef = useRef(0)
  const dashboardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(() => setTickNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    empresasApi
      .list()
      .then(setEmpresas)
      .catch(() => setEmpresas([]))
  }, [])

  const win = useMemo(() => periodWindow(filters.periodo), [filters.periodo, tickNow])

  // Busca stats agregadas em paralelo pra todas as empresas — uma query agregada SQL por empresa.
  useEffect(() => {
    if (!isClient || empresas.length === 0) return
    const myReqId = ++reqIdRef.current
    setStatsLoading(true)
    const fromIso = new Date(win.startMs).toISOString()
    const toIso = new Date().toISOString()
    const prevFromIso = new Date(win.prevStartMs).toISOString()
    const prevToIso = new Date(win.prevEndMs).toISOString()
    const fonteParam = fonte === 'todos' ? undefined : fonte
    Promise.all(
      empresas.map((e) =>
        leadsApi.stats(e.id, {
          from: fromIso,
          to: toIso,
          prevFrom: prevFromIso,
          prevTo: prevToIso,
          fonte: fonteParam,
        }),
      ),
    )
      .then((results) => {
        if (myReqId !== reqIdRef.current) return
        setApiAgg(aggregateStats(results))
      })
      .catch(() => {
        if (myReqId !== reqIdRef.current) return
        setApiAgg(emptyApiAggregated())
      })
      .finally(() => {
        if (myReqId === reqIdRef.current) setStatsLoading(false)
      })
  }, [empresas, win, isClient, fonte])

  const m = useMemo<Computed>(() => {
    if (!isClient) {
      return {
        leads: 0, prevLeads: 0,
        leadsManuais: 0, leadsImportados: 0,
        agendados: 0,
        consultas: 0, prevConsultas: 0,
        comparecidas: 0, prevComparecidas: 0,
        tratamentos: 0, prevTratamentos: 0,
        receita: 0, prevReceita: 0, ticketMedio: 0,
        origens: [],
        responsaveis: [],
        formas: [],
        planos: [],
      }
    }
    const local = computeLocal(store.consultas, store.tratamentos, win)
    return {
      leads: apiAgg.leads,
      prevLeads: apiAgg.prevLeads,
      leadsManuais: apiAgg.leadsManuais,
      leadsImportados: apiAgg.leadsImportados,
      agendados: apiAgg.agendados,
      consultas: apiAgg.consultas + local.consultas,
      prevConsultas: apiAgg.prevConsultas + local.prevConsultas,
      comparecidas: apiAgg.comparecidas + local.comparecidas,
      prevComparecidas: apiAgg.prevComparecidas + local.prevComparecidas,
      tratamentos: apiAgg.tratamentos + local.tratamentos,
      prevTratamentos: apiAgg.prevTratamentos + local.prevTratamentos,
      receita: local.receita,
      prevReceita: local.prevReceita,
      ticketMedio: local.ticketMedio,
      origens: apiAgg.origens,
      responsaveis: apiAgg.responsaveis,
      formas: local.formas,
      planos: local.planos,
    }
  }, [apiAgg, store, win, isClient])

  const dReceita = deltaPct(m.receita, m.prevReceita)
  const dLeads = deltaPct(m.leads, m.prevLeads)
  const dTratamentos = deltaPct(m.tratamentos, m.prevTratamentos)
  const dComparecidas = deltaPct(m.comparecidas, m.prevComparecidas)

  const funilTotal = m.leads || 1

  return (
    <div className="min-h-full">
      <DashboardHeader
        filters={filters}
        onFilterChange={(next) => setFilters((p) => ({ ...p, ...next }))}
        fonte={fonte}
        onFonteChange={setFonte}
      />

      <main className="px-4 md:px-8 py-6 md:py-8 max-w-[1280px] mx-auto">
        <div ref={dashboardRef}>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-6 gap-3 [grid-auto-rows:auto] md:[grid-auto-rows:160px]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* HERO — Receita */}
          <div
            className="col-span-3 row-span-2 rounded-3xl p-7 flex flex-col justify-between text-cyan-50"
            style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 65%, #075985 100%)' }}
          >
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-cyan-100/85">Receita acumulada</p>
              <p className="text-[12px] text-cyan-100/65 mt-1">No período selecionado</p>
            </div>
            <div>
              <p className="text-[64px] font-bold tabular-nums leading-none tracking-tight">
                <AnimatedNumber value={m.receita} formatValue={(v) => brl(Math.round(v))} />
              </p>
              <div className="flex items-center gap-3 mt-4 text-[12px]">
                <span className="px-2 py-0.5 rounded-md bg-cyan-100/20 font-semibold tabular-nums">
                  {dReceita.value}
                </span>
                <span className="text-cyan-100/75">vs período anterior</span>
              </div>
            </div>
          </div>

          {/* Leads */}
          <div className="col-span-2 row-span-1 rounded-3xl bg-[#15171b] border border-white/[0.05] p-6 flex flex-col justify-between">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Leads</p>
              <p className={`text-[11px] tabular-nums ${dLeads.positive ? 'text-cyan-400' : 'text-rose-400'}`}>
                {dLeads.value}
              </p>
            </div>
            <div>
              <p className="text-[40px] font-bold tabular-nums leading-none">
                <AnimatedNumber value={m.leads} />
              </p>
              <div className="flex items-center gap-3 mt-2 text-[11px] tabular-nums">
                <span className="inline-flex items-center gap-1 text-cyan-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  {m.leadsManuais} manuais
                </span>
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {m.leadsImportados} importados
                </span>
              </div>
            </div>
          </div>

          {/* Comparecidas */}
          <div className="col-span-1 row-span-1 rounded-3xl bg-[#15171b] border border-white/[0.05] p-5 flex flex-col justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Comparecidas</p>
            <div>
              <p className="text-[36px] font-bold tabular-nums leading-none">
                <AnimatedNumber value={m.comparecidas} />
              </p>
              <p className={`text-[11px] mt-1 tabular-nums ${dComparecidas.positive ? 'text-cyan-400' : 'text-rose-400'}`}>
                {dComparecidas.value}
              </p>
            </div>
          </div>

          {/* Funil */}
          <div className="col-span-3 row-span-1 rounded-3xl bg-[#15171b] border border-white/[0.05] p-6">
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Funil</p>
              <p className="text-[12px] text-white/45 tabular-nums">{m.leads} → {m.tratamentos}</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Leads', n: m.leads },
                { label: 'Agendou', n: m.agendados },
                { label: 'Consulta', n: m.consultas },
                { label: 'Tratou', n: m.tratamentos },
              ].map((s, i) => (
                <div key={s.label} className="text-center">
                  <div
                    className="h-12 rounded-lg flex items-end justify-center"
                    style={{
                      background: `linear-gradient(180deg, transparent ${100 - (s.n / funilTotal) * 100}%, rgba(34,211,238,0.55) ${100 - (s.n / funilTotal) * 100}%)`,
                    }}
                  >
                    <span className="text-[14px] font-semibold tabular-nums pb-1">{s.n}</span>
                  </div>
                  <p className="text-[10px] text-white/50 mt-1.5 tracking-wider uppercase">{s.label}</p>
                  {i > 0 && (
                    <p className="text-[9px] text-cyan-400 tabular-nums">
                      {Math.round((s.n / funilTotal) * 100)}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Top origens / Planos / Formas (col 5–6, row 1–2) */}
          <TopBreakdownCard origens={m.origens} planos={m.planos} formas={m.formas} />


          {/* Fechados */}
          <div className="col-span-1 row-span-1 rounded-3xl bg-[#15171b] border border-white/[0.05] p-5 flex flex-col justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Fechados</p>
            <div>
              <p className="text-[36px] font-bold tabular-nums leading-none">
                <AnimatedNumber value={m.tratamentos} />
              </p>
              <p className={`text-[11px] mt-1 tabular-nums ${dTratamentos.positive ? 'text-cyan-400' : 'text-rose-400'}`}>
                {dTratamentos.value}
              </p>
            </div>
          </div>

          {/* Ticket */}
          <div className="col-span-1 row-span-1 rounded-3xl bg-[#15171b] border border-white/[0.05] p-5 flex flex-col justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Ticket</p>
            <div>
              <p className="text-[24px] font-bold tabular-nums leading-none">
                <AnimatedNumber value={m.ticketMedio} formatValue={(v) => brl(Math.round(v))} />
              </p>
              <p className="text-[11px] text-white/45 mt-1.5">por tratamento</p>
            </div>
          </div>

          {/* Top atendentes */}
          <div className="col-span-3 row-span-1 rounded-3xl bg-[#15171b] border border-white/[0.05] p-5">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Top atendentes</p>
              <p className="text-[11px] text-white/45">{m.responsaveis.length} responsáveis</p>
            </div>
            {m.responsaveis.length === 0 ? (
              <p className="text-[12px] text-white/45">Cadastre leads com responsáveis para aparecer aqui.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {m.responsaveis.slice(0, 3).map((r, i) => {
                  const medalEmoji = ['🥇', '🥈', '🥉'][i] ?? '·'
                  const conv = r.leads > 0 ? Math.round((r.fechados / r.leads) * 100) : 0
                  return (
                    <div
                      key={r.nome}
                      className={cn(
                        'rounded-xl border p-3',
                        i === 0
                          ? 'bg-cyan-500/[0.08] border-cyan-400/30'
                          : 'bg-white/[0.03] border-white/[0.05]',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[14px]">{medalEmoji}</span>
                        <span className="text-[12px] font-medium truncate">{r.nome}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[20px] font-bold tabular-nums">{r.fechados}</span>
                        <span className="text-[11px] text-white/45 tabular-nums">de {r.leads}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[11px]">
                        <span className="text-cyan-300 tabular-nums">{conv}% conv.</span>
                        <span className="text-white/55 tabular-nums">{brl(r.receita)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
        </div>

        {/* Card de análise da I.A. — fora do ref do screenshot pra não vazar
            o próprio botão pra dentro da imagem capturada. */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mt-5 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6 text-cyan-50"
          style={{ background: 'linear-gradient(135deg, #0e7490 0%, #075985 60%, #0c4a6e 100%)' }}
        >
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="h-12 w-12 rounded-2xl bg-white/15 grid place-items-center shrink-0">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/80">
                Análise com I.A.
              </p>
              <h3 className="text-[18px] md:text-[20px] font-bold tracking-tight leading-tight">
                Gere um relatório do dashboard do dia
              </h3>
              <p className="text-[12.5px] text-cyan-100/85 mt-1">
                A I.A. lê os números acima (leads, cadastro, agendados, no-show, tratamentos, origens,
                atendentes) e devolve um diagnóstico com recomendações + foto ao vivo do dash.
              </p>
            </div>
          </div>
          <button
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl bg-white text-slate-900 text-[13.5px] font-bold hover:bg-cyan-50 transition-colors shadow-lg shadow-black/20 shrink-0"
          >
            <Sparkles className="h-4 w-4" />
            Gerar Relatório
          </button>
        </motion.div>

        {m.leads === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 rounded-2xl border border-dashed border-white/[0.10] bg-white/[0.01] px-6 py-5 text-center"
          >
            <p className="text-sm text-white/85 font-medium">Nenhum cadastro no período</p>
            <p className="text-xs text-white/55 mt-1">
              Use o menu lateral para cadastrar Leads, Consultas, Tratamentos e Recebimentos.
            </p>
          </motion.div>
        )}
      </main>

      <AiReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        dashboardRef={dashboardRef}
        snapshot={{
          periodo: filters.periodo,
          fonte,
          empresasCount: empresas.length,
          receita: m.receita,
          prevReceita: m.prevReceita,
          leads: m.leads,
          prevLeads: m.prevLeads,
          leadsManuais: m.leadsManuais,
          leadsImportados: m.leadsImportados,
          agendados: m.agendados,
          consultas: m.consultas,
          prevConsultas: m.prevConsultas,
          comparecidas: m.comparecidas,
          prevComparecidas: m.prevComparecidas,
          tratamentos: m.tratamentos,
          prevTratamentos: m.prevTratamentos,
          ticketMedio: m.ticketMedio,
          origens: m.origens,
          planos: m.planos,
          formas: m.formas,
          responsaveis: m.responsaveis,
        } satisfies DashboardSnapshot}
      />
    </div>
  )
}

interface TopBreakdownCardProps {
  origens: { nome: string; count: number; pct: number }[]
  planos: { nome: string; count: number; valor: number; pct: number }[]
  formas: { forma: string; valor: number; pct: number }[]
}

function TopBreakdownCard({ origens, planos, formas }: TopBreakdownCardProps) {
  const [tab, setTab] = useState<'origens' | 'planos' | 'formas'>('origens')

  const tabs = [
    { id: 'origens' as const, label: 'Origens' },
    { id: 'planos' as const, label: 'Planos' },
    { id: 'formas' as const, label: 'Pagamento' },
  ]

  const renderRows = () => {
    if (tab === 'origens') {
      if (origens.length === 0) return <EmptyHint text="Sem leads cadastrados ainda." />
      return origens.map((o) => (
        <BreakdownRow key={o.nome} label={o.nome} primary={String(o.count)} pct={o.pct} />
      ))
    }
    if (tab === 'planos') {
      if (planos.length === 0) return <EmptyHint text="Sem tratamentos fechados no período." />
      return planos.map((p) => (
        <BreakdownRow
          key={p.nome}
          label={p.nome}
          primary={`${p.count}× · ${brl(p.valor)}`}
          pct={p.pct}
        />
      ))
    }
    if (formas.length === 0) return <EmptyHint text="Sem recebimentos no período." />
    return formas.map((f) => (
      <BreakdownRow key={f.forma} label={f.forma} primary={brl(f.valor)} pct={f.pct} />
    ))
  }

  return (
    <div className="col-span-2 row-span-2 rounded-3xl bg-[#15171b] border border-white/[0.05] p-6 flex flex-col">
      <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-0.5 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 h-8 rounded-lg text-[11px] uppercase tracking-wider font-semibold transition-colors',
              tab === t.id ? 'bg-white text-slate-900' : 'text-white/55 hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-4 flex-1 overflow-hidden">{renderRows()}</div>
    </div>
  )
}

function BreakdownRow({ label, primary, pct }: { label: string; primary: string; pct: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-[14px] font-medium truncate">{label}</span>
        <span className="text-[12px] text-white/55 tabular-nums shrink-0">{primary}</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className="h-full bg-cyan-400" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-[12px] text-white/45">{text}</p>
}

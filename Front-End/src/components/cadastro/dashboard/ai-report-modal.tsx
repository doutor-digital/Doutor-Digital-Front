import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toPng } from 'html-to-image'
import {
  Sparkles,
  Loader2,
  Download,
  Copy,
  Check,
  X,
  ImageIcon,
} from '@/components/icons'
import { aiService } from '@/services/ai'
import { useClinic } from '@/hooks/useClinic'
import { MarkdownLite } from '@/components/MarkdownLite'
import type { DashboardFilters } from '@/types/cadastra'

export interface DashboardSnapshot {
  periodo: DashboardFilters['periodo']
  fonte: 'todos' | 'manual' | 'importado'
  empresasCount: number
  receita: number
  prevReceita: number
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
  ticketMedio: number
  origens: { nome: string; count: number; pct: number }[]
  planos: { nome: string; count: number; valor: number; pct: number }[]
  formas: { forma: string; valor: number; pct: number }[]
  responsaveis: { nome: string; leads: number; fechados: number; receita: number }[]
}

interface Props {
  open: boolean
  onClose: () => void
  dashboardRef: React.RefObject<HTMLDivElement | null>
  snapshot: DashboardSnapshot
}

const PERIODO_LABEL: Record<DashboardFilters['periodo'], string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  semana: 'Últimos 7 dias',
  mes: 'Últimos 30 dias',
  trimestre: 'Últimos 90 dias',
  tudo: 'Todo o período',
  customizado: 'Período personalizado',
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function pctDelta(curr: number, prev: number): string {
  if (prev === 0 && curr === 0) return '0%'
  if (prev === 0) return '+100%'
  const pct = Math.round(((curr - prev) / prev) * 100)
  return `${pct >= 0 ? '+' : ''}${pct}%`
}

// Monta o prompt enviado pra IA com TODOS os números visíveis no dash, mais
// pedido explícito de análise executiva e recomendações práticas.
function buildPrompt(s: DashboardSnapshot): string {
  const periodoLabel = PERIODO_LABEL[s.periodo] ?? String(s.periodo)
  const conv = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

  const linhas: string[] = []
  linhas.push(`Estou olhando o dashboard principal do painel agora. Período: **${periodoLabel}**. Fonte de leads: ${s.fonte}. Agregando ${s.empresasCount} ${s.empresasCount === 1 ? 'unidade' : 'unidades'}.`)
  linhas.push('')
  linhas.push('## Números do período')
  linhas.push(`- Receita acumulada: ${brl(s.receita)} (${pctDelta(s.receita, s.prevReceita)} vs período anterior)`)
  linhas.push(`- Leads: ${s.leads} (${s.leadsManuais} manuais + ${s.leadsImportados} importados · ${pctDelta(s.leads, s.prevLeads)})`)
  linhas.push(`- Tentativas de resgate (agendados): ${s.agendados}`)
  linhas.push(`- Consultas: ${s.consultas} (${pctDelta(s.consultas, s.prevConsultas)})`)
  linhas.push(`- Comparecidas: ${s.comparecidas} (${pctDelta(s.comparecidas, s.prevComparecidas)})`)
  linhas.push(`- No-show: ${s.consultas - s.comparecidas} (consultas que não compareceram)`)
  linhas.push(`- Tratamentos fechados: ${s.tratamentos} (${pctDelta(s.tratamentos, s.prevTratamentos)})`)
  linhas.push(`- Ticket médio: ${brl(s.ticketMedio)} por tratamento`)
  linhas.push('')
  linhas.push('## Funil')
  linhas.push(`- Leads ${s.leads} → Agendou ${s.agendados} (${conv(s.agendados, s.leads)}%) → Consulta ${s.consultas} (${conv(s.consultas, s.leads)}%) → Tratou ${s.tratamentos} (${conv(s.tratamentos, s.leads)}%)`)
  linhas.push('')
  if (s.origens.length > 0) {
    linhas.push('## Origens dos leads (cadastro / por origem)')
    for (const o of s.origens) linhas.push(`- ${o.nome}: ${o.count} (${o.pct}%)`)
    linhas.push('')
  }
  if (s.planos.length > 0) {
    linhas.push('## Tratamentos por plano')
    for (const p of s.planos) linhas.push(`- ${p.nome}: ${p.count}× · ${brl(p.valor)} (${p.pct}%)`)
    linhas.push('')
  }
  if (s.formas.length > 0) {
    linhas.push('## Formas de pagamento (agendados)')
    for (const f of s.formas) linhas.push(`- ${f.forma}: ${brl(f.valor)} (${f.pct}%)`)
    linhas.push('')
  }
  if (s.responsaveis.length > 0) {
    linhas.push('## Top atendentes / SDRs')
    for (const r of s.responsaveis.slice(0, 5)) {
      const c = r.leads > 0 ? Math.round((r.fechados / r.leads) * 100) : 0
      linhas.push(`- ${r.nome}: ${r.fechados} fechados de ${r.leads} leads (${c}% conv · ${brl(r.receita)})`)
    }
    linhas.push('')
  }
  linhas.push('---')
  linhas.push('')
  linhas.push('**Gere um relatório executivo curto em pt-BR** baseado SÓ nesses números acima. Estrutura sugerida:')
  linhas.push('')
  linhas.push('### Resumo')
  linhas.push('2–3 frases destacando o resultado do período e o que mais chama atenção.')
  linhas.push('')
  linhas.push('### Pontos fortes')
  linhas.push('De 2 a 4 bullets do que está indo bem, com números.')
  linhas.push('')
  linhas.push('### Pontos de atenção')
  linhas.push('De 2 a 4 bullets sobre perdas no funil, no-show, motivos de não agendamento, baixa conversão por origem ou atendente.')
  linhas.push('')
  linhas.push('### Recomendações')
  linhas.push('3 ações práticas e específicas pra esta semana, citando origem/atendente/horário quando fizer sentido.')
  linhas.push('')
  linhas.push('Não invente nenhum número. Se um dado não está acima, escreve "não tenho esse dado".')

  return linhas.join('\n')
}

export function AiReportModal({ open, onClose, dashboardRef, snapshot }: Props) {
  const tenantId = useClinic((s) => s.tenantId)
  const [phase, setPhase] = useState<'idle' | 'capturing' | 'analyzing' | 'ready' | 'error'>('idle')
  const [shotUrl, setShotUrl] = useState<string | null>(null)
  const [shotBlob, setShotBlob] = useState<Blob | null>(null)
  const [markdown, setMarkdown] = useState<string>('')
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const runIdRef = useRef(0)

  const prompt = useMemo(() => buildPrompt(snapshot), [snapshot])

  useEffect(() => {
    if (!open) {
      setPhase('idle')
      setShotUrl(null)
      setShotBlob(null)
      setMarkdown('')
      setErrMsg(null)
      setCopied(false)
      return
    }
    const myRun = ++runIdRef.current
    let cancelled = false

    ;(async () => {
      setPhase('capturing')
      setErrMsg(null)
      try {
        await new Promise((r) => setTimeout(r, 80))
        const node = dashboardRef.current
        let dataUrl: string | null = null
        if (node) {
          dataUrl = await toPng(node, {
            cacheBust: true,
            pixelRatio: 2,
            backgroundColor: '#0c0d10',
            skipFonts: false,
          })
        }
        if (cancelled || myRun !== runIdRef.current) return
        if (dataUrl) {
          const resp = await fetch(dataUrl)
          const blob = await resp.blob()
          setShotUrl(dataUrl)
          setShotBlob(blob)
        }

        setPhase('analyzing')
        const reply = await aiService.chat({
          messages: [{ role: 'user', content: prompt }],
          unitId: null,
          tenantId,
          currentPath: '/dashboard',
        })
        if (cancelled || myRun !== runIdRef.current) return
        setMarkdown(reply.content || '*A IA não devolveu conteúdo.*')
        setPhase('ready')
      } catch (err: unknown) {
        if (cancelled || myRun !== runIdRef.current) return
        const msg = err instanceof Error ? err.message : String(err)
        setErrMsg(msg)
        setPhase('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, dashboardRef, prompt, tenantId])

  const fileNameBase = useMemo(() => {
    const ts = new Date().toISOString().slice(0, 10)
    return `relatorio-dashboard-${ts}`
  }, [])

  const handleDownloadPng = () => {
    if (!shotBlob) return
    const url = URL.createObjectURL(shotBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileNameBase}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // browser bloqueou — ignora silencioso
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            className="relative w-full max-w-[1100px] rounded-3xl bg-[#0f1115] border border-white/[0.08] shadow-2xl overflow-hidden"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {/* Header */}
            <div
              className="px-6 py-5 flex items-center justify-between text-cyan-50"
              style={{ background: 'linear-gradient(135deg, #0e7490 0%, #075985 60%, #0c4a6e 100%)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-2xl bg-white/15 grid place-items-center shrink-0">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/80">
                    Inteligência do dashboard
                  </p>
                  <h2 className="text-[20px] font-bold tracking-tight leading-tight truncate">
                    Relatório com I.A.
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 grid place-items-center text-white transition-colors"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Status bar */}
            <div className="px-6 py-3 border-b border-white/[0.05] flex items-center gap-3 text-[12px]">
              {phase === 'capturing' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                  <span className="text-white/75">Capturando o dashboard…</span>
                </>
              )}
              {phase === 'analyzing' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                  <span className="text-white/75">
                    Analisando os números com a I.A. — pode demorar 20–60s.
                  </span>
                </>
              )}
              {phase === 'ready' && (
                <>
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-white/75">Relatório pronto.</span>
                </>
              )}
              {phase === 'error' && (
                <>
                  <span className="inline-flex h-2 w-2 rounded-full bg-rose-400" />
                  <span className="text-rose-200 truncate">{errMsg ?? 'Erro inesperado.'}</span>
                </>
              )}
            </div>

            {/* Body */}
            <div className="px-6 py-6 space-y-5 max-h-[calc(100vh-220px)] overflow-y-auto">
              {/* Screenshot */}
              <section>
                <div className="flex items-center gap-2 mb-2.5">
                  <ImageIcon className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-[13px] font-semibold text-white/85">Foto ao vivo do dashboard</h3>
                </div>
                {shotUrl ? (
                  <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0c0d10]">
                    <img src={shotUrl} alt="Dashboard" className="w-full h-auto block" />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] h-40 grid place-items-center text-[12px] text-white/45">
                    {phase === 'capturing' ? 'Gerando foto…' : 'Sem captura disponível.'}
                  </div>
                )}
              </section>

              {/* AI markdown */}
              <section>
                <div className="flex items-center gap-2 mb-2.5">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-[13px] font-semibold text-white/85">Análise da I.A.</h3>
                </div>
                {phase === 'ready' ? (
                  <article className="rounded-2xl bg-white border border-white/[0.06] p-5 text-slate-800">
                    <MarkdownLite text={markdown} />
                  </article>
                ) : phase === 'error' ? (
                  <div className="rounded-2xl bg-rose-500/[0.08] border border-rose-400/30 px-4 py-3 text-[12.5px] text-rose-100">
                    Não foi possível gerar a análise: {errMsg}
                    {errMsg?.toLowerCase().includes('chave') && (
                      <p className="mt-2 text-rose-200/80">
                        Configure a chave da OpenAI em <span className="font-mono">/ia-analytics</span> antes
                        de gerar o relatório.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-6 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-300 mx-auto mb-2" />
                    <p className="text-[12px] text-white/55">
                      A I.A. está estudando os números do dashboard…
                    </p>
                  </div>
                )}
              </section>
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-white/[0.05] flex flex-wrap items-center justify-end gap-2 bg-[#0c0d10]/40">
              <button
                onClick={handleCopyMarkdown}
                disabled={phase !== 'ready'}
                className="inline-flex items-center gap-1.5 px-3 h-10 rounded-xl bg-[#15171b] border border-white/[0.08] text-[13px] text-white/80 hover:text-white hover:border-white/[0.16] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado!' : 'Copiar texto'}
              </button>
              <button
                onClick={handleDownloadPng}
                disabled={!shotBlob}
                className="inline-flex items-center gap-1.5 px-3 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="h-4 w-4" />
                Baixar foto (PNG)
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

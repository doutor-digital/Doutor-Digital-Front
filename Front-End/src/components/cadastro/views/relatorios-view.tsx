
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Copy,
  Download,
  FileText,
  Filter,
  Image as ImageIcon,
  RotateCcw,
  Settings,
  Share2,
  Smartphone,
  Sparkles,
  Check,
  Loader2,
} from "@/components/icons"
import { toPng } from 'html-to-image'
import { DashboardView } from '@/components/cadastro/dashboard/dashboard-view'
import { useCadastroStore } from '@/lib/cadastra/cadastro-store'
import { useMergedLeads } from '@/lib/cadastra/leads-merged'
import { empresasApi, type EmpresaDto } from '@/lib/cadastra/api'
import {
  DEFAULT_SECTIONS,
  SECTION_LABELS,
  generateReport,
  type Periodo,
  type ReportConfig,
  type ReportSections,
} from '@/lib/cadastra/relatorio-engine'
import { cn } from '@/lib/utils'

interface Props {
  onBack: () => void
}

const PERIODO_LABELS: { value: Periodo; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: 'semana', label: '7 dias' },
  { value: 'mes', label: '30 dias' },
  { value: 'trimestre', label: '90 dias' },
  { value: 'ano', label: '12 meses' },
  { value: 'tudo', label: 'Tudo' },
  { value: 'custom', label: 'Personalizado' },
]

const PRESETS: Record<string, { label: string; sections: ReportSections; verbosidade: ReportConfig['verbosidade'] }> = {
  diario: {
    label: 'Resumo diário',
    verbosidade: 'compacto',
    sections: {
      ...DEFAULT_SECTIONS,
      kpis: true,
      comparativo: false,
      responsaveis: true,
      origens: false,
      tipos: false,
      tiposResgate: false,
      planos: false,
      formasPagamento: false,
      motivosNaoAgendamento: false,
      motivosNaoFechamento: false,
      pipeline: true,
      tendencias: false,
      insights: false,
      recomendacoes: false,
      rodape: false,
    },
  },
  semanal: {
    label: 'Semanal completo',
    verbosidade: 'medio',
    sections: { ...DEFAULT_SECTIONS },
  },
  mensal: {
    label: 'Mensal executivo',
    verbosidade: 'detalhado',
    sections: {
      ...DEFAULT_SECTIONS,
      tipos: true,
      tiposResgate: true,
      planos: true,
      formasPagamento: true,
      pipeline: true,
    },
  },
  comercial: {
    label: 'Foco comercial',
    verbosidade: 'medio',
    sections: {
      ...DEFAULT_SECTIONS,
      origens: true,
      responsaveis: true,
      motivosNaoAgendamento: true,
      motivosNaoFechamento: true,
      insights: true,
      recomendacoes: true,
      planos: false,
      formasPagamento: false,
      tipos: false,
      tiposResgate: false,
      tendencias: false,
    },
  },
  financeiro: {
    label: 'Financeiro',
    verbosidade: 'detalhado',
    sections: {
      cabecalho: true,
      resumoExecutivo: true,
      kpis: true,
      comparativo: true,
      funil: false,
      responsaveis: true,
      origens: false,
      tipos: false,
      tiposResgate: false,
      planos: true,
      formasPagamento: true,
      motivosNaoAgendamento: false,
      motivosNaoFechamento: false,
      pipeline: false,
      tendencias: false,
      insights: false,
      recomendacoes: false,
      rodape: true,
    },
  },
}

export function RelatoriosView({ onBack }: Props) {
  const localStore = useCadastroStore()
  const { leads, apiSummaries, loading, error } = useMergedLeads()
  const [empresas, setEmpresas] = useState<EmpresaDto[]>([])
  const [copied, setCopied] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [captureMsg, setCaptureMsg] = useState<string | null>(null)
  const previewRef = useRef<HTMLPreElement>(null)
  const dashboardRef = useRef<HTMLDivElement>(null)

  const [cfg, setCfg] = useState<ReportConfig>({
    empresaId: '',
    empresaNome: '',
    periodo: 'mes',
    comparePeriod: 'previous',
    filterTipo: 'todos',
    sections: DEFAULT_SECTIONS,
    tom: 'casual',
    verbosidade: 'medio',
    emojis: true,
    topN: 5,
    saudacao: '',
    destinatario: 'equipe',
    formato: 'whatsapp',
  })

  useEffect(() => {
    empresasApi.list().then((list) => {
      setEmpresas(list)
      if (list.length > 0) {
        setCfg((c) => ({
          ...c,
          empresaId: c.empresaId || list[0].id,
          empresaNome: c.empresaNome || list[0].nome,
        }))
      }
    })
  }, [])

  // Sync empresaNome when empresaId changes
  useEffect(() => {
    const e = empresas.find((x) => x.id === cfg.empresaId)
    if (e && cfg.empresaNome !== e.nome) {
      setCfg((c) => ({ ...c, empresaNome: e.nome }))
    }
  }, [cfg.empresaId, empresas, cfg.empresaNome])

  // Filtrar leads pela empresa selecionada (importante quando o user tem várias empresas)
  const scopedLeads = useMemo(
    () => leads.filter((l) => !l.empresaId || l.empresaId === cfg.empresaId),
    [leads, cfg.empresaId],
  )

  const responsaveisDisponiveis = useMemo(
    () => Array.from(new Set(scopedLeads.map((l) => l.nomeResponsavel).filter(Boolean))).sort(),
    [scopedLeads],
  )
  const origensDisponiveis = useMemo(
    () => Array.from(new Set(scopedLeads.map((l) => l.origem).filter(Boolean))).sort(),
    [scopedLeads],
  )

  const reportText = useMemo(() => {
    if (!cfg.empresaId) return 'Selecione a empresa pra gerar o relatório.'
    return generateReport({
      config: cfg,
      leads: scopedLeads,
      apiSummaries,
      consultas: localStore.consultas,
      tratamentos: localStore.tratamentos,
    })
  }, [cfg, scopedLeads, apiSummaries, localStore.consultas, localStore.tratamentos])

  const charCount = reportText.length
  const lineCount = reportText.split('\n').length

  const updateSection = (key: keyof ReportSections, value: boolean) =>
    setCfg((c) => ({ ...c, sections: { ...c.sections, [key]: value } }))

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey]
    if (!preset) return
    setCfg((c) => ({ ...c, sections: preset.sections, verbosidade: preset.verbosidade }))
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      if (previewRef.current) {
        const range = document.createRange()
        range.selectNode(previewRef.current)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      }
    }
  }

  // Abre o WhatsApp e garante que o texto esteja no clipboard pra colar.
  // Não passamos o texto via wa.me?text= porque a URL fica longa demais com emojis
  // (cada emoji vira 12 bytes URL-encoded) e o WhatsApp trunca, corrompendo emojis em "?".
  const openWhatsAppWithClipboard = async (text: string): Promise<boolean> => {
    let copiedToClipboard = false
    try {
      await navigator.clipboard.writeText(text)
      copiedToClipboard = true
    } catch {
      // alguns browsers bloqueiam clipboard sem gesture — segue o fluxo
    }
    window.open('https://wa.me/', '_blank', 'noopener,noreferrer')
    return copiedToClipboard
  }

  const handleShareWhatsApp = async () => {
    const ok = await openWhatsAppWithClipboard(reportText)
    setCaptureMsg(
      ok
        ? 'Texto copiado pro clipboard. Cole na conversa do WhatsApp (Ctrl+V / colar).'
        : 'WhatsApp aberto. Volte e clique "Copiar texto" pra colar a mensagem.',
    )
  }

  // Captura visual do dashboard como PNG via html-to-image. Roda contra o ref do
  // wrapper que envolve <DashboardView /> abaixo. Retorna um Blob — o caller decide
  // se faz download, anexa via Web Share, ou copia pra clipboard.
  const captureDashboard = async (): Promise<Blob | null> => {
    if (!dashboardRef.current) return null
    try {
      const dataUrl = await toPng(dashboardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0c0d10',
        // recharts usa SVGs internos; html-to-image cuida disso nativamente.
        // Foreign objects podem ter problemas de fonte — embedFonts garante consistência.
        skipFonts: false,
      })
      const resp = await fetch(dataUrl)
      return await resp.blob()
    } catch {
      return null
    }
  }

  const fileNameBase = `dashboard-${cfg.empresaNome.replace(/\s+/g, '-').toLowerCase() || 'empresa'}-${new Date().toISOString().slice(0, 10)}`

  const handleDownloadImage = async () => {
    setCapturing(true)
    setCaptureMsg(null)
    try {
      const blob = await captureDashboard()
      if (!blob) {
        setCaptureMsg('Falha ao capturar o dashboard. Verifique se ele apareceu abaixo.')
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileNameBase}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setCaptureMsg('Imagem do dashboard baixada.')
    } finally {
      setCapturing(false)
    }
  }

  // Tenta compartilhar texto + imagem juntos via Web Share API (abre WhatsApp/etc no celular).
  // Fallback: baixa a imagem e abre wa.me só com texto, instruindo o usuário a anexar manualmente.
  const handleShareWithImage = async () => {
    setCapturing(true)
    setCaptureMsg(null)
    try {
      const blob = await captureDashboard()
      if (!blob) {
        setCaptureMsg('Falha ao capturar o dashboard. Tente "Baixar imagem" e enviar manualmente.')
        return
      }
      const file = new File([blob], `${fileNameBase}.png`, { type: 'image/png' })

      // Web Share API com files — funciona em Chrome/Safari mobile e desktop recente.
      const canShareFiles =
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })

      if (canShareFiles && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            files: [file],
            text: reportText,
            title: `Relatório — ${cfg.empresaNome}`,
          })
          setCaptureMsg('Compartilhamento aberto.')
          return
        } catch (err) {
          // AbortError = usuário cancelou; não tratar como erro.
          if (err instanceof Error && err.name === 'AbortError') return
          // Outros erros: cai no fallback abaixo.
        }
      }

      // Fallback: baixa a imagem, copia o texto pro clipboard, abre WhatsApp.
      // wa.me?text= com emojis corrompe ao truncar; clipboard preserva UTF-8.
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileNameBase}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      const copiedOk = await openWhatsAppWithClipboard(reportText)
      setCaptureMsg(
        copiedOk
          ? 'Imagem baixada, texto copiado e WhatsApp aberto. Cole o texto (Ctrl+V) e anexe a imagem na conversa.'
          : 'Imagem baixada. WhatsApp aberto. Volte e clique "Copiar texto" pra colar.',
      )
    } finally {
      setCapturing(false)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().slice(0, 10)
    a.download = `relatorio-${cfg.empresaNome.replace(/\s+/g, '-').toLowerCase()}-${ts}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setCfg((c) => ({
      ...c,
      sections: DEFAULT_SECTIONS,
      tom: 'casual',
      verbosidade: 'medio',
      emojis: true,
      topN: 5,
      saudacao: '',
      destinatario: 'equipe',
      formato: 'whatsapp',
      filterResponsavel: undefined,
      filterOrigem: undefined,
      filterTipo: 'todos',
      comparePeriod: 'previous',
    }))
  }

  return (
    <motion.div
      className="px-4 md:px-8 py-8 max-w-[1500px] mx-auto"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-[#15171b] border border-white/[0.05] text-[13px] text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[#15171b] border border-white/[0.05] text-[13px] text-white/70 hover:text-white"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar
          </button>
        </div>
      </div>

      {/* Hero */}
      <div
        className="rounded-3xl p-7 mb-5 text-cyan-50"
        style={{ background: 'linear-gradient(135deg, #0e7490 0%, #075985 60%, #0c4a6e 100%)' }}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/15 grid place-items-center">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-[0.2em] text-cyan-100/85 mb-1">Inteligência de negócio</p>
            <h1 className="text-[28px] font-bold tracking-tight leading-none">Relatórios</h1>
            <p className="text-[13px] text-cyan-100/85 mt-2">
              Gere mensagens completas pra time, gestor ou sócios. Ajuste seções, tom e formato — preview ao vivo no celular.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-500/[0.08] border border-rose-400/30 text-rose-200 text-sm p-3 mb-4">
          ⚠ {error}
        </div>
      )}
      {loading && (
        <div className="rounded-2xl bg-cyan-500/[0.06] border border-cyan-400/20 text-cyan-200 text-sm p-3 mb-4">
          Carregando dados…
        </div>
      )}

      {/* 2 col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(320px,400px)] gap-5">
        {/* LEFT: configuração */}
        <div className="space-y-4">
          {/* Presets */}
          <Panel icon={<Sparkles className="h-4 w-4 text-cyan-400" />} title="Modelos prontos">
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESETS).map(([k, p]) => (
                <button
                  key={k}
                  onClick={() => applyPreset(k)}
                  className="px-3 h-9 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px] text-white/75 hover:text-white hover:border-cyan-400/40 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Panel>

          {/* Empresa + período */}
          <Panel icon={<Filter className="h-4 w-4 text-cyan-400" />} title="Escopo">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Empresa">
                <select
                  value={cfg.empresaId}
                  onChange={(e) => setCfg((c) => ({ ...c, empresaId: e.target.value }))}
                  style={{ colorScheme: 'dark' }}
                  className="w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]"
                >
                  <option value="">— selecione —</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
              </Field>
              <Field label="Período">
                <select
                  value={cfg.periodo}
                  onChange={(e) => setCfg((c) => ({ ...c, periodo: e.target.value as Periodo }))}
                  style={{ colorScheme: 'dark' }}
                  className="w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]"
                >
                  {PERIODO_LABELS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </Field>
              {cfg.periodo === 'custom' && (
                <>
                  <Field label="De">
                    <input
                      type="date"
                      value={cfg.customFrom ?? ''}
                      onChange={(e) => setCfg((c) => ({ ...c, customFrom: e.target.value }))}
                      style={{ colorScheme: 'dark' }}
                      className="w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]"
                    />
                  </Field>
                  <Field label="Até">
                    <input
                      type="date"
                      value={cfg.customTo ?? ''}
                      onChange={(e) => setCfg((c) => ({ ...c, customTo: e.target.value }))}
                      style={{ colorScheme: 'dark' }}
                      className="w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]"
                    />
                  </Field>
                </>
              )}
              <Field label="Comparar com">
                <select
                  value={cfg.comparePeriod}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, comparePeriod: e.target.value as 'previous' | 'none' }))
                  }
                  style={{ colorScheme: 'dark' }}
                  className="w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]"
                >
                  <option value="previous">Período anterior</option>
                  <option value="none">Sem comparação</option>
                </select>
              </Field>
              <Field label="Tipo de lead">
                <select
                  value={cfg.filterTipo ?? 'todos'}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, filterTipo: e.target.value as ReportConfig['filterTipo'] }))
                  }
                  style={{ colorScheme: 'dark' }}
                  className="w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]"
                >
                  <option value="todos">Todos</option>
                  <option value="Cadastro">Apenas Cadastro</option>
                  <option value="Resgate">Apenas Resgate</option>
                </select>
              </Field>
              <Field label="Filtro de responsável">
                <select
                  value={cfg.filterResponsavel ?? ''}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, filterResponsavel: e.target.value || undefined }))
                  }
                  style={{ colorScheme: 'dark' }}
                  className="w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]"
                >
                  <option value="">Todos</option>
                  {responsaveisDisponiveis.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Filtro de origem">
                <select
                  value={cfg.filterOrigem ?? ''}
                  onChange={(e) => setCfg((c) => ({ ...c, filterOrigem: e.target.value || undefined }))}
                  style={{ colorScheme: 'dark' }}
                  className="w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]"
                >
                  <option value="">Todas</option>
                  {origensDisponiveis.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Panel>

          {/* Estilo */}
          <Panel icon={<Settings className="h-4 w-4 text-cyan-400" />} title="Estilo & formato">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Destinatário">
                <select
                  value={cfg.destinatario}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, destinatario: e.target.value as ReportConfig['destinatario'] }))
                  }
                  style={{ colorScheme: 'dark' }}
                  className="w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]"
                >
                  <option value="equipe">Equipe</option>
                  <option value="gestor">Gestor</option>
                  <option value="socios">Sócios</option>
                  <option value="cliente">Cliente final</option>
                </select>
              </Field>
              <Field label="Tom">
                <div className="grid grid-cols-3 gap-1 h-10 rounded-xl bg-[#0c0d10] border border-white/[0.05] p-0.5">
                  {(['formal', 'casual', 'direto'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setCfg((c) => ({ ...c, tom: t }))}
                      className={cn(
                        'rounded-lg text-[12px] font-medium transition-colors capitalize',
                        cfg.tom === t ? 'bg-cyan-400 text-slate-900' : 'text-white/55 hover:text-white',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Verbosidade">
                <div className="grid grid-cols-3 gap-1 h-10 rounded-xl bg-[#0c0d10] border border-white/[0.05] p-0.5">
                  {(['compacto', 'medio', 'detalhado'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setCfg((c) => ({ ...c, verbosidade: v }))}
                      className={cn(
                        'rounded-lg text-[12px] font-medium transition-colors capitalize',
                        cfg.verbosidade === v ? 'bg-cyan-400 text-slate-900' : 'text-white/55 hover:text-white',
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Formato">
                <div className="grid grid-cols-3 gap-1 h-10 rounded-xl bg-[#0c0d10] border border-white/[0.05] p-0.5">
                  {(['whatsapp', 'plain', 'markdown'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setCfg((c) => ({ ...c, formato: f }))}
                      className={cn(
                        'rounded-lg text-[12px] font-medium transition-colors capitalize',
                        cfg.formato === f ? 'bg-cyan-400 text-slate-900' : 'text-white/55 hover:text-white',
                      )}
                    >
                      {f === 'plain' ? 'Texto' : f === 'whatsapp' ? 'WhatsApp' : 'Markdown'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Top N (rankings)">
                <div className="grid grid-cols-4 gap-1 h-10 rounded-xl bg-[#0c0d10] border border-white/[0.05] p-0.5">
                  {[3, 5, 10, -1].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCfg((c) => ({ ...c, topN: n }))}
                      className={cn(
                        'rounded-lg text-[12px] font-medium transition-colors',
                        cfg.topN === n ? 'bg-cyan-400 text-slate-900' : 'text-white/55 hover:text-white',
                      )}
                    >
                      {n === -1 ? 'Tudo' : `Top ${n}`}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Emojis">
                <button
                  onClick={() => setCfg((c) => ({ ...c, emojis: !c.emojis }))}
                  className={cn(
                    'h-10 px-3 rounded-xl border text-[13px] font-medium transition-colors',
                    cfg.emojis
                      ? 'bg-cyan-400/10 border-cyan-400/40 text-cyan-200'
                      : 'bg-[#0c0d10] border-white/[0.05] text-white/55 hover:text-white',
                  )}
                >
                  {cfg.emojis ? '✓ Com emojis' : 'Sem emojis'}
                </button>
              </Field>
              <Field label="Saudação personalizada (opcional)" span={2}>
                <input
                  value={cfg.saudacao}
                  onChange={(e) => setCfg((c) => ({ ...c, saudacao: e.target.value }))}
                  placeholder="Deixe em branco pra usar a saudação padrão do destinatário"
                  className="w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]"
                />
              </Field>
            </div>
          </Panel>

          {/* Sections */}
          <Panel
            icon={
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            }
            title="Seções do relatório"
            subtitle={`${Object.values(cfg.sections).filter(Boolean).length} de ${Object.keys(cfg.sections).length} ativas`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(Object.entries(SECTION_LABELS) as [keyof ReportSections, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => updateSection(key, !cfg.sections[key])}
                  className={cn(
                    'flex items-center gap-2.5 px-3 h-10 rounded-xl border text-[13px] text-left transition-colors',
                    cfg.sections[key]
                      ? 'bg-cyan-400/[0.08] border-cyan-400/30 text-white'
                      : 'bg-[#0c0d10] border-white/[0.05] text-white/55 hover:text-white hover:border-white/[0.12]',
                  )}
                >
                  <span
                    className={cn(
                      'h-4 w-4 rounded grid place-items-center shrink-0',
                      cfg.sections[key] ? 'bg-cyan-400 text-slate-900' : 'border border-white/15',
                    )}
                  >
                    {cfg.sections[key] && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
              <button
                onClick={() =>
                  setCfg((c) => ({
                    ...c,
                    sections: Object.fromEntries(Object.keys(c.sections).map((k) => [k, true])) as unknown as ReportSections,
                  }))
                }
                className="px-2.5 h-7 rounded-lg bg-[#0c0d10] border border-white/[0.05] text-white/65 hover:text-white"
              >
                Marcar tudo
              </button>
              <button
                onClick={() =>
                  setCfg((c) => ({
                    ...c,
                    sections: Object.fromEntries(Object.keys(c.sections).map((k) => [k, false])) as unknown as ReportSections,
                  }))
                }
                className="px-2.5 h-7 rounded-lg bg-[#0c0d10] border border-white/[0.05] text-white/65 hover:text-white"
              >
                Desmarcar tudo
              </button>
            </div>
          </Panel>
        </div>

        {/* RIGHT: preview + ações */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Panel icon={<Smartphone className="h-4 w-4 text-cyan-400" />} title="Preview no celular">
            <PhonePreview text={reportText} />
            <p className="mt-3 text-[11px] text-white/45 tabular-nums text-center">
              {charCount.toLocaleString('pt-BR')} caracteres · {lineCount} linhas
            </p>
          </Panel>

          <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-4 space-y-2">
            {/* Ação primária: enviar relatório com imagem do dashboard */}
            <button
              onClick={handleShareWithImage}
              disabled={capturing}
              className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-[14px] font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
            >
              {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              {capturing ? 'Capturando dashboard…' : 'Enviar c/ imagem (WhatsApp)'}
            </button>
            <p className="text-[11px] text-white/45 text-center px-2">
              Anexa automaticamente a imagem do dashboard ao relatório.
            </p>

            <div className="h-px bg-white/[0.05] my-2" />

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopy}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-[12px] font-semibold transition-colors',
                  copied ? 'bg-emerald-400 text-slate-900' : 'bg-cyan-400 hover:bg-cyan-300 text-slate-900',
                )}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado!' : 'Copiar texto'}
              </button>
              <button
                onClick={handleDownloadImage}
                disabled={capturing}
                className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-[#0c0d10] border border-white/[0.08] text-white/85 text-[12px] font-semibold hover:text-white hover:border-white/[0.18] disabled:opacity-60"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Baixar imagem
              </button>
            </div>
            <button
              onClick={handleShareWhatsApp}
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-white/65 text-[12px] hover:text-white"
            >
              Só texto (sem imagem)
            </button>
            <button
              onClick={handleDownload}
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-white/65 text-[12px] hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar .txt
            </button>

            {captureMsg && (
              <p className="text-[11px] text-cyan-300 bg-cyan-500/[0.08] border border-cyan-400/25 rounded-lg px-3 py-2 mt-2">
                {captureMsg}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard embedado — capturado como imagem no envio */}
      <div className="mt-8">
        <Panel
          icon={<ImageIcon className="h-4 w-4 text-cyan-400" />}
          title="Imagem do dashboard que será enviada"
          subtitle="Atualiza em tempo real conforme os dados"
        >
          <p className="text-[12px] text-white/55 mb-3">
            Esta visão é capturada automaticamente quando você clica em <strong className="text-white">Enviar c/ imagem</strong>. Ajuste os filtros do dashboard normalmente — o que você vê aqui é o que vai pro WhatsApp.
          </p>
          <div
            ref={dashboardRef}
            className="rounded-2xl overflow-hidden bg-[#0c0d10] border border-white/[0.05]"
          >
            <DashboardView />
          </div>
        </Panel>
      </div>
    </motion.div>
  )
}

// =================== Sub-componentes ===================

function Panel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-5">
      <header className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {subtitle && <span className="text-[11px] text-white/45">{subtitle}</span>}
      </header>
      {children}
    </section>
  )
}

function Field({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: 1 | 2 }) {
  return (
    <div className={cn('flex flex-col gap-1.5', span === 2 && 'md:col-span-2')}>
      <label className="text-[11px] uppercase tracking-wider text-white/55">{label}</label>
      {children}
    </div>
  )
}

// Renderiza o texto formatado do WhatsApp com *negrito*, _itálico_ e quebras
function renderWhatsAppMarkup(text: string): React.ReactNode {
  // Quebra em parágrafos primeiro pra preservar layout
  const lines = text.split('\n')
  return lines.map((line, i) => (
    <span key={i}>
      {parseInline(line)}
      {i < lines.length - 1 && <br />}
    </span>
  ))
}

function parseInline(line: string): React.ReactNode {
  // *bold* and _italic_
  const parts: React.ReactNode[] = []
  const regex = /(\*[^*\n]+\*|_[^_\n]+_|\*\*[^*\n]+\*\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index))
    const m = match[0]
    if (m.startsWith('**') && m.endsWith('**')) {
      parts.push(<strong key={i++} className="font-semibold">{m.slice(2, -2)}</strong>)
    } else if (m.startsWith('*') && m.endsWith('*')) {
      parts.push(<strong key={i++} className="font-semibold">{m.slice(1, -1)}</strong>)
    } else if (m.startsWith('_') && m.endsWith('_')) {
      parts.push(<em key={i++}>{m.slice(1, -1)}</em>)
    } else {
      parts.push(m)
    }
    lastIndex = match.index + m.length
  }
  if (lastIndex < line.length) parts.push(line.slice(lastIndex))
  return parts
}

function PhonePreview({ text }: { text: string }) {
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="mx-auto" style={{ maxWidth: 320 }}>
      <div
        className="relative rounded-[42px] p-2 shadow-2xl"
        style={{ background: 'linear-gradient(180deg, #1f2937 0%, #0b0d10 100%)' }}
      >
        {/* Notch */}
        <div className="relative h-6 grid place-items-center">
          <div className="h-5 w-28 rounded-2xl bg-black" />
        </div>
        <div className="rounded-[34px] overflow-hidden bg-[#0a0e10] flex flex-col" style={{ height: 560 }}>
          {/* Status bar */}
          <div className="h-7 px-5 flex items-center justify-between text-[11px] text-white/85 bg-[#0a0e10] tabular-nums">
            <span>{time}</span>
            <div className="flex items-center gap-1">
              <span>●●●</span>
              <span>📶</span>
              <span>🔋</span>
            </div>
          </div>
          {/* WhatsApp header */}
          <div className="px-3 h-12 flex items-center gap-3 border-b border-white/5"
            style={{ background: '#1f2c33' }}>
            <div className="h-8 w-8 rounded-full bg-cyan-500/30 grid place-items-center text-[13px] font-bold text-cyan-200">
              R
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white font-medium truncate">Relatório do período</p>
              <p className="text-[10px] text-white/55">online</p>
            </div>
          </div>
          {/* Chat body */}
          <div
            className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
            style={{
              background:
                'radial-gradient(circle at 30% 20%, rgba(34,211,238,0.04), transparent 40%), #0a141a',
            }}
          >
            <div className="flex justify-end">
              <div
                className="relative rounded-2xl rounded-tr-sm px-3 py-2 max-w-[88%] shadow-md"
                style={{ background: '#005c4b' }}
              >
                <div className="text-[12.5px] text-white/95 leading-relaxed whitespace-pre-wrap break-words font-mono">
                  {renderWhatsAppMarkup(text)}
                </div>
                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-white/55">
                  <span>{time}</span>
                  <span className="text-cyan-300">✓✓</span>
                </div>
              </div>
            </div>
          </div>
          {/* Input */}
          <div className="h-11 px-3 flex items-center gap-2 border-t border-white/5" style={{ background: '#1f2c33' }}>
            <div className="flex-1 h-7 rounded-full bg-[#2a3942] flex items-center px-3 text-[11px] text-white/35">
              Mensagem
            </div>
            <div className="h-7 w-7 rounded-full bg-emerald-500 grid place-items-center text-white text-[12px]">
              ➤
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

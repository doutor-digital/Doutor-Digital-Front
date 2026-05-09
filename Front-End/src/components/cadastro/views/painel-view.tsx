
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Layers,
  Plug2,
  ScrollText,
  Users as UsersIcon,
  ClipboardCheck,
  HeartPulse,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  CalendarRange,
  Download,
  CheckCircle2,
} from 'lucide-react'
import {
  auditApi,
  empresasApi,
  kommoApi,
  leadsApi,
  isBackendNotImplemented,
  type AuditLogEntryDto,
  type EmpresaDto,
  type KommoConfigDto,
  type KommoInboxItemDto,
  type KommoPipelineDto,
  type LeadsStatsResponse,
} from '@/lib/cadastra/api'
import { cn } from '@/lib/utils'

interface PainelViewProps {
  onBack: () => void
  onNavigateLogs: () => void
  onNavigateKommo: () => void
  onNavigateLeads: () => void
}

function startOfRange(range: 'hoje' | '7d' | '30d'): Date {
  const now = new Date()
  if (range === 'hoje') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (range === '7d') return new Date(now.getTime() - 7 * 86_400_000)
  return new Date(now.getTime() - 30 * 86_400_000)
}

function previousRange(range: 'hoje' | '7d' | '30d'): { from: Date; to: Date } {
  const start = startOfRange(range)
  const span = Date.now() - start.getTime()
  return { from: new Date(start.getTime() - span), to: start }
}

type SyncPreset = 'hoje' | 'ontem' | 'semana' | '30d' | 'mes' | 'tudo' | 'incremental'

function syncRangeForPreset(
  preset: SyncPreset,
  lastSyncAt?: string | null,
): { from?: string; to?: string; label: string } {
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
  switch (preset) {
    case 'hoje':
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString(), label: 'Hoje' }
    case 'ontem': {
      const y = new Date(now); y.setDate(y.getDate() - 1)
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString(), label: 'Ontem' }
    }
    case 'semana': {
      const s = new Date(now); s.setDate(s.getDate() - 6)
      return { from: startOfDay(s).toISOString(), to: endOfDay(now).toISOString(), label: 'Esta semana' }
    }
    case '30d': {
      const s = new Date(now); s.setDate(s.getDate() - 29)
      return { from: startOfDay(s).toISOString(), to: endOfDay(now).toISOString(), label: 'Últimos 30 dias' }
    }
    case 'mes': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: s.toISOString(), to: endOfDay(now).toISOString(), label: 'Mês atual' }
    }
    case 'incremental': {
      // #2: usa o lastSyncAt do config como ponto de partida. Se não houver, cai pra "hoje".
      if (!lastSyncAt) {
        return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString(), label: 'Novos (sem histórico — hoje)' }
      }
      return { from: lastSyncAt, label: 'Novos desde último sync' }
    }
    case 'tudo':
    default:
      return { label: 'Todos os leads' }
  }
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d} d`
  return `há ${Math.floor(d / 30)} mês${Math.floor(d / 30) === 1 ? '' : 'es'}`
}

export function PainelView({
  onBack,
  onNavigateLogs,
  onNavigateKommo,
  onNavigateLeads,
}: PainelViewProps) {
  const [empresas, setEmpresas] = useState<EmpresaDto[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [range, setRange] = useState<'hoje' | '7d' | '30d'>('hoje')

  const [stats, setStats] = useState<LeadsStatsResponse | null>(null)
  const [audit, setAudit] = useState<AuditLogEntryDto[]>([])
  const [kommoConfig, setKommoConfig] = useState<KommoConfigDto | null>(null)
  const [kommoInbox, setKommoInbox] = useState<KommoInboxItemDto[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [syncBusy, setSyncBusy] = useState<SyncPreset | null>(null)
  const [syncFeedback, setSyncFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const [pipelines, setPipelines] = useState<KommoPipelineDto[]>([])
  const [pipelinesSupported, setPipelinesSupported] = useState(true)
  const [pipelineId, setPipelineId] = useState<number | ''>('')
  const [statusIds, setStatusIds] = useState<number[]>([])

  // Empresas
  useEffect(() => {
    empresasApi
      .list()
      .then((list) => {
        setEmpresas(list)
        setEmpresaId((prev) => prev || list[0]?.id || '')
      })
      .catch(() => {})
  }, [])

  // Carrega tudo em paralelo quando empresa/range muda
  useEffect(() => {
    if (!empresaId) return
    let cancelled = false
    setLoading(true)
    const start = startOfRange(range).toISOString()
    const prev = previousRange(range)

    Promise.all([
      leadsApi.stats(empresaId, {
        from: startOfRange(range).toISOString(),
        to: new Date().toISOString(),
        prevFrom: prev.from.toISOString(),
        prevTo: prev.to.toISOString(),
      }).catch(() => null),
      auditApi.list(empresaId, { from: start, pageSize: 50 }).catch(() => null),
      kommoApi.getConfig(empresaId).catch(() => null),
      kommoApi.inbox(empresaId).catch(() => []),
    ]).then(([s, a, cfg, inbox]) => {
      if (cancelled) return
      setStats(s)
      setAudit(a?.items ?? [])
      setKommoConfig(cfg)
      setKommoInbox(inbox ?? [])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [empresaId, range, refreshTick])

  // Pipelines da Kommo — só carrega quando há config. 404 = endpoint pendente no backend.
  useEffect(() => {
    if (!empresaId || !kommoConfig?.hasToken) {
      setPipelines([])
      return
    }
    kommoApi
      .pipelines(empresaId)
      .then((list) => {
        setPipelines(list ?? [])
        setPipelinesSupported(true)
      })
      .catch((err) => {
        if (isBackendNotImplemented(err)) setPipelinesSupported(false)
        setPipelines([])
      })
  }, [empresaId, kommoConfig?.hasToken])

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId],
  )

  // Quando troca de pipeline, mantém só os status válidos.
  useEffect(() => {
    if (!selectedPipeline) {
      setStatusIds([])
      return
    }
    const valid = new Set(selectedPipeline.statuses.map((s) => s.id))
    setStatusIds((prev) => prev.filter((id) => valid.has(id)))
  }, [selectedPipeline])

  async function runQuickSync(preset: SyncPreset) {
    if (!empresaId) return
    if (!kommoConfig?.hasToken) {
      setSyncFeedback({ kind: 'error', msg: 'Configure o token da Kommo na aba Kommo antes de sincronizar.' })
      return
    }
    setSyncBusy(preset)
    setSyncFeedback(null)
    try {
      const r = syncRangeForPreset(preset, kommoConfig?.lastSyncAt)
      const res = await kommoApi.sync(empresaId, {
        limit: 100,
        createdAtFrom: r.from,
        createdAtTo: r.to,
        since: preset === 'incremental' ? kommoConfig?.lastSyncAt ?? undefined : undefined,
        pipelineId: pipelineId === '' ? undefined : pipelineId,
        statusIds: statusIds.length > 0 ? statusIds : undefined,
      })
      const filterLabel = selectedPipeline
        ? ` · pipeline ${selectedPipeline.name}${statusIds.length ? ` (${statusIds.length} status)` : ''}`
        : ''
      setSyncFeedback({
        kind: 'success',
        msg: `Sync (${r.label.toLowerCase()}${filterLabel}): ${res.received} recebidos, ${res.stored} novos na inbox.`,
      })
      setRefreshTick((t) => t + 1)
    } catch (err) {
      setSyncFeedback({
        kind: 'error',
        msg: err instanceof Error ? err.message : 'Falha ao sincronizar com a Kommo.',
      })
    } finally {
      setSyncBusy(null)
    }
  }

  const pendingKommo = useMemo(
    () => kommoInbox.filter((i) => i.status === 'pending'),
    [kommoInbox],
  )
  const importedKommo = useMemo(
    () => kommoInbox.filter((i) => i.status === 'imported'),
    [kommoInbox],
  )

  const cur = stats?.current
  const prev = stats?.previous

  return (
    <motion.div
      className="px-8 py-8 max-w-7xl mx-auto"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-[#15171b] border border-white/5 text-[13px] text-white/70 hover:text-white hover:border-white/12 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Voltar para Dashboard
        </button>
        <div className="flex items-center gap-2">
          {empresas.length > 1 && (
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className="h-9 px-3 rounded-xl bg-[#15171b] border border-white/10 text-[13px] text-white focus:outline-none focus:border-cyan-400/50"
            >
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome}
                </option>
              ))}
            </select>
          )}
          <div className="inline-flex rounded-xl border border-white/10 bg-[#15171b] overflow-hidden">
            {(['hoje', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'px-3 h-9 text-[12px] font-semibold transition-colors',
                  range === r
                    ? 'bg-cyan-500/15 text-cyan-200'
                    : 'text-white/55 hover:text-white hover:bg-white/[0.04]',
                )}
              >
                {r === 'hoje' ? 'Hoje' : r === '7d' ? '7 dias' : '30 dias'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-[13px] text-white/70 hover:text-white hover:border-white/20 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Hero */}
      <div
        className="rounded-3xl p-7 mb-5 text-cyan-50"
        style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 60%, #075985 100%)' }}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/15 grid place-items-center">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[12px] uppercase tracking-[0.2em] text-cyan-100/85 mb-1">Painel unificado</p>
            <h1 className="text-[28px] font-bold tracking-tight leading-none">
              Cadastro · Kommo · Doutor-Digital-Front
            </h1>
            <p className="text-[13px] text-cyan-100/85 mt-2">
              Os 3 sistemas conversando entre si: o Cadastro (substituto da planilha) consome leads vindos da
              Kommo; o Doutor-Digital-Front consome a mesma base via <code className="text-white/95">CadastraAi.API</code> para análise visual.
            </p>
          </div>
          <span className="text-[11px] uppercase tracking-wider font-bold text-white bg-white/15 border border-white/20 px-3 py-1 rounded-full">
            {range === 'hoje' ? 'Hoje' : range === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'}
          </span>
        </div>
      </div>

      {/* Sync rápido por data — chama kommoApi.sync direto da Kommo */}
      <QuickSyncCard
        configured={!!kommoConfig?.hasToken}
        busy={syncBusy}
        feedback={syncFeedback}
        onRun={runQuickSync}
        onConfigure={onNavigateKommo}
        lastSyncAt={kommoConfig?.lastSyncAt ?? null}
        pipelines={pipelines}
        pipelinesSupported={pipelinesSupported}
        pipelineId={pipelineId}
        statusIds={statusIds}
        onPipelineChange={setPipelineId}
        onStatusToggle={(id, checked) =>
          setStatusIds((prev) => (checked ? [...prev, id] : prev.filter((s) => s !== id)))
        }
        onClearPipeline={() => {
          setPipelineId('')
          setStatusIds([])
        }}
      />

      {/* Sistemas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <SystemCard
          icon={UsersIcon}
          accent="cyan"
          title="Cadastro"
          subtitle="Substituto da planilha"
          status={stats ? 'ok' : 'loading'}
          metrics={
            cur
              ? [
                  { label: 'Leads', value: cur.leads, prev: prev?.leads ?? 0 },
                  { label: 'Compareceram', value: cur.compareceram, prev: prev?.compareceram ?? 0 },
                  { label: 'Fecharam', value: cur.fecharam, prev: prev?.fecharam ?? 0 },
                ]
              : []
          }
          cta={{ label: 'Ver leads', onClick: onNavigateLeads }}
        />
        <SystemCard
          icon={Plug2}
          accent="violet"
          title="Kommo"
          subtitle={kommoConfig?.hasToken ? 'Conectado' : 'Desconectado'}
          status={kommoConfig?.hasToken ? 'ok' : 'warn'}
          metrics={[
            { label: 'Pendentes', value: pendingKommo.length, prev: 0, hideDelta: true },
            { label: 'Importados', value: importedKommo.length, prev: 0, hideDelta: true },
            { label: 'Total inbox', value: kommoInbox.length, prev: 0, hideDelta: true },
          ]}
          cta={{ label: 'Abrir Kommo', onClick: onNavigateKommo }}
        />
        <SystemCard
          icon={TrendingUp}
          accent="emerald"
          title="Doutor-Digital-Front"
          subtitle="Análise visual (mock)"
          status="mock"
          metrics={[
            { label: 'KPIs', value: 5, prev: 0, hideDelta: true },
            { label: 'Gráficos', value: 8, prev: 0, hideDelta: true },
            { label: 'Alertas', value: 0, prev: 0, hideDelta: true },
          ]}
          cta={{ label: 'Em breve', disabled: true }}
        />
      </div>

      {/* Funil unificado: Kommo → Lead → Consulta → Tratamento */}
      <div className="rounded-3xl border border-white/5 bg-[#15171b] p-6 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-400/30 grid place-items-center">
            <TrendingUp className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-white">Funil unificado</h3>
            <p className="text-[12px] text-white/55">
              Da chegada via Kommo até o tratamento fechado, no período selecionado.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <FunnelStage
            num={1}
            label="Inbox Kommo"
            value={pendingKommo.length}
            sub="Aguardando promoção"
            color="violet"
          />
          <FunnelArrow />
          <FunnelStage
            num={2}
            label="Leads"
            value={cur?.leads ?? 0}
            sub={`${cur?.leadsImportados ?? 0} importados`}
            color="cyan"
          />
          <FunnelArrow />
          <FunnelStage
            num={3}
            label="Consulta"
            value={cur?.compareceram ?? 0}
            sub={`${cur?.fecharam ?? 0} fecharam`}
            color="emerald"
          />
        </div>
      </div>

      {/* Grid lateral: Kommo pendentes + Atividade recente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Kommo pendentes */}
        <div className="rounded-3xl border border-white/5 bg-[#15171b] overflow-hidden">
          <div className="px-5 h-14 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
              <Plug2 className="h-4 w-4 text-violet-300" />
              <h3 className="text-[14px] font-bold text-white">Kommo: pendentes</h3>
              {pendingKommo.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-200 font-bold tabular-nums">
                  {pendingKommo.length}
                </span>
              )}
            </div>
            <button
              onClick={onNavigateKommo}
              className="text-[12px] font-semibold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
            >
              Ver todos
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          {pendingKommo.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Sparkles className="h-6 w-6 text-white/30 mx-auto mb-2" />
              <p className="text-[13px] text-white/55">
                {kommoConfig?.hasToken ? 'Inbox limpa — nenhum lead pendente.' : 'Kommo não configurado.'}
              </p>
              {!kommoConfig?.hasToken && (
                <button
                  onClick={onNavigateKommo}
                  className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Configurar agora <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {pendingKommo.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="px-5 py-3 hover:bg-white/[0.02] flex items-center gap-3"
                >
                  <div className="h-8 w-8 rounded-lg bg-violet-500/10 border border-violet-400/30 grid place-items-center shrink-0">
                    <Plug2 className="h-3.5 w-3.5 text-violet-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white truncate">
                      {extractDisplayName(item)}
                    </p>
                    <p className="text-[11px] text-white/55 truncate">
                      {item.source === 'webhook' ? 'webhook' : 'sync'} · {dateFmt.format(new Date(item.receivedAt))}
                    </p>
                  </div>
                  <button
                    onClick={onNavigateKommo}
                    className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-0.5"
                  >
                    Resolver
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Atividade recente */}
        <div className="rounded-3xl border border-white/5 bg-[#15171b] overflow-hidden">
          <div className="px-5 h-14 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-cyan-300" />
              <h3 className="text-[14px] font-bold text-white">Atividade recente</h3>
            </div>
            <button
              onClick={onNavigateLogs}
              className="text-[12px] font-semibold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
            >
              Ver tudo
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          {audit.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <ScrollText className="h-6 w-6 text-white/30 mx-auto mb-2" />
              <p className="text-[13px] text-white/55">Nenhum evento no período.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5 max-h-[320px] overflow-y-auto">
              {audit.slice(0, 10).map((event) => (
                <AuditMiniRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Slot do Doutor-Digital-Front mockado */}
      <div className="rounded-3xl border-2 border-dashed border-white/10 bg-[#15171b] p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 grid place-items-center shrink-0">
            <TrendingUp className="h-6 w-6 text-emerald-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[16px] font-bold text-white">Doutor-Digital-Front</h3>
              <span className="text-[10px] uppercase tracking-wider font-bold text-amber-300 bg-amber-500/10 border border-amber-400/30 px-1.5 py-0.5 rounded-md">
                Mock — slot reservado
              </span>
            </div>
            <p className="text-[13px] text-white/65 mb-4">
              O sistema externo de análise visual será carregado aqui, consumindo a mesma{' '}
              <strong>CadastraAi.API</strong>. Endpoints já prontos:{' '}
              <code className="text-cyan-300">/api/empresas/{'{id}'}/leads/stats</code>,{' '}
              <code className="text-cyan-300">/api/empresas/{'{id}'}/audit-log</code> e{' '}
              <code className="text-cyan-300">/api/empresas/{'{id}'}/kommo/inbox</code>.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {['Funil de conversão', 'Receita por origem', 'Heatmap de fechamento', 'Cohort de retenção'].map((label) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-[#0c0d10] p-3 text-center"
                >
                  <div className="h-12 grid place-items-center text-white/30">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-[11px] text-white/55">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function QuickSyncCard({
  configured,
  busy,
  feedback,
  onRun,
  onConfigure,
  lastSyncAt,
  pipelines,
  pipelinesSupported,
  pipelineId,
  statusIds,
  onPipelineChange,
  onStatusToggle,
  onClearPipeline,
}: {
  configured: boolean
  busy: SyncPreset | null
  feedback: { kind: 'success' | 'error'; msg: string } | null
  onRun: (preset: SyncPreset) => void
  onConfigure: () => void
  lastSyncAt: string | null
  pipelines: KommoPipelineDto[]
  pipelinesSupported: boolean
  pipelineId: number | ''
  statusIds: number[]
  onPipelineChange: (id: number | '') => void
  onStatusToggle: (id: number, checked: boolean) => void
  onClearPipeline: () => void
}) {
  const presets: { id: SyncPreset; label: string; hint: string }[] = [
    { id: 'hoje', label: 'Hoje', hint: 'Leads criados hoje' },
    { id: 'ontem', label: 'Ontem', hint: 'Apenas o dia de ontem' },
    { id: 'semana', label: 'Esta semana', hint: 'Últimos 7 dias' },
    { id: '30d', label: '30 dias', hint: 'Últimos 30 dias' },
    { id: 'mes', label: 'Mês', hint: 'Mês corrente, do dia 1 até hoje' },
    { id: 'tudo', label: 'Tudo', hint: 'Sem filtro de data — pode demorar' },
  ]
  const selectedPipeline = pipelines.find((p) => p.id === pipelineId) ?? null
  return (
    <div className="rounded-3xl border border-white/5 bg-[#15171b] p-6 mb-5">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-400/30 grid place-items-center">
          <CalendarRange className="h-5 w-5 text-cyan-300" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <h3 className="text-[15px] font-bold text-white">Sincronizar Kommo por data</h3>
          <p className="text-[12px] text-white/55">
            Puxa leads pelo <code className="text-cyan-300">created_at</code> da Kommo via{' '}
            <strong>CadastraAi.API</strong>. Os novos caem na inbox para serem promovidos.
          </p>
        </div>
        {lastSyncAt && (
          <span className="text-[11px] text-white/55">
            Último sync: <span className="text-white/85">{relativeTime(lastSyncAt)}</span>
          </span>
        )}
      </div>

      {!configured && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.05] px-3 py-2 mb-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[12px] text-amber-100/90">
              Kommo ainda não está conectada para esta empresa.
            </p>
          </div>
          <button
            onClick={onConfigure}
            className="text-[11px] font-semibold text-amber-200 hover:text-amber-100 inline-flex items-center gap-0.5"
          >
            Configurar <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* #2: botão incremental — destaque, antes dos presets de período */}
      <button
        onClick={() => onRun('incremental')}
        disabled={!configured || busy !== null}
        title={lastSyncAt ? `Puxa apenas leads novos desde ${new Date(lastSyncAt).toLocaleString('pt-BR')}` : 'Sem histórico — vai puxar de hoje'}
        className={cn(
          'w-full mb-3 h-12 px-4 rounded-xl border text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-colors',
          !configured || busy !== null
            ? busy === 'incremental'
              ? 'bg-cyan-500/15 text-cyan-200 border-cyan-400/40'
              : 'bg-[#0c0d10] text-white/30 border-white/5 cursor-not-allowed'
            : 'bg-cyan-500/10 text-cyan-200 border-cyan-400/40 hover:bg-cyan-500/20',
        )}
      >
        {busy === 'incremental' ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Sincronizar novos {lastSyncAt ? `desde ${relativeTime(lastSyncAt)}` : '(sem histórico — usa hoje)'}
      </button>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {presets.map((p) => {
          const isBusy = busy === p.id
          const disabled = !configured || busy !== null
          return (
            <button
              key={p.id}
              onClick={() => onRun(p.id)}
              disabled={disabled}
              title={p.hint}
              className={cn(
                'h-12 px-3 rounded-xl border text-[12px] font-semibold inline-flex items-center justify-center gap-2 transition-colors',
                disabled && !isBusy
                  ? 'bg-[#0c0d10] text-white/30 border-white/5 cursor-not-allowed'
                  : isBusy
                    ? 'bg-cyan-500/15 text-cyan-200 border-cyan-400/40'
                    : 'bg-[#0c0d10] text-white/75 border-white/10 hover:text-white hover:border-cyan-400/40 hover:bg-cyan-500/4',
              )}
            >
              {isBusy ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 opacity-70" />
              )}
              {p.label}
            </button>
          )
        })}
      </div>

      {/* #1: filtro pipeline + status. Aparece colapsado, expande com chevron. */}
      {configured && (
        <details className="mt-3 group">
          <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/55 hover:text-white/85 select-none">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
            Filtrar por pipeline / status
            {(pipelineId !== '' || statusIds.length > 0) && (
              <span className="ml-1 text-[10px] font-bold text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded">
                {pipelineId !== '' ? '1 pipeline' : ''}
                {pipelineId !== '' && statusIds.length > 0 ? ' · ' : ''}
                {statusIds.length > 0 ? `${statusIds.length} status` : ''}
              </span>
            )}
          </summary>
          <div className="mt-3 rounded-2xl border border-white/5 bg-[#0c0d10] p-4">
            {!pipelinesSupported ? (
              <div className="flex items-start gap-2 text-[11px] text-amber-100/85">
                <AlertCircle className="h-3.5 w-3.5 text-amber-300 shrink-0 mt-0.5" />
                <p>
                  Endpoint <code className="text-amber-300">GET /kommo/pipelines</code> ainda pendente em{' '}
                  <strong>CadastraAi.API</strong>. Sem ele, o sync busca de todos os pipelines.
                </p>
              </div>
            ) : pipelines.length === 0 ? (
              <p className="text-[11px] text-white/45">Nenhum pipeline retornado pela Kommo ainda.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Pipeline</label>
                  <div className="mt-1 flex gap-2">
                    <select
                      value={pipelineId}
                      onChange={(e) => onPipelineChange(e.target.value ? Number(e.target.value) : '')}
                      className="flex-1 h-9 px-3 rounded-lg bg-[#15171b] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50"
                    >
                      <option value="">Todos os pipelines</option>
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.isMain ? ' (principal)' : ''}
                        </option>
                      ))}
                    </select>
                    {(pipelineId !== '' || statusIds.length > 0) && (
                      <button
                        onClick={onClearPipeline}
                        className="px-2 h-9 rounded-lg border border-white/10 bg-white/[0.03] text-[11px] text-white/65 hover:text-white"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
                    Status {statusIds.length > 0 && <span className="text-cyan-300 ml-1">({statusIds.length})</span>}
                  </label>
                  {!selectedPipeline ? (
                    <p className="mt-1 text-[11px] text-white/45 h-9 px-3 grid items-center rounded-lg bg-[#15171b] border border-dashed border-white/10">
                      Selecione um pipeline.
                    </p>
                  ) : (
                    <div className="mt-1 max-h-28 overflow-y-auto rounded-lg bg-[#15171b] border border-white/10 p-1.5 space-y-0.5">
                      {selectedPipeline.statuses.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/3 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={statusIds.includes(s.id)}
                            onChange={(e) => onStatusToggle(s.id, e.target.checked)}
                            className="accent-cyan-500"
                          />
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color || '#666' }} />
                          <span className="text-[11px] text-white/85 truncate">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {feedback && (
        <div
          className={cn(
            'mt-3 rounded-xl border px-3 py-2 flex items-start gap-2 text-[12px]',
            feedback.kind === 'success'
              ? 'border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200'
              : 'border-rose-400/30 bg-rose-500/[0.06] text-rose-200',
          )}
        >
          {feedback.kind === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <p className="flex-1">{feedback.msg}</p>
        </div>
      )}
    </div>
  )
}

function extractDisplayName(item: KommoInboxItemDto): string {
  try {
    const parsed = JSON.parse(item.raw)
    const lead = parsed?.lead ?? parsed
    return (
      lead?.name ??
      parsed?.contact?.name ??
      `Kommo #${item.kommoLeadId ?? item.id.slice(0, 6)}`
    )
  } catch {
    return `Item #${item.id.slice(0, 8)}`
  }
}

const ACCENT_PALETTE = {
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-300', border: 'border-cyan-400/30', dot: 'bg-cyan-400' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-300', border: 'border-violet-400/30', dot: 'bg-violet-400' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-400/30', dot: 'bg-emerald-400' },
} as const

function SystemCard({
  icon: Icon,
  accent,
  title,
  subtitle,
  status,
  metrics,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>
  accent: keyof typeof ACCENT_PALETTE
  title: string
  subtitle: string
  status: 'ok' | 'warn' | 'mock' | 'loading'
  metrics: { label: string; value: number; prev: number; hideDelta?: boolean }[]
  cta: { label: string; onClick?: () => void; disabled?: boolean }
}) {
  const palette = ACCENT_PALETTE[accent]
  return (
    <div className={cn('rounded-3xl border bg-[#15171b] p-5', palette.border)}>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('h-10 w-10 rounded-xl border grid place-items-center', palette.bg, palette.border)}>
          <Icon className={cn('h-5 w-5', palette.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-white truncate">{title}</h3>
          <p className="text-[11px] text-white/55 truncate">{subtitle}</p>
        </div>
        <StatusDot status={status} />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {metrics.map((m, i) => (
          <Metric key={i} label={m.label} value={m.value} prev={m.prev} hideDelta={m.hideDelta} />
        ))}
      </div>
      <button
        onClick={cta.onClick}
        disabled={cta.disabled}
        className={cn(
          'w-full inline-flex items-center justify-between gap-2 h-10 px-3 rounded-xl text-[13px] font-semibold transition-colors',
          cta.disabled
            ? 'bg-white/[0.03] text-white/35 cursor-not-allowed'
            : `${palette.bg} ${palette.text} hover:bg-white/[0.06]`,
        )}
      >
        <span>{cta.label}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function StatusDot({ status }: { status: 'ok' | 'warn' | 'mock' | 'loading' }) {
  if (status === 'loading') return <div className="h-2 w-2 rounded-full bg-white/30 animate-pulse" />
  if (status === 'warn') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-amber-300">
        <AlertCircle className="h-3 w-3" />
        Atenção
      </span>
    )
  }
  if (status === 'mock') {
    return (
      <span className="text-[9px] uppercase tracking-wider font-bold text-amber-300 bg-amber-500/10 border border-amber-400/30 px-1.5 py-0.5 rounded">
        Mock
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Ativo
    </span>
  )
}

function Metric({ label, value, prev, hideDelta }: { label: string; value: number; prev: number; hideDelta?: boolean }) {
  const delta = prev === 0 ? null : value - prev
  const deltaPercent = prev === 0 ? null : ((value - prev) / prev) * 100
  return (
    <div className="rounded-xl bg-[#0c0d10] border border-white/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold truncate">{label}</p>
      <p className="text-[18px] font-bold tabular-nums text-white">{value}</p>
      {!hideDelta && delta !== null && deltaPercent !== null && (
        <p
          className={cn(
            'text-[10px] tabular-nums inline-flex items-center gap-0.5',
            delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-white/45',
          )}
        >
          {delta > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : delta < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
          {deltaPercent > 0 ? '+' : ''}{deltaPercent.toFixed(0)}%
        </p>
      )}
    </div>
  )
}

function FunnelStage({
  num,
  label,
  value,
  sub,
  color,
}: {
  num: number
  label: string
  value: number
  sub: string
  color: 'cyan' | 'violet' | 'emerald'
}) {
  const palette = ACCENT_PALETTE[color]
  return (
    <div className={cn('rounded-2xl border bg-[#0c0d10] p-4 col-span-1', palette.border)}>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold', palette.bg, palette.text)}>
          {num}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">{label}</span>
      </div>
      <p className={cn('text-[28px] font-bold tabular-nums leading-none', palette.text)}>{value}</p>
      <p className="text-[11px] text-white/45 mt-1.5">{sub}</p>
    </div>
  )
}

function FunnelArrow() {
  return (
    <div className="hidden md:flex items-center justify-center col-span-1">
      <ArrowRight className="h-5 w-5 text-white/30" />
    </div>
  )
}

function AuditMiniRow({ event }: { event: AuditLogEntryDto }) {
  return (
    <li className="px-5 py-3 flex items-start gap-3">
      <div className="h-7 w-7 rounded-lg bg-white/[0.04] border border-white/10 grid place-items-center shrink-0 mt-0.5">
        <span className="text-[10px] font-bold text-white/65">{event.action.split('.')[0]?.charAt(0).toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-white truncate">
          <span className="font-semibold">{event.userName ?? 'sistema'}</span>
          <span className="text-white/55"> {event.action.split('.')[1]} </span>
          <span className="font-semibold">{event.entityLabel ?? event.entityType}</span>
        </p>
        {event.changedFields && event.changedFields.length > 0 && (
          <p className="text-[10px] text-white/45 truncate">campos: {event.changedFields.join(', ')}</p>
        )}
      </div>
      <p className="text-[10px] text-white/45 shrink-0 tabular-nums">{relativeTime(event.at)}</p>
    </li>
  )
}


import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ScrollText,
  UserPlus,
  ClipboardPlus,
  HeartPulse,
  Wallet,
  Search,
  Filter,
  RefreshCw,
  Download,
  AlertCircle,
  Plug2,
  Trash2,
  Pencil,
  Sparkles,
} from "@/components/icons"
import {
  auditApi,
  empresasApi,
  type AuditLogEntryDto,
  type EmpresaDto,
} from '@/lib/cadastra/api'
import { cn } from '@/lib/utils'

interface LogsViewProps {
  onBack: () => void
}

// Famílias visuais por prefixo da action — cada controller usa "<entity>.<verb>".
const ACTION_PALETTE: Record<string, { bg: string; text: string; border: string; icon: typeof UserPlus }> = {
  lead: { bg: 'bg-cyan-500/10', text: 'text-cyan-300', border: 'border-cyan-400/30', icon: UserPlus },
  consulta: { bg: 'bg-violet-500/10', text: 'text-violet-300', border: 'border-violet-400/30', icon: ClipboardPlus },
  tratamento: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-400/30', icon: HeartPulse },
  recebimento: { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-400/30', icon: Wallet },
  kommo: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-300', border: 'border-fuchsia-400/30', icon: Plug2 },
}

const ACTION_LABEL: Record<string, string> = {
  'lead.create': 'Lead criado',
  'lead.update': 'Lead editado',
  'lead.delete': 'Lead apagado',
  'lead.bulk_import': 'Import em massa',
  'lead.bulk_delete': 'Apagados em massa',
  'consulta.create': 'Consulta cadastrada',
  'consulta.update': 'Consulta editada',
  'consulta.delete': 'Consulta apagada',
  'tratamento.create': 'Tratamento fechado',
  'tratamento.update': 'Tratamento editado',
  'tratamento.delete': 'Tratamento apagado',
  'recebimento.create': 'Recebimento registrado',
  'recebimento.delete': 'Recebimento apagado',
  'kommo.config.save': 'Kommo configurado',
  'kommo.config.delete': 'Kommo desconectado',
  'kommo.sync': 'Sync Kommo',
  'kommo.webhook': 'Webhook Kommo',
  'kommo.promote': 'Lead Kommo promovido',
  'kommo.inbox.clear': 'Inbox Kommo limpa',
}

function paletteFor(action: string) {
  const family = action.split('.')[0]
  return ACTION_PALETTE[family] ?? ACTION_PALETTE['lead']
}

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action
}

function isDeleteAction(action: string): boolean {
  return action.endsWith('.delete')
}

const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return dateTimeFmt.format(d)
}

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
  const mo = Math.floor(d / 30)
  if (mo < 12) return `há ${mo} mês${mo === 1 ? '' : 'es'}`
  return `há ${Math.floor(mo / 12)} ano(s)`
}

function startOfRange(range: string): Date | null {
  const now = new Date()
  if (range === 'hoje') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (range === '7d') return new Date(now.getTime() - 7 * 86_400_000)
  if (range === '30d') return new Date(now.getTime() - 30 * 86_400_000)
  if (range === '90d') return new Date(now.getTime() - 90 * 86_400_000)
  return null
}

function downloadCsv(events: AuditLogEntryDto[]) {
  const header = ['quando', 'acao', 'entidade', 'rotulo', 'usuario', 'email', 'campos_alterados', 'ip']
  const rows = events.map((e) => [
    formatDateTime(e.at),
    actionLabel(e.action),
    e.entityType,
    e.entityLabel ?? '',
    e.userName ?? '',
    e.userEmail ?? '',
    (e.changedFields ?? []).join('; '),
    e.ip ?? '',
  ])
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-cadastraai-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const ACTION_FAMILIES = ['lead', 'consulta', 'tratamento', 'recebimento', 'kommo'] as const
type ActionFamily = (typeof ACTION_FAMILIES)[number] | 'todos'

export function LogsView({ onBack }: LogsViewProps) {
  const [empresas, setEmpresas] = useState<EmpresaDto[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [events, setEvents] = useState<AuditLogEntryDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refetchTick, setRefetchTick] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState<ActionFamily>('todos')
  const [rangeFilter, setRangeFilter] = useState<'tudo' | 'hoje' | '7d' | '30d' | '90d'>('30d')
  const [userFilter, setUserFilter] = useState<string>('todos')

  // Empresas
  useEffect(() => {
    let cancelled = false
    empresasApi
      .list()
      .then((list) => {
        if (cancelled) return
        setEmpresas(list)
        setEmpresaId((prev) => prev || list[0]?.id || '')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar empresas.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Auditoria — busca paginada do backend
  useEffect(() => {
    if (!empresaId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    const start = startOfRange(rangeFilter)
    const fromIso = start ? start.toISOString() : undefined
    const actionsFilter =
      familyFilter === 'todos'
        ? undefined
        : Object.keys(ACTION_LABEL)
            .filter((a) => a.startsWith(familyFilter + '.'))
            .join(',')

    auditApi
      .list(empresaId, {
        from: fromIso,
        actions: actionsFilter,
        userId: userFilter !== 'todos' ? userFilter : undefined,
        page: 0,
        pageSize: 500,
      })
      .then((resp) => {
        if (cancelled) return
        setEvents(resp.items)
        setTotal(resp.total)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar logs.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [empresaId, refetchTick, rangeFilter, familyFilter, userFilter])

  const usuarios = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of events) {
      if (e.userId && e.userName && !seen.has(e.userId)) seen.set(e.userId, e.userName)
    }
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [events])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return events
    return events.filter((e) =>
      `${e.entityLabel ?? ''} ${e.userName ?? ''} ${e.userEmail ?? ''} ${actionLabel(e.action)} ${(e.changedFields ?? []).join(' ')}`
        .toLowerCase()
        .includes(q),
    )
  }, [events, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { lead: 0, consulta: 0, tratamento: 0, recebimento: 0, kommo: 0 }
    for (const e of filtered) {
      const family = e.action.split('.')[0]
      if (family in c) c[family]++
    }
    return c
  }, [filtered])

  return (
    <motion.div
      className="px-8 py-8 max-w-6xl mx-auto"
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
          <button
            onClick={() => filtered.length && downloadCsv(filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-[13px] text-white/70 hover:text-white hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <button
            onClick={() => setRefetchTick((t) => t + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-[13px] text-white/70 hover:text-white hover:border-white/20 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Atualizar
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
            <ScrollText className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-[0.2em] text-cyan-100/85 mb-1">Auditoria</p>
            <h1 className="text-[28px] font-bold tracking-tight leading-none">Trilha de eventos</h1>
            <p className="text-[13px] text-cyan-100/85 mt-2">
              Cada ação no sistema é registrada com autor, IP e — quando aplicável — quais campos
              foram alterados. Use os filtros para investigar.
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-3xl border border-white/5 bg-[#15171b] p-5 space-y-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {empresas.length > 1 && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Empresa</label>
              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50"
              >
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Período</label>
            <select
              value={rangeFilter}
              onChange={(e) => setRangeFilter(e.target.value as typeof rangeFilter)}
              className="mt-1 w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50"
            >
              <option value="hoje">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="tudo">Tudo</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Usuário</label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50"
            >
              <option value="todos">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Total</label>
            <div className="mt-1 h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/10 flex items-center text-sm text-white tabular-nums">
              {total} eventos
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por entidade, usuário, e-mail ou campo alterado…"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#0c0d10] border border-white/10 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-cyan-400/50"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FamilyChip
              active={familyFilter === 'todos'}
              onClick={() => setFamilyFilter('todos')}
              label="Tudo"
              count={filtered.length}
            />
            {ACTION_FAMILIES.map((f) => (
              <FamilyChip
                key={f}
                active={familyFilter === f}
                onClick={() => setFamilyFilter(f)}
                label={f.charAt(0).toUpperCase() + f.slice(1)}
                count={counts[f] ?? 0}
                family={f}
              />
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/[0.06] px-5 py-4 mb-5 text-red-200 text-sm">
          {error}
        </div>
      )}

      {loading && events.length === 0 ? (
        <SkeletonTimeline />
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <Filter className="h-7 w-7 text-white/30 mx-auto mb-3" />
          <p className="text-[15px] font-semibold text-white/85 mb-1">Nada para mostrar</p>
          <p className="text-[13px] text-white/55">
            Sem eventos no período selecionado, ou os filtros estão restritivos demais.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/5 bg-[#15171b] overflow-hidden">
          <ul className="divide-y divide-white/5">
            {filtered.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  )
}

function FamilyChip({
  active,
  onClick,
  label,
  count,
  family,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  family?: string
}) {
  const palette = family ? ACTION_PALETTE[family] : null
  const Icon = palette?.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 h-10 px-3 rounded-xl border text-[13px] transition-colors',
        active
          ? palette
            ? `${palette.bg} ${palette.text} ${palette.border}`
            : 'bg-white/10 text-white border-white/20'
          : 'bg-[#0c0d10] text-white/55 border-white/10 hover:text-white hover:border-white/20',
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span className="font-semibold">{label}</span>
      <span className="text-[11px] tabular-nums opacity-80">{count}</span>
    </button>
  )
}

function EventRow({ event }: { event: AuditLogEntryDto }) {
  const palette = paletteFor(event.action)
  const Icon = isDeleteAction(event.action) ? Trash2 : event.action.endsWith('.update') ? Pencil : palette.icon
  return (
    <li className="px-5 py-4 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'h-10 w-10 rounded-xl grid place-items-center shrink-0 border',
            palette.bg,
            palette.border,
          )}
        >
          <Icon className={cn('h-4 w-4', palette.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className={cn('text-[11px] uppercase tracking-wider font-bold', palette.text)}>
              {actionLabel(event.action)}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-white/45 bg-white/[0.04] border border-white/10 px-1.5 py-0.5 rounded-md">
              {event.entityType}
            </span>
          </div>
          <p className="text-[14px] text-white font-semibold truncate">
            {event.entityLabel ?? '—'}
          </p>
          {event.changedFields && event.changedFields.length > 0 && (
            <p className="text-[12px] text-white/60 truncate flex items-center gap-1.5 mt-0.5">
              <Sparkles className="h-3 w-3 text-amber-300/80" />
              Campos: {event.changedFields.join(', ')}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[12px] text-white/85 font-semibold truncate max-w-[180px]">
            {event.userName ?? <span className="text-white/45">sistema</span>}
          </p>
          {event.userEmail && (
            <p className="text-[10px] text-white/45 truncate max-w-[180px]">{event.userEmail}</p>
          )}
          <p className="text-[11px] text-white/45">{relativeTime(event.at)}</p>
          <p className="text-[10px] text-white/35 font-mono mt-0.5">{formatDateTime(event.at)}</p>
        </div>
      </div>
    </li>
  )
}

function SkeletonTimeline() {
  return (
    <div className="rounded-3xl border border-white/5 bg-[#15171b] overflow-hidden">
      <ul className="divide-y divide-white/5">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
            <div className="h-10 w-10 rounded-xl bg-white/5" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-white/5" />
              <div className="h-4 w-1/2 rounded bg-white/10" />
              <div className="h-3 w-1/3 rounded bg-white/5" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-white/5" />
              <div className="h-3 w-16 rounded bg-white/5" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

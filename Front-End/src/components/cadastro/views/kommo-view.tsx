
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Plug,
  Plug2,
  Inbox,
  RefreshCw,
  Webhook,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Trash2,
  Sparkles,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  Building2,
  CalendarRange,
  Lightbulb,
  Wand2,
  Filter,
  History,
  Layers,
  UserCheck,
  Timer,
  Zap,
  PlayCircle,
  HelpCircle,
  X,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildKommoWebhookUrl,
  empresasApi,
  isBackendNotImplemented,
  kommoApi,
  leadsApi,
  type AutoSyncInterval,
  type CreateLeadPayload,
  type EmpresaDto,
  type KommoAutoSyncDto,
  type KommoConfigDto,
  type KommoFieldMappingDto,
  type KommoFieldMappingRuleDto,
  type KommoInboxItemDto,
  type KommoLeadEventDto,
  type KommoPipelineDto,
  type KommoResponsibleMappingDto,
  type KommoStatusDto,
  type KommoSyncHistoryEntryDto,
  type KommoSyncOptions,
  type KommoTagMappingDto,
  type KommoTagMappingRuleDto,
  type KommoTestConnectionResultDto,
  type KommoUserDto,
  type LeadDuplicateMatchDto,
} from '@/lib/cadastra/api'
import {
  analyzeKommoLead,
  listTargets,
  type AnalyzeResult,
  type TargetField,
} from '@/lib/cadastra/kommo-mapping'
import { hasSeenTour, KOMMO_TOUR_STEPS, markTourSeen, resetTour, type TourStep } from '@/lib/cadastra/kommo-tour'

interface KommoViewProps {
  onBack: () => void
}

type Tab = 'config' | 'mapping' | 'sync' | 'inbox' | 'history' | 'events' | 'timeline'

const TARGETS = listTargets()

// Catálogo de eventos de webhook que a Kommo dispara. Fonte: docs Kommo (Digital Pipeline / Webhooks).
// Os hashes são exatamente os campos que vêm no body x-www-form-urlencoded da Kommo.
interface KommoWebhookEvent {
  id: string
  category: 'lead' | 'contact' | 'company' | 'task' | 'note' | 'status'
  label: string
  description: string
  // Campos do payload que a Kommo envia para esse evento.
  payloadKeys: string[]
  // Exemplo simplificado (form-encoded já parseado para JSON).
  example: Record<string, unknown>
  recommended?: boolean
}

const KOMMO_WEBHOOK_EVENTS: KommoWebhookEvent[] = [
  {
    id: 'leads.add',
    category: 'lead',
    label: 'Lead criado',
    description: 'Disparado quando um novo lead aparece em qualquer pipeline.',
    payloadKeys: ['leads[add][0][id]', 'leads[add][0][name]', 'leads[add][0][status_id]', 'leads[add][0][created_at]'],
    example: {
      leads: {
        add: [
          {
            id: 12345,
            name: 'Lead via Instagram',
            status_id: 142001,
            pipeline_id: 5601,
            responsible_user_id: 9988,
            created_at: 1715000000,
            custom_fields: [
              { id: 887766, name: 'Telefone', values: [{ value: '+55 11 90000-0000' }] },
            ],
          },
        ],
      },
      account: { id: 12345678, subdomain: 'minha-conta' },
    },
    recommended: true,
  },
  {
    id: 'leads.update',
    category: 'lead',
    label: 'Lead atualizado',
    description: 'Mudança em qualquer campo do lead — incluindo custom fields.',
    payloadKeys: ['leads[update][0][id]', 'leads[update][0][modified_at]'],
    example: {
      leads: {
        update: [
          {
            id: 12345,
            name: 'Maria Silva',
            modified_at: 1715000420,
            custom_fields: [
              { id: 887766, name: 'Telefone', values: [{ value: '+55 11 91111-2222' }] },
            ],
          },
        ],
      },
    },
    recommended: true,
  },
  {
    id: 'leads.status',
    category: 'status',
    label: 'Status do lead mudou',
    description: 'Movimentação entre etapas/status do funil. Útil para sincronizar status com o Cadastro.',
    payloadKeys: ['leads[status][0][id]', 'leads[status][0][status_id]', 'leads[status][0][old_status_id]'],
    example: {
      leads: {
        status: [
          {
            id: 12345,
            status_id: 142003,
            old_status_id: 142001,
            pipeline_id: 5601,
          },
        ],
      },
    },
    recommended: true,
  },
  {
    id: 'leads.delete',
    category: 'lead',
    label: 'Lead deletado',
    description: 'Lead removido (movido para a lixeira) na Kommo. Permite descartar do inbox automaticamente.',
    payloadKeys: ['leads[delete][0][id]'],
    example: { leads: { delete: [{ id: 12345 }] } },
  },
  {
    id: 'contacts.add',
    category: 'contact',
    label: 'Contato criado',
    description: 'Novo contato — útil quando o cliente é criado antes do lead.',
    payloadKeys: ['contacts[add][0][id]', 'contacts[add][0][name]'],
    example: {
      contacts: {
        add: [
          {
            id: 77001,
            name: 'João Pereira',
            custom_fields: [
              { id: 100, name: 'Phone', values: [{ value: '+55 21 98888-7777', enum_code: 'WORK' }] },
              { id: 101, name: 'Email', values: [{ value: 'joao@example.com', enum_code: 'WORK' }] },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'contacts.update',
    category: 'contact',
    label: 'Contato atualizado',
    description: 'Edição em campos do contato. Útil pra refletir telefone/email atualizados.',
    payloadKeys: ['contacts[update][0][id]'],
    example: { contacts: { update: [{ id: 77001, name: 'João P.' }] } },
  },
  {
    id: 'contacts.delete',
    category: 'contact',
    label: 'Contato deletado',
    description: 'Remoção de contato.',
    payloadKeys: ['contacts[delete][0][id]'],
    example: { contacts: { delete: [{ id: 77001 }] } },
  },
  {
    id: 'companies.add',
    category: 'company',
    label: 'Empresa criada',
    description: 'Nova empresa (B2B). Geralmente irrelevante para clínicas — habilite só se você usa.',
    payloadKeys: ['companies[add][0][id]'],
    example: { companies: { add: [{ id: 33001, name: 'Acme Corp' }] } },
  },
  {
    id: 'tasks.add',
    category: 'task',
    label: 'Tarefa criada',
    description: 'Nova tarefa — útil pra rastrear follow-ups que viram consultas.',
    payloadKeys: ['tasks[add][0][id]', 'tasks[add][0][text]', 'tasks[add][0][complete_till]'],
    example: {
      tasks: {
        add: [
          {
            id: 9001,
            text: 'Ligar para o lead',
            element_id: 12345,
            element_type: 2,
            complete_till: 1715100000,
          },
        ],
      },
    },
  },
  {
    id: 'tasks.complete',
    category: 'task',
    label: 'Tarefa concluída',
    description: 'Conclusão de uma tarefa. Sinal forte de "houve interação".',
    payloadKeys: ['tasks[update][0][is_completed]'],
    example: { tasks: { update: [{ id: 9001, is_completed: true }] } },
  },
  {
    id: 'notes.add',
    category: 'note',
    label: 'Nota criada',
    description: 'Comentário em lead/contato/empresa. Pode trazer contexto livre que o assistente do Cadastro pode ler.',
    payloadKeys: ['notes[add][0][id]', 'notes[add][0][text]'],
    example: {
      notes: {
        add: [
          {
            id: 5500,
            element_id: 12345,
            element_type: 2,
            text: 'Cliente preferiu remarcar para sexta',
          },
        ],
      },
    },
  },
]


function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function KommoView({ onBack }: KommoViewProps) {
  const [tab, setTab] = useState<Tab>('config')
  const [empresas, setEmpresas] = useState<EmpresaDto[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [config, setConfig] = useState<KommoConfigDto | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [inbox, setInbox] = useState<KommoInboxItemDto[]>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error' | 'info'; msg: string } | null>(null)

  // Recursos vindos da Kommo via backend (com fallback gracioso quando endpoint não existe).
  const [pipelines, setPipelines] = useState<KommoPipelineDto[]>([])
  const [users, setUsers] = useState<KommoUserDto[]>([])
  const [autoSync, setAutoSync] = useState<KommoAutoSyncDto | null>(null)
  const [fieldMapping, setFieldMapping] = useState<KommoFieldMappingDto | null>(null)
  const [responsibleMapping, setResponsibleMapping] = useState<KommoResponsibleMappingDto | null>(null)
  const [tagMapping, setTagMapping] = useState<KommoTagMappingDto | null>(null)
  const [history, setHistory] = useState<KommoSyncHistoryEntryDto[]>([])
  const [backendCaps, setBackendCaps] = useState({
    pipelines: true,
    users: true,
    autoSync: true,
    fieldMapping: true,
    responsibleMapping: true,
    tagMapping: true,
    history: true,
    testConnection: true,
  })

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
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!empresaId) return
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  async function refreshAll() {
    if (!empresaId) return
    await Promise.allSettled([
      refreshConfig(),
      refreshInbox(),
      refreshPipelines(),
      refreshUsers(),
      refreshAutoSync(),
      refreshFieldMapping(),
      refreshResponsibleMapping(),
      refreshTagMapping(),
      refreshHistory(),
    ])
  }

  async function refreshConfig() {
    if (!empresaId) return
    setConfigLoading(true)
    try {
      const cfg = await kommoApi.getConfig(empresaId)
      setConfig(cfg)
    } catch {
      setConfig(null)
    } finally {
      setConfigLoading(false)
    }
  }

  async function refreshInbox() {
    if (!empresaId) return
    setInboxLoading(true)
    try {
      const items = await kommoApi.inbox(empresaId)
      setInbox(items)
    } catch {
      setInbox([])
    } finally {
      setInboxLoading(false)
    }
  }

  async function refreshPipelines() {
    try {
      const list = await kommoApi.pipelines(empresaId)
      setPipelines(list)
      setBackendCaps((c) => ({ ...c, pipelines: true }))
    } catch (err) {
      if (isBackendNotImplemented(err)) setBackendCaps((c) => ({ ...c, pipelines: false }))
      setPipelines([])
    }
  }

  async function refreshUsers() {
    try {
      const list = await kommoApi.users(empresaId)
      setUsers(list)
      setBackendCaps((c) => ({ ...c, users: true }))
    } catch (err) {
      if (isBackendNotImplemented(err)) setBackendCaps((c) => ({ ...c, users: false }))
      setUsers([])
    }
  }

  async function refreshAutoSync() {
    try {
      const cfg = await kommoApi.getAutoSync(empresaId)
      setAutoSync(cfg)
      setBackendCaps((c) => ({ ...c, autoSync: true }))
    } catch (err) {
      if (isBackendNotImplemented(err)) setBackendCaps((c) => ({ ...c, autoSync: false }))
      setAutoSync(null)
    }
  }

  async function refreshFieldMapping() {
    try {
      const m = await kommoApi.getFieldMapping(empresaId)
      setFieldMapping(m)
      setBackendCaps((c) => ({ ...c, fieldMapping: true }))
    } catch (err) {
      if (isBackendNotImplemented(err)) setBackendCaps((c) => ({ ...c, fieldMapping: false }))
      setFieldMapping(null)
    }
  }

  async function refreshResponsibleMapping() {
    try {
      const m = await kommoApi.getResponsibleMapping(empresaId)
      setResponsibleMapping(m)
      setBackendCaps((c) => ({ ...c, responsibleMapping: true }))
    } catch (err) {
      if (isBackendNotImplemented(err)) setBackendCaps((c) => ({ ...c, responsibleMapping: false }))
      setResponsibleMapping(null)
    }
  }

  async function refreshTagMapping() {
    try {
      const m = await kommoApi.getTagMapping(empresaId)
      setTagMapping(m)
      setBackendCaps((c) => ({ ...c, tagMapping: true }))
    } catch (err) {
      if (isBackendNotImplemented(err)) setBackendCaps((c) => ({ ...c, tagMapping: false }))
      setTagMapping(null)
    }
  }

  async function refreshHistory() {
    try {
      const r = await kommoApi.syncHistory(empresaId, { pageSize: 50 })
      setHistory(r.items)
      setBackendCaps((c) => ({ ...c, history: true }))
    } catch (err) {
      if (isBackendNotImplemented(err)) setBackendCaps((c) => ({ ...c, history: false }))
      setHistory([])
    }
  }

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
        {empresas.length > 1 && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-white/55" />
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
          </div>
        )}
      </div>

      {/* Hero */}
      <div
        className="rounded-3xl p-7 mb-5 text-cyan-50"
        style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 60%, #075985 100%)' }}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/15 grid place-items-center">
            <Plug2 className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[12px] uppercase tracking-[0.2em] text-cyan-100/85 mb-1">Integração</p>
            <h1 className="text-[28px] font-bold tracking-tight leading-none">Kommo CRM</h1>
            <p className="text-[13px] text-cyan-100/85 mt-2">
              Configurada por empresa, com token criptografado at-rest. Receba leads via webhook ou
              faça sync manual; o gap-analysis mostra o que falta antes de promover.
            </p>
          </div>
          <ConfigStatusPill loading={configLoading} config={config} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5 border-b border-white/5">
        <TabButton active={tab === 'config'} onClick={() => setTab('config')}>
          <Plug className="h-4 w-4" /> Configuração
        </TabButton>
        <TabButton active={tab === 'mapping'} onClick={() => setTab('mapping')}>
          <Layers className="h-4 w-4" /> Mapeamentos
        </TabButton>
        <TabButton active={tab === 'sync'} onClick={() => setTab('sync')}>
          <RefreshCw className="h-4 w-4" /> Sincronização
        </TabButton>
        <TabButton active={tab === 'inbox'} onClick={() => setTab('inbox')}>
          <Inbox className="h-4 w-4" /> Inbox
          {inbox.filter((i) => i.status === 'pending').length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-200 font-bold tabular-nums">
              {inbox.filter((i) => i.status === 'pending').length}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          <History className="h-4 w-4" /> Histórico
        </TabButton>
        <TabButton active={tab === 'timeline'} onClick={() => setTab('timeline')}>
          <Activity className="h-4 w-4" /> Timeline
        </TabButton>
        <TabButton active={tab === 'events'} onClick={() => setTab('events')}>
          <Webhook className="h-4 w-4" /> Webhooks
        </TabButton>
      </div>

      {feedback && <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />}

      {!empresaId ? (
        <div className="rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-white/55 text-sm">Selecione uma empresa para configurar o Kommo.</p>
        </div>
      ) : tab === 'config' ? (
        <ConfigTab
          empresaId={empresaId}
          config={config}
          autoSync={autoSync}
          autoSyncSupported={backendCaps.autoSync}
          testConnSupported={backendCaps.testConnection}
          onAutoSyncSaved={(cfg, msg) => {
            setAutoSync(cfg)
            setFeedback({ kind: 'success', msg })
          }}
          onTestConnUnsupported={() => setBackendCaps((c) => ({ ...c, testConnection: false }))}
          onSaved={(msg) => {
            refreshConfig()
            setFeedback({ kind: 'success', msg })
          }}
          onError={(msg) => setFeedback({ kind: 'error', msg })}
        />
      ) : tab === 'mapping' ? (
        <MappingTab
          empresaId={empresaId}
          fieldMapping={fieldMapping}
          responsibleMapping={responsibleMapping}
          tagMapping={tagMapping}
          users={users}
          fieldMappingSupported={backendCaps.fieldMapping}
          responsibleMappingSupported={backendCaps.responsibleMapping}
          tagMappingSupported={backendCaps.tagMapping}
          usersSupported={backendCaps.users}
          onFieldMappingSaved={(m, msg) => {
            setFieldMapping(m)
            setFeedback({ kind: 'success', msg })
          }}
          onResponsibleSaved={(m, msg) => {
            setResponsibleMapping(m)
            setFeedback({ kind: 'success', msg })
          }}
          onTagMappingSaved={(m, msg) => {
            setTagMapping(m)
            setFeedback({ kind: 'success', msg })
          }}
          onError={(msg) => setFeedback({ kind: 'error', msg })}
        />
      ) : tab === 'sync' ? (
        <SyncTab
          empresaId={empresaId}
          configured={!!config?.hasToken}
          pipelines={pipelines}
          pipelinesSupported={backendCaps.pipelines}
          onResult={(res) => {
            setFeedback(res)
            refreshInbox()
            refreshConfig()
            refreshHistory()
          }}
        />
      ) : tab === 'inbox' ? (
        <InboxTab
          empresaId={empresaId}
          items={inbox}
          loading={inboxLoading}
          onRefresh={refreshInbox}
          onFeedback={setFeedback}
        />
      ) : tab === 'history' ? (
        <HistoryTab
          history={history}
          supported={backendCaps.history}
          onRefresh={refreshHistory}
        />
      ) : tab === 'timeline' ? (
        <TimelineTab empresaId={empresaId} />
      ) : (
        <EventsTab
          empresaId={empresaId}
          config={config}
        />
      )}
    </motion.div>
  )
}

function ConfigStatusPill({ loading, config }: { loading: boolean; config: KommoConfigDto | null }) {
  if (loading) return null
  if (!config || !config.hasToken) {
    return (
      <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/15 text-white text-[11px] uppercase tracking-wider font-bold">
        <XCircle className="h-3.5 w-3.5" />
        Não configurado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-emerald-500/30 border border-emerald-300/40 text-white text-[11px] uppercase tracking-wider font-bold">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Conectado
    </span>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-4 h-10 rounded-t-xl text-[13px] font-semibold border-b-2 transition-colors',
        active
          ? 'border-cyan-400 text-white bg-white/[0.04]'
          : 'border-transparent text-white/55 hover:text-white hover:bg-white/[0.02]',
      )}
    >
      {children}
    </button>
  )
}

function FeedbackBanner({
  feedback,
  onClose,
}: {
  feedback: { kind: 'success' | 'error' | 'info'; msg: string }
  onClose: () => void
}) {
  const palette =
    feedback.kind === 'success'
      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
      : feedback.kind === 'error'
        ? 'border-red-400/30 bg-red-500/10 text-red-200'
        : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
  const Icon = feedback.kind === 'success' ? CheckCircle2 : AlertCircle
  return (
    <div className={cn('rounded-2xl border px-4 py-3 mb-5 flex items-start gap-3', palette)}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <p className="flex-1 text-[13px]">{feedback.msg}</p>
      <button onClick={onClose} className="text-current/60 hover:text-current text-[12px]">
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  )
}

// ----- CONFIG TAB -----

function ConfigTab({
  empresaId,
  config,
  autoSync,
  autoSyncSupported,
  testConnSupported,
  onSaved,
  onError,
  onAutoSyncSaved,
  onTestConnUnsupported,
}: {
  empresaId: string
  config: KommoConfigDto | null
  autoSync: KommoAutoSyncDto | null
  autoSyncSupported: boolean
  testConnSupported: boolean
  onSaved: (msg: string) => void
  onError: (msg: string) => void
  onAutoSyncSaved: (cfg: KommoAutoSyncDto, msg: string) => void
  onTestConnUnsupported: () => void
}) {
  const [subdomain, setSubdomain] = useState('')
  const [token, setToken] = useState('')
  const [secret, setSecret] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<'webhook' | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<KommoTestConnectionResultDto | null>(null)

  useEffect(() => {
    if (config) setSubdomain(config.subdomain)
  }, [config])

  const webhookUrl = useMemo(() => {
    return buildKommoWebhookUrl(empresaId)
  }, [empresaId])

  async function save() {
    if (!subdomain || (!token && !config?.hasToken)) {
      onError('Preencha o subdomínio e o access token.')
      return
    }
    setSaving(true)
    try {
      await kommoApi.saveConfig(empresaId, {
        subdomain,
        accessToken: token || '',
        webhookSecret: secret || undefined,
      })
      setToken('')
      onSaved('Conectado ao Kommo com sucesso.')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSaving(false)
    }
  }

  async function disconnect() {
    if (!confirm('Remover a configuração da Kommo desta empresa?')) return
    setSaving(true)
    try {
      await kommoApi.deleteConfig(empresaId)
      setToken('')
      setSubdomain('')
      onSaved('Desconectado.')
    } finally {
      setSaving(false)
    }
  }

  async function runTestConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await kommoApi.testConnection(empresaId)
      setTestResult(result)
      if (!result.ok) onError(result.errorMessage ?? 'Falha no teste de conexão.')
    } catch (err) {
      if (isBackendNotImplemented(err)) {
        onTestConnUnsupported()
        onError('Endpoint de teste ainda não disponível no CadastraAi.API. Salve as credenciais e use Sincronizar.')
      } else {
        onError(err instanceof Error ? err.message : 'Falha no teste.')
      }
    } finally {
      setTesting(false)
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('webhook')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Credenciais */}
      <div className="rounded-3xl border border-white/5 bg-[#15171b] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-400/30 grid place-items-center">
            <Plug className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-white">Credenciais Kommo</h3>
            <p className="text-[12px] text-white/55">Subdomínio + access token. Token criptografado at-rest no servidor.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Subdomínio</label>
            <div className="mt-1 flex items-center rounded-xl border border-white/10 bg-[#0c0d10] focus-within:border-cyan-400/50">
              <input
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="minha-conta"
                className="flex-1 h-10 px-3 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
              />
              <span className="px-3 text-[12px] text-white/45 border-l border-white/10">.kommo.com</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Access token</label>
            <div className="mt-1 flex items-center rounded-xl border border-white/10 bg-[#0c0d10] focus-within:border-cyan-400/50">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={config?.hasToken ? `••••••••${config.tokenSuffix ?? ''}` : 'Cole o token longo aqui'}
                className="flex-1 h-10 px-3 bg-transparent text-sm font-mono text-white placeholder:text-white/35 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="px-3 text-white/55 hover:text-white"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-white/45 mt-1">
              Crie em Configurações → Integrações → Long-Lived Token na Kommo. O token é
              criptografado com IDataProtector antes de ir pro DB e nunca volta para o navegador.
            </p>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Webhook secret (opcional)</label>
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Use um valor secreto p/ proteger o endpoint"
              className="mt-1 w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/10 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-cyan-400/50"
            />
          </div>

          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <button
              onClick={save}
              disabled={saving || (!token && !config?.hasToken)}
              className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#0d0f14] text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Salvando…' : 'Salvar e validar'}
            </button>
            {config?.hasToken && (
              <button
                onClick={runTestConnection}
                disabled={testing}
                title={testConnSupported ? 'Faz uma chamada de leitura na Kommo para validar token + subdomínio' : 'Endpoint pendente no CadastraAi.API'}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-cyan-400/30 bg-cyan-500/[0.06] text-cyan-200 text-[13px] hover:bg-cyan-500/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className={cn('h-4 w-4', testing && 'animate-pulse')} />
                {testing ? 'Testando…' : 'Testar conexão'}
              </button>
            )}
            {config?.hasToken && (
              <button
                onClick={disconnect}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-rose-400/30 bg-rose-500/[0.06] text-rose-300 text-[13px] hover:bg-rose-500/15 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Desconectar
              </button>
            )}
          </div>

          {testResult && (
            <div
              className={cn(
                'rounded-xl border px-3 py-2 text-[12px] flex items-start gap-2',
                testResult.ok
                  ? 'border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200'
                  : 'border-rose-400/30 bg-rose-500/[0.06] text-rose-200',
              )}
            >
              {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                {testResult.ok ? (
                  <>
                    <p className="font-semibold">Conexão OK</p>
                    {testResult.account && (
                      <p className="text-[11px] text-white/60">
                        Conta {testResult.account.name} (#{testResult.account.id}) · {testResult.account.subdomain}.kommo.com
                      </p>
                    )}
                    {(testResult.pipelinesCount != null || testResult.usersCount != null) && (
                      <p className="text-[11px] text-white/60 tabular-nums">
                        {testResult.pipelinesCount ?? '-'} pipelines · {testResult.usersCount ?? '-'} usuários
                      </p>
                    )}
                  </>
                ) : (
                  <p>{testResult.errorMessage ?? 'Falha desconhecida.'}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Auto-sync */}
      <div className="rounded-3xl border border-white/5 bg-[#15171b] p-6 lg:col-span-2">
        <AutoSyncSection
          empresaId={empresaId}
          autoSync={autoSync}
          supported={autoSyncSupported}
          configured={!!config?.hasToken}
          onSaved={onAutoSyncSaved}
          onError={onError}
        />
      </div>

      {/* Webhook */}
      <div className="rounded-3xl border border-white/5 bg-[#15171b] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-400/30 grid place-items-center">
            <Webhook className="h-5 w-5 text-violet-300" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-white">Webhook (push)</h3>
            <p className="text-[12px] text-white/55">URL única por empresa. Cole na Kommo para receber leads em tempo real.</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-3 flex items-center gap-2 mb-3">
          <code className="flex-1 text-[12px] font-mono text-cyan-200 truncate">{webhookUrl}</code>
          <button
            onClick={() => webhookUrl && copy(webhookUrl)}
            className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/[0.06] text-white/70 hover:text-white transition-colors"
          >
            {copied === 'webhook' ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        {config?.hasWebhookSecret && (
          <p className="text-[11px] text-amber-300/80 mb-3">
            Substitua <code>&lt;seu-secret&gt;</code> pelo secret que você definiu (não exibimos por segurança).
          </p>
        )}

        <div className="space-y-2 text-[12px] text-white/65">
          <p className="font-semibold text-white/85">Como configurar na Kommo:</p>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Vá em <strong>Configurações → Integrações → Webhooks</strong>.</li>
            <li>Adicione um novo webhook com a URL acima.</li>
            <li>Marque <em>Lead criado</em> e <em>Lead atualizado</em>.</li>
            <li>Salve. Os leads aparecerão na aba Inbox automaticamente.</li>
          </ol>
          <a
            href="https://www.kommo.com/developers/content/digital_pipeline/webhooks/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 mt-2"
          >
            Documentação Kommo <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  )
}

// ----- SYNC TAB -----

type DatePreset = 'hoje' | 'ontem' | '7d' | '30d' | 'mes' | 'tudo' | 'custom'

interface DateRange {
  from?: string
  to?: string
  label: string
}

function rangeForPreset(preset: DatePreset, custom?: { from?: string; to?: string }): DateRange {
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

  switch (preset) {
    case 'hoje': {
      return {
        from: startOfDay(now).toISOString(),
        to: endOfDay(now).toISOString(),
        label: 'Hoje',
      }
    }
    case 'ontem': {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      return {
        from: startOfDay(y).toISOString(),
        to: endOfDay(y).toISOString(),
        label: 'Ontem',
      }
    }
    case '7d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 6)
      return {
        from: startOfDay(start).toISOString(),
        to: endOfDay(now).toISOString(),
        label: 'Últimos 7 dias',
      }
    }
    case '30d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 29)
      return {
        from: startOfDay(start).toISOString(),
        to: endOfDay(now).toISOString(),
        label: 'Últimos 30 dias',
      }
    }
    case 'mes': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        from: start.toISOString(),
        to: endOfDay(now).toISOString(),
        label: 'Mês atual',
      }
    }
    case 'custom': {
      return {
        from: custom?.from ? new Date(custom.from).toISOString() : undefined,
        to: custom?.to ? new Date(`${custom.to}T23:59:59.999`).toISOString() : undefined,
        label: 'Período customizado',
      }
    }
    case 'tudo':
    default:
      return { label: 'Todos os leads' }
  }
}

function SyncTab({
  empresaId,
  configured,
  pipelines,
  pipelinesSupported,
  onResult,
}: {
  empresaId: string
  configured: boolean
  pipelines: KommoPipelineDto[]
  pipelinesSupported: boolean
  onResult: (res: { kind: 'success' | 'error'; msg: string }) => void
}) {
  const [running, setRunning] = useState(false)
  const [limit, setLimit] = useState(50)
  const [query, setQuery] = useState('')
  const [preset, setPreset] = useState<DatePreset>('hoje')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [pipelineId, setPipelineId] = useState<number | ''>('')
  const [statusIds, setStatusIds] = useState<number[]>([])

  const range = useMemo(
    () => rangeForPreset(preset, { from: customFrom, to: customTo }),
    [preset, customFrom, customTo],
  )

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId],
  )

  // Quando troca de pipeline, limpa status que não pertencem a ele.
  useEffect(() => {
    if (!selectedPipeline) {
      setStatusIds([])
      return
    }
    const valid = new Set(selectedPipeline.statuses.map((s) => s.id))
    setStatusIds((prev) => prev.filter((id) => valid.has(id)))
  }, [selectedPipeline])

  async function run() {
    setRunning(true)
    try {
      const opts: KommoSyncOptions = {
        limit,
        query: query || undefined,
        createdAtFrom: range.from,
        createdAtTo: range.to,
      }
      if (pipelineId) opts.pipelineId = pipelineId
      if (statusIds.length > 0) opts.statusIds = statusIds
      const j = await kommoApi.sync(empresaId, opts)
      const filterLabel =
        selectedPipeline ? ` · pipeline ${selectedPipeline.name}${statusIds.length ? ` (${statusIds.length} status)` : ''}` : ''
      onResult({
        kind: 'success',
        msg: `Sync concluído (${range.label.toLowerCase()}${filterLabel}): ${j.received} recebidos, ${j.stored} novos na inbox.`,
      })
    } catch (err) {
      onResult({ kind: 'error', msg: err instanceof Error ? err.message : 'Erro desconhecido.' })
    } finally {
      setRunning(false)
    }
  }

  const presets: { id: DatePreset; label: string; hint: string }[] = [
    { id: 'hoje', label: 'Hoje', hint: 'Leads criados hoje' },
    { id: 'ontem', label: 'Ontem', hint: 'Apenas o dia de ontem' },
    { id: '7d', label: '7 dias', hint: 'Últimos 7 dias' },
    { id: '30d', label: '30 dias', hint: 'Últimos 30 dias' },
    { id: 'mes', label: 'Mês', hint: 'Mês atual' },
    { id: 'tudo', label: 'Tudo', hint: 'Sem filtro de data' },
    { id: 'custom', label: 'Custom', hint: 'Escolher datas manualmente' },
  ]

  return (
    <div className="space-y-5">
      {!configured && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.05] px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-100/90">
            Configure as credenciais na aba <strong>Configuração</strong> antes de sincronizar.
          </p>
        </div>
      )}

      {/* Período */}
      <div className="rounded-3xl border border-white/5 bg-[#15171b] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-400/30 grid place-items-center">
            <CalendarRange className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-bold text-white">Período</h3>
            <p className="text-[12px] text-white/55">
              Filtra pelo <code className="text-cyan-300">created_at</code> da Kommo. Atalhos cobrem
              os recortes mais comuns.
            </p>
          </div>
          <span className="text-[11px] uppercase tracking-wider font-bold text-cyan-200 bg-cyan-500/10 border border-cyan-400/30 px-2 py-1 rounded-md">
            {range.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-3">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              title={p.hint}
              className={cn(
                'h-10 px-2 rounded-xl border text-[12px] font-semibold transition-colors',
                preset === p.id
                  ? 'bg-cyan-500/15 text-cyan-200 border-cyan-400/40'
                  : 'bg-[#0c0d10] text-white/65 border-white/10 hover:text-white hover:border-white/20',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/5">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">De</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Até</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50"
              />
            </div>
          </div>
        )}

        {(range.from || range.to) && (
          <p className="text-[11px] text-white/45 mt-3 font-mono">
            {range.from && <>de <span className="text-white/75">{new Date(range.from).toLocaleString('pt-BR')}</span></>}
            {range.to && <> · até <span className="text-white/75">{new Date(range.to).toLocaleString('pt-BR')}</span></>}
          </p>
        )}
      </div>

      {/* Pipeline + status filter */}
      <div className="rounded-3xl border border-white/5 bg-[#15171b] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-400/30 grid place-items-center">
            <Filter className="h-5 w-5 text-violet-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-bold text-white">Pipeline e status</h3>
            <p className="text-[12px] text-white/55">
              Limita o sync a um funil/etapa específicos. Vazio = todos.
            </p>
          </div>
          {pipelineId !== '' && (
            <button
              onClick={() => {
                setPipelineId('')
                setStatusIds([])
              }}
              className="text-[11px] text-white/55 hover:text-white"
            >
              Limpar
            </button>
          )}
        </div>

        {!pipelinesSupported ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.04] px-3 py-2 text-[12px] text-amber-100/85 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Endpoint <code className="text-amber-300">GET /kommo/pipelines</code> ainda não foi implementado em <strong>CadastraAi.API</strong>.
              Sem ele, o sync busca de todos os pipelines. Implemente o endpoint para liberar este filtro.
            </p>
          </div>
        ) : pipelines.length === 0 ? (
          <p className="text-[12px] text-white/55">
            Nenhum pipeline retornado. Configure as credenciais e teste a conexão primeiro.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Pipeline</label>
              <select
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value ? Number(e.target.value) : '')}
                className="mt-1 w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50"
              >
                <option value="">Todos os pipelines</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.isMain ? ' (principal)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
                Status {statusIds.length > 0 && <span className="text-cyan-300 ml-1">({statusIds.length} selecionados)</span>}
              </label>
              {!selectedPipeline ? (
                <p className="mt-1 text-[12px] text-white/45 h-10 px-3 grid items-center rounded-xl bg-[#0c0d10] border border-dashed border-white/10">
                  Selecione um pipeline primeiro.
                </p>
              ) : (
                <div className="mt-1 max-h-32 overflow-y-auto rounded-xl bg-[#0c0d10] border border-white/10 p-2 space-y-1">
                  {selectedPipeline.statuses.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/[0.03] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={statusIds.includes(s.id)}
                        onChange={(e) => {
                          setStatusIds((prev) =>
                            e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                          )
                        }}
                        className="accent-cyan-500"
                      />
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: s.color || '#666' }}
                      />
                      <span className="text-[12px] text-white/85 truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quantidade + busca */}
      <div className="rounded-3xl border border-white/5 bg-[#15171b] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-400/30 grid place-items-center">
            <RefreshCw className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-white">Sincronização (pull)</h3>
            <p className="text-[12px] text-white/55">Backend chama /api/v4/leads na Kommo e popula a inbox.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Quantidade</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="mt-1 w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50"
            >
              <option value={10}>10 leads</option>
              <option value={50}>50 leads</option>
              <option value={100}>100 leads</option>
              <option value={250}>250 leads (máx)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Busca livre (opcional)</label>
            <div className="mt-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar por nome ou telefone na Kommo…"
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#0c0d10] border border-white/10 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-cyan-400/50"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={run}
            disabled={!configured || running || (preset === 'custom' && !customFrom)}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#0d0f14] text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', running && 'animate-spin')} />
            {running ? 'Sincronizando…' : `Sincronizar ${range.label.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ----- INBOX TAB -----

function InboxTab({
  empresaId,
  items,
  loading,
  onRefresh,
  onFeedback,
}: {
  empresaId: string
  items: KommoInboxItemDto[]
  loading: boolean
  onRefresh: () => void
  onFeedback: (f: { kind: 'success' | 'error' | 'info'; msg: string }) => void
}) {
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pending' | 'imported' | 'discarded'>('pending')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)

  const filtered = useMemo(
    () => (statusFilter === 'todos' ? items : items.filter((i) => i.status === statusFilter)),
    [items, statusFilter],
  )

  // Apenas pendentes podem ser promovidos em massa.
  const selectablePending = useMemo(
    () => filtered.filter((i) => i.status === 'pending'),
    [filtered],
  )
  const selectedPendingItems = useMemo(
    () => selectablePending.filter((i) => selectedIds.has(i.id)),
    [selectablePending, selectedIds],
  )
  const allSelected =
    selectablePending.length > 0 && selectablePending.every((i) => selectedIds.has(i.id))

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(selectablePending.map((i) => i.id)))
  }

  async function bulkPromote() {
    if (selectedPendingItems.length === 0) return
    if (
      !confirm(
        `Promover ${selectedPendingItems.length} lead${selectedPendingItems.length === 1 ? '' : 's'} usando o auto-mapeamento? Campos obrigatórios faltantes serão preenchidos com defaults neutros.`,
      )
    ) {
      return
    }
    setBulkRunning(true)
    try {
      const payloads = selectedPendingItems.map((it) => {
        const parsed = (() => {
          try {
            return JSON.parse(it.raw)
          } catch {
            return null
          }
        })()
        const analysis = parsed
          ? analyzeKommoLead({
              lead: parsed.lead ?? parsed,
              contact: parsed.contact ?? null,
            })
          : null
        const lead: CreateLeadPayload = {
          nome: String(analysis?.suggestedPayload.nome ?? `Lead Kommo ${it.kommoLeadId ?? it.id.slice(0, 6)}`),
          telefone: String(analysis?.suggestedPayload.telefone ?? '—'),
          origem: String(analysis?.suggestedPayload.origem ?? 'Kommo'),
          tipo: analysis?.suggestedPayload.tipo === 'Resgate' ? 'Resgate' : 'Cadastro',
          tipoResgate: analysis?.suggestedPayload.tipoResgate
            ? String(analysis.suggestedPayload.tipoResgate)
            : undefined,
          interacao: !!analysis?.suggestedPayload.interacao,
          agendouConsulta: !!analysis?.suggestedPayload.agendouConsulta,
          pagamentoAntecipado: !!analysis?.suggestedPayload.pagamentoAntecipado,
          dataAgendamento: analysis?.suggestedPayload.dataAgendamento
            ? String(analysis.suggestedPayload.dataAgendamento)
            : undefined,
          motivoNaoAgendamento: analysis?.suggestedPayload.motivoNaoAgendamento
            ? String(analysis.suggestedPayload.motivoNaoAgendamento)
            : undefined,
          nomeResponsavel: String(analysis?.suggestedPayload.nomeResponsavel ?? 'A definir'),
        }
        return { itemId: it.id, lead }
      })
      const result = await kommoApi.bulkPromote(empresaId, payloads)
      setSelectedIds(new Set())
      onRefresh()
      if (result.failed.length === 0) {
        onFeedback({
          kind: 'success',
          msg: `${result.ok.length} lead${result.ok.length === 1 ? '' : 's'} promovido${result.ok.length === 1 ? '' : 's'} com sucesso.`,
        })
      } else {
        onFeedback({
          kind: 'error',
          msg: `${result.ok.length} promovidos, ${result.failed.length} falharam. Veja a inbox para detalhes.`,
        })
      }
    } finally {
      setBulkRunning(false)
    }
  }

  async function clearAll() {
    if (!confirm('Apagar todos os itens da inbox? (não afeta leads já importados)')) return
    await kommoApi.clearInbox(empresaId)
    onRefresh()
    onFeedback({ kind: 'info', msg: 'Inbox limpa.' })
  }

  // #9: descarta pendentes mais antigos que N dias. Mantém imported e os recentes.
  async function discardOldPending(days: number) {
    if (
      !confirm(
        `Descartar pendentes com mais de ${days} dia${days === 1 ? '' : 's'}? Itens importados não são afetados.`,
      )
    ) {
      return
    }
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
    try {
      const r = await kommoApi.bulkDiscard(empresaId, { olderThan: cutoff, status: 'pending' })
      onFeedback({ kind: 'info', msg: `${r.deleted} item(ns) descartado(s).` })
      onRefresh()
    } catch (err) {
      // Backend pendente: fallback que itera no client.
      if (isBackendNotImplemented(err)) {
        const old = items.filter(
          (i) => i.status === 'pending' && new Date(i.receivedAt).getTime() < Date.now() - days * 86_400_000,
        )
        for (const it of old) {
          await kommoApi.patchItem(empresaId, it.id, { status: 'discarded' }).catch(() => null)
        }
        onFeedback({ kind: 'info', msg: `${old.length} item(ns) descartado(s) (modo client — implemente bulk-discard).` })
        onRefresh()
        return
      }
      onFeedback({ kind: 'error', msg: err instanceof Error ? err.message : 'Falha ao descartar.' })
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className="rounded-3xl border border-white/5 bg-[#15171b] p-6">
        <p className="text-white/55 text-sm">Carregando inbox…</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
        <Inbox className="h-7 w-7 text-white/30 mx-auto mb-3" />
        <p className="text-[15px] font-semibold text-white/85 mb-1">Inbox vazia</p>
        <p className="text-[13px] text-white/55">
          Configure o webhook ou faça uma sincronização para começar a receber leads da Kommo.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-2">
          {(['pending', 'imported', 'discarded', 'todos'] as const).map((s) => {
            const count = s === 'todos' ? items.length : items.filter((i) => i.status === s).length
            const label = s === 'pending' ? 'Pendentes' : s === 'imported' ? 'Importados' : s === 'discarded' ? 'Descartados' : 'Todos'
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-[12px] transition-colors',
                  statusFilter === s
                    ? 'bg-cyan-500/15 text-cyan-200 border-cyan-400/40'
                    : 'bg-[#0c0d10] text-white/55 border-white/10 hover:text-white hover:border-white/20',
                )}
              >
                <span className="font-semibold">{label}</span>
                <span className="text-[11px] tabular-nums opacity-80">{count}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-[13px] text-white/70 hover:text-white hover:border-white/20 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Atualizar
          </button>
          {/* #9: descartar antigos — dropdown nativo para escolher janela */}
          <details className="relative">
            <summary className="list-none cursor-pointer inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-amber-400/30 bg-amber-500/[0.05] text-amber-200 text-[13px] hover:bg-amber-500/15 transition-colors">
              <Trash2 className="h-4 w-4" />
              Descartar antigos
            </summary>
            <div className="absolute right-0 mt-2 z-10 rounded-xl border border-white/10 bg-[#15171b] shadow-2xl p-1.5 w-56">
              <p className="text-[10px] uppercase tracking-wider text-white/45 px-2 pt-1 pb-1.5 font-semibold">
                Marcar como descartado
              </p>
              {[
                { d: 7, label: 'Pendentes &gt; 7 dias' },
                { d: 14, label: 'Pendentes &gt; 14 dias' },
                { d: 30, label: 'Pendentes &gt; 30 dias' },
                { d: 90, label: 'Pendentes &gt; 90 dias' },
              ].map((opt) => (
                <button
                  key={opt.d}
                  onClick={() => discardOldPending(opt.d)}
                  className="w-full text-left px-2 py-1.5 rounded-md text-[12px] text-white/85 hover:bg-white/[0.06] transition-colors"
                  dangerouslySetInnerHTML={{ __html: opt.label }}
                />
              ))}
            </div>
          </details>
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-rose-400/30 bg-rose-500/[0.06] text-rose-300 text-[13px] hover:bg-rose-500/15 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Limpar inbox
          </button>
        </div>
      </div>

      {/* Bulk action bar — só aparece quando filtro inclui pendentes */}
      {(statusFilter === 'pending' || statusFilter === 'todos') && selectablePending.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-[#0c0d10] px-4 py-2.5 mb-3 flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="accent-cyan-500 h-4 w-4"
            />
            <span className="text-[12px] text-white/65">
              {selectedIds.size === 0
                ? `Selecionar todos (${selectablePending.length})`
                : `${selectedIds.size} de ${selectablePending.length} selecionados`}
            </span>
          </label>
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] text-white/55 hover:text-white"
              >
                Limpar seleção
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={bulkPromote}
                  disabled={bulkRunning}
                  className="inline-flex items-center gap-2 px-4 h-9 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#0d0f14] text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Sparkles className={cn('h-4 w-4', bulkRunning && 'animate-pulse')} />
                  {bulkRunning ? 'Promovendo…' : `Promover ${selectedIds.size} com defaults`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <ul className="space-y-3">
        {filtered.map((item) => (
          <InboxRow
            key={item.id}
            empresaId={empresaId}
            item={item}
            expanded={expanded === item.id}
            selected={selectedIds.has(item.id)}
            selectable={item.status === 'pending'}
            onToggleSelect={(c) => toggleSelect(item.id, c)}
            onToggle={() => setExpanded((cur) => (cur === item.id ? null : item.id))}
            onChanged={onRefresh}
            onFeedback={onFeedback}
          />
        ))}
      </ul>
    </div>
  )
}

function parseRaw(raw: string): { lead?: unknown; contact?: unknown } | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function InboxRow({
  empresaId,
  item,
  expanded,
  selected,
  selectable,
  onToggleSelect,
  onToggle,
  onChanged,
  onFeedback,
}: {
  empresaId: string
  item: KommoInboxItemDto
  expanded: boolean
  selected: boolean
  selectable: boolean
  onToggleSelect: (checked: boolean) => void
  onToggle: () => void
  onChanged: () => void
  onFeedback: (f: { kind: 'success' | 'error' | 'info'; msg: string }) => void
}) {
  const analysis = useMemo<AnalyzeResult | null>(() => {
    const parsed = parseRaw(item.raw)
    if (!parsed) return null
    try {
      if (parsed.lead) {
        return analyzeKommoLead({
          lead: parsed.lead as Parameters<typeof analyzeKommoLead>[0]['lead'],
          contact: (parsed.contact as Parameters<typeof analyzeKommoLead>[0]['contact']) ?? null,
        })
      }
      return analyzeKommoLead({
        lead: parsed as Parameters<typeof analyzeKommoLead>[0]['lead'],
        contact: null,
      })
    } catch {
      return null
    }
  }, [item.raw])

  const completeness = analysis?.completeness ?? 0

  return (
    <li
      className={cn(
        'rounded-2xl border bg-[#15171b] overflow-hidden transition-colors',
        selected ? 'border-cyan-400/50' : 'border-white/5',
      )}
    >
      <div className="flex items-stretch">
        {selectable && (
          <label
            className="flex items-center pl-4 pr-1 cursor-pointer hover:bg-white/[0.02]"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onToggleSelect(e.target.checked)}
              className="accent-cyan-500 h-4 w-4"
            />
          </label>
        )}
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
        >
        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-400/30 grid place-items-center shrink-0">
          {item.source === 'webhook' ? <Webhook className="h-4 w-4 text-cyan-300" /> : <RefreshCw className="h-4 w-4 text-cyan-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[14px] font-semibold text-white truncate">
              {analysis?.displayName ?? `Item #${item.id.slice(0, 8)}`}
            </p>
            <StatusBadge status={item.status} />
            {item.kommoLeadId != null && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-white/45 bg-white/[0.04] border border-white/10 px-1.5 py-0.5 rounded-md">
                Kommo #{item.kommoLeadId}
              </span>
            )}
          </div>
          <p className="text-[12px] text-white/55 truncate">
            {item.source === 'webhook' ? 'Recebido por webhook' : 'Recebido por sync'} · {formatDateTime(item.receivedAt)}
            {item.note ? ` · ${item.note}` : ''}
          </p>
        </div>
        {analysis && (
          <div className="hidden sm:flex flex-col items-end gap-1 mr-2">
            <CompletenessBar value={completeness} />
            <span className="text-[10px] text-white/45">{completeness}% mapeado</span>
          </div>
        )}
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-white/45 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/45 shrink-0" />
        )}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-white/5 p-4">
          {analysis ? (
            <GapAnalysisPanel
              empresaId={empresaId}
              item={item}
              analysis={analysis}
              onChanged={onChanged}
              onFeedback={onFeedback}
            />
          ) : (
            <RawPayloadPanel empresaId={empresaId} item={item} onChanged={onChanged} onFeedback={onFeedback} />
          )}
        </div>
      )}
    </li>
  )
}

function StatusBadge({ status }: { status: KommoInboxItemDto['status'] }) {
  if (status === 'imported') {
    return (
      <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> Importado
      </span>
    )
  }
  if (status === 'discarded') {
    return (
      <span className="text-[10px] uppercase tracking-wider font-bold text-white/55 bg-white/[0.04] border border-white/10 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
        <XCircle className="h-3 w-3" /> Descartado
      </span>
    )
  }
  return (
    <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-200 bg-cyan-500/10 border border-cyan-400/30 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
      <Sparkles className="h-3 w-3" /> Pendente
    </span>
  )
}

function CompletenessBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-emerald-400' : value >= 50 ? 'bg-amber-300' : 'bg-rose-400'
  return (
    <div className="h-1.5 w-32 rounded-full bg-white/[0.06] overflow-hidden">
      <div className={cn('h-full transition-all', color)} style={{ width: `${value}%` }} />
    </div>
  )
}

function GapAnalysisPanel({
  empresaId,
  item,
  analysis,
  onChanged,
  onFeedback,
}: {
  empresaId: string
  item: KommoInboxItemDto
  analysis: AnalyzeResult
  onChanged: () => void
  onFeedback: (f: { kind: 'success' | 'error' | 'info'; msg: string }) => void
}) {
  const [overrides, setOverrides] = useState<Partial<Record<TargetField, unknown>>>({})
  const [importing, setImporting] = useState(false)
  const [highlightField, setHighlightField] = useState<TargetField | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  // #10: dedup por telefone — checa se telefone já existe no Cadastro.
  const [duplicates, setDuplicates] = useState<LeadDuplicateMatchDto[]>([])

  // Tour: roda na primeira vez que o usuário expande um item.
  useEffect(() => {
    if (!hasSeenTour()) {
      setTourOpen(true)
      markTourSeen()
    }
  }, [])

  const effective: Partial<CreateLeadPayload> = useMemo(() => {
    return { ...analysis.suggestedPayload, ...overrides } as Partial<CreateLeadPayload>
  }, [analysis.suggestedPayload, overrides])

  // #10: detecção de duplicatas — debounced, só roda quando há telefone identificado.
  useEffect(() => {
    if (item.status !== 'pending') return
    const tel = (effective.telefone as string | undefined)?.toString().trim()
    if (!tel || tel === '—' || tel.replace(/\D/g, '').length < 6) {
      setDuplicates([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      leadsApi
        .searchByPhone(empresaId, tel)
        .then((dups) => {
          if (!cancelled) setDuplicates(dups)
        })
        .catch(() => {
          if (!cancelled) setDuplicates([])
        })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [empresaId, item.status, effective.telefone])

  const stillMissingRequired = useMemo(() => {
    return TARGETS.filter(
      (t) =>
        t.required &&
        ((effective as Record<string, unknown>)[t.field] == null ||
          (effective as Record<string, unknown>)[t.field] === ''),
    )
  }, [effective])

  const stillMissingOptional = useMemo(() => {
    return TARGETS.filter(
      (t) =>
        !t.required &&
        ((effective as Record<string, unknown>)[t.field] == null ||
          (effective as Record<string, unknown>)[t.field] === ''),
    )
  }, [effective])

  const lowConfidenceMatches = useMemo(() => {
    const out: TargetField[] = []
    for (const t of TARGETS) {
      const m = analysis.matches.get(t.field)
      if (m && m.confidence < 0.7 && overrides[t.field] === undefined) out.push(t.field)
    }
    return out
  }, [analysis.matches, overrides])

  const canImport = stillMissingRequired.length === 0 && item.status === 'pending'

  // Próximo passo claro pra guiar o usuário
  const nextStep = useMemo(() => {
    if (item.status !== 'pending') return null
    if (stillMissingRequired.length > 0) {
      return {
        kind: 'fill-required' as const,
        title: `Preencha ${stillMissingRequired.length} campo${stillMissingRequired.length === 1 ? '' : 's'} obrigatório${stillMissingRequired.length === 1 ? '' : 's'}`,
        description: stillMissingRequired.map((t) => t.label).join(', '),
        target: stillMissingRequired[0].field,
      }
    }
    if (lowConfidenceMatches.length > 0) {
      return {
        kind: 'verify-low-confidence' as const,
        title: `Revise ${lowConfidenceMatches.length} campo${lowConfidenceMatches.length === 1 ? '' : 's'} com confiança baixa`,
        description: 'O sistema fez sua melhor adivinhação, mas vale conferir antes de promover.',
        target: lowConfidenceMatches[0],
      }
    }
    return {
      kind: 'ready' as const,
      title: 'Pronto para promover!',
      description: 'Todos os campos obrigatórios estão preenchidos. Clique em "Promover para lead".',
      target: null,
    }
  }, [item.status, stillMissingRequired, lowConfidenceMatches])

  function fillRequiredDefaults() {
    const next: Partial<Record<TargetField, unknown>> = { ...overrides }
    for (const t of stillMissingRequired) {
      if (t.field === 'nome') next.nome = analysis.displayName || 'Lead Kommo'
      else if (t.field === 'telefone') next.telefone = '—'
      else if (t.field === 'origem') next.origem = 'Kommo'
      else if (t.field === 'tipo') next.tipo = 'Cadastro'
      else if (t.field === 'nomeResponsavel') next.nomeResponsavel = 'A definir'
      else if (t.field === 'interacao') next.interacao = false
      else if (t.field === 'agendouConsulta') next.agendouConsulta = false
      else if (t.field === 'pagamentoAntecipado') next.pagamentoAntecipado = false
      else next[t.field] = '—'
    }
    setOverrides(next)
  }

  function focusOn(field: TargetField) {
    setHighlightField(field)
    document.getElementById(`gap-row-${item.id}-${field}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setHighlightField(null), 2000)
  }

  async function importNow() {
    if (!canImport) return
    setImporting(true)
    try {
      const payload: CreateLeadPayload = {
        nome: String(effective.nome ?? ''),
        telefone: String(effective.telefone ?? ''),
        origem: String(effective.origem ?? 'Kommo'),
        tipo: effective.tipo === 'Resgate' ? 'Resgate' : 'Cadastro',
        tipoResgate: effective.tipoResgate ? String(effective.tipoResgate) : undefined,
        interacao: !!effective.interacao,
        agendouConsulta: !!effective.agendouConsulta,
        pagamentoAntecipado: !!effective.pagamentoAntecipado,
        dataAgendamento: effective.dataAgendamento ? String(effective.dataAgendamento) : undefined,
        motivoNaoAgendamento: effective.motivoNaoAgendamento ? String(effective.motivoNaoAgendamento) : undefined,
        nomeResponsavel: String(effective.nomeResponsavel ?? '—'),
      }
      const created = await kommoApi.promote(empresaId, item.id, payload)
      onFeedback({ kind: 'success', msg: `Lead "${created.nome}" criado no sistema.` })

      // #8: webhook bidirecional — grava o ID do Cadastro no custom_field da Kommo
      // para fechar o loop. Falha silenciosa: se o backend ainda não implementou, OK.
      if (item.kommoLeadId != null) {
        kommoApi
          .linkCadastroId(empresaId, item.kommoLeadId, created.id)
          .catch(() => null)
      }
      onChanged()
    } catch (err) {
      onFeedback({ kind: 'error', msg: err instanceof Error ? err.message : 'Falha ao importar.' })
    } finally {
      setImporting(false)
    }
  }

  async function discard() {
    await kommoApi.patchItem(empresaId, item.id, { status: 'discarded' })
    onFeedback({ kind: 'info', msg: 'Item marcado como descartado.' })
    onChanged()
  }

  async function remove() {
    if (!confirm('Remover este item da inbox?')) return
    await kommoApi.deleteItem(empresaId, item.id)
    onChanged()
  }

  // Stepper de 3 passos: Revisar → Preencher → Promover.
  // Passo 1 ("Revisar") fica done assim que houve análise. O passo "ativo" é 2 ou 3.
  const reviewDone = analysis.matches.size > 0
  const fillDone = stillMissingRequired.length === 0
  const promoteDone = item.status === 'imported'
  const currentStep: 2 | 3 =
    item.status !== 'pending' ? 3 : stillMissingRequired.length > 0 ? 2 : 3

  return (
    <div className="space-y-4 relative">
      {tourOpen && (
        <TourOverlay steps={KOMMO_TOUR_STEPS} onClose={() => setTourOpen(false)} />
      )}

      {/* Stepper visual de 3 passos */}
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.04] p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 grid place-items-center shrink-0">
            <Lightbulb className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <p className="text-[12px] uppercase tracking-[0.18em] text-cyan-200/85 font-semibold">
                Como funciona este painel
              </p>
              <button
                onClick={() => {
                  resetTour()
                  setTourOpen(true)
                }}
                title="Re-abrir o tour guiado"
                className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Ver tour
              </button>
            </div>
            <p className="text-[13px] text-white/85 leading-relaxed">
              Cada linha abaixo é um campo do <strong>seu sistema de cadastro</strong>. Cores: {' '}
              <span className="text-emerald-300 font-semibold">verde</span> = detectado com alta confiança.{' '}
              <span className="text-amber-300 font-semibold">amarelo</span> = palpite que vale conferir.{' '}
              <span className="text-rose-300 font-semibold">vermelho</span> = obrigatório faltando.{' '}
              <span className="text-violet-300 font-semibold">roxo</span> = você editou manualmente.
            </p>
          </div>
        </div>

        {/* Stepper 1-2-3 */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center" data-tour-step="progress">
          <StepperStep
            num={1}
            label="Revisar"
            sub={`${analysis.matches.size}/${TARGETS.length} campos detectados`}
            active={false}
            done={reviewDone}
          />
          <StepperConnector done={fillDone} />
          <StepperStep
            num={2}
            label="Preencher"
            sub={
              stillMissingRequired.length === 0
                ? 'Obrigatórios prontos'
                : `${stillMissingRequired.length} obrigatório${stillMissingRequired.length === 1 ? '' : 's'} faltando`
            }
            active={currentStep === 2}
            done={fillDone}
          />
          <StepperConnector done={promoteDone} />
          <StepperStep
            num={3}
            label="Promover"
            sub={`Completude ${analysis.completeness}%`}
            active={currentStep === 3 && !promoteDone}
            done={promoteDone}
          />
        </div>
      </div>

      {/* #10: banner de duplicata — telefone já existe no Cadastro */}
      {duplicates.length > 0 && item.status === 'pending' && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/[0.07] p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/15 grid place-items-center text-amber-300 shrink-0">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-amber-200 mb-0.5">
                {duplicates.length === 1
                  ? 'Já existe um lead com este telefone'
                  : `Encontrados ${duplicates.length} leads com este telefone`}
              </p>
              <p className="text-[12px] text-white/70 mb-2">
                Confirme antes de promover — você pode estar duplicando um lead já cadastrado.
              </p>
              <ul className="space-y-1">
                {duplicates.slice(0, 3).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 text-[12px] rounded-lg bg-[#0c0d10] border border-white/5 px-3 py-2"
                  >
                    <span className="font-semibold text-white truncate flex-1">{d.nome}</span>
                    <span className="text-white/55 tabular-nums">{d.telefone}</span>
                    <span className="text-[10px] text-white/35 tabular-nums">
                      {new Date(d.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </li>
                ))}
                {duplicates.length > 3 && (
                  <li className="text-[11px] text-white/45 px-2">
                    +{duplicates.length - 3} outro(s)…
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Próximo passo - banner CTA */}
      {nextStep && (
        <div
          data-tour-step="next-step"
          className={cn(
            'rounded-2xl border p-4 flex items-start gap-3 transition-colors',
            nextStep.kind === 'ready'
              ? 'border-emerald-400/30 bg-emerald-500/[0.06]'
              : nextStep.kind === 'fill-required'
                ? 'border-rose-400/30 bg-rose-500/[0.06]'
                : 'border-amber-400/30 bg-amber-500/[0.06]',
          )}
        >
          <div
            className={cn(
              'h-9 w-9 rounded-xl grid place-items-center shrink-0',
              nextStep.kind === 'ready'
                ? 'bg-emerald-500/15 text-emerald-300'
                : nextStep.kind === 'fill-required'
                  ? 'bg-rose-500/15 text-rose-300'
                  : 'bg-amber-500/15 text-amber-300',
            )}
          >
            {nextStep.kind === 'ready' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-[13px] font-bold mb-0.5',
                nextStep.kind === 'ready' ? 'text-emerald-200' : nextStep.kind === 'fill-required' ? 'text-rose-200' : 'text-amber-200',
              )}
            >
              Próximo passo: {nextStep.title}
            </p>
            <p className="text-[12px] text-white/70">{nextStep.description}</p>
          </div>
          {nextStep.kind === 'fill-required' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => focusOn(nextStep.target!)}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white text-[12px] font-semibold transition-colors"
              >
                Ir para o campo
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={fillRequiredDefaults}
                title="Preenche os obrigatórios faltantes com '—' / valores neutros para você ajustar depois"
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/25 text-[12px] font-semibold transition-colors"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Preencher defaults
              </button>
            </div>
          )}
          {nextStep.kind === 'verify-low-confidence' && (
            <button
              onClick={() => focusOn(nextStep.target!)}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white text-[12px] font-semibold transition-colors shrink-0"
            >
              Revisar
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Lista de campos */}
      <div data-tour-step="field-row" className="rounded-2xl border border-white/5 bg-[#0c0d10] divide-y divide-white/5">
        {TARGETS.map((t) => {
          const match = analysis.matches.get(t.field)
          const overriden = overrides[t.field] !== undefined
          const value = (effective as Record<string, unknown>)[t.field]
          const filled = value != null && value !== ''
          const isMissingRequired = t.required && !filled
          const isLowConfidence = match && match.confidence < 0.7 && !overriden
          const highlighted = highlightField === t.field
          return (
            <div
              key={t.field}
              id={`gap-row-${item.id}-${t.field}`}
              className={cn(
                'px-4 py-3 flex items-start gap-3 transition-colors',
                highlighted && 'bg-cyan-500/[0.08]',
                isMissingRequired && 'bg-rose-500/[0.03]',
              )}
            >
              <div
                className={cn(
                  'h-7 w-7 grid place-items-center rounded-lg shrink-0 border',
                  filled
                    ? overriden
                      ? 'bg-violet-500/10 border-violet-400/30 text-violet-300'
                      : match
                        ? match.confidence >= 0.8
                          ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'
                          : 'bg-amber-500/10 border-amber-400/30 text-amber-300'
                        : 'bg-cyan-500/10 border-cyan-400/30 text-cyan-300'
                    : isMissingRequired
                      ? 'bg-rose-500/10 border-rose-400/30 text-rose-300'
                      : 'bg-white/[0.03] border-white/10 text-white/45',
                )}
              >
                {filled ? <Check className="h-3.5 w-3.5" /> : isMissingRequired ? <XCircle className="h-3.5 w-3.5" /> : <span className="text-[10px]">·</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-white">{t.label}</p>
                  {t.required && (
                    <span className="text-[9px] uppercase tracking-wider font-bold text-rose-300 bg-rose-500/10 border border-rose-400/20 px-1.5 py-0.5 rounded">
                      obrigatório
                    </span>
                  )}
                  {isLowConfidence && (
                    <span className="text-[9px] uppercase tracking-wider font-bold text-amber-300 bg-amber-500/10 border border-amber-400/20 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                      <AlertCircle className="h-2.5 w-2.5" />
                      conferir
                    </span>
                  )}
                  {match && (
                    <SourceTooltip match={match} dataTourStep="source-tooltip" />
                  )}
                  {overriden && (
                    <span className="text-[9px] uppercase tracking-wider font-bold text-violet-300 bg-violet-500/10 border border-violet-400/20 px-1.5 py-0.5 rounded">
                      manual
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/45 mb-1">
                  {t.hint}
                  {isMissingRequired && (
                    <span className="text-rose-300/85 ml-1.5 font-semibold">
                      ⚠ Necessário antes de promover.
                    </span>
                  )}
                </p>
                <FieldEditor
                  field={t.field}
                  value={value}
                  onChange={(v) => setOverrides((prev) => ({ ...prev, [t.field]: v }))}
                />
              </div>
            </div>
          )
        })}
      </div>

      {stillMissingOptional.length > 0 && (
        <p className="text-[11px] text-white/45 px-1">
          <Sparkles className="h-3 w-3 inline mr-1 text-cyan-400/60" />
          {stillMissingOptional.length} campo{stillMissingOptional.length === 1 ? '' : 's'} opcional
          {stillMissingOptional.length === 1 ? '' : 'is'} não detectado{stillMissingOptional.length === 1 ? '' : 's'} —
          o lead pode ser promovido sem eles.
        </p>
      )}

      {/* Ação final */}
      <div className="rounded-2xl border border-white/5 bg-[#0c0d10] p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {!canImport && stillMissingRequired.length > 0 && (
            <span className="text-[11px] text-amber-300">
              {stillMissingRequired.length} obrigatório{stillMissingRequired.length === 1 ? '' : 's'} faltando.
            </span>
          )}
          {canImport && (
            <span className="text-[11px] text-emerald-300 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tudo certo — pode promover
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {item.status === 'pending' && (
            <button
              onClick={discard}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-[12px] text-white/65 hover:text-white hover:border-white/20 transition-colors"
            >
              Descartar
            </button>
          )}
          <button
            onClick={remove}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-rose-400/30 bg-rose-500/[0.06] text-rose-300 text-[12px] hover:bg-rose-500/15 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remover
          </button>
          <button
            onClick={importNow}
            data-tour-step="promote"
            disabled={!canImport || importing}
            className="inline-flex items-center gap-2 px-5 h-9 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#0d0f14] text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            {importing ? 'Importando…' : 'Promover para lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProgressPill({ num, label, value, done }: { num: number; label: string; value: string; done: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 flex items-center gap-3',
        done ? 'border-emerald-400/30 bg-emerald-500/[0.06]' : 'border-white/10 bg-white/[0.02]',
      )}
    >
      <span
        className={cn(
          'h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold shrink-0',
          done ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-white/65',
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : num}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-white/55 font-semibold truncate">
          {label}
        </p>
        <p className={cn('text-[14px] font-bold tabular-nums', done ? 'text-emerald-200' : 'text-white/85')}>
          {value}
        </p>
      </div>
    </div>
  )
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: TargetField
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (field === 'interacao' || field === 'agendouConsulta' || field === 'pagamentoAntecipado') {
    const v = !!value
    return (
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => onChange(true)}
          className={cn(
            'h-8 px-3 rounded-lg text-[12px] border transition-colors',
            v ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' : 'bg-white/[0.03] text-white/55 border-white/10 hover:text-white',
          )}
        >
          Sim
        </button>
        <button
          onClick={() => onChange(false)}
          className={cn(
            'h-8 px-3 rounded-lg text-[12px] border transition-colors',
            !v ? 'bg-rose-500/15 text-rose-200 border-rose-400/30' : 'bg-white/[0.03] text-white/55 border-white/10 hover:text-white',
          )}
        >
          Não
        </button>
      </div>
    )
  }
  if (field === 'tipo') {
    const v = value === 'Resgate' ? 'Resgate' : 'Cadastro'
    return (
      <select
        value={v}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 px-3 rounded-lg bg-[#15171b] border border-white/10 text-[12px] text-white focus:outline-none focus:border-cyan-400/50"
      >
        <option value="Cadastro">Cadastro</option>
        <option value="Resgate">Resgate</option>
      </select>
    )
  }
  return (
    <input
      value={(value as string | undefined) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full h-9 px-3 rounded-lg bg-[#15171b] border border-white/10 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-cyan-400/50"
      placeholder="—"
    />
  )
}

function RawPayloadPanel({
  empresaId,
  item,
  onChanged,
  onFeedback,
}: {
  empresaId: string
  item: KommoInboxItemDto
  onChanged: () => void
  onFeedback: (f: { kind: 'success' | 'error' | 'info'; msg: string }) => void
}) {
  const formatted = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(item.raw), null, 2)
    } catch {
      return item.raw
    }
  }, [item.raw])
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.05] px-4 py-3 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
        <p className="text-[12px] text-amber-100/90">
          Não foi possível analisar este payload automaticamente. Inspecione abaixo e remova quando
          tiver certeza do que é.
        </p>
      </div>
      <pre className="text-[11px] font-mono bg-[#0c0d10] border border-white/5 p-3 rounded-xl text-white/65 max-h-64 overflow-auto whitespace-pre-wrap break-words">
        {formatted}
      </pre>
      <div className="flex justify-end">
        <button
          onClick={async () => {
            await kommoApi.deleteItem(empresaId, item.id)
            onFeedback({ kind: 'info', msg: 'Item removido.' })
            onChanged()
          }}
          className="inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-rose-400/30 bg-rose-500/[0.06] text-rose-300 text-[12px] hover:bg-rose-500/15 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remover
        </button>
      </div>
    </div>
  )
}

// ----- STEPPER -----

function StepperStep({
  num,
  label,
  sub,
  active,
  done,
}: {
  num: number
  label: string
  sub: string
  active: boolean
  done: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 col-span-1 transition-colors',
        done
          ? 'border-emerald-400/30 bg-emerald-500/[0.06]'
          : active
            ? 'border-cyan-400/40 bg-cyan-500/[0.07] shadow-[0_0_0_1px_rgba(34,211,238,0.18)]'
            : 'border-white/10 bg-white/[0.02]',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold shrink-0',
            done
              ? 'bg-emerald-400 text-emerald-950'
              : active
                ? 'bg-cyan-400 text-cyan-950'
                : 'bg-white/10 text-white/65',
          )}
        >
          {done ? <Check className="h-3.5 w-3.5" /> : num}
        </span>
        <span
          className={cn(
            'text-[13px] font-semibold truncate',
            done ? 'text-emerald-200' : active ? 'text-cyan-100' : 'text-white/85',
          )}
        >
          {label}
        </span>
      </div>
      <p className="text-[10px] text-white/55 mt-1 truncate">{sub}</p>
    </div>
  )
}

function StepperConnector({ done }: { done: boolean }) {
  return (
    <div className="hidden sm:flex items-center justify-center col-span-1 h-full">
      <div className={cn('h-0.5 w-full rounded-full', done ? 'bg-emerald-400/40' : 'bg-white/10')} />
    </div>
  )
}

// ----- SOURCE TOOLTIP por campo -----

function SourceTooltip({
  match,
  dataTourStep,
}: {
  match: { source: string; rawKey?: string; confidence: number; rawValue: unknown }
  dataTourStep?: string
}) {
  const [open, setOpen] = useState(false)
  const sourceLabel = match.rawKey ? `${match.source}.${match.rawKey}` : match.source
  return (
    <span
      data-tour-step={dataTourStep}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      className="relative inline-flex items-center text-[10px] text-white/45 font-mono cursor-help"
    >
      <span className="text-cyan-300">{sourceLabel}</span>
      <span className="ml-1">· {Math.round(match.confidence * 100)}%</span>
      {open && (
        <span className="absolute z-30 left-0 top-full mt-1 min-w-[220px] max-w-[320px] rounded-xl border border-white/10 bg-[#0c0d10] shadow-[0_8px_24px_rgba(0,0,0,0.45)] p-3 text-[11px] text-white/85 whitespace-normal">
          <span className="block text-[9px] uppercase tracking-wider text-white/45 font-bold mb-1">
            origem no payload Kommo
          </span>
          <span className="block font-mono text-cyan-300 break-all">{sourceLabel}</span>
          <span className="block mt-2 text-[9px] uppercase tracking-wider text-white/45 font-bold">valor cru</span>
          <span className="block font-mono text-white/85 break-all">
            {typeof match.rawValue === 'object'
              ? JSON.stringify(match.rawValue)
              : String(match.rawValue)}
          </span>
          <span className="block mt-2 text-[9px] uppercase tracking-wider text-white/45 font-bold">confiança</span>
          <span
            className={cn(
              'block font-bold',
              match.confidence >= 0.8 ? 'text-emerald-300' : match.confidence >= 0.6 ? 'text-amber-300' : 'text-rose-300',
            )}
          >
            {Math.round(match.confidence * 100)}% {match.confidence >= 0.8 ? '(alta)' : match.confidence >= 0.6 ? '(média)' : '(baixa, conferir)'}
          </span>
        </span>
      )}
    </span>
  )
}

// ----- TOUR overlay (primeira vez) -----

function TourOverlay({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const step = steps[idx]

  useEffect(() => {
    function compute() {
      if (typeof window === 'undefined') return
      const target = document.querySelector<HTMLElement>(`[data-tour-step="${step.id}"]`)
      if (!target) {
        setPos(null)
        return
      }
      const r = target.getBoundingClientRect()
      setPos({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height })
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [step.id])

  // Posição do tooltip baseada no placement.
  const tooltipStyle: React.CSSProperties = (() => {
    if (!pos) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    const placement = step.placement ?? 'bottom'
    if (placement === 'top') {
      return { top: pos.top - 12, left: pos.left + pos.width / 2, transform: 'translate(-50%, -100%)' }
    }
    if (placement === 'left') {
      return { top: pos.top + pos.height / 2, left: pos.left - 12, transform: 'translate(-100%, -50%)' }
    }
    if (placement === 'right') {
      return { top: pos.top + pos.height / 2, left: pos.left + pos.width + 12, transform: 'translate(0, -50%)' }
    }
    return { top: pos.top + pos.height + 12, left: pos.left + pos.width / 2, transform: 'translate(-50%, 0)' }
  })()

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop com recorte do alvo */}
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" onClick={onClose} />
      {pos && (
        <div
          className="absolute rounded-2xl border-2 border-cyan-400 pointer-events-none transition-all duration-200"
          style={{
            top: pos.top - 4,
            left: pos.left - 4,
            width: pos.width + 8,
            height: pos.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="absolute z-10 max-w-sm w-[320px] rounded-2xl border border-cyan-400/40 bg-[#0c0d10] shadow-[0_24px_64px_rgba(0,0,0,0.6)] p-5 pointer-events-auto"
        style={tooltipStyle}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 h-7 w-7 grid place-items-center rounded-lg hover:bg-white/[0.06] text-white/55 hover:text-white"
          aria-label="Fechar tour"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/85 font-bold mb-2">
          Tour · {idx + 1}/{steps.length}
        </p>
        <h4 className="text-[15px] font-bold text-white mb-1">{step.title}</h4>
        <p className="text-[12px] text-white/75 leading-relaxed mb-4">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="inline-flex items-center gap-1 px-3 h-8 rounded-lg text-[12px] text-white/65 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === idx ? 'w-6 bg-cyan-400' : 'w-1.5 bg-white/15',
                )}
              />
            ))}
          </div>
          {idx < steps.length - 1 ? (
            <button
              onClick={() => setIdx((i) => i + 1)}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#0d0f14] text-[12px] font-semibold"
            >
              Próximo
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-[12px] font-semibold"
            >
              <Check className="h-3.5 w-3.5" />
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ----- AUTO-SYNC -----

function AutoSyncSection({
  empresaId,
  autoSync,
  supported,
  configured,
  onSaved,
  onError,
}: {
  empresaId: string
  autoSync: KommoAutoSyncDto | null
  supported: boolean
  configured: boolean
  onSaved: (cfg: KommoAutoSyncDto, msg: string) => void
  onError: (msg: string) => void
}) {
  const [enabled, setEnabled] = useState(autoSync?.enabled ?? false)
  const [interval, setInterval] = useState<AutoSyncInterval>(autoSync?.interval ?? '1h')
  const [limit, setLimit] = useState(autoSync?.limit ?? 100)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!autoSync) return
    setEnabled(autoSync.enabled)
    setInterval(autoSync.interval)
    setLimit(autoSync.limit)
  }, [autoSync])

  async function save() {
    if (!supported) {
      onError('Auto-sync ainda não suportado pelo CadastraAi.API. Implemente o BackgroundService.')
      return
    }
    setSaving(true)
    try {
      const cfg = await kommoApi.saveAutoSync(empresaId, {
        enabled,
        interval,
        limit,
        pipelineId: null,
        statusIds: null,
      })
      onSaved(cfg, enabled ? `Auto-sync ativado (a cada ${labelForInterval(interval)}).` : 'Auto-sync desativado.')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao salvar auto-sync.')
    } finally {
      setSaving(false)
    }
  }

  const intervals: { id: AutoSyncInterval; label: string; hint: string }[] = [
    { id: '15m', label: '15 minutos', hint: 'Quase em tempo real' },
    { id: '1h', label: '1 hora', hint: 'Recomendado pra fluxos comuns' },
    { id: '6h', label: '6 horas', hint: 'Quando volume é baixo' },
    { id: 'daily', label: 'Diário', hint: 'Uma rodada por dia' },
    { id: 'off', label: 'Desligado', hint: 'Apenas manual ou webhook' },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-400/30 grid place-items-center">
          <Timer className="h-5 w-5 text-emerald-300" />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-bold text-white">Auto-sync agendado</h3>
          <p className="text-[12px] text-white/55">
            Backend roda <code className="text-emerald-300">/sync</code> automaticamente no intervalo escolhido. Combina com webhook (catch-all) — se um lead novo escapar do webhook, o sync pega depois.
          </p>
        </div>
        {!supported && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-300 bg-amber-500/10 border border-amber-400/30 px-2 py-1 rounded-md">
            backend pendente
          </span>
        )}
      </div>

      <label className="flex items-center gap-3 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={!configured}
          className="accent-cyan-500 h-4 w-4"
        />
        <span className="text-[13px] text-white/85 font-semibold">
          {enabled ? 'Auto-sync ativado' : 'Auto-sync desativado'}
        </span>
        {autoSync?.lastRunAt && (
          <span className="text-[11px] text-white/45 ml-auto">
            Última rodada: {new Date(autoSync.lastRunAt).toLocaleString('pt-BR')}
          </span>
        )}
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {intervals.map((it) => (
          <button
            key={it.id}
            onClick={() => setInterval(it.id)}
            disabled={!enabled}
            title={it.hint}
            className={cn(
              'h-10 px-2 rounded-xl border text-[12px] font-semibold transition-colors',
              interval === it.id
                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40'
                : 'bg-[#0c0d10] text-white/65 border-white/10 hover:text-white hover:border-white/20',
              !enabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {it.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
            Limite por rodada
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            disabled={!enabled}
            className="mt-1 w-full h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50 disabled:opacity-50"
          >
            <option value={50}>50 leads</option>
            <option value={100}>100 leads</option>
            <option value={250}>250 leads (máx)</option>
          </select>
        </div>
        <div className="text-[11px] text-white/55 sm:col-span-1">
          {autoSync?.nextRunAt && enabled && (
            <p>
              <span className="text-white/45">Próxima rodada:</span>{' '}
              <span className="font-mono text-emerald-300">
                {new Date(autoSync.nextRunAt).toLocaleString('pt-BR')}
              </span>
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving || !configured}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Salvando…' : 'Salvar agendamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

function labelForInterval(i: AutoSyncInterval): string {
  return i === '15m' ? '15 min' : i === '1h' ? '1 h' : i === '6h' ? '6 h' : i === 'daily' ? '1 dia' : 'desligado'
}

// ----- MAPPING TAB (campos + responsáveis) -----

function MappingTab({
  empresaId,
  fieldMapping,
  responsibleMapping,
  tagMapping,
  users,
  fieldMappingSupported,
  responsibleMappingSupported,
  tagMappingSupported,
  usersSupported,
  onFieldMappingSaved,
  onResponsibleSaved,
  onTagMappingSaved,
  onError,
}: {
  empresaId: string
  fieldMapping: KommoFieldMappingDto | null
  responsibleMapping: KommoResponsibleMappingDto | null
  tagMapping: KommoTagMappingDto | null
  users: KommoUserDto[]
  fieldMappingSupported: boolean
  responsibleMappingSupported: boolean
  tagMappingSupported: boolean
  usersSupported: boolean
  onFieldMappingSaved: (m: KommoFieldMappingDto, msg: string) => void
  onResponsibleSaved: (m: KommoResponsibleMappingDto, msg: string) => void
  onTagMappingSaved: (m: KommoTagMappingDto, msg: string) => void
  onError: (msg: string) => void
}) {
  return (
    <div className="space-y-5">
      <FieldMappingEditor
        empresaId={empresaId}
        mapping={fieldMapping}
        supported={fieldMappingSupported}
        onSaved={onFieldMappingSaved}
        onError={onError}
      />
      <ResponsibleMappingEditor
        empresaId={empresaId}
        mapping={responsibleMapping}
        users={users}
        supported={responsibleMappingSupported}
        usersSupported={usersSupported}
        onSaved={onResponsibleSaved}
        onError={onError}
      />
      <TagMappingEditor
        empresaId={empresaId}
        mapping={tagMapping}
        supported={tagMappingSupported}
        onSaved={onTagMappingSaved}
        onError={onError}
      />
    </div>
  )
}

function TagMappingEditor({
  empresaId,
  mapping,
  supported,
  onSaved,
  onError,
}: {
  empresaId: string
  mapping: KommoTagMappingDto | null
  supported: boolean
  onSaved: (m: KommoTagMappingDto, msg: string) => void
  onError: (msg: string) => void
}) {
  const [rules, setRules] = useState<KommoTagMappingRuleDto[]>(mapping?.rules ?? [])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mapping) setRules(mapping.rules)
  }, [mapping])

  function addRule() {
    setRules((prev) => [...prev, { tag: '', target: 'origem', value: '' }])
  }

  function updateRule(idx: number, patch: Partial<KommoTagMappingRuleDto>) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function removeRule(idx: number) {
    setRules((prev) => prev.filter((_, i) => i !== idx))
  }

  async function save() {
    if (!supported) {
      onError('Mapeamento de tags ainda não suportado pelo CadastraAi.API.')
      return
    }
    setSaving(true)
    try {
      const cleaned = rules.filter((r) => r.tag.trim() && r.value.trim())
      const m = await kommoApi.saveTagMapping(empresaId, { rules: cleaned })
      onSaved(m, `Tag-mapping salvo (${cleaned.length} regra${cleaned.length === 1 ? '' : 's'}).`)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao salvar tag-mapping.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-3xl border border-white/5 bg-[#15171b] p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-400/30 grid place-items-center">
            <Sparkles className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-white">Mapeamento de tags</h3>
            <p className="text-[12px] text-white/55">
              Tags da Kommo viram <code className="text-cyan-300">origem</code>, <code className="text-cyan-300">tipo</code>{' '}
              ou <code className="text-cyan-300">tipoResgate</code> no Cadastro.
            </p>
          </div>
        </div>
        {!supported && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-300 bg-amber-500/10 border border-amber-400/30 px-1.5 py-0.5 rounded-md">
            backend pendente
          </span>
        )}
      </div>

      {rules.length === 0 ? (
        <p className="text-[12px] text-white/45 mb-3">
          Nenhuma regra. Ex: tag <strong>"site"</strong> → origem <strong>"Site Institucional"</strong>.
        </p>
      ) : (
        <ul className="space-y-2 mb-3">
          {rules.map((r, idx) => (
            <li key={idx} className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr,auto] gap-2 items-center">
              <input
                type="text"
                placeholder="tag na Kommo (ex: site)"
                value={r.tag}
                onChange={(e) => updateRule(idx, { tag: e.target.value })}
                className="h-9 px-3 rounded-lg bg-[#0c0d10] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50"
              />
              <select
                value={r.target}
                onChange={(e) => updateRule(idx, { target: e.target.value as KommoTagMappingRuleDto['target'] })}
                className="h-9 px-3 rounded-lg bg-[#0c0d10] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50"
              >
                <option value="origem">→ origem</option>
                <option value="tipo">→ tipo</option>
                <option value="tipoResgate">→ tipoResgate</option>
              </select>
              <input
                type="text"
                placeholder="valor no Cadastro"
                value={r.value}
                onChange={(e) => updateRule(idx, { value: e.target.value })}
                className="h-9 px-3 rounded-lg bg-[#0c0d10] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50"
              />
              <button
                onClick={() => removeRule(idx)}
                className="h-9 px-2 rounded-lg text-rose-300 hover:bg-rose-500/10 transition-colors"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          onClick={addRule}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-[12px] text-white/85 hover:text-white hover:border-white/20 transition-colors"
        >
          + Adicionar regra
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border border-cyan-400/40 bg-cyan-500/15 text-cyan-200 text-[12px] font-semibold hover:bg-cyan-500/25 disabled:opacity-50 transition-colors"
        >
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
          Salvar
        </button>
      </div>
    </div>
  )
}

function FieldMappingEditor({
  empresaId,
  mapping,
  supported,
  onSaved,
  onError,
}: {
  empresaId: string
  mapping: KommoFieldMappingDto | null
  supported: boolean
  onSaved: (m: KommoFieldMappingDto, msg: string) => void
  onError: (msg: string) => void
}) {
  const [rules, setRules] = useState<KommoFieldMappingRuleDto[]>(mapping?.rules ?? [])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mapping) setRules(mapping.rules)
  }, [mapping])

  function addRule() {
    setRules((prev) => [...prev, { target: 'nome', sourceKey: '' }])
  }

  function updateRule(idx: number, patch: Partial<KommoFieldMappingRuleDto>) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function removeRule(idx: number) {
    setRules((prev) => prev.filter((_, i) => i !== idx))
  }

  async function save() {
    if (!supported) {
      onError('Mapeamento de campos ainda não suportado pelo CadastraAi.API.')
      return
    }
    setSaving(true)
    try {
      const m = await kommoApi.saveFieldMapping(empresaId, { rules })
      onSaved(m, 'Mapeamento de campos salvo.')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao salvar mapeamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-3xl border border-white/5 bg-[#15171b] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-400/30 grid place-items-center">
          <Layers className="h-5 w-5 text-cyan-300" />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-bold text-white">Mapeamento de campos</h3>
          <p className="text-[12px] text-white/55">
            Sobrescreve a auto-detecção. Quando o auto-detect erra (confiança baixa), uma regra
            aqui fixa <em>de onde</em> vem o valor.
          </p>
        </div>
        {!supported && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-300 bg-amber-500/10 border border-amber-400/30 px-2 py-1 rounded-md">
            backend pendente
          </span>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
          <Wand2 className="h-6 w-6 text-white/30 mx-auto mb-2" />
          <p className="text-[13px] text-white/55 mb-3">
            Nenhuma regra customizada. O sistema usa o auto-detect baseado em aliases.
          </p>
          <button
            onClick={addRule}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-200 text-[12px] font-semibold hover:bg-cyan-500/20"
          >
            + Adicionar regra
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((r, idx) => (
            <div key={idx} className="rounded-xl border border-white/10 bg-[#0c0d10] p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <div className="md:col-span-4">
                <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
                  Campo do CadastraAi
                </label>
                <select
                  value={r.target}
                  onChange={(e) => updateRule(idx, { target: e.target.value as KommoFieldMappingRuleDto['target'] })}
                  className="mt-1 w-full h-9 px-3 rounded-lg bg-[#15171b] border border-white/10 text-[12px] text-white focus:outline-none focus:border-cyan-400/50"
                >
                  {TARGETS.map((t) => (
                    <option key={t.field} value={t.field}>
                      {t.label} {t.required ? '(obrigatório)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-7">
                <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
                  Origem na Kommo
                </label>
                <input
                  value={r.sourceKey}
                  onChange={(e) => updateRule(idx, { sourceKey: e.target.value })}
                  placeholder="ex: contact.phone, lead.tags, custom_field_telefone_principal"
                  className="mt-1 w-full h-9 px-3 rounded-lg bg-[#15171b] border border-white/10 text-[12px] font-mono text-white placeholder:text-white/35 focus:outline-none focus:border-cyan-400/50"
                />
              </div>
              <div className="md:col-span-1 flex justify-end">
                <button
                  onClick={() => removeRule(idx)}
                  className="h-9 w-9 grid place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"
                  title="Remover regra"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={addRule}
            className="inline-flex items-center gap-2 px-3 h-8 rounded-lg border border-white/10 text-[12px] text-white/65 hover:text-white hover:border-white/20"
          >
            + Adicionar regra
          </button>
        </div>
      )}

      <div className="flex justify-end mt-4">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#0d0f14] text-[13px] font-semibold disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando…' : 'Salvar mapeamento'}
        </button>
      </div>
    </div>
  )
}

function ResponsibleMappingEditor({
  empresaId,
  mapping,
  users,
  supported,
  usersSupported,
  onSaved,
  onError,
}: {
  empresaId: string
  mapping: KommoResponsibleMappingDto | null
  users: KommoUserDto[]
  supported: boolean
  usersSupported: boolean
  onSaved: (m: KommoResponsibleMappingDto, msg: string) => void
  onError: (msg: string) => void
}) {
  const [rules, setRules] = useState<KommoResponsibleMappingDto['rules']>(mapping?.rules ?? [])
  const [fallback, setFallback] = useState(mapping?.fallbackNome ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mapping) {
      setRules(mapping.rules)
      setFallback(mapping.fallbackNome ?? '')
    }
  }, [mapping])

  function addRule() {
    setRules((prev) => [...prev, { kommoUserId: 0, kommoUserName: null, nomeResponsavel: '' }])
  }

  function updateRule(idx: number, patch: Partial<KommoResponsibleMappingDto['rules'][0]>) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function removeRule(idx: number) {
    setRules((prev) => prev.filter((_, i) => i !== idx))
  }

  async function save() {
    if (!supported) {
      onError('Mapeamento de responsáveis ainda não suportado pelo CadastraAi.API.')
      return
    }
    setSaving(true)
    try {
      const m = await kommoApi.saveResponsibleMapping(empresaId, {
        rules,
        fallbackNome: fallback || null,
      })
      onSaved(m, 'Mapa de responsáveis salvo.')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-3xl border border-white/5 bg-[#15171b] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-400/30 grid place-items-center">
          <UserCheck className="h-5 w-5 text-violet-300" />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-bold text-white">Mapa de responsáveis</h3>
          <p className="text-[12px] text-white/55">
            Converte <code className="text-violet-300">responsible_user_id</code> da Kommo em
            "nomeResponsavel" do CadastraAi. Sem isso, leads importados ficam com "A definir".
          </p>
        </div>
        {!supported && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-300 bg-amber-500/10 border border-amber-400/30 px-2 py-1 rounded-md">
            backend pendente
          </span>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {rules.map((r, idx) => (
          <div key={idx} className="rounded-xl border border-white/10 bg-[#0c0d10] p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
            <div className="md:col-span-5">
              <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
                Usuário Kommo
              </label>
              {usersSupported && users.length > 0 ? (
                <select
                  value={r.kommoUserId}
                  onChange={(e) => {
                    const u = users.find((x) => x.id === Number(e.target.value))
                    updateRule(idx, { kommoUserId: Number(e.target.value), kommoUserName: u?.name ?? null })
                  }}
                  className="mt-1 w-full h-9 px-3 rounded-lg bg-[#15171b] border border-white/10 text-[12px] text-white focus:outline-none focus:border-cyan-400/50"
                >
                  <option value={0}>Selecione…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.email ? ` (${u.email})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={r.kommoUserId || ''}
                  onChange={(e) => updateRule(idx, { kommoUserId: Number(e.target.value) })}
                  placeholder="ID do usuário Kommo"
                  className="mt-1 w-full h-9 px-3 rounded-lg bg-[#15171b] border border-white/10 text-[12px] font-mono text-white focus:outline-none focus:border-cyan-400/50"
                />
              )}
            </div>
            <div className="md:col-span-6">
              <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
                Nome no CadastraAi
              </label>
              <input
                value={r.nomeResponsavel}
                onChange={(e) => updateRule(idx, { nomeResponsavel: e.target.value })}
                placeholder="ex: Mariana Costa"
                className="mt-1 w-full h-9 px-3 rounded-lg bg-[#15171b] border border-white/10 text-[12px] text-white placeholder:text-white/35 focus:outline-none focus:border-cyan-400/50"
              />
            </div>
            <div className="md:col-span-1 flex justify-end">
              <button
                onClick={() => removeRule(idx)}
                className="h-9 w-9 grid place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={addRule}
          className="inline-flex items-center gap-2 px-3 h-8 rounded-lg border border-white/10 text-[12px] text-white/65 hover:text-white hover:border-white/20"
        >
          + Adicionar mapeamento
        </button>
      </div>

      <div className="border-t border-white/5 pt-4">
        <label className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
          Fallback (quando não há match)
        </label>
        <input
          value={fallback}
          onChange={(e) => setFallback(e.target.value)}
          placeholder="ex: A definir"
          className="mt-1 w-full h-9 px-3 rounded-lg bg-[#0c0d10] border border-white/10 text-[12px] text-white placeholder:text-white/35 focus:outline-none focus:border-cyan-400/50"
        />
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-violet-500 hover:bg-violet-400 text-violet-950 text-[13px] font-semibold disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando…' : 'Salvar mapa'}
        </button>
      </div>
    </div>
  )
}

// ----- HISTORY TAB -----

function HistoryTab({
  history,
  supported,
  onRefresh,
}: {
  history: KommoSyncHistoryEntryDto[]
  supported: boolean
  onRefresh: () => void
}) {
  if (!supported) {
    return (
      <div className="rounded-3xl border border-amber-400/20 bg-amber-500/[0.04] p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-[15px] font-bold text-white">Histórico pendente no backend</h3>
            <p className="text-[12px] text-white/65 mt-1">
              Implemente <code className="text-amber-300">GET /api/empresas/{'{id}'}/kommo/sync-history</code>{' '}
              em <strong>CadastraAi.API</strong>. Sugestão: tabela <code>kommo_sync_history</code> populada
              em todo <code>POST /sync</code>, no auto-sync e em recebimentos de webhook.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
        <History className="h-7 w-7 text-white/30 mx-auto mb-3" />
        <p className="text-[15px] font-semibold text-white/85 mb-1">Sem histórico ainda</p>
        <p className="text-[13px] text-white/55">
          Cada sincronização (manual, automática ou webhook) aparecerá aqui com totais e quem disparou.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-[13px] text-white/70 hover:text-white hover:border-white/20"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>
      <div className="rounded-3xl border border-white/5 bg-[#15171b] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-[#0c0d10] text-white/55 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Data</th>
              <th className="text-left px-4 py-2 font-semibold">Origem</th>
              <th className="text-left px-4 py-2 font-semibold">Disparado por</th>
              <th className="text-right px-4 py-2 font-semibold">Recebidos</th>
              <th className="text-right px-4 py-2 font-semibold">Inbox</th>
              <th className="text-right px-4 py-2 font-semibold">Promovidos</th>
              <th className="text-left px-4 py-2 font-semibold">Filtros</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {history.map((h) => (
              <tr key={h.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-2 text-white/85 tabular-nums whitespace-nowrap">
                  {new Date(h.startedAt).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-2">
                  <SourcePill source={h.source} />
                </td>
                <td className="px-4 py-2 text-white/65">{h.triggeredByName ?? '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums text-white/85">{h.received}</td>
                <td className="px-4 py-2 text-right tabular-nums text-cyan-300">{h.stored}</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-300">{h.promoted}</td>
                <td className="px-4 py-2 text-white/45 text-[11px] font-mono truncate max-w-xs">
                  {h.filters
                    ? [
                        h.filters.pipelineId ? `pipeline=${h.filters.pipelineId}` : null,
                        h.filters.statusIds?.length ? `status=${h.filters.statusIds.length}` : null,
                        h.filters.createdAtFrom ? `de=${h.filters.createdAtFrom.slice(0, 10)}` : null,
                        h.filters.createdAtTo ? `até=${h.filters.createdAtTo.slice(0, 10)}` : null,
                        h.filters.query ? `q="${h.filters.query}"` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SourcePill({ source }: { source: KommoSyncHistoryEntryDto['source'] }) {
  const palette =
    source === 'webhook'
      ? 'bg-violet-500/10 text-violet-200 border-violet-400/30'
      : source === 'auto'
        ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30'
        : 'bg-cyan-500/10 text-cyan-200 border-cyan-400/30'
  const Icon = source === 'webhook' ? Webhook : source === 'auto' ? Timer : PlayCircle
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 h-6 rounded-md border text-[10px] uppercase tracking-wider font-bold', palette)}>
      <Icon className="h-3 w-3" />
      {source}
    </span>
  )
}

// ----- EVENTS TAB (catálogo de webhooks Kommo) -----

function EventsTab({
  empresaId,
  config,
}: {
  empresaId: string
  config: KommoConfigDto | null
}) {
  const [filterCat, setFilterCat] = useState<'todos' | KommoWebhookEvent['category']>('todos')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Toggle local: representa quais eventos o usuário quer ativar. Persistir no backend depois.
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(KOMMO_WEBHOOK_EVENTS.map((e) => [e.id, !!e.recommended])),
  )

  const filtered = useMemo(
    () => KOMMO_WEBHOOK_EVENTS.filter((e) => filterCat === 'todos' || e.category === filterCat),
    [filterCat],
  )

  const enabledCount = Object.values(enabled).filter(Boolean).length

  const cats: { id: 'todos' | KommoWebhookEvent['category']; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'lead', label: 'Leads' },
    { id: 'status', label: 'Status' },
    { id: 'contact', label: 'Contatos' },
    { id: 'task', label: 'Tarefas' },
    { id: 'note', label: 'Notas' },
    { id: 'company', label: 'Empresas' },
  ]

  return (
    <div className="space-y-5">
      {/* Hero explicativo: webhook vs API */}
      <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/[0.04] p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 grid place-items-center shrink-0">
            <Lightbulb className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-bold text-white mb-1">Como o Kommo entrega leads — webhook vs API</h3>
            <p className="text-[12px] text-white/75 leading-relaxed">
              <strong className="text-violet-300">Webhook (push):</strong> a Kommo bate na URL do CadastraAi
              em tempo real quando algo muda. Use para reatividade.{' '}
              <strong className="text-amber-300">API (pull):</strong> o backend consulta a Kommo no
              ritmo que você definiu (manual ou auto-sync). Use para consistência. <strong>Recomendação:</strong>{' '}
              ative os dois — webhook como linha de frente, API como rede de segurança.
            </p>
          </div>
        </div>
      </div>

      {/* Filtros + contagem */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCat(c.id)}
              className={cn(
                'h-9 px-3 rounded-xl border text-[12px] font-semibold transition-colors',
                filterCat === c.id
                  ? 'bg-cyan-500/15 text-cyan-200 border-cyan-400/40'
                  : 'bg-[#0c0d10] text-white/55 border-white/10 hover:text-white hover:border-white/20',
              )}
            >
              {c.label}
              {c.id !== 'todos' && (
                <span className="ml-1.5 text-[10px] tabular-nums opacity-70">
                  {KOMMO_WEBHOOK_EVENTS.filter((e) => e.category === c.id).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="text-[12px] text-white/55">
          <span className="text-cyan-300 font-bold tabular-nums">{enabledCount}</span> /{' '}
          {KOMMO_WEBHOOK_EVENTS.length} habilitados
        </div>
      </div>

      {/* Lista de eventos */}
      <div className="rounded-3xl border border-white/5 bg-[#15171b] divide-y divide-white/5">
        {filtered.map((event) => {
          const isOn = enabled[event.id]
          const isExpanded = expandedId === event.id
          return (
            <div key={event.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <label className="cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={(e) =>
                      setEnabled((prev) => ({ ...prev, [event.id]: e.target.checked }))
                    }
                    className="accent-cyan-500 h-4 w-4"
                  />
                </label>
                <button
                  onClick={() => setExpandedId((cur) => (cur === event.id ? null : event.id))}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-[14px] font-bold text-white">{event.label}</p>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-white/45 bg-white/[0.04] border border-white/10 px-1.5 py-0.5 rounded">
                      {event.category}
                    </span>
                    <code className="text-[10px] font-mono text-cyan-300">{event.id}</code>
                    {event.recommended && (
                      <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 px-1.5 py-0.5 rounded">
                        recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-white/65">{event.description}</p>
                </button>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-white/45 mt-1" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-white/45 mt-1" />
                )}
              </div>

              {isExpanded && (
                <div className="mt-3 ml-7 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold mb-2">
                      Campos principais (form-encoded)
                    </p>
                    <ul className="rounded-xl border border-white/10 bg-[#0c0d10] p-3 space-y-1">
                      {event.payloadKeys.map((k) => (
                        <li key={k} className="text-[11px] font-mono text-cyan-200 break-all">
                          {k}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold mb-2">
                      Exemplo de payload (já parseado)
                    </p>
                    <pre className="rounded-xl border border-white/10 bg-[#0c0d10] p-3 text-[11px] font-mono text-white/85 max-h-56 overflow-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(event.example, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Como aplicar */}
      <div className="rounded-2xl border border-white/5 bg-[#15171b] p-5">
        <h4 className="text-[14px] font-bold text-white mb-2">Como aplicar a seleção</h4>
        <ol className="text-[12px] text-white/75 space-y-1.5 list-decimal list-inside">
          <li>
            Abra <strong>Configurações → Integrações → Webhooks</strong> na sua conta Kommo.
          </li>
          <li>
            Cole a URL de webhook (na aba Configuração) e marque <strong>apenas</strong> os eventos
            que você habilitou aqui acima ({enabledCount} eventos).
          </li>
          <li>
            Salve. O <code className="text-cyan-300">/api/empresas/{empresaId.slice(0, 8) || '{id}'}/kommo/webhook</code>{' '}
            vai começar a receber e popular a inbox automaticamente.
          </li>
          <li>
            Para os eventos que você <strong>não</strong> ativou, o backend pode ignorar — ou usar a
            API (sync agendado) para recuperar.
          </li>
        </ol>
        <p className="text-[11px] text-white/45 mt-3">
          {/* TODO(CadastraAi.API): persistir esta seleção via PUT /kommo/webhook-events para o backend
              filtrar/ignorar eventos não habilitados. Hoje o front guarda só localmente. */}
          <AlertCircle className="h-3.5 w-3.5 inline mr-1 text-amber-300" />
          A seleção de eventos ainda não é persistida no backend — está só local nesta sessão.
        </p>
      </div>
    </div>
  )
}

// ----- TIMELINE TAB (#5) — eventos ao vivo da Kommo via /api/v4/events -----

function TimelineTab({ empresaId }: { empresaId: string }) {
  const [events, setEvents] = useState<KommoLeadEventDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [supported, setSupported] = useState(true)
  const [leadFilter, setLeadFilter] = useState('')

  async function load() {
    if (!empresaId) return
    setLoading(true)
    try {
      const opts = leadFilter ? { leadId: Number(leadFilter), pageSize: 100 } : { pageSize: 100 }
      const r = await kommoApi.events(empresaId, opts)
      setEvents(r.items)
      setTotal(r.total)
      setSupported(true)
    } catch (err) {
      if (isBackendNotImplemented(err)) setSupported(false)
      setEvents([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  if (!supported) {
    return (
      <div className="rounded-3xl border border-amber-400/20 bg-amber-500/[0.04] p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-[15px] font-bold text-white mb-1">Timeline pendente no backend</h3>
            <p className="text-[12px] text-white/65">
              Implemente <code className="text-amber-300">GET /api/empresas/{'{id}'}/kommo/events</code> em{' '}
              <strong>CadastraAi.API</strong> como proxy para{' '}
              <code className="text-amber-300">/api/v4/events?filter[entity]=lead</code> da Kommo.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/5 bg-[#15171b] p-5">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-400/30 grid place-items-center">
            <Activity className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h3 className="text-[15px] font-bold text-white">Timeline da Kommo</h3>
            <p className="text-[12px] text-white/55">
              Mudança de status, ligações, mensagens e notas — direto do{' '}
              <code className="text-cyan-300">/api/v4/events</code>.
            </p>
          </div>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Filtrar por Kommo Lead ID"
            value={leadFilter}
            onChange={(e) => setLeadFilter(e.target.value.replace(/\D/g, ''))}
            className="h-9 px-3 rounded-xl bg-[#0c0d10] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/50 w-56"
          />
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-[13px] text-white/70 hover:text-white hover:border-white/20 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Atualizar
          </button>
        </div>
        <p className="text-[11px] text-white/45">
          {loading ? 'Carregando…' : `${events.length} de ${total} eventos`}
        </p>
      </div>

      {events.length === 0 && !loading ? (
        <div className="rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <Activity className="h-7 w-7 text-white/30 mx-auto mb-3" />
          <p className="text-[15px] font-semibold text-white/85 mb-1">Sem eventos no momento</p>
          <p className="text-[13px] text-white/55">
            {leadFilter ? 'Nenhum evento para esse Lead ID.' : 'A Kommo não retornou eventos recentes.'}
          </p>
        </div>
      ) : (
        <ul className="rounded-3xl border border-white/5 bg-[#15171b] divide-y divide-white/5">
          {events.map((ev) => (
            <li key={ev.id} className="px-5 py-3 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-400/30 grid place-items-center shrink-0">
                <Activity className="h-3.5 w-3.5 text-cyan-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white">
                  <span className="font-semibold">{ev.createdByName ?? 'sistema'}</span>{' '}
                  <span className="text-white/65">{humanizeEventType(ev.type)}</span>{' '}
                  <span className="text-[11px] text-white/45">#{ev.entityId}</span>
                </p>
                {(ev.valueBefore || ev.valueAfter) && (
                  <p className="text-[11px] text-white/55 mt-0.5">
                    {ev.valueBefore && <span className="line-through opacity-60">{ev.valueBefore}</span>}
                    {ev.valueBefore && ev.valueAfter && <span className="mx-1">→</span>}
                    {ev.valueAfter && <span className="text-cyan-300">{ev.valueAfter}</span>}
                  </p>
                )}
                {ev.rawSummary && (
                  <p className="text-[11px] text-white/45 mt-0.5 truncate">{ev.rawSummary}</p>
                )}
              </div>
              <p className="text-[10px] text-white/45 shrink-0 tabular-nums">
                {new Date(ev.createdAt).toLocaleString('pt-BR')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function humanizeEventType(type: string): string {
  const map: Record<string, string> = {
    lead_status_changed: 'mudou status do lead',
    lead_added: 'criou o lead',
    lead_deleted: 'removeu o lead',
    incoming_call: 'ligação recebida em',
    outgoing_call: 'ligação feita para',
    common_note_added: 'comentou em',
    incoming_chat_message: 'mensagem recebida em',
    outgoing_chat_message: 'mensagem enviada em',
    task_added: 'criou tarefa em',
    task_completed: 'concluiu tarefa em',
  }
  return map[type] ?? type.replace(/_/g, ' ')
}

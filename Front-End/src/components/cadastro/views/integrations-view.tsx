
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Plug2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Building2,
  Clock,
  Sparkles,
  Lock,
  Webhook,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  cloudiaApi,
  kommoApi,
  isBackendNotImplemented,
  buildCloudiaWebhookUrl,
  buildKommoWebhookUrl,
  buildGenericWebhookUrl,
  type EmpresaDto,
  type IntegrationProvider,
  type IntegrationStatusDto,
} from '@/lib/cadastra/api'
import { useEmpresa } from '@/contexts/cadastra/empresa-context'
import { CloudiaView } from '@/components/cadastro/views/cloudia-view'
import { KommoView } from '@/components/cadastro/views/kommo-view'

interface Props {
  onBack: () => void
}

interface ProviderMeta {
  id: IntegrationProvider
  label: string
  description: string
  category: 'crm' | 'ads' | 'automation' | 'webhook'
  status: 'available' | 'beta' | 'coming-soon'
  // Cor primária do card (Tailwind classes).
  accent: string
  iconBg: string
  iconColor: string
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'cloudia',
    label: 'Cloudia',
    description:
      'CRM principal — modelo webhook-only. Você cola a URL no painel da Cloudia e ela empurra eventos (lead criado, atualizado, etapa, tags, atendente) em tempo real. Sem polling, sem API key.',
    category: 'crm',
    status: 'available',
    accent: 'border-cyan-500/30 hover:border-cyan-400/60',
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-300',
  },
  {
    id: 'kommo',
    label: 'Kommo',
    description:
      'Pipeline e mensagens (WhatsApp, Instagram, Telegram). Promove leads do funil para o cadastro com mapeamento automático de campos e tags.',
    category: 'crm',
    status: 'available',
    accent: 'border-fuchsia-500/30 hover:border-fuchsia-400/60',
    iconBg: 'bg-fuchsia-500/10',
    iconColor: 'text-fuchsia-300',
  },
  {
    id: 'meta',
    label: 'Meta Ads (Facebook/Instagram)',
    description:
      'Lead Ads e Pixel via webhook. Atribui campanha, conjunto e criativo na Origem Cadastro. Envia eventos para CAPI.',
    category: 'ads',
    status: 'beta',
    accent: 'border-blue-500/30 hover:border-blue-400/60',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-300',
  },
  {
    id: 'google',
    label: 'Google Ads',
    description:
      'Lead Form Extensions e Call Ads. Marca origem como "Campanha Google" ou "Ligação Google" e preenche utm_campaign automaticamente.',
    category: 'ads',
    status: 'coming-soon',
    accent: 'border-amber-500/30 hover:border-amber-400/60',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-300',
  },
  {
    id: 'n8n',
    label: 'n8n',
    description:
      'Workflows de automação. Use para disparos de resgate, follow-up de não-comparecimento e relatórios diários para o WhatsApp das secretárias.',
    category: 'automation',
    status: 'beta',
    accent: 'border-violet-500/30 hover:border-violet-400/60',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-300',
  },
  {
    id: 'webhook',
    label: 'Webhook genérico',
    description:
      'Endpoint público para Zapier, Make e qualquer outro sistema. Aceita JSON com os campos da planilha Cloudia e cai direto no inbox.',
    category: 'webhook',
    status: 'available',
    accent: 'border-emerald-500/30 hover:border-emerald-400/60',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-300',
  },
]

type Detail = null | 'cloudia' | 'kommo'

export function IntegrationsView({ onBack }: Props) {
  // Empresa ativa vem do contexto global. Trocar empresa no switcher da sidebar
  // já reflete aqui automaticamente.
  const { currentEmpresa, isLoading: loading } = useEmpresa()
  const empresaAtual = currentEmpresa
  const empresaId = currentEmpresa?.id ?? null

  const [statuses, setStatuses] = useState<Record<IntegrationProvider, IntegrationStatusDto | null>>({
    cloudia: null,
    kommo: null,
    meta: null,
    google: null,
    n8n: null,
    webhook: null,
  })
  const [refreshing, setRefreshing] = useState(false)
  const [detail, setDetail] = useState<Detail>(null)

  useEffect(() => {
    if (!empresaAtual) return
    void refreshStatuses(empresaAtual)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtual?.id])

  async function refreshStatuses(emp: EmpresaDto) {
    setRefreshing(true)
    // Tenta o endpoint agregado primeiro. Se 404, faz fallback por provider.
    try {
      const list = await fetchAggregateOrFallback(emp)
      const next: Record<IntegrationProvider, IntegrationStatusDto | null> = {
        cloudia: null,
        kommo: null,
        meta: null,
        google: null,
        n8n: null,
        webhook: null,
      }
      for (const item of list) next[item.provider] = item
      setStatuses(next)
    } finally {
      setRefreshing(false)
    }
  }

  if (detail === 'cloudia' && empresaAtual) {
    return <CloudiaView empresa={empresaAtual} onBack={() => setDetail(null)} />
  }
  if (detail === 'kommo') {
    return <KommoView onBack={() => setDetail(null)} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-cyan-500/10 p-2">
              <Plug2 className="h-5 w-5 text-cyan-300" />
            </div>
            <h1 className="text-2xl font-semibold text-white">Centro de Integrações</h1>
          </div>
          <p className="text-sm text-white/60 max-w-2xl">
            Conecte fontes externas e deixe o sistema preencher os cadastros automaticamente.
            As secretárias só verificam os campos e ajustam o que for preciso — nada digitado à mão.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {empresaAtual && (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70">
              <Building2 className="h-4 w-4 text-white/50" />
              <span>{empresaAtual.nome}</span>
            </div>
          )}
          <button
            onClick={() => empresaAtual && refreshStatuses(empresaAtual)}
            disabled={!empresaAtual || refreshing}
            className={cn(
              'flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80',
              'hover:bg-white/[0.06] disabled:opacity-50',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Atualizar status
          </button>
        </div>
      </header>

      {/* Banner explicando isolamento */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/[0.05] to-fuchsia-500/[0.05] p-4">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 text-cyan-300" />
          <div className="text-sm text-white/80 space-y-1">
            <p className="font-medium text-white">Isolamento por empresa</p>
            <p className="text-xs text-white/60">
              Cada empresa configura suas próprias credenciais. Tokens, webhooks e dados são
              filtrados por <code className="rounded bg-white/5 px-1">tenant_id</code> no backend —
              uma clínica nunca vê os leads da outra.
            </p>
          </div>
        </div>
      </div>

      {/* Grid de providers */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p.id}
            meta={p}
            status={statuses[p.id]}
            empresa={empresaAtual}
            loading={loading}
            onOpen={() => {
              if (p.id === 'cloudia') setDetail('cloudia')
              else if (p.id === 'kommo') setDetail('kommo')
            }}
          />
        ))}
      </div>

      {/* Diagrama de correlação dos 3 sistemas */}
      <SystemMapCard />

      {/* Regras de automação globais */}
      <AutomationRulesCard />
    </div>
  )
}

function SystemMapCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-cyan-500/10 p-2">
          <Plug2 className="h-5 w-5 text-cyan-300" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-base font-semibold text-white">Como os sistemas se conectam</h3>
            <p className="text-sm text-white/60">
              Os 3 sistemas compartilham o mesmo backend e o mesmo banco. Cada um faz uma coisa.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {/* Origem */}
            <SystemNode
              label="Cloudia"
              role="Fonte"
              subtitle="CRM externo"
              points={[
                'Webhook → /api/empresas/{id}/cloudia/webhook',
                'Empurra CUSTOMER_CREATED, UPDATED, STAGE, TAGS, ASSIGNED',
                'Identifica clínica via data.clinic_id',
              ]}
              tone="cyan"
            />
            <Arrow />
            {/* Hub central */}
            <SystemNode
              label="LeadAnalytics.Api"
              role=".NET / Postgres"
              subtitle="Backend único"
              points={[
                'CloudiaAdapter → LeadEvent',
                'Salva Lead, Contact, Payment, Unit, Attendant',
                'Filtra tudo por TenantId (clinic_id)',
                'JWT com tenant_id para os 2 frontends',
              ]}
              tone="violet"
              wide
            />
            <Arrow />
            {/* 2 destinos */}
            <div className="space-y-3">
              <SystemNode
                label="cadastraai (este app)"
                role="Next.js"
                subtitle="Operacional"
                points={[
                  'Inbox de revisão pré-cadastro',
                  'Secretárias verificam e promovem',
                  'CRUD de Lead, Consulta, Tratamento, Recebimento',
                ]}
                tone="emerald"
              />
              <SystemNode
                label="Doutor-Digital-Front"
                role="Vite/React"
                subtitle="Analítico"
                points={[
                  'Dashboards: Finance, Funil, Cohort, SLA',
                  'Read-only sobre o mesmo banco',
                  'Mesmo JWT, mesmo tenant_id',
                ]}
                tone="amber"
              />
            </div>
          </div>

          <div className="rounded-lg border border-white/5 bg-black/20 p-3 text-xs text-white/60">
            <span className="font-medium text-white/85">Fluxo de um lead novo:</span>{' '}
            Cloudia dispara webhook →{' '}
            <code className="rounded bg-white/5 px-1">/api/empresas/{`{id}`}/cloudia/webhook</code> valida secret e
            <code className="rounded bg-white/5 px-1">data.clinic_id</code> →{' '}
            <code className="rounded bg-white/5 px-1">CloudiaAdapter</code> mapeia para{' '}
            <code className="rounded bg-white/5 px-1">LeadEvent</code> →{' '}
            <code className="rounded bg-white/5 px-1">LeadService.SaveLeadAsync</code> persiste com{' '}
            <code className="rounded bg-white/5 px-1">TenantId</code> → cadastraai mostra no inbox →
            secretária promove → dashboard Vite reflete imediatamente nos KPIs.
          </div>
        </div>
      </div>
    </div>
  )
}

function SystemNode({
  label,
  role,
  subtitle,
  points,
  tone,
  wide = false,
}: {
  label: string
  role: string
  subtitle: string
  points: string[]
  tone: 'cyan' | 'violet' | 'emerald' | 'amber'
  wide?: boolean
}) {
  const palette: Record<typeof tone, { border: string; bg: string; chip: string }> = {
    cyan:    { border: 'border-cyan-500/30',    bg: 'bg-cyan-500/[0.05]',    chip: 'text-cyan-300' },
    violet:  { border: 'border-violet-500/30',  bg: 'bg-violet-500/[0.05]',  chip: 'text-violet-300' },
    emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/[0.05]', chip: 'text-emerald-300' },
    amber:   { border: 'border-amber-500/30',   bg: 'bg-amber-500/[0.05]',   chip: 'text-amber-300' },
  }
  const p = palette[tone]
  return (
    <div className={cn('rounded-xl border p-3', p.border, p.bg, wide && 'lg:min-h-[180px]')}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-white">{label}</p>
        <span className={cn('text-[10px] uppercase tracking-wider', p.chip)}>{role}</span>
      </div>
      <p className="text-[11px] text-white/50">{subtitle}</p>
      <ul className="mt-2 space-y-1 text-[11px] text-white/70">
        {points.map((pt, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className={cn('mt-1 h-1 w-1 shrink-0 rounded-full', p.chip)} />
            <span>{pt}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Arrow() {
  return (
    <div className="hidden items-center justify-center text-white/30 lg:flex">
      <svg width="24" height="20" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M0 10 H22 M16 4 L22 10 L16 16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

interface ProviderCardProps {
  meta: ProviderMeta
  status: IntegrationStatusDto | null
  empresa: EmpresaDto | null
  loading: boolean
  onOpen: () => void
}

function ProviderCard({ meta, status, empresa, loading, onOpen }: ProviderCardProps) {
  const connected = status?.connected ?? false
  const hasError = !!status?.errorMessage
  const canOpen = meta.status === 'available' || meta.status === 'beta'
  const webhookUrl = empresa ? buildGenericWebhookUrl(empresa, meta.id) : null
  const hasDetailView = meta.id === 'cloudia' || meta.id === 'kommo'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative flex flex-col rounded-2xl border bg-white/[0.02] p-5 transition-all',
        meta.accent,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('rounded-xl p-2', meta.iconBg)}>
            <Plug2 className={cn('h-5 w-5', meta.iconColor)} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{meta.label}</h3>
            <p className="text-xs uppercase tracking-wide text-white/40">
              {meta.category === 'crm'        && 'CRM'}
              {meta.category === 'ads'        && 'Anúncios'}
              {meta.category === 'automation' && 'Automação'}
              {meta.category === 'webhook'    && 'Endpoint'}
            </p>
          </div>
        </div>
        <StatusBadge connected={connected} hasError={hasError} status={meta.status} loading={loading} />
      </div>

      {/* Descrição */}
      <p className="mt-3 text-sm leading-relaxed text-white/65">{meta.description}</p>

      {/* Resumo de status */}
      {status && (
        <div className="mt-3 space-y-1 rounded-lg bg-black/20 p-3">
          {status.summary && (
            <p className="text-xs text-white/70">{status.summary}</p>
          )}
          {status.lastSyncAt && (
            <p className="flex items-center gap-1.5 text-[11px] text-white/50">
              <Clock className="h-3 w-3" />
              Última sincronização: {new Date(status.lastSyncAt).toLocaleString('pt-BR')}
            </p>
          )}
          {hasError && (
            <p className="flex items-center gap-1.5 text-[11px] text-rose-300">
              <AlertCircle className="h-3 w-3" />
              {status.errorMessage}
            </p>
          )}
        </div>
      )}

      {/* Webhook URL (todos os providers expõem um) */}
      {webhookUrl && meta.status !== 'coming-soon' && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
          <Webhook className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
          <code className="break-all text-[10.5px] text-white/55">{webhookUrl}</code>
        </div>
      )}

      {/* CTA */}
      <div className="mt-auto pt-4">
        {meta.status === 'coming-soon' ? (
          <button
            disabled
            className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/40"
          >
            <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
            Em breve
          </button>
        ) : hasDetailView ? (
          <button
            onClick={onOpen}
            disabled={!canOpen || !empresa}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
              connected
                ? 'border-white/15 bg-white/[0.04] text-white/85 hover:bg-white/[0.08]'
                : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15',
            )}
          >
            {connected ? 'Configurar' : 'Conectar'}
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-center text-xs text-white/50">
            Use a URL acima no provedor externo
          </div>
        )}
      </div>
    </motion.div>
  )
}

function StatusBadge({
  connected,
  hasError,
  status,
  loading,
}: {
  connected: boolean
  hasError: boolean
  status: ProviderMeta['status']
  loading: boolean
}) {
  if (loading) {
    return (
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/40">
        ...
      </span>
    )
  }
  if (status === 'coming-soon') {
    return (
      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
        Em breve
      </span>
    )
  }
  if (hasError) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-rose-300">
        <XCircle className="h-3 w-3" />
        Erro
      </span>
    )
  }
  if (connected) {
    return (
      <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Conectado
      </span>
    )
  }
  if (status === 'beta') {
    return (
      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-violet-300">
        Beta
      </span>
    )
  }
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/45">
      Não conectado
    </span>
  )
}

function AutomationRulesCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-violet-500/10 p-2">
          <Zap className="h-5 w-5 text-violet-300" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-base font-semibold text-white">Regras de automação</h3>
            <p className="text-sm text-white/60">
              O que acontece automaticamente quando uma fonte externa envia um lead novo.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-2 text-sm text-white/75 md:grid-cols-2">
            <li className="rounded-lg border border-white/5 bg-black/20 p-3">
              <span className="text-xs uppercase tracking-wide text-white/40">Deduplicação</span>
              <p className="mt-0.5">
                Telefone normalizado (E.164) é a chave. Lead repetido vira atualização, não cadastro novo.
              </p>
            </li>
            <li className="rounded-lg border border-white/5 bg-black/20 p-3">
              <span className="text-xs uppercase tracking-wide text-white/40">Origem → Tipo</span>
              <p className="mt-0.5">
                Origens iniciadas com "Resgate:" classificam o lead como{' '}
                <code className="rounded bg-white/10 px-1 text-[11px]">Resgate</code> e preenchem o sub-tipo.
              </p>
            </li>
            <li className="rounded-lg border border-white/5 bg-black/20 p-3">
              <span className="text-xs uppercase tracking-wide text-white/40">Inbox de revisão</span>
              <p className="mt-0.5">
                Toda importação cai em <em>Pendente</em>. A secretária só promove para o Cadastro depois de conferir.
              </p>
            </li>
            <li className="rounded-lg border border-white/5 bg-black/20 p-3">
              <span className="text-xs uppercase tracking-wide text-white/40">Auditoria</span>
              <p className="mt-0.5">
                Cada alteração registra quem (login da secretária) e quando — visível em Logs / Auditoria.
              </p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ----- Helpers -----

async function fetchAggregateOrFallback(empresa: EmpresaDto): Promise<IntegrationStatusDto[]> {
  const empresaId = empresa.id
  // Tenta o endpoint agregado primeiro.
  try {
    const { integrationsApi } = await import('@/lib/cadastra/api')
    const list = await integrationsApi.list(empresaId)
    if (Array.isArray(list)) return list
  } catch (err) {
    if (!isBackendNotImplemented(err)) {
      // Erro real (ex.: 401/500). Retorna vazio mas não trava a UI.
      return []
    }
  }

  // Fallback: pergunta cada provider individualmente. Falhas viram "não conectado".
  const out: IntegrationStatusDto[] = []
  await Promise.allSettled([
    cloudiaApi
      .getWebhookConfig(empresaId)
      .then((cfg) => {
        if (cfg) {
          const armed = !!cfg.cloudiaClinicId && cfg.hasWebhookSecret
          const connected = cfg.totalReceived > 0 || armed
          const summary = armed
            ? `clinic_id ${cfg.cloudiaClinicId} • secret ativo`
            : cfg.totalReceived > 0
              ? `${cfg.totalReceived} eventos recebidos`
              : 'aguardando primeiro evento'
          out.push({
            provider: 'cloudia',
            empresaId,
            connected,
            summary,
            lastSyncAt: cfg.lastReceivedAt ?? null,
            webhookUrl: buildCloudiaWebhookUrl(empresa),
          })
        } else {
          out.push({
            provider: 'cloudia',
            empresaId,
            connected: false,
            webhookUrl: buildCloudiaWebhookUrl(empresa),
          })
        }
      })
      .catch(() => {
        out.push({
          provider: 'cloudia',
          empresaId,
          connected: false,
          webhookUrl: buildCloudiaWebhookUrl(empresa),
        })
      }),
    kommoApi
      .getConfig(empresaId)
      .then((cfg) => {
        if (cfg) {
          out.push({
            provider: 'kommo',
            empresaId,
            connected: cfg.hasToken,
            summary: cfg.subdomain ? `Subdomain: ${cfg.subdomain}` : null,
            lastSyncAt: cfg.lastSyncAt ?? null,
            webhookUrl: buildKommoWebhookUrl(empresa),
          })
        } else {
          out.push({ provider: 'kommo', empresaId, connected: false })
        }
      })
      .catch(() => {
        out.push({ provider: 'kommo', empresaId, connected: false })
      }),
  ])
  // providers sem endpoint dedicado: só expõem webhook URL.
  for (const p of ['meta', 'google', 'n8n', 'webhook'] as IntegrationProvider[]) {
    out.push({
      provider: p,
      empresaId,
      connected: false,
      webhookUrl: buildGenericWebhookUrl(empresa, p),
    })
  }
  return out
}

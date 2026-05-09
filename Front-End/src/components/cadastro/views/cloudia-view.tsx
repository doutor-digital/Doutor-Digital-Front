
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Webhook,
  Save,
  AlertCircle,
  TableProperties,
  Building2,
  Lock,
  Sparkles,
  History,
  RotateCw,
  Eye,
  EyeOff,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  cloudiaApi,
  buildCloudiaWebhookUrl,
  isBackendNotImplemented,
  type CloudiaWebhookConfigDto,
  type CloudiaWebhookEventDto,
  type EmpresaDto,
} from '@/lib/cadastra/api'
import {
  CLOUDIA_WEBHOOK_FIELDS,
  CLOUDIA_LEADS,
  CLOUDIA_CONSULTAS,
  CLOUDIA_TRATAMENTOS,
  CLOUDIA_ORIGENS,
  CLOUDIA_EVENT_TYPES,
  CLOUDIA_SAMPLE_PAYLOAD,
  parseCloudiaEvent,
  type SpreadsheetField,
  type WebhookField,
} from '@/lib/cadastra/cloudia-mapping'

interface Props {
  empresa: EmpresaDto
  onBack: () => void
}

type Tab = 'webhook' | 'mapping' | 'history'

export function CloudiaView({ empresa, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('webhook')
  const [cfg, setCfg] = useState<CloudiaWebhookConfigDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [backendMissing, setBackendMissing] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    cloudiaApi
      .getWebhookConfig(empresa.id)
      .then((res) => {
        if (!active) return
        setCfg(res)
      })
      .catch((err) => {
        if (!active) return
        if (isBackendNotImplemented(err)) setBackendMissing(true)
        else console.error('Falha ao carregar config Cloudia:', err)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [empresa.id])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para integrações
        </button>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-cyan-500/10 p-2">
              <Webhook className="h-5 w-5 text-cyan-300" />
            </div>
            <h1 className="text-2xl font-semibold text-white">Cloudia</h1>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cyan-300">
              Webhook-only
            </span>
          </div>
          <p className="flex items-center gap-2 text-sm text-white/60">
            <Building2 className="h-4 w-4" />
            {empresa.nome}
          </p>
        </div>
      </header>

      {backendMissing && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 text-amber-300" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-amber-200">Backend ainda não publicou os endpoints da Cloudia</p>
            <p className="text-xs text-amber-100/70">
              Esperado:{' '}
              <code className="rounded bg-black/30 px-1">
                /api/empresas/{`{id}`}/cloudia/webhook-config
              </code>{' '}
              e{' '}
              <code className="rounded bg-black/30 px-1">
                /api/empresas/{`{id}`}/cloudia/webhook
              </code>
              . O endpoint de recepção (
              <code className="rounded bg-black/30 px-1">/api/webhooks/cloudia</code>) já existe no backend, falta
              a versão por-empresa com validação de secret.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
        <TabBtn active={tab === 'webhook'} onClick={() => setTab('webhook')} label="Webhook" />
        <TabBtn active={tab === 'mapping'} onClick={() => setTab('mapping')} label="Mapeamento de campos" />
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} label="Histórico de eventos" />
      </div>

      <div className="min-h-[300px]">
        {tab === 'webhook' && (
          <WebhookTab empresa={empresa} cfg={cfg} loading={loading} onSaved={setCfg} />
        )}
        {tab === 'mapping' && <MappingTab />}
        {tab === 'history' && <HistoryTab empresa={empresa} />}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 rounded-lg px-4 py-2 text-sm transition-colors',
        active ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:text-white/85',
      )}
    >
      {label}
    </button>
  )
}

// ============================================================================
// Tab: Webhook (URL + secret + eventos esperados)
// ============================================================================

function WebhookTab({
  empresa,
  cfg,
  loading,
  onSaved,
}: {
  empresa: EmpresaDto
  cfg: CloudiaWebhookConfigDto | null
  loading: boolean
  onSaved: (cfg: CloudiaWebhookConfigDto) => void
}) {
  const [secret, setSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [clinicId, setClinicId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [copied, setCopied] = useState<'url' | 'sample' | null>(null)

  useEffect(() => {
    if (cfg?.cloudiaClinicId != null) setClinicId(String(cfg.cloudiaClinicId))
  }, [cfg])

  const webhookUrl = buildCloudiaWebhookUrl(empresa)
  const urlLength = webhookUrl.length
  const overLimit = urlLength > 100
  const longForm = !empresa.webhookShortCode

  async function handleSave() {
    setSaving(true)
    setResult(null)
    try {
      const saved = await cloudiaApi.saveWebhookConfig(empresa.id, {
        webhookSecret: secret.trim() || undefined,
        cloudiaClinicId: clinicId.trim() ? Number(clinicId.trim()) : null,
      })
      onSaved(saved)
      setSecret('')
      setResult({ ok: true, message: 'Configuração salva.' })
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Erro ao salvar.',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleCopy(kind: 'url' | 'sample', text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  if (loading) return <div className="text-sm text-white/40">Carregando…</div>

  return (
    <div className="space-y-6">
      {/* URL principal */}
      <section className="space-y-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.06] to-fuchsia-500/[0.04] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Webhook className="mt-0.5 h-4 w-4 text-cyan-300" />
            <div>
              <h3 className="font-semibold text-white">URL para colar no painel da Cloudia</h3>
              <p className="text-xs text-white/65">
                Único passo de conexão. Cloudia passa a empurrar eventos em tempo real para esta URL.
              </p>
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums',
              overLimit
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                : urlLength > 80
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
            )}
            title="Cloudia limita o webhook a 100 caracteres"
          >
            {urlLength} / 100
          </span>
        </div>

        <div className="space-y-2">
          <code className="block break-all rounded-lg border border-cyan-500/20 bg-black/40 p-3 text-xs text-cyan-200">
            {webhookUrl}
          </code>
          <button
            onClick={() => handleCopy('url', webhookUrl)}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06]"
          >
            {copied === 'url' ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
            {copied === 'url' ? 'Copiado' : 'Copiar URL'}
          </button>
        </div>

        {longForm && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-2.5 text-[11px] text-amber-100/85">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span>
              Esta empresa ainda não tem código curto.{' '}
              <strong>O backend precisa gerar </strong>
              <code className="rounded bg-black/30 px-1">Empresa.WebhookShortCode</code> (8 chars base62) e expor
              a rota <code className="rounded bg-black/30 px-1">/wh/c/{`{shortCode}`}</code>. Enquanto isso a URL
              usa a forma longa pelo UUID.
            </span>
          </div>
        )}

        {overLimit && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/[0.08] p-2.5 text-[11px] text-rose-100">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
            <span>
              URL acima de 100 caracteres — Cloudia vai recusar. Avise o backend para gerar o{' '}
              <code className="rounded bg-black/30 px-1">webhookShortCode</code> desta empresa.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2 text-center">
          <Stat label="Recebidos" value={cfg?.totalReceived ?? 0} tone="cyan" />
          <Stat label="Processados" value={cfg?.totalProcessed ?? 0} tone="emerald" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Segurança */}
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 text-cyan-300" />
            <div>
              <h3 className="font-semibold text-white">Segurança (recomendado)</h3>
              <p className="text-xs text-white/55">
                Defesa em profundidade — o endpoint não exige login mas valida estes campos.
              </p>
            </div>
          </div>

          <Field label="Secret HMAC (opcional)">
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={
                  cfg?.hasWebhookSecret
                    ? `Secret atual termina em ${cfg.webhookSecretSuffix ?? '••••'} — deixe em branco p/ manter`
                    : 'Gere uma string aleatória de 32+ chars'
                }
                className={cn(inputCls, 'pr-10')}
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
                aria-label={showSecret ? 'Ocultar' : 'Mostrar'}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-white/45">
              Cloudia precisa enviar <code className="rounded bg-white/5 px-1">x-cloudia-signature</code> com HMAC-SHA256.
            </p>
          </Field>

          <Field label="Cloudia clinic_id (recomendado)">
            <input
              type="number"
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              placeholder="Ex.: 789 — visível no URL do painel da Cloudia"
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-white/45">
              Webhooks com <code className="rounded bg-white/5 px-1">data.clinic_id</code> diferente são
              rejeitados — protege contra spoofing entre clínicas.
            </p>
          </Field>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>

          {result && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-lg p-3 text-sm',
                result.ok
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border border-rose-500/30 bg-rose-500/10 text-rose-200',
              )}
            >
              {result.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{result.message}</span>
            </div>
          )}
        </section>

        {/* Eventos esperados */}
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 text-cyan-300" />
            <div>
              <h3 className="font-semibold text-white">Eventos que a Cloudia envia</h3>
              <p className="text-xs text-white/55">
                Marque todos no painel da Cloudia para que tudo entre no inbox.
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {CLOUDIA_EVENT_TYPES.map((e) => (
              <li
                key={e.type}
                className="flex items-start gap-2 rounded-lg border border-white/5 bg-black/20 p-2.5"
              >
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {e.label}
                    <code className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/55">
                      {e.type}
                    </code>
                  </p>
                  <p className="text-xs text-white/55">{e.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Payload de exemplo */}
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Inbox className="mt-0.5 h-4 w-4 text-cyan-300" />
            <div>
              <h3 className="font-semibold text-white">Payload de exemplo</h3>
              <p className="text-xs text-white/55">
                Estrutura exata que a Cloudia envia. Use para testar manualmente com{' '}
                <code className="rounded bg-white/5 px-1">curl</code>.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleCopy('sample', JSON.stringify(CLOUDIA_SAMPLE_PAYLOAD, null, 2))}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06]"
          >
            {copied === 'sample' ? (
              <Check className="h-3 w-3 text-emerald-300" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied === 'sample' ? 'Copiado' : 'Copiar JSON'}
          </button>
        </div>
        <pre className="max-h-72 overflow-auto rounded-lg border border-white/5 bg-black/40 p-3 text-[11px] leading-relaxed text-white/70">
          {JSON.stringify(CLOUDIA_SAMPLE_PAYLOAD, null, 2)}
        </pre>
      </section>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'emerald' | 'rose' }) {
  const colors: Record<string, string> = {
    cyan: 'text-cyan-200',
    emerald: 'text-emerald-200',
    rose: 'text-rose-200',
  }
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-3">
      <p className="text-[11px] uppercase tracking-wider text-white/45">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', colors[tone])}>{value}</p>
    </div>
  )
}

// ============================================================================
// Tab: Mapping (webhook fields + planilha derivada)
// ============================================================================

function MappingTab() {
  const [view, setView] = useState<'webhook' | 'spreadsheet'>('webhook')

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-start gap-2">
          <TableProperties className="mt-0.5 h-4 w-4 text-cyan-300" />
          <div className="space-y-1">
            <h3 className="font-semibold text-white">Mapeamento Cloudia → Cadastro → Banco</h3>
            <p className="text-xs text-white/55">
              Os campos do payload do webhook são a fonte canônica. As colunas das planilhas exportadas
              pela Cloudia são uma visão derivada — equivalentes em conteúdo.
            </p>
          </div>
        </div>

        <div className="mt-4 inline-flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
          <button
            onClick={() => setView('webhook')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs',
              view === 'webhook' ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:text-white/85',
            )}
          >
            Por campo do webhook
          </button>
          <button
            onClick={() => setView('spreadsheet')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs',
              view === 'spreadsheet' ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:text-white/85',
            )}
          >
            Por coluna da planilha
          </button>
        </div>
      </div>

      {view === 'webhook' && (
        <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h4 className="font-semibold text-white">Payload do webhook (canônico)</h4>
          <MappingTable rows={CLOUDIA_WEBHOOK_FIELDS} pathLabel="Campo Cloudia" pathKey="path" />
        </section>
      )}

      {view === 'spreadsheet' && (
        <>
          {[
            { id: 'leads',       title: 'Cadastro Geral (Leads)',     rows: CLOUDIA_LEADS },
            { id: 'consultas',   title: 'Consultas Comparecidas',     rows: CLOUDIA_CONSULTAS },
            { id: 'tratamentos', title: 'Tratamentos Realizados',     rows: CLOUDIA_TRATAMENTOS },
          ].map((s) => (
            <section
              key={s.id}
              className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
            >
              <h4 className="font-semibold text-white">{s.title}</h4>
              <MappingTable rows={s.rows} pathLabel="Coluna Cloudia" pathKey="column" />
            </section>
          ))}
        </>
      )}

      <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h4 className="font-semibold text-white">Origens reconhecidas</h4>
        <p className="text-xs text-white/55">
          Lista canônica que o cadastro aceita. Origens iniciadas com "Resgate:" classificam o
          lead como <em>Resgate</em> automaticamente.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-2">
          {CLOUDIA_ORIGENS.map((o) => (
            <span
              key={o}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px]',
                o.startsWith('Resgate')
                  ? 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200'
                  : 'border-white/10 bg-white/[0.04] text-white/70',
              )}
            >
              {o}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}

function MappingTable<T extends WebhookField | SpreadsheetField>({
  rows,
  pathLabel,
  pathKey,
}: {
  rows: T[]
  pathLabel: string
  pathKey: 'path' | 'column'
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/45">
            <th className="px-2 py-2">{pathLabel}</th>
            <th className="px-2 py-2">Campo no cadastro</th>
            <th className="px-2 py-2">Entidade backend</th>
            <th className="px-2 py-2">Observações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-white/5 text-white/75 last:border-0">
              <td className="px-2 py-2 font-mono text-[11px] text-white">
                {pathKey === 'path' ? (row as WebhookField).path : (row as SpreadsheetField).column}
              </td>
              <td className="px-2 py-2">
                {row.cadastroTarget ? (
                  <code className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[11px] text-cyan-200">
                    {row.cadastroTarget}
                  </code>
                ) : (
                  <span className="text-white/35">—</span>
                )}
              </td>
              <td className="px-2 py-2">
                {row.netEntity ? (
                  <span className="text-white/70">
                    {row.netEntity}
                    <span className="text-white/35">.</span>
                    {row.netField}
                  </span>
                ) : (
                  <span className="text-white/35">derivado</span>
                )}
              </td>
              <td className="px-2 py-2 text-white/50">{row.notes ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// Tab: History (eventos recebidos)
// ============================================================================

function HistoryTab({ empresa }: { empresa: EmpresaDto }) {
  const [events, setEvents] = useState<CloudiaWebhookEventDto[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'processed' | 'rejected' | 'pending'>('all')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const list = await cloudiaApi.history(empresa.id, {
        status: filter === 'all' ? undefined : filter,
        limit: 50,
      })
      setEvents(list)
    } catch (err) {
      if (isBackendNotImplemented(err)) {
        setEvents([])
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao carregar histórico')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa.id, filter])

  async function handleRetry(eventId: string) {
    setRetryingId(eventId)
    try {
      const updated = await cloudiaApi.retry(empresa.id, eventId)
      setEvents((prev) => prev?.map((e) => (e.id === eventId ? updated : e)) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no retry')
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <History className="h-4 w-4 text-white/50" />
        <span className="text-sm text-white/70">Filtrar:</span>
        {(['all', 'processed', 'pending', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              filter === f
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white/85',
            )}
          >
            {f === 'all' ? 'Todos' : f === 'processed' ? 'Processados' : f === 'pending' ? 'Pendentes' : 'Rejeitados'}
          </button>
        ))}
        <button
          onClick={() => void load()}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06]"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && events === null ? (
        <div className="text-sm text-white/40">Carregando…</div>
      ) : !events || events.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/55">
          <Inbox className="mx-auto mb-2 h-6 w-6 text-white/30" />
          Nenhum evento {filter === 'all' ? 'recebido ainda' : `com status "${filter}"`}.
          <p className="mt-1 text-xs text-white/40">
            Cole a URL no painel da Cloudia e dispare um evento de teste para ver os dados aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <EventRow
              key={ev.id}
              event={ev}
              retrying={retryingId === ev.id}
              onRetry={() => handleRetry(ev.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function EventRow({
  event,
  retrying,
  onRetry,
}: {
  event: CloudiaWebhookEventDto
  retrying: boolean
  onRetry: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const parsed = useMemo(() => parseCloudiaEvent(event), [event])

  const statusColor =
    event.status === 'processed'
      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
      : event.status === 'pending'
        ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
        : 'text-rose-300 bg-rose-500/10 border-rose-500/30'

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider', statusColor)}>
          {event.status}
        </span>
        <code className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-white/70">{event.eventType}</code>
        <span className="text-xs text-white/55">
          {new Date(event.receivedAt).toLocaleString('pt-BR')}
        </span>
        {parsed?.data?.name && (
          <span className="text-sm text-white">{parsed.data.name}</span>
        )}
        {parsed?.data?.phone && (
          <span className="text-xs text-white/50">{parsed.data.phone}</span>
        )}
        {event.cadastroLeadId && (
          <span className="text-[10px] text-emerald-300">→ lead {event.cadastroLeadId.slice(0, 8)}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {event.status === 'rejected' && (
            <button
              onClick={onRetry}
              disabled={retrying}
              className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/80 hover:bg-white/[0.08] disabled:opacity-50"
            >
              <RotateCw className={cn('h-3 w-3', retrying && 'animate-spin')} />
              Reprocessar
            </button>
          )}
          <button
            onClick={() => setExpanded((s) => !s)}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/70 hover:bg-white/[0.08]"
          >
            {expanded ? 'Ocultar' : 'Ver payload'}
          </button>
        </div>
      </div>

      {event.rejectionReason && (
        <p className="mt-2 text-xs text-rose-300">⚠ {event.rejectionReason}</p>
      )}

      {expanded && (
        <pre className="mt-3 max-h-60 overflow-auto rounded-lg border border-white/5 bg-black/40 p-3 text-[11px] leading-relaxed text-white/70">
          {JSON.stringify(parsed ?? event.rawPayload, null, 2)}
        </pre>
      )}
    </li>
  )
}

// ============================================================================
// Atoms
// ============================================================================

const inputCls =
  'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-400/50'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-white/65">{label}</span>
      {children}
    </label>
  )
}

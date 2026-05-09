
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Phone,
  Calendar,
  ClipboardCheck,
  HeartPulse,
  Wallet,
  CheckCircle2,
  XCircle,
  User as UserIcon,
  Sparkles,
  RefreshCw,
  AlertCircle,
  StickyNote,
  MessageCircle,
  Plug2,
} from 'lucide-react'
import {
  isBackendNotImplemented,
  kommoApi,
  leadsApi,
  type ConsultaDto,
  type KommoLeadMessageDto,
  type KommoLeadNoteDto,
  type LeadDetailDto,
  type RecebimentoDto,
  type TratamentoDto,
} from '@/lib/cadastra/api'
import { cn } from '@/lib/utils'
import type { Consulta, Lead, Recebimento, Tratamento } from '@/types/cadastra'

interface LeadDetailViewProps {
  leadId: string
  onBack: () => void
  onEdit: (lead: Lead) => void
  onEditConsulta?: (consulta: Consulta) => void
  onEditTratamento?: (tratamento: Tratamento) => void
  onDeleted: () => void
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

const formaTone: Record<string, { bg: string; text: string }> = {
  default: { bg: 'bg-white/[0.04]', text: 'text-white/75' },
  Pix: { bg: 'bg-cyan-500/10', text: 'text-cyan-300' },
  Cartão: { bg: 'bg-sky-500/10', text: 'text-sky-300' },
  'Cartão Crédito': { bg: 'bg-sky-500/10', text: 'text-sky-300' },
  'Cartão Débito': { bg: 'bg-blue-500/10', text: 'text-blue-300' },
  Dinheiro: { bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
  Boleto: { bg: 'bg-amber-500/10', text: 'text-amber-300' },
}

interface RowProps {
  label: string
  value: React.ReactNode
  span?: 1 | 2
}

function InfoRow({ label, value, span = 1 }: RowProps) {
  return (
    <div className={cn(span === 2 && 'sm:col-span-2')}>
      <p className="text-[11px] uppercase tracking-wider text-white/45">{label}</p>
      <p className="text-[14px] text-white mt-0.5">{value}</p>
    </div>
  )
}

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1.5 text-cyan-300">
      <CheckCircle2 className="h-4 w-4" />
      Sim
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-white/55">
      <XCircle className="h-4 w-4" />
      Não
    </span>
  )
}

// ----- DTO → tipos locais -----

function recebimentoFromDto(r: RecebimentoDto): Recebimento {
  return {
    id: r.id,
    valorRecebimento: r.valorRecebimento,
    formaPagamento: r.formaPagamento,
    dataRecebimento: r.dataRecebimento,
    consultaId: r.consultaId ?? undefined,
    tratamentoId: r.tratamentoId ?? undefined,
  }
}

function tratamentoFromDto(t: TratamentoDto): Tratamento {
  return {
    id: t.id,
    consultaId: t.consultaId,
    planoTratamento: t.planoTratamento,
    planoPilates: t.planoPilates ?? undefined,
    musculacao: t.musculacao ?? undefined,
    procedimento: t.procedimento ?? undefined,
    valorPlano: t.valorPlano,
    recebimentos: (t.recebimentos ?? []).map(recebimentoFromDto),
    createdAt: t.createdAt,
  }
}

function consultaFromDto(c: ConsultaDto): Consulta {
  return {
    id: c.id,
    leadId: c.leadId,
    valorConsulta: c.valorConsulta,
    pagamentoAntecipado: c.pagamentoAntecipado,
    tratamentoIndicado: c.tratamentoIndicado,
    orcamento: c.orcamento,
    compareceu: c.compareceu,
    fechouTratamento: c.fechouTratamento,
    motivoNaoFechamento: c.motivoNaoFechamento ?? undefined,
    createdAt: c.createdAt,
    recebimentos: (c.recebimentos ?? []).map(recebimentoFromDto),
    tratamento: c.tratamento ? tratamentoFromDto(c.tratamento) : undefined,
  }
}

function leadFromDto(d: LeadDetailDto): Lead {
  return {
    id: d.id,
    empresaId: d.empresaId,
    nome: d.nome,
    telefone: d.telefone,
    origem: d.origem,
    tipo: (d.tipo === 'Resgate' ? 'Resgate' : 'Cadastro') as Lead['tipo'],
    tipoResgate: d.tipoResgate ?? undefined,
    interacao: d.interacao,
    agendouConsulta: d.agendouConsulta,
    pagamentoAntecipado: d.pagamentoAntecipado,
    dataAgendamento: d.dataAgendamento ?? undefined,
    motivoNaoAgendamento: d.motivoNaoAgendamento ?? undefined,
    nomeResponsavel: d.nomeResponsavel,
    createdAt: d.createdAt,
    importado: d.importado,
  }
}

export function LeadDetailView({
  leadId,
  onBack,
  onEdit,
  onEditConsulta,
  onEditTratamento,
  onDeleted,
}: LeadDetailViewProps) {
  const [detail, setDetail] = useState<LeadDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    leadsApi
      .get(leadId)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar lead.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [leadId, refreshTick])

  const lead = useMemo(() => (detail ? leadFromDto(detail) : null), [detail])
  const consulta = useMemo(
    () => (detail?.consulta ? consultaFromDto(detail.consulta) : undefined),
    [detail],
  )
  const tratamento = useMemo(
    () => (detail?.consulta?.tratamento ? tratamentoFromDto(detail.consulta.tratamento) : undefined),
    [detail],
  )

  const allRecebimentos: Recebimento[] = useMemo(() => {
    const list: Recebimento[] = []
    if (consulta) list.push(...consulta.recebimentos)
    if (tratamento) list.push(...tratamento.recebimentos)
    return list.sort((a, b) => (a.dataRecebimento < b.dataRecebimento ? 1 : -1))
  }, [consulta, tratamento])

  const totalRecebido = allRecebimentos.reduce((sum, r) => sum + r.valorRecebimento, 0)

  if (loading && !detail) {
    return (
      <motion.div
        className="px-8 py-8 max-w-5xl mx-auto"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onBack}
            className="group inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-[#15171b] border border-white/5 text-[13px] text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </div>
        <div className="rounded-3xl bg-[#15171b] border border-white/5 px-6 py-12 animate-pulse">
          <div className="flex items-center gap-5 mb-6">
            <div className="h-20 w-20 rounded-2xl bg-white/5" />
            <div className="flex-1 space-y-3">
              <div className="h-3 w-24 bg-white/5 rounded" />
              <div className="h-7 w-1/2 bg-white/10 rounded" />
              <div className="h-3 w-2/3 bg-white/5 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-2 w-16 bg-white/5 rounded" />
                <div className="h-4 w-3/4 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  if (error || !lead) {
    return (
      <motion.div
        className="px-8 py-8 max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onBack}
            className="group inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-[#15171b] border border-white/5 text-[13px] text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-[13px] text-white/70 hover:text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar de novo
          </button>
        </div>
        <div className="rounded-3xl bg-[#15171b] border border-white/5 px-6 py-16 text-center">
          <AlertCircle className="h-7 w-7 text-amber-300 mx-auto mb-3" />
          <p className="text-base text-white/85 font-medium mb-1">
            {error ? 'Não foi possível carregar este lead' : 'Lead não encontrado'}
          </p>
          <p className="text-sm text-white/55">
            {error ?? 'Pode ter sido removido recentemente.'}
          </p>
        </div>
      </motion.div>
    )
  }

  const handleDelete = async () => {
    if (!confirm(`Apagar o lead "${lead.nome}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    try {
      await leadsApi.delete(lead.id)
      onDeleted()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao apagar lead.')
      setDeleting(false)
    }
  }

  const initials = lead.nome
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <motion.div
      className="px-8 py-8 max-w-5xl mx-auto"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Top actions */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-[#15171b] border border-white/5 text-[13px] text-white/70 hover:text-white hover:border-white/12 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Voltar para Leads
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border border-white/10 bg-white/[0.03] text-[13px] text-white/70 hover:text-white hover:border-white/20 disabled:opacity-50 transition-colors"
            title="Recarregar"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => onEdit(lead)}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-semibold text-[13px] transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-rose-500/[0.08] border border-rose-400/30 text-rose-300 hover:bg-rose-500/15 text-[13px] disabled:opacity-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Apagando…' : 'Apagar'}
          </button>
        </div>
      </div>

      {/* Hero */}
      <div
        className="rounded-3xl p-7 mb-5 text-cyan-50"
        style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 60%, #075985 100%)' }}
      >
        <div className="flex items-start gap-5">
          <div
            className="h-20 w-20 rounded-2xl grid place-items-center text-white text-[26px] font-bold shrink-0"
            style={{
              background: 'rgba(8, 47, 73, 0.55)',
              boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.18)',
            }}
          >
            {initials || <UserIcon className="h-9 w-9" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] uppercase tracking-[0.2em] text-cyan-100/85 mb-1">Detalhes do Lead</p>
            <h1 className="text-[32px] font-bold tracking-tight leading-none">{lead.nome}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-cyan-100/85">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {lead.telefone}
              </span>
              <span className="text-cyan-100/45">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Origem: {lead.origem}
              </span>
              <span className="text-cyan-100/45">·</span>
              <span className="inline-flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5" />
                {lead.nomeResponsavel}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-sm',
                lead.tipo === 'Cadastro'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-400/30 text-amber-50',
              )}
            >
              {lead.tipo}
            </span>
            {lead.agendouConsulta ? (
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-emerald-400/30 text-emerald-50 backdrop-blur-sm">
                Agendou
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-white/10 text-white/85 backdrop-blur-sm">
                Não agendou
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cadastro details */}
      <div className="rounded-3xl bg-[#15171b] border border-white/5 p-6 mb-4">
        <h3 className="text-[14px] font-semibold mb-5 flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-cyan-400" />
          Informações do cadastro
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow label="Nome" value={lead.nome} />
          <InfoRow label="Telefone" value={lead.telefone} />
          <InfoRow label="Origem" value={lead.origem} />
          <InfoRow label="Responsável" value={lead.nomeResponsavel} />
          <InfoRow label="Tipo" value={lead.tipo} />
          {lead.tipo === 'Resgate' && lead.tipoResgate && (
            <InfoRow label="Tipo de resgate" value={lead.tipoResgate} />
          )}
          <InfoRow label="Houve interação?" value={<YesNo value={lead.interacao} />} />
          <InfoRow label="Agendou consulta?" value={<YesNo value={lead.agendouConsulta} />} />
          <InfoRow label="Pagamento antecipado?" value={<YesNo value={lead.pagamentoAntecipado} />} />
          <InfoRow label="Cadastrado em" value={formatDateTime(lead.createdAt)} />
          {detail?.createdByName && (
            <InfoRow label="Cadastrado por" value={detail.createdByName} />
          )}
          {lead.agendouConsulta && lead.dataAgendamento && (
            <InfoRow label="Data do agendamento" value={formatDateTime(lead.dataAgendamento)} span={2} />
          )}
          {!lead.agendouConsulta && lead.motivoNaoAgendamento && (
            <InfoRow label="Motivo do não agendamento" value={lead.motivoNaoAgendamento} span={2} />
          )}
        </div>
      </div>

      {/* #4 + #7: Origem Kommo — só aparece para leads importados */}
      {lead.importado && lead.empresaId && (
        <KommoOriginPanel empresaId={lead.empresaId} cadastroLeadId={lead.id} />
      )}

      {/* Funnel state */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <FunnelStep
          icon={Calendar}
          label="Agendamento"
          done={lead.agendouConsulta}
          detail={lead.agendouConsulta ? formatDate(lead.dataAgendamento) : 'Não agendou'}
          onClick={() => onEdit(lead)}
          actionLabel="Editar dados do agendamento"
        />
        <FunnelStep
          icon={ClipboardCheck}
          label="Consulta"
          done={Boolean(consulta)}
          detail={consulta ? formatDate(consulta.createdAt) : 'Sem consulta'}
          onClick={consulta && onEditConsulta ? () => onEditConsulta(consulta) : undefined}
          actionLabel={consulta ? 'Editar consulta' : 'Sem consulta para editar'}
        />
        <FunnelStep
          icon={HeartPulse}
          label="Tratamento"
          done={Boolean(tratamento)}
          detail={tratamento ? tratamento.planoTratamento : 'Sem tratamento'}
          onClick={tratamento && onEditTratamento ? () => onEditTratamento(tratamento) : undefined}
          actionLabel={tratamento ? 'Editar tratamento' : 'Sem tratamento para editar'}
        />
      </div>

      {/* Consulta */}
      {consulta && (
        <div className="rounded-3xl bg-[#15171b] border border-white/5 p-6 mb-4">
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <h3 className="text-[14px] font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-cyan-400" />
              Consulta vinculada
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-white/45 tabular-nums">
                {formatDate(consulta.createdAt)}
              </span>
              {onEditConsulta && (
                <button
                  onClick={() => onEditConsulta(consulta)}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-semibold text-[12px] transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar consulta
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Valor da consulta" value={brl(consulta.valorConsulta)} />
            <InfoRow label="Orçamento" value={brl(consulta.orcamento)} />
            <InfoRow label="Pagamento antecipado?" value={<YesNo value={consulta.pagamentoAntecipado} />} />
            <InfoRow label="Compareceu?" value={<YesNo value={consulta.compareceu} />} />
            <InfoRow label="Fechou tratamento?" value={<YesNo value={consulta.fechouTratamento} />} />
            <InfoRow label="Tratamento indicado" value={consulta.tratamentoIndicado || '—'} span={2} />
            {!consulta.fechouTratamento && consulta.motivoNaoFechamento && (
              <InfoRow label="Motivo do não fechamento" value={consulta.motivoNaoFechamento} span={2} />
            )}
            {detail?.consulta?.createdByName && (
              <InfoRow label="Registrada por" value={detail.consulta.createdByName} />
            )}
          </div>
        </div>
      )}

      {/* Tratamento */}
      {tratamento && (
        <div className="rounded-3xl bg-[#15171b] border border-white/5 p-6 mb-4">
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <h3 className="text-[14px] font-semibold flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-cyan-400" />
              Tratamento fechado
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-white/45 tabular-nums">
                {formatDate(tratamento.createdAt)}
              </span>
              {onEditTratamento && (
                <button
                  onClick={() => onEditTratamento(tratamento)}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-semibold text-[12px] transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar tratamento
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Plano de tratamento" value={tratamento.planoTratamento} />
            <InfoRow label="Valor do plano" value={brl(tratamento.valorPlano)} />
            {tratamento.planoPilates && <InfoRow label="Pilates" value={tratamento.planoPilates} />}
            {tratamento.musculacao && <InfoRow label="Musculação" value={tratamento.musculacao} />}
            {tratamento.procedimento && <InfoRow label="Procedimento" value={tratamento.procedimento} span={2} />}
            {detail?.consulta?.tratamento?.createdByName && (
              <InfoRow label="Registrado por" value={detail.consulta.tratamento.createdByName} />
            )}
          </div>
        </div>
      )}

      {/* Recebimentos */}
      {allRecebimentos.length > 0 && (
        <div className="rounded-3xl bg-[#15171b] border border-white/5 overflow-hidden">
          <div className="px-6 h-14 flex items-center justify-between border-b border-white/5">
            <h3 className="text-[14px] font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-cyan-400" />
              Recebimentos ({allRecebimentos.length})
            </h3>
            <span className="text-[13px] font-semibold tabular-nums text-cyan-300">
              {brl(totalRecebido)}
            </span>
          </div>
          <ul>
            {allRecebimentos.map((r, i) => {
              const tone = formaTone[r.formaPagamento] ?? formaTone.default
              const origem =
                consulta && consulta.recebimentos.some((rr) => rr.id === r.id) ? 'Consulta' : 'Tratamento'
              return (
                <li
                  key={r.id}
                  className={cn(
                    'flex items-center gap-3 px-6 h-14',
                    i < allRecebimentos.length - 1 && 'border-b border-white/[0.04]',
                  )}
                >
                  <span className={cn('inline-flex items-center px-2 h-6 rounded-md text-[11px] font-semibold', tone.bg, tone.text)}>
                    {r.formaPagamento}
                  </span>
                  <span className="text-[12px] text-white/55 uppercase tracking-wider">{origem}</span>
                  <span className="ml-auto text-[14px] font-semibold tabular-nums text-cyan-300">
                    {brl(r.valorRecebimento)}
                  </span>
                  <span className="text-[12px] text-white/55 tabular-nums w-24 text-right">
                    {formatDate(r.dataRecebimento)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </motion.div>
  )
}

// #4 + #7: painel "Origem Kommo" — resolve kommoLeadId via inbox e exibe notas/mensagens
function KommoOriginPanel({ empresaId, cadastroLeadId }: { empresaId: string; cadastroLeadId: string }) {
  const [kommoLeadId, setKommoLeadId] = useState<number | null>(null)
  const [resolving, setResolving] = useState(true)

  useEffect(() => {
    let cancelled = false
    setResolving(true)
    kommoApi
      .inbox(empresaId, 'imported')
      .then((items) => {
        if (cancelled) return
        const match = items.find((i) => i.importedLeadId === cadastroLeadId)
        setKommoLeadId(match?.kommoLeadId ?? null)
      })
      .catch(() => {
        if (!cancelled) setKommoLeadId(null)
      })
      .finally(() => {
        if (!cancelled) setResolving(false)
      })
    return () => {
      cancelled = true
    }
  }, [empresaId, cadastroLeadId])

  if (resolving) {
    return (
      <div className="rounded-3xl bg-[#15171b] border border-white/5 p-4 mb-4 flex items-center gap-2 text-[12px] text-white/55">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Carregando origem Kommo…
      </div>
    )
  }
  if (kommoLeadId == null) return null

  return (
    <div className="rounded-3xl bg-[#15171b] border border-violet-400/20 mb-4 overflow-hidden">
      <div className="px-6 h-12 flex items-center gap-2 border-b border-white/5 bg-violet-500/[0.04]">
        <Plug2 className="h-4 w-4 text-violet-300" />
        <h3 className="text-[14px] font-semibold text-white">
          Origem: Kommo <span className="text-violet-300 font-normal">#{kommoLeadId}</span>
        </h3>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
        <KommoNotesSection empresaId={empresaId} kommoLeadId={kommoLeadId} />
        <KommoMessagesSection empresaId={empresaId} kommoLeadId={kommoLeadId} />
      </div>
    </div>
  )
}

function KommoNotesSection({ empresaId, kommoLeadId }: { empresaId: string; kommoLeadId: number }) {
  const [notes, setNotes] = useState<KommoLeadNoteDto[]>([])
  const [loading, setLoading] = useState(true)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    kommoApi
      .leadNotes(empresaId, kommoLeadId)
      .then((list) => {
        if (cancelled) return
        setNotes(list)
        setSupported(true)
      })
      .catch((err) => {
        if (cancelled) return
        if (isBackendNotImplemented(err)) setSupported(false)
        setNotes([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [empresaId, kommoLeadId])

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="h-4 w-4 text-amber-300" />
        <h4 className="text-[13px] font-semibold text-white">Notas da Kommo</h4>
        {notes.length > 0 && (
          <span className="text-[10px] font-bold text-amber-200 bg-amber-500/15 px-1.5 py-0.5 rounded">
            {notes.length}
          </span>
        )}
      </div>
      {!supported ? (
        <p className="text-[11px] text-amber-100/85">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          Endpoint <code className="text-amber-300">GET /kommo/leads/{kommoLeadId}/notes</code> pendente em{' '}
          <strong>CadastraAi.API</strong>.
        </p>
      ) : loading ? (
        <p className="text-[12px] text-white/45">Carregando…</p>
      ) : notes.length === 0 ? (
        <p className="text-[12px] text-white/45">Sem notas neste lead Kommo.</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-[#0c0d10] border border-white/5 p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
                  {n.noteType.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-white/45 tabular-nums">
                  {new Date(n.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              {n.text && <p className="text-[12px] text-white/85 whitespace-pre-wrap break-words">{n.text}</p>}
              {n.createdByName && (
                <p className="text-[10px] text-white/45 mt-1">por {n.createdByName}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function KommoMessagesSection({ empresaId, kommoLeadId }: { empresaId: string; kommoLeadId: number }) {
  const [msgs, setMsgs] = useState<KommoLeadMessageDto[]>([])
  const [loading, setLoading] = useState(true)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    kommoApi
      .leadMessages(empresaId, kommoLeadId, { pageSize: 50 })
      .then((r) => {
        if (cancelled) return
        setMsgs(r.items)
        setSupported(true)
      })
      .catch((err) => {
        if (cancelled) return
        if (isBackendNotImplemented(err)) setSupported(false)
        setMsgs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [empresaId, kommoLeadId])

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="h-4 w-4 text-emerald-300" />
        <h4 className="text-[13px] font-semibold text-white">Conversas (WhatsApp/chat)</h4>
        {msgs.length > 0 && (
          <span className="text-[10px] font-bold text-emerald-200 bg-emerald-500/15 px-1.5 py-0.5 rounded">
            {msgs.length}
          </span>
        )}
      </div>
      {!supported ? (
        <p className="text-[11px] text-amber-100/85">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          Endpoint <code className="text-amber-300">GET /kommo/leads/{kommoLeadId}/messages</code> pendente em{' '}
          <strong>CadastraAi.API</strong>.
        </p>
      ) : loading ? (
        <p className="text-[12px] text-white/45">Carregando…</p>
      ) : msgs.length === 0 ? (
        <p className="text-[12px] text-white/45">Sem mensagens neste lead Kommo.</p>
      ) : (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto">
          {msgs.map((m) => (
            <li
              key={m.id}
              className={cn(
                'rounded-lg border px-3 py-2 max-w-[85%]',
                m.direction === 'in'
                  ? 'bg-white/[0.03] border-white/5 mr-auto'
                  : 'bg-emerald-500/[0.06] border-emerald-400/20 ml-auto',
              )}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-white/55">
                  {m.channel} · {m.direction === 'in' ? '↓ recebido' : '↑ enviado'}
                </span>
                <span className="text-[10px] text-white/45 tabular-nums ml-auto">
                  {new Date(m.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="text-[12px] text-white/85 whitespace-pre-wrap break-words">{m.text}</p>
              {m.authorName && <p className="text-[10px] text-white/45 mt-1">por {m.authorName}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface FunnelStepProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  done: boolean
  detail: string
  onClick?: () => void
  actionLabel?: string
}

function FunnelStep({ icon: Icon, label, done, detail, onClick, actionLabel }: FunnelStepProps) {
  const clickable = Boolean(onClick)
  const Wrapper: React.ElementType = clickable ? 'button' : 'div'
  return (
    <Wrapper
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      aria-label={clickable ? actionLabel : undefined}
      className={cn(
        'group rounded-2xl p-4 border text-left w-full transition-colors',
        done
          ? 'border-cyan-400/30 bg-cyan-500/[0.06]'
          : 'border-white/5 bg-[#15171b]',
        clickable && 'cursor-pointer hover:border-cyan-300/60 hover:bg-cyan-500/[0.10] focus:outline-none focus:ring-2 focus:ring-cyan-400/40',
        !clickable && 'cursor-default',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', done ? 'text-cyan-300' : 'text-white/45')} />
        <span className="text-[11px] uppercase tracking-wider text-white/45">{label}</span>
        {clickable && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80 group-hover:text-cyan-200">
            <Pencil className="h-3 w-3" />
            Editar
          </span>
        )}
      </div>
      <p className={cn('text-[13px]', done ? 'text-white' : 'text-white/55')}>{detail}</p>
    </Wrapper>
  )
}


import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { HeartPulse, Pencil, CheckCircle2, AlertCircle, User as UserIcon, Phone, UserCog, Wallet, ArrowRight, ClipboardPlus, UserPlus } from "@/components/icons"
import { CadastroFormShell } from './form-shell'
import { TextInput, SelectInput, SearchSelect } from './form-fields'
import { RecebimentosEditor, type RecebimentoInput } from './recebimentos-editor'
import {
  empresasApi,
  kommoApi,
  leadsApi,
  recebimentosApi,
  tratamentosApi,
  type CreateTratamentoPayload,
  type EmpresaDto,
  type LeadSummaryDto,
  type RecebimentoDto,
  type TratamentoDto,
} from '@/lib/cadastra/api'
import { useConfig } from '@/lib/cadastra/config-store'
import type { Recebimento, Tratamento } from '@/types/cadastra'

interface TratamentoFormProps {
  onBack: () => void
  onSaved?: (tratamento: Tratamento) => void
  prefilledConsultaId?: string
  editing?: Tratamento
  onNavigateToConsulta?: () => void
  onNavigateToLead?: () => void
}

interface FormState {
  consultaId: string
  planoTratamento: string
  planoPilates: string
  musculacao: string
  procedimento: string
  valorPlano: number
  recebimentos: RecebimentoInput[]
}

const initialState: FormState = {
  consultaId: '',
  planoTratamento: '',
  planoPilates: '',
  musculacao: '',
  procedimento: '',
  valorPlano: 0,
  recebimentos: [],
}

function fromTratamento(t: Tratamento): FormState {
  return {
    consultaId: t.consultaId,
    planoTratamento: t.planoTratamento,
    planoPilates: t.planoPilates ?? '',
    musculacao: t.musculacao ?? '',
    procedimento: t.procedimento ?? '',
    valorPlano: t.valorPlano,
    recebimentos: t.recebimentos.map((r) => ({
      valorRecebimento: r.valorRecebimento,
      formaPagamento: r.formaPagamento,
      dataRecebimento: r.dataRecebimento,
    })),
  }
}

function recebimentoDtoToLocal(r: RecebimentoDto): Recebimento {
  return {
    id: r.id,
    valorRecebimento: r.valorRecebimento,
    formaPagamento: r.formaPagamento,
    dataRecebimento: r.dataRecebimento,
    consultaId: r.consultaId ?? undefined,
    tratamentoId: r.tratamentoId ?? undefined,
  }
}

function tratamentoDtoToLocal(t: TratamentoDto): Tratamento {
  return {
    id: t.id,
    consultaId: t.consultaId,
    planoTratamento: t.planoTratamento,
    planoPilates: t.planoPilates ?? undefined,
    musculacao: t.musculacao ?? undefined,
    procedimento: t.procedimento ?? undefined,
    valorPlano: t.valorPlano,
    recebimentos: (t.recebimentos ?? []).map(recebimentoDtoToLocal),
    createdAt: t.createdAt,
  }
}

export function TratamentoForm({
  onBack,
  onSaved,
  prefilledConsultaId,
  editing,
  onNavigateToConsulta,
  onNavigateToLead,
}: TratamentoFormProps) {
  const config = useConfig()
  const planoOptions = config.planosTratamento.map((p) => ({ value: p, label: p }))

  const [empresas, setEmpresas] = useState<EmpresaDto[]>([])
  const [empresaId, setEmpresaId] = useState<string>('')
  const [leads, setLeads] = useState<LeadSummaryDto[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [data, setData] = useState<FormState>(() =>
    editing
      ? fromTratamento(editing)
      : { ...initialState, consultaId: prefilledConsultaId ?? '' },
  )
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (editing) setData(fromTratamento(editing))
  }, [editing])

  // Resolve empresa: usa a do lead da consulta de referência, senão pega a primeira do usuário.
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const list = await empresasApi.list()
        if (cancelled) return
        setEmpresas(list)

        const refConsultaId = editing?.consultaId ?? prefilledConsultaId
        if (refConsultaId) {
          // Pra descobrir a empresa, varremos as empresas até achar a consulta.
          // Não há endpoint direto consulta→empresa, mas temos consultaId no LeadSummary.
          for (const emp of list) {
            try {
              const resp = await leadsApi.list(emp.id, { pageSize: 500 })
              if (cancelled) return
              const found = resp.items.find((l) => l.consultaId === refConsultaId)
              if (found) {
                setEmpresaId(emp.id)
                setLeads(resp.items)
                return
              }
            } catch { /* tenta próxima */ }
          }
        }
        setEmpresaId(list[0]?.id ?? '')
      } catch (err) {
        if (cancelled) return
        setFeedback({
          kind: 'error',
          msg: err instanceof Error ? err.message : 'Erro ao carregar empresas.',
        })
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [editing, prefilledConsultaId])

  // Sempre que a empresa mudar (e ainda não temos os leads cacheados), recarrega.
  useEffect(() => {
    if (!empresaId) return
    if (leads.length > 0 && leads[0]?.empresaId === empresaId) return
    let cancelled = false
    setLeadsLoading(true)
    leadsApi
      .list(empresaId, { pageSize: 500 })
      .then((res) => {
        if (cancelled) return
        setLeads(res.items)
      })
      .catch((err) => {
        if (cancelled) return
        setFeedback({
          kind: 'error',
          msg: err instanceof Error ? err.message : 'Erro ao carregar consultas.',
        })
      })
      .finally(() => {
        if (!cancelled) setLeadsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  // Consultas elegíveis: leads que TÊM consulta. Se já tem tratamento, mostra desabilitado
  // (exceto a consulta sendo editada).
  const consultaOptions = useMemo(
    () =>
      leads
        .filter((l) => l.temConsulta && l.consultaId)
        .map((l) => {
          const jaTem = l.temTratamento && l.consultaId !== editing?.consultaId
          const orc = l.consultaOrcamento != null
            ? `R$ ${Number(l.consultaOrcamento).toLocaleString('pt-BR')}`
            : 'orçamento —'
          return {
            value: l.consultaId as string,
            label: jaTem ? `${l.nome} · já tem tratamento` : l.nome,
            subtitle: `orçamento ${orc}`,
            disabled: jaTem,
          }
        }),
    [leads, editing?.consultaId],
  )

  const selectedLead = useMemo(
    () => leads.find((l) => l.consultaId && l.consultaId === data.consultaId) ?? null,
    [leads, data.consultaId],
  )

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setData((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    if (!data.consultaId) {
      setFeedback({ kind: 'error', msg: 'Selecione a consulta vinculada.' })
      return
    }
    if (data.recebimentos.length > 6) {
      setFeedback({ kind: 'error', msg: 'Tratamento aceita no máximo 6 recebimentos.' })
      return
    }

    const payload: CreateTratamentoPayload = {
      planoTratamento: data.planoTratamento,
      planoPilates: data.planoPilates || undefined,
      musculacao: data.musculacao || undefined,
      procedimento: data.procedimento || undefined,
      valorPlano: data.valorPlano,
    }

    setSubmitting(true)
    try {
      let dto: TratamentoDto
      if (editing) {
        dto = await tratamentosApi.update(editing.id, payload)
        for (const old of dto.recebimentos ?? []) {
          await recebimentosApi.delete(old.id)
        }
        for (const r of data.recebimentos) {
          await recebimentosApi.createForTratamento(dto.id, r)
        }
      } else {
        dto = await tratamentosApi.create(data.consultaId, payload)
        for (const r of data.recebimentos) {
          await recebimentosApi.createForTratamento(dto.id, r)
        }
      }

      // Re-fetch via lead pra atualizar recebimentos no DTO local.
      const lead = leads.find((l) => l.consultaId === dto.consultaId)
      let tratamento: Tratamento = tratamentoDtoToLocal(dto)
      if (lead) {
        try {
          const refreshed = await leadsApi.get(lead.id)
          if (refreshed.consulta?.tratamento) {
            tratamento = tratamentoDtoToLocal(refreshed.consulta.tratamento)
          }
        } catch { /* mantém o dto cru */ }
      }

      setFeedback({
        kind: 'success',
        msg: editing ? 'Tratamento atualizado com sucesso.' : 'Tratamento cadastrado com sucesso.',
      })

      // #6: push reverso — quando um lead importado da Kommo fecha tratamento, move
      // o lead na Kommo para a etapa "Ganho". Best-effort silencioso: se o backend
      // não tem o endpoint, ou se não acharmos o kommoLeadId, segue a vida.
      if (lead?.id && lead.importado && empresaId) {
        kommoApi
          .inbox(empresaId, 'imported')
          .then((items) => {
            const match = items.find((i) => i.importedLeadId === lead.id)
            if (match?.kommoLeadId != null) {
              return kommoApi.moveLeadStatus(empresaId, match.kommoLeadId, {
                statusId: 142, // 142 = "Ganho" no padrão Kommo; backend pode resolver pelo nome.
                statusName: 'ganho',
              })
            }
          })
          .catch(() => null)
      }

      if (!editing) setData(initialState)
      onSaved?.(tratamento)
    } catch (err) {
      setFeedback({
        kind: 'error',
        msg: err instanceof Error ? err.message : 'Erro inesperado ao salvar tratamento.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!empresaId) {
    return (
      <CadastroFormShell
        title={editing ? 'Editar Tratamento' : 'Cadastrar Tratamento'}
        description="Carregando…"
        icon={editing ? Pencil : HeartPulse}
        accent="#34d399"
        onBack={onBack}
      >
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-white/10 text-sm text-muted-foreground">
          Carregando empresas…
        </div>
      </CadastroFormShell>
    )
  }

  if (!editing && consultaOptions.length === 0 && !leadsLoading) {
    const totalLeads = leads.length
    const leadsComConsulta = leads.filter((l) => l.temConsulta).length
    const consultasLivres = leads.filter((l) => l.temConsulta && !l.temTratamento).length
    const semNenhumLead = totalLeads === 0
    const semConsulta = totalLeads > 0 && leadsComConsulta === 0
    const todasOcupadas = leadsComConsulta > 0 && consultasLivres === 0

    return (
      <CadastroFormShell
        title="Cadastrar Tratamento"
        description="Tratamento se vincula a uma consulta com tratamento fechado."
        icon={HeartPulse}
        accent="#34d399"
        onBack={onBack}
      >
        <div className="space-y-5">
          {/* Diagnóstico do estado atual */}
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.06] px-5 py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-200 mb-1">
                  {semNenhumLead && 'Nenhum lead cadastrado ainda'}
                  {semConsulta && 'Você tem leads, mas nenhum com consulta cadastrada'}
                  {todasOcupadas && 'Todas as consultas já têm tratamento vinculado'}
                </p>
                <p className="text-[13px] text-amber-100/85 leading-relaxed">
                  Tratamento é a <strong>etapa 3</strong> do fluxo. Você precisa ter um lead com
                  uma consulta cadastrada que ainda não tenha tratamento.
                </p>
              </div>
            </div>
          </div>

          {/* Indicador de progresso por etapa */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StepCard
              num={1}
              label="Lead"
              count={totalLeads}
              done={totalLeads > 0}
              hint={totalLeads > 0 ? `${totalLeads} cadastrado${totalLeads === 1 ? '' : 's'}` : 'Nenhum'}
            />
            <StepCard
              num={2}
              label="Consulta"
              count={leadsComConsulta}
              done={leadsComConsulta > 0}
              hint={
                leadsComConsulta > 0
                  ? `${leadsComConsulta} de ${totalLeads}`
                  : 'Aguardando'
              }
            />
            <StepCard
              num={3}
              label="Tratamento"
              count={0}
              done={false}
              hint={consultasLivres > 0 ? 'Pronto para criar' : 'Bloqueado'}
              active
            />
          </div>

          {/* Próxima ação */}
          <div className="rounded-2xl border border-white/10 bg-[#15171b] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45 font-semibold mb-3">
              Próximo passo
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {semNenhumLead && onNavigateToLead && (
                <button
                  onClick={onNavigateToLead}
                  className="flex-1 inline-flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#0d0f14] font-semibold text-sm transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Cadastrar primeiro lead
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {(semConsulta || todasOcupadas) && onNavigateToConsulta && (
                <button
                  onClick={onNavigateToConsulta}
                  className="flex-1 inline-flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#0d0f14] font-semibold text-sm transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <ClipboardPlus className="h-4 w-4" />
                    {semConsulta ? 'Cadastrar consulta agora' : 'Cadastrar nova consulta'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onBack}
                className="px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/70 hover:text-white hover:border-white/20 transition-colors"
              >
                Voltar para Dashboard
              </button>
            </div>
          </div>
        </div>
      </CadastroFormShell>
    )
  }

  return (
    <CadastroFormShell
      title={editing ? 'Editar Tratamento' : 'Cadastrar Tratamento'}
      description={
        editing
          ? 'Atualize os dados do tratamento abaixo.'
          : 'Tratamento fechado — registre plano, valores e recebimentos.'
      }
      icon={editing ? Pencil : HeartPulse}
      accent="#34d399"
      onBack={onBack}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {!editing && empresas.length > 1 && (
          <SelectInput
            label="Empresa"
            value={empresaId}
            onChange={(e) => {
              setEmpresaId(e.target.value)
              setData((prev) => ({ ...prev, consultaId: '' }))
              setLeads([])
            }}
            options={empresas.map((e) => ({ value: e.id, label: e.nome }))}
            placeholder="Selecione a empresa…"
            required
          />
        )}

        {selectedLead ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.05] p-4"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-300 font-semibold mb-3">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Lead e consulta vinculados a este tratamento
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-emerald-300/80 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Nome</div>
                  <div className="font-medium text-foreground">{selectedLead.nome}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-300/80 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Telefone</div>
                  <div className="font-medium text-foreground">{selectedLead.telefone}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-emerald-300/80 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Responsável</div>
                  <div className="font-medium text-foreground">{selectedLead.nomeResponsavel}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-300/80 shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Orçamento</div>
                  <div className="font-medium text-foreground">
                    {selectedLead.consultaOrcamento != null
                      ? `R$ ${Number(selectedLead.consultaOrcamento).toLocaleString('pt-BR')}`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <SearchSelect
            label="Consulta vinculada"
            value={data.consultaId}
            onChange={(v) => set('consultaId', v)}
            options={consultaOptions}
            placeholder={leadsLoading ? 'Carregando consultas…' : 'Selecione uma consulta…'}
            searchPlaceholder="Pesquisar pelo nome do lead…"
            required
            hint="Digite parte do nome do lead. As consultas marcadas como 'já tem tratamento' ficam desabilitadas."
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectInput
            label="Plano de tratamento"
            value={data.planoTratamento}
            onChange={(e) => set('planoTratamento', e.target.value)}
            options={planoOptions}
            placeholder="Selecione…"
            required
          />
          <TextInput
            label="Valor do plano"
            type="number"
            min={0}
            step="0.01"
            value={data.valorPlano}
            onChange={(e) => set('valorPlano', Number(e.target.value))}
            placeholder="0,00"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TextInput
            label="Plano de Pilates"
            placeholder="Opcional"
            value={data.planoPilates}
            onChange={(e) => set('planoPilates', e.target.value)}
          />
          <TextInput
            label="Musculação"
            placeholder="Opcional"
            value={data.musculacao}
            onChange={(e) => set('musculacao', e.target.value)}
          />
          <TextInput
            label="Procedimento"
            placeholder="Opcional"
            value={data.procedimento}
            onChange={(e) => set('procedimento', e.target.value)}
          />
        </div>

        <RecebimentosEditor
          value={data.recebimentos}
          onChange={(v) => set('recebimentos', v)}
          max={6}
        />

        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={
              feedback.kind === 'success'
                ? 'flex items-start gap-2 p-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-sm'
                : 'flex items-start gap-2 p-3 rounded-lg border border-red-400/30 bg-red-500/10 text-red-300 text-sm'
            }
          >
            {feedback.kind === 'success' ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </motion.div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={() => {
              setData(editing ? fromTratamento(editing) : initialState)
              setFeedback(null)
            }}
            className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-sm text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
          >
            {editing ? 'Restaurar' : 'Limpar'}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-[#0d0f14] bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_24px_rgba(52,211,153,0.35)] hover:from-emerald-300 hover:to-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {submitting
              ? (editing ? 'Salvando…' : 'Cadastrando…')
              : (editing ? 'Salvar alterações' : 'Cadastrar Tratamento')}
          </button>
        </div>
      </form>
    </CadastroFormShell>
  )
}

function StepCard({
  num,
  label,
  count,
  done,
  hint,
  active,
}: {
  num: number
  label: string
  count: number
  done: boolean
  hint: string
  active?: boolean
}) {
  return (
    <div
      className={
        'rounded-2xl border px-4 py-3 ' +
        (done
          ? 'border-emerald-400/30 bg-emerald-500/[0.06]'
          : active
            ? 'border-cyan-400/30 bg-cyan-500/[0.06]'
            : 'border-white/10 bg-white/[0.02]')
      }
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={
            'h-6 w-6 grid place-items-center rounded-full text-[11px] font-bold ' +
            (done
              ? 'bg-emerald-400 text-emerald-950'
              : active
                ? 'bg-cyan-400 text-cyan-950'
                : 'bg-white/10 text-white/55')
          }
        >
          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : num}
        </span>
        <p className={'text-[13px] font-semibold ' + (done ? 'text-emerald-200' : active ? 'text-cyan-200' : 'text-white/65')}>
          {label}
        </p>
      </div>
      <p className="text-[11px] text-white/55 ml-8">{hint}</p>
    </div>
  )
}

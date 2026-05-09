
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardPlus, Pencil, CheckCircle2, AlertCircle, User as UserIcon, Phone, UserCog } from 'lucide-react'
import { CadastroFormShell } from './form-shell'
import { TextInput, SelectInput, ToggleSwitch, SearchSelect } from './form-fields'
import { RecebimentosEditor, type RecebimentoInput } from './recebimentos-editor'
import {
  consultasApi,
  leadsApi,
  recebimentosApi,
  type ConsultaDto,
  type CreateConsultaPayload,
  type LeadSummaryDto,
  type RecebimentoDto,
} from '@/lib/cadastra/api'
import { useEmpresa } from '@/contexts/cadastra/empresa-context'
import { useConfig } from '@/lib/cadastra/config-store'
import {
  MOTIVOS_NAO_FECHAMENTO_DEFAULT,
  type Consulta,
  type CorSemaforo,
  type Lead,
  type Recebimento,
} from '@/types/cadastra'

interface ConsultaFormProps {
  onBack: () => void
  onSaved?: (consulta: Consulta) => void
  prefilledLeadId?: string
  editing?: Consulta
}

interface FormState {
  leadId: string
  valorConsulta: number
  pagamentoAntecipado: boolean
  recebimentos: RecebimentoInput[]
  tratamentoIndicado: string
  orcamento: number
  compareceu: boolean
  fechouTratamento: boolean
  motivoNaoFechamento: string
}

const initialState: FormState = {
  leadId: '',
  valorConsulta: 0,
  pagamentoAntecipado: false,
  recebimentos: [],
  tratamentoIndicado: '',
  orcamento: 0,
  compareceu: true,
  fechouTratamento: false,
  motivoNaoFechamento: '',
}

function fromConsulta(c: Consulta): FormState {
  return {
    leadId: c.leadId,
    valorConsulta: c.valorConsulta,
    pagamentoAntecipado: c.pagamentoAntecipado,
    recebimentos: c.recebimentos.map((r) => ({
      valorRecebimento: r.valorRecebimento,
      formaPagamento: r.formaPagamento,
      dataRecebimento: r.dataRecebimento,
    })),
    tratamentoIndicado: c.tratamentoIndicado,
    orcamento: c.orcamento,
    compareceu: c.compareceu,
    fechouTratamento: c.fechouTratamento,
    motivoNaoFechamento: c.motivoNaoFechamento ?? '',
  }
}

function summaryToLead(s: LeadSummaryDto): Lead {
  return {
    id: s.id,
    empresaId: s.empresaId,
    nome: s.nome,
    telefone: s.telefone,
    origem: s.origem,
    tipo: (s.tipo === 'Resgate' ? 'Resgate' : 'Cadastro') as Lead['tipo'],
    tipoResgate: s.tipoResgate ?? undefined,
    interacao: s.interacao,
    agendouConsulta: s.agendouConsulta,
    pagamentoAntecipado: s.pagamentoAntecipado,
    dataAgendamento: s.dataAgendamento ?? undefined,
    motivoNaoAgendamento: s.motivoNaoAgendamento ?? undefined,
    nomeResponsavel: s.nomeResponsavel,
    createdAt: s.createdAt,
    importado: s.importado,
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

function consultaDtoToLocal(c: ConsultaDto): Consulta {
  return {
    id: c.id,
    leadId: c.leadId,
    valorConsulta: c.valorConsulta,
    pagamentoAntecipado: c.pagamentoAntecipado,
    recebimentos: (c.recebimentos ?? []).map(recebimentoDtoToLocal),
    tratamentoIndicado: c.tratamentoIndicado,
    orcamento: c.orcamento,
    compareceu: c.compareceu,
    fechouTratamento: c.fechouTratamento,
    motivoNaoFechamento: c.motivoNaoFechamento ?? undefined,
    createdAt: c.createdAt,
  }
}

const corClasses: Record<CorSemaforo, string> = {
  verde: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
  amarelo: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  vermelho: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]',
}

function SemaforoDot({ cor }: { cor: CorSemaforo }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${corClasses[cor]}`} aria-hidden />
}

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-cyan-400/30 bg-cyan-500/[0.05] p-4"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-cyan-300 font-semibold mb-3">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Lead vinculado a esta consulta
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-cyan-300/80 shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Nome</div>
            <div className="font-medium text-foreground">{lead.nome}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-cyan-300/80 shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Telefone</div>
            <div className="font-medium text-foreground">{lead.telefone}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 text-cyan-300/80 shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Responsável</div>
            <div className="font-medium text-foreground">{lead.nomeResponsavel}</div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function ConsultaForm({ onBack, onSaved, prefilledLeadId, editing }: ConsultaFormProps) {
  const config = useConfig()
  const planoOptions = useMemo(
    () => config.planosTratamento.map((p) => ({ value: p, label: p })),
    [config.planosTratamento],
  )

  const { empresas, currentEmpresa, setCurrentEmpresaId } = useEmpresa()
  const [leads, setLeads] = useState<LeadSummaryDto[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Empresa do form: começa com a ativa do contexto. Se editing/prefill resolver
  // pra outra empresa, troca a ativa global pra refletir nas outras views.
  const [empresaId, setEmpresaId] = useState<string>(currentEmpresa?.id ?? '')

  const [data, setData] = useState<FormState>(() =>
    editing ? fromConsulta(editing) : { ...initialState, leadId: prefilledLeadId ?? '' },
  )
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (editing) setData(fromConsulta(editing))
  }, [editing])

  // Mantém empresaId em sync com o contexto enquanto não há prefill/editing.
  useEffect(() => {
    if (currentEmpresa && !empresaId) setEmpresaId(currentEmpresa.id)
  }, [currentEmpresa, empresaId])

  // Se for edição/prefill, descobre a empresa do lead correspondente e
  // promove pra empresa ativa global.
  useEffect(() => {
    let cancelled = false
    async function init() {
      const refLeadId = editing?.leadId ?? prefilledLeadId
      if (!refLeadId) return
      try {
        const detail = await leadsApi.get(refLeadId)
        if (cancelled) return
        setEmpresaId(detail.empresaId)
        if (detail.empresaId !== currentEmpresa?.id) setCurrentEmpresaId(detail.empresaId)
      } catch {
        // mantém empresa atual
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [editing, prefilledLeadId])

  // Carrega leads da empresa selecionada (até 500). É o universo do select.
  useEffect(() => {
    if (!empresaId) return
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
          msg: err instanceof Error ? err.message : 'Erro ao carregar leads.',
        })
      })
      .finally(() => {
        if (!cancelled) setLeadsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [empresaId])

  const selectedLead: Lead | null = useMemo(() => {
    const summary = leads.find((l) => l.id === data.leadId)
    return summary ? summaryToLead(summary) : null
  }, [leads, data.leadId])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setData((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    if (!data.leadId) {
      setFeedback({ kind: 'error', msg: 'Selecione o lead.' })
      return
    }
    if (!data.fechouTratamento && !data.motivoNaoFechamento.trim()) {
      setFeedback({ kind: 'error', msg: 'Informe o motivo do não fechamento do tratamento.' })
      return
    }
    if (!data.fechouTratamento) {
      const ok = window.confirm('Ele realmente não fechou tratamento?')
      if (!ok) return
    }
    if (data.recebimentos.length > 2) {
      setFeedback({ kind: 'error', msg: 'Consulta aceita no máximo 2 recebimentos.' })
      return
    }

    const payload: CreateConsultaPayload = {
      valorConsulta: data.valorConsulta,
      pagamentoAntecipado: data.pagamentoAntecipado,
      tratamentoIndicado: data.tratamentoIndicado,
      orcamento: data.orcamento,
      compareceu: data.compareceu,
      fechouTratamento: data.fechouTratamento,
      motivoNaoFechamento: data.fechouTratamento ? undefined : data.motivoNaoFechamento.trim() || undefined,
    }

    setSubmitting(true)
    try {
      let consultaDto: ConsultaDto
      if (editing) {
        consultaDto = await consultasApi.update(editing.id, payload)
        // Reposta os recebimentos: deleta os existentes e recria os novos.
        for (const old of consultaDto.recebimentos ?? []) {
          await recebimentosApi.delete(old.id)
        }
        for (const r of data.recebimentos) {
          await recebimentosApi.createForConsulta(consultaDto.id, r)
        }
      } else {
        consultaDto = await consultasApi.create(data.leadId, payload)
        for (const r of data.recebimentos) {
          await recebimentosApi.createForConsulta(consultaDto.id, r)
        }
      }

      // Recarrega a consulta com os recebimentos atualizados
      // (lendo o lead inteiro pra garantir consistência).
      const refreshedLead = await leadsApi.get(consultaDto.leadId)
      const consulta: Consulta = refreshedLead.consulta
        ? consultaDtoToLocal(refreshedLead.consulta)
        : consultaDtoToLocal(consultaDto)

      const leadName = leads.find((l) => l.id === consulta.leadId)?.nome ?? 'lead'
      setFeedback({
        kind: 'success',
        msg: editing ? `Consulta de ${leadName} atualizada.` : `Consulta cadastrada para ${leadName}.`,
      })
      if (!editing) setData({ ...initialState })
      onSaved?.(consulta)
    } catch (err) {
      setFeedback({
        kind: 'error',
        msg: err instanceof Error ? err.message : 'Erro inesperado ao salvar consulta.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!empresaId) {
    return (
      <CadastroFormShell
        title={editing ? 'Editar Consulta' : 'Cadastrar Consulta'}
        description="Carregando…"
        icon={editing ? Pencil : ClipboardPlus}
        accent="#a78bfa"
        onBack={onBack}
      >
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-white/10 text-sm text-muted-foreground">
          Carregando empresas…
        </div>
      </CadastroFormShell>
    )
  }

  if (!editing && leads.length === 0 && !leadsLoading) {
    return (
      <CadastroFormShell
        title="Cadastrar Consulta"
        description="Cada consulta é vinculada a um lead já cadastrado."
        icon={ClipboardPlus}
        accent="#a78bfa"
        onBack={onBack}
      >
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-white/10">
          <p className="text-base text-foreground font-medium mb-2">Nenhum lead disponível</p>
          <p className="text-sm text-muted-foreground">
            Cadastre primeiro um lead para então registrar a consulta dele.
          </p>
        </div>
      </CadastroFormShell>
    )
  }

  return (
    <CadastroFormShell
      title={editing ? 'Editar Consulta' : 'Cadastrar Consulta'}
      description={
        editing
          ? 'Atualize os dados da consulta abaixo.'
          : 'Consulta — vincula-se a um lead e pode gerar tratamento.'
      }
      icon={editing ? Pencil : ClipboardPlus}
      accent="#a78bfa"
      onBack={onBack}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {!editing && empresas.length > 1 && (
          <SelectInput
            label="Empresa"
            value={empresaId}
            onChange={(e) => {
              setEmpresaId(e.target.value)
              setCurrentEmpresaId(e.target.value)
              setData((prev) => ({ ...prev, leadId: '' }))
            }}
            options={empresas.map((e) => ({ value: e.id, label: e.nome }))}
            placeholder="Selecione a empresa…"
            required
          />
        )}

        {selectedLead ? (
          <LeadCard lead={selectedLead} />
        ) : (
          <SearchSelect
            label="Lead"
            value={data.leadId}
            onChange={(v) => set('leadId', v)}
            options={leads.map((l) => {
              const jaTem = l.temConsulta && l.consultaId !== editing?.id
              return {
                value: l.id,
                label: jaTem ? `${l.nome} · já tem consulta` : l.nome,
                subtitle: l.telefone,
                disabled: jaTem,
              }
            })}
            placeholder={leadsLoading ? 'Carregando leads…' : 'Selecione um lead…'}
            searchPlaceholder="Pesquisar lead pelo nome ou telefone…"
            required
            hint="Digite parte do nome do lead. Os marcados como 'já tem consulta' ficam desabilitados."
          />
        )}

        <ToggleSwitch
          label="Compareceu na consulta?"
          description="Marque se o lead realmente apareceu no horário marcado"
          checked={data.compareceu}
          onChange={(v) => set('compareceu', v)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextInput
            label="Valor da consulta"
            type="number"
            min={0}
            step="0.01"
            value={data.valorConsulta}
            onChange={(e) => set('valorConsulta', Number(e.target.value))}
            placeholder="0,00"
            required
          />
          <TextInput
            label="Orçamento do tratamento"
            type="number"
            min={0}
            step="0.01"
            value={data.orcamento}
            onChange={(e) => set('orcamento', Number(e.target.value))}
            placeholder="0,00"
            required
          />
        </div>

        <SelectInput
          label="Tratamento indicado"
          value={data.tratamentoIndicado}
          onChange={(e) => set('tratamentoIndicado', e.target.value)}
          options={planoOptions}
          placeholder={
            planoOptions.length === 0
              ? 'Cadastre planos em Configurações'
              : 'Selecione o plano indicado…'
          }
          required
          hint="Os planos vêm da lista 'Planos de tratamento' em Configurações."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ToggleSwitch
            label="Pagamento antecipado?"
            description="Pagou antes da consulta"
            checked={data.pagamentoAntecipado}
            onChange={(v) => set('pagamentoAntecipado', v)}
          />
          <ToggleSwitch
            label="Fechou tratamento?"
            description="Aceitou seguir com o tratamento"
            checked={data.fechouTratamento}
            onChange={(v) => {
              if (!v && data.fechouTratamento) {
                const ok = window.confirm('Ele realmente não fechou tratamento?')
                if (!ok) return
              }
              set('fechouTratamento', v)
            }}
          />
        </div>

        {!data.fechouTratamento && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <label className="block text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Motivo do não fechamento
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MOTIVOS_NAO_FECHAMENTO_DEFAULT.map((m) => {
                const active = data.motivoNaoFechamento === m.nome
                return (
                  <button
                    type="button"
                    key={m.nome}
                    onClick={() => set('motivoNaoFechamento', m.nome)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                      active
                        ? 'border-purple-400/60 bg-purple-500/10 text-foreground'
                        : 'border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/20 hover:text-foreground'
                    }`}
                  >
                    <SemaforoDot cor={m.cor} />
                    <span className="flex-1">{m.nome}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Não achou o motivo? Vá em <strong>Configurações da empresa</strong> para adicionar mais.
            </p>
          </motion.div>
        )}

        <RecebimentosEditor
          value={data.recebimentos}
          onChange={(v) => set('recebimentos', v)}
          max={2}
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
              setData(
                editing
                  ? fromConsulta(editing)
                  : { ...initialState, leadId: prefilledLeadId ?? '' },
              )
              setFeedback(null)
            }}
            className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-sm text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
          >
            {editing ? 'Restaurar' : 'Limpar'}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-[#0d0f14] bg-gradient-to-r from-purple-400 to-fuchsia-500 shadow-[0_0_24px_rgba(167,139,250,0.35)] hover:from-purple-300 hover:to-fuchsia-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {submitting
              ? (editing ? 'Salvando…' : 'Cadastrando…')
              : (editing ? 'Salvar alterações' : 'Cadastrar Consulta')}
          </button>
        </div>
      </form>
    </CadastroFormShell>
  )
}

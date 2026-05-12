
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { UserPlus, CheckCircle2, AlertCircle, Pencil } from "@/components/icons"
import { CadastroFormShell } from './form-shell'
import { TextInput, SelectInput, Segmented, ToggleSwitch } from './form-fields'
import {
  leadsApi,
  type CreateLeadPayload,
  type LeadDetailDto,
} from '@/lib/cadastra/api'
import { useEmpresa } from '@/contexts/cadastra/empresa-context'
import { useConfig } from '@/lib/cadastra/config-store'
import type { Lead, LeadFormData } from '@/types/cadastra'
import { MOTIVOS_NAO_AGENDAMENTO } from '@/types/cadastra'

function leadDetailToLead(d: LeadDetailDto): Lead {
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

function buildPayload(data: LeadFormData): CreateLeadPayload {
  return {
    nome: data.nome.trim(),
    telefone: data.telefone.trim(),
    origem: data.origem.trim(),
    tipo: data.tipo,
    tipoResgate: data.tipo === 'Resgate' ? data.tipoResgate : undefined,
    interacao: data.interacao,
    agendouConsulta: data.agendouConsulta,
    pagamentoAntecipado: data.pagamentoAntecipado,
    dataAgendamento: data.agendouConsulta ? data.dataAgendamento || undefined : undefined,
    motivoNaoAgendamento: !data.agendouConsulta ? data.motivoNaoAgendamento?.trim() || undefined : undefined,
    nomeResponsavel: data.nomeResponsavel,
  }
}

interface LeadFormProps {
  onBack: () => void
  onSaved?: (lead: Lead) => void
  editing?: Lead
}

const initialState: LeadFormData = {
  nome: '',
  telefone: '',
  origem: '',
  tipo: 'Cadastro',
  tipoResgate: undefined,
  interacao: false,
  agendouConsulta: false,
  pagamentoAntecipado: false,
  dataAgendamento: '',
  motivoNaoAgendamento: '',
  nomeResponsavel: '',
}

function fromLead(lead: Lead): LeadFormData {
  return {
    nome: lead.nome,
    telefone: lead.telefone,
    origem: lead.origem,
    tipo: lead.tipo,
    tipoResgate: lead.tipoResgate,
    interacao: lead.interacao,
    agendouConsulta: lead.agendouConsulta,
    pagamentoAntecipado: lead.pagamentoAntecipado,
    dataAgendamento: lead.dataAgendamento ?? '',
    motivoNaoAgendamento: lead.motivoNaoAgendamento ?? '',
    nomeResponsavel: lead.nomeResponsavel,
  }
}

export function LeadForm({ onBack, onSaved, editing }: LeadFormProps) {
  const config = useConfig()
  const [data, setData] = useState<LeadFormData>(() =>
    editing ? fromLead(editing) : { ...initialState, nomeResponsavel: '' },
  )
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Empresa ativa vem do contexto global. Edição mantém a empresa original
  // do lead (não permite trocar empresa de um lead existente).
  const { empresas, currentEmpresa, isLoading: empresasLoading, setCurrentEmpresaId } = useEmpresa()
  const empresaId = editing?.empresaId ?? currentEmpresa?.id ?? ''

  useEffect(() => {
    if (editing) setData(fromLead(editing))
  }, [editing])

  const set = <K extends keyof LeadFormData>(key: K, value: LeadFormData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    if (data.tipo === 'Resgate' && !data.tipoResgate) {
      setFeedback({ kind: 'error', msg: 'Selecione o tipo de resgate.' })
      return
    }
    if (data.agendouConsulta && !data.dataAgendamento) {
      setFeedback({ kind: 'error', msg: 'Informe a data do agendamento.' })
      return
    }
    if (!data.agendouConsulta && !data.motivoNaoAgendamento?.trim()) {
      setFeedback({ kind: 'error', msg: 'Informe o motivo de não ter agendado.' })
      return
    }
    if (!data.nomeResponsavel) {
      setFeedback({ kind: 'error', msg: 'Selecione o responsável.' })
      return
    }
    if (!editing && !empresaId) {
      setFeedback({
        kind: 'error',
        msg: empresasLoading
          ? 'Carregando empresas, aguarde…'
          : 'Nenhuma empresa disponível para receber o cadastro.',
      })
      return
    }

    setSubmitting(true)
    try {
      const payload = buildPayload(data)
      const dto = editing
        ? await leadsApi.update(editing.id, payload)
        : await leadsApi.create(empresaId, payload)
      const lead = leadDetailToLead(dto)
      setFeedback({
        kind: 'success',
        msg: editing
          ? `Lead "${lead.nome}" atualizado com sucesso.`
          : `Lead "${lead.nome}" cadastrado com sucesso.`,
      })
      if (!editing) setData({ ...initialState, nomeResponsavel: '' })
      onSaved?.(lead)
    } catch (err) {
      setFeedback({
        kind: 'error',
        msg: err instanceof Error ? err.message : 'Não foi possível salvar o lead.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const title = editing ? 'Editar Lead' : 'Cadastrar Lead'
  const description = editing
    ? `Atualize as informações de ${editing.nome}.`
    : 'Cadastro Geral — registre um novo lead e o status do primeiro contato.'
  const Icon = editing ? Pencil : UserPlus

  // Hero específico do CADASTRO MANUAL — diferencia visualmente da importação em massa.
  const manualHero = (
    <div
      className="rounded-3xl p-7 mb-5 text-cyan-50 ring-2 ring-cyan-300/40 shadow-[0_0_0_4px_rgba(34,211,238,0.06)]"
      style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 55%, #075985 100%)' }}
    >
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-white/15 grid place-items-center shrink-0">
          <Icon className="h-6 w-6 text-white" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2 h-5 rounded-md bg-white/20 text-[10px] font-bold uppercase tracking-[0.2em] text-white mb-2">
            Modo: cadastro manual
          </span>
          <h1 className="text-[28px] font-bold tracking-tight leading-none">{title}</h1>
          <p className="text-[13px] text-cyan-100/95 mt-2 leading-relaxed">
            Registro <strong className="text-white">individual</strong>, um lead por vez. Este lead será marcado como <strong className="text-white">&quot;MANUAL&quot;</strong>.
          </p>
          <p className="text-[12px] text-cyan-100/85 mt-1.5">
            Para subir vários leads de uma planilha CSV, use o menu <strong>“Importar Planilha”</strong>.
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <CadastroFormShell title={title} description={description} icon={Icon} onBack={onBack} hero={editing ? undefined : manualHero}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {!editing && empresas.length > 1 && (
          <SelectInput
            label="Empresa"
            value={empresaId}
            onChange={(e) => setCurrentEmpresaId(e.target.value)}
            options={empresas.map((e) => ({ value: e.id, label: e.nome }))}
            placeholder="Selecione a empresa…"
            required
            hint="O lead será cadastrado nesta empresa. (troca a empresa ativa do app)"
          />
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextInput
            label="Nome"
            placeholder="Nome completo do lead"
            value={data.nome}
            onChange={(e) => set('nome', e.target.value)}
            required
          />
          <TextInput
            label="Telefone"
            placeholder="(00) 00000-0000"
            value={data.telefone}
            onChange={(e) => set('telefone', e.target.value)}
            required
          />
          <SelectInput
            label="Origem"
            value={data.origem}
            onChange={(e) => set('origem', e.target.value)}
            options={config.origens.map((o) => ({ value: o, label: o }))}
            placeholder="Selecione…"
            required
            hint="Gerencie a lista em Configurações."
          />
          <SelectInput
            label="Responsável"
            value={data.nomeResponsavel}
            onChange={(e) => set('nomeResponsavel', e.target.value)}
            options={config.responsaveis.map((r) => ({ value: r, label: r }))}
            placeholder="Selecione…"
            required
            hint="Gerencie a equipe em Configurações."
          />
        </div>

        <Segmented<LeadFormData['tipo']>
          label="Tipo de cadastro"
          value={data.tipo}
          onChange={(v) =>
            setData((prev) => ({
              ...prev,
              tipo: v,
              tipoResgate: v === 'Resgate' ? prev.tipoResgate ?? config.tiposResgate[0] : undefined,
            }))
          }
          options={[
            { value: 'Cadastro', label: 'Cadastro', description: 'Lead novo' },
            { value: 'Resgate', label: 'Resgate', description: 'Lead recuperado' },
          ]}
          required
        />

        {data.tipo === 'Resgate' && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            <SelectInput
              label="Tipo de resgate"
              value={data.tipoResgate ?? ''}
              onChange={(e) => set('tipoResgate', e.target.value)}
              options={config.tiposResgate.map((t) => ({ value: t, label: t }))}
              placeholder="Selecione…"
              required
            />
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ToggleSwitch
            label="Houve interação?"
            description="O lead respondeu/interagiu"
            checked={data.interacao}
            onChange={(v) => set('interacao', v)}
          />
          <ToggleSwitch
            label="Agendou consulta?"
            description="Consulta marcada"
            checked={data.agendouConsulta}
            onChange={(v) => set('agendouConsulta', v)}
          />
          <ToggleSwitch
            label="Pagamento antecipado?"
            description="Já pagou pela consulta"
            checked={data.pagamentoAntecipado}
            onChange={(v) => set('pagamentoAntecipado', v)}
          />
        </div>

        {data.agendouConsulta ? (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            <TextInput
              label="Data do agendamento"
              type="datetime-local"
              value={data.dataAgendamento ?? ''}
              onChange={(e) => set('dataAgendamento', e.target.value)}
              required
            />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            <SelectInput
              label="Motivo do não agendamento"
              placeholder="Selecione o motivo…"
              value={data.motivoNaoAgendamento ?? ''}
              onChange={(e) => set('motivoNaoAgendamento', e.target.value)}
              options={MOTIVOS_NAO_AGENDAMENTO.map((m) => ({ value: m, label: m }))}
              required
            />
          </motion.div>
        )}

        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={
              feedback.kind === 'success'
                ? 'flex items-start gap-2 p-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.08] text-cyan-200 text-sm'
                : 'flex items-start gap-2 p-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 text-rose-200 text-sm'
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

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-white/[0.05]">
          <button
            type="button"
            onClick={() => {
              setData(editing ? fromLead(editing) : { ...initialState, nomeResponsavel: '' })
              setFeedback(null)
            }}
            className="px-4 h-11 rounded-2xl border border-white/[0.05] bg-[#0c0d10] text-sm text-white/65 hover:text-white hover:border-white/[0.12] transition-colors"
          >
            {editing ? 'Restaurar' : 'Limpar'}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 h-11 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-colors"
          >
            {submitting
              ? (editing ? 'Salvando…' : 'Cadastrando…')
              : (editing ? 'Salvar alterações' : 'Cadastrar Lead')}
          </button>
        </div>
      </form>
    </CadastroFormShell>
  )
}

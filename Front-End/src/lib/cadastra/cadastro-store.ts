
import { useEffect, useState, useSyncExternalStore } from 'react'
import type {
  Lead,
  Consulta,
  Tratamento,
  Recebimento,
  LeadFormData,
  ConsultaFormData,
  TratamentoFormData,
} from '@/types/cadastra'

const STORAGE_KEY = 'cadastraai_store_v1'

interface StoreState {
  leads: Lead[]
  consultas: Consulta[]
  tratamentos: Tratamento[]
}

const emptyState: StoreState = { leads: [], consultas: [], tratamentos: [] }

const listeners = new Set<() => void>()
let memoryState: StoreState = emptyState
let initialized = false

function loadFromStorage(): StoreState {
  if (typeof window === 'undefined') return emptyState
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState
    const parsed = JSON.parse(raw) as StoreState
    return {
      leads: parsed.leads ?? [],
      consultas: parsed.consultas ?? [],
      tratamentos: parsed.tratamentos ?? [],
    }
  } catch {
    return emptyState
  }
}

function persist(state: StoreState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

function ensureInit() {
  if (initialized || typeof window === 'undefined') return
  memoryState = loadFromStorage()
  initialized = true
}

function emit() {
  for (const l of listeners) l()
}

function subscribe(cb: () => void) {
  ensureInit()
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): StoreState {
  ensureInit()
  return memoryState
}

function getServerSnapshot(): StoreState {
  return emptyState
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function buildRecebimentos(
  inputs: { valorRecebimento: number; formaPagamento: string; dataRecebimento: string }[],
  parent: { consultaId?: string; tratamentoId?: string },
): Recebimento[] {
  return inputs.map((r) => ({
    id: makeId('rec'),
    valorRecebimento: r.valorRecebimento,
    formaPagamento: r.formaPagamento,
    dataRecebimento: r.dataRecebimento,
    consultaId: parent.consultaId,
    tratamentoId: parent.tratamentoId,
  }))
}

export function addLead(data: LeadFormData): Lead {
  ensureInit()
  const lead: Lead = {
    id: makeId('lead'),
    nome: data.nome,
    telefone: data.telefone,
    origem: data.origem,
    tipo: data.tipo,
    tipoResgate: data.tipo === 'Resgate' ? data.tipoResgate : undefined,
    interacao: data.interacao,
    agendouConsulta: data.agendouConsulta,
    pagamentoAntecipado: data.pagamentoAntecipado,
    dataAgendamento: data.agendouConsulta ? data.dataAgendamento : undefined,
    motivoNaoAgendamento: !data.agendouConsulta ? data.motivoNaoAgendamento : undefined,
    nomeResponsavel: data.nomeResponsavel,
    createdAt: nowIso(),
  }
  memoryState = { ...memoryState, leads: [lead, ...memoryState.leads] }
  persist(memoryState)
  emit()
  return lead
}

export function addConsulta(data: ConsultaFormData): Consulta {
  ensureInit()
  if (data.recebimentos.length > 2) {
    throw new Error('Consulta aceita no máximo 2 recebimentos')
  }
  const id = makeId('cons')
  const recebimentos = buildRecebimentos(data.recebimentos, { consultaId: id })
  const consulta: Consulta = {
    id,
    leadId: data.leadId,
    valorConsulta: data.valorConsulta,
    pagamentoAntecipado: data.pagamentoAntecipado,
    recebimentos,
    tratamentoIndicado: data.tratamentoIndicado,
    orcamento: data.orcamento,
    compareceu: data.compareceu,
    fechouTratamento: data.fechouTratamento,
    motivoNaoFechamento: !data.fechouTratamento ? data.motivoNaoFechamento : undefined,
    createdAt: nowIso(),
  }
  memoryState = { ...memoryState, consultas: [consulta, ...memoryState.consultas] }
  persist(memoryState)
  emit()
  return consulta
}

export function addTratamento(data: TratamentoFormData): Tratamento {
  ensureInit()
  if (data.recebimentos.length > 6) {
    throw new Error('Tratamento aceita no máximo 6 recebimentos')
  }
  const id = makeId('trat')
  const recebimentos = buildRecebimentos(data.recebimentos, { tratamentoId: id })
  const tratamento: Tratamento = {
    id,
    consultaId: data.consultaId,
    planoTratamento: data.planoTratamento,
    planoPilates: data.planoPilates,
    musculacao: data.musculacao,
    procedimento: data.procedimento,
    valorPlano: data.valorPlano,
    recebimentos,
    createdAt: nowIso(),
  }
  memoryState = { ...memoryState, tratamentos: [tratamento, ...memoryState.tratamentos] }
  persist(memoryState)
  emit()
  return tratamento
}

export function updateLead(id: string, data: LeadFormData): Lead | null {
  ensureInit()
  const existing = memoryState.leads.find((l) => l.id === id)
  if (!existing) return null
  const updated: Lead = {
    ...existing,
    nome: data.nome,
    telefone: data.telefone,
    origem: data.origem,
    tipo: data.tipo,
    tipoResgate: data.tipo === 'Resgate' ? data.tipoResgate : undefined,
    interacao: data.interacao,
    agendouConsulta: data.agendouConsulta,
    pagamentoAntecipado: data.pagamentoAntecipado,
    dataAgendamento: data.agendouConsulta ? data.dataAgendamento : undefined,
    motivoNaoAgendamento: !data.agendouConsulta ? data.motivoNaoAgendamento : undefined,
    nomeResponsavel: data.nomeResponsavel,
  }
  memoryState = {
    ...memoryState,
    leads: memoryState.leads.map((l) => (l.id === id ? updated : l)),
  }
  persist(memoryState)
  emit()
  return updated
}

export function updateConsulta(id: string, data: ConsultaFormData): Consulta | null {
  ensureInit()
  const existing = memoryState.consultas.find((c) => c.id === id)
  if (!existing) return null
  if (data.recebimentos.length > 2) {
    throw new Error('Consulta aceita no máximo 2 recebimentos')
  }
  const recebimentos = buildRecebimentos(data.recebimentos, { consultaId: id })
  const updated: Consulta = {
    ...existing,
    valorConsulta: data.valorConsulta,
    pagamentoAntecipado: data.pagamentoAntecipado,
    recebimentos,
    tratamentoIndicado: data.tratamentoIndicado,
    orcamento: data.orcamento,
    compareceu: data.compareceu,
    fechouTratamento: data.fechouTratamento,
    motivoNaoFechamento: !data.fechouTratamento ? data.motivoNaoFechamento : undefined,
  }
  memoryState = {
    ...memoryState,
    consultas: memoryState.consultas.map((c) => (c.id === id ? updated : c)),
  }
  persist(memoryState)
  emit()
  return updated
}

export function updateTratamento(id: string, data: TratamentoFormData): Tratamento | null {
  ensureInit()
  const existing = memoryState.tratamentos.find((t) => t.id === id)
  if (!existing) return null
  if (data.recebimentos.length > 6) {
    throw new Error('Tratamento aceita no máximo 6 recebimentos')
  }
  const recebimentos = buildRecebimentos(data.recebimentos, { tratamentoId: id })
  const updated: Tratamento = {
    ...existing,
    planoTratamento: data.planoTratamento,
    planoPilates: data.planoPilates,
    musculacao: data.musculacao,
    procedimento: data.procedimento,
    valorPlano: data.valorPlano,
    recebimentos,
  }
  memoryState = {
    ...memoryState,
    tratamentos: memoryState.tratamentos.map((t) => (t.id === id ? updated : t)),
  }
  persist(memoryState)
  emit()
  return updated
}

export function deleteLead(id: string) {
  ensureInit()
  memoryState = { ...memoryState, leads: memoryState.leads.filter((l) => l.id !== id) }
  persist(memoryState)
  emit()
}

export function deleteConsulta(id: string) {
  ensureInit()
  memoryState = { ...memoryState, consultas: memoryState.consultas.filter((c) => c.id !== id) }
  persist(memoryState)
  emit()
}

export function deleteTratamento(id: string) {
  ensureInit()
  memoryState = { ...memoryState, tratamentos: memoryState.tratamentos.filter((t) => t.id !== id) }
  persist(memoryState)
  emit()
}

/// Limpa TODO o estado local (leads, consultas, tratamentos) — usar quando a fonte de verdade
/// é o backend e o localStorage está mostrando registros antigos que nunca subiram pra API.
export function clearAllLocal() {
  ensureInit()
  memoryState = emptyState
  persist(memoryState)
  emit()
}

export function useCadastroStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useStoreCounts() {
  const state = useCadastroStore()
  return {
    leads: state.leads.length,
    consultas: state.consultas.length,
    tratamentos: state.tratamentos.length,
    recebimentos:
      state.consultas.reduce((sum, c) => sum + c.recebimentos.length, 0) +
      state.tratamentos.reduce((sum, t) => sum + t.recebimentos.length, 0),
  }
}

export function useIsClient(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return ready
}


import { useEffect, useState, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'cadastraai_config_v1'

export interface ConfigState {
  origens: string[]
  tiposResgate: string[]
  responsaveis: string[]
  planosTratamento: string[]
  planosPilates: string[]
  musculacaoOpcoes: string[]
  procedimentos: string[]
  formasPagamento: string[]
}

const defaults: ConfigState = {
  origens: ['Instagram', 'Indicação', 'Site', 'WhatsApp', 'Facebook', 'Outros'],
  tiposResgate: ['Mensagem', 'Ligação', 'Disparo em Massa'],
  responsaveis: ['Rayssa', 'Maria Eduarda', 'Adriele'],
  planosTratamento: [
    'Tratamento Pontual',
    'Clínico Mensal',
    'Clínico Semestral',
    'Essencial Mensal',
    'Essencial Semestral',
    'Essencial Anual',
  ],
  planosPilates: ['Mensal', 'Semestral', 'Anual'],
  musculacaoOpcoes: ['3x Mensal', '3x Semestral', '3x Anual'],
  procedimentos: [
    'Liberação Parcial Individual',
    'Liberação Total Individual',
    'Sessão Fisioterapia',
  ],
  formasPagamento: ['Pix', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro', 'Boleto'],
}

const listeners = new Set<() => void>()
let memoryState: ConfigState = defaults
let initialized = false

function loadFromStorage(): ConfigState {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<ConfigState>
    return {
      origens: parsed.origens ?? defaults.origens,
      tiposResgate: parsed.tiposResgate ?? defaults.tiposResgate,
      responsaveis: parsed.responsaveis ?? defaults.responsaveis,
      planosTratamento: parsed.planosTratamento ?? defaults.planosTratamento,
      planosPilates: parsed.planosPilates ?? defaults.planosPilates,
      musculacaoOpcoes: parsed.musculacaoOpcoes ?? defaults.musculacaoOpcoes,
      procedimentos: parsed.procedimentos ?? defaults.procedimentos,
      formasPagamento: parsed.formasPagamento ?? defaults.formasPagamento,
    }
  } catch {
    return defaults
  }
}

function persist(state: ConfigState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
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

function getSnapshot(): ConfigState {
  ensureInit()
  return memoryState
}

function getServerSnapshot(): ConfigState {
  return defaults
}

export type ConfigListKey = keyof ConfigState

export function addItem(key: ConfigListKey, value: string) {
  ensureInit()
  const trimmed = value.trim()
  if (!trimmed) return
  if (memoryState[key].some((v) => v.toLowerCase() === trimmed.toLowerCase())) return
  memoryState = { ...memoryState, [key]: [...memoryState[key], trimmed] }
  persist(memoryState)
  emit()
}

export function removeItem(key: ConfigListKey, value: string) {
  ensureInit()
  memoryState = { ...memoryState, [key]: memoryState[key].filter((v) => v !== value) }
  persist(memoryState)
  emit()
}

export function updateItem(key: ConfigListKey, oldValue: string, newValue: string) {
  ensureInit()
  const trimmed = newValue.trim()
  if (!trimmed) return
  memoryState = {
    ...memoryState,
    [key]: memoryState[key].map((v) => (v === oldValue ? trimmed : v)),
  }
  persist(memoryState)
  emit()
}

export function resetToDefaults(key?: ConfigListKey) {
  ensureInit()
  if (key) {
    memoryState = { ...memoryState, [key]: defaults[key] }
  } else {
    memoryState = { ...defaults }
  }
  persist(memoryState)
  emit()
}

export function useConfig(): ConfigState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useIsClient(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return ready
}

// Store unificado do dashboard SDR.
//
// Persistência: localStorage (chave `sdr_store_v1`).
// Lazy-init: na primeira leitura, se não houver dado salvo, carrega seed.
// Reatividade: useSyncExternalStore — qualquer mutação dispara re-render
// das views inscritas.
//
// Quando o backend tiver as entidades novas (Tarefa, Agenda, Metas), basta
// trocar este arquivo por um adapter REST sem mudar a UI.

import { useEffect, useState, useSyncExternalStore } from "react";
import type {
  SdrAgendaEvento,
  SdrConsulta,
  SdrLead,
  SdrMeta,
  SdrState,
  SdrTarefa,
  SdrTratamento,
} from "@/types/sdr";
import {
  SEED_AGENDA,
  SEED_CONSULTAS,
  SEED_LEADS,
  SEED_METAS,
  SEED_TAREFAS,
  SEED_TRATAMENTOS,
} from "./seed";

const STORAGE_KEY = "sdr_store_v1";

const emptyState: SdrState = {
  leads: [],
  consultas: [],
  tratamentos: [],
  tarefas: [],
  agenda: [],
  metas: [],
};

function seedState(): SdrState {
  return {
    leads: [...SEED_LEADS],
    consultas: [...SEED_CONSULTAS],
    tratamentos: [...SEED_TRATAMENTOS],
    tarefas: [...SEED_TAREFAS],
    agenda: [...SEED_AGENDA],
    metas: [...SEED_METAS],
  };
}

const listeners = new Set<() => void>();
let memoryState: SdrState = emptyState;
let initialized = false;

function loadFromStorage(): SdrState {
  if (typeof window === "undefined") return seedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as Partial<SdrState>;
    return {
      leads: parsed.leads ?? [],
      consultas: parsed.consultas ?? [],
      tratamentos: parsed.tratamentos ?? [],
      tarefas: parsed.tarefas ?? [],
      agenda: parsed.agenda ?? [],
      metas: parsed.metas ?? [],
    };
  } catch {
    return seedState();
  }
}

function persist(state: SdrState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  memoryState = loadFromStorage();
  initialized = true;
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  ensureInit();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): SdrState {
  ensureInit();
  return memoryState;
}

function getServerSnapshot(): SdrState {
  return emptyState;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function update(mutate: (s: SdrState) => SdrState) {
  ensureInit();
  memoryState = mutate(memoryState);
  persist(memoryState);
  emit();
}

// ---------------------------------------------------------------------------
// Mutations — Leads
// ---------------------------------------------------------------------------

export function upsertSdrLead(lead: SdrLead) {
  update((s) => {
    const idx = s.leads.findIndex((l) => l.id === lead.id);
    const next = idx >= 0 ? s.leads.map((l, i) => (i === idx ? lead : l)) : [lead, ...s.leads];
    return { ...s, leads: next };
  });
}

export function deleteSdrLead(id: string) {
  update((s) => ({ ...s, leads: s.leads.filter((l) => l.id !== id) }));
}

// ---------------------------------------------------------------------------
// Mutations — Consultas
// ---------------------------------------------------------------------------

export function upsertSdrConsulta(consulta: SdrConsulta) {
  update((s) => {
    const idx = s.consultas.findIndex((c) => c.id === consulta.id);
    const next =
      idx >= 0 ? s.consultas.map((c, i) => (i === idx ? consulta : c)) : [consulta, ...s.consultas];
    return { ...s, consultas: next };
  });
}

export function deleteSdrConsulta(id: string) {
  update((s) => ({ ...s, consultas: s.consultas.filter((c) => c.id !== id) }));
}

// ---------------------------------------------------------------------------
// Mutations — Tratamentos
// ---------------------------------------------------------------------------

export function upsertSdrTratamento(t: SdrTratamento) {
  update((s) => {
    const idx = s.tratamentos.findIndex((x) => x.id === t.id);
    const next = idx >= 0 ? s.tratamentos.map((x, i) => (i === idx ? t : x)) : [t, ...s.tratamentos];
    return { ...s, tratamentos: next };
  });
}

export function deleteSdrTratamento(id: string) {
  update((s) => ({ ...s, tratamentos: s.tratamentos.filter((t) => t.id !== id) }));
}

// ---------------------------------------------------------------------------
// Mutations — Tarefas
// ---------------------------------------------------------------------------

export function addSdrTarefa(input: Omit<SdrTarefa, "id" | "createdAt">): SdrTarefa {
  const tarefa: SdrTarefa = { ...input, id: makeId("task"), createdAt: nowIso() };
  update((s) => ({ ...s, tarefas: [tarefa, ...s.tarefas] }));
  return tarefa;
}

export function updateSdrTarefa(id: string, patch: Partial<SdrTarefa>) {
  update((s) => ({
    ...s,
    tarefas: s.tarefas.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }));
}

export function deleteSdrTarefa(id: string) {
  update((s) => ({ ...s, tarefas: s.tarefas.filter((t) => t.id !== id) }));
}

// ---------------------------------------------------------------------------
// Mutations — Agenda
// ---------------------------------------------------------------------------

export function addSdrEvento(input: Omit<SdrAgendaEvento, "id" | "createdAt">): SdrAgendaEvento {
  const ev: SdrAgendaEvento = { ...input, id: makeId("agenda"), createdAt: nowIso() };
  update((s) => ({ ...s, agenda: [ev, ...s.agenda] }));
  return ev;
}

export function updateSdrEvento(id: string, patch: Partial<SdrAgendaEvento>) {
  update((s) => ({
    ...s,
    agenda: s.agenda.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }));
}

export function deleteSdrEvento(id: string) {
  update((s) => ({ ...s, agenda: s.agenda.filter((e) => e.id !== id) }));
}

// ---------------------------------------------------------------------------
// Mutations — Metas
// ---------------------------------------------------------------------------

export function upsertSdrMeta(m: SdrMeta) {
  update((s) => {
    const idx = s.metas.findIndex((x) => x.id === m.id);
    const next = idx >= 0 ? s.metas.map((x, i) => (i === idx ? m : x)) : [m, ...s.metas];
    return { ...s, metas: next };
  });
}

export function deleteSdrMeta(id: string) {
  update((s) => ({ ...s, metas: s.metas.filter((m) => m.id !== id) }));
}

// ---------------------------------------------------------------------------
// Reset / utilitários
// ---------------------------------------------------------------------------

export function resetSdrToSeed() {
  update(() => seedState());
}

export function clearSdrAll() {
  update(() => ({ ...emptyState }));
}

// ---------------------------------------------------------------------------
// Hooks de leitura
// ---------------------------------------------------------------------------

export function useSdrStore(): SdrState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useSdrCounts() {
  const s = useSdrStore();
  const cloudiaCount = s.leads.filter((l) => l.cloudiaFields.length > 0).length;
  return {
    leads: s.leads.length,
    leadsCloudia: cloudiaCount,
    leadsManual: s.leads.length - cloudiaCount,
    consultas: s.consultas.length,
    tratamentos: s.tratamentos.length,
    tarefasPendentes: s.tarefas.filter((t) => t.status === "pendente" || t.status === "em_andamento").length,
    eventosHoje: s.agenda.filter((e) => {
      const hoje = new Date().toISOString().slice(0, 10);
      return e.data.slice(0, 10) === hoje;
    }).length,
  };
}

export function useIsClient(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

export { makeId as makeSdrId, nowIso };

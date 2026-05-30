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
  SdrAuditLog,
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

const STORAGE_KEY = "sdr_store_v2";

const emptyState: SdrState = {
  leads: [],
  consultas: [],
  tratamentos: [],
  tarefas: [],
  agenda: [],
  metas: [],
  auditLogs: [],
};

function seedState(): SdrState {
  return {
    leads: SEED_LEADS.map(normalizeLead),
    consultas: [...SEED_CONSULTAS],
    tratamentos: [...SEED_TRATAMENTOS],
    tarefas: [...SEED_TAREFAS],
    agenda: [...SEED_AGENDA],
    metas: [...SEED_METAS],
    auditLogs: [],
  };
}

const listeners = new Set<() => void>();
let memoryState: SdrState = emptyState;
let initialized = false;

/** Preenche source/status default para leads vindos do seed ou de versões anteriores. */
function normalizeLead(lead: Partial<SdrLead> & Omit<SdrLead, "source" | "status">): SdrLead {
  const source: SdrLead["source"] = lead.source ?? (lead.externalId ? "cloudia" : "manual");
  const status: SdrLead["status"] =
    lead.status ?? (source === "crm" ? "pendente_revisao" : "aprovado");
  return { ...lead, source, status };
}

function loadFromStorage(): SdrState {
  if (typeof window === "undefined") return seedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as Partial<SdrState>;
    return {
      leads: (parsed.leads ?? []).map(normalizeLead),
      consultas: parsed.consultas ?? [],
      tratamentos: parsed.tratamentos ?? [],
      tarefas: parsed.tarefas ?? [],
      agenda: parsed.agenda ?? [],
      metas: parsed.metas ?? [],
      auditLogs: parsed.auditLogs ?? [],
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

export function upsertSdrLead(lead: SdrLead, actor?: { id?: string; name?: string; email?: string }) {
  update((s) => {
    const existing = s.leads.find((l) => l.id === lead.id);
    const idx = s.leads.findIndex((l) => l.id === lead.id);
    const next = idx >= 0 ? s.leads.map((l, i) => (i === idx ? lead : l)) : [lead, ...s.leads];
    const auditEntry: SdrAuditLog = {
      id: makeId("audit"),
      userId: actor?.id,
      userName: actor?.name,
      userEmail: actor?.email,
      action: existing ? "sdr_lead.updated" : `sdr_lead.created_${lead.source}`,
      entityType: "SdrLead",
      entityId: lead.id,
      summary: existing ? `Editou lead ${lead.nome}` : `Criou lead ${lead.nome} (${lead.source})`,
      beforeJson: existing ? JSON.stringify(existing) : undefined,
      afterJson: JSON.stringify(lead),
      createdAt: nowIso(),
    };
    return { ...s, leads: next, auditLogs: [auditEntry, ...s.auditLogs] };
  });
}

export function deleteSdrLead(id: string, actor?: { id?: string; name?: string; email?: string }) {
  update((s) => {
    const existing = s.leads.find((l) => l.id === id);
    if (!existing) return s;
    const auditEntry: SdrAuditLog = {
      id: makeId("audit"),
      userId: actor?.id,
      userName: actor?.name,
      userEmail: actor?.email,
      action: "sdr_lead.deleted",
      entityType: "SdrLead",
      entityId: id,
      summary: `Removeu lead ${existing.nome}`,
      beforeJson: JSON.stringify(existing),
      createdAt: nowIso(),
    };
    return {
      ...s,
      leads: s.leads.filter((l) => l.id !== id),
      auditLogs: [auditEntry, ...s.auditLogs],
    };
  });
}

/**
 * Aprova ou rejeita uma revisão de lead. É O ponto crítico do fluxo CRM:
 * depois daqui o lead aparece em /sdr/leads-aprovados.
 *
 * Sempre grava entrada no audit log com snapshot before/after para a chefe consultar.
 */
export function reviewSdrLead(
  id: string,
  decision: "approve" | "reject",
  opts: {
    actor?: { id?: string; name?: string; email?: string };
    rejectionReason?: string;
    /** Patch opcional de campos que a SDR editou durante a revisão. */
    patch?: Partial<SdrLead>;
  } = {},
): SdrLead | null {
  ensureInit();
  const existing = memoryState.leads.find((l) => l.id === id);
  if (!existing) return null;

  const now = nowIso();
  const updated: SdrLead = {
    ...existing,
    ...(opts.patch ?? {}),
    status: decision === "approve" ? "aprovado" : "rejeitado",
    reviewedAt: now,
    reviewedByUserId: opts.actor?.id,
    reviewedByName: opts.actor?.name,
    rejectionReason: decision === "reject" ? opts.rejectionReason : undefined,
    dataModificacao: now,
  };

  const auditEntry: SdrAuditLog = {
    id: makeId("audit"),
    userId: opts.actor?.id,
    userName: opts.actor?.name,
    userEmail: opts.actor?.email,
    action: decision === "approve" ? "sdr_lead.review_approved" : "sdr_lead.review_rejected",
    entityType: "SdrLead",
    entityId: id,
    summary:
      decision === "approve"
        ? `Aprovou revisão de ${existing.nome}`
        : `Rejeitou revisão de ${existing.nome}: ${opts.rejectionReason ?? "sem motivo"}`,
    beforeJson: JSON.stringify(existing),
    afterJson: JSON.stringify(updated),
    createdAt: now,
  };

  memoryState = {
    ...memoryState,
    leads: memoryState.leads.map((l) => (l.id === id ? updated : l)),
    auditLogs: [auditEntry, ...memoryState.auditLogs],
  };
  persist(memoryState);
  emit();
  return updated;
}

export function appendAuditLog(entry: Omit<SdrAuditLog, "id" | "createdAt">) {
  update((s) => ({
    ...s,
    auditLogs: [{ ...entry, id: makeId("audit"), createdAt: nowIso() }, ...s.auditLogs],
  }));
}

/**
 * Mescla leads vindos do backend (sync com Cloudia) no store local.
 * Dedup por `externalId` quando presente; senão por `id`. Quem já existe não é sobrescrito
 * pra preservar edições da SDR no localStorage.
 *
 * Retorna a quantidade de leads efetivamente adicionados (excluindo duplicatas).
 */
export function mergeSdrLeadsFromBackend(incoming: SdrLead[]): number {
  if (incoming.length === 0) return 0;
  ensureInit();

  const existingExternalIds = new Set(
    memoryState.leads.filter((l) => l.externalId != null).map((l) => l.externalId!),
  );
  const existingIds = new Set(memoryState.leads.map((l) => l.id));

  const toAdd: SdrLead[] = [];
  for (const lead of incoming) {
    if (lead.externalId != null && existingExternalIds.has(lead.externalId)) continue;
    if (existingIds.has(lead.id)) continue;
    toAdd.push(normalizeLead(lead));
  }

  if (toAdd.length === 0) return 0;

  const auditEntry: SdrAuditLog = {
    id: makeId("audit"),
    action: "sdr_lead.synced_batch",
    entityType: "SdrLead",
    entityId: "batch",
    summary: `Sincronizou ${toAdd.length} lead(s) do Kommo via backfill`,
    afterJson: JSON.stringify({ count: toAdd.length }),
    createdAt: nowIso(),
  };

  memoryState = {
    ...memoryState,
    leads: [...toAdd, ...memoryState.leads],
    auditLogs: [auditEntry, ...memoryState.auditLogs],
  };
  persist(memoryState);
  emit();
  return toAdd.length;
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
  const cloudiaCount = s.leads.filter((l) => l.sourceFields.length > 0).length;
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

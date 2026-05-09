// Maps an arbitrary Kommo lead+contact payload to our CreateLeadPayload,
// detecting which fields could be auto-filled and which require human review.
//
// Strategy: tokenize candidate field names (Kommo's custom_fields_values + contact custom fields),
// score similarity against our schema using a small Levenshtein + alias dictionary, then pick the
// best match per target field. Anything below the confidence threshold is reported as missing.
//
// Pure: no I/O, safe to run in client and server.
import type { CreateLeadPayload } from '@/lib/cadastra/api'
import { MOTIVOS_NAO_AGENDAMENTO } from '@/types/cadastra'

// Subset of Kommo's lead/contact shape that we actually inspect — declared here to keep
// kommo-mapping.ts free of server-only dependencies. Fields são todos opcionais porque
// a Kommo retorna o que o usuário configurou.
export interface KommoCustomFieldValue {
  field_id?: number
  field_name?: string
  field_code?: string
  field_type?: string
  values?: { value?: unknown; enum_id?: number; enum_code?: string }[]
}

export interface KommoLead {
  id: number
  name?: string
  price?: number
  responsible_user_id?: number
  status_id?: number
  pipeline_id?: number
  created_at?: number
  updated_at?: number
  custom_fields_values?: KommoCustomFieldValue[]
  _embedded?: {
    contacts?: { id: number; name?: string; first_name?: string; last_name?: string }[]
    tags?: { id: number; name: string }[]
  }
}

export interface KommoContact {
  id: number
  name?: string
  first_name?: string
  last_name?: string
  responsible_user_id?: number
  custom_fields_values?: KommoCustomFieldValue[]
  _embedded?: {
    leads?: { id: number }[]
  }
}

// Each "target" is a field in our system that we want to fill.
export type TargetField =
  | 'nome'
  | 'telefone'
  | 'origem'
  | 'tipo'
  | 'tipoResgate'
  | 'interacao'
  | 'agendouConsulta'
  | 'pagamentoAntecipado'
  | 'dataAgendamento'
  | 'motivoNaoAgendamento'
  | 'nomeResponsavel'

interface TargetSpec {
  field: TargetField
  label: string
  required: boolean
  hint: string
  // Aliases used to match Kommo field names — accent-stripped, lowercased.
  aliases: string[]
}

const TARGETS: TargetSpec[] = [
  { field: 'nome',                 label: 'Nome',                  required: true,  hint: 'Nome completo do lead.', aliases: ['nome', 'name', 'fullname', 'cliente', 'paciente', 'lead'] },
  { field: 'telefone',             label: 'Telefone',              required: true,  hint: 'Número com DDD.',         aliases: ['telefone', 'phone', 'celular', 'whatsapp', 'mobile', 'contato', 'fone'] },
  { field: 'origem',               label: 'Origem',                required: true,  hint: 'De onde o lead veio.',     aliases: ['origem', 'fonte', 'source', 'utm_source', 'canal', 'campanha', 'utmsource'] },
  { field: 'tipo',                 label: 'Tipo',                  required: true,  hint: 'Cadastro ou Resgate.',     aliases: ['tipo', 'type', 'categoria', 'classificacao'] },
  { field: 'tipoResgate',          label: 'Tipo de resgate',       required: false, hint: 'Quando tipo=Resgate.',     aliases: ['tiporesgate', 'resgate', 'recovery', 'tipoderesgate'] },
  { field: 'interacao',            label: 'Houve interação',       required: true,  hint: 'Conversou com o cliente?', aliases: ['interacao', 'interagiu', 'respondeu', 'engaged'] },
  { field: 'agendouConsulta',      label: 'Agendou consulta',      required: true,  hint: 'Marcou avaliação?',        aliases: ['agendou', 'agendado', 'scheduled', 'agendouconsulta', 'appointment'] },
  { field: 'pagamentoAntecipado',  label: 'Pagamento antecipado',  required: true,  hint: 'Pagou antes da consulta?', aliases: ['pagamentoantecipado', 'antecipado', 'preorder', 'paid', 'pagouantes'] },
  { field: 'dataAgendamento',      label: 'Data do agendamento',   required: false, hint: 'Quando foi marcada.',     aliases: ['dataagendamento', 'data', 'agenda', 'datadaconsulta', 'appointmentdate'] },
  { field: 'motivoNaoAgendamento', label: 'Motivo de não agendar', required: false, hint: 'Quando agendouConsulta=false.', aliases: ['motivo', 'motivonaoagendamento', 'reason', 'observacao', 'naoagendou'] },
  { field: 'nomeResponsavel',      label: 'Responsável',           required: true,  hint: 'Atendente do lead.',       aliases: ['responsavel', 'owner', 'atendente', 'vendedor', 'consultor', 'sdr'] },
]

const TARGET_BY_FIELD = new Map(TARGETS.map((t) => [t.field, t]))

export function listTargets(): TargetSpec[] {
  return TARGETS
}

export interface FieldMatch {
  target: TargetField
  source: 'lead.name' | 'lead.price' | 'lead.tags' | 'contact.name' | 'contact.phone' | 'contact.email' | 'lead.custom' | 'contact.custom' | 'fallback'
  rawKey?: string
  rawValue: unknown
  // Confidence: 0..1. Above 0.6 we consider it a confident auto-mapping.
  confidence: number
  // Final coerced value matching the schema type.
  coerced: unknown
}

export interface AnalyzeResult {
  matches: Map<TargetField, FieldMatch>
  // Targets without a match.
  missing: TargetSpec[]
  // Required missing — separated for badge/CTA emphasis.
  missingRequired: TargetSpec[]
  // Score 0..100 of how complete the auto-fill is.
  completeness: number
  // Suggested CreateLeadPayload (with empty strings/nulls for missing required).
  suggestedPayload: Partial<CreateLeadPayload>
  // Human-readable display name for the lead — best-effort.
  displayName: string
}

// ----- helpers -----

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normalizeKey(s: string): string {
  return stripDiacritics(String(s ?? '').toLowerCase()).replace(/[^a-z0-9]/g, '')
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[a.length][b.length]
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const longest = Math.max(a.length, b.length)
  if (longest === 0) return 1
  return 1 - levenshtein(a, b) / longest
}

function bestAliasScore(aliases: string[], candidate: string): number {
  let best = 0
  for (const alias of aliases) {
    const a = normalizeKey(alias)
    const c = normalizeKey(candidate)
    if (!a || !c) continue
    if (a === c) return 1
    if (c.includes(a) || a.includes(c)) {
      const ratio = Math.min(a.length, c.length) / Math.max(a.length, c.length)
      best = Math.max(best, 0.85 * ratio + 0.15)
    } else {
      best = Math.max(best, similarity(a, c))
    }
  }
  return best
}

const PHONE_RE = /[\d().\-+ ]{8,}/

function looksLikePhone(s: string): boolean {
  const digits = s.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 14 && PHONE_RE.test(s)
}

function firstCustomFieldValue(cfv: KommoCustomFieldValue): unknown {
  const v = cfv.values?.[0]
  if (!v) return undefined
  if ('value' in v) return v.value
  return v.enum_code ?? v.enum_id
}

function flattenCustomFields(items?: KommoCustomFieldValue[]): { key: string; value: unknown; raw: KommoCustomFieldValue }[] {
  if (!items) return []
  const out: { key: string; value: unknown; raw: KommoCustomFieldValue }[] = []
  for (const cfv of items) {
    const key = cfv.field_code || cfv.field_name || (cfv.field_id != null ? `field_${cfv.field_id}` : '')
    if (!key) continue
    out.push({ key, value: firstCustomFieldValue(cfv), raw: cfv })
  }
  return out
}

function coerceBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const s = stripDiacritics(v.trim().toLowerCase())
    if (['1', 'yes', 'sim', 'true', 'verdadeiro', 'on', 'y', 's'].includes(s)) return true
    if (['0', 'no', 'nao', 'false', 'falso', 'off', 'n'].includes(s)) return false
  }
  return null
}

function coerceDate(v: unknown): string | null {
  if (typeof v === 'number') {
    // Kommo date custom fields are unix seconds.
    const d = new Date((v > 1e12 ? v : v * 1000))
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof v === 'string') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
}

// ----- main entry -----

export function analyzeKommoLead(input: { lead: KommoLead; contact?: KommoContact | null }): AnalyzeResult {
  const { lead, contact } = input
  const matches = new Map<TargetField, FieldMatch>()

  // Build candidate pool.
  type Candidate = {
    source: FieldMatch['source']
    key: string
    value: unknown
  }
  const candidates: Candidate[] = []

  if (lead.name) candidates.push({ source: 'lead.name', key: 'lead_name', value: lead.name })
  if (lead.price != null) candidates.push({ source: 'lead.price', key: 'lead_price', value: lead.price })
  if (lead._embedded?.tags?.length) {
    candidates.push({
      source: 'lead.tags',
      key: 'lead_tags',
      value: lead._embedded.tags.map((t) => t.name).join(', '),
    })
  }
  for (const cf of flattenCustomFields(lead.custom_fields_values)) {
    candidates.push({ source: 'lead.custom', key: cf.key, value: cf.value })
  }
  if (contact) {
    if (contact.name || contact.first_name || contact.last_name) {
      candidates.push({
        source: 'contact.name',
        key: 'contact_name',
        value: contact.name || [contact.first_name, contact.last_name].filter(Boolean).join(' '),
      })
    }
    for (const cf of flattenCustomFields(contact.custom_fields_values)) {
      const lower = normalizeKey(cf.key)
      if (lower.includes('phone') || lower.includes('tel') || lower.includes('whats')) {
        candidates.push({ source: 'contact.phone', key: cf.key, value: cf.value })
      } else if (lower.includes('email') || lower.includes('mail')) {
        candidates.push({ source: 'contact.email', key: cf.key, value: cf.value })
      } else {
        candidates.push({ source: 'contact.custom', key: cf.key, value: cf.value })
      }
    }
  }

  // Score every (candidate, target) and pick the best.
  for (const target of TARGETS) {
    let best: { c: Candidate; score: number } | null = null
    for (const c of candidates) {
      const score = bestAliasScore(target.aliases, c.key)
      if (!best || score > best.score) best = { c, score }
    }

    // Type-specific overrides for "obvious" cases that the alias matcher might miss.
    if (target.field === 'nome') {
      const nameCand = candidates.find((c) => c.source === 'contact.name')
        ?? candidates.find((c) => c.source === 'lead.name')
      if (nameCand) best = { c: nameCand, score: Math.max(best?.score ?? 0, 0.9) }
    }
    if (target.field === 'telefone') {
      const phoneByName = candidates.find((c) => c.source === 'contact.phone')
      const phoneBySniff = candidates.find((c) => typeof c.value === 'string' && looksLikePhone(c.value))
      const cand = phoneByName ?? phoneBySniff
      if (cand) best = { c: cand, score: Math.max(best?.score ?? 0, phoneByName ? 0.95 : 0.7) }
    }
    if (target.field === 'origem' && (best == null || best.score < 0.6)) {
      const tagCand = candidates.find((c) => c.source === 'lead.tags')
      if (tagCand) best = { c: tagCand, score: 0.55 }
    }

    if (!best || best.score < 0.45 || best.c.value == null || best.c.value === '') continue

    let coerced: unknown = best.c.value
    if (target.field === 'interacao' || target.field === 'agendouConsulta' || target.field === 'pagamentoAntecipado') {
      const b = coerceBool(best.c.value)
      if (b == null) continue
      coerced = b
    } else if (target.field === 'dataAgendamento') {
      const d = coerceDate(best.c.value)
      if (!d) continue
      coerced = d
    } else if (target.field === 'tipo') {
      const s = stripDiacritics(String(best.c.value).toLowerCase())
      coerced = s.includes('resgate') ? 'Resgate' : 'Cadastro'
    } else if (target.field === 'motivoNaoAgendamento') {
      // Snap to closest known motive when possible.
      const candidate = String(best.c.value)
      let pickBest: { m: string; s: number } | null = null
      for (const m of MOTIVOS_NAO_AGENDAMENTO) {
        const s = similarity(normalizeKey(m), normalizeKey(candidate))
        if (!pickBest || s > pickBest.s) pickBest = { m, s }
      }
      coerced = pickBest && pickBest.s > 0.55 ? pickBest.m : candidate
    } else {
      coerced = String(best.c.value)
    }

    matches.set(target.field, {
      target: target.field,
      source: best.c.source,
      rawKey: best.c.key,
      rawValue: best.c.value,
      confidence: Math.min(1, best.score),
      coerced,
    })
  }

  const missing = TARGETS.filter((t) => !matches.has(t.field))
  const missingRequired = missing.filter((t) => t.required)

  // Completeness: weight required fields 2x.
  const totalWeight = TARGETS.reduce((sum, t) => sum + (t.required ? 2 : 1), 0)
  const matchedWeight = TARGETS.reduce(
    (sum, t) => sum + (matches.has(t.field) ? (t.required ? 2 : 1) : 0),
    0,
  )
  const completeness = Math.round((matchedWeight / totalWeight) * 100)

  const suggestedPayload: Partial<CreateLeadPayload> = {}
  for (const [field, match] of matches.entries()) {
    ;(suggestedPayload as Record<string, unknown>)[field] = match.coerced
  }

  // Defaults that help the import not fail when optional fields are missing.
  if (suggestedPayload.tipo == null) suggestedPayload.tipo = 'Cadastro'
  if (suggestedPayload.interacao == null) suggestedPayload.interacao = false
  if (suggestedPayload.agendouConsulta == null) suggestedPayload.agendouConsulta = false
  if (suggestedPayload.pagamentoAntecipado == null) suggestedPayload.pagamentoAntecipado = false

  const displayName =
    (matches.get('nome')?.coerced as string | undefined) ??
    contact?.name ??
    lead.name ??
    `Lead Kommo #${lead.id}`

  return {
    matches,
    missing,
    missingRequired,
    completeness,
    suggestedPayload,
    displayName,
  }
}

export function getTargetSpec(field: TargetField): TargetSpec | undefined {
  return TARGET_BY_FIELD.get(field)
}

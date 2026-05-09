
import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, Trash2, Search, UserPlus, Users, RefreshCw, AlertTriangle, UploadCloud } from 'lucide-react'
import { clearAllLocal, deleteLead, useCadastroStore } from '@/lib/cadastra/cadastro-store'
import { leadsApi, type CreateLeadPayload, type LeadSummaryDto } from '@/lib/cadastra/api'
import { useEmpresa } from '@/contexts/cadastra/empresa-context'
import { cn } from '@/lib/utils'
import type { Lead } from '@/types/cadastra'

const PAGE_SIZE = 100
const DEBOUNCE_MS = 300

interface LeadsListViewProps {
  onBack: () => void
  onEdit: (lead: Lead) => void
  onCreateNew: () => void
  onOpen: (lead: Lead) => void
}

function formatPhone(p: string): string {
  return p
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return dateFormatter.format(d)
}

function summaryToLead(s: LeadSummaryDto): Lead {
  return {
    id: s.id,
    empresaId: s.empresaId,
    nome: s.nome,
    telefone: s.telefone,
    origem: s.origem,
    tipo: (s.tipo as Lead['tipo']) ?? 'Cadastro',
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

export function LeadsListView({ onBack, onEdit, onCreateNew, onOpen }: LeadsListViewProps) {
  const localStore = useCadastroStore()
  // Empresa ativa vem do contexto global (switcher na sidebar troca pra todos os lugares).
  const { empresas, currentEmpresa, setCurrentEmpresaId } = useEmpresa()
  const empresaId = currentEmpresa?.id ?? ''
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'agendados' | 'nao_agendados'>('todos')
  const [page, setPage] = useState(0)
  const [pageData, setPageData] = useState<LeadSummaryDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refetchTick, setRefetchTick] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  // Debounce do search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  // Reset de página quando muda filtros
  useEffect(() => {
    setPage(0)
  }, [debouncedQuery, statusFilter, empresaId])

  // (empresas vêm do contexto — sem fetch local)

  // Busca a página atual (cancelando requests obsoletas)
  const reqIdRef = useRef(0)
  useEffect(() => {
    if (!empresaId) return
    const myReqId = ++reqIdRef.current
    setLoading(true)
    setError(null)
    leadsApi
      .list(empresaId, {
        page,
        pageSize: PAGE_SIZE,
        search: debouncedQuery || undefined,
        status: statusFilter,
        fonte: 'manual',
      })
      .then((resp) => {
        if (myReqId !== reqIdRef.current) return
        setPageData(resp.items)
        setTotal(resp.total)
      })
      .catch((err) => {
        if (myReqId !== reqIdRef.current) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar leads')
        setPageData([])
        setTotal(0)
      })
      .finally(() => {
        if (myReqId === reqIdRef.current) setLoading(false)
      })
  }, [empresaId, page, debouncedQuery, statusFilter, refetchTick])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, Math.max(0, totalPages - 1))
  const pageStart = safePage * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, total)

  // Combinar com leads do localStorage (apenas na primeira página, sem filtros)
  // pra que cadastros manuais antigos ainda apareçam.
  const showLocal = page === 0 && !debouncedQuery && statusFilter === 'todos'
  const localLeads: Lead[] = showLocal ? localStore.leads : []
  const apiLeads: Lead[] = pageData.map(summaryToLead)
  const pageRows: Lead[] = showLocal ? [...localLeads, ...apiLeads] : apiLeads

  const handleDelete = (lead: Lead) => {
    if (!confirm(`Apagar o lead "${lead.nome}"? Esta ação não pode ser desfeita.`)) return
    deleteLead(lead.id)
  }

  const handleSyncLocal = async () => {
    if (!empresaId || syncing || localStore.leads.length === 0) return
    const empresaNome = empresas.find((e) => e.id === empresaId)?.nome ?? 'a empresa selecionada'
    if (!confirm(
      `Subir ${localStore.leads.length} lead(s) local(is) para "${empresaNome}"?\n\nObs.: consultas e tratamentos vinculados em localStorage NÃO serão sincronizados (são reentradas manuais).`,
    )) return

    const payload: CreateLeadPayload[] = localStore.leads.map((l) => ({
      nome: l.nome,
      telefone: l.telefone,
      origem: l.origem,
      tipo: l.tipo,
      tipoResgate: l.tipoResgate,
      interacao: l.interacao,
      agendouConsulta: l.agendouConsulta,
      pagamentoAntecipado: l.pagamentoAntecipado,
      dataAgendamento: l.dataAgendamento,
      motivoNaoAgendamento: l.motivoNaoAgendamento,
      nomeResponsavel: l.nomeResponsavel,
      createdAt: l.createdAt,
    }))

    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await leadsApi.bulkCreate(empresaId, payload)
      const ok = res.createdCount === payload.length
      setSyncResult({
        kind: ok ? 'success' : 'error',
        msg: ok
          ? `${res.createdCount} lead(s) sincronizado(s). Limpando o localStorage…`
          : `${res.createdCount} de ${res.totalReceived} sincronizados. ${res.failedCount} falharam — verifique no console.`,
      })
      if (res.failed.length > 0) console.warn('Falhas no sync:', res.failed)
      if (ok) {
        clearAllLocal()
        setRefetchTick((t) => t + 1)
      }
    } catch (err) {
      setSyncResult({
        kind: 'error',
        msg: err instanceof Error ? err.message : 'Falha ao sincronizar.',
      })
    } finally {
      setSyncing(false)
    }
  }

  const totalDisplay = total + (showLocal ? localLeads.length : 0)

  return (
    <motion.div
      className="px-8 py-8 max-w-6xl mx-auto"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-[#15171b] border border-white/[0.05] text-[13px] text-white/70 hover:text-white hover:border-white/[0.12] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Voltar para Dashboard
        </button>
      </div>

      <div
        className="rounded-3xl p-7 mb-5 text-cyan-50"
        style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 60%, #075985 100%)' }}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/15 grid place-items-center">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[12px] uppercase tracking-[0.2em] text-cyan-100/85 mb-1">Cadastros manuais</p>
            <h1 className="text-[28px] font-bold tracking-tight leading-none">
              Leads ({loading && total === 0 ? '…' : totalDisplay})
            </h1>
            <p className="text-[13px] text-cyan-100/85 mt-2">
              {error
                ? `Falha ao consultar o servidor — ${error}`
                : 'Leads cadastrados manualmente. Para ver os importados, acesse "Importados" no menu.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefetchTick((t) => t + 1)}
              disabled={loading || !empresaId}
              title="Atualizar a lista com os dados mais recentes do servidor"
              className="inline-flex items-center gap-2 h-11 px-4 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-semibold text-[13px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              {loading ? 'Sincronizando…' : 'Sincronizar'}
            </button>
            <button
              onClick={onCreateNew}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-2xl bg-white text-cyan-700 font-semibold text-[13px] hover:bg-cyan-50 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Novo Lead
            </button>
          </div>
        </div>
      </div>

      {/* Aviso de leads locais (localStorage) que não estão sincronizados com a API */}
      {localStore.leads.length > 0 && (
        <div className="rounded-2xl bg-amber-500/[0.08] border border-amber-400/30 text-amber-200 text-[13px] px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1 min-w-0">
            <strong>{localStore.leads.length}</strong> lead{localStore.leads.length === 1 ? '' : 's'} local{localStore.leads.length === 1 ? '' : 'is'} no navegador (não estão no servidor).
            {' '}Outros usuários não conseguem ver. Sincronize agora pra subir tudo.
          </span>
          {syncResult && (
            <span className={cn(
              'w-full text-[12px] mt-1',
              syncResult.kind === 'success' ? 'text-emerald-200' : 'text-rose-200',
            )}>
              {syncResult.msg}
            </span>
          )}
          <button
            onClick={handleSyncLocal}
            disabled={syncing || !empresaId}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-[12px] font-semibold hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            {syncing ? 'Sincronizando…' : 'Sincronizar com servidor'}
          </button>
          <button
            onClick={() => {
              if (!confirm(`Apagar os ${localStore.leads.length} leads locais (e consultas/tratamentos não sincronizados) deste navegador? Os dados no servidor não são afetados.`)) return
              clearAllLocal()
              setRefetchTick((t) => t + 1)
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-100 text-[12px] font-semibold hover:bg-amber-500/30 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar local
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-4 flex flex-wrap items-center gap-3 mb-4">
        {empresas.length > 1 && (
          <select
            value={empresaId}
            onChange={(e) => setCurrentEmpresaId(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className="h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-sm focus:outline-none focus:border-cyan-400/55"
            title="Troca a empresa ativa do app"
          >
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        )}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, telefone, origem, responsável…"
            className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-sm placeholder:text-white/35 focus:outline-none focus:border-cyan-400/55"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/45">…</span>
          )}
        </div>
        <div className="inline-flex items-center rounded-xl border border-white/[0.05] bg-[#0c0d10] p-0.5">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'agendados', label: 'Agendados' },
            { id: 'nao_agendados', label: 'Não agendados' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as typeof statusFilter)}
              className={cn(
                'h-8 px-3 rounded-lg text-[12px] font-medium transition-colors',
                statusFilter === f.id ? 'bg-cyan-400 text-slate-900 font-semibold' : 'text-white/55 hover:text-white',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] overflow-hidden">
        {pageRows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base text-white/85 font-medium mb-1">
              {loading ? 'Carregando leads…' : 'Nenhum lead encontrado'}
            </p>
            <p className="text-sm text-white/55">
              {loading
                ? 'Aguarde um instante.'
                : totalDisplay === 0
                  ? 'Cadastre seu primeiro lead clicando em "Novo Lead" acima.'
                  : 'Ajuste a busca ou os filtros para encontrar o que você procura.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.05]">
                <tr className="text-[10px] uppercase tracking-wider text-white/45">
                  <th className="text-left px-5 py-3 font-medium">Nome</th>
                  <th className="text-left px-5 py-3 font-medium">Telefone</th>
                  <th className="text-left px-5 py-3 font-medium">Origem</th>
                  <th className="text-left px-5 py-3 font-medium">Tipo</th>
                  <th className="text-left px-5 py-3 font-medium">Responsável</th>
                  <th className="text-left px-5 py-3 font-medium">Cadastrado</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((l) => (
                  <LeadRow
                    key={l.id}
                    lead={l}
                    onOpen={onOpen}
                    onEdit={onEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 px-1">
          <p className="text-[12px] text-white/55 tabular-nums">
            Mostrando {pageStart + 1}–{pageEnd} de {total}
            {showLocal && localLeads.length > 0 && ` + ${localLeads.length} local`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-xl bg-[#15171b] border border-white/[0.05] text-[12px] text-white/70 hover:text-white hover:border-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </button>
            <span className="text-[12px] text-white/55 tabular-nums px-2">
              {safePage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-xl bg-[#15171b] border border-white/[0.05] text-[12px] text-white/70 hover:text-white hover:border-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próxima
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

interface LeadRowProps {
  lead: Lead
  onOpen: (lead: Lead) => void
  onEdit: (lead: Lead) => void
  onDelete: (lead: Lead) => void
}

const LeadRow = memo(function LeadRow({ lead: l, onOpen, onEdit, onDelete }: LeadRowProps) {
  return (
    <tr
      onClick={() => onOpen(l)}
      className="border-b border-white/[0.04] last:border-b-0 hover:bg-cyan-500/[0.05] transition-colors cursor-pointer group"
    >
      <td className="px-5 py-3 text-white font-medium">
        <span className="group-hover:text-cyan-200 transition-colors">{l.nome}</span>
      </td>
      <td className="px-5 py-3 text-white/75 tabular-nums">{formatPhone(l.telefone)}</td>
      <td className="px-5 py-3 text-white/75">{l.origem}</td>
      <td className="px-5 py-3">
        <span
          className={cn(
            'inline-flex px-2 h-5 items-center rounded-md text-[11px] font-semibold',
            l.tipo === 'Cadastro'
              ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-400/20'
              : 'bg-amber-500/10 text-amber-300 border border-amber-400/20',
          )}
        >
          {l.tipo}
        </span>
      </td>
      <td className="px-5 py-3 text-white/75">{l.nomeResponsavel}</td>
      <td className="px-5 py-3 text-white/55">{formatDate(l.createdAt)}</td>
      <td className="px-5 py-3">
        {l.agendouConsulta ? (
          <span className="inline-flex px-2 h-5 items-center rounded-md text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-400/20">
            Agendou
          </span>
        ) : (
          <span className="inline-flex px-2 h-5 items-center rounded-md text-[11px] text-white/55 bg-white/[0.04] border border-white/[0.05]">
            Não agendou
          </span>
        )}
      </td>
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => onEdit(l)}
            className="h-8 w-8 grid place-items-center rounded-lg text-white/55 hover:text-cyan-300 hover:bg-cyan-500/[0.08] transition-colors"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(l)}
            className="h-8 w-8 grid place-items-center rounded-lg text-white/55 hover:text-rose-300 hover:bg-rose-500/[0.08] transition-colors"
            title="Apagar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
})

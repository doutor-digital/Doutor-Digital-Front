
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, AlertCircle, Filter, RotateCcw, Search, Trash2, AlertTriangle, Loader2 } from "@/components/icons"
import { empresasApi, leadsApi, type EmpresaDto, type LeadSummaryDto, type FonteFiltro } from '@/lib/cadastra/api'
import { cn } from '@/lib/utils'

type DangerScope = 'all' | 'manual' | 'importado'

interface Props {
  onBack: () => void
}

type Tri = '' | 'sim' | 'nao'

interface Filters {
  search: string
  empresaId: string
  origem: string
  tipo: string
  tipoResgate: string
  responsavel: string
  motivoNaoAgendamento: string
  motivoNaoFechamento: string
  interacao: Tri
  agendou: Tri
  pagamentoAntecipado: Tri
  temConsulta: Tri
  compareceu: Tri
  fechouTratamento: Tri
  createdFrom: string
  createdTo: string
  agendamentoFrom: string
  agendamentoTo: string
  ano: string
  mes: string
  diaSemana: string
  ddd: string
  letraInicial: string
  periodoAgendamento: '' | 'manha' | 'tarde' | 'noite'
}

const initialFilters: Filters = {
  search: '',
  empresaId: '',
  origem: '',
  tipo: '',
  tipoResgate: '',
  responsavel: '',
  motivoNaoAgendamento: '',
  motivoNaoFechamento: '',
  interacao: '',
  agendou: '',
  pagamentoAntecipado: '',
  temConsulta: '',
  compareceu: '',
  fechouTratamento: '',
  createdFrom: '',
  createdTo: '',
  agendamentoFrom: '',
  agendamentoTo: '',
  ano: '',
  mes: '',
  diaSemana: '',
  ddd: '',
  letraInicial: '',
  periodoAgendamento: '',
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function uniq(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>()
  for (const v of values) {
    const s = (v ?? '').trim()
    if (s) set.add(s)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function ddd(tel: string): string {
  const d = tel.replace(/\D/g, '')
  return d.length >= 10 ? d.slice(0, 2) : ''
}

function tri(value: boolean | null | undefined, want: Tri): boolean {
  if (want === '') return true
  if (value === null || value === undefined) return want === 'nao' ? true : false
  return want === 'sim' ? value : !value
}

function parseDateOnly(s: string): Date | null {
  if (!s) return null
  // "yyyy-MM-dd" no fuso LOCAL (new Date(s) interpretaria como UTC e geraria shift de ±1 dia)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export function ImportadosView({ onBack }: Props) {
  const PAGE_SIZE = 100
  const [empresas, setEmpresas] = useState<EmpresaDto[]>([])
  const [leads, setLeads] = useState<LeadSummaryDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [dangerScope, setDangerScope] = useState<DangerScope | null>(null)
  const [dangerConfirm, setDangerConfirm] = useState('')
  const [dangerBusy, setDangerBusy] = useState(false)
  const [dangerMsg, setDangerMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [refetchTick, setRefetchTick] = useState(0)

  useEffect(() => {
    empresasApi
      .list()
      .then((list) => {
        setEmpresas(list)
        if (list.length > 0 && !filters.empresaId) {
          setFilters((f) => ({ ...f, empresaId: list[0].id }))
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar empresas'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounce do termo de busca (300ms) para não disparar request a cada tecla.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search.trim()), 300)
    return () => clearTimeout(id)
  }, [filters.search])

  // Reset de página quando filtros server-side mudam.
  useEffect(() => {
    setPage(0)
  }, [filters.empresaId, debouncedSearch, filters.agendou])

  // Carrega APENAS a página atual via API. Sem loop. Sem 10k em memória.
  useEffect(() => {
    if (!filters.empresaId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    leadsApi
      .list(filters.empresaId, {
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status:
          filters.agendou === 'sim' ? 'agendados'
          : filters.agendou === 'nao' ? 'nao_agendados'
          : undefined,
        fonte: 'importado',
      })
      .then((resp) => {
        if (cancelled) return
        setLeads(resp.items)
        setTotal(resp.total)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar leads')
        setLeads([])
        setTotal(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filters.empresaId, page, debouncedSearch, filters.agendou, refetchTick])

  const optionsOrigem = useMemo(() => uniq(leads.map((l) => l.origem)), [leads])
  const optionsTipo = useMemo(() => uniq(leads.map((l) => l.tipo)), [leads])
  const optionsTipoResgate = useMemo(() => uniq(leads.map((l) => l.tipoResgate)), [leads])
  const optionsResponsavel = useMemo(() => uniq(leads.map((l) => l.nomeResponsavel)), [leads])
  const optionsMotivoNaoAg = useMemo(() => uniq(leads.map((l) => l.motivoNaoAgendamento)), [leads])
  const optionsMotivoNaoFe = useMemo(() => uniq(leads.map((l) => l.motivoNaoFechamento)), [leads])
  const optionsAno = useMemo(
    () => uniq(leads.map((l) => String(new Date(l.createdAt).getFullYear()))),
    [leads],
  )
  const optionsDDD = useMemo(() => uniq(leads.map((l) => ddd(l.telefone))), [leads])

  const filtered = useMemo(() => {
    // Filtros server-side: empresa, search, status (agendou). Aplicados na request.
    // Filtros locais (abaixo): aplicados sobre a página atual já carregada (até 100 itens).
    const cFrom = parseDateOnly(filters.createdFrom)
    const cTo = parseDateOnly(filters.createdTo)
    const aFrom = parseDateOnly(filters.agendamentoFrom)
    const aTo = parseDateOnly(filters.agendamentoTo)
    return leads.filter((l) => {
      if (filters.origem && l.origem !== filters.origem) return false
      if (filters.tipo && l.tipo !== filters.tipo) return false
      if (filters.tipoResgate && l.tipoResgate !== filters.tipoResgate) return false
      if (filters.responsavel && l.nomeResponsavel !== filters.responsavel) return false
      if (filters.motivoNaoAgendamento && l.motivoNaoAgendamento !== filters.motivoNaoAgendamento) return false
      if (filters.motivoNaoFechamento && l.motivoNaoFechamento !== filters.motivoNaoFechamento) return false
      if (!tri(l.interacao, filters.interacao)) return false
      if (!tri(l.pagamentoAntecipado, filters.pagamentoAntecipado)) return false
      if (!tri(l.temConsulta, filters.temConsulta)) return false
      if (!tri(l.compareceu ?? null, filters.compareceu)) return false
      if (!tri(l.fechouTratamento ?? null, filters.fechouTratamento)) return false

      const created = new Date(l.createdAt)
      if (cFrom && created < cFrom) return false
      if (cTo) {
        const end = new Date(cTo); end.setHours(23, 59, 59, 999)
        if (created > end) return false
      }
      if (filters.ano && String(created.getFullYear()) !== filters.ano) return false
      if (filters.mes && String(created.getMonth() + 1) !== filters.mes) return false
      if (filters.diaSemana && String(created.getDay()) !== filters.diaSemana) return false

      if (filters.agendamentoFrom || filters.agendamentoTo || filters.periodoAgendamento) {
        if (!l.dataAgendamento) return false
        const ag = new Date(l.dataAgendamento)
        if (aFrom && ag < aFrom) return false
        if (aTo) {
          const end = new Date(aTo); end.setHours(23, 59, 59, 999)
          if (ag > end) return false
        }
        if (filters.periodoAgendamento) {
          const h = ag.getHours()
          if (filters.periodoAgendamento === 'manha' && !(h >= 5 && h < 12)) return false
          if (filters.periodoAgendamento === 'tarde' && !(h >= 12 && h < 18)) return false
          if (filters.periodoAgendamento === 'noite' && !(h >= 18 || h < 5)) return false
        }
      }

      if (filters.ddd && ddd(l.telefone) !== filters.ddd) return false
      if (filters.letraInicial) {
        const first = (l.nome.trim()[0] ?? '').toUpperCase()
        if (first !== filters.letraInicial.toUpperCase()) return false
      }
      return true
    })
  }, [leads, filters])

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }))
  const reset = () => setFilters((f) => ({ ...initialFilters, empresaId: f.empresaId }))

  const openDanger = (scope: DangerScope) => {
    setDangerScope(scope)
    setDangerConfirm('')
    setDangerMsg(null)
  }
  const closeDanger = () => {
    if (dangerBusy) return
    setDangerScope(null)
    setDangerConfirm('')
  }
  const confirmDanger = async () => {
    if (!filters.empresaId || !dangerScope) return
    if (dangerConfirm.trim().toUpperCase() !== 'APAGAR') return
    setDangerBusy(true)
    setDangerMsg(null)
    try {
      const opts = dangerScope === 'all' ? {} : { fonte: dangerScope as FonteFiltro }
      const { deleted } = await leadsApi.bulkDelete(filters.empresaId, opts)
      if (deleted === 0) {
        setDangerMsg({
          kind: 'error',
          text:
            dangerScope === 'importado'
              ? 'Nenhum lead estava marcado como IMPORTADO. Imports antigos (anteriores à atualização) ficaram marcados como manuais — use "Apagar TUDO" se quiser limpar a base.'
              : dangerScope === 'manual'
                ? 'Nenhum lead estava marcado como MANUAL para esta empresa.'
                : 'Nenhum lead encontrado para apagar.',
        })
      } else {
        setDangerMsg({
          kind: 'success',
          text: `${deleted.toLocaleString('pt-BR')} leads apagados com sucesso.`,
        })
      }
      setLeads([])
      setTotal(0)
      setPage(0)
      setRefetchTick((t) => t + 1)
      setDangerScope(null)
      setDangerConfirm('')
    } catch (err) {
      setDangerMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Erro ao apagar' })
    } finally {
      setDangerBusy(false)
    }
  }

  const dangerLabel: Record<DangerScope, string> = {
    all: 'TODOS os leads (manuais + importados)',
    manual: 'apenas os leads MANUAIS',
    importado: 'apenas os leads IMPORTADOS',
  }

  return (
    <motion.div
      className="px-8 py-8 max-w-[1400px] mx-auto"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-[#15171b] border border-white/[0.05] text-[13px] text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-[#15171b] border border-white/[0.05] text-[13px] text-white/70 hover:text-white"
          >
            <Filter className="h-4 w-4" />
            {showFilters ? 'Ocultar' : 'Mostrar'} filtros
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-[#15171b] border border-white/[0.05] text-[13px] text-white/70 hover:text-white"
          >
            <RotateCcw className="h-4 w-4" />
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Hero — usa âmbar para casar com a tela de "Importar Planilha" e diferenciar dos manuais */}
      <div
        className="rounded-3xl p-6 mb-5 text-amber-50 ring-2 ring-amber-300/40"
        style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 55%, #92400e 100%)' }}
      >
        <span className="inline-flex items-center gap-1.5 px-2 h-5 rounded-md bg-white/20 text-[10px] font-bold uppercase tracking-[0.2em] text-white mb-2">
          Origem: importação em massa
        </span>
        <h1 className="text-[28px] font-bold tracking-tight leading-none">Importados</h1>
        <p className="text-[13px] text-amber-50/95 mt-2">
          Leads vindos de planilhas/importação em massa. Os cadastros manuais ficam em <strong>“Leads”</strong>.
        </p>
      </div>

      {/* Empresa selector */}
      <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-4 mb-4 flex flex-wrap items-center gap-3">
        <label className="text-[12px] uppercase tracking-wider text-white/55 shrink-0">Empresa</label>
        <select
          value={filters.empresaId}
          onChange={(e) => set('empresaId', e.target.value)}
          style={{ colorScheme: 'dark' }}
          className="flex-1 min-w-[200px] h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]"
        >
          <option value="">— selecione —</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Buscar por nome, telefone, origem, responsável…"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px] placeholder:text-white/35 focus:outline-none focus:border-amber-400/55"
          />
        </div>
        <span className="text-[12px] text-white/55 tabular-nums">
          {loading ? 'carregando…' : `${total.toLocaleString('pt-BR')} importados`}
        </span>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-500/[0.08] border border-rose-400/30 text-rose-200 text-sm p-3 mb-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {showFilters && (
        <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <SelectField label="Origem" value={filters.origem} onChange={(v) => set('origem', v)} options={optionsOrigem} />
            <SelectField label="Tipo" value={filters.tipo} onChange={(v) => set('tipo', v)} options={optionsTipo} />
            <SelectField label="Tipo de Resgate" value={filters.tipoResgate} onChange={(v) => set('tipoResgate', v)} options={optionsTipoResgate} />
            <SelectField label="Responsável" value={filters.responsavel} onChange={(v) => set('responsavel', v)} options={optionsResponsavel} />
            <SelectField label="Motivo não agendamento" value={filters.motivoNaoAgendamento} onChange={(v) => set('motivoNaoAgendamento', v)} options={optionsMotivoNaoAg} />
            <SelectField label="Motivo não fechamento" value={filters.motivoNaoFechamento} onChange={(v) => set('motivoNaoFechamento', v)} options={optionsMotivoNaoFe} />
            <TriField label="Houve interação?" value={filters.interacao} onChange={(v) => set('interacao', v)} />
            <TriField label="Agendou consulta?" value={filters.agendou} onChange={(v) => set('agendou', v)} />
            <TriField label="Pagamento antecipado?" value={filters.pagamentoAntecipado} onChange={(v) => set('pagamentoAntecipado', v)} />
            <TriField label="Tem consulta?" value={filters.temConsulta} onChange={(v) => set('temConsulta', v)} />
            <TriField label="Compareceu?" value={filters.compareceu} onChange={(v) => set('compareceu', v)} />
            <TriField label="Fechou tratamento?" value={filters.fechouTratamento} onChange={(v) => set('fechouTratamento', v)} />
            <Field label="Cadastro de">
              <input type="date" value={filters.createdFrom} onChange={(e) => set('createdFrom', e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full h-9 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]" />
            </Field>
            <Field label="Cadastro até">
              <input type="date" value={filters.createdTo} onChange={(e) => set('createdTo', e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full h-9 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]" />
            </Field>
            <Field label="Agendamento de">
              <input type="date" value={filters.agendamentoFrom} onChange={(e) => set('agendamentoFrom', e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full h-9 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]" />
            </Field>
            <Field label="Agendamento até">
              <input type="date" value={filters.agendamentoTo} onChange={(e) => set('agendamentoTo', e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full h-9 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]" />
            </Field>
            <SelectField label="Ano (cadastro)" value={filters.ano} onChange={(v) => set('ano', v)} options={optionsAno} />
            <SelectFieldExplicit label="Mês (cadastro)" value={filters.mes} onChange={(v) => set('mes', v)}
              options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))} />
            <SelectFieldExplicit label="Dia da semana (cadastro)" value={filters.diaSemana} onChange={(v) => set('diaSemana', v)}
              options={DIAS_SEMANA.map((d, i) => ({ value: String(i), label: d }))} />
            <SelectField label="DDD" value={filters.ddd} onChange={(v) => set('ddd', v)} options={optionsDDD} />
            <Field label="Letra inicial do nome">
              <input maxLength={1} value={filters.letraInicial}
                onChange={(e) => set('letraInicial', e.target.value)}
                placeholder="A–Z"
                className="w-full h-9 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px] uppercase" />
            </Field>
            <SelectFieldExplicit label="Período do agendamento" value={filters.periodoAgendamento}
              onChange={(v) => set('periodoAgendamento', v as Filters['periodoAgendamento'])}
              options={[
                { value: 'manha', label: 'Manhã (5–12h)' },
                { value: 'tarde', label: 'Tarde (12–18h)' },
                { value: 'noite', label: 'Noite (18–5h)' },
              ]} />
          </div>
        </div>
      )}

      {showFilters && total > PAGE_SIZE && (
        <div className="rounded-2xl bg-amber-500/[0.06] border border-amber-400/20 text-amber-200 text-[12px] px-4 py-2.5 mb-4">
          Os filtros avançados se aplicam apenas à página atual ({leads.length} de {total.toLocaleString('pt-BR')}).
          Para filtros sobre toda a base, use a busca acima ou navegue pelas páginas.
        </div>
      )}

      {/* Table — apenas a página atual */}
      <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0c0d10] sticky top-0 z-10">
              <tr className="text-[10px] uppercase tracking-wider text-white/45">
                <th className="text-left px-4 py-2.5 font-medium">Nome</th>
                <th className="text-left px-4 py-2.5 font-medium">Telefone</th>
                <th className="text-left px-4 py-2.5 font-medium">Origem</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium">Resp.</th>
                <th className="text-left px-4 py-2.5 font-medium">Agendou</th>
                <th className="text-left px-4 py-2.5 font-medium">Consulta</th>
                <th className="text-left px-4 py-2.5 font-medium">Fechou</th>
                <th className="text-left px-4 py-2.5 font-medium">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-2 truncate max-w-[180px]">{l.nome}</td>
                  <td className="px-4 py-2 tabular-nums">{l.telefone}</td>
                  <td className="px-4 py-2 truncate max-w-[160px]">{l.origem}</td>
                  <td className="px-4 py-2">{l.tipo}</td>
                  <td className="px-4 py-2 truncate max-w-[120px]">{l.nomeResponsavel}</td>
                  <td className="px-4 py-2">{l.agendouConsulta ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-2">{l.temConsulta ? 'Sim' : '—'}</td>
                  <td className="px-4 py-2">{l.fechouTratamento === null || l.fechouTratamento === undefined ? '—' : l.fechouTratamento ? 'Sim' : 'Não'}</td>
                  <td className="px-4 py-2 tabular-nums text-white/55">
                    {new Date(l.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-white/45 text-sm">
                    {total === 0 ? 'Nenhum lead importado nesta empresa.' : 'Nenhum lead nesta página corresponde aos filtros avançados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-[12px] text-white/55 tabular-nums">
            Página {page + 1} de {Math.max(1, Math.ceil(total / PAGE_SIZE))} · {total.toLocaleString('pt-BR')} leads no total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="h-9 px-3 rounded-xl bg-[#15171b] border border-white/[0.05] text-[12px] text-white/70 hover:text-white hover:border-white/[0.15] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total || loading}
              className="h-9 px-3 rounded-xl bg-[#15171b] border border-white/[0.05] text-[12px] text-white/70 hover:text-white hover:border-white/[0.15] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}

      {/* Zona de perigo — exclusão em massa */}
      <div className="mt-8 rounded-3xl border border-rose-500/30 bg-rose-500/[0.04] p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-rose-500/15 grid place-items-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-rose-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-bold text-rose-200">Zona de perigo</h2>
            <p className="text-[12px] text-rose-200/75 mt-0.5">
              Ações irreversíveis. Use para limpar a base antes de uma nova importação.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => openDanger('importado')}
            disabled={!filters.empresaId || dangerBusy}
            className="group flex flex-col items-start gap-1 p-4 rounded-2xl border border-amber-400/30 bg-amber-500/[0.06] hover:bg-amber-500/[0.10] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
          >
            <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-amber-300">
              <Trash2 className="h-3.5 w-3.5" />
              Apagar IMPORTADOS
            </span>
            <span className="text-[12px] text-white/60">Remove apenas os leads que vieram de planilha.</span>
          </button>

          <button
            onClick={() => openDanger('manual')}
            disabled={!filters.empresaId || dangerBusy}
            className="group flex flex-col items-start gap-1 p-4 rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.10] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
          >
            <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-cyan-300">
              <Trash2 className="h-3.5 w-3.5" />
              Apagar MANUAIS
            </span>
            <span className="text-[12px] text-white/60">Remove apenas os leads cadastrados a mão.</span>
          </button>

          <button
            onClick={() => openDanger('all')}
            disabled={!filters.empresaId || dangerBusy}
            className="group flex flex-col items-start gap-1 p-4 rounded-2xl border border-rose-400/40 bg-rose-500/[0.10] hover:bg-rose-500/[0.16] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
          >
            <span className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-rose-200">
              <Trash2 className="h-3.5 w-3.5" />
              Apagar TUDO
            </span>
            <span className="text-[12px] text-white/60">Remove manuais + importados desta empresa.</span>
          </button>
        </div>

        {dangerMsg && (
          <div
            className={cn(
              'mt-4 rounded-2xl p-3 text-[13px] flex items-start gap-2',
              dangerMsg.kind === 'success'
                ? 'bg-cyan-500/[0.08] border border-cyan-400/30 text-cyan-200'
                : 'bg-rose-500/[0.10] border border-rose-400/30 text-rose-200',
            )}
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{dangerMsg.text}</span>
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      {dangerScope && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/65 backdrop-blur-sm p-4"
          onClick={closeDanger}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-rose-400/40 bg-[#15171b] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="h-11 w-11 rounded-2xl bg-rose-500/15 grid place-items-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] font-bold text-white">Confirmar exclusão em massa</h3>
                <p className="text-[12px] text-white/60 mt-1">
                  Você está prestes a apagar <span className="text-rose-300 font-semibold">{dangerLabel[dangerScope]}</span> da empresa selecionada.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-rose-500/[0.08] border border-rose-400/30 p-3 mb-4">
              <p className="text-[12px] text-rose-200">
                Essa ação <strong>não pode ser desfeita</strong>. Os dados serão removidos permanentemente do banco.
              </p>
            </div>

            <label className="block text-[12px] text-white/65 mb-1.5">
              Para confirmar, digite <span className="font-bold tracking-wider text-rose-300">APAGAR</span>:
            </label>
            <input
              autoFocus
              type="text"
              value={dangerConfirm}
              onChange={(e) => setDangerConfirm(e.target.value)}
              disabled={dangerBusy}
              placeholder="APAGAR"
              className="w-full h-11 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.08] text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-rose-400/60 focus:ring-2 focus:ring-rose-400/15 uppercase tracking-wider"
            />

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={closeDanger}
                disabled={dangerBusy}
                className="h-10 px-4 rounded-xl border border-white/[0.08] bg-[#0c0d10] text-[13px] text-white/70 hover:text-white hover:border-white/[0.18] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDanger}
                disabled={dangerBusy || dangerConfirm.trim().toUpperCase() !== 'APAGAR'}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {dangerBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {dangerBusy ? 'Apagando…' : 'Apagar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] uppercase tracking-wider text-white/55">{label}</label>
      {children}
    </div>
  )
}

function SelectField({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ colorScheme: 'dark' }}
        className={cn('w-full h-9 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]')}>
        <option value="">Todos</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  )
}

function SelectFieldExplicit({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ colorScheme: 'dark' }}
        className="w-full h-9 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]">
        <option value="">Todos</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  )
}

function TriField({
  label, value, onChange,
}: { label: string; value: Tri; onChange: (v: Tri) => void }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value as Tri)}
        style={{ colorScheme: 'dark' }}
        className="w-full h-9 px-3 rounded-xl bg-[#0c0d10] border border-white/[0.05] text-[13px]">
        <option value="">Todos</option>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </select>
    </Field>
  )
}


import { Calendar, Filter, Infinity as InfinityIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardFilters } from '@/types/cadastra'

export type DashboardFonte = 'todos' | 'manual' | 'importado'

interface DashboardHeaderProps {
  title?: string
  filters: DashboardFilters
  onFilterChange: (filters: Partial<DashboardFilters>) => void
  fonte?: DashboardFonte
  onFonteChange?: (fonte: DashboardFonte) => void
  isLive?: boolean
  onToggleLive?: () => void
}

const periodFilters: { id: DashboardFilters['periodo']; label: string; hasIcon?: boolean }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'tudo', label: 'Tudo' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'customizado', label: 'Período', hasIcon: true },
]

const fonteFilters: { id: DashboardFonte; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'manual', label: 'Leads' },
  { id: 'importado', label: 'Importados' },
]

export function DashboardHeader({
  title = 'Painel da empresa',
  filters,
  onFilterChange,
  fonte = 'todos',
  onFonteChange,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-white/[0.06] bg-[#0e1014]">
      {/* Linha 1: título */}
      <div className="px-8 pt-5 pb-2 flex items-center gap-3">
        <h1 className="text-[18px] font-bold tracking-tight text-white">{title}</h1>
        <span className="text-[11px] text-white/45 hidden md:inline">
          Use os filtros abaixo para mudar o que aparece no painel.
        </span>
      </div>

      {/* Linha 2: filtros bem destacados */}
      <div className="px-8 pb-5 flex flex-wrap items-end gap-5">
        {/* FONTE — leads vs importados */}
        {onFonteChange && (
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
              <Filter className="h-3 w-3" />
              Fonte
            </span>
            <div className="inline-flex items-center rounded-2xl border-2 border-white/[0.08] bg-[#15171b] p-1 shadow-lg">
              {fonteFilters.map((f) => {
                const active = fonte === f.id
                const activeStyle =
                  f.id === 'manual' ? 'bg-cyan-400 text-slate-900 shadow-md shadow-cyan-400/30'
                  : f.id === 'importado' ? 'bg-amber-400 text-slate-900 shadow-md shadow-amber-400/30'
                  : 'bg-white text-slate-900 shadow-md'
                return (
                  <button
                    key={f.id}
                    onClick={() => onFonteChange(f.id)}
                    className={cn(
                      'h-9 px-4 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all',
                      active ? activeStyle : 'text-white/65 hover:text-white hover:bg-white/[0.04]',
                    )}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* PERÍODO — janela de tempo */}
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            <Calendar className="h-3 w-3" />
            Período
          </span>
          <div className="inline-flex items-center rounded-2xl border-2 border-white/[0.08] bg-[#15171b] p-1 shadow-lg">
            {periodFilters.slice(0, 5).map((filter) => {
              const active = filters.periodo === filter.id
              return (
                <button
                  key={filter.id}
                  onClick={() => onFilterChange({ periodo: filter.id })}
                  className={cn(
                    'h-9 px-3.5 rounded-xl text-[12px] font-semibold transition-all flex items-center gap-1.5',
                    active
                      ? 'bg-cyan-400 text-slate-900 shadow-md shadow-cyan-400/30'
                      : 'text-white/65 hover:text-white hover:bg-white/[0.04]',
                  )}
                >
                  {filter.id === 'tudo' && <InfinityIcon className="h-3.5 w-3.5" />}
                  {filter.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Indicador rápido do filtro ativo */}
        <div className="flex flex-col gap-1.5 ml-auto">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Mostrando</span>
          <div className="inline-flex items-center gap-2 h-9 px-3 rounded-2xl border border-white/[0.06] bg-[#15171b]">
            <span className={cn(
              'inline-block h-2 w-2 rounded-full',
              fonte === 'manual' ? 'bg-cyan-400' : fonte === 'importado' ? 'bg-amber-400' : 'bg-white',
            )} />
            <span className="text-[12px] font-medium text-white/85">
              {fonte === 'manual' ? 'Leads manuais' : fonte === 'importado' ? 'Importados' : 'Todos os leads'}
              {' · '}
              <span className="text-white/55">
                {filters.periodo === 'tudo' ? 'sem filtro de data' : periodFilters.find((p) => p.id === filters.periodo)?.label?.toLowerCase() ?? '—'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

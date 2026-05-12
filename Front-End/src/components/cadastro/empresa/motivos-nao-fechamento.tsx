
import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Loader2, AlertCircle, Palette, ShieldCheck } from "@/components/icons"
import {
  motivosNaoFechamentoApi,
  type MotivoNaoFechamentoDto,
  type CorSemaforoDto,
} from '@/lib/cadastra/api'
import { cn } from '@/lib/utils'

interface Props {
  empresaId: string
  canEdit: boolean
}

const corLabel: Record<CorSemaforoDto, string> = {
  verde: 'Fechou',
  amarelo: 'Pendente',
  vermelho: 'Perdido',
}

const corClasses: Record<CorSemaforoDto, { dot: string; chip: string; selected: string }> = {
  verde: {
    dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
    chip: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300',
    selected: 'border-emerald-400/70 bg-emerald-500/15',
  },
  amarelo: {
    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
    chip: 'bg-amber-500/10 border-amber-400/30 text-amber-300',
    selected: 'border-amber-400/70 bg-amber-500/15',
  },
  vermelho: {
    dot: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]',
    chip: 'bg-red-500/10 border-red-400/30 text-red-300',
    selected: 'border-red-400/70 bg-red-500/15',
  },
}

export function MotivosNaoFechamentoSection({ empresaId, canEdit }: Props) {
  const [motivos, setMotivos] = useState<MotivoNaoFechamentoDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [novoNome, setNovoNome] = useState('')
  const [novaCor, setNovaCor] = useState<CorSemaforoDto>('amarelo')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await motivosNaoFechamentoApi.list(empresaId)
      setMotivos(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar motivos')
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    void load()
  }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome.trim()) return
    setAdding(true)
    setError(null)
    try {
      const created = await motivosNaoFechamentoApi.create(empresaId, {
        nome: novoNome.trim(),
        cor: novaCor,
      })
      setMotivos((cur) => [...cur, created])
      setNovoNome('')
      setNovaCor('amarelo')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar motivo')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (motivo: MotivoNaoFechamentoDto) => {
    if (motivo.isDefault) return
    if (!confirm(`Remover o motivo "${motivo.nome}"?`)) return
    setError(null)
    try {
      await motivosNaoFechamentoApi.delete(empresaId, motivo.id)
      setMotivos((cur) => cur.filter((m) => m.id !== motivo.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover motivo')
    }
  }

  const grouped: Record<CorSemaforoDto, MotivoNaoFechamentoDto[]> = {
    verde: motivos.filter((m) => m.cor === 'verde'),
    amarelo: motivos.filter((m) => m.cor === 'amarelo'),
    vermelho: motivos.filter((m) => m.cor === 'vermelho'),
  }

  return (
    <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-6 mt-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-cyan-400" />
          <h3 className="text-[14px] font-semibold">Motivos de não fechamento</h3>
        </div>
        <span className="text-[11px] text-white/45 tabular-nums">{motivos.length}</span>
      </div>
      <p className="text-[12px] text-white/55 mb-5">
        Semáforo usado nos formulários de consulta. Os 9 motivos padrão não podem ser removidos —
        adicione novos conforme a clínica precisar.
      </p>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-400/30 text-rose-200 text-sm mb-4">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
        </div>
      ) : (
        <div className="space-y-5">
          {(['verde', 'amarelo', 'vermelho'] as const).map((cor) => (
            <div key={cor}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('inline-block h-2.5 w-2.5 rounded-full', corClasses[cor].dot)} aria-hidden />
                <span className="text-[12px] uppercase tracking-wider text-white/65 font-semibold">
                  {corLabel[cor]}
                </span>
                <span className="text-[11px] text-white/40 tabular-nums">{grouped[cor].length}</span>
              </div>
              {grouped[cor].length === 0 ? (
                <p className="text-[12px] text-white/40 italic pl-5">Nenhum motivo nesta categoria.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <AnimatePresence initial={false}>
                    {grouped[cor].map((m) => (
                      <motion.li
                        key={m.id}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border bg-[#0c0d10] px-3 py-2.5 text-sm',
                          'border-white/[0.06]',
                        )}
                      >
                        <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', corClasses[cor].dot)} aria-hidden />
                        <span className="flex-1 text-foreground truncate">{m.nome}</span>
                        {m.isDefault ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-white/[0.04] text-white/55 border border-white/[0.06]">
                            <ShieldCheck className="h-3 w-3" />
                            Padrão
                          </span>
                        ) : canEdit ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(m)}
                            className="h-7 w-7 grid place-items-center rounded-lg text-white/55 hover:text-rose-300 hover:bg-rose-500/[0.07] transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && !loading && (
        <form
          onSubmit={handleAdd}
          className="mt-6 pt-5 border-t border-white/[0.05] grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end"
        >
          <div>
            <label className="block text-[12px] font-medium text-white/65 mb-1.5">Novo motivo</label>
            <input
              type="text"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex.: Procurando segunda opinião"
              maxLength={150}
              className="w-full px-3 h-11 rounded-2xl bg-[#0c0d10] border border-white/[0.05] text-[14px] placeholder:text-white/30 focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-white/65 mb-1.5">Cor</label>
            <div className="flex gap-1.5">
              {(['verde', 'amarelo', 'vermelho'] as const).map((cor) => {
                const active = novaCor === cor
                return (
                  <button
                    type="button"
                    key={cor}
                    onClick={() => setNovaCor(cor)}
                    className={cn(
                      'h-11 w-11 grid place-items-center rounded-2xl border transition-colors',
                      active ? corClasses[cor].selected : 'border-white/[0.05] bg-[#0c0d10] hover:border-white/[0.12]',
                    )}
                    title={corLabel[cor]}
                    aria-pressed={active}
                  >
                    <span className={cn('inline-block h-3.5 w-3.5 rounded-full', corClasses[cor].dot)} aria-hidden />
                  </button>
                )
              })}
            </div>
          </div>
          <button
            type="submit"
            disabled={adding || !novoNome.trim()}
            className={cn(
              'h-11 px-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-semibold text-[13px] inline-flex items-center gap-2 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </button>
        </form>
      )}
    </div>
  )
}

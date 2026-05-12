
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Wallet } from "@/components/icons"
import { TextInput, SelectInput } from './form-fields'
import { useConfig } from '@/lib/cadastra/config-store'
import { cn } from '@/lib/utils'

export interface RecebimentoInput {
  valorRecebimento: number
  formaPagamento: string
  dataRecebimento: string
}

interface RecebimentosEditorProps {
  value: RecebimentoInput[]
  onChange: (next: RecebimentoInput[]) => void
  max: number
}

export function RecebimentosEditor({ value, onChange, max }: RecebimentosEditorProps) {
  const config = useConfig()
  const formaOptions = config.formasPagamento.map((f) => ({ value: f, label: f }))

  const total = value.reduce((sum, r) => sum + (Number.isFinite(r.valorRecebimento) ? r.valorRecebimento : 0), 0)
  const canAdd = value.length < max

  const update = (index: number, patch: Partial<RecebimentoInput>) => {
    const next = value.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange(next)
  }

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const add = () => {
    if (!canAdd) return
    onChange([
      ...value,
      {
        valorRecebimento: 0,
        formaPagamento: config.formasPagamento[0] ?? 'Pix',
        dataRecebimento: new Date().toISOString().slice(0, 10),
      },
    ])
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-amber-300" />
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            Recebimentos
          </p>
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            {value.length}/{max}
          </span>
        </div>
        <div className="text-xs tabular-nums text-amber-300">
          Total:{' '}
          <span className="font-semibold">
            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
      </div>

      {value.length === 0 && (
        <div className="text-center py-6 px-4 border border-dashed border-white/10 rounded-lg text-xs text-muted-foreground">
          Nenhum recebimento adicionado.
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {value.map((r, idx) => (
            <motion.div
              key={idx}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end p-3 rounded-lg bg-[#0d1117]/60 border border-white/5"
            >
              <TextInput
                label={`Valor #${idx + 1}`}
                type="number"
                min={0}
                step="0.01"
                value={r.valorRecebimento}
                onChange={(e) => update(idx, { valorRecebimento: Number(e.target.value) })}
                placeholder="0,00"
                required
              />
              <SelectInput
                label="Forma"
                value={r.formaPagamento}
                onChange={(e) => update(idx, { formaPagamento: e.target.value })}
                options={formaOptions}
                required
              />
              <TextInput
                label="Data"
                type="date"
                value={r.dataRecebimento}
                onChange={(e) => update(idx, { dataRecebimento: e.target.value })}
                required
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                className="h-10 w-10 grid place-items-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 hover:bg-red-500/10 transition-colors"
                aria-label={`Remover recebimento ${idx + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={add}
        disabled={!canAdd}
        className={cn(
          'mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all',
          canAdd
            ? 'border-cyan-400/30 bg-cyan-400/5 text-cyan-300 hover:bg-cyan-400/10'
            : 'border-white/5 bg-white/[0.02] text-muted-foreground/60 cursor-not-allowed',
        )}
      >
        <Plus className="h-4 w-4" />
        Adicionar Recebimento
        {!canAdd && <span className="ml-1 text-[11px]">(máx {max})</span>}
      </button>
    </div>
  )
}


import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, RotateCcw, Settings2, Pencil, Check, X } from "@/components/icons"
import {
  useConfig,
  useIsClient,
  addItem,
  removeItem,
  updateItem,
  resetToDefaults,
  type ConfigListKey,
} from '@/lib/cadastra/config-store'
import { cn } from '@/lib/utils'

interface ConfigViewProps {
  onBack: () => void
}

interface ListGroup {
  key: ConfigListKey
  label: string
  description: string
  placeholder: string
}

const groups: ListGroup[] = [
  { key: 'origens',          label: 'Origens dos leads',     description: 'De onde os leads chegam.',                                placeholder: 'Ex.: WhatsApp Ads' },
  { key: 'tiposResgate',     label: 'Tipos de resgate',      description: 'Como você tenta resgatar leads frios.',                  placeholder: 'Ex.: E-mail' },
  { key: 'responsaveis',     label: 'Responsáveis',          description: 'Quem atende cada lead.',                                  placeholder: 'Ex.: Júlia' },
  { key: 'planosTratamento', label: 'Planos de tratamento',  description: 'Lista de planos oferecidos.',                            placeholder: 'Ex.: Premium Anual' },
  { key: 'planosPilates',    label: 'Planos de Pilates',     description: 'Vinculáveis ao tratamento.',                              placeholder: 'Ex.: 2x semana' },
  { key: 'musculacaoOpcoes', label: 'Opções de musculação',  description: 'Pacotes de musculação.',                                  placeholder: 'Ex.: 5x mensal' },
  { key: 'procedimentos',    label: 'Procedimentos',         description: 'Procedimentos clínicos disponíveis.',                     placeholder: 'Ex.: RPG' },
  { key: 'formasPagamento',  label: 'Formas de pagamento',   description: 'Aparecem ao registrar recebimentos.',                     placeholder: 'Ex.: PicPay' },
]

export function ConfigView({ onBack }: ConfigViewProps) {
  const config = useConfig()
  const isClient = useIsClient()
  const [activeGroup, setActiveGroup] = useState<ConfigListKey>('origens')

  return (
    <motion.div
      className="px-8 py-8 max-w-5xl mx-auto"
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
            <Settings2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-[0.2em] text-cyan-100/85 mb-1">Configurações</p>
            <h1 className="text-[28px] font-bold tracking-tight leading-none">Listas do sistema</h1>
            <p className="text-[13px] text-cyan-100/85 mt-2">
              As opções abaixo aparecem nos formulários. Adicione, edite ou remova como precisar.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
        {/* Groups menu */}
        <nav className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-2 h-fit">
          {groups.map((g) => {
            const count = isClient ? config[g.key].length : 0
            const active = activeGroup === g.key
            return (
              <button
                key={g.key}
                onClick={() => setActiveGroup(g.key)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 h-10 rounded-2xl text-[13px] transition-colors',
                  active
                    ? 'bg-white text-slate-900 font-semibold'
                    : 'text-white/65 hover:text-white hover:bg-white/[0.04]',
                )}
              >
                <span className="truncate text-left">{g.label}</span>
                <span
                  className={cn(
                    'text-[11px] tabular-nums px-1.5 py-0.5 rounded-md font-semibold',
                    active ? 'bg-cyan-500/15 text-cyan-700' : 'bg-white/[0.06] text-white/65',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </nav>

        <ConfigGroupEditor
          group={groups.find((g) => g.key === activeGroup)!}
          values={isClient ? config[activeGroup] : []}
        />
      </div>
    </motion.div>
  )
}

interface ConfigGroupEditorProps {
  group: ListGroup
  values: string[]
}

function ConfigGroupEditor({ group, values }: ConfigGroupEditorProps) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ value: string; next: string } | null>(null)

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    addItem(group.key, draft)
    setDraft('')
  }

  const commitEdit = () => {
    if (!editing) return
    if (editing.next.trim() && editing.next !== editing.value) {
      updateItem(group.key, editing.value, editing.next)
    }
    setEditing(null)
  }

  return (
    <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-[18px] font-semibold tracking-tight">{group.label}</h3>
          <p className="text-[13px] text-white/55 mt-0.5">{group.description}</p>
        </div>
        <button
          onClick={() => {
            if (confirm(`Restaurar "${group.label}" para os padrões?`)) resetToDefaults(group.key)
          }}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-[12px] text-white/65 hover:text-white hover:bg-white/[0.05] transition-colors"
          title="Restaurar padrões"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Padrão
        </button>
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-[1fr_auto] gap-2 mb-5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={group.placeholder}
          className="h-12 px-4 rounded-2xl bg-[#0c0d10] border border-white/[0.05] text-[14px] placeholder:text-white/30 focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 transition-colors"
        />
        <button
          type="submit"
          className="h-12 px-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-semibold text-[13px] inline-flex items-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </form>

      {values.length === 0 ? (
        <p className="text-center text-[13px] text-white/45 py-8">
          Nenhum item ainda. Adicione o primeiro acima.
        </p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {values.map((v) => {
              const isEditing = editing?.value === v
              return (
                <motion.li
                  key={v}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-2 rounded-2xl bg-[#0c0d10] border border-white/[0.05] px-4 h-12"
                >
                  {isEditing ? (
                    <>
                      <input
                        autoFocus
                        value={editing!.next}
                        onChange={(e) => setEditing({ value: editing!.value, next: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit()
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        className="flex-1 bg-transparent border-none text-[14px] focus:outline-none"
                      />
                      <button
                        onClick={commitEdit}
                        className="h-8 w-8 grid place-items-center rounded-lg text-cyan-400 hover:bg-cyan-400/10 transition-colors"
                        title="Salvar"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="h-8 w-8 grid place-items-center rounded-lg text-white/55 hover:bg-white/[0.05] transition-colors"
                        title="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-[14px] text-white">{v}</span>
                      <button
                        onClick={() => setEditing({ value: v, next: v })}
                        className="h-8 w-8 grid place-items-center rounded-lg text-white/55 hover:text-cyan-300 hover:bg-cyan-400/10 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remover "${v}"?`)) removeItem(group.key, v)
                        }}
                        className="h-8 w-8 grid place-items-center rounded-lg text-white/55 hover:text-rose-300 hover:bg-rose-500/[0.07] transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}


import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, Check, ChevronsUpDown, Plus, Loader2 } from "@/components/icons"
import { useEmpresa } from '@/contexts/cadastra/empresa-context'
import { resolveAssetUrl } from '@/lib/cadastra/api'
import { cn } from '@/lib/utils'

interface Props {
  collapsed?: boolean
}

// Switcher de empresa exibido no header da sidebar.
// Mostra a empresa ativa, abre dropdown com todas + botão "Nova empresa".
// Quando colapsada, reduz para um avatar quadrado clicável.
export function EmpresaSwitcher({ collapsed = false }: Props) {
  const navigate = useNavigate()
  const { empresas, currentEmpresa, isLoading, setCurrentEmpresaId } = useEmpresa()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Fecha ao trocar a empresa ativa.
  function pick(id: string) {
    setCurrentEmpresaId(id)
    setOpen(false)
  }

  function goCreate() {
    setOpen(false)
    navigate('/cadastro/empresa/criar')
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-2.5 h-10',
          collapsed && 'justify-center px-0 w-10',
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-white/40" />
      </div>
    )
  }

  if (empresas.length === 0) {
    return (
      <button
        onClick={goCreate}
        className={cn(
          'flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-2.5 h-10 text-[12px] font-medium text-cyan-200 hover:bg-cyan-500/15 transition-colors',
          collapsed && 'justify-center px-0 w-10',
        )}
        title="Cadastrar empresa"
      >
        <Plus className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">Cadastrar empresa</span>}
      </button>
    )
  }

  const logoUrl = resolveAssetUrl(currentEmpresa?.logoUrl)
  const fallbackChar = currentEmpresa?.nome?.[0]?.toUpperCase() ?? '?'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? currentEmpresa?.nome : undefined}
        className={cn(
          'group flex w-full items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-2 h-10 text-left text-[12px] hover:bg-white/[0.04] transition-colors',
          collapsed && 'justify-center px-0 w-10',
          open && 'bg-white/[0.06]',
        )}
      >
        <EmpresaAvatar logoUrl={logoUrl} fallbackChar={fallbackChar} />
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-white">{currentEmpresa?.nome ?? '—'}</p>
              {empresas.length > 1 && (
                <p className="text-[10px] text-white/45 truncate">
                  {empresas.length} empresas
                </p>
              )}
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-white/40 group-hover:text-white/70" />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className={cn(
              'absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-white/10 bg-[#141823] shadow-[0_18px_48px_-16px_rgba(0,0,0,0.7)]',
              collapsed && 'left-12 right-auto w-60',
            )}
          >
            <div className="max-h-72 overflow-y-auto p-1.5">
              {empresas.map((e) => {
                const isActive = e.id === currentEmpresa?.id
                const url = resolveAssetUrl(e.logoUrl)
                const fc = e.nome?.[0]?.toUpperCase() ?? '?'
                return (
                  <button
                    key={e.id}
                    onClick={() => pick(e.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                      isActive ? 'bg-cyan-500/10 text-cyan-100' : 'text-white/80 hover:bg-white/[0.05]',
                    )}
                  >
                    <EmpresaAvatar logoUrl={url} fallbackChar={fc} small />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{e.nome}</p>
                      {e.tipo && <p className="truncate text-[10px] text-white/40">{e.tipo}</p>}
                    </div>
                    {isActive && <Check className="h-3.5 w-3.5 text-cyan-300 shrink-0" />}
                  </button>
                )
              })}
            </div>
            <div className="border-t border-white/6 p-1.5">
              <button
                onClick={goCreate}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/10 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Criar nova empresa
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function EmpresaAvatar({
  logoUrl,
  fallbackChar,
  small = false,
}: {
  logoUrl: string | null
  fallbackChar: string
  small?: boolean
}) {
  const size = small ? 'h-6 w-6 text-[10px]' : 'h-7 w-7 text-[11px]'
  return (
    <div
      className={cn(
        size,
        'shrink-0 rounded-lg overflow-hidden grid place-items-center bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/15 border border-white/10',
      )}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <Building2 className={cn(small ? 'h-3 w-3' : 'h-3.5 w-3.5', 'text-cyan-200')} aria-hidden />
      )}
      {!logoUrl && <span className="sr-only">{fallbackChar}</span>}
    </div>
  )
}


import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  LogOut,
  LayoutDashboard,
  Users as UsersIcon,
  UserPlus,
  ClipboardPlus,
  HeartPulse,
  Wallet,
  Building2,
  ScrollText,
  Plug2,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/cadastra/auth-context'
import { useStoreCounts, useIsClient } from '@/lib/cadastra/cadastro-store'
import { AvatarCircle } from '@/cadastra-ui/avatar-circle'
import { EmpresaSwitcher } from '@/components/cadastro/empresa/empresa-switcher'

export type DashboardView =
  | 'dashboard'
  | 'leads-list'
  | 'lead-detail'
  | 'lead'
  | 'consulta'
  | 'tratamento'
  | 'recebimentos'
  | 'empresa'
  | 'importar'
  | 'importados'
  | 'relatorios'
  | 'config'
  | 'perfil'
  | 'logs'
  | 'kommo'
  | 'integracoes'
  | 'painel'

interface SidebarItem {
  id: DashboardView
  label: string
  Icon?: LucideIcon
  iconUrl?: string
  countKey?: 'leads' | 'consultas' | 'tratamentos' | 'recebimentos'
}

const items: SidebarItem[] = [
  { id: 'dashboard',    label: 'Dashboard',            Icon: LayoutDashboard },
  { id: 'leads-list',   label: 'Leads',                Icon: UsersIcon,       countKey: 'leads' },
  { id: 'lead',         label: 'Novo Lead',            Icon: UserPlus },
  { id: 'consulta',     label: 'Cadastrar Consulta',   Icon: ClipboardPlus,   countKey: 'consultas' },
  { id: 'tratamento',   label: 'Cadastrar Tratamento', Icon: HeartPulse,      countKey: 'tratamentos' },
  { id: 'recebimentos', label: 'Recebimentos',         Icon: Wallet,          countKey: 'recebimentos' },
  { id: 'empresa',      label: 'Empresa & Equipe',     Icon: Building2 },
]

interface DashboardSidebarProps {
  active: DashboardView
  onChange: (view: DashboardView) => void
}

export function DashboardSidebar({ active, onChange }: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const counts = useStoreCounts()
  const isClient = useIsClient()
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/cadastro/login')
  }

  const width = collapsed ? 'w-[76px]' : 'w-[244px]'

  const renderItem = (item: SidebarItem, opts?: { iconNode?: React.ReactNode }) => {
    const isActive = active === item.id
    const count = item.countKey && isClient ? counts[item.countKey] : null
    const Icon = item.Icon
    return (
      <button
        key={item.id}
        onClick={() => onChange(item.id)}
        className={cn(
          'group relative w-full flex items-center gap-2.5 rounded-2xl px-3 h-10 text-[13px] transition-colors',
          isActive
            ? 'bg-white text-slate-900 font-semibold shadow-[0_8px_24px_-12px_rgba(34,211,238,0.45)]'
            : 'text-white/65 hover:text-white hover:bg-white/4',
        )}
        title={collapsed ? item.label : undefined}
        aria-current={isActive ? 'page' : undefined}
      >
        {opts?.iconNode ? (
          <span className={cn('shrink-0', isActive ? 'text-cyan-500' : 'text-white/45')}>{opts.iconNode}</span>
        ) : Icon ? (
          <Icon
            className={cn(
              'h-5 w-5 shrink-0 transition-colors',
              isActive ? 'text-cyan-600' : 'text-white/65 group-hover:text-white',
            )}
            strokeWidth={isActive ? 2.4 : 2}
            aria-hidden
          />
        ) : null}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              key={`label-${item.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex-1 text-left truncate"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
        {!collapsed && count !== null && count > 0 && (
          <span
            className={cn(
              'ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md',
              isActive ? 'bg-cyan-500/15 text-cyan-700' : 'bg-white/6 text-white/65',
            )}
          >
            {count}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside
      className={cn(
        'sticky top-0 h-screen shrink-0 bg-[#101115] border-r border-white/6',
        'transition-[width] duration-200 ease-out',
        width,
      )}
    >
      <div className="h-full flex flex-col p-3">
        {/* Brand */}
        <div className="flex items-center justify-between gap-2 px-2 h-12 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-10 w-10 rounded-xl grid place-items-center overflow-hidden shrink-0 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://i.postimg.cc/Y25qLcjD/Cadastra-%281%29.png"
                alt="cadastra.ai"
                className="h-full w-full object-contain"
                onError={(e) => {
                  const t = e.currentTarget
                  t.style.display = 'none'
                  const fb = t.nextElementSibling as HTMLElement | null
                  if (fb) fb.style.display = 'grid'
                }}
              />
              <span
                className="hidden absolute inset-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-sky-600 text-white font-bold text-sm"
                aria-hidden
              >
                C
              </span>
            </div>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.p
                  key="brand-text"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="text-sm font-bold tracking-tight truncate"
                >
                  cadastra<span className="text-cyan-400">.</span>ai
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="h-7 w-7 grid place-items-center rounded-md text-white/55 hover:text-white hover:bg-white/5 transition-colors shrink-0"
            aria-label={collapsed ? 'Expandir' : 'Recolher'}
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>

        {/* Switcher de empresa — sempre visível, mostra qual está ativa e permite criar mais. */}
        <div className="px-1 pb-2">
          <EmpresaSwitcher collapsed={collapsed} />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto pt-1">
          {items.map((item) => renderItem(item))}
          <div className="pt-3 mt-3 border-t border-white/6">
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">
                Avançado
              </p>
            )}
            {renderItem(
              { id: 'importar', label: 'Importar Planilha', iconUrl: '' },
              {
                iconNode: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12" />
                    <path d="m7 8 5-5 5 5" />
                    <path d="M5 21h14" />
                  </svg>
                ),
              },
            )}
            {renderItem(
              { id: 'importados', label: 'Importados', iconUrl: '' },
              {
                iconNode: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M7 12h10" />
                    <path d="M10 18h4" />
                  </svg>
                ),
              },
            )}
            {renderItem(
              { id: 'relatorios', label: 'Relatórios', iconUrl: '' },
              {
                iconNode: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="M7 14l4-4 4 4 5-7" />
                  </svg>
                ),
              },
            )}
            {renderItem(
              { id: 'painel', label: 'Painel unificado', iconUrl: '' },
              { iconNode: <Layers className="h-[18px] w-[18px]" /> },
            )}
            {renderItem(
              { id: 'logs', label: 'Logs / Auditoria', iconUrl: '' },
              { iconNode: <ScrollText className="h-[18px] w-[18px]" /> },
            )}
            {renderItem(
              { id: 'integracoes', label: 'Integrações', iconUrl: '' },
              { iconNode: <Plug2 className="h-[18px] w-[18px]" /> },
            )}
            {renderItem(
              { id: 'config', label: 'Configurações', iconUrl: '' },
              {
                iconNode: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                ),
              },
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="pt-3 mt-2 border-t border-white/6">
          <button
            onClick={() => onChange('perfil')}
            title={collapsed ? 'Ver perfil' : 'Ver detalhes do perfil'}
            aria-current={active === 'perfil' ? 'page' : undefined}
            className={cn(
              'group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-2xl hover:bg-white/[0.04] transition-colors text-left',
              active === 'perfil' && 'bg-white/[0.05]',
              collapsed && 'justify-center',
            )}
          >
            <AvatarCircle src={user?.avatarUrl} name={user?.name} email={user?.email} size={32} />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  key="user-info"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                    {user?.name || 'Usuário'}
                  </p>
                  <p className="text-[11px] text-white/55 truncate">{user?.email || 'demo@cadastra.ai'}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
          <button
            onClick={handleLogout}
            className={cn(
              'w-full flex items-center gap-2.5 rounded-2xl px-3 h-10 text-[13px]',
              'text-white/55 hover:text-rose-300 hover:bg-rose-500/6 transition-colors',
              collapsed && 'justify-center px-0',
            )}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="logout-label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  Sair
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>
    </aside>
  )
}


import { motion } from 'framer-motion'
import { ArrowLeft, type LucideIcon } from 'lucide-react'

interface CadastroFormShellProps {
  title: string
  description?: string
  icon: LucideIcon
  accent?: string
  onBack: () => void
  children: React.ReactNode
  hero?: React.ReactNode
}

export function CadastroFormShell({
  title,
  description,
  icon: Icon,
  onBack,
  children,
  hero,
}: CadastroFormShellProps) {
  return (
    <motion.div
      className="px-8 py-8 max-w-3xl mx-auto"
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

      {hero ?? (
        <div
          className="rounded-3xl p-7 mb-5 text-cyan-50"
          style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 60%, #075985 100%)' }}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/15 grid place-items-center backdrop-blur-sm">
              <Icon className="h-6 w-6 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-cyan-100/85 mb-1">Cadastro</p>
              <h1 className="text-[28px] font-bold tracking-tight leading-none">{title}</h1>
              {description && <p className="text-[13px] text-cyan-100/80 mt-2">{description}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] p-7">{children}</div>
    </motion.div>
  )
}

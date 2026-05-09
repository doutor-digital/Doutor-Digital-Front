
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail, Calendar, Clock, Shield, LogOut, Copy, Check } from 'lucide-react'
import { useAuth } from '@/contexts/cadastra/auth-context'
import { AvatarCircle } from '@/cadastra-ui/avatar-circle'
import { cn } from '@/lib/utils'

interface ProfileViewProps {
  onBack: () => void
  onLogout: () => void
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function relativeTime(iso?: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d} dia${d === 1 ? '' : 's'}`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `há ${mo} ${mo === 1 ? 'mês' : 'meses'}`
  const y = Math.floor(mo / 12)
  return `há ${y} ano${y === 1 ? '' : 's'}`
}

export function ProfileView({ onBack, onLogout }: ProfileViewProps) {
  const { user } = useAuth()
  const [copied, setCopied] = useState<'email' | 'id' | null>(null)

  const copy = async (value: string, kind: 'email' | 'id') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }

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
          className="group inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-[#15171b] border border-white/5 text-[13px] text-white/70 hover:text-white hover:border-white/12 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Voltar para Dashboard
        </button>
      </div>

      {/* Hero */}
      <div
        className="relative rounded-3xl px-7 pt-7 pb-16 text-cyan-50 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 60%, #075985 100%)' }}
      >
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/85 font-bold">
          Meu perfil
        </p>
        <h1 className="text-[30px] font-bold tracking-tight leading-tight text-white mt-1">
          {user?.name || 'Usuário'}
        </h1>
        <p className="text-[13px] text-cyan-100/85 mt-1">
          Informações da sua conta no cadastra.ai.
        </p>
      </div>

      {/* Avatar sobreposto */}
      <div className="relative -mt-12 px-7 mb-6">
        <div className="rounded-2xl bg-[#0c0d10] inline-block p-1.5 ring-2 ring-white/8">
          <AvatarCircle src={user?.avatarUrl} name={user?.name} email={user?.email} size={96} />
        </div>
      </div>

      {/* Detalhes */}
      <div className="rounded-3xl border border-white/5 bg-[#15171b] p-5 space-y-3">
        <DetailRow
          icon={<Mail className="h-4 w-4 text-cyan-400" />}
          label="E-mail"
          value={user?.email ?? '—'}
          actionIcon={
            copied === 'email' ? (
              <Check className="h-3.5 w-3.5 text-emerald-300" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-white/55" />
            )
          }
          actionTitle="Copiar e-mail"
          onAction={user?.email ? () => copy(user.email!, 'email') : undefined}
        />

        <DetailRow
          icon={<Shield className="h-4 w-4 text-cyan-400" />}
          label="Função"
          value={
            <span className="inline-flex items-center gap-1.5 px-2 h-5 rounded-md bg-cyan-500/15 border border-cyan-400/30 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
              {user?.role ?? 'usuário'}
            </span>
          }
        />

        <DetailRow
          icon={<Calendar className="h-4 w-4 text-cyan-400" />}
          label="Conta criada"
          value={
            <>
              {formatDateTime(user?.createdAt)}
              {user?.createdAt && (
                <span className="text-white/45 ml-2 text-[11px]">{relativeTime(user.createdAt)}</span>
              )}
            </>
          }
        />

        <DetailRow
          icon={<Clock className="h-4 w-4 text-cyan-400" />}
          label="Último login"
          value={
            user?.lastLoginAt ? (
              <>
                {formatDateTime(user.lastLoginAt)}
                <span className="text-white/45 ml-2 text-[11px]">{relativeTime(user.lastLoginAt)}</span>
              </>
            ) : (
              'sessão atual'
            )
          }
        />

        {user?.id && (
          <DetailRow
            icon={
              <span className="text-cyan-400 text-[11px] font-mono font-bold">ID</span>
            }
            label="Identificador"
            value={<span className="font-mono text-[12px] text-white/75">{user.id}</span>}
            actionIcon={
              copied === 'id' ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-white/55" />
              )
            }
            actionTitle="Copiar ID"
            onAction={() => copy(user.id!, 'id')}
          />
        )}
      </div>

      {/* Ação destrutiva */}
      <div className="mt-5 rounded-3xl border border-rose-400/15 bg-rose-500/4 p-5">
        <p className="text-[12px] uppercase tracking-wider text-rose-200/80 font-semibold mb-1">
          Sessão
        </p>
        <p className="text-[13px] text-white/70 mb-3">
          Encerre sua sessão atual neste dispositivo.
        </p>
        <button
          onClick={onLogout}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-rose-500/10 border border-rose-400/30 text-rose-300 text-[13px] font-semibold hover:bg-rose-500/18 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>
      </div>
    </motion.div>
  )
}

interface DetailRowProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  actionIcon?: React.ReactNode
  actionTitle?: string
  onAction?: () => void
}

function DetailRow({ icon, label, value, actionIcon, actionTitle, onAction }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-[#0c0d10] px-3 py-2.5">
      <div className="h-8 w-8 grid place-items-center rounded-lg bg-cyan-500/10 border border-cyan-400/20 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">{label}</p>
        <div className="text-[13px] text-white/90 mt-0.5 break-all">{value}</div>
      </div>
      {onAction && (
        <button
          onClick={onAction}
          title={actionTitle}
          className={cn(
            'h-8 w-8 grid place-items-center rounded-lg shrink-0 transition-colors',
            'hover:bg-white/6',
          )}
        >
          {actionIcon}
        </button>
      )}
    </div>
  )
}

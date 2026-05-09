
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  UserPlus,
  Trash2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Users,
  Clock,
  Send,
  ImagePlus,
  ImageOff,
} from 'lucide-react'
import {
  empresasApi,
  resolveAssetUrl,
  isNetworkError,
  type EmpresaDto,
  type MemberDto,
  type InviteDto,
  type MembershipRole,
  type InviteStatus,
} from '@/lib/cadastra/api'
import { cn } from '@/lib/utils'
import { AvatarCircle } from '@/cadastra-ui/avatar-circle'
import { MotivosNaoFechamentoSection } from './motivos-nao-fechamento'

interface EmpresaViewProps {
  onBack: () => void
}

function roleLabel(role: MembershipRole): string {
  if (role === 'Owner' || role === 0) return 'Dono'
  if (role === 'Admin' || role === 1) return 'Admin'
  return 'Membro'
}

function statusLabel(status: InviteStatus): { text: string; tone: 'pending' | 'accepted' | 'revoked' | 'expired' } {
  if (status === 'Pending' || status === 0) return { text: 'Pendente', tone: 'pending' }
  if (status === 'Accepted' || status === 1) return { text: 'Aceito', tone: 'accepted' }
  if (status === 'Revoked' || status === 2) return { text: 'Revogado', tone: 'revoked' }
  return { text: 'Expirado', tone: 'expired' }
}

export function EmpresaView({ onBack }: EmpresaViewProps) {
  const [empresas, setEmpresas] = useState<EmpresaDto[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberDto[]>([])
  const [invites, setInvites] = useState<InviteDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MembershipRole>('Member')
  const [inviting, setInviting] = useState(false)
  const [inviteToast, setInviteToast] = useState<{ kind: 'success' | 'warn'; msg: string } | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = useMemo(() => empresas.find((e) => e.id === activeId) ?? null, [empresas, activeId])

  const loadEmpresas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await empresasApi.list()
      const hydrated = list.map((e) => {
        if (e.logoUrl) return e
        if (typeof window === 'undefined') return e
        const local = window.localStorage.getItem(`empresa_logo_${e.id}`)
        return local ? { ...e, logoUrl: local } : e
      })
      setEmpresas(hydrated)
      if (hydrated.length > 0) {
        setActiveId((current) => (current && hydrated.some((e) => e.id === current) ? current : hydrated[0].id))
      } else {
        setActiveId(null)
      }
    } catch (err) {
      if (isNetworkError(err)) {
        setError('Backend offline — algumas funções da empresa ficam indisponíveis. A logo pode ser salva localmente.')
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao carregar empresas')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const loadActiveDetails = useCallback(async (id: string) => {
    try {
      const [m, inv] = await Promise.all([empresasApi.members(id), empresasApi.invites(id)])
      setMembers(m)
      setInvites(inv)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar detalhes')
    }
  }, [])

  useEffect(() => {
    void loadEmpresas()
  }, [loadEmpresas])

  useEffect(() => {
    if (activeId) void loadActiveDetails(activeId)
  }, [activeId, loadActiveDetails])

  const flashToast = (msg: string, kind: 'success' | 'warn' = 'success') => {
    setInviteToast({ kind, msg })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    const ttl = kind === 'warn' ? 12000 : 4500
    toastTimer.current = setTimeout(() => setInviteToast(null), ttl)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!active) return
    setInviting(true)
    setError(null)
    try {
      const invite = await empresasApi.invite(active.id, { email: inviteEmail.trim(), role: inviteRole })
      setInviteEmail('')
      if (invite.emailDelivered === false) {
        const reason = invite.emailError ?? 'O e-mail não foi entregue.'
        flashToast(`Convite criado para ${invite.email}, mas o e-mail não foi enviado. ${reason} Copie o link manualmente abaixo.`, 'warn')
        // copy URL automatically as a courtesy
        try {
          await navigator.clipboard.writeText(invite.inviteUrl)
          setCopiedToken(invite.token)
          setTimeout(() => setCopiedToken((cur) => (cur === invite.token ? null : cur)), 2200)
        } catch {
          // clipboard might be unavailable; user will use the Copy button on the invite list
        }
      } else if (invite.emailDelivered === true) {
        flashToast(`Convite enviado por e-mail para ${invite.email}.`)
      } else {
        flashToast(`Convite criado para ${invite.email}. Compartilhe o link com a pessoa.`)
      }
      await loadActiveDetails(active.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar convite')
    } finally {
      setInviting(false)
    }
  }

  const handleCopy = async (invite: InviteDto) => {
    try {
      await navigator.clipboard.writeText(invite.inviteUrl)
      setCopiedToken(invite.token)
      setTimeout(() => setCopiedToken((cur) => (cur === invite.token ? null : cur)), 2200)
    } catch {
      flashToast('Não foi possível copiar — selecione o link manualmente.')
    }
  }

  const handleRevokeInvite = async (invite: InviteDto) => {
    if (!active) return
    if (!confirm(`Revogar convite de ${invite.email}?`)) return
    try {
      await empresasApi.revokeInvite(active.id, invite.id)
      await loadActiveDetails(active.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao revogar convite')
    }
  }

  const handleRemoveMember = async (member: MemberDto) => {
    if (!active) return
    if (!confirm(`Remover ${member.name} da empresa?`)) return
    try {
      await empresasApi.removeMember(active.id, member.userId)
      await loadActiveDetails(active.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover membro')
    }
  }

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(reader.error ?? new Error('read error'))
      reader.readAsDataURL(file)
    })

  const handleLogoUpload = async (file: File) => {
    if (!active) return
    setError(null)
    setLogoUploading(true)

    // Validate locally first so we can short-circuit before hitting the network.
    if (file.size > 5 * 1024 * 1024) {
      setError('Arquivo excede o tamanho máximo de 5MB.')
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    const allowed = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowed.includes(file.type)) {
      setError('Formato não suportado. Use PNG, JPG ou WEBP.')
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    try {
      const updated = await empresasApi.uploadLogo(active.id, file)
      setEmpresas((cur) => cur.map((e) => (e.id === updated.id ? updated : e)))
      flashToast('Logo atualizada.')
    } catch (err) {
      if (isNetworkError(err)) {
        // Backend offline — store the logo as a data URL locally so the UI keeps working.
        try {
          const dataUrl = await fileToDataUrl(file)
          setEmpresas((cur) => cur.map((e) => (e.id === active.id ? { ...e, logoUrl: dataUrl } : e)))
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(`empresa_logo_${active.id}`, dataUrl)
          }
          flashToast('Logo salva localmente (backend offline).')
        } catch {
          setError('Não foi possível ler a imagem.')
        }
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao enviar logo')
      }
    } finally {
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleLogoRemove = async () => {
    if (!active || !active.logoUrl) return
    if (!confirm('Remover a logo da empresa?')) return
    setError(null)
    try {
      await empresasApi.removeLogo(active.id)
      setEmpresas((cur) => cur.map((e) => (e.id === active.id ? { ...e, logoUrl: null } : e)))
    } catch (err) {
      if (isNetworkError(err)) {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(`empresa_logo_${active.id}`)
        }
        setEmpresas((cur) => cur.map((e) => (e.id === active.id ? { ...e, logoUrl: null } : e)))
        flashToast('Logo removida localmente.')
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao remover logo')
      }
    }
  }

  const canEdit = active
    ? active.myRole === 'Owner' || active.myRole === 0 || active.myRole === 'Admin' || active.myRole === 1
    : false

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

      {loading ? (
        <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] py-20 grid place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
        </div>
      ) : empresas.length === 0 ? (
        <div className="rounded-3xl bg-[#15171b] border border-dashed border-white/[0.08] px-6 py-16 text-center">
          <Building2 className="h-8 w-8 text-cyan-400 mx-auto mb-3" />
          <p className="text-base text-white/85 font-medium mb-1">Nenhuma empresa cadastrada</p>
          <p className="text-sm text-white/55">
            Use a página inicial após o login para cadastrar sua empresa.
          </p>
        </div>
      ) : active ? (
        <>
          {/* Hero da empresa */}
          <div
            className="rounded-3xl p-7 mb-5 text-cyan-50"
            style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 60%, #075985 100%)' }}
          >
            <div className="flex items-start gap-5 flex-wrap">
              <LogoSlot
                logoUrl={active.logoUrl}
                nome={active.nome}
                canEdit={canEdit}
                uploading={logoUploading}
                onPick={() => fileInputRef.current?.click()}
                onRemove={handleLogoRemove}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleLogoUpload(file)
                }}
              />
              <div className="flex-1 min-w-[200px]">
                <p className="text-[12px] uppercase tracking-[0.2em] text-cyan-100/85 mb-1">Empresa Ativa</p>
                <h2 className="text-[28px] font-bold tracking-tight leading-none">{active.nome}</h2>
                <p className="text-[13px] text-cyan-100/85 mt-2">
                  {active.tipo ? `${active.tipo} · ` : ''}Dono: {active.ownerName} · {active.memberCount} {active.memberCount === 1 ? 'membro' : 'membros'}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm text-white self-start">
                Você é {roleLabel(active.myRole)}
              </span>
            </div>
          </div>

          {/* Empresas selector (only if multiple) */}
          {empresas.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {empresas.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setActiveId(e.id)}
                  className={cn(
                    'px-3 h-9 rounded-xl text-[13px] font-medium transition-colors',
                    activeId === e.id
                      ? 'bg-white text-slate-900'
                      : 'bg-[#15171b] border border-white/[0.05] text-white/65 hover:text-white',
                  )}
                >
                  {e.nome}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-400/30 text-rose-200 text-sm mb-5">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bento grid: Convite (col 3) + Convites pendentes (col 2) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
            <div className="lg:col-span-3 rounded-3xl bg-[#15171b] border border-white/[0.05] p-6">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="h-4 w-4 text-cyan-400" />
                <h3 className="text-[14px] font-semibold">Convidar pessoa</h3>
              </div>
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-white/65 mb-1.5">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="secretaria@empresa.com"
                      className="w-full pl-10 pr-3 h-12 rounded-2xl bg-[#0c0d10] border border-white/[0.05] text-[14px] placeholder:text-white/30 focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-white/45 mt-1.5">
                    Vamos enviar um link para a pessoa criar a conta automaticamente.
                  </p>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-white/65 mb-2">Permissão</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <RoleCard
                      active={inviteRole === 'Member' || inviteRole === 2}
                      onClick={() => setInviteRole('Member')}
                      title="Membro"
                      bullets={['Cadastrar Lead/Consulta/Tratamento', 'Ver dashboard']}
                    />
                    <RoleCard
                      active={inviteRole === 'Admin' || inviteRole === 1}
                      onClick={() => setInviteRole('Admin')}
                      title="Administrador"
                      bullets={['Tudo de Membro', 'Convidar e remover pessoas']}
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={inviting}
                    className={cn(
                      'h-11 px-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-semibold text-[13px] inline-flex items-center gap-2 transition-colors',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar convite
                  </button>
                </div>
              </form>

              <AnimatePresence>
                {inviteToast && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className={cn(
                      'mt-3 flex items-start gap-2 p-3 rounded-2xl border text-sm',
                      inviteToast.kind === 'success'
                        ? 'bg-cyan-500/10 border-cyan-400/30 text-cyan-200'
                        : 'bg-amber-500/10 border-amber-400/35 text-amber-100',
                    )}
                  >
                    {inviteToast.kind === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-cyan-300" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-300" />
                    )}
                    <span>{inviteToast.msg}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="lg:col-span-2 rounded-3xl bg-[#15171b] border border-white/[0.05] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-[14px] font-semibold">Convites</h3>
                </div>
                <span className="text-[11px] text-white/45 tabular-nums">{invites.length}</span>
              </div>
              {invites.length === 0 ? (
                <p className="text-[13px] text-white/45">Nenhum convite ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {invites.slice(0, 5).map((inv) => {
                    const s = statusLabel(inv.status)
                    return (
                      <li
                        key={inv.id}
                        className="rounded-2xl bg-[#0c0d10] border border-white/[0.05] p-3"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[13px] text-white truncate">{inv.email}</p>
                          <span
                            className={cn(
                              'px-2 h-5 rounded-md text-[10px] font-semibold uppercase tracking-wider',
                              s.tone === 'pending' && 'bg-cyan-500/10 text-cyan-300 border border-cyan-400/20',
                              s.tone === 'accepted' && 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20',
                              s.tone === 'revoked' && 'bg-white/[0.04] text-white/55 border border-white/[0.06]',
                              s.tone === 'expired' && 'bg-amber-500/10 text-amber-300 border border-amber-400/20',
                            )}
                          >
                            {s.text}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/45 mb-2">
                          {roleLabel(inv.role)} · expira {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}
                        </p>
                        {s.tone === 'pending' && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleCopy(inv)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12px] bg-cyan-500/[0.08] border border-cyan-400/20 text-cyan-300 hover:bg-cyan-500/[0.15] transition-colors"
                            >
                              {copiedToken === inv.token ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Copiado
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  Copiar link
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleRevokeInvite(inv)}
                              className="h-8 w-8 grid place-items-center rounded-lg text-white/55 hover:text-rose-300 hover:bg-rose-500/[0.07] transition-colors"
                              title="Revogar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Motivos de não fechamento (semáforo) */}
          <MotivosNaoFechamentoSection empresaId={active.id} canEdit={canEdit} />

          {/* Members table */}
          <div className="rounded-3xl bg-[#15171b] border border-white/[0.05] overflow-hidden mt-5">
            <div className="px-6 h-14 flex items-center justify-between border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-400" />
                <h3 className="text-[14px] font-semibold">Membros</h3>
              </div>
              <span className="text-[12px] text-white/55">{members.length} pessoas</span>
            </div>
            {members.length === 0 ? (
              <p className="text-[13px] text-white/45 px-6 py-12 text-center">Nenhum membro carregado.</p>
            ) : (
              <ul>
                {members.map((u, i) => (
                  <li
                    key={u.userId}
                    className={cn(
                      'flex items-center gap-3 px-6 h-14',
                      i < members.length - 1 && 'border-b border-white/[0.04]',
                    )}
                  >
                    <AvatarCircle src={u.avatarUrl} name={u.name} email={u.email} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium truncate">{u.name}</p>
                      <p className="text-[12px] text-white/55 truncate">{u.email}</p>
                    </div>
                    <span className="px-2 h-6 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-400/20">
                      {roleLabel(u.role)}
                    </span>
                    {canEdit && !(u.role === 'Owner' || u.role === 0) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(u)}
                        className="h-8 w-8 grid place-items-center rounded-lg text-white/55 hover:text-rose-300 hover:bg-rose-500/[0.07] transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </motion.div>
  )
}

interface LogoSlotProps {
  logoUrl?: string | null
  nome: string
  canEdit: boolean
  uploading: boolean
  onPick: () => void
  onRemove: () => void
}

function LogoSlot({ logoUrl, nome, canEdit, uploading, onPick, onRemove }: LogoSlotProps) {
  const url = resolveAssetUrl(logoUrl)
  return (
    <div className="shrink-0">
      <div
        className="relative h-32 w-32 md:h-36 md:w-36 rounded-3xl overflow-hidden grid place-items-center"
        style={{
          background: url ? 'rgba(8, 47, 73, 0.55)' : 'rgba(8, 47, 73, 0.45)',
          boxShadow: '0 18px 48px -16px rgba(8, 47, 73, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.18)',
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Logo ${nome}`} className="h-full w-full object-contain p-3" />
        ) : (
          <div className="text-center">
            <Building2 className="h-12 w-12 text-white/90 mx-auto" strokeWidth={1.6} />
            <p className="text-[10px] text-white/70 mt-1 uppercase tracking-wider">sem logo</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-sm">
            <Loader2 className="h-7 w-7 animate-spin text-white" />
          </div>
        )}
      </div>
      {canEdit && (
        <div className="mt-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPick}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-xl text-[12px] font-semibold bg-white text-cyan-700 hover:bg-cyan-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {url ? 'Trocar' : 'Adicionar logo'}
          </button>
          {url && (
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              className="h-8 w-8 grid place-items-center rounded-xl bg-white/15 backdrop-blur-sm hover:bg-rose-500/40 text-white transition-colors disabled:opacity-50"
              title="Remover"
            >
              <ImageOff className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface RoleCardProps {
  active: boolean
  onClick: () => void
  title: string
  bullets: string[]
}

function RoleCard({ active, onClick, title, bullets }: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'text-left rounded-2xl px-4 py-3 border transition-colors',
        active
          ? 'border-cyan-400/55 bg-cyan-400/[0.08]'
          : 'border-white/[0.05] bg-[#0c0d10] hover:border-white/[0.12]',
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[14px] font-semibold">{title}</p>
        <span
          className={cn(
            'h-3.5 w-3.5 rounded-full border',
            active ? 'border-cyan-300 bg-cyan-400' : 'border-white/20',
          )}
          aria-hidden
        />
      </div>
      <ul className="space-y-0.5">
        {bullets.map((b) => (
          <li key={b} className="text-[11px] text-white/55 flex items-start gap-1.5">
            <span className={cn('mt-1 h-1 w-1 rounded-full shrink-0', active ? 'bg-cyan-400' : 'bg-white/30')} />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </button>
  )
}


import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Building2 } from "@/components/icons"
import { invitesApi, type InvitePreviewDto } from '@/lib/cadastra/api'
import { useAuth } from '@/contexts/cadastra/auth-context'
import { useGoogleAuth } from '@/hooks/cadastra/use-google-auth'
import { cn } from '@/lib/utils'

interface AcceptInviteViewProps {
  token: string
}

function statusLabel(status: InvitePreviewDto['status']): { msg: string; ok: boolean } {
  if (status === 'Pending' || status === 0) return { msg: 'Convite válido.', ok: true }
  if (status === 'Accepted' || status === 1) return { msg: 'Este convite já foi aceito.', ok: false }
  if (status === 'Revoked' || status === 2) return { msg: 'Este convite foi revogado.', ok: false }
  return { msg: 'Este convite expirou.', ok: false }
}

export function AcceptInviteView({ token }: AcceptInviteViewProps) {
  const navigate = useNavigate()
  const { applyAuthResponse } = useAuth()

  const [preview, setPreview] = useState<InvitePreviewDto | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const googleBtnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    invitesApi
      .preview(token)
      .then((p) => {
        if (cancelled) return
        setPreview(p)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Convite não encontrado.')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      setSubmitError('')
      setIsSubmitting(true)
      try {
        const auth = await invitesApi.acceptWithGoogle(token, idToken)
        applyAuthResponse(auth)
        navigate('/cadastro')
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Erro ao aceitar convite com Google')
      } finally {
        setIsSubmitting(false)
      }
    },
    [applyAuthResponse, navigate, token],
  )

  const google = useGoogleAuth({ onCredential: handleGoogleCredential })

  useEffect(() => {
    if (google.ready && googleBtnRef.current && preview && (preview.status === 'Pending' || preview.status === 0)) {
      google.renderButton(googleBtnRef.current, { theme: 'filled_black', text: 'continue_with' })
    }
  }, [google, preview])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    setIsSubmitting(true)
    try {
      const auth = await invitesApi.acceptWithPassword(token, { name: name.trim(), password })
      applyAuthResponse(auth)
      navigate('/cadastro')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao aceitar convite')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <Shell>
        <div className="rounded-2xl p-7 border border-rose-400/30 bg-rose-500/5 backdrop-blur-xl text-center">
          <AlertCircle className="h-8 w-8 text-rose-300 mx-auto mb-3" />
          <p className="text-slate-100 font-semibold mb-1">Convite indisponível</p>
          <p className="text-sm text-rose-200/80">{loadError}</p>
          <Link to="/cadastro/login" className="mt-5 inline-block text-cyan-300 hover:text-cyan-200">
            Ir para o login
          </Link>
        </div>
      </Shell>
    )
  }

  if (!preview) {
    return (
      <Shell>
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
        </div>
      </Shell>
    )
  }

  const status = statusLabel(preview.status)

  if (!status.ok) {
    return (
      <Shell>
        <div className="rounded-2xl p-7 border border-amber-400/25 bg-amber-500/5 backdrop-blur-xl text-center">
          <AlertCircle className="h-8 w-8 text-amber-300 mx-auto mb-3" />
          <p className="text-slate-100 font-semibold mb-1">{status.msg}</p>
          <p className="text-sm text-amber-200/80">
            Peça à sua empresa <span className="font-medium">{preview.empresaNome}</span> para gerar um novo convite.
          </p>
          <Link to="/cadastro/login" className="mt-5 inline-block text-cyan-300 hover:text-cyan-200">
            Ir para o login
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="text-center mb-6">
        <div
          className="mx-auto mb-4 h-12 w-12 grid place-items-center rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #22d3ee, #38bdf8)',
            boxShadow: '0 0 30px rgba(34,211,238,0.45)',
          }}
        >
          <Building2 className="h-6 w-6 text-[#081420]" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight mb-2">
          Você foi convidado
        </h1>
        <p className="text-cyan-100/70 text-sm">
          Para participar de{' '}
          <span className="text-cyan-200 font-semibold">{preview.empresaNome}</span> como{' '}
          <span className="text-cyan-200 font-semibold">
            {String(preview.role).toLowerCase()}
          </span>
          .
        </p>
        <p className="text-xs text-cyan-100/50 mt-2">
          Convite enviado para <span className="text-cyan-200">{preview.email}</span>
        </p>
      </div>

      <div className="rounded-2xl p-7 border border-cyan-400/15 bg-[#0d1c2a]/85 backdrop-blur-xl shadow-[0_28px_60px_-30px_rgba(0,0,0,0.6)]">
        {google.isConfigured && (
          <>
            <div className="relative">
              <div ref={googleBtnRef} className={cn(isSubmitting && 'pointer-events-none opacity-60')} />
              {!google.ready && (
                <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 border border-cyan-400/10 text-cyan-100/60 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando Google…
                </div>
              )}
            </div>
            <div className="flex items-center my-6">
              <div className="flex-1 h-px bg-cyan-400/15" />
              <span className="px-4 text-xs uppercase tracking-[0.2em] text-cyan-100/50">ou crie uma senha</span>
              <div className="flex-1 h-px bg-cyan-400/15" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-400/30 text-rose-200 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {!preview.existingUser && (
            <div>
              <label htmlFor="name" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-100/60 mb-2">
                Seu nome
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como você quer aparecer?"
                required={!preview.existingUser}
                minLength={2}
                className="w-full px-4 py-3 rounded-lg bg-[#0b1e2c]/70 border border-cyan-400/15 text-slate-100 placeholder:text-cyan-100/30 focus:outline-none focus:border-cyan-400/55 focus:ring-2 focus:ring-cyan-400/20 transition-all"
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-100/60 mb-2">
              {preview.existingUser ? 'Sua senha' : 'Crie uma senha'}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                className="w-full px-4 py-3 pr-12 rounded-lg bg-[#0b1e2c]/70 border border-cyan-400/15 text-slate-100 placeholder:text-cyan-100/30 focus:outline-none focus:border-cyan-400/55 focus:ring-2 focus:ring-cyan-400/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-100/50 hover:text-cyan-100 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {preview.existingUser && (
              <p className="text-[11px] text-cyan-100/50 mt-1.5">
                Já existe uma conta com esse e-mail. Use sua senha atual para entrar e aceitar o convite.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'w-full py-3 rounded-lg font-semibold transition-all',
              'bg-gradient-to-r from-cyan-400 to-sky-500 text-[#081420]',
              'hover:from-cyan-300 hover:to-sky-400 shadow-[0_0_30px_-8px_rgba(34,211,238,0.6)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2',
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Aceitando convite…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                Aceitar e entrar
              </>
            )}
          </button>
        </form>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#091420] via-[#0d2236] to-[#0a3450] p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}

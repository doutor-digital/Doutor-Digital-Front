
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/cadastra/auth-context'
import { useGoogleAuth } from '@/hooks/cadastra/use-google-auth'
import { cn } from '@/lib/utils'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const googleBtnRef = useRef<HTMLDivElement>(null)

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      setError('')
      setIsGoogleLoading(true)
      const response = await loginWithGoogle({ idToken })
      setIsGoogleLoading(false)
      if (response.success) navigate('/cadastro/empresa/criar')
      else setError(response.error || 'Erro ao fazer login com Google')
    },
    [loginWithGoogle, navigate],
  )

  const google = useGoogleAuth({ onCredential: handleGoogleCredential })

  useEffect(() => {
    if (google.ready && googleBtnRef.current) {
      google.renderButton(googleBtnRef.current, { theme: 'filled_black', text: 'continue_with' })
    }
  }, [google])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const response = await login(email, password)
    setIsLoading(false)
    if (response.success) navigate('/cadastro/empresa/criar')
    else setError(response.error || 'Erro ao fazer login')
  }

  return (
    <div className="min-h-screen bg-[#0c0d10] text-white grid grid-cols-1 lg:grid-cols-2 font-sans">
      {/* Hero */}
      <aside
        className="relative hidden lg:flex flex-col justify-between p-12 text-cyan-50 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 60%, #075985 100%)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-white grid place-items-center p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://i.postimg.cc/Y25qLcjD/Cadastra-%281%29.png"
              alt="cadastra.ai"
              className="h-full w-full object-contain"
            />
          </div>
          <span className="text-base font-bold tracking-tight">cadastra.ai</span>
        </div>

        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-cyan-100/85 mb-3">Trauma OS · v1</p>
          <h1 className="text-[64px] font-bold leading-[0.95] tracking-tight">
            Cadastre.<br />
            Atenda.<br />
            Cresça.
          </h1>
          <p className="mt-6 text-[16px] text-cyan-100/85 max-w-sm">
            Sistema de cadastro completo para clínicas e consultórios. Tudo num só painel.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { n: '247', l: 'leads/mês' },
            { n: '84', l: 'tratamentos' },
            { n: 'R$ 124k', l: 'receita' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-cyan-100/10 border border-cyan-100/20 p-3">
              <p className="text-[20px] font-bold tabular-nums">{s.n}</p>
              <p className="text-[10px] uppercase tracking-wider text-cyan-100/75">{s.l}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 rounded-xl bg-white grid place-items-center p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://i.postimg.cc/Y25qLcjD/Cadastra-%281%29.png"
                alt="cadastra.ai"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="text-base font-bold">cadastra<span className="text-cyan-400">.</span>ai</span>
          </div>

          <h2 className="text-[36px] font-bold tracking-tight leading-none mb-2">Entrar</h2>
          <p className="text-[14px] text-white/55 mb-7">Acesse seu painel.</p>

          {google.isConfigured ? (
            <div className="relative">
              <div ref={googleBtnRef} className={cn(isGoogleLoading && 'pointer-events-none opacity-60')} />
              {!google.ready && (
                <div className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-[#15171b] border border-white/[0.05] text-white/55 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando Google…
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setError('Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID e o backend para usar Google.')}
              className="w-full h-12 rounded-2xl bg-[#15171b] border border-white/[0.05] text-[14px] hover:bg-[#1a1c20] transition-colors mb-3"
            >
              Continuar com Google
            </button>
          )}

          <div className="flex items-center my-5">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="px-3 text-[11px] text-white/45 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-400/30 text-rose-200 text-sm">
                {error}
              </div>
            )}

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full h-12 px-4 rounded-2xl bg-[#15171b] border border-white/[0.05] text-[14px] placeholder:text-white/35 focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 transition-colors"
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                required
                className="w-full h-12 px-4 pr-12 rounded-2xl bg-[#15171b] border border-white/[0.05] text-[14px] placeholder:text-white/35 focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-white/55">
                <input type="checkbox" className="w-4 h-4 rounded border-white/15 bg-[#15171b] text-cyan-400 focus:ring-cyan-400/50" />
                Lembrar-me
              </label>
              <Link to="/cadastro/signup" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                Criar conta
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full h-12 rounded-2xl font-semibold transition-colors text-[14px] mt-2',
                'bg-cyan-400 hover:bg-cyan-300 text-slate-900',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2',
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Entrando…
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-white/55 mt-6">
            Não tem conta?{' '}
            <Link to="/cadastro/signup" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              Cadastre-se
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}


import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/cadastra/auth-context'
import { useGoogleAuth } from '@/hooks/cadastra/use-google-auth'
import { cn } from '@/lib/utils'

export function RegisterForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const googleBtnRef = useRef<HTMLDivElement>(null)

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      setError('')
      const response = await loginWithGoogle({ idToken })
      if (response.success) navigate('/cadastro/empresa/criar')
      else setError(response.error || 'Erro ao cadastrar com Google')
    },
    [loginWithGoogle, navigate],
  )

  const google = useGoogleAuth({ onCredential: handleGoogleCredential })

  useEffect(() => {
    if (google.ready && googleBtnRef.current) {
      google.renderButton(googleBtnRef.current, { theme: 'filled_black', text: 'signup_with' })
    }
  }, [google])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const response = await register(email, password, name)
    setIsLoading(false)
    if (response.success) navigate('/cadastro/empresa/criar')
    else setError(response.error || 'Erro ao criar a conta')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#091420] via-[#0d2236] to-[#0a3450] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-50 mb-2 tracking-tight" style={{ textShadow: '0 0 28px rgba(56,189,248,0.25)' }}>
            Criar conta
          </h1>
          <p className="text-cyan-100/60 text-sm">
            Crie sua conta no <span className="text-cyan-300">cadastra.ai</span> — em seguida você cadastra sua empresa.
          </p>
        </div>

        <div className="rounded-2xl p-7 border border-cyan-400/15 bg-[#0d1c2a]/85 backdrop-blur-xl shadow-[0_28px_60px_-30px_rgba(0,0,0,0.6)]">
          {google.isConfigured && (
            <>
              <div className="relative">
                <div ref={googleBtnRef} />
                {!google.ready && (
                  <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 border border-cyan-400/10 text-cyan-100/60 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando Google…
                  </div>
                )}
              </div>
              <div className="flex items-center my-6">
                <div className="flex-1 h-px bg-cyan-400/15" />
                <span className="px-4 text-xs uppercase tracking-[0.2em] text-cyan-100/50">ou</span>
                <div className="flex-1 h-px bg-cyan-400/15" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-400/30 text-rose-200 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-100/60 mb-2">
                Nome
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                required
                minLength={2}
                className="w-full px-4 py-3 rounded-lg bg-[#0b1e2c]/70 border border-cyan-400/15 text-slate-100 placeholder:text-cyan-100/30 focus:outline-none focus:border-cyan-400/55 focus:ring-2 focus:ring-cyan-400/20 transition-all"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-100/60 mb-2">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-4 py-3 rounded-lg bg-[#0b1e2c]/70 border border-cyan-400/15 text-slate-100 placeholder:text-cyan-100/30 focus:outline-none focus:border-cyan-400/55 focus:ring-2 focus:ring-cyan-400/20 transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-100/60 mb-2">
                Senha
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
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full py-3 rounded-lg font-semibold transition-all',
                'bg-gradient-to-r from-cyan-400 to-sky-500 text-[#081420]',
                'hover:from-cyan-300 hover:to-sky-400 shadow-[0_0_30px_-8px_rgba(34,211,238,0.6)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2',
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Criando conta…
                </>
              ) : (
                'Criar conta'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-cyan-100/55 mt-6">
          Já tem conta?{' '}
          <Link to="/cadastro/login" className="text-cyan-300 hover:text-cyan-200 transition-colors">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}


import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Building2, ArrowRight, ArrowLeft } from "@/components/icons"
import { useAuth } from '@/contexts/cadastra/auth-context'
import { useEmpresa } from '@/contexts/cadastra/empresa-context'
import { empresasApi } from '@/lib/cadastra/api'
import { cn } from '@/lib/utils'

export function CreateEmpresaForm() {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { user, isLoading: authLoading } = useAuth()
  const { empresas, refresh, setCurrentEmpresaId, isLoading: empresasLoading } = useEmpresa()
  const navigate = useNavigate()

  // Apenas redireciona não-autenticado. Usuário com empresas pode criar mais
  // (multi-tenant: o mesmo dono pode ter Clínica A, B, C).
  useEffect(() => {
    if (authLoading) return
    if (!user) navigate('/cadastro/login')
  }, [authLoading, user, navigate])

  const hasOtherEmpresas = empresas.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const created = await empresasApi.create({
        nome: nome.trim(),
        tipo: tipo.trim() || undefined,
      })
      // Atualiza o contexto e ativa a empresa recém-criada para o usuário
      // já cair logado nela.
      await refresh()
      setCurrentEmpresaId(created.id)
      navigate('/dashboard?view=empresa')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar empresa')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || empresasLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[#091420] via-[#0d2236] to-[#0a3450]">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#091420] via-[#0d2236] to-[#0a3450] p-4">
      <div className="w-full max-w-lg">
        {hasOtherEmpresas && (
          <button
            onClick={() => navigate('/cadastro')}
            className="flex items-center gap-2 text-sm text-cyan-100/60 hover:text-cyan-100 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o dashboard
          </button>
        )}
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 h-12 w-12 grid place-items-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #22d3ee, #38bdf8)',
              boxShadow: '0 0 30px rgba(34,211,238,0.45)',
            }}
          >
            <Building2 className="h-6 w-6 text-[#081420]" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold text-slate-50 mb-2 tracking-tight">
            {hasOtherEmpresas ? 'Nova empresa' : 'Cadastrar empresa'}
          </h1>
          <p className="text-cyan-100/60 text-sm">
            {hasOtherEmpresas
              ? `Você já tem ${empresas.length === 1 ? '1 empresa' : `${empresas.length} empresas`}. Cada uma fica com seus dados isolados — leads, integrações e equipe separados.`
              : `Esse é seu próximo passo, ${user?.name?.split(' ')[0] ?? 'usuário'}. Vamos vincular sua conta a uma empresa.`}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-7 border border-cyan-400/15 bg-[#0d1c2a]/85 backdrop-blur-xl shadow-[0_28px_60px_-30px_rgba(0,0,0,0.6)] space-y-5"
        >
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-400/30 text-rose-200 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="nome" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-100/60 mb-2">
              Nome da empresa
            </label>
            <input
              id="nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Instituto Trauma"
              required
              minLength={2}
              className="w-full px-4 py-3 rounded-lg bg-[#0b1e2c]/70 border border-cyan-400/15 text-slate-100 placeholder:text-cyan-100/30 focus:outline-none focus:border-cyan-400/55 focus:ring-2 focus:ring-cyan-400/20 transition-all"
            />
          </div>

          <div>
            <label htmlFor="tipo" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-100/60 mb-2">
              Tipo (opcional)
            </label>
            <input
              id="tipo"
              type="text"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="Clínica, Consultório, Instituto…"
              className="w-full px-4 py-3 rounded-lg bg-[#0b1e2c]/70 border border-cyan-400/15 text-slate-100 placeholder:text-cyan-100/30 focus:outline-none focus:border-cyan-400/55 focus:ring-2 focus:ring-cyan-400/20 transition-all"
            />
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
                Criando empresa…
              </>
            ) : (
              <>
                Cadastrar empresa
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

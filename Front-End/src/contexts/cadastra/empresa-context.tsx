
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { empresasApi, type EmpresaDto } from '@/lib/cadastra/api'
import { useAuth } from '@/contexts/cadastra/auth-context'

// Contexto global de empresa ativa.
// O usuário pode pertencer a várias empresas (multi-tenant). Aqui ficam:
//   - lista completa
//   - empresa atualmente ativa (persistida em localStorage)
//   - ações para trocar e recarregar
//
// Todas as views devem ler `currentEmpresa` daqui em vez de chamar `empresasApi.list()`.
// O backend isola dados por TenantId no JWT — este contexto só decide qual
// `empresaId` é usado nos endpoints scopados (`/api/empresas/{empresaId}/...`).

const STORAGE_KEY = 'cadastraai_current_empresa_id'

interface EmpresaContextType {
  empresas: EmpresaDto[]
  currentEmpresa: EmpresaDto | null
  isLoading: boolean
  error: string | null
  // Troca a empresa ativa. Persiste no localStorage para sobreviver a reload.
  setCurrentEmpresaId: (id: string) => void
  // Refaz GET /api/empresas — útil após criar uma empresa nova ou aceitar convite.
  refresh: () => Promise<void>
  // Atualiza uma empresa específica no estado local (após edição: nome, logo).
  updateEmpresa: (empresa: EmpresaDto) => void
  // Remove do estado local sem nova chamada de API.
  removeEmpresa: (empresaId: string) => void
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined)

function readStoredId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(STORAGE_KEY)
}

function writeStoredId(id: string | null) {
  if (typeof window === 'undefined') return
  if (id) window.localStorage.setItem(STORAGE_KEY, id)
  else window.localStorage.removeItem(STORAGE_KEY)
}

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [empresas, setEmpresas] = useState<EmpresaDto[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const list = await empresasApi.list()
      // Hidrata logo do localStorage quando o backend ainda não tem (modo offline / dev).
      const hydrated = list.map((e) => {
        if (e.logoUrl) return e
        if (typeof window === 'undefined') return e
        const local = window.localStorage.getItem(`empresa_logo_${e.id}`)
        return local ? { ...e, logoUrl: local } : e
      })
      setEmpresas(hydrated)

      // Decide qual fica ativa: respeita o que está em localStorage se ainda existir,
      // senão pega a primeira da lista.
      const stored = readStoredId()
      const validStored = stored && hydrated.some((e) => e.id === stored) ? stored : null
      const next = validStored ?? hydrated[0]?.id ?? null
      setCurrentId(next)
      writeStoredId(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar empresas')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Carrega a lista quando o usuário autentica. Limpa quando desloga.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setEmpresas([])
      setCurrentId(null)
      writeStoredId(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    void refresh()
  }, [isAuthenticated, user, refresh])

  const setCurrentEmpresaId = useCallback(
    (id: string) => {
      const exists = empresas.some((e) => e.id === id)
      if (!exists) return
      setCurrentId(id)
      writeStoredId(id)
    },
    [empresas],
  )

  const updateEmpresa = useCallback((empresa: EmpresaDto) => {
    setEmpresas((prev) => prev.map((e) => (e.id === empresa.id ? empresa : e)))
  }, [])

  const removeEmpresa = useCallback((empresaId: string) => {
    setEmpresas((prev) => {
      const next = prev.filter((e) => e.id !== empresaId)
      // Se removeu a ativa, troca para a primeira disponível.
      setCurrentId((cur) => {
        if (cur !== empresaId) return cur
        const fallback = next[0]?.id ?? null
        writeStoredId(fallback)
        return fallback
      })
      return next
    })
  }, [])

  const currentEmpresa = useMemo(
    () => empresas.find((e) => e.id === currentId) ?? null,
    [empresas, currentId],
  )

  const value = useMemo<EmpresaContextType>(
    () => ({
      empresas,
      currentEmpresa,
      isLoading,
      error,
      setCurrentEmpresaId,
      refresh,
      updateEmpresa,
      removeEmpresa,
    }),
    [empresas, currentEmpresa, isLoading, error, setCurrentEmpresaId, refresh, updateEmpresa, removeEmpresa],
  )

  return <EmpresaContext.Provider value={value}>{children}</EmpresaContext.Provider>
}

export function useEmpresa(): EmpresaContextType {
  const ctx = useContext(EmpresaContext)
  if (!ctx) {
    throw new Error('useEmpresa precisa estar dentro de <EmpresaProvider>. Cheque o page.tsx.')
  }
  return ctx
}

// Helper para componentes que só precisam do empresaId atual e querem evitar
// destrucutar todo o contexto. Retorna null enquanto carrega.
export function useCurrentEmpresaId(): string | null {
  const { currentEmpresa } = useEmpresa()
  return currentEmpresa?.id ?? null
}


import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api, authApi, type UserDto, type AuthResponseDto } from '@/lib/cadastra/api'
import type { User, AuthResponse, GoogleAuthPayload } from '@/types/cadastra'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<AuthResponse>
  register: (email: string, password: string, name: string) => Promise<AuthResponse>
  loginWithGoogle: (payload: GoogleAuthPayload) => Promise<AuthResponse>
  applyAuthResponse: (auth: AuthResponseDto) => User
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEMO_USER_KEY = 'demo_user'
const DEMO_TOKEN = 'demo-mode-token'

function makeDemoUser(email: string): User {
  return {
    id: 'demo-' + email,
    email,
    name: email.split('@')[0] || 'Usuário Demo',
    role: 'admin',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  }
}

function fromBackendUser(u: UserDto): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl ?? undefined,
    role: 'admin',
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt ?? undefined,
  }
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')
  }
  return false
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const token = api.getToken()
      if (!token) {
        setUser(null)
        return
      }

      if (token === DEMO_TOKEN) {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(DEMO_USER_KEY) : null
        if (stored) {
          setUser(JSON.parse(stored) as User)
          return
        }
      }

      const me = await authApi.me()
      setUser(fromBackendUser(me))
    } catch (error) {
      if (isNetworkError(error)) {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(DEMO_USER_KEY) : null
        if (stored) {
          setUser(JSON.parse(stored) as User)
          return
        }
      }
      setUser(null)
      api.setToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const enterDemoMode = (email: string): AuthResponse => {
    const demoUser = makeDemoUser(email)
    api.setToken(DEMO_TOKEN)
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser))
    }
    setUser(demoUser)
    return { success: true, user: demoUser, token: DEMO_TOKEN }
  }

  const applyAuthResponse = (auth: AuthResponseDto): User => {
    api.setToken(auth.token)
    const u = fromBackendUser(auth.user)
    setUser(u)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DEMO_USER_KEY)
    }
    return u
  }

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    try {
      setIsLoading(true)
      const response = await authApi.login(email, password)
      const u = applyAuthResponse(response)
      return { success: true, user: u, token: response.token }
    } catch (error) {
      if (isNetworkError(error)) return enterDemoMode(email)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao fazer login',
      }
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (email: string, password: string, name: string): Promise<AuthResponse> => {
    try {
      setIsLoading(true)
      const response = await authApi.register({ email, password, name })
      const u = applyAuthResponse(response)
      return { success: true, user: u, token: response.token }
    } catch (error) {
      if (isNetworkError(error)) return enterDemoMode(email)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao criar a conta',
      }
    } finally {
      setIsLoading(false)
    }
  }

  const loginWithGoogle = async (payload: GoogleAuthPayload): Promise<AuthResponse> => {
    try {
      setIsLoading(true)
      const response = await authApi.google(payload.idToken)
      const u = applyAuthResponse(response)
      return { success: true, user: u, token: response.token }
    } catch (error) {
      if (isNetworkError(error)) return enterDemoMode('google.user@cadastra.ai')
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao fazer login com Google',
      }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    } finally {
      api.setToken(null)
      if (typeof window !== 'undefined') {
        localStorage.removeItem(DEMO_USER_KEY)
      }
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        loginWithGoogle,
        applyAuthResponse,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


import { useCallback, useEffect, useState } from 'react'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleInitConfig) => void
          prompt: (callback?: (notification: GoogleNotification) => void) => void
          renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void
          disableAutoSelect: () => void
          cancel: () => void
        }
      }
    }
  }
}

interface GoogleInitConfig {
  client_id: string
  callback: (response: { credential: string }) => void
  ux_mode?: 'popup' | 'redirect'
  use_fedcm_for_prompt?: boolean
}

interface GoogleNotification {
  isNotDisplayed?: () => boolean
  isSkippedMoment?: () => boolean
  isDismissedMoment?: () => boolean
  getNotDisplayedReason?: () => string
  getSkippedReason?: () => string
  getDismissedReason?: () => string
}

interface GoogleButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'small' | 'medium' | 'large'
  type?: 'standard' | 'icon'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  width?: number | string
  logo_alignment?: 'left' | 'center'
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('GSI script error')))
      return
    }
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('GSI script error'))
    document.head.appendChild(s)
  })

  return scriptPromise
}

interface UseGoogleAuthOptions {
  onCredential: (idToken: string) => void | Promise<void>
}

export function useGoogleAuth({ onCredential }: UseGoogleAuthOptions) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled) return
        if (!window.google?.accounts?.id) {
          setError('Google Identity Services não disponível.')
          return
        }
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) {
              void onCredential(response.credential)
            }
          },
          use_fedcm_for_prompt: true,
        })
        setReady(true)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Falha ao carregar Google')
      })
    return () => {
      cancelled = true
    }
  }, [clientId, onCredential])

  const prompt = useCallback(() => {
    if (!ready || !window.google?.accounts?.id) {
      setError('Google ainda não está pronto. Tente novamente em instantes.')
      return
    }
    window.google.accounts.id.prompt()
  }, [ready])

  const renderButton = useCallback(
    (el: HTMLElement | null, options: GoogleButtonOptions = {}) => {
      if (!el || !ready || !window.google?.accounts?.id) return
      try {
        window.google.accounts.id.renderButton(el, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: '100%',
          ...options,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao renderizar botão Google')
      }
    },
    [ready],
  )

  return {
    isConfigured: Boolean(clientId),
    ready,
    error,
    prompt,
    renderButton,
  }
}

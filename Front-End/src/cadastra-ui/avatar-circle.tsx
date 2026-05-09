
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface AvatarCircleProps {
  src?: string | null
  name?: string | null
  email?: string | null
  size?: number
  className?: string
}

export function AvatarCircle({
  src,
  name,
  email,
  size = 32,
  className,
}: AvatarCircleProps) {
  const [errored, setErrored] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const initial = (name || email || 'U').trim().slice(0, 1).toUpperCase()
  const dimension = `${size}px`
  const showImage = mounted && src && !errored

  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 select-none',
        className,
      )}
      style={{
        width: dimension,
        height: dimension,
        background: showImage ? 'transparent' : 'linear-gradient(135deg, #22d3ee, #38bdf8)',
        boxShadow: showImage ? '0 0 0 1px rgba(34,211,238,0.25)' : undefined,
      }}
    >
      {showImage ? (
        // Plain <img> — Google avatar URLs come from googleusercontent.com and we don't
        // want to add extra Image domains config; rendering directly keeps things simple.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={name || email || 'Avatar'}
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        // Auth state vem do localStorage — name/email só existem após mount no cliente.
        // Renderizamos a letra só após montar para evitar mismatch de hydration.
        <span
          className="font-bold text-[#081420]"
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          {mounted ? initial : ''}
        </span>
      )}
    </span>
  )
}

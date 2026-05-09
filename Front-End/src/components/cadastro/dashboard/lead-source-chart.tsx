
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface LeadSourceChartProps {
  data: {
    nome: string
    percentual: number
  }[]
}

export function LeadSourceChart({ data }: LeadSourceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const renderedProgressRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = 280
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const centerX = size / 2
    const centerY = size / 2
    const radius = 110
    const lineWidth = 16

    const total = data.reduce((sum, item) => sum + item.percentual, 0)
    const target = Math.min(total / 100, 1)
    const startProgress = renderedProgressRef.current
    const startedAt = performance.now()
    const duration = 700

    const draw = (progress: number) => {
      ctx.clearRect(0, 0, size, size)

      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0.7 * Math.PI, 0.3 * Math.PI)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.stroke()

      const startAngle = 0.7 * Math.PI
      const endAngle = startAngle + progress * 1.6 * Math.PI

      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    const tick = (now: number) => {
      const t = Math.min((now - startedAt) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = startProgress + (target - startProgress) * eased
      renderedProgressRef.current = current
      draw(current)
      if (t < 1) {
        animationRef.current = requestAnimationFrame(tick)
      }
    }

    animationRef.current = requestAnimationFrame(tick)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [data])

  const mainSource = data[0] || { nome: 'INSTITUTO TRAUMA', percentual: 100 }

  return (
    <motion.div
      className="rounded-xl border border-cyan-400/[0.08] bg-[#0e1a26] p-5 h-full flex flex-col transition-colors duration-200 hover:border-cyan-400/25"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <h3 className="text-[11px] font-medium text-cyan-200/55 uppercase tracking-[0.14em] mb-4">
        Origem dos Leads
      </h3>

      <div className="flex-1 flex items-center justify-center relative">
        <canvas ref={canvasRef} className="absolute" />
        <div className="text-center z-10 px-4">
          <motion.p
            key={mainSource.nome}
            className="text-sm font-semibold tracking-tight truncate max-w-[200px] text-slate-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {mainSource.nome}
          </motion.p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {mainSource.percentual}%
          </p>
        </div>
      </div>
    </motion.div>
  )
}

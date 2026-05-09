
import { motion } from 'framer-motion'
import type { FunnelData } from '@/types/cadastra'

interface FunnelChartProps {
  data: FunnelData[]
  isLoading?: boolean
}

export function FunnelChart({ data, isLoading }: FunnelChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl bg-card p-6">
        <div className="skeleton h-5 w-40 rounded mb-6" />
        <div className="skeleton h-48 w-full rounded" />
      </div>
    )
  }

  const maxValue = Math.max(...data.map(d => d.valor))

  return (
    <motion.div
      className="rounded-xl bg-card p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
        Funil de Conversão
      </h3>

      <div className="space-y-4">
        {data.map((item, index) => {
          const widthPercent = (item.valor / maxValue) * 100
          const gradientId = `funnel-gradient-${index}`

          return (
            <motion.div
              key={item.etapa}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-foreground font-medium">{item.etapa}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-bold text-foreground">
                    {item.valor.toLocaleString('pt-BR')}
                  </span>
                  {item.conversaoAnterior !== undefined && (
                    <span className="text-xs text-emerald-400 font-medium">
                      {item.conversaoAnterior}%
                    </span>
                  )}
                </div>
              </div>
              
              <div className="relative h-8 bg-muted rounded-lg overflow-hidden">
                <svg className="absolute inset-0 w-full h-full">
                  <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00d4ff" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                </svg>
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-lg"
                  style={{ 
                    background: `linear-gradient(90deg, #00d4ff, #7c3aed)`,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
                />
                <div className="absolute inset-0 flex items-center px-3">
                  <span className="text-xs font-medium text-white/90 drop-shadow-sm">
                    {item.percentual}%
                  </span>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Taxa de conversão geral</span>
          <span className="font-mono font-bold text-emerald-400">
            {data.length > 0 ? ((data[data.length - 1].valor / data[0].valor) * 100).toFixed(1) : 0}%
          </span>
        </div>
      </div>
    </motion.div>
  )
}


import { motion } from 'framer-motion'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "@/components/icons"
import { AnimatedNumber } from '@/cadastra-ui/animated-number'

interface MiniSparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
}

function MiniSparkline({ data, color = '#00d4ff', width = 80, height = 24 }: MiniSparklineProps) {
  if (data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sparkline-gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <motion.polyline
        fill="none"
        stroke={`url(#sparkline-gradient-${color.replace('#', '')})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  )
}

interface KPICardProps {
  title: string
  value: number
  icon: LucideIcon
  delta: number
  deltaLabel?: string
  sparkline: number[]
  formatValue?: (value: number) => string
  iconColor?: string
  delay?: number
}

export function KPICard({
  title,
  value,
  icon: Icon,
  delta,
  deltaLabel = 'vs. período anterior',
  sparkline,
  formatValue = (v) => v.toLocaleString('pt-BR'),
  iconColor = '#00d4ff',
  delay = 0
}: KPICardProps) {
  const isPositive = delta > 0
  const isNeutral = delta === 0
  const DeltaIcon = isPositive ? TrendingUp : isNeutral ? Minus : TrendingDown

  return (
    <motion.div
      className="rounded-xl bg-card p-5 gradient-border glow-hover cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        <div 
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${iconColor}15` }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: iconColor }} />
        </div>
      </div>

      <div className="text-3xl font-bold text-foreground mb-2 font-mono">
        <AnimatedNumber value={value} formatValue={formatValue} />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className={`flex items-center gap-1 text-sm font-medium ${
          isPositive ? 'text-emerald-400' : isNeutral ? 'text-muted-foreground' : 'text-red-400'
        }`}>
          <DeltaIcon className="h-3.5 w-3.5" />
          <span>{isPositive ? '+' : ''}{delta.toFixed(1)}%</span>
        </div>
        <span className="text-xs text-muted-foreground">{deltaLabel}</span>
      </div>

      <MiniSparkline data={sparkline} color={iconColor} />
    </motion.div>
  )
}

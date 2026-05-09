
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { AnimatedNumber } from '@/cadastra-ui/animated-number'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  variation?: {
    value: string | number
    label: string
    type: 'positive' | 'negative' | 'neutral'
  }
  items?: {
    name: string
    value: number
    color: 'green' | 'blue' | 'gray'
  }[]
  className?: string
  size?: 'default' | 'large'
  pulse?: boolean
  children?: React.ReactNode
}

export function StatsCard({
  title,
  value,
  subtitle,
  variation,
  items,
  className,
  size = 'default',
  children,
}: StatsCardProps) {
  const variationToken = (type: 'positive' | 'negative' | 'neutral') => {
    switch (type) {
      case 'positive':
        return { color: 'text-emerald-400', Icon: ArrowUpRight }
      case 'negative':
        return { color: 'text-rose-400', Icon: ArrowDownRight }
      default:
        return { color: 'text-slate-500', Icon: Minus }
    }
  }

  const dotClass = (color: 'green' | 'blue' | 'gray') => {
    switch (color) {
      case 'green':
        return 'bg-cyan-400'
      case 'blue':
        return 'bg-sky-400'
      default:
        return 'bg-slate-500'
    }
  }

  const isNumeric = typeof value === 'number'

  return (
    <motion.div
      className={cn(
        'relative rounded-xl flex flex-col justify-between overflow-hidden',
        'border border-cyan-400/[0.08] bg-[#0e1a26]',
        'transition-colors duration-200 hover:border-cyan-400/25',
        size === 'large' ? 'min-h-[208px] p-6' : 'min-h-[160px] p-5',
        className,
      )}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div>
        <h3 className="text-[11px] font-medium text-cyan-200/55 uppercase tracking-[0.14em] mb-3">
          {title}
        </h3>

        <div className="flex items-end justify-between gap-3">
          {isNumeric ? (
            <p
              className={cn(
                'font-semibold tabular-nums text-slate-50 leading-none',
                size === 'large' ? 'text-[44px]' : 'text-[32px]',
              )}
            >
              <AnimatedNumber value={value as number} />
            </p>
          ) : (
            <AnimatePresence mode="wait">
              <motion.p
                key={String(value)}
                className={cn(
                  'font-semibold tabular-nums text-slate-50 leading-none',
                  size === 'large' ? 'text-[44px]' : 'text-[32px]',
                )}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
              >
                {value}
              </motion.p>
            </AnimatePresence>
          )}
          {subtitle && (
            <span className="text-xs text-slate-500 mb-1 shrink-0">{subtitle}</span>
          )}
        </div>

        {children && <div className="mt-2 text-sm text-slate-400">{children}</div>}
      </div>

      {items && items.length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/[0.05] space-y-2">
          {items.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClass(item.color))} />
                <span className="text-slate-400 truncate">{item.name}</span>
              </div>
              <span
                className={cn(
                  'font-medium tabular-nums',
                  item.value > 0 ? 'text-slate-100' : 'text-slate-600',
                )}
              >
                <AnimatedNumber value={item.value} />
              </span>
            </div>
          ))}
        </div>
      )}

      {variation && (() => {
        const { color, Icon } = variationToken(variation.type)
        return (
          <div className="mt-auto pt-5 flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums', color)}>
              <Icon className="h-3.5 w-3.5" />
              {variation.type === 'positive' ? '+' : ''}
              {variation.value}
            </span>
            <span className="text-[12px] text-slate-500">{variation.label}</span>
          </div>
        )
      })()}
    </motion.div>
  )
}

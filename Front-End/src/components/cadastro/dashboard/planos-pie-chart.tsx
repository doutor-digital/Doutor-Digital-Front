
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { PlanoData } from '@/types/cadastra'

interface PlanosPieChartProps {
  data: PlanoData[]
  isLoading?: boolean
}

const COLORS = ['#00d4ff', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#6366f1']

export function PlanosPieChart({ data, isLoading }: PlanosPieChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl bg-card p-6">
        <div className="skeleton h-5 w-40 rounded mb-6" />
        <div className="skeleton h-48 w-full rounded-full mx-auto" style={{ maxWidth: '200px' }} />
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: PlanoData }> }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{item.nome}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {item.quantidade} contratos ({item.percentual}%)
          </p>
        </div>
      )
    }
    return null
  }

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx: number
    cy: number
    midAngle: number
    innerRadius: number
    outerRadius: number
    percent: number
  }) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (percent < 0.05) return null

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <motion.div
      className="rounded-xl bg-card p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Planos Contratados
      </h3>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={80}
            innerRadius={40}
            fill="#8884d8"
            dataKey="quantidade"
            animationBegin={0}
            animationDuration={1000}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.cor || COLORS[index % COLORS.length]}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {data.map((item, index) => (
          <div key={item.nome} className="flex items-center gap-2 text-xs">
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.cor || COLORS[index % COLORS.length] }}
            />
            <span className="text-muted-foreground truncate">{item.nome}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}


import { motion } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { ReceitaData } from '@/types/cadastra'

interface ReceitaChartProps {
  data: ReceitaData[]
  isLoading?: boolean
}

export function ReceitaChart({ data, isLoading }: ReceitaChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl bg-card p-6">
        <div className="skeleton h-5 w-40 rounded mb-6" />
        <div className="skeleton h-64 w-full rounded" />
      </div>
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-mono font-medium text-foreground">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <motion.div
      className="rounded-xl bg-card p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
        Receita por Período
      </h3>
      
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorConsultas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorTratamentos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            dataKey="data" 
            stroke="#94a3b8" 
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#94a3b8" 
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
          <Area
            type="monotone"
            dataKey="consultas"
            name="Consultas"
            stroke="#00d4ff"
            fillOpacity={1}
            fill="url(#colorConsultas)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="tratamentos"
            name="Tratamentos"
            stroke="#7c3aed"
            fillOpacity={1}
            fill="url(#colorTratamentos)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Total"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorTotal)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

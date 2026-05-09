
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { ResponsavelData } from '@/types/cadastra'

interface ResponsaveisBarChartProps {
  data: ResponsavelData[]
  isLoading?: boolean
}

export function ResponsaveisBarChart({ data, isLoading }: ResponsaveisBarChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl bg-card p-6">
        <div className="skeleton h-5 w-48 rounded mb-6" />
        <div className="skeleton h-48 w-full rounded" />
      </div>
    )
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
              <span className="font-mono font-medium text-foreground">{entry.value}</span>
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
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
        Performance por Responsável
      </h3>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart 
          data={data} 
          layout="vertical"
          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis 
            type="number" 
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            type="category" 
            dataKey="nome" 
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={90}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
          <Bar 
            dataKey="leads" 
            name="Leads" 
            fill="#00d4ff" 
            radius={[0, 4, 4, 0]}
            stackId="a"
          />
          <Bar 
            dataKey="agendamentos" 
            name="Agendamentos" 
            fill="#7c3aed" 
            radius={[0, 4, 4, 0]}
            stackId="a"
          />
          <Bar 
            dataKey="fechamentos" 
            name="Fechamentos" 
            fill="#10b981" 
            radius={[0, 4, 4, 0]}
            stackId="a"
          />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

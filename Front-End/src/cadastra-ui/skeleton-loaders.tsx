
import { motion } from 'framer-motion'

interface SkeletonCardProps {
  className?: string
  hasChart?: boolean
}

export function SkeletonCard({ className = '', hasChart = false }: SkeletonCardProps) {
  return (
    <motion.div
      className={`rounded-xl bg-card p-6 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="skeleton h-4 w-24 rounded mb-4" />
      <div className="skeleton h-10 w-32 rounded mb-2" />
      <div className="skeleton h-3 w-16 rounded" />
      {hasChart && (
        <div className="skeleton h-32 w-full rounded mt-4" />
      )}
    </motion.div>
  )
}

export function SkeletonKPI() {
  return (
    <div className="rounded-xl bg-card p-5 gradient-border">
      <div className="flex items-center justify-between mb-3">
        <div className="skeleton h-4 w-28 rounded" />
        <div className="skeleton h-8 w-8 rounded-lg" />
      </div>
      <div className="skeleton h-9 w-24 rounded mb-2" />
      <div className="flex items-center gap-2">
        <div className="skeleton h-5 w-16 rounded" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
      <div className="skeleton h-8 w-full rounded mt-3" />
    </div>
  )
}

export function SkeletonChart({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`rounded-xl bg-card p-6 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="skeleton h-5 w-40 rounded mb-6" />
      <div className="skeleton h-64 w-full rounded" />
    </motion.div>
  )
}

export function SkeletonTable() {
  return (
    <div className="rounded-xl bg-card p-6">
      <div className="skeleton h-5 w-32 rounded mb-4" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b border-border">
          <div className="skeleton h-4 w-1/4 rounded" />
          <div className="skeleton h-4 w-1/4 rounded" />
          <div className="skeleton h-4 w-1/4 rounded" />
          <div className="skeleton h-4 w-1/4 rounded" />
        </div>
      ))}
    </div>
  )
}

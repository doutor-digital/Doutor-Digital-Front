
import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  duration?: number
  formatValue?: (value: number) => string
  className?: string
}

export function AnimatedNumber({ 
  value, 
  duration = 1.5,
  formatValue = (v) => Math.round(v).toLocaleString('pt-BR'),
  className = ''
}: AnimatedNumberProps) {
  const spring = useSpring(0, { duration: duration * 1000 })
  const display = useTransform(spring, (current) => formatValue(current))
  const [displayValue, setDisplayValue] = useState(formatValue(0))

  useEffect(() => {
    spring.set(value)
    const unsubscribe = display.on('change', (v) => setDisplayValue(v))
    return () => unsubscribe()
  }, [value, spring, display])

  return (
    <motion.span 
      className={`tabular-nums ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {displayValue}
    </motion.span>
  )
}

// Hook para animar números
export function useAnimatedNumber(targetValue: number, duration = 1500) {
  const [currentValue, setCurrentValue] = useState(0)
  const startTime = useRef<number | null>(null)
  const startValue = useRef(0)
  const animationFrame = useRef<number | null>(null)

  useEffect(() => {
    startValue.current = currentValue
    startTime.current = null

    const animate = (timestamp: number) => {
      if (startTime.current === null) {
        startTime.current = timestamp
      }

      const progress = Math.min((timestamp - startTime.current) / duration, 1)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const newValue = startValue.current + (targetValue - startValue.current) * easeOutQuart

      setCurrentValue(newValue)

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate)
      }
    }

    animationFrame.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [targetValue, duration])

  return currentValue
}

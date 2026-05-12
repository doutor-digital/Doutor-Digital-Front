
import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react'
import { Search, Check, X, ChevronDown } from "@/components/icons"
import { cn } from '@/lib/utils'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
  htmlFor?: string
}

export function FieldShell({ label, hint, error, required, className, children, htmlFor }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-white/65">
        {label}
        {required && <span className="text-cyan-400 ml-1">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-rose-300">{error}</p>
      ) : hint ? (
        <p className="text-xs text-white/45">{hint}</p>
      ) : null}
    </div>
  )
}

const inputBaseClass =
  'w-full px-4 h-12 rounded-2xl bg-[#0c0d10] border border-white/[0.05] text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15 transition-colors'

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
  containerClassName?: string
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, hint, error, required, containerClassName, className, id, ...props }, ref) => {
    const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`
    return (
      <FieldShell label={label} hint={hint} error={error} required={required} className={containerClassName} htmlFor={inputId}>
        <input ref={ref} id={inputId} required={required} className={cn(inputBaseClass, className)} {...props} />
      </FieldShell>
    )
  },
)
TextInput.displayName = 'TextInput'

interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hint?: string
  error?: string
  options: { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
  containerClassName?: string
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(
  ({ label, hint, error, required, options, placeholder, containerClassName, className, id, ...props }, ref) => {
    const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`
    return (
      <FieldShell label={label} hint={hint} error={error} required={required} className={containerClassName} htmlFor={inputId}>
        <select
          ref={ref}
          id={inputId}
          required={required}
          // colorScheme=dark makes the OS-rendered dropdown menu use dark colors so options aren't white-on-white.
          style={{ colorScheme: 'dark' }}
          className={cn(
            inputBaseClass,
            'cursor-pointer appearance-none pr-10 bg-no-repeat bg-[right_0.875rem_center]',
            className,
          )}
          {...{
            ...props,
            // Force a backgroundImage via inline style merging — easier than dealing with arbitrary classes
          }}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      </FieldShell>
    )
  },
)
SelectInput.displayName = 'SelectInput'

interface SearchSelectOption {
  value: string
  label: string
  subtitle?: string
  disabled?: boolean
}

interface SearchSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: SearchSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  required?: boolean
  hint?: string
  containerClassName?: string
  disabled?: boolean
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function SearchSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Selecione…',
  searchPlaceholder = 'Pesquisar pelo nome…',
  emptyMessage = 'Nenhum resultado',
  required,
  hint,
  containerClassName,
  disabled,
}: SearchSelectProps) {
  const reactId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return options
    return options.filter(
      (o) => normalize(o.label).includes(q) || (o.subtitle ? normalize(o.subtitle).includes(q) : false),
    )
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (open) {
      setHighlight(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setQuery('')
    }
  }, [open])

  const select = (opt: SearchSelectOption) => {
    if (opt.disabled) return
    onChange(opt.value)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = filtered[highlight]
      if (target) select(target)
    }
  }

  return (
    <FieldShell label={label} hint={hint} required={required} className={containerClassName} htmlFor={`${reactId}-trigger`}>
      <div ref={wrapperRef} className="relative">
        <button
          id={`${reactId}-trigger`}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={cn(
            'group flex items-center gap-2 w-full px-4 h-12 rounded-2xl bg-[#0c0d10] border text-[14px] transition-colors',
            'focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15',
            open ? 'border-cyan-400/60' : 'border-white/[0.05] hover:border-white/[0.12]',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <Search className="h-4 w-4 text-white/45 shrink-0" />
          {selected ? (
            <span className="flex-1 text-left truncate text-white">
              {selected.label}
              {selected.subtitle && (
                <span className="text-white/45 ml-2 text-[12px]">· {selected.subtitle}</span>
              )}
            </span>
          ) : (
            <span className="flex-1 text-left text-white/40">{placeholder}</span>
          )}
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpar seleção"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange('')
                }
              }}
              className="grid place-items-center h-6 w-6 rounded-full text-white/45 hover:text-white hover:bg-white/[0.06]"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-white/45 shrink-0 transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>

        {open && (
          <div className="absolute z-30 mt-2 w-full rounded-2xl bg-[#0c0d10] border border-white/[0.08] shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 h-11 border-b border-white/[0.05]">
              <Search className="h-4 w-4 text-white/45 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setHighlight(0)
                }}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                className="flex-1 h-full bg-transparent outline-none text-[14px] text-white placeholder:text-white/35"
              />
              <span className="text-[11px] tabular-nums text-white/45 shrink-0">
                {filtered.length}/{options.length}
              </span>
            </div>
            <ul role="listbox" className="max-h-72 overflow-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-[13px] text-white/45">{emptyMessage}</li>
              ) : (
                filtered.map((o, i) => {
                  const isSelected = o.value === value
                  const isHighlight = i === highlight
                  return (
                    <li
                      key={o.value}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={o.disabled}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => select(o)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 text-[13px] cursor-pointer transition-colors',
                        o.disabled
                          ? 'text-white/30 cursor-not-allowed'
                          : isHighlight
                            ? 'bg-cyan-400/[0.08] text-white'
                            : 'text-white/85 hover:bg-white/[0.04]',
                      )}
                    >
                      <span className="flex-1 min-w-0 truncate">
                        {o.label}
                        {o.subtitle && (
                          <span className="text-white/45 ml-2 text-[12px]">· {o.subtitle}</span>
                        )}
                      </span>
                      {isSelected && <Check className="h-4 w-4 text-cyan-300 shrink-0" />}
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </FieldShell>
  )
}

interface TextareaInputProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: string
  error?: string
  containerClassName?: string
}

export const TextareaInput = forwardRef<HTMLTextAreaElement, TextareaInputProps>(
  ({ label, hint, error, required, containerClassName, className, id, ...props }, ref) => {
    const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`
    return (
      <FieldShell label={label} hint={hint} error={error} required={required} className={containerClassName} htmlFor={inputId}>
        <textarea
          ref={ref}
          id={inputId}
          required={required}
          rows={3}
          className={cn(inputBaseClass, 'h-auto py-3 resize-y min-h-[88px]', className)}
          {...props}
        />
      </FieldShell>
    )
  },
)
TextareaInput.displayName = 'TextareaInput'

interface ToggleSwitchProps {
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

export function ToggleSwitch({ label, description, checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'group flex items-center justify-between w-full px-4 h-14 rounded-2xl border transition-colors',
        checked
          ? 'border-cyan-400/55 bg-cyan-400/[0.08]'
          : 'border-white/[0.05] bg-[#0c0d10] hover:border-white/[0.12]',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
      aria-pressed={checked}
    >
      <div className="text-left">
        <p className="text-[13px] font-medium text-white">{label}</p>
        {description && <p className="text-[11px] text-white/55 mt-0.5">{description}</p>}
      </div>
      <span
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-cyan-400' : 'bg-white/15',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  )
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string; description?: string }[]
  onChange: (value: T) => void
  hint?: string
  required?: boolean
}

export function Segmented<T extends string>({ label, value, options, onChange, hint, required }: SegmentedProps<T>) {
  return (
    <FieldShell label={label} hint={hint} required={required}>
      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => {
          const active = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={cn(
                'flex flex-col items-start gap-0.5 px-4 py-3 rounded-2xl border text-left transition-colors',
                active
                  ? 'border-cyan-400/60 bg-cyan-400/[0.10]'
                  : 'border-white/[0.05] bg-[#0c0d10] hover:border-white/[0.12]',
              )}
              aria-pressed={active}
            >
              <span className="text-[14px] font-semibold text-white">{o.label}</span>
              {o.description && <span className="text-[12px] text-white/55">{o.description}</span>}
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}

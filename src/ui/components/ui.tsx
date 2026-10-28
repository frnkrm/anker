import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { fmtTime, parseTime } from '../../core/time'

type Variant = 'primary' | 'secondary' | 'ghost' | 'warm'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink font-semibold active:opacity-80',
  secondary: 'bg-surface-2 text-text active:opacity-80',
  ghost: 'text-muted active:bg-surface-2',
  warm: 'bg-warm-soft text-warm font-semibold active:opacity-80',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = { sm: 'min-h-10 px-3 text-sm rounded-xl', md: 'min-h-12 px-4 rounded-2xl', lg: 'min-h-14 px-5 text-lg rounded-2xl', xl: 'min-h-20 px-6 text-2xl rounded-3xl' }
  return <button type="button" className={`inline-flex items-center justify-center gap-2 transition disabled:opacity-40 ${sizes[size]} ${VARIANTS[variant]} ${className}`} {...p} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-surface p-4 ${className}`}>{children}</div>
}

export function Page({ title, back, children, actions }: { title: string; back?: boolean | string; children: ReactNode; actions?: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="mx-auto max-w-xl px-4 pb-28 safe-top">
      <header className="mb-4 flex min-h-12 items-center gap-2">
        {back && (
          <button type="button" aria-label="Zurück" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} className="-ml-2 grid h-12 w-12 place-items-center rounded-2xl text-2xl text-muted active:bg-surface-2">
            ‹
          </button>
        )}
        <h1 className="flex-1 text-2xl font-semibold">{title}</h1>
        {actions}
      </header>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

export function Section({ title, children, hint }: { title?: string; children: ReactNode; hint?: string }) {
  return (
    <section className="space-y-2">
      {title && <h2 className="px-1 text-sm font-medium uppercase tracking-wide text-muted">{title}</h2>}
      <div className="space-y-2">{children}</div>
      {hint && <p className="px-1 text-sm text-muted">{hint}</p>}
    </section>
  )
}

export function Row({ label, sub, children, to, onClick }: { label: ReactNode; sub?: ReactNode; children?: ReactNode; to?: string; onClick?: () => void }) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <div className="truncate">{label}</div>
        {sub && <div className="text-sm text-muted">{sub}</div>}
      </div>
      {children}
      {to && <span className="text-xl text-muted">›</span>}
    </>
  )
  const cls = 'flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface px-4 py-2 text-left'
  if (to) return <Link to={to} className={`${cls} active:bg-surface-2`}>{inner}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} active:bg-surface-2`}>{inner}</button>
  return <div className={cls}>{inner}</div>
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-surface-2 ring-1 ring-line'}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-7' : 'left-1'}`} />
    </button>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-xl px-3 text-sm ${o.value === value ? 'bg-accent text-accent-ink font-semibold' : 'bg-surface-2 text-text'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TimeField({ value, onChange, label }: { value: number; onChange: (m: number) => void; label: string }) {
  return (
    <input
      type="time"
      aria-label={label}
      value={fmtTime(value)}
      onChange={(e) => {
        const m = parseTime(e.target.value)
        if (!Number.isNaN(m)) onChange(m)
      }}
      className="min-h-12 rounded-xl bg-surface-2 px-3 text-lg tabular-nums"
    />
  )
}

export function Stepper({ value, onChange, step = 5, min = 0, max = 600, unit = 'min', label }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string; label: string }) {
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <button type="button" aria-label={`${label} verringern`} onClick={() => onChange(Math.max(min, value - step))} className="h-11 w-11 rounded-xl bg-surface-2 text-xl">
        −
      </button>
      <span className="min-w-16 text-center tabular-nums">
        {value} {unit}
      </span>
      <button type="button" aria-label={`${label} erhöhen`} onClick={() => onChange(Math.min(max, value + step))} className="h-11 w-11 rounded-xl bg-surface-2 text-xl">
        +
      </button>
    </div>
  )
}

export function TimeStepper({ value, onChange, label }: { value: number; onChange: (m: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <button type="button" aria-label={`${label} früher`} onClick={() => onChange(value - 5)} className="h-12 w-12 rounded-xl bg-surface-2 text-xl">
        −
      </button>
      <span className="min-w-20 text-center text-2xl font-semibold tabular-nums">{fmtTime(value)}</span>
      <button type="button" aria-label={`${label} später`} onClick={() => onChange(value + 5)} className="h-12 w-12 rounded-xl bg-surface-2 text-xl">
        +
      </button>
    </div>
  )
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('input,textarea,button')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-t-3xl bg-surface p-5 safe-bottom animate-pop"
      >
        {title && <h2 className="mb-3 text-xl font-semibold">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

export function TextInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`min-h-12 w-full rounded-xl bg-surface-2 px-3 text-base placeholder:text-muted ${p.className ?? ''}`} />
}

export function Progress({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-3 w-full overflow-hidden rounded-full bg-surface-2 ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  )
}

export function Ampel({ state }: { state: 'ok' | 'warn' | 'off' }) {
  const c = state === 'ok' ? 'bg-accent' : state === 'warn' ? 'bg-warm' : 'bg-line'
  const l = state === 'ok' ? 'eingerichtet' : state === 'warn' ? 'empfohlen' : 'optional, aus'
  return <span aria-label={l} title={l} className={`inline-block h-4 w-4 shrink-0 rounded-full ${c}`} />
}

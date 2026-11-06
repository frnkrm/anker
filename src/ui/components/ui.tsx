import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  return <div className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>{children}</div>
}

export function Page({ title, back, children, actions }: { title: string; back?: boolean | string; children: ReactNode; actions?: ReactNode }) {
  const nav = useNavigate()
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => { heading.current?.focus() }, [])
  return (
    <div className="mx-auto max-w-xl px-4 pb-28 safe-top">
      <header className="mb-4 flex min-h-12 items-center gap-2">
        {back && (
          <button type="button" aria-label="Zurück" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} className="-ml-2 grid h-12 w-12 place-items-center rounded-2xl text-2xl text-muted active:bg-surface-2">
            ‹
          </button>
        )}
        <h1 ref={heading} tabIndex={-1} className="min-w-0 flex-1 break-words text-2xl font-semibold">{title}</h1>
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
      className="flex h-11 w-14 shrink-0 items-center rounded-full"
    >
      <span aria-hidden="true" className={`relative h-8 w-14 rounded-full transition ${checked ? 'bg-accent' : 'bg-surface-2 ring-1 ring-line'}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-7' : 'left-1'}`} />
      </span>
    </button>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const buttons = useRef(new Map<T, HTMLButtonElement>())
  const tabbable = options.some((option) => option.value === value) ? value : options[0]?.value
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o, index) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === tabbable ? 0 : -1}
          ref={(node) => { if (node) buttons.current.set(o.value, node); else buttons.current.delete(o.value) }}
          onClick={() => onChange(o.value)}
          onKeyDown={(event) => {
            const delta = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0
            if (!delta && !['Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + delta + options.length) % options.length
            const next = options[nextIndex]!
            onChange(next.value)
            buttons.current.get(next.value)?.focus()
          }}
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
      className="min-h-12 min-w-0 max-w-full rounded-xl bg-surface-2 px-2 text-lg tabular-nums"
    />
  )
}

export function Stepper({ value, onChange, step = 5, min = 0, max = 600, unit = 'min', label }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string; label: string }) {
  // Incomplete typing stays local; an empty field must never save an accidental zero.
  const [draft, setDraft] = useState<string>()
  const commit = () => {
    if (draft !== undefined && draft.trim() !== '') {
      const next = Number(draft)
      if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, step >= 1 ? Math.round(next) : next)))
    }
    setDraft(undefined)
  }
  return (
    <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1" role="group" aria-label={`${label} ändern`}>
      <button type="button" aria-label={`${label} verringern`} onClick={() => onChange(Math.max(min, value - step))} className="h-[44px] w-[44px] rounded-xl bg-surface-2 text-xl">
        −
      </button>
      <input type="number" inputMode={step < 1 ? 'decimal' : 'numeric'} aria-label={label} min={min} max={max} step="any"
        value={draft ?? value} onFocus={() => setDraft(String(value))} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className="min-h-11 w-[72px] min-w-0 rounded-xl bg-surface-2 px-1 text-center tabular-nums" />
      <span className="text-sm text-muted">{unit}</span>
      <button type="button" aria-label={`${label} erhöhen`} onClick={() => onChange(Math.min(max, value + step))} className="h-[44px] w-[44px] rounded-xl bg-surface-2 text-xl">
        +
      </button>
    </div>
  )
}

export function TimeStepper({ value, onChange, label, night = false }: { value: number; onChange: (m: number) => void; label: string; night?: boolean }) {
  const set = (minutes: number) => {
    const wall = ((minutes % 1440) + 1440) % 1440
    // Same convention as the planner: 00:30 at night is 1470, not a previous morning.
    onChange(night && wall < 720 ? wall + 1440 : wall)
  }
  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-1" role="group" aria-label={`${label} ändern`}>
      <button type="button" aria-label={`${label} früher`} onClick={() => set(value - 5)} className="h-12 w-12 rounded-xl bg-surface-2 text-xl">
        −
      </button>
      <TimeField label={label} value={value} onChange={set} />
      <button type="button" aria-label={`${label} später`} onClick={() => set(value + 5)} className="h-12 w-12 rounded-xl bg-surface-2 text-xl">
        +
      </button>
    </div>
  )
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useEffectEvent(onClose)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const controls = () => [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]') ?? [])].filter((node) => node.getClientRects().length)
    const onKey = (e: KeyboardEvent) => {
      if ([...document.querySelectorAll('[role="dialog"]')].at(-1) !== ref.current) return
      if (e.key === 'Escape') { e.preventDefault(); close() }
      if (e.key !== 'Tab') return
      const items = controls()
      const first = items[0]; const last = items.at(-1)
      if (!first) { e.preventDefault(); ref.current?.focus(); return }
      if (e.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    ;(controls()[0] ?? ref.current)?.focus()
    return () => { window.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus() }
  }, [open])
  if (!open) return null
  // Portal: unabhängig von Eltern mit backdrop-filter/transform, die position:fixed verschieben würden
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-0.75rem)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-surface p-5 safe-bottom"
      >
        {title && <h2 className="mb-3 text-xl font-semibold">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function TextInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`min-h-12 w-full rounded-xl bg-surface-2 px-3 text-base placeholder:text-muted ${p.className ?? ''}`} />
}

export function Progress({ value, className = '', label = 'Fortschritt' }: { value: number; className?: string; label?: string }) {
  const percent = Math.round((Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0) * 100)
  return (
    <div className={`h-3 w-full overflow-hidden rounded-full bg-surface-2 ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
    </div>
  )
}

export function Ampel({ state }: { state: 'ok' | 'warn' | 'off' }) {
  const c = state === 'ok' ? 'bg-accent' : state === 'warn' ? 'bg-warm' : 'bg-line'
  const l = state === 'ok' ? 'eingerichtet' : state === 'warn' ? 'empfohlen' : 'optional, aus'
  return <span aria-label={l} title={l} className={`inline-block h-4 w-4 shrink-0 rounded-full ${c}`} />
}

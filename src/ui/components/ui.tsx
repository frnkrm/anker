import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router'
import { App as CapApp } from '@capacitor/app'
import { fmtTime } from '../../core/time'
import { isNative } from '../../platform/native'
import { clockMinutes, countdownLabel, germanDateValue, remainingFraction } from './fieldValues'

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
  const sizes = { sm: 'min-h-11 px-3 text-sm rounded-xl', md: 'min-h-12 px-4 rounded-2xl', lg: 'min-h-14 px-5 text-lg rounded-2xl', xl: 'min-h-20 px-6 text-2xl rounded-3xl' }
  return <button type="button" className={`inline-flex min-w-0 items-center justify-center gap-2 transition disabled:opacity-40 ${sizes[size]} ${VARIANTS[variant]} ${className}`} {...p} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ui-card rounded-2xl border border-line bg-surface p-4 ${className}`}>{children}</div>
}

export function Page({ title, back, children, actions, className = '' }: { title: string; back?: boolean | string; children: ReactNode; actions?: ReactNode; className?: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => { heading.current?.focus() }, [])
  return (
    <div className={`mx-auto max-w-xl px-4 pb-28 safe-top ${className}`}>
      <header className="mb-4 flex min-h-12 items-center gap-2">
        {back && (
          <BackButton to={typeof back === 'string' ? back : undefined} />
        )}
        <h1 ref={heading} tabIndex={-1} className="min-w-0 flex-1 break-words text-2xl font-semibold">{title}</h1>
        {actions}
      </header>
      <div className="space-y-4">{children}</div>
      <SaveFeedback />
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
        <div className="break-words">{label}</div>
        {sub && <div className="text-sm text-muted">{sub}</div>}
      </div>
      {children}
      {to && <span aria-hidden="true" className="text-xl text-muted">›</span>}
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
          value={String(o.value)}
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
  const [draft, setDraft] = useState<string>()
  const [invalid, setInvalid] = useState(false)
  const commit = (text: string) => {
    if (draft === undefined) return
    const minutes = clockMinutes(text)
    if (minutes === undefined) { setInvalid(true); return }
    onChange(minutes)
    setDraft(undefined); setInvalid(false)
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="HH:MM"
      maxLength={5}
      aria-label={label}
      aria-invalid={invalid || undefined}
      title={invalid ? 'Bitte eine Uhrzeit von 00:00 bis 23:59 eingeben.' : 'Uhrzeit im 24-Stunden-Format'}
      value={draft ?? fmtTime(value)}
      onFocus={() => setInvalid(false)}
      onChange={(event) => {
        setDraft(event.target.value); setInvalid(false)
        const minutes = clockMinutes(event.target.value)
        if (minutes !== undefined) onChange(minutes)
      }}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
        if (event.key === 'Escape') { event.currentTarget.value = fmtTime(value); setDraft(undefined); setInvalid(false); event.currentTarget.blur() }
      }}
      className="setting-value time-field rounded-xl bg-surface-2 tabular-nums"
    />
  )
}

/** Labels dürfen umbrechen; alle Zeit-/Zahlenfelder behalten dieselbe Bedienungsspalte. */
export function SettingRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="setting-row"><div className="setting-label">{label}</div><div className="setting-row-control">{children}</div></div>
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
    <div className="setting-control" role="group" aria-label={`${label} ändern`}>
      <button type="button" aria-label={`${label} verringern`} onClick={() => onChange(Math.max(min, value - step))} className="setting-adjust rounded-xl bg-surface-2 text-xl">
        −
      </button>
      <input type="number" inputMode={step < 1 ? 'decimal' : 'numeric'} aria-label={label} min={min} max={max} step="any"
        value={draft ?? value} onFocus={() => setDraft(String(value))} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className="setting-value rounded-xl bg-surface-2 text-center tabular-nums" />
      <button type="button" aria-label={`${label} erhöhen`} onClick={() => onChange(Math.min(max, value + step))} className="setting-adjust rounded-xl bg-surface-2 text-xl">
        +
      </button>
      <span className="setting-unit text-sm text-muted">{unit}</span>
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
    <div className="setting-control" role="group" aria-label={`${label} ändern`}>
      <button type="button" aria-label={`${label} früher`} onClick={() => set(value - 5)} className="setting-adjust rounded-xl bg-surface-2 text-xl">
        −
      </button>
      <TimeField label={label} value={value} onChange={set} />
      <button type="button" aria-label={`${label} später`} onClick={() => set(value + 5)} className="setting-adjust rounded-xl bg-surface-2 text-xl">
        +
      </button>
    </div>
  )
}

type SheetLayer = { token: symbol; node: HTMLDivElement; close: () => void }
const sheetLayers: SheetLayer[] = []
let sheetHistoryMarker = ''
let removeNativeBack: (() => void) | undefined
let removeHistoryBack: (() => void) | undefined
let sheetCleanupTimer: number | undefined
let sheetBackPending = false
let sheetBackFocus: HTMLElement | undefined

function updateSheetLayers() {
  for (const [index, layer] of sheetLayers.entries()) {
    const hidden = index !== sheetLayers.length - 1
    layer.node.inert = hidden
    if (hidden) layer.node.setAttribute('aria-hidden', 'true')
    else layer.node.removeAttribute('aria-hidden')
  }
  const root = document.getElementById('root')
  if (root) root.inert = sheetLayers.length > 0 || sheetBackPending
}

/** One temporary history entry represents the whole modal stack, including nested choices. */
function registerSheet(layer: SheetLayer): () => void {
  // Switching or reopening a sheet cancels its predecessor's deferred release.
  window.clearTimeout(sheetCleanupTimer)
  sheetCleanupTimer = undefined
  sheetLayers.push(layer)
  updateSheetLayers()
  if (!removeHistoryBack) {
    sheetHistoryMarker = `anker-sheet-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const marker = sheetHistoryMarker
    const originalPush = history.pushState
    const originalReplace = history.replaceState
    const managedPush: History['pushState'] = function (data: unknown, unused: string, url?: string | URL | null) {
      // A link consumes the temporary modal entry. Back must return to the page,
      // not to a second invisible copy of the page with a closed sheet.
      if (sheetLayers.length && history.state?.ankerSheet === marker && url != null && new URL(url, location.href).href !== location.href) originalReplace.call(history, data, unused, url)
      else originalPush.call(history, data, unused, url)
    }
    const pushMarker = () => {
      if (history.state?.ankerSheet !== marker) originalPush.call(history, { ...history.state, ankerSheet: marker }, '', location.href)
    }
    pushMarker()
    history.pushState = managedPush
    const pop = () => {
      if (sheetBackPending) {
        // This pop belongs to a dismissed sheet, never to a newly opened one.
        // Keep the manager alive until the one requested traversal has drained.
        sheetBackPending = false
        if (sheetLayers.length) pushMarker()
        else { removeHistoryBack?.(); removeNativeBack?.() }
        updateSheetLayers()
        const previous = sheetBackFocus
        sheetBackFocus = undefined
        if (!sheetLayers.length && previous?.isConnected && !previous.closest('[inert]')) previous.focus()
        return
      }
      if (!sheetLayers.length || history.state?.ankerSheet === marker) return
      const latest = sheetLayers.at(-1)!
      if (sheetLayers.length > 1) pushMarker()
      latest.close()
    }
    window.addEventListener('popstate', pop)
    removeHistoryBack = () => {
      window.removeEventListener('popstate', pop)
      if (history.pushState === managedPush) history.pushState = originalPush
      removeHistoryBack = undefined
    }
    if (isNative()) {
      let active = true
      const listener = CapApp.addListener('backButton', () => {
        if (!active || sheetBackPending || !sheetLayers.length) return
        // Closing the last layer uses the same single-flight release as Escape.
        sheetLayers.at(-1)?.close()
      }).catch(() => undefined)
      removeNativeBack = () => { active = false; void listener.then((handle) => handle?.remove()).catch(() => undefined); removeNativeBack = undefined }
    }
  }
  return () => {
    const index = sheetLayers.findIndex((item) => item.token === layer.token)
    if (index < 0) return
    sheetLayers.splice(index, 1)
    layer.node.inert = false; layer.node.removeAttribute('aria-hidden')
    updateSheetLayers()
    if (sheetLayers.length || sheetBackPending) return
    // Several unmounts can happen in one React commit. Only one session-bound
    // cleanup may request Back, and no second request is allowed before popstate.
    window.clearTimeout(sheetCleanupTimer)
    const closingManager = removeHistoryBack
    const closingMarker = sheetHistoryMarker
    sheetCleanupTimer = window.setTimeout(() => {
      sheetCleanupTimer = undefined
      if (sheetLayers.length || sheetBackPending || removeHistoryBack !== closingManager || sheetHistoryMarker !== closingMarker) return
      if (history.state?.ankerSheet === closingMarker) {
        sheetBackFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
        sheetBackPending = true
        updateSheetLayers()
        history.back()
      } else {
        // Navigation or the browser Back button has already consumed the entry.
        removeHistoryBack?.(); removeNativeBack?.()
        updateSheetLayers()
      }
    }, 0)
  }
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useEffectEvent(onClose)
  useEffect(() => {
    if (!open) return
    let active = true
    let unregister: (() => void) | undefined
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const controls = () => [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]') ?? [])].filter((node) => node.getClientRects().length)
    const onKey = (e: KeyboardEvent) => {
      if (sheetLayers.at(-1)?.node !== ref.current) return
      if (e.key === 'Escape') { e.preventDefault(); close() }
      if (e.key !== 'Tab') return
      const items = controls()
      const first = items[0]; const last = items.at(-1)
      if (!first) { e.preventDefault(); ref.current?.focus(); return }
      if (e.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { e.preventDefault(); first.focus() }
    }
    // StrictMode's discarded first setup must not add a browser-history entry.
    queueMicrotask(() => {
      if (!active || !ref.current) return
      unregister = registerSheet({ token: Symbol('sheet'), node: ref.current, close })
      window.addEventListener('keydown', onKey)
      ;(controls().find((node) => !node.hasAttribute('data-sheet-close')) ?? ref.current)?.focus()
    })
    return () => {
      active = false; window.removeEventListener('keydown', onKey); unregister?.()
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus()
    }
  }, [open])
  if (!open) return null
  // Portal: unabhängig von Eltern mit backdrop-filter/transform, die position:fixed verschieben würden
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Optionen'}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="anker-sheet max-h-[calc(100dvh-0.75rem)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-surface p-5 safe-bottom"
      >
        <header className="mb-3 flex min-h-11 items-center gap-2">
          {title && <h2 className="min-w-0 flex-1 break-words text-xl font-semibold">{title}</h2>}
          <button type="button" aria-label="Schließen" data-sheet-close onClick={onClose} className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl text-muted">×</button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function TextInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`min-h-12 w-full min-w-0 rounded-xl bg-surface-2 px-3 text-base placeholder:text-muted ${p.className ?? ''}`} />
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

export function BackButton({ to, onClick, label = 'Zurück', className = '' }: { to?: string; onClick?: () => void; label?: string; className?: string }) {
  const navigate = useNavigate()
  return <button type="button" aria-label={label} onClick={() => onClick ? onClick() : to ? navigate(to) : navigate(-1)} className={`-ml-2 grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl text-muted active:bg-surface-2 ${className}`}>‹</button>
}

export function MoreInfo({ children, summary = 'Mehr erfahren', className = '', open }: { children: ReactNode; summary?: string; className?: string; open?: boolean }) {
  return <details open={open} className={`more-info min-w-0 space-y-2 text-sm text-muted ${className}`}><summary className="min-h-11 cursor-pointer py-2">{summary}</summary><div className="space-y-3">{children}</div></details>
}

export function Checkbox({ checked, onChange, label, children, disabled = false, className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange' | 'size'> & { checked: boolean; onChange: (checked: boolean) => void; label?: ReactNode; children?: ReactNode }) {
  return <label className={`ui-checkbox flex min-h-11 min-w-0 items-center gap-3 rounded-xl py-2 ${disabled ? 'opacity-50' : ''} ${className}`}>
    <input {...props} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="ui-checkbox-input h-6 w-6 shrink-0" />
    <span className="min-w-0 break-words">{label ?? children}</span>
  </label>
}

export function Choice<T extends string | number>({ value, onChange, options, label, disabled = false, placeholder = 'Auswählen', className = '' }: {
  value: T; onChange: (value: T) => void; options: readonly { value: T; label: string; disabled?: boolean }[]; label: string; disabled?: boolean; placeholder?: string; className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)
  if (options.length <= 4 && !options.some((option) => option.disabled)) return <fieldset disabled={disabled} className={`min-w-0 ${className}`}><Segmented label={label} value={value} onChange={onChange} options={[...options]} /></fieldset>
  return <div className={`min-w-0 ${className}`}>
    <button type="button" role="combobox" aria-label={label} aria-expanded={open} aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)} className="ui-choice flex min-h-12 w-full min-w-0 items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-left"><span className="min-w-0 break-words">{selected?.label ?? placeholder}</span><span aria-hidden="true" className="shrink-0 text-muted">⌄</span></button>
    <Sheet open={open} onClose={() => setOpen(false)} title={label}>
      <div role="radiogroup" aria-label={label} className="space-y-2">
        {options.map((option) => <button key={String(option.value)} type="button" value={String(option.value)} role="radio" aria-checked={option.value === value} disabled={disabled || option.disabled} onClick={() => { if (!disabled) { onChange(option.value); setOpen(false) } }} className={`flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left disabled:opacity-50 ${option.value === value ? 'bg-accent-soft text-accent' : 'bg-surface-2'}`}><span aria-hidden="true" className="w-5 shrink-0">{option.value === value ? '✓' : ''}</span><span className="min-w-0 break-words">{option.label}</span></button>)}
      </div>
    </Sheet>
  </div>
}

export function DateField({ value, onChange, label, type = 'date', disabled = false, className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string; onChange: (value: string) => void; label: string; type?: 'date' | 'datetime-local'
}) {
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const errorId = useId()
  const [invalid, setInvalid] = useState(false)
  return <div className={`ui-date-field relative min-w-0 ${className}`}>
    <div className="flex min-w-0 items-center gap-2">
    <button ref={trigger} type="button" aria-label={label} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} disabled={disabled} onClick={() => {
      try { input.current?.showPicker() } catch { input.current?.focus(); input.current?.click() }
    }} className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-left tabular-nums"><span className="min-w-0 break-words">{germanDateValue(value, type === 'datetime-local') || (type === 'datetime-local' ? 'Datum und Uhrzeit wählen' : 'Datum wählen')}</span><span aria-hidden="true">▦</span></button>
    {value && !props.required && <button type="button" disabled={disabled} aria-label={`${label} löschen`} onClick={() => { setInvalid(false); onChange('') }} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl text-muted">×</button>}
    <input {...props} lang="de" ref={input} type={type} value={value} disabled={disabled} aria-label={`${label} auswählen`} aria-describedby={invalid ? errorId : undefined} tabIndex={-1}
      onInvalid={(event) => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); props.onInvalid?.(event) }}
      onChange={(event) => { setInvalid(false); onChange(event.target.value) }} className="ui-date-picker" />
    </div>
    {invalid && <p id={errorId} role="alert" className="mt-2 break-words text-sm text-warm">Bitte wähle {type === 'date' ? 'ein gültiges Datum' : 'ein gültiges Datum mit Uhrzeit'}.</p>}
  </div>
}

export function DurationPicker({ value, onChange, options = [15, 25, 40, 50], label = 'Dauer', min = 0.01, max = 1440, disabled = false }: {
  value: number; onChange: (minutes: number) => void; options?: readonly number[]; label?: string; min?: number; max?: number; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const custom = !options.includes(value)
  return <fieldset disabled={disabled} className="duration-picker min-w-0 space-y-2">
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((minutes) => <button key={minutes} type="button" value={String(minutes)} role="radio" aria-checked={value === minutes} onClick={() => onChange(minutes)} className={`min-h-11 rounded-xl px-3 text-sm ${value === minutes ? 'bg-accent text-accent-ink font-semibold' : 'bg-surface-2'}`}>{minutes} min</button>)}
      <button type="button" value="custom" role="radio" aria-checked={custom} onClick={() => { setDraft(value); setOpen(true) }} className={`min-h-11 rounded-xl px-3 text-sm ${custom ? 'bg-accent text-accent-ink font-semibold' : 'bg-surface-2'}`}>Eigene{custom ? ` · ${value.toLocaleString('de-DE')} min` : ''}</button>
    </div>
    <Sheet open={open} onClose={() => setOpen(false)} title={`${label} wählen`}>
      <div className="space-y-4"><SettingRow label="Minuten"><Stepper label={`${label} in Minuten`} value={draft} onChange={setDraft} step={0.5} min={min} max={max} /></SettingRow><Button variant="primary" className="w-full" onClick={() => { onChange(draft); setOpen(false) }}>Übernehmen</Button></div>
    </Sheet>
  </fieldset>
}

export function RingTimer({ remainingSec, totalSec, paused = false, pulse = 'off', label, className = '', depletionColors = false, children }: {
  remainingSec: number; totalSec: number; paused?: boolean; pulse?: 'off' | 'gentle' | 'strong'; label?: string; className?: string; depletionColors?: boolean; children?: ReactNode
}) {
  const text = countdownLabel(remainingSec)
  const fraction = remainingFraction(remainingSec, totalSec)
  const circumference = 2 * Math.PI * 58
  const hue = fraction > 0.5 ? 36 + (fraction - 0.5) * 188 : fraction * 72
  const color = `hsl(${Math.round(hue)} 65% var(--depletion-lightness, 60%))`
  return <div data-depletion={depletionColors || undefined} className={`ring-timer ${paused ? 'is-paused' : ''} ${!paused && pulse !== 'off' ? `ring-pulse-${pulse}` : ''} ${className}`}>
    <svg viewBox="0 0 136 136" aria-hidden="true" className="ring-timer-art"><circle cx="68" cy="68" r="58" className="ring-track" /><circle cx="68" cy="68" r="58" className="ring-value" style={depletionColors ? { stroke: color } : undefined} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)} transform="rotate(-90 68 68)" /></svg>
    <div className="ring-timer-content"><span role="timer" aria-live="off" aria-label={label ?? `Restzeit ${text}`} className="ring-timer-number">{text}</span>{paused && <span className="ring-timer-pause"><span aria-hidden="true">Ⅱ </span><span>Pausiert</span></span>}{children}</div>
  </div>
}

/** Call only after the existing persistence action has succeeded. */
export function notifySaved() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('anker:saved'))
}

export function SaveFeedback() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined
    const saved = () => { clearTimeout(timeout); setVisible(true); timeout = setTimeout(() => setVisible(false), 1800) }
    window.addEventListener('anker:saved', saved)
    return () => { window.removeEventListener('anker:saved', saved); clearTimeout(timeout) }
  }, [])
  return visible ? <span role="status" aria-live="polite" className="save-feedback pointer-events-none fixed right-4 z-40 rounded-full bg-surface-2 px-3 py-2 text-sm text-muted">Gespeichert</span> : null
}

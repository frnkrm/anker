import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { fromBerlinDateTimeInput, toBerlinDateTimeInput } from '../../core/evening'
import { TZ } from '../../core/time'
import type { InboxItem } from '../../core/types'
import { useApp } from '../../state/store'
import { Button, Card, TextInput } from './ui'

const timeFormatter = new Intl.DateTimeFormat('de-DE', {
  timeZone: TZ,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function eveningTimeLabel(at: number): string {
  return timeFormatter.format(at)
}

/** Auch auf Geräten mit einer anderen Zeitzone bleibt dies Berliner Wandzeit. */
export function ScheduledAtInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm text-muted">{label}</span>
      <TextInput type="datetime-local" aria-label={label} required value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="block text-xs text-muted">Uhrzeit in Berlin</span>
    </label>
  )
}

function RescheduleThought({ item, pending, onSave }: { item: InboxItem; pending: boolean; onSave: (at: number, notify: boolean) => Promise<void> }) {
  const [at, setAt] = useState(() => toBerlinDateTimeInput(item.reviewAt!))
  const [notify, setNotify] = useState(item.reviewNotify ?? false)
  const [error, setError] = useState('')
  return (
    <form
      className="mt-3 space-y-3"
      aria-label={`Zeit ändern: ${item.text}`}
      onSubmit={async (e) => {
        e.preventDefault()
        if (pending) return
        const utc = fromBerlinDateTimeInput(at)
        if (!Number.isFinite(utc) || utc <= Date.now()) {
          setError('Wähle einen gültigen Zeitpunkt in der Zukunft.')
          return
        }
        setError('')
        await onSave(utc, notify)
      }}
    >
      <ScheduledAtInput label="Neuer Zeitpunkt" value={at} onChange={setAt} />
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        <span>Einmal erinnern</span>
      </label>
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      <Button type="submit" disabled={pending}>Zeit speichern</Button>
    </form>
  )
}

/** Dieselben Inbox-Einträge werden hier nur bis zur gewählten Zeit zurückgestellt. */
export function ParkedThoughts({ items, now, openInInbox = false }: { items: InboxItem[]; now: number; openInInbox?: boolean }) {
  const st = useApp()
  const nav = useNavigate()
  const pendingRef = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const run = async (action: () => Promise<void>, after?: () => void) => {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setError('')
    try {
      await action()
      after?.()
    } catch {
      setError('Die Änderung konnte nicht sicher gespeichert werden. Bitte versuche es erneut.')
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      {error && <p role="alert" className="px-1 text-sm text-warm">{error}</p>}
      {items.map((item) => (
        <Card key={item.id}>
          <p className="whitespace-pre-wrap break-words text-lg">{item.text}</p>
          <p className="mt-1 text-sm text-muted">
            {item.reviewAt! <= now ? 'Bereit zum Ansehen' : 'Wieder ansehen'} · <time dateTime={new Date(item.reviewAt!).toISOString()}>{eveningTimeLabel(item.reviewAt!)}</time>
          </p>
          {item.reviewNotify && <p className="mt-1 text-xs text-muted">Einmalige Erinnerung gewählt</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => void run(
                () => st.updateInbox(item.id, { reviewAt: undefined, reviewNotify: false }),
                () => { if (openInInbox) nav('/inbox') },
              )}
            >
              Jetzt ansehen
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} aria-label={`Gedanke entfernen: ${item.text}`} onClick={() => void run(() => st.removeInbox(item.id))}>
              Entfernen
            </Button>
          </div>
          <details className="mt-2">
            <summary className="min-h-11 cursor-pointer content-center text-sm text-muted">Zeit ändern</summary>
            <RescheduleThought item={item} pending={pending} onSave={(at, notify) => run(() => st.updateInbox(item.id, { reviewAt: at, reviewNotify: notify }))} />
          </details>
        </Card>
      ))}
    </div>
  )
}

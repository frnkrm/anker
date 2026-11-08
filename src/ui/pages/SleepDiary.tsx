import { useRef, useState } from 'react'
import { fromBerlinDateTimeInput, toBerlinDateTimeInput } from '../../core/evening'
import { sleepNightFor, sleepOverview, SLEEP_EVENTS, type SleepEvent } from '../../core/sleepDiary'
import { addDays, fmtDuration, todayBerlin, TZ } from '../../core/time'
import type { SleepDiaryEntry } from '../../core/types'
import { useNow } from '../../state/hooks'
import { useApp } from '../../state/store'
import { Button, Card, DateField, MoreInfo, Section } from '../components/ui'
import { HubContent } from '../components/HubContent'

const LABEL: Record<SleepEvent, string> = { sleepyAt: 'Müde geworden', bedAt: 'Ins Bett gegangen', wakeAt: 'Aufgestanden' }
const NOW_LABEL: Record<SleepEvent, string> = { sleepyAt: 'Jetzt müde', bedAt: 'Jetzt ins Bett', wakeAt: 'Jetzt aufgestanden' }
const format = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const nightDate = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' })
const nightLabel = (date: string) => `auf ${nightDate.format(new Date(`${addDays(date, 1)}T12:00:00Z`))}`
const draftFor = (entry: SleepDiaryEntry): Record<SleepEvent, string> => ({
  sleepyAt: entry.sleepyAt === undefined ? '' : toBerlinDateTimeInput(entry.sleepyAt),
  bedAt: entry.bedAt === undefined ? '' : toBerlinDateTimeInput(entry.bedAt),
  wakeAt: entry.wakeAt === undefined ? '' : toBerlinDateTimeInput(entry.wakeAt),
})

export default function SleepDiary({ embedded = false }: { embedded?: boolean } = {}) {
  const st = useApp()
  const now = useNow()
  const [date, setDate] = useState(() => sleepNightFor('bedAt', Date.now()))
  const [draft, setDraft] = useState(() => draftFor(st.local.sleepDiary[date] ?? {}))
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const pick = (next: string) => { setDate(next); setDraft(draftFor(st.local.sleepDiary[next] ?? {})); setError(''); setMessage('') }
  const run = async (action: () => Promise<void>, success: string) => {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setError('')
    setMessage('')
    try { await action(); setMessage(success) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Eingabe konnte nicht gespeichert werden.') }
    finally { pendingRef.current = false; setPending(false) }
  }
  const rows = sleepOverview(st.local.sleepDiary, sleepNightFor('bedAt', now))

  return (
    <HubContent className="settings-page" title="Schlafüberblick" back="/abend" embedded={embedded}>
      <p className="text-muted">Deine eigenen Angaben zu Müdigkeit, Bett und Aufstehen. Du trägst nur ein, was du festhalten möchtest.</p>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Einen Zeitpunkt festhalten</h2>
        <div className="flex flex-wrap gap-2">
          {SLEEP_EVENTS.map((event) => <Button key={event} disabled={pending} onClick={() => {
            const at = Date.now()
            const night = sleepNightFor(event, at)
            const entry = { ...st.local.sleepDiary[night], [event]: at }
            void run(async () => {
              await st.saveSleepEntry(night, entry)
              setDate(night)
              setDraft(draftFor(entry))
            }, `${LABEL[event]} gespeichert · Nacht ${nightLabel(night)}.`)
          }}>{NOW_LABEL[event]}</Button>)}
        </div>
        <MoreInfo><p>Müdigkeit und Bett vor 04:00 gehören zum Vorabend. „Jetzt aufgestanden“ gehört zur vorigen Kalendernacht. Du kannst alle Angaben unten korrigieren.</p></MoreInfo>
      </Card>
      {error && <p role="alert" className="text-warm">{error}</p>}
      {message && <p role="status" className="text-accent">{message}</p>}
      <Card>
        <Button aria-expanded={editing} onClick={() => setEditing(!editing)}>Nachtragen und korrigieren</Button>
        {editing && <form aria-label="Schlafzeiten korrigieren" className="mt-4 space-y-4" onSubmit={(event) => {
          event.preventDefault()
          const entry: SleepDiaryEntry = {}
          for (const key of SLEEP_EVENTS) {
            if (!draft[key]) continue
            const at = fromBerlinDateTimeInput(draft[key])
            if (!Number.isFinite(at)) { setError('Prüfe die Datums- und Zeitangaben.'); return }
            entry[key] = at
          }
          void run(() => st.saveSleepEntry(date, entry), 'Deine Angaben wurden gespeichert.')
        }}>
          <DateField label="Nacht vom" disabled={pending} required value={date} max={todayBerlin(now)} onChange={pick} />
          {date && <p className="text-sm text-muted">Nacht {nightLabel(date)}</p>}
          {SLEEP_EVENTS.map((key) => <DateField key={key} type="datetime-local" label={LABEL[key]} disabled={pending} value={draft[key]} onChange={(value) => setDraft({ ...draft, [key]: value })} />)}
          <p className="text-sm text-muted">Noch nicht bekannte Zeitpunkte bleiben leer. Müdigkeit kann vor oder nach dem Zubettgehen auftreten.</p>
          <Button type="submit" variant="primary" className="w-full" disabled={pending}>Angaben speichern</Button>
          {st.local.sleepDiary[date] && <Button variant="ghost" disabled={pending} className="w-full" onClick={() => void run(async () => { await st.removeSleepEntry(date); setDraft(draftFor({})) }, 'Die Angaben dieser Nacht wurden gelöscht.')}>Angaben dieser Nacht löschen</Button>}
        </form>}
      </Card>
      <Section title="Sieben Nächte" hint="Der Abstand zwischen Bett und Aufstehen ist keine gemessene Schlafdauer.">
        {rows.map((row) => {
          const filled = SLEEP_EVENTS.some((key) => row.entry[key] !== undefined)
          const edit = () => { pick(row.date); setEditing(true); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }
          if (!filled) return <button type="button" key={row.date} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-left text-sm text-muted" aria-label={`Nacht ${row.date} bearbeiten`} onClick={edit}><span>Nacht {nightLabel(row.date)}</span><span>Keine Angaben</span></button>
          return <details key={row.date} className="rounded-2xl border border-line bg-surface p-3">
            <summary className="min-h-11 py-2 font-medium">Nacht {nightLabel(row.date)}{row.bedToWakeMin !== undefined && <span className="block text-sm font-normal text-muted">Bett bis Aufstehen: {fmtDuration(row.bedToWakeMin)}</span>}</summary>
            <dl className="mt-2 space-y-1 text-sm">{SLEEP_EVENTS.map((key) => <div key={key} className="flex flex-wrap justify-between gap-x-4"><dt className="text-muted">{LABEL[key]}</dt><dd>{row.entry[key] === undefined ? 'nicht eingetragen' : format.format(row.entry[key])}</dd></div>)}</dl>
            <Button size="sm" variant="ghost" className="mt-2" disabled={pending} aria-label={`Nacht ${row.date} bearbeiten`} onClick={edit}>Bearbeiten</Button>
          </details>
        })}
      </Section>
      <MoreInfo><p>Diese Angaben bleiben auf diesem Gerät und werden nicht synchronisiert. Deine Datensicherung enthält sie. Es entstehen keine Punkte oder Serien.</p></MoreInfo>
    </HubContent>
  )
}

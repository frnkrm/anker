import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { nextEveningTime, fromBerlinDateTimeInput, toBerlinDateTimeInput } from '../../core/evening'
import { fmtTime } from '../../core/time'
import type { TomorrowStep } from '../../core/types'
import { useNow } from '../../state/hooks'
import { isNative } from '../../platform/native'
import { useApp } from '../../state/store'
import { eveningTimeLabel, ParkedThoughts, ScheduledAtInput } from '../components/EveningTools'
import { Button, Card, Checkbox, MoreInfo, Row, Section, TextInput } from '../components/ui'
import { HubContent } from '../components/HubContent'

function ReminderChoice({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <Checkbox checked={checked} onChange={onChange}>Einmal erinnern</Checkbox>
}

function ReminderHint() {
  return <p className="text-xs text-muted">{isNative()
    ? <>Für den Hinweis muss die Benachrichtigungsfreigabe erlaubt sein. <Link to="/check" className="underline">Freigabe prüfen</Link></>
    : 'Erinnerungen bei geschlossener App sind in der Android-App verfügbar.'} Ruhezeiten gelten weiter.</p>
}

function ParkThoughtForm({ onSaved }: { onSaved: () => void }) {
  const st = useApp()
  const [text, setText] = useState('')
  const [at, setAt] = useState(() => toBerlinDateTimeInput(nextEveningTime(Date.now())))
  const [notify, setNotify] = useState(false)
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [error, setError] = useState('')

  return (
    <form
      className="mt-4 space-y-3"
      aria-label="Idee für morgen parken"
      onSubmit={async (e) => {
        e.preventDefault()
        if (pendingRef.current) return
        const utc = fromBerlinDateTimeInput(at)
        if (!text.trim() || !Number.isFinite(utc) || utc <= Date.now()) {
          setError('Trage einen Gedanken und einen gültigen Zeitpunkt in der Zukunft ein.')
          return
        }
        pendingRef.current = true
        setPending(true)
        setError('')
        try {
          await st.parkThought(text, utc, notify)
          st.showToast('Geparkt. Du kannst den Gedanken jederzeit früher ansehen.')
          onSaved()
        } catch {
          setError('Der Gedanke konnte nicht sicher gespeichert werden. Deine Eingabe bleibt hier.')
        } finally {
          pendingRef.current = false
          setPending(false)
        }
      }}
    >
      <label className="block space-y-1">
        <span className="block text-sm text-muted">Gedanke für später</span>
        <textarea aria-label="Gedanke für später" required rows={3} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl bg-surface-2 px-3 py-3 text-base" placeholder="Was möchtest du festhalten?" />
      </label>
      <ScheduledAtInput label="Wieder ansehen am" value={at} onChange={setAt} />
      <ReminderChoice checked={notify} onChange={setNotify} />
      <MoreInfo><ReminderHint /></MoreInfo>
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Wird gespeichert …' : 'Gedanken parken'}</Button>
    </form>
  )
}

function TomorrowStepForm({ onSaved }: { onSaved: () => void }) {
  const st = useApp()
  const [title, setTitle] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [at, setAt] = useState(() => toBerlinDateTimeInput(nextEveningTime(Date.now(), 18 * 60)))
  const [remind, setRemind] = useState(false)
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [error, setError] = useState('')

  return (
    <form
      className="mt-4 space-y-3"
      aria-label="Morgen hier weitermachen"
      onSubmit={async (e) => {
        e.preventDefault()
        if (pendingRef.current) return
        const utc = fromBerlinDateTimeInput(at)
        if (!title.trim() || !nextStep.trim() || !Number.isFinite(utc) || utc <= Date.now()) {
          setError('Trage eine Aktivität, einen nächsten Schritt und einen gültigen Zeitpunkt in der Zukunft ein.')
          return
        }
        pendingRef.current = true
        setPending(true)
        setError('')
        try {
          await st.saveTomorrowStep(title, nextStep, utc, remind)
          st.showToast('Dein nächster Schritt ist gespeichert.')
          onSaved()
        } catch {
          setError('Der nächste Schritt konnte nicht sicher gespeichert werden. Deine Eingabe bleibt hier.')
        } finally {
          pendingRef.current = false
          setPending(false)
        }
      }}
    >
      <label className="block space-y-1">
        <span className="block text-sm text-muted">Freizeitaktivität</span>
        <TextInput aria-label="Freizeitaktivität" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Zum Beispiel: am Modell weiterbauen" />
      </label>
      <label className="block space-y-1">
        <span className="block text-sm text-muted">Nächster kleiner Schritt</span>
        <TextInput aria-label="Nächster kleiner Schritt" required value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Zum Beispiel: die zwei Teile bereitlegen" />
      </label>
      <ScheduledAtInput label="Weiter am" value={at} onChange={setAt} />
      <ReminderChoice checked={remind} onChange={setRemind} />
      <MoreInfo><ReminderHint /></MoreInfo>
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Wird gespeichert …' : 'Nächsten Schritt speichern'}</Button>
    </form>
  )
}

function TomorrowSteps({ items, now }: { items: TomorrowStep[]; now: number }) {
  const st = useApp()
  const pendingRef = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const run = async (action: () => Promise<void>) => {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setError('')
    try {
      await action()
    } catch {
      setError('Die Änderung konnte nicht sicher gespeichert werden. Bitte versuche es erneut.')
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }
  const unfinished = items.filter((item) => item.doneAt === undefined).sort((a, b) => a.resumeAt - b.resumeAt)
  const groups = [
    { title: 'Bereit zum Weitermachen', entries: unfinished.filter((item) => item.resumeAt <= now) },
    { title: 'Geparkt', entries: unfinished.filter((item) => item.resumeAt > now) },
  ]
  return (
    <div className="space-y-4">
      {error && <p role="alert" className="px-1 text-sm text-warm">{error}</p>}
      {groups.map(({ title, entries }) => entries.length > 0 && (
        <Section key={title} title={title} hint="Bleibt hier, bis du es erledigst oder entfernst.">
          {entries.map((item) => (
            <Card key={item.id}>
              <h3 className="break-words text-lg font-semibold">{item.title}</h3>
              <p className="mt-1 whitespace-pre-wrap break-words">Nächster Schritt: {item.nextStep}</p>
              <p className="mt-2 text-sm text-muted">Ab <time dateTime={new Date(item.resumeAt).toISOString()}>{eveningTimeLabel(item.resumeAt)}</time></p>
              {item.remind && <p className="mt-1 text-xs text-muted">Einmalige Erinnerung gewählt</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={pending} aria-label={`Erledigt: ${item.title}`} onClick={() => void run(async () => { await st.finishTomorrowStep(item.id); st.showToast('Als erledigt gespeichert.') })}>Erledigt</Button>
                <Button size="sm" variant="ghost" disabled={pending} aria-label={`Wiedereinstieg entfernen: ${item.title}`} onClick={() => void run(() => st.removeTomorrowStep(item.id))}>Entfernen</Button>
              </div>
            </Card>
          ))}
        </Section>
      ))}
    </div>
  )
}

/** Freiwillige Hilfen zum Ablegen und späteren Wiederaufnehmen, ohne neue Hauptaktion. */
export default function Evening({ embedded = false }: { embedded?: boolean } = {}) {
  const st = useApp()
  const now = useNow()
  const [parking, setParking] = useState(false)
  const [resuming, setResuming] = useState(false)
  const parked = st.inbox.filter((item) => item.status === 'open' && Number.isFinite(new Date(item.reviewAt ?? NaN).getTime())).sort((a, b) => a.reviewAt! - b.reviewAt!)
  const dueCount = parked.filter((item) => item.reviewAt! <= now).length
  const windDown = st.settings.support.windDown

  return (
    <HubContent title="Gedanken für später" back="/mehr" embedded={embedded}>
      <p className="px-1 text-muted">Festhalten, was dir im Kopf bleibt. Du entscheidest, wann du wieder hinschaust.</p>

      {windDown.enabled && (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold">Dein sanfter Abendübergang</h2>
          <p className="text-sm text-muted">Gewählt ab {fmtTime(windDown.at)}</p>
          <p className="whitespace-pre-wrap break-words text-lg">{windDown.activity}</p>

        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold">Ideen für morgen parken</h2>
        <p className="mt-1 text-sm text-muted">Ein Gedanke bleibt gespeichert und kommt zur gewählten Zeit in Gedanken zurück. Daraus wird keine Aufgabe.</p>
        <Button className="mt-3" aria-expanded={parking} aria-controls="park-thought-form" onClick={() => setParking(!parking)}>{parking ? 'Eingabe schließen' : 'Idee parken'}</Button>
        {parking && <div id="park-thought-form"><ParkThoughtForm onSaved={() => setParking(false)} /></div>}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Morgen hier weitermachen</h2>
        <p className="mt-1 text-sm text-muted">Halte für eine Freizeitaktivität fest, wo du weitermachen möchtest. Die Notiz bleibt auf diesem Gerät.</p>
        <Button className="mt-3" aria-expanded={resuming} aria-controls="tomorrow-step-form" onClick={() => setResuming(!resuming)}>{resuming ? 'Eingabe schließen' : 'Nächsten Schritt merken'}</Button>
        {resuming && <div id="tomorrow-step-form"><TomorrowStepForm onSaved={() => setResuming(false)} /></div>}
      </Card>

      {dueCount > 0 && <Row label={`${dueCount} ${dueCount === 1 ? 'Gedanke ist' : 'Gedanken sind'} bereit`} sub="In Gedanken ansehen" to="/inbox" />}

      <TomorrowSteps items={st.local.tomorrowSteps} now={now} />

      {parked.length > 0 && <details className="space-y-2 rounded-2xl border border-line p-3"><summary className="min-h-11 py-2 font-medium">Geparkte Gedanken ({parked.length})</summary><ParkedThoughts items={parked} now={now} openInInbox /></details>}

      <MoreInfo summary="Abend & Schlaf"><Row label="Abend anpassen" to="/einstellungen/abend" /><Row label="Schlafüberblick" to="/schlaf" /></MoreInfo>
    </HubContent>
  )
}

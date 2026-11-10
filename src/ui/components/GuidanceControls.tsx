import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { guidancePreferences, type GuidanceView } from '../../core/guidance'
import { openSteps } from '../../core/now'
import { addDays, fmtTime } from '../../core/time'
import { confirmBedtimeByQr, confirmMorningActivity, requestEmergencyExtensionByQr, startSleepNoise, stopSleepNoise } from '../../platform/guidance'
import { useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { useGuidanceView } from '../../state/useGuidanceView'
import { CaptureDictation } from './ExtraControls'
import { Button, Sheet, TextInput } from './ui'
import { BedtimePrompt } from './BedtimePrompt'
import { BedtimeFollowUpCard } from './BedtimeFollowUpCard'

const promptedBrainDumps = new Set<string>()

export function BrainDumpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const st = useApp()
  const { date } = useToday()
  const [text, setText] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  return <Sheet open={open} onClose={onClose} title="Für morgen parken">
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault()
      if (pending.current) return
      if (!text.trim()) { setError('Was möchtest du für morgen festhalten? Ein kurzer Satz reicht.'); return }
      pending.current = true; setBusy(true); setError('')
      void st.saveBrainDump(date, text, nextStep).then(id => {
        if (!id) { setError('Die Notiz konnte noch nicht gespeichert werden. Dein Text bleibt hier.'); return }
        setText(''); setNextStep(''); onClose(); st.showToast('Für morgen gemerkt. Bleibt auf diesem Gerät.')
      }).catch(() => setError('Die Notiz konnte noch nicht gespeichert werden. Dein Text bleibt hier.')).finally(() => { pending.current = false; setBusy(false) })
    }}>
      <p className="text-muted">Dein Parkplatz für offene Gedanken. Nach der wirklich erledigten Morgenroutine liegt die Notiz wieder bereit.</p>
      <label className="block space-y-1"><span>Was soll für morgen bleiben?</span><textarea aria-label="Gedanken für morgen" value={text} onChange={event => setText(event.target.value)} maxLength={500} rows={4} className="min-h-28 w-full min-w-0 rounded-xl bg-surface-2 p-3 text-base" /></label>
      <CaptureDictation open={open} disabled={busy} onText={value => setText(current => [current.trim(), value.trim()].filter(Boolean).join(' ').slice(0, 500))} />
      <label className="block space-y-1"><span>Ein nächster Schritt, wenn du möchtest</span><TextInput aria-label="Nächster Schritt für morgen" value={nextStep} onChange={event => setNextStep(event.target.value)} maxLength={500} /></label>
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Für morgen parken'}</Button>
      <p className="text-sm text-muted">Keine Erledigung, keine Punkte und keine zusätzliche Erinnerung.</p>
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    </form>
  </Sheet>
}

export function MorningBrainDump({ view: provided }: { view?: GuidanceView } = {}) {
  const calculated = useGuidanceView()
  const view = provided ?? calculated
  const st = useApp()
  const notes = view.brainDumpIds.map(id => st.local.tomorrowSteps.find(note => note.id === id)).filter(note => note !== undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!view.morningCompleted || !notes.length) return null
  return <section className="rounded-2xl border border-accent bg-accent-soft p-4 text-left" aria-label="Gestern für heute gemerkt">
    <h2 className="text-xl font-semibold">Gestern für heute gemerkt</h2>
    <ul className="mt-3 space-y-3">{notes.slice(0, 3).map(note => <li key={note.id} className="min-w-0 break-words"><p className="whitespace-pre-wrap font-medium">{note.title}</p><p className="whitespace-pre-wrap text-sm">{note.nextStep}</p></li>)}</ul>
    <Button variant="ghost" className="mt-3 w-full" disabled={busy} onClick={async () => {
      setBusy(true); setError('')
      try { await st.markBrainDumpShown(addDays(view.date, -1)); await st.markBrainDumpShown(view.date) }
      catch { setError('Die Ansicht konnte noch nicht bestätigt werden. Die Notiz bleibt erhalten.') }
      finally { setBusy(false) }
    }}>Gesehen – Notiz behalten</Button>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
  </section>
}

/** Only the one current cue appears; no automatic task completion or repeated modal reopening. */
export function GuidanceHomeExtras() {
  const view = useGuidanceView()
  const st = useApp()
  const preferences = guidancePreferences(st.settings.guidance)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!preferences.enabled || view.phase !== 'BRAIN_DUMP_T10') return
    const key = `${view.date}:brain-dump`
    if (promptedBrainDumps.has(key) || document.querySelector('[role="dialog"][aria-modal="true"]')) return
    promptedBrainDumps.add(key)
    setOpen(true)
  }, [preferences.enabled, view.date, view.phase, view.remainingSeconds])
  if (!preferences.enabled) return null
  const evening = ['EVENING_WIND_DOWN', 'WIND_DOWN_T30', 'BRAIN_DUMP_T10'].includes(view.phase)
  const sentence = st.local.guidance?.ifThen?.sentence
  return <>
    {evening && sentence && <p className="guidance-if-then text-sm text-muted">{sentence}</p>}
    {view.phase === 'WIND_DOWN_T30' && <p className="text-sm text-muted" role="status">Dein Abendübergang hat begonnen. Ein Speicherpunkt macht das Aufhören leichter.</p>}
    {view.phase === 'BRAIN_DUMP_T10' && <Button variant="ghost" className="w-full" onClick={() => setOpen(true)}>Gedanken für morgen parken</Button>}
    <MorningBrainDump view={view} />
    <BrainDumpSheet open={open} onClose={() => setOpen(false)} />
  </>
}

export function GuidanceNightPage({ view }: { view: GuidanceView }) {
  const st = useApp()
  const { date, plan, log, m } = useToday(1000)
  const preferences = guidancePreferences(st.settings.guidance)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [options, setOptions] = useState(false)
  const [dump, setDump] = useState(false)
  const nightDates = Object.entries(st.local.guidance?.days ?? {}).filter(([, day]) => day.nightLockedAt !== undefined).sort((a, b) => (b[1].nightLockedAt ?? 0) - (a[1].nightLockedAt ?? 0))
  const isMorning = view.phase === 'NIGHT_LOCK' && nightDates[0]?.[0] !== date && m >= plan.wake && m < plan.bed
  const run = async (action: () => Promise<unknown>, success?: string) => {
    if (busy) return
    setBusy(true); setMessage('')
    try { const result = await action(); if (result !== false && success) setMessage(success) }
    catch { setMessage('Das hat noch nicht geklappt. Deine bisherigen Angaben bleiben erhalten; versuche es erneut.') }
    finally { setBusy(false) }
  }
  return <div className="guidance-night-page mx-auto flex min-h-[calc(100dvh-5rem)] max-w-xl flex-col justify-center gap-5 px-5 pb-8 safe-top" data-testid="guidance-night-page">
    <p className="text-sm text-muted">{isMorning ? 'Ein kleiner Beginn' : `Bettzeit ${fmtTime(plan.bed)}`}</p>
    <h1 className="break-words text-4xl font-semibold">{isMorning ? 'Dein erster Schritt wartet' : view.phase === 'BEDTIME_HARD_CUT' ? 'Den Abend abschließen' : 'Gute Nacht'}</h1>
    {view.phase === 'BEDTIME_HARD_CUT' && preferences.bedtimeQr ? <>
      <p className="text-muted">Dein Anker-Code im Bad oder Schlafzimmer bestätigt den Übergang.</p>
      <Button variant="primary" size="xl" disabled={busy} className="w-full" onClick={() => void run(confirmBedtimeByQr, 'Abendübergang bestätigt.')}>Anker-QR scannen</Button>
    </> : view.phase === 'BEDTIME_HARD_CUT' && openSteps(plan, log, 'evening').length > 0 ? <Link to="/fokus/evening" className="flex min-h-20 items-center justify-center rounded-3xl bg-accent px-5 py-4 text-center text-2xl font-semibold text-accent-ink">Abendroutine beginnen</Link>
      : isMorning ? <Link to="/fokus/morning" className="flex min-h-20 items-center justify-center rounded-3xl bg-accent px-5 py-4 text-center text-2xl font-semibold text-accent-ink">Morgenroutine beginnen</Link>
      : !log.bedAt ? <BedtimePrompt available delayMinutes={st.settings.sleep.fallAsleepMin} nowMs={Date.now()} integrated enabled={st.settings.sleep.bedtimePromptEnabled ?? false} followUpsEnabled={st.settings.sleep.bedtimeFollowUpsEnabled ?? false} onBed={() => st.mark(date, 'bedAt')} />
        : <p role="status" className="text-muted">Für jetzt ist hier alles bereit.</p>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
    <BedtimeFollowUpCard />
    <Button variant="ghost" className="w-full" onClick={() => setOptions(true)}>Optionen öffnen</Button>
    <Sheet open={options} onClose={() => setOptions(false)} title="Deine Nacht">
      <div className="space-y-3">
        <p className="text-muted">Die Begleitung bleibt deine Wahl. Eine QR-Notverlängerung gilt für den gekoppelten PC.</p>
        <Button className="w-full" disabled={busy} onClick={() => void run(() => requestEmergencyExtensionByQr(15), 'Notverlängerung angefragt. Den Empfang siehst du beim PC-Begleiter.')}>15 Minuten per QR verlängern</Button>
        <Button className="w-full" onClick={() => { setOptions(false); setDump(true) }}>Gedanken für morgen parken</Button>
        {preferences.sleepNoise && <Button className="w-full" disabled={busy} onClick={() => void run(startSleepNoise, 'Schlafrauschen angefragt.')}>Schlafrauschen starten</Button>}
        <Button className="w-full" disabled={busy} onClick={() => void run(stopSleepNoise, 'Schlafrauschen beendet.')}>Schlafrauschen beenden</Button>
        <Button className="w-full" disabled={busy} onClick={() => void run(confirmMorningActivity, 'Deine Rückmeldung ist angekommen.')}>Ich bin wach</Button>
        <Link to="/einstellungen/begleitung" className="flex min-h-11 items-center text-accent">Begleitung einstellen oder ausschalten</Link>
        <Link to="/fokus/morning" className="flex min-h-11 items-center text-muted">Morgenroutine öffnen</Link>
        <Link to="/" onClick={() => setOptions(false)} className="flex min-h-11 items-center text-muted">Zur ruhigen Ansicht</Link>
        {message && <p role="status" className="text-sm text-muted">{message}</p>}
      </div>
    </Sheet>
    <BrainDumpSheet open={dump} onClose={() => setDump(false)} />
  </div>
}

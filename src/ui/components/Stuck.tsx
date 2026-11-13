import { useRef, useState } from 'react'
import { createCountdown, pauseCountdown, remainingMs, resumeCountdown } from '../../core/focus'
import { simplificationOffer, stuckLadder, supportContextKey, type NextAction } from '../../core/support'
import { supportInput, useApp } from '../../state/store'
import { useNow } from '../../state/hooks'
import { useFocusClock } from '../../state/useFocusClock'
import { Button, RingTimer, Sheet } from './ui'

/** Eigener Hilfetimer. Öffnen, Pause und Fertig verändern weder Fokus noch Aufgabenstatus. */
export function StuckSheet({ open, onClose, action }: { open: boolean; onClose: () => void; action: NextAction }) {
  const st = useApp()
  const [captured, setCaptured] = useState({ shown: open, action, date: supportInput(st).plan.date, focus: st.local.focus?.target })
  // Während einer offenen Hilfe bleibt die gewählte Aufgabe stabil, auch wenn Jetzt neu plant.
  if (captured.shown !== open) setCaptured({ shown: open, action: open ? action : captured.action, date: open ? supportInput(st).plan.date : captured.date, focus: open ? st.local.focus?.target : captured.focus })
  const source = captured.action
  const ladder = stuckLadder(source)
  const key = supportContextKey(source, captured.date, captured.focus)
  const saved = st.local.stuck?.contextKey === key ? st.local.stuck : undefined
  const level = Math.min(saved?.level ?? 0, ladder.length - 1)
  const step = ladder[level]!
  const timer = saved?.timer
  const now = useFocusClock(timer, open)
  const left = timer ? Math.ceil(remainingMs(timer, now) / 1000) : step.seconds
  const running = timer?.status === 'running'
  const over = timer !== undefined && left === 0
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true); setError('')
    try { await action() } catch { setError('Die Hilfezeit konnte nicht sicher gespeichert werden. Deine Aufgabe bleibt erhalten.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  const start = (again = false) => run(() => st.saveStuck((current) => {
    const previous = current?.contextKey === key && current.level === level ? current.timer : undefined
    return { contextKey: key, level, timer: previous?.status === 'paused' && !again ? resumeCountdown(previous, Date.now()) : createCountdown(step.seconds, Date.now()) }
  }))
  const smaller = () => run(() => st.saveStuck(() => ({ contextKey: key, level: Math.min(level + 1, ladder.length - 1) })))
  const pause = () => run(() => st.saveStuck((current) => current?.contextKey === key && current.timer
    ? { ...current, timer: pauseCountdown(current.timer, Date.now()) } : current))
  const finish = () => run(async () => {
    await st.saveStuck((current) => current?.contextKey === key ? undefined : current)
    onClose()
  })

  return (
    <Sheet open={open} onClose={onClose} title="Ganz klein anfangen">
      <p className="text-muted">Wenn es dir hilft: einmal ausatmen oder beide Füße auf den Boden stellen.</p>
      <p className="mt-3 text-3xl font-semibold leading-snug">{step.text}</p>
      <RingTimer remainingSec={left} totalSec={step.seconds} paused={timer?.status === 'paused'} pulse={st.settings.focus.pulse} label="Restzeit der kleinen Hilfe" />
      {error && <p role="alert" className="my-2 text-sm text-warm">{error}</p>}
      {over ? (
        <div className="space-y-2">
          <p className="text-center text-lg">Zeitfenster zu Ende. Du entscheidest, wie du weitermachst.</p>
          <Button variant="primary" size="lg" className="w-full" disabled={busy} onClick={() => void finish()}>Weiter</Button>
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" disabled={busy} onClick={() => void start(true)}>Nochmal</Button>
            {level < ladder.length - 1 && <Button size="lg" className="flex-1" disabled={busy} onClick={() => void smaller()}>Etwas kleiner</Button>}
          </div>
        </div>
      ) : running ? (
        <div className="space-y-2">
          <Button variant="primary" size="xl" className="w-full" disabled={busy} onClick={() => void finish()}>Fertig</Button>
          <div className="flex gap-2">
            {level < ladder.length - 1 && <Button size="lg" className="flex-1" disabled={busy} onClick={() => void smaller()}>Etwas kleiner</Button>}
            <Button variant="ghost" size="lg" className="flex-1" disabled={busy} onClick={() => void pause()}>Pause</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {timer?.status === 'paused' && <p className="text-center text-muted">Pausiert. Die Restzeit bleibt erhalten.</p>}
          <Button variant="primary" size="xl" className="w-full" disabled={busy} onClick={() => void start()}>{timer?.status === 'paused' ? 'Weiter' : 'Starten'}</Button>
          {level < ladder.length - 1 && <Button size="lg" className="w-full" disabled={busy} onClick={() => void smaller()}>Etwas kleiner</Button>}
        </div>
      )}
      {open && <StuckModeOffer contextKey={key} onAccepted={onClose} />}
      {step.text !== source.title && <p className="mt-3 text-center text-sm text-muted">Deine Aufgabe bleibt: {source.title}</p>}
    </Sheet>
  )
}


/** Angebot nur innerhalb der bewusst geöffneten Hilfe, nie als neue Jetzt-Hauptaktion. */
function StuckModeOffer({ contextKey, onAccepted }: { contextKey: string; onAccepted: () => void }) {
  const st = useApp()
  const now = useNow(1000)
  const offer = simplificationOffer(supportInput(st, now), st.local)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!offer || offer.contextKey !== contextKey) return null
  const respond = async (choice: 'accept' | 'dismiss') => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const applied = await st.respondSupportOffer(offer.date, offer.revision, choice)
      if (!applied) { st.showToast('Das Angebot ist nicht mehr aktuell. Deine bisherige Wahl bleibt erhalten.'); return }
      if (choice === 'accept') onAccepted()
    } catch { setError('Die Wahl konnte noch nicht gespeichert werden. Versuche es erneut.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <section aria-label="Freiwillige Vereinfachung" className="mt-4 min-w-0 space-y-2 rounded-xl border border-line p-3 text-sm break-words">
    <p>Du hast für diesen Schritt „Etwas kleiner“ gewählt.</p>
    <p className="font-semibold">Soll „Einfach anfangen“ heute helfen?</p>
    <p>Bei Routinen steht dann die Starthilfe vorn. Alle Schritte und deine vorhandenen Timer bleiben erhalten.</p>
    <Button disabled={busy} className="w-full" onClick={() => void respond('accept')}>Für heute Einfach anfangen</Button>
    <Button disabled={busy} variant="ghost" className="w-full" onClick={() => void respond('dismiss')}>Heute ohne Angebot</Button>
    <p className="text-muted">Dieses Angebot bleibt danach heute aus. Es startet keinen Timer.</p>
    {error && <p role="alert">{error}</p>}
  </section>
}

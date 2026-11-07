import { useRef, useState } from 'react'
import { createCountdown, focusTargetKey, pauseCountdown, remainingMs, resumeCountdown, type FocusTarget } from '../../core/focus'
import { stuckLadder, type NextAction } from '../../core/support'
import { today, useApp } from '../../state/store'
import { useFocusClock } from '../../state/useFocusClock'
import { Button, Sheet } from './ui'

/** Sichtbarer Zeitverlauf, ruhig und ohne Rot. */
function Ring({ left, total }: { left: number; total: number }) {
  const r = 54
  const c = 2 * Math.PI * r
  return (
    <div className="relative mx-auto my-4 h-40 w-40" role="timer" aria-label={`${left} Sekunden übrig`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - left / Math.max(1, total))} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-4xl font-light tabular-nums">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
    </div>
  )
}

function contextKey(action: NextAction, date: string, focus?: FocusTarget): string {
  // Alte Elternmerker bleiben lesbar; nur ein konkreter Teil bekommt einen eigenen Schlüssel.
  const taskKey = (kind: 'task' | 'work', id: string, partId?: string) => partId ? focusTargetKey({ kind, id, partId }) : `${kind}:${id}`
  if (action.type === 'step') return `${date}:step:${action.routine}:${action.step.id}`
  if (action.type === 'task') return taskKey('task', action.task.id, focus?.kind === 'task' && focus.id === action.task.id ? focus.partId : undefined)
  if (action.type === 'worktask') return taskKey('work', action.task.id, focus?.kind === 'work' && focus.id === action.task.id ? focus.partId : undefined)
  if (action.type === 'resume') {
    const resume = action.resume
    if (resume.refId && (resume.kind === 'task' || resume.kind === 'work')) return taskKey(resume.kind, resume.refId, resume.partId)
    const routine = resume.kind === 'step' && resume.refId ? /^(\d{4}-\d{2}-\d{2}):(morning|evening):(.+)$/.exec(resume.refId) : undefined
    if (routine) return `${routine[1]}:step:${routine[2]}:${routine[3]}`
    return `resume:${resume.kind}:${resume.at}`
  }
  if (action.type === 'einsatz-running') return `session:${action.session.id}`
  if (['prep', 'go', 'underway', 'away', 'einsatz-start'].includes(action.type) && 'leg' in action) return `leg:${action.leg.commitment.id}`
  return `${date}:${action.type}`
}

/** Eigener Hilfetimer. Öffnen, Pause und Fertig verändern weder Fokus noch Aufgabenstatus. */
export function StuckSheet({ open, onClose, action }: { open: boolean; onClose: () => void; action: NextAction }) {
  const st = useApp()
  const [captured, setCaptured] = useState({ shown: open, action, date: today(), focus: st.local.focus?.target })
  // Während einer offenen Hilfe bleibt die gewählte Aufgabe stabil, auch wenn Jetzt neu plant.
  if (captured.shown !== open) setCaptured({ shown: open, action: open ? action : captured.action, date: open ? today() : captured.date, focus: open ? st.local.focus?.target : captured.focus })
  const source = captured.action
  const ladder = stuckLadder(source)
  const key = contextKey(source, captured.date, captured.focus)
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
      <Ring left={left} total={step.seconds} />
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
      {step.text !== source.title && <p className="mt-3 text-center text-sm text-muted">Deine Aufgabe bleibt: {source.title}</p>}
    </Sheet>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { countdownText, elapsedMs, focusTargetKey, pauseCountdown, remainingMs, resumeCountdown, type FocusTarget } from '../../core/focus'
import { nextHardTime } from '../../core/planner'
import { openSteps } from '../../core/now'
import { MODE_LABEL } from '../../core/support'
import { fmtTime, minutesOnPlanDay } from '../../core/time'
import type { FocusPulseMode, ResumePoint, RoutineId } from '../../core/types'
import { useToday } from '../../state/hooks'
import { useFocusClock, useFocusPulse } from '../../state/useFocusClock'
import { useApp } from '../../state/store'
import { InboxButton } from '../components/Shell'
import { TodayDifferent } from '../components/TodayDifferent'
import { Button, Progress } from '../components/ui'

const NEXT_PULSE: Record<FocusPulseMode, FocusPulseMode> = { off: 'gentle', gentle: 'strong', strong: 'off' }
const PULSE_LABEL: Record<FocusPulseMode, string> = { off: 'Puls aus', gentle: 'Puls sanft', strong: 'Puls deutlich' }

function legacyStart(key: string): number | undefined {
  try {
    const raw = localStorage.getItem(key)
    const at = raw === null ? NaN : Number(raw)
    return Number.isSafeInteger(at) && at > 0 && at <= Date.now() ? at : undefined
  } catch { return undefined }
}

/** Eine echte Routineninstanz; Zeitablauf beendet keinen Schritt und vergibt keine Punkte. */
export default function Focus() {
  const { routine = 'morning' } = useParams<{ routine: RoutineId }>()
  const r: RoutineId = routine === 'evening' ? 'evening' : 'morning'
  const { date, plan, log } = useToday()
  const st = useApp()
  const nav = useNavigate()
  const block = plan.blocks.find((candidate) => candidate.routine === r)
  const steps = block?.steps ?? []
  const step = openSteps(plan, log, r)[0]
  const stepId = step?.id
  const index = step ? steps.indexOf(step) : steps.length
  const stored = st.local.focus
  const matchesStep = stored?.target.kind === 'routine' && stored.target.date === date && stored.target.routine === r && stored.target.stepId === stepId
  const minimalMode = !!step?.useMinimal || !!(matchesStep && stored?.target.kind === 'routine' && stored.target.minimal)
  const target: FocusTarget | undefined = stepId ? { kind: 'routine', date, routine: r, stepId, minimal: minimalMode } : undefined
  const session = target && stored && focusTargetKey(stored.target) === focusTargetKey(target) ? stored : undefined
  const cur = minimalMode && step?.minimal ? step.minimal : step
  const seconds = (cur?.minutes ?? 0) * 60
  const now = useFocusClock(session?.timer)
  useFocusPulse(session, now)
  const m = minutesOnPlanDay(date, now)
  const [error, setError] = useState('')
  const [different, setDifferent] = useState(false)
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const ensureFocus = st.ensureFocus

  useEffect(() => {
    if (!stepId) return
    let cancelled = false
    const focusTarget: FocusTarget = { kind: 'routine', date, routine: r, stepId, minimal: minimalMode }
    const key = `anker.step.${date}.${r}.${stepId}`
    const legacy = useApp.getState().local.focus ? undefined : legacyStart(key)
    setError('')
    void ensureFocus(focusTarget, seconds, legacy).then(() => {
      const current = useApp.getState().local.focus
      if (legacy !== undefined && current && focusTargetKey(current.target) === focusTargetKey(focusTarget)) {
        try { localStorage.removeItem(key) } catch { /* Der bestätigte neue Stand bleibt im Repository. */ }
      }
    }).catch(() => { if (!cancelled) setError('Die Fokuszeit konnte nicht sicher gespeichert werden. Bitte versuche es erneut.') })
    return () => { cancelled = true }
  }, [date, r, stepId, minimalMode, seconds, ensureFocus, retry])

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true); setError('')
    try { await action() } catch { setError('Die Änderung konnte nicht sicher gespeichert werden. Bitte versuche es erneut.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  const hard = nextHardTime(plan, m)
  const toHard = hard ? hard.at - m : Infinity
  const mode = log.override.mode

  if (!step) {
    const reallyCompleted = steps.length > 0 && steps.every((item) => ['done', 'minimal'].includes(log.steps[`${r}:${item.id}`] ?? ''))
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center safe-top">
        <h1 className="text-4xl font-semibold">{reallyCompleted ? r === 'morning' ? 'Morgenroutine fertig' : 'Abendroutine fertig' : 'Für heute nichts mehr offen'}</h1>
        {!reallyCompleted && <p className="mt-3 text-muted">Deine Auswahl bleibt erhalten. Übersprungen oder heute nicht nötig wird nicht als erledigt gespeichert.</p>}
        <p className="mt-3 text-xl text-muted">
          {r === 'morning'
            ? plan.leave !== undefined ? `Losgehen um ${fmtTime(plan.leave)}.` : 'Genieß den Tag.'
            : plan.openEnd ? 'Für heute ist hier nichts mehr offen.'
              : m >= plan.bed ? 'Jetzt ist Zeit fürs Bett.'
                : m >= plan.pcStop ? `Zeit zum Runterkommen. Bett um ${fmtTime(plan.bed)}.` : `Jetzt Freizeit bis ${fmtTime(plan.pcStop)}.`}
        </p>
        <Button variant="primary" size="xl" className="mt-10 w-full" onClick={() => nav('/')}>Weiter</Button>
        <Link to={`/druck?typ=${r}`} className="mt-3 flex min-h-11 items-center text-muted">{r === 'morning' ? 'Morgenroutine drucken' : 'Abendroutine drucken'}</Link>
      </div>
    )
  }

  const title = minimalMode && step.minimal ? step.minimal.title : step.title
  const timer = session?.timer
  const left = timer ? Math.ceil(remainingMs(timer, now) / 1000) : Math.round(seconds)
  const done = (result: 'done' | 'minimal' | 'skipped') => run(async () => {
    await st.setStep(date, r, step.id, result)
    if (session) await st.clearFocus(session.id)
  })
  const captureContext: ResumePoint = { kind: 'step', title, refId: `${date}:${r}:${step.id}`, at: now, route: `/fokus/${r}` }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-6 safe-top">
      <header className="flex items-center justify-between gap-2 py-2">
        <Link to="/" className="grid h-12 w-12 place-items-center rounded-2xl text-2xl text-muted active:bg-surface-2" aria-label="Fokus-Modus verlassen">✕</Link>
        <span className="text-center text-muted">Schritt {index + 1} von {steps.length}{mode && mode !== 'normal' && <span className="block text-sm">{MODE_LABEL[mode]}</span>}</span>
        <div className="flex w-24 justify-end">
          <Link to={`/druck?typ=${r}`} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl text-muted" aria-label={r === 'morning' ? 'Morgenroutine drucken' : 'Abendroutine drucken'}>🖨️</Link>
          <InboxButton context={captureContext} />
        </div>
      </header>
      <Progress value={index / steps.length} />
      {toHard <= 15 && hard && <p className="mt-4 rounded-2xl bg-warm-soft px-4 py-3 text-center text-lg text-warm" role="status">Noch {Math.max(0, toHard)} Minuten bis {hard.label}</p>}
      {error && <div role="alert" className="mt-3 text-warm"><p>{error}</p><Button size="sm" onClick={() => setRetry((value) => value + 1)}>Erneut versuchen</Button></div>}

      <section className="flex flex-1 flex-col items-center justify-center py-6 text-center">
        <h1 className="break-words text-5xl leading-tight font-semibold">{title}</h1>
        <div className="mt-8 text-7xl font-light tabular-nums" role="timer" aria-label={`${Math.ceil(left / 60)} Minuten übrig`}>{timer ? countdownText(timer, now) : '…'}</div>
        {timer && <p className="mt-2 text-sm text-muted">{Math.floor(elapsedMs(timer, now) / 60_000)} min vergangen{timer.status === 'running' && ` · Zeitfenster bis ${new Date(timer.deadlineAt).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })}`}</p>}
        {timer?.status === 'paused' && <p className="mt-2 text-muted">Pausiert. Die Restzeit bleibt erhalten.</p>}
        {timer && left === 0 && <p className="mt-2 text-muted">Zeitfenster zu Ende. Du kannst in Ruhe weitermachen oder selbst abschließen.</p>}
        {timer && session && left > 0 && <Button size="sm" className="mt-3" disabled={busy} onClick={() => void run(() => st.updateFocus(session.id, (current) => ({ ...current, timer: current.timer.status === 'running' ? pauseCountdown(current.timer, Date.now()) : resumeCountdown(current.timer, Date.now()) })))}>{timer.status === 'running' ? 'Pause' : 'Weiter'}</Button>}
        <button type="button" disabled={busy} className="mt-4 min-h-11 rounded-xl px-3 text-sm text-muted" aria-label={`Fokus-Puls umschalten, aktuell ${PULSE_LABEL[st.settings.focus.pulse]}`} onClick={() => void run(() => st.saveSettings((settings) => ({ ...settings, focus: { ...settings.focus, pulse: NEXT_PULSE[settings.focus.pulse] } })))}>{PULSE_LABEL[st.settings.focus.pulse]}</button>
      </section>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setDifferent(true)}>Heute anders</Button>
      <TodayDifferent open={different} onClose={() => setDifferent(false)} onApplied={() => nav('/')} date={date} m={m} action={{ type: 'step', title, routine: r, step, index, total: steps.length }} />

      <div className="space-y-3">
        <Button variant="primary" size="xl" className="w-full" disabled={busy || !session} onClick={() => void done(minimalMode ? 'minimal' : 'done')}>Erledigt</Button>
        <div className="flex gap-2">
          {step.minimal && !minimalMode && <Button size="lg" className="flex-1" disabled={busy} onClick={() => void run(() => st.ensureFocus({ kind: 'routine', date, routine: r, stepId: step.id, minimal: true }, step.minimal!.minutes * 60))}>Kleinere Version</Button>}
          <Button variant="ghost" size="lg" className="flex-1" disabled={busy} onClick={() => void done('skipped')}>Überspringen</Button>
        </div>
      </div>
    </div>
  )
}

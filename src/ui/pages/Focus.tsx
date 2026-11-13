import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { elapsedMs, focusTargetKey, pauseCountdown, remainingMs, resumeCountdown, type FocusTarget } from '../../core/focus'
import { guidancePlanDate, guidancePreferences } from '../../core/guidance'
import { MorningBrainDump } from '../components/GuidanceControls'
import { nextHardTime } from '../../core/planner'
import { openSteps } from '../../core/now'
import { MODE_LABEL } from '../../core/support'
import { fmtTime, minutesOnPlanDay } from '../../core/time'
import type { FocusPulseMode, ResumePoint, RoutineId } from '../../core/types'
import { usePlan, useToday } from '../../state/hooks'
import { useFocusClock, useFocusPulse } from '../../state/useFocusClock'
import { FocusTiming } from '../components/FocusTiming'
import { countdownLabel } from '../components/fieldValues'
import { emptyLog, useApp } from '../../state/store'
import { FocusFrame } from '../components/FocusFrame'
import { TodayDifferent } from '../components/TodayDifferent'
import { Button, Choice, RingTimer, Sheet, TextInput } from '../components/ui'

const PULSE_LABEL: Record<FocusPulseMode, string> = { off: 'Aus', gentle: 'Sanft', strong: 'Deutlich' }

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
  const base = useToday()
  const st = useApp()
  const date = guidancePlanDate(st.local, base.date, base.now)
  const plan = usePlan(date)
  const log = st.days[date] ?? emptyLog(date)
  const guidance = guidancePreferences(st.settings.guidance)
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
  useFocusPulse(guidance.enabled && (guidance.paceKeeper || guidance.speakSteps) ? undefined : session, now)
  const m = minutesOnPlanDay(date, now)
  const [error, setError] = useState('')
  const [different, setDifferent] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)
  const [interrupting, setInterrupting] = useState(false)
  const [resumeNote, setResumeNote] = useState('')
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
        {r === 'morning' && guidance.enabled && <div className="mt-5 w-full"><MorningBrainDump /></div>}
        <Button variant="primary" size="xl" className="mt-10 w-full" onClick={() => nav('/')}>Weiter</Button>
        <Link to={`/druck?typ=${r}`} className="mt-3 flex min-h-11 items-center text-muted">{r === 'morning' ? 'Morgenroutine drucken' : 'Abendroutine drucken'}</Link>
      </div>
    )
  }

  const title = minimalMode && step.minimal ? step.minimal.title : step.title
  const timer = session?.timer
  const left = timer ? Math.ceil(remainingMs(timer, now) / 1000) : Math.round(seconds)
  const done = (result: 'done' | 'minimal' | 'skipped') => run(async () => {
    if (guidance.enabled) await st.recordGuidanceInteraction(date)
    await st.setStep(date, r, step.id, result)
    if (session) await st.clearFocus(session.id)
  })
  const captureContext: ResumePoint = { kind: 'step', title, refId: `${date}:${r}:${step.id}`, at: now, route: `/fokus/${r}` }

  const pauseOrContinue = () => session && run(async () => { if (guidance.enabled) await st.recordGuidanceInteraction(date); await st.updateFocus(session.id, current => ({ ...current, timer: current.timer.status === 'running' ? pauseCountdown(current.timer, Date.now()) : resumeCountdown(current.timer, Date.now()) })) })
  return <>
    <FocusFrame back="/" context={<>Schritt {index + 1} von {steps.length}{log.override.zombie && <span className="block">Zombie-Modus · deine Kernschritte</span>}{mode && mode !== 'normal' && <span className="block">{MODE_LABEL[mode]}</span>}</>} capture={captureContext} progress={index / steps.length}
      footer={<>
        <Button variant="primary" size="xl" className="w-full" disabled={busy} onClick={() => { if (session) void done(minimalMode ? 'minimal' : 'done'); else setError('Die Fokuszeit wird noch vorbereitet. Versuche es gleich noch einmal.') }}>Erledigt</Button>
        <div className="grid grid-cols-2 gap-2">
          {timer && session && left > 0 ? <Button size="lg" disabled={busy} onClick={() => void pauseOrContinue()}>{timer.status === 'running' ? 'Pause' : 'Weiter'}</Button> : <Button variant="ghost" size="lg" onClick={() => setDifferent(true)}>Heute anpassen</Button>}
          <Button variant="ghost" size="lg" disabled={busy} onClick={() => setStopOpen(true)}>Stopp</Button>
        </div>
      </>}
      details={<details className="min-w-0 space-y-3"><summary className="min-h-11 py-2 text-muted">Weitere Möglichkeiten</summary>
        <FocusTiming timer={timer} now={now} estimateMin={cur?.minutes} windowMinutes={seconds / 60} />
        <Choice<FocusPulseMode> label="Fokus-Puls" value={st.settings.focus.pulse} options={(['off', 'gentle', 'strong'] as const).map(value => ({ value, label: PULSE_LABEL[value] }))} onChange={pulse => void run(() => st.saveSettings(settings => ({ ...settings, focus: { ...settings.focus, pulse } })))} />
        {step.minimal && !minimalMode && <Button size="lg" className="w-full" disabled={busy} onClick={() => void run(() => st.ensureFocus({ kind: 'routine', date, routine: r, stepId: step.id, minimal: true }, step.minimal!.minutes * 60))}>Kleinere Version</Button>}
        <Button variant="ghost" size="lg" className="w-full" disabled={busy} onClick={() => void done('skipped')}>Überspringen</Button>
        <Button variant="ghost" size="lg" className="w-full" onClick={() => setDifferent(true)}>Heute anpassen</Button>
        {guidance.enabled && r === 'morning' && <Button variant="ghost" className="w-full" disabled={busy} onClick={() => void run(() => st.setZombie(date, !log.override.zombie))}>{log.override.zombie ? 'Zur vollständigen Morgenroutine wechseln' : 'Zombie-Modus – nur meine Kernschritte'}</Button>}
        <Link to={`/druck?typ=${r}`} className="flex min-h-11 items-center text-muted">{r === 'morning' ? 'Morgenroutine drucken' : 'Abendroutine drucken'}</Link>
      </details>}>
      {toHard <= 15 && hard && <p className="rounded-2xl bg-warm-soft px-3 py-2 text-warm" role="status">Noch {Math.max(0, toHard)} min bis {hard.label}</p>}
      {error && <div role="alert" className="text-warm"><p>{error}</p><Button size="sm" onClick={() => setRetry(value => value + 1)}>Erneut versuchen</Button></div>}
      <h1 className="break-words text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
      <RingTimer remainingSec={left} totalSec={seconds} paused={timer?.status === 'paused'} pulse={st.settings.focus.pulse} label="Restzeit der Routine" depletionColors={guidance.enabled && guidance.depletionColors} />
      {timer && <p className="text-sm text-muted">Timerzeit {countdownLabel(Math.floor(elapsedMs(timer, now) / 1000))} ohne Pause{timer.status === 'paused' ? ' · pausiert' : ''}</p>}
      {timer && left === 0 && <p className="text-sm text-muted">Zeitfenster zu Ende. Du entscheidest, wann du abschließt.</p>}
    </FocusFrame>
    <TodayDifferent open={different} onClose={() => setDifferent(false)} onApplied={() => nav('/')} date={date} m={m} action={{ type: 'step', title, routine: r, step, index, total: steps.length }} />
    <Sheet open={stopOpen} onClose={() => { setStopOpen(false); setInterrupting(false) }} title="Fokus stoppen">
      {interrupting ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run(async () => { if (!session) return; if (guidance.enabled) await st.recordGuidanceInteraction(date); await st.saveLocal(local => local.focus?.id === session.id ? { ...local, focus: { ...local.focus, timer: pauseCountdown(local.focus.timer, Date.now()) }, resume: { ...captureContext, note: resumeNote.trim() || undefined } } : local); setStopOpen(false); nav('/') }) }}>
        <p className="text-muted">Dein nächster Schritt bleibt: {title}</p>
        <TextInput aria-label="Wenn ich zurückkomme" placeholder="Eine Notiz für deinen Wiedereinstieg" value={resumeNote} onChange={event => setResumeNote(event.target.value)} />
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>Pause und Wiedereinstieg merken</Button>
      </form> : <div className="space-y-3">
        {session && <Button className="w-full" onClick={() => setInterrupting(true)}>Unterbrochen – Wiedereinstieg merken</Button>}
        <Button className="w-full" onClick={() => void run(async () => { if (guidance.enabled) await st.recordGuidanceInteraction(date); if (session) await st.clearFocus(session.id); setStopOpen(false); nav('/') })}>Einfach beenden</Button>
        <p className="text-sm text-muted">Beenden erledigt keinen Schritt.</p>
      </div>}
    </Sheet>
  </>
}

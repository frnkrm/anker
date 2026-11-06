import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { nextHardTime } from '../../core/planner'
import { openSteps } from '../../core/now'
import { inQuietHours, MODE_LABEL, pulseDue, remainingSec } from '../../core/support'
import { fmtTime } from '../../core/time'
import type { FocusPulseMode, RoutineId } from '../../core/types'
import { AnkerNative, safe } from '../../platform/native'
import { useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { InboxButton } from '../components/Shell'
import { Button, Progress } from '../components/ui'

/** Startzeit des Schritts bleibt über Pausieren und Neuöffnen erhalten, die Restzeit stimmt also weiter. */
function loadStart(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return Number(raw)
    const now = Date.now()
    // Einträge anderer Tage werden nicht mehr gebraucht
    const today = key.split('.')[2]
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('anker.step.') && k.split('.')[2] !== today) localStorage.removeItem(k)
    }
    localStorage.setItem(key, String(now))
    return now
  } catch {
    return Date.now()
  }
}

const NEXT_PULSE: Record<FocusPulseMode, FocusPulseMode> = { off: 'gentle', gentle: 'strong', strong: 'off' }
const PULSE_LABEL: Record<FocusPulseMode, string> = { off: 'Puls aus', gentle: 'Puls sanft', strong: 'Puls deutlich' }

/** Routine im Fokus-Modus: immer nur ein Schritt, Vollbild, Countdown. */
export default function Focus() {
  const { routine = 'morning' } = useParams<{ routine: RoutineId }>()
  const r: RoutineId = routine === 'evening' ? 'evening' : 'morning'
  const { date, plan, log, m, now } = useToday(1000)
  const st = useApp()
  const nav = useNavigate()
  const block = plan.blocks.find((b) => b.routine === r)
  const steps = block?.steps ?? []
  const open = openSteps(plan, log, r)
  const step = open[0]
  const index = step ? steps.indexOf(step) : steps.length

  const timerKey = `anker.step.${date}.${r}.${step?.id ?? 'x'}`
  const [startAt, setStartAt] = useState(() => loadStart(timerKey))
  const [minimalMode, setMinimalMode] = useState(false)
  useEffect(() => {
    setStartAt(loadStart(timerKey))
    setMinimalMode(false)
  }, [timerKey])
  const cur = minimalMode && step?.minimal ? step.minimal : step
  const minutes = cur ? (step?.useMinimal && step.minimal ? step.minimal.minutes : cur.minutes) : 0
  const totalSec = minutes * 60
  const leftSec = remainingSec(startAt, totalSec, now)

  // Fokus-Puls: nur auf dieser geöffneten Seite. Standardmäßig aus, dann passiert hier gar nichts.
  const focus = st.settings.focus
  const lastPulseCheck = useRef(Math.floor((now - startAt) / 1000))
  useEffect(() => {
    const elapsed = Math.floor((now - startAt) / 1000)
    const blocked = inQuietHours(m, st.settings)
    if (pulseDue(focus, elapsed, lastPulseCheck.current, totalSec, blocked)) {
      void safe(() => AnkerNative.vibratePulse({ strength: focus.pulse === 'strong' ? 'strong' : 'gentle' }), undefined)
    }
    lastPulseCheck.current = elapsed
  }, [now, startAt, totalSec, focus, m, st.settings])

  const hard = nextHardTime(plan, m)
  const toHard = hard ? hard.at - m : Infinity

  if (!step) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center safe-top">
        <h1 className="text-4xl font-semibold">{r === 'morning' ? 'Morgenroutine fertig' : 'Abendroutine fertig'}</h1>
        <p className="mt-3 text-xl text-muted">
          {r === 'morning'
            ? plan.leave !== undefined
              ? `Losgehen um ${fmtTime(plan.leave)}.`
              : 'Genieß den Tag.'
            : plan.openEnd
              ? 'Für heute ist hier nichts mehr offen.'
              : m >= plan.bed
                ? 'Jetzt ist Zeit fürs Bett.'
                : m >= plan.pcStop
                  ? `Zeit zum Runterkommen. Bett um ${fmtTime(plan.bed)}.`
                  : `Jetzt Freizeit bis ${fmtTime(plan.pcStop)}.`}
        </p>
        <Button variant="primary" size="xl" className="mt-10 w-full" onClick={() => nav('/')}>
          Weiter
        </Button>
      </div>
    )
  }

  const title = step.useMinimal && step.minimal ? step.minimal.title : step.title
  const done = (result: 'done' | 'minimal' | 'skipped') => st.setStep(date, r, step.id, result)
  const mode = log.override.mode

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-6 safe-top">
      <header className="flex items-center justify-between gap-2 py-2">
        <Link to="/" className="grid h-12 w-12 place-items-center rounded-2xl text-2xl text-muted active:bg-surface-2" aria-label="Fokus-Modus verlassen">
          ✕
        </Link>
        <span className="text-center text-muted">
          Schritt {index + 1} von {steps.length}
          {mode && mode !== 'normal' && <span className="block text-sm">{MODE_LABEL[mode]}</span>}
        </span>
        <div className="flex w-24 justify-end">
          <InboxButton />
        </div>
      </header>
      <Progress value={index / steps.length} />

      {toHard <= 15 && hard && (
        <p className="mt-4 rounded-2xl bg-warm-soft px-4 py-3 text-center text-lg text-warm" role="status">
          Noch {Math.max(0, toHard)} Minuten bis {hard.label}
        </p>
      )}

      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-5xl leading-tight font-semibold">{minimalMode && step.minimal ? step.minimal.title : title}</h1>
        <div className="mt-8 text-7xl font-light tabular-nums" aria-label={`${Math.ceil(leftSec / 60)} Minuten übrig`}>
          {Math.floor(leftSec / 60)}:{String(leftSec % 60).padStart(2, '0')}
        </div>
        {leftSec === 0 && <p className="mt-2 text-muted">Zeit um. Kein Problem, mach in Ruhe fertig.</p>}
        <button
          type="button"
          className="mt-6 min-h-11 rounded-xl px-3 text-sm text-muted"
          aria-label={`Fokus-Puls umschalten, aktuell ${PULSE_LABEL[focus.pulse]}`}
          onClick={() => st.saveSettings((x) => ({ ...x, focus: { ...x.focus, pulse: NEXT_PULSE[x.focus.pulse] } }))}
        >
          {PULSE_LABEL[focus.pulse]}
        </button>
      </main>

      <div className="space-y-3">
        <Button variant="primary" size="xl" className="w-full" onClick={() => done(step.useMinimal || minimalMode ? 'minimal' : 'done')}>
          Erledigt
        </Button>
        <div className="flex gap-2">
          {step.minimal && !step.useMinimal && !minimalMode && (
            <Button size="lg" className="flex-1" onClick={() => setMinimalMode(true)}>
              Kleinere Version
            </Button>
          )}
          <Button variant="ghost" size="lg" className="flex-1" onClick={() => done('skipped')}>
            Überspringen
          </Button>
        </div>
      </div>
    </div>
  )
}

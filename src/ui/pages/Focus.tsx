import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { nextHardTime } from '../../core/planner'
import { openSteps } from '../../core/now'
import { fmtTime } from '../../core/time'
import type { RoutineId } from '../../core/types'
import { useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { Button, Progress } from '../components/ui'

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

  // Countdown pro Schritt: startet neu, sobald ein neuer Schritt erscheint
  const [startAt, setStartAt] = useState(now)
  const [minimalMode, setMinimalMode] = useState(false)
  useEffect(() => {
    setStartAt(Date.now())
    setMinimalMode(false)
  }, [step?.id])
  const cur = minimalMode && step?.minimal ? step.minimal : step
  const minutes = cur ? (step?.useMinimal && step.minimal ? step.minimal.minutes : cur.minutes) : 0
  const leftSec = Math.max(0, Math.round(minutes * 60 - (now - startAt) / 1000))

  const hard = nextHardTime(plan, m)
  const toHard = hard ? hard.at - m : Infinity

  if (!step) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center safe-top">
        <div className="mb-4 text-7xl animate-pop" aria-hidden="true">
          {r === 'morning' ? '☀️' : '🎮'}
        </div>
        <h1 className="text-4xl font-semibold">{r === 'morning' ? 'Morgenroutine geschafft!' : 'Abendroutine geschafft!'}</h1>
        <p className="mt-3 text-xl text-muted">
          {r === 'morning'
            ? plan.leave !== undefined
              ? `Losgehen um ${fmtTime(plan.leave)}.`
              : 'Genieß den Tag.'
            : `Jetzt Freizeit – zocken bis ${fmtTime(plan.pcStop)}.`}
        </p>
        <Button variant="primary" size="xl" className="mt-10 w-full" onClick={() => nav('/')}>
          Weiter
        </Button>
      </div>
    )
  }

  const title = step.useMinimal && step.minimal ? step.minimal.title : step.title
  const done = (result: 'done' | 'minimal' | 'skipped') => st.setStep(date, r, step.id, result)

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-6 safe-top">
      <header className="flex items-center justify-between py-2">
        <Link to="/" className="grid h-12 w-12 place-items-center rounded-2xl text-2xl text-muted active:bg-surface-2" aria-label="Fokus-Modus verlassen">
          ✕
        </Link>
        <span className="text-muted">
          Schritt {index + 1} von {steps.length}
        </span>
        <span className="w-12" />
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
        {leftSec === 0 && <p className="mt-2 text-muted">Zeit um – kein Problem. Mach in Ruhe fertig.</p>}
      </main>

      <div className="space-y-3">
        <Button variant="primary" size="xl" className="w-full" onClick={() => done(step.useMinimal ? 'minimal' : 'done')}>
          Erledigt
        </Button>
        <div className="flex gap-2">
          {step.minimal && !step.useMinimal && (
            <Button size="lg" className="flex-1" onClick={() => (minimalMode ? done('minimal') : setMinimalMode(true))}>
              {minimalMode ? 'Minimal erledigt' : 'Minimal-Version'}
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

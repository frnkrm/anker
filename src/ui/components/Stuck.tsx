import { useEffect, useState } from 'react'
import { remainingSec, stuckLadder, type NextAction } from '../../core/support'
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
      <span className="absolute inset-0 grid place-items-center text-4xl font-light tabular-nums">
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
      </span>
    </div>
  )
}

/**
 * Ein einziger Bildschirm statt mehrerer Dialoge: kurz ankommen, ein Schritt, ein Timer.
 * Die gerade wichtige Aufgabe bleibt sichtbar und geht durch das Festhängen nicht verloren.
 */
export function StuckSheet({ open, onClose, action }: { open: boolean; onClose: () => void; action: NextAction }) {
  const ladder = stuckLadder(action)
  const [level, setLevel] = useState(0)
  const [startedAt, setStartedAt] = useState<number>()
  const [pausedLeft, setPausedLeft] = useState<number>()
  const [now, setNow] = useState(Date.now())
  const step = ladder[Math.min(level, ladder.length - 1)]!

  useEffect(() => {
    if (!open) return
    setLevel(0)
    setStartedAt(undefined)
    setPausedLeft(undefined)
  }, [open])

  useEffect(() => {
    if (!open || !startedAt) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [open, startedAt])

  const left = startedAt ? remainingSec(startedAt, step.seconds, now) : (pausedLeft ?? step.seconds)
  const running = !!startedAt
  const over = running && left === 0

  const start = (seconds = step.seconds) => {
    setPausedLeft(undefined)
    setNow(Date.now())
    setStartedAt(Date.now() - (step.seconds - seconds) * 1000)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Ganz klein anfangen">
      <p className="text-muted">Atme einmal aus. Stell beide Füße auf den Boden.</p>
      <p className="mt-3 text-3xl font-semibold leading-snug">{step.text}</p>
      <Ring left={left} total={step.seconds} />
      {over ? (
        <div className="space-y-2">
          <p className="text-center text-lg">Denselben kleinen Schritt nochmal oder eine Pause?</p>
          <Button variant="primary" size="lg" className="w-full" onClick={() => start(step.seconds)}>
            Nochmal
          </Button>
          <Button size="lg" className="w-full" onClick={onClose}>
            Pause
          </Button>
        </div>
      ) : running ? (
        <div className="space-y-2">
          <Button variant="primary" size="xl" className="w-full" onClick={onClose}>
            Geschafft
          </Button>
          <div className="flex gap-2">
            {level < ladder.length - 1 && (
              <Button
                size="lg"
                className="flex-1"
                onClick={() => {
                  setLevel(level + 1)
                  setStartedAt(undefined)
                  setPausedLeft(undefined)
                }}
              >
                Etwas kleiner
              </Button>
            )}
            <Button
              variant="ghost"
              size="lg"
              className="flex-1"
              onClick={() => {
                setPausedLeft(left)
                setStartedAt(undefined)
              }}
            >
              Pause
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Button variant="primary" size="xl" className="w-full" onClick={() => start(pausedLeft ?? step.seconds)}>
            {pausedLeft !== undefined ? 'Weiter' : 'Starten'}
          </Button>
          {level < ladder.length - 1 && (
            <Button size="lg" className="w-full" onClick={() => setLevel(level + 1)}>
              Etwas kleiner
            </Button>
          )}
        </div>
      )}
      {step.text !== action.title && <p className="mt-3 text-center text-sm text-muted">Deine Aufgabe bleibt: {action.title}</p>}
    </Sheet>
  )
}

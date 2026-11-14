import { useEffect, useState } from 'react'
import { focusCompanion, type CompanionView } from '../../core/focusCompanion'
import type { FocusTarget } from '../../core/focus'
import { workTasksQuiet } from '../../core/support'
import type { DayPlan } from '../../core/types'
import { supportInput, useApp } from '../../state/store'
import { Button } from './ui'

function read(target: FocusTarget, now: number) {
  const st = useApp.getState()
  const input = supportInput(st, now)
  return { plan: input.plan, view: focusCompanion({ ...input, local: st.local, workQuiet: workTasksQuiet(input) }, target) }
}

/** Keine Persistenz und keine eigene Uhr: dieselbe Fokusphase bleibt alleiniger Zeitbesitzer. */
export function FocusCompanion({ target, now }: { target: FocusTarget; now: number }) {
  useApp()
  const { plan, view } = read(target, now)
  return view ? <CompanionChoice key={view.key} target={target} plan={plan} view={view} /> : null
}

function CompanionChoice({ target, plan, view }: { target: FocusTarget; plan: DayPlan; view: CompanionView }) {
  const [choice, setChoice] = useState({ plan, active: false })
  // Ein neuer Plan darf keine Wahl des vorherigen Plans übernehmen, auch nicht für einen Render.
  if (choice.plan !== plan) setChoice({ plan, active: false })
  const active = choice.plan === plan && choice.active && view.status === 'running'
  useEffect(() => {
    const stop = () => setChoice(current => ({ ...current, active: false }))
    const visibility = () => { if (document.visibilityState !== 'visible') stop() }
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  const start = () => {
    const fresh = read(target, Date.now())
    if (document.visibilityState !== 'visible' || fresh.plan !== plan || fresh.view?.key !== view.key || fresh.view.status !== 'running') return
    setChoice({ plan, active: true })
  }
  return <section aria-label="Stille Begleitung" className="min-w-0 space-y-2 rounded-2xl border border-line p-3 text-sm break-words">
    <h2 className="font-semibold">Stille Begleitung</h2>
    <p className="text-muted">Eine lokale Hilfe auf diesem Gerät, ohne Kontakt zu einer anderen Person.</p>
    {view.status === 'paused' ? <p>Dein Fokus ist pausiert. Setze ihn mit Weiter fort. Die Begleitung kannst du danach neu starten.</p>
      : view.status === 'expired' ? <p>Dein Zeitfenster ist zu Ende. Die Begleitung ist aus. Du entscheidest, wie es weitergeht.</p>
      : active ? <>
        <p role="status">Bleib für diesen Moment bei einem kleinen Handgriff. Dein Tempo reicht.</p>
        <Button className="w-full" onClick={() => setChoice({ plan, active: false })}>Begleitung beenden</Button>
      </> : <>
        <p className="text-muted">Wenn es dir hilft, bleibt ein ruhiger Satz neben deinem Fokus. Du kannst ihn jederzeit ausblenden.</p>
        <Button className="w-full" onClick={start}>Stille Begleitung starten</Button>
      </>}
  </section>
}

import { elapsedMs, type CountdownState } from '../../core/focus'
import { countdownLabel } from './fieldValues'

const minutesText = (value: number) => `${value.toLocaleString('de-DE', { maximumFractionDigits: 3 })} ${value === 1 ? 'Minute' : 'Minuten'}`

/** Existing timer and explicit facts only; rendering never records a measurement. */
export function FocusTiming({ timer, now, windowMinutes, estimateMin, confirmedMin, showConfirmation = false }: {
  timer?: CountdownState; now: number; windowMinutes?: number; estimateMin?: number; confirmedMin?: number; showConfirmation?: boolean
}) {
  const known = (value?: number) => value !== undefined && Number.isFinite(value) && value > 0
  const window = timer ? timer.durationMs / 60_000 : windowMinutes
  return <div role="region" aria-label="Zeitvergleich" className="min-w-0 space-y-2">
    <dl className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 text-sm text-muted min-[400px]:grid-cols-2">
      <dt className="min-w-0 break-words">Schätzung</dt><dd className="min-w-0 break-words text-left min-[400px]:text-right">{known(estimateMin) ? `ca. ${minutesText(estimateMin!)}` : 'Noch offen'}</dd>
      {known(window) && <><dt className="min-w-0 break-words">Zeitfenster</dt><dd className="min-w-0 break-words text-left min-[400px]:text-right">{minutesText(window!)}</dd></>}
      {timer && <><dt className="min-w-0 break-words">Timerlaufzeit ohne Pause</dt><dd className="min-w-0 break-words text-left min-[400px]:text-right">{countdownLabel(Math.floor(elapsedMs(timer, now) / 1000))}{timer.status === 'paused' ? ' · pausiert' : ''}</dd></>}
      {showConfirmation && <><dt className="min-w-0 break-words">Bestätigte Dauer</dt><dd className="min-w-0 break-words text-left min-[400px]:text-right">{known(confirmedMin) ? minutesText(confirmedMin!) : 'Noch nicht bestätigt'}</dd></>}
    </dl>
    {timer && <p className="text-xs text-muted">Der Timer läuft auch im Hintergrund. Seine Laufzeit ist keine bestätigte Tätigkeitsdauer.</p>}
  </div>
}

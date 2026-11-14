import { useState } from 'react'
import { MODE_LABEL } from '../../core/support'
import type { SupportMode } from '../../core/types'
import { germanDate } from '../../core/uiText'
import { weeklyEvidence, type ReviewPeriod } from '../../core/weeklyReview'
import { useNow } from '../../state/hooks'
import { useApp } from '../../state/store'
import { Button, Segmented } from './ui'

/** Ausdrücklich öffnen, flüchtig abwählen; kein Speicher-/Freigabeschalter. */
export function WeeklyEvidence() {
  const [open, setOpen] = useState(false)
  return <section aria-label="Freiwillige Wochenübersicht" className="min-w-0 space-y-3 rounded-2xl border border-line p-3 break-words">
    <Button className="w-full" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Ohne Wochenübersicht' : 'Vorhandene Wocheneinträge ansehen'}</Button>
    {open && <EvidenceBody />}
  </section>
}

function EvidenceBody() {
  const days = useApp(state => state.days)
  const now = useNow(30_000)
  const [period, setPeriod] = useState<ReviewPeriod>('current')
  const facts = weeklyEvidence(days, now, period)
  if (!facts) return <p>Der Zeitraum ist gerade nicht verfügbar.</p>
  const rows: [string, number][] = [
    ...Object.entries(facts.modes).map(([mode, count]): [string, number] => [`Tagesmodus „${MODE_LABEL[mode as SupportMode]}“`, count]),
    ['Kleine Morgenvariante im Tagesstand', facts.shortMorningDays], ['Kleine Versionen im Tagesstand', facts.lightDays],
    ['Angepasster Tagesplan im Tagesstand', facts.adjustedDays],
  ]
  const steps: [string, number][] = [['Als erledigt bestätigt', facts.steps.done], ['Als kleine Version bestätigt', facts.steps.minimal],
    ['Als übersprungen eingetragen', facts.steps.skipped], ['Als heute nicht nötig eingetragen', facts.steps['not-needed']]]
  return <div className="min-w-0 space-y-3" aria-label="Gespeicherte Wochenangaben" role="region">
    <Segmented label="Zeitraum des Wochenrückblicks" value={period} onChange={setPeriod} options={[{ value: 'current', label: 'Diese Woche bisher' }, { value: 'previous', label: 'Vorherige Woche' }]} />
    <h2 className="text-lg font-semibold">{germanDate(facts.from)} bis {germanDate(facts.to)}</h2>
    <p className="text-sm text-muted">Planwoche Montag bis Sonntag. Die Tagessicht wechselt um 04:00 Uhr in Berlin.{facts.current && ' Der aktuelle Tag läuft noch.'}</p>
    <p>Auswertbare Tagesstände: {facts.dataDays} von {facts.totalDays}.</p>
    {facts.missingDays > 0 && <p className="text-sm text-muted">{facts.missingDays} {facts.missingDays === 1 ? 'Tag ohne passende Angaben' : 'Tage ohne passende Angaben'}. Das belegt weder ein Hindernis noch Nichtnutzung.</p>}
    {facts.dataDays < 3 && <p className="text-sm text-muted">{facts.dataDays === 0 ? 'Noch keine passenden Angaben für diese Übersicht.' : 'Wenige Tagesstände: daraus lässt sich kein Muster ableiten.'}</p>}
    {rows.some(([, count]) => count > 0) && <div className="space-y-2"><h3 className="font-semibold">Gespeicherte Tagesauswahl</h3>
      <ul className="space-y-1">{rows.filter(([, count]) => count > 0).map(([label, count]) => <li key={label}>{label}: {count} {count === 1 ? 'Tag' : 'Tage'}.</li>)}</ul>
    </div>}
    {steps.some(([, count]) => count > 0) && <div className="space-y-2"><h3 className="font-semibold">Routinenangaben</h3>
      <ul className="space-y-1">{steps.filter(([, count]) => count > 0).map(([label, count]) => <li key={label}>{label}: {count} {count === 1 ? 'Schritt' : 'Schritte'}.</li>)}</ul>
    </div>}
    <p className="text-sm text-muted">Das sind die aktuell gespeicherten Stände, kein vollständiger Verlauf. Frühere Umwahlen und Gründe werden nicht rekonstruiert. Ob eine Auswahl geholfen hat, kannst du selbst einordnen.</p>
    <p className="text-sm text-muted">Wenn du möchtest, nutze diese Angaben für deine eigenen Antworten unten. Hier wird nichts bewertet oder automatisch geändert.</p>
  </div>
}

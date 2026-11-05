import type { DayPlan } from '../../core/types'
import { fmtTime } from '../../core/time'
import { useApp } from '../../state/store'
import { openRoute } from './TodayDifferent'
import { Button, Card, Section } from './ui'

/** Termine des Tages: Weg, Quelle der Fahrzeit und schnelle Änderung. Bleibt auf dem Gerät. */
export function DayCommitments({ plan }: { plan: DayPlan }) {
  const st = useApp()
  const legs = plan.legs ?? []
  if (!legs.length) return null
  const update = (id: string, patch: Record<string, unknown>) => st.saveLocal((l) => ({ ...l, commitments: l.commitments.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
  return (
    <Section title="Termine">
      {legs.map((l) => {
        const c = l.commitment
        return (
          <Card key={c.id} className="space-y-2">
            <p className="text-lg font-medium">
              {fmtTime(c.start)} {c.label}
              {c.end !== undefined ? ` bis ${fmtTime(c.end)}` : ''}
            </p>
            {l.toLabel && (
              <p className="text-muted">
                {l.fromLabel} → {l.toLabel}
                {l.travelMin !== undefined ? `, Fahrt etwa ${l.travelMin} min (deine Schätzung)` : ', Fahrzeit noch offen'}
                {l.leave !== undefined ? `, los um ${fmtTime(l.leave)}` : ''}
              </p>
            )}
            {l.items.length > 0 && <p className="text-muted">Mitnehmen: {l.items.slice(0, 3).join(', ')}</p>}
            {l.toLabel && (
              <label className="flex items-center gap-2">
                <span>Fahrt in Minuten</span>
                <input type="number" inputMode="numeric" min={0} max={600} aria-label={`Fahrzeit ${c.label}`} className="min-h-11 w-20 rounded-xl bg-surface-2 px-2 text-center" value={c.travelMin ?? ''} placeholder="offen" onChange={(e) => update(c.id, { travelMin: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} />
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              {c.address && (
                <Button size="sm" onClick={() => openRoute(c.address!, c.routeMode)}>
                  Route in Google Maps
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => update(c.id, { status: 'cancelled' })}>
                Absagen
              </Button>
            </div>
          </Card>
        )
      })}
      {plan.conflicts?.map((x) => (
        <p key={x} className="px-1 text-warm">
          {x} Ändern kannst nur du: Einen Termin hier absagen oder mit der anderen Seite verschieben.
        </p>
      ))}
    </Section>
  )
}

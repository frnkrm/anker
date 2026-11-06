import { useState } from 'react'
import { Link } from 'react-router'
import type { Commitment, DayPlan } from '../../core/types'
import { fmtTime } from '../../core/time'
import { locationKind } from '../../core/travel'
import { useApp } from '../../state/store'
import { openRoute } from './TodayDifferent'
import { CommitmentForm } from './CommitmentForm'
import { PackingList } from './Packing'
import { Button, Card, Section, Sheet } from './ui'

/** Termine des Tages: Weg, Quelle der Fahrzeit und schnelle Änderung. Bleibt auf dem Gerät. */
export function DayCommitments({ plan }: { plan: DayPlan }) {
  const st = useApp()
  const [editing, setEditing] = useState<Commitment>()
  const [error, setError] = useState('')
  const legs = plan.legs ?? []
  const cancelled = st.local.commitments.filter((c) => c.date === plan.date && c.status === 'cancelled')
  const update = async (c: Commitment, status: 'cancelled' | 'planned') => {
    setError('')
    try { await st.updateCommitment(c.id, { status }, status === 'cancelled' ? 'Termin abgesagt' : 'Termin wieder eingeplant') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Der Termin konnte nicht geändert werden.') }
  }
  return (
    <Section title="Termine">
      <Link to="/orte" className="flex min-h-11 items-center px-1 text-sm text-accent">Orte & manuelle Wege verwalten</Link>
      {!legs.length && <p className="px-1 text-sm text-muted">Keine zusätzlichen Termine für diesen Tag. Über „Heute anders“ kannst du einen einplanen.</p>}
      {legs.map((l) => {
        const c = l.commitment
        const kind = locationKind(c, st.local.places)
        const address = c.address || st.local.places.find((place) => place.id === c.placeId)?.address
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
            {kind === 'remote' && <p className="text-sm text-muted">Remote, keine Fahrt. Vorbereitung bleibt getrennt planbar.</p>}
            {l.locationOpen && <p className="text-sm text-warm">Ort noch offen. Es wurde keine Fahrt oder sichere spätere Weckzeit angenommen.</p>}
            {l.originOpen && <p className="text-sm text-warm">Startort noch offen. Du kannst ihn unter „Termin bearbeiten“ wählen.</p>}
            {l.returnOpen && <p className="text-sm text-muted">Rückfahrt noch offen. Eine Rückkehr wird nicht erfunden.</p>}
            <PackingList commitment={c} items={l.items} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setEditing(c)}>Termin bearbeiten</Button>
              {address && kind !== 'remote' && (
                <Button size="sm" onClick={() => openRoute(address, c.routeMode)}>
                  Route in Google Maps
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => void update(c, 'cancelled')}>
                Absagen
              </Button>
            </div>
          </Card>
        )
      })}
      {cancelled.length > 0 && <details className="space-y-2"><summary className="min-h-11 py-2 text-sm text-muted">Abgesagte Termine ({cancelled.length})</summary>{cancelled.map((c) => <Card key={c.id} className="space-y-2"><p>{fmtTime(c.start)} {c.label}</p><Button size="sm" onClick={() => void update(c, 'planned')}>Wieder einplanen</Button></Card>)}</details>}
      <Sheet open={!!editing} onClose={() => setEditing(undefined)} title="Termin bearbeiten">
        {editing && <CommitmentForm key={editing.id} date={editing.date} commitment={editing} onDone={(message) => { setEditing(undefined); st.showToast(message) }} />}
      </Sheet>
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      {plan.conflicts?.map((x) => (
        <p key={x} className="px-1 text-warm">
          {x} Ändern kannst nur du: Einen Termin hier absagen oder mit der anderen Seite verschieben.
        </p>
      ))}
    </Section>
  )
}

import { useRef, useState } from 'react'
import { morningShortOffer } from '../../core/morningShort'
import { fmtDuration } from '../../core/time'
import type { DayLog, DayPlan } from '../../core/types'
import { useApp } from '../../state/store'
import { Button } from './ui'

export function MorningShortOffer({ plan, log, now }: { plan: DayPlan; log: DayLog; now: number }) {
  const accept = useApp(state => state.acceptMorningShort)
  const showToast = useApp(state => state.showToast)
  const [dismissed, setDismissed] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const offer = morningShortOffer(plan, log, now)
  if (!offer || offer.revision === dismissed) return null
  const apply = async () => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      if (!await accept(plan.date, offer.revision)) showToast('Der Plan hat sich geändert. Bitte prüfe das aktuelle Angebot.')
    } catch {
      setError('Der Kurzmodus konnte nicht gespeichert werden. Bitte versuche es erneut.')
    } finally {
      pending.current = false; setBusy(false)
    }
  }
  return <section className="now-departure space-y-2" aria-label="Kurzmodusangebot">
    <p className="font-semibold">Die Zeit ist knapp. Möchtest du den Morgen kürzer machen?</p>
    <p>Vorbereitung ca. {fmtDuration(offer.preparationMin)} → ca. {fmtDuration(offer.shortPreparationMin)}.</p>
    <ul className="space-y-1">{offer.changes.map(change => <li key={change.id}>{change.title} → {change.shortTitle}</li>)}</ul>
    <p>Alle Schritte bleiben erhalten. Das gilt nur für heute Morgen.</p>
    {offer.stillTight && <p>Auch kurz reicht die geschätzte Zeit nicht bis zur geplanten Abfahrt.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={() => void apply()}>Kurzmodus übernehmen</Button>
      <Button disabled={busy} onClick={() => { setError(''); setDismissed(offer.revision) }}>So lassen</Button>
    </div>
  </section>
}

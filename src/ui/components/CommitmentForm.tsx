import { useRef, useState } from 'react'
import { randomId } from '../../core/defaults'
import { parseQuickTime } from '../../core/planner'
import { fmtTime, minutesOnPlanDay } from '../../core/time'
import { locationKind, validCommitment } from '../../core/travel'
import type { Commitment, EventContext, LocationKind, Place, RouteMode } from '../../core/types'
import { useApp } from '../../state/store'
import { Button, Segmented, TextInput, TimeField } from './ui'

const FIELD = 'min-h-12 w-full min-w-0 rounded-xl bg-surface-2 px-3'

export interface TravelDraft {
  locationKind: LocationKind
  placeId: string
  placeLabel: string
  address: string
  originPlaceId: string
  routeMode: RouteMode
  travelMin: string
  travelHomeMin: string
  arrivalBufferMin: string
  prepMin: string
  prepIncludesMorning: boolean
  items: string
  thenTo: 'home' | 'next'
  replacesCommute: boolean
}

export function travelDraftOf(c?: Commitment, places: readonly Place[] = []): TravelDraft {
  const place = places.find((candidate) => candidate.id === c?.placeId)
  return {
    locationKind: c ? locationKind(c, places) : 'unknown', placeId: c?.placeId ?? '', placeLabel: c?.placeLabel ?? place?.label ?? '',
    address: c?.address ?? place?.address ?? '', originPlaceId: c?.originPlaceId ?? '', routeMode: c?.routeMode === 'none' ? 'driving' : c?.routeMode ?? 'driving',
    travelMin: c?.travelMin?.toString() ?? '', travelHomeMin: c?.travelHomeMin?.toString() ?? '',
    arrivalBufferMin: c?.arrivalBufferMin?.toString() ?? '', prepMin: c?.prepMin?.toString() ?? '',
    prepIncludesMorning: c?.prepIncludesMorning ?? false, items: (c?.items ?? place?.items ?? []).join('\n'),
    thenTo: c?.thenTo ?? 'home', replacesCommute: c?.replacesCommute ?? false,
  }
}

const optionalMinutes = (value: string): number | undefined => value.trim() ? Number(value) : undefined

export function travelFields(draft: TravelDraft): Pick<Commitment, 'locationKind' | 'placeId' | 'placeLabel' | 'address' | 'originPlaceId' | 'routeMode' | 'travelMin' | 'travelHomeMin' | 'arrivalBufferMin' | 'prepMin' | 'prepIncludesMorning' | 'items' | 'thenTo' | 'replacesCommute'> {
  return {
    locationKind: draft.locationKind,
    placeId: draft.placeId || undefined, placeLabel: draft.placeLabel.trim() || undefined,
    address: draft.address.trim() || undefined, originPlaceId: draft.originPlaceId || undefined,
    routeMode: draft.locationKind === 'remote' ? 'none' : draft.routeMode,
    travelMin: optionalMinutes(draft.travelMin), travelHomeMin: optionalMinutes(draft.travelHomeMin),
    arrivalBufferMin: optionalMinutes(draft.arrivalBufferMin), prepMin: optionalMinutes(draft.prepMin),
    prepIncludesMorning: draft.prepIncludesMorning,
    items: draft.items.split('\n').map((item) => item.trim()).filter(Boolean), thenTo: draft.thenTo,
    replacesCommute: draft.replacesCommute,
  }
}

/** Dieselben lokalen Wegfelder für Termin, Kundentag und geplanten Einsatz. */
export function TravelFields({ draft, onChange, places, morning = true, showLocation = true }: { draft: TravelDraft; onChange: (next: TravelDraft) => void; places: readonly Place[]; morning?: boolean; showLocation?: boolean }) {
  const change = <K extends keyof TravelDraft>(key: K, value: TravelDraft[K]) => onChange({ ...draft, [key]: value })
  return <div className="min-w-0 space-y-3">
    {showLocation && <Segmented<LocationKind> label="Ort des Termins" value={draft.locationKind} onChange={(value) => change('locationKind', value)} options={[
      { value: 'unknown', label: 'Noch unklar' }, { value: 'onsite', label: 'Vor Ort' }, { value: 'remote', label: 'Remote' }, { value: 'home', label: 'Zuhause' },
    ]} />}
    {draft.locationKind === 'unknown' && <p className="text-sm text-muted">Ort und Anfahrt bleiben offen. Anker nimmt deshalb keine sichere spätere Weckzeit an.</p>}
    {draft.locationKind !== 'remote' && draft.locationKind !== 'home' && <>
      <label className="block space-y-1"><span>Gespeicherter Ort (freiwillig)</span><select aria-label="Gespeicherter Ort" className={FIELD} value={draft.placeId} onChange={(event) => {
        const place = places.find((candidate) => candidate.id === event.target.value)
        onChange({ ...draft, placeId: place?.id ?? '', ...(place ? { placeLabel: place.label, address: place.address ?? '', items: (place.items ?? []).join('\n'), locationKind: place.kind === 'home' ? 'home' : 'onsite' } : {}) })
      }}><option value="">Eigenen Ort eingeben</option>{places.map((place) => <option key={place.id} value={place.id}>{place.label}</option>)}</select></label>
      <label className="block space-y-1"><span>Ort</span><TextInput aria-label="Ort" value={draft.placeLabel} onChange={(event) => change('placeLabel', event.target.value)} placeholder="Name genügt; darf offen bleiben" /></label>
      <label className="block space-y-1"><span>Adresse für Maps (freiwillig)</span><TextInput aria-label="Adresse" value={draft.address} onChange={(event) => change('address', event.target.value)} /></label>
    </>}
    {draft.locationKind !== 'remote' && <>
      <label className="block space-y-1"><span>Startort</span><select aria-label="Startort" className={FIELD} value={draft.originPlaceId} onChange={(event) => change('originPlaceId', event.target.value)}>
        <option value="">Aus der Ortsfolge</option><option value="home">Zuhause</option><option value="office">Büro</option><option value="unknown">Noch unklar</option>
        {places.map((place) => <option key={place.id} value={place.id}>{place.label}</option>)}
      </select></label>
      <label className="block space-y-1"><span>Unterwegs mit</span><select aria-label="Verkehrsmittel" className={FIELD} value={draft.routeMode} onChange={(event) => change('routeMode', event.target.value as RouteMode)}>
        <option value="driving">Auto</option><option value="transit">ÖPNV</option><option value="cycling">Rad</option><option value="walking">Zu Fuß</option>
      </select></label>
      <label className="block space-y-1"><span>Fahrt zum Ziel (Minuten, deine Schätzung)</span><TextInput type="number" inputMode="decimal" min="0" max="1440" aria-label="Fahrzeit in Minuten" placeholder="Noch offen" value={draft.travelMin} onChange={(event) => change('travelMin', event.target.value)} /></label>
      <label className="block space-y-1"><span>Ankunftspuffer (Minuten, freiwillig)</span><TextInput type="number" inputMode="decimal" min="0" max="1440" aria-label="Ankunftspuffer Termin" placeholder="Deine allgemeine Einstellung" value={draft.arrivalBufferMin} onChange={(event) => change('arrivalBufferMin', event.target.value)} /></label>
    </>}
    <label className="block space-y-1"><span>Zusätzliche Vorbereitung (Minuten, freiwillig)</span><TextInput type="number" inputMode="decimal" min="0" max="1440" aria-label="Vorbereitung Termin" placeholder={draft.locationKind === 'remote' ? 'Dein Rechnerstart-Puffer' : 'Deine allgemeine Einstellung'} value={draft.prepMin} onChange={(event) => change('prepMin', event.target.value)} /></label>
    {morning && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={draft.prepIncludesMorning} onChange={(event) => change('prepIncludesMorning', event.target.checked)} />Diese Vorbereitung ist bereits in meiner Morgenroutine enthalten</label>}
    <label className="block space-y-1"><span>Mitnehmen oder bereitlegen (freiwillig, eine Sache je Zeile)</span><textarea aria-label="Material und Dinge" className={FIELD + ' py-3'} rows={3} value={draft.items} onChange={(event) => change('items', event.target.value)} /></label>
    {draft.locationKind !== 'remote' && draft.locationKind !== 'home' && <>
      <label className="block space-y-1"><span>Danach</span><select aria-label="Danach" className={FIELD} value={draft.thenTo} onChange={(event) => change('thenTo', event.target.value as 'home' | 'next')}><option value="home">Nach Hause</option><option value="next">Direkt zum nächsten Ziel</option></select></label>
      {draft.thenTo === 'home' && <label className="block space-y-1"><span>Rückfahrt nach Hause (Minuten, freiwillig)</span><TextInput type="number" inputMode="decimal" min="0" max="1440" aria-label="Rückfahrt nach Hause" placeholder="Noch offen" value={draft.travelHomeMin} onChange={(event) => change('travelHomeMin', event.target.value)} /></label>}
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={draft.replacesCommute} onChange={(event) => change('replacesCommute', event.target.checked)} />Statt ins Büro, nur an diesem Tag</label>
    </>}
    <p className="text-sm text-muted">Wegzeiten sind deine Schätzung. Eine Karten-App gibt Anker keine Live-Ankunftszeit zurück.</p>
  </div>
}

export function CommitmentForm({ date, commitment, reason, onDone }: { date: string; commitment?: Commitment; reason?: string; onDone: (message: string) => void }) {
  const st = useApp()
  const [title, setTitle] = useState(commitment?.label ?? '')
  const [kind, setKind] = useState<EventContext>(commitment?.context ?? 'social')
  const [start, setStart] = useState<number | undefined>(commitment?.start)
  const [end, setEnd] = useState<number | undefined>(commitment?.end)
  const [hard, setHard] = useState(commitment?.commitment === 'hard')
  const [draft, setDraft] = useState(() => travelDraftOf(commitment, st.local.places))
  const [sourceId, setSourceId] = useState(commitment?.source?.id ?? '')
  const [details, setDetails] = useState(!!commitment)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const id = useRef(commitment?.id ?? randomId())
  const time = start ?? parseQuickTime(title)
  const events = st.events.filter((event) => !event.allDay && minutesOnPlanDay(date, event.start) >= 0 && minutesOnPlanDay(date, event.start) < 1440)
  const save = async () => {
    if (pending.current || time === undefined) return
    pending.current = true; setBusy(true); setError('')
    try {
      const current = useApp.getState().local.commitments.find((item) => item.id === id.current) ?? commitment
      const patch: Partial<Omit<Commitment, 'id' | 'date'>> = {
        label: title.trim() || 'Termin', context: kind,
        commitment: hard ? 'hard' : 'soft', start: time, end,
        ...travelFields(draft), source: sourceId ? { provider: sourceId === current?.source?.id ? current.source.provider : 'google', id: sourceId } : undefined,
      }
      const next: Commitment = { ...current, id: id.current, date, label: title.trim() || 'Termin', context: kind, commitment: hard ? 'hard' : 'soft', start: time, status: current?.status ?? 'planned', ...patch }
      if (!validCommitment(next)) throw new Error('Prüfe Beginn, Ende und die Minutenangaben. Es wurde nichts geändert.')
      if (commitment) await st.updateCommitment(id.current, patch, `Termin geändert um ${fmtTime(time)}`)
      else await st.adjustCommitment(next, `Termin um ${fmtTime(time)}`, reason)
      onDone('Eingeplant. Ort und Rückkehr bleiben offen, solange du sie nicht angibst.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Der Termin konnte nicht gespeichert werden.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <form className="min-w-0 space-y-3" onSubmit={(event) => { event.preventDefault(); void save() }}>
    <fieldset disabled={busy} className="min-w-0 space-y-3">
      <label className="block space-y-1"><span>Was hast du vor?</span><TextInput autoFocus aria-label="Was hast du vor?" placeholder="Zum Beispiel Kunde B um 09:00" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <Segmented<EventContext> label="Art" value={kind} onChange={(value) => { setKind(value); setHard(value === 'customer' || value === 'personal' || value === 'work') }} options={[{ value: 'social', label: 'Freunde' }, { value: 'personal', label: 'Termin' }, { value: 'customer', label: 'Kunde' }, { value: 'other', label: 'Unterwegs' }]} />
      <div className="flex flex-wrap items-center justify-between gap-2"><span>Beginn / gewünschte Ankunft</span><TimeField label="Beginn" value={time ?? 17 * 60} onChange={setStart} /></div>
      {time === undefined && <Button size="sm" onClick={() => setStart(17 * 60)}>17:00 übernehmen</Button>}
      <Segmented<LocationKind> label="Termin findet statt" value={draft.locationKind} onChange={(value) => setDraft({ ...draft, locationKind: value })} options={[{ value: 'unknown', label: 'Noch unklar' }, { value: 'onsite', label: 'Vor Ort' }, { value: 'remote', label: 'Remote' }, { value: 'home', label: 'Zuhause' }]} />
      <Button variant="ghost" size="sm" aria-expanded={details} onClick={() => setDetails(!details)}>Weg & Vorbereitung</Button>
      {details && <div className="space-y-3 border-t border-line pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span>Ende</span>{end === undefined ? <Button size="sm" onClick={() => setEnd((time ?? 17 * 60) + 60)}>Ende eintragen</Button> : <div className="flex items-center gap-2"><TimeField label="Ende" value={end} onChange={(value) => setEnd(time !== undefined && value <= time ? value + 1440 : value)} /><Button size="sm" variant="ghost" onClick={() => setEnd(undefined)}>Ende offen lassen</Button></div>}</div>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={hard} onChange={(event) => setHard(event.target.checked)} />Feste Verpflichtung</label>
        <TravelFields draft={draft} onChange={setDraft} places={st.local.places} showLocation={false} morning={time === undefined || time < 720} />
        {events.length > 0 && <label className="block space-y-1"><span>Mit Kalendertermin verbinden (freiwillig)</span><select aria-label="Kalendertermin verbinden" className={FIELD} value={sourceId} onChange={(event) => {
          setSourceId(event.target.value)
          const selected = events.find((item) => item.id === event.target.value)
          if (selected) { setStart(minutesOnPlanDay(date, selected.start)); setEnd(minutesOnPlanDay(date, selected.end)); if (!title.trim()) setTitle(selected.title) }
        }}><option value="">Keine Verknüpfung</option>{events.map((event) => <option key={event.id} value={event.id}>{fmtTime(minutesOnPlanDay(date, event.start))} · {event.title}</option>)}</select><span className="text-sm text-muted">Nur diese ausdrücklich gewählte Quelle wird einmal geplant. Anker verändert den externen Kalender nicht.</span></label>}
      </div>}
      {time !== undefined && <p className="rounded-xl bg-surface-2 p-3">{date} · {fmtTime(time)} · {title.trim() || 'Termin'} · {end === undefined ? 'Ende offen' : `bis ${fmtTime(end)}`} · {draft.locationKind === 'remote' ? 'Remote, keine Fahrt' : draft.locationKind === 'home' ? 'Zuhause' : draft.placeLabel || 'Ort noch offen'}</p>}
      <Button type="submit" disabled={time === undefined} variant="primary" size="lg" className="w-full">{commitment ? 'Änderungen speichern' : 'So übernehmen'}</Button>
    </fieldset>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    <p className="text-sm text-muted">Termine und Orte bleiben auf diesem Gerät. Eine bewusste Maps-Öffnung oder ausdrücklich freigegebene Wetter- und Routenabfragen können die dafür nötigen Ortsangaben übertragen.</p>
  </form>
}

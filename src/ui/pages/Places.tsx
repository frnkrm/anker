import { useRef, useState } from 'react'
import { randomId } from '../../core/defaults'
import { validPlace } from '../../core/travel'
import type { Place, PlaceKind } from '../../core/types'
import { useApp } from '../../state/store'
import { Button, Card, Checkbox, Choice, MoreInfo, Page, Section, TextInput } from '../components/ui'

const FIELD = 'min-h-12 w-full min-w-0 rounded-xl bg-surface-2 px-3'
const KIND: Record<PlaceKind, string> = { home: 'Zuhause', office: 'Büro', customer: 'Kunde', private: 'Privater Ort', other: 'Anderer Ort' }

export default function Places() {
  const st = useApp()
  const [editing, setEditing] = useState<Place | 'new'>()
  const [remove, setRemove] = useState<string>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <Page title="Orte & manuelle Wege">
    <p className="text-muted">Ein Name genügt. Adressen und Wegzeiten sind freiwillig und bleiben auf diesem Gerät.</p>
    {editing ? <PlaceForm key={editing === 'new' ? 'new' : editing.id} place={editing === 'new' ? undefined : editing} onDone={() => setEditing(undefined)} /> : <Button onClick={() => setEditing('new')}>Ort hinzufügen</Button>}
    <Section title="Deine Orte">
      {st.local.places.length === 0 && <p className="px-1 text-muted">Noch keine Orte gespeichert. Termine funktionieren auch mit einem frei eingegebenen oder offenen Ort.</p>}
      {st.local.places.map((place) => <Card key={place.id} className="min-w-0 space-y-3">
        <h2 className="break-words text-lg font-semibold">{place.label}</h2>
        <p className="text-sm text-muted">{KIND[place.kind ?? 'other']}{place.address ? ` · ${place.address}` : ''}</p>
        {place.travelFromHomeMin !== undefined && <p className="text-sm text-muted">Von Zuhause: etwa {place.travelFromHomeMin} min, deine Schätzung</p>}
        {place.items?.length ? <p className="text-sm text-muted">Mitnehmen: {place.items.join(', ')}</p> : null}
        <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setEditing(place)}>Ort bearbeiten</Button><Button size="sm" variant="ghost" onClick={() => setRemove(remove === place.id ? undefined : place.id)}>Ort entfernen</Button></div>
        {remove === place.id && <div className="space-y-2 rounded-xl border border-line p-3">
          <p>Aus der Ortsliste entfernen? Bereits eingetragene Termine behalten ihre gewählten Ortsangaben. Ein Verweis als Startort wird wieder offen.</p>
          <Button disabled={busy} size="sm" onClick={async () => {
            setBusy(true); setError('')
            try { await st.removePlace(place.id); setRemove(undefined) }
            catch (reason) { setError(reason instanceof Error ? reason.message : 'Der Ort konnte nicht entfernt werden.') }
            finally { setBusy(false) }
          }}>Entfernen bestätigen</Button>
        </div>}
      </Card>)}
    </Section>
    {error && <p role="alert" className="text-warm">{error}</p>}
    <p className="text-sm text-muted">Karten, Wetter und Routen bekommen diese Angaben nur bei bewusster Freigabe. Eine gespeicherte Adresse löst keine Abfrage aus.</p>
  </Page>
}

function PlaceForm({ place, onDone }: { place?: Place; onDone: () => void }) {
  const st = useApp()
  const id = useRef(place?.id ?? randomId())
  const [label, setLabel] = useState(place?.label ?? '')
  const [kind, setKind] = useState<PlaceKind>(place?.kind ?? 'other')
  const [address, setAddress] = useState(place?.address ?? '')
  const [fromHome, setFromHome] = useState(place?.travelFromHomeMin?.toString() ?? '')
  const [travelFrom, setTravelFrom] = useState<Record<string, string>>(Object.fromEntries(Object.entries(place?.travelFrom ?? {}).map(([key, value]) => [key, String(value)])))
  const [items, setItems] = useState((place?.items ?? []).join('\n'))
  const [latitude, setLatitude] = useState(place?.latitude?.toString() ?? '')
  const [longitude, setLongitude] = useState(place?.longitude?.toString() ?? '')
  const [weather, setWeather] = useState(place?.externalUse?.weather ?? false)
  const [routes, setRoutes] = useState(place?.externalUse?.routes ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const origins = [{ id: 'office', label: 'Büro' }, ...st.local.places.filter((candidate) => candidate.id !== id.current)]
  const save = async () => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const current = useApp.getState().local.places.find((candidate) => candidate.id === id.current)
      const next: Place = {
        ...current, id: id.current, label: label.trim(), kind, address: address.trim() || undefined,
        travelFromHomeMin: fromHome.trim() ? Number(fromHome) : undefined,
        travelFrom: Object.fromEntries(Object.entries(travelFrom).filter(([, value]) => value.trim()).map(([key, value]) => [key, Number(value)])),
        items: items.split('\n').map((item) => item.trim()).filter(Boolean),
        latitude: latitude.trim() ? Number(latitude) : undefined, longitude: longitude.trim() ? Number(longitude) : undefined,
        externalUse: { weather, routes },
      }
      if (!validPlace(next)) throw new Error('Ein Name ist nötig. Wegzeiten müssen gültige Minuten sein; Koordinaten bitte vollständig eingeben oder beide offen lassen.')
      await st.savePlace(next)
      onDone()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Der Ort konnte nicht gespeichert werden.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <Card><form className="min-w-0 space-y-3" onSubmit={(event) => { event.preventDefault(); void save() }}>
    <fieldset disabled={busy} className="min-w-0 space-y-3">
      <label className="block space-y-1"><span>Name</span><TextInput autoFocus aria-label="Name des Orts" value={label} onChange={(event) => setLabel(event.target.value)} /></label>
      <label className="block space-y-1"><span>Weg von Zuhause (Minuten)</span><TextInput type="number" inputMode="decimal" min="0" max="1440" aria-label="Weg von Zuhause" placeholder="Noch offen" value={fromHome} onChange={(event) => setFromHome(event.target.value)} /></label>
      <MoreInfo summary="Adresse und weitere Angaben">
        <Choice label="Art des Orts" value={kind} onChange={(value) => setKind(value as PlaceKind)} options={Object.entries(KIND).map(([value, label]) => ({ value, label }))} />
        <label className="block space-y-1"><span>Adresse</span><TextInput aria-label="Adresse des Orts" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
        <MoreInfo summary="Weitere Wege">{origins.map((origin) => <label key={origin.id} className="block space-y-1"><span>Weg von {origin.label} (Minuten)</span><TextInput type="number" inputMode="decimal" min="0" max="1440" aria-label={`Weg von ${origin.label}`} placeholder="Noch offen" value={travelFrom[origin.id] ?? ''} onChange={(event) => setTravelFrom({ ...travelFrom, [origin.id]: event.target.value })} /></label>)}</MoreInfo>
        <label className="block space-y-1"><span>Mitnehmen (eine Sache je Zeile)</span><textarea aria-label="Dinge am Ort" className={FIELD + ' py-3'} rows={3} value={items} onChange={(event) => setItems(event.target.value)} /></label>
        <p className="text-sm text-muted">Koordinaten sind freiwillig. Eine Adresse wird nicht automatisch gesucht oder an einen Dienst geschickt.</p>
        <label className="block space-y-1"><span>Breitengrad</span><TextInput type="number" step="any" aria-label="Breitengrad" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
        <label className="block space-y-1"><span>Längengrad</span><TextInput type="number" step="any" aria-label="Längengrad" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
        <Checkbox checked={weather} onChange={setWeather}>Diesen Ort nach zusätzlicher Dienste-Aktivierung für Wetter verwenden dürfen</Checkbox>
        <Checkbox checked={routes} onChange={setRoutes}>Diesen Ort nach zusätzlicher Dienste-Aktivierung für Routenschätzungen verwenden dürfen</Checkbox>
        <p className="text-sm text-muted">Beides ist freiwillig und standardmäßig aus. Speichern allein startet keinen Dienst. Die eigentliche Aktivierung erklärt Empfänger und übertragene Angaben nochmals.</p>
      </MoreInfo>
      <div className="flex flex-wrap gap-2"><Button type="submit" variant="primary">Ort speichern</Button><Button variant="ghost" onClick={onDone}>Abbrechen</Button></div>
    </fieldset>
    {error && <p role="alert" className="text-warm">{error}</p>}
  </form></Card>
}

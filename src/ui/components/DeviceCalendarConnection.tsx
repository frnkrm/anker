import { useEffect, useRef, useState } from 'react'
import { connectDeviceCalendars, deviceCalendarOptions, disconnectDeviceCalendars, refreshDeviceCalendar } from '../../platform/deviceCalendar'
import { isNative, type DeviceCalendarOption } from '../../platform/native'
import { useApp } from '../../state/store'
import { Button } from './ui'

/** Explicit Android permission and account-bound selection; no OAuth setup is needed here. */
export function DeviceCalendarConnection() {
  const st = useApp()
  const selected = st.local.extras?.deviceCalendar
  const [calendars, setCalendars] = useState<DeviceCalendarOption[]>()
  const [ids, setIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const intent = useRef(0)
  const mounted = useRef(true)
  const pending = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  if (!isNative()) return null
  const action = async (perform: (accept: () => boolean) => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setMessage('')
    const generation = ++intent.current
    const accept = () => mounted.current && generation === intent.current
    try { await perform(accept) }
    catch { if (accept()) setMessage('Das hat noch nicht geklappt. Prüfe den Kalenderzugriff und versuche es erneut. Deine bisherigen Termine bleiben erhalten.') }
    finally { if (generation === intent.current) { pending.current = false; if (accept()) setBusy(false) } }
  }
  return <section aria-label="Google-Kalender vom Handy" className="min-w-0 space-y-3">
    <h3 className="break-words text-lg font-semibold">Google-Kalender auf diesem Handy</h3>
    <p className="text-sm text-muted">Wähle Google-Kalender aus, die Android bereits auf deinem Handy synchronisiert. Anker liest nur die nächsten drei Tage; es schreibt keine Termine in diese Kalender.</p>
    <p className="text-sm text-muted">Du bestimmst die Lesequelle: Diese Auswahl ersetzt den bisherigen Kalenderimport in Anker. Eigene Aufgaben und von dir angelegte Termine bleiben erhalten. Das Schreiben in einen eigenen Anker-Kalender ist eine getrennte Wahl.</p>
    {selected?.enabled && <p role="status" className="text-sm text-muted">{selected.calendarIds.length} {selected.calendarIds.length === 1 ? 'Kalender ist' : 'Kalender sind'} auf diesem Handy ausgewählt.</p>}
    <Button className="w-full" disabled={busy} onClick={() => void action(async accept => {
      const result = await deviceCalendarOptions(true, accept)
      if (!accept()) return
      if (!result.granted) { setMessage('Kalenderzugriff wurde nicht erteilt. Du kannst deine Termine weiterhin selbst eintragen.'); return }
      setCalendars(result.calendars)
      setIds((selected?.calendarIds ?? []).filter(id => result.calendars.some(calendar => calendar.id === id)))
      if (!result.calendars.length) setMessage('Hier sind noch keine synchronisierten Google-Kalender verfügbar. Prüfe unter Android → Konten dein Google-Konto und dessen Kalendersynchronisierung.')
    })}>{selected?.enabled ? 'Kalenderauswahl ändern' : 'Google-Kalender auf dem Handy auswählen'}</Button>
    {calendars && calendars.length > 0 && <fieldset disabled={busy} className="min-w-0 space-y-3">
      <legend className="mb-2 font-medium">Welche Kalender darf Anker lesen?</legend>
      {calendars.map(calendar => <label key={calendar.id} className="flex min-h-12 min-w-0 items-start gap-3 rounded-xl border border-line p-3">
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" aria-label={`${calendar.name} · ${calendar.account}`} checked={ids.includes(calendar.id)} onChange={event => setIds(current => event.target.checked ? current.length < 20 ? [...current, calendar.id] : current : current.filter(id => id !== calendar.id))} />
        <span className="min-w-0 break-words"><span className="block font-medium">{calendar.name}</span><span className="block text-sm text-muted [overflow-wrap:anywhere]">{calendar.account}</span></span>
      </label>)}
      <p className="text-sm text-muted">Bis zu 20 Kalender. Die Auswahl gilt nur für dieses Handy.</p>
      <Button className="w-full" disabled={busy || ids.length === 0} onClick={() => void action(async accept => {
        const ok = await connectDeviceCalendars(ids, accept)
        if (!accept()) return
        setMessage(ok ? 'Ausgewählte Kalender sind eingelesen.' : 'Die Auswahl konnte noch nicht vollständig eingelesen werden. Prüfe den Kalenderzugriff; der letzte Stand bleibt sichtbar.')
        if (ok) setCalendars(undefined)
      })}>Ausgewählte Kalender lesen</Button>
    </fieldset>}
    {selected?.enabled && <div className="grid min-w-0 gap-2">
      <Button className="w-full" disabled={busy} onClick={() => void action(async accept => {
        const ok = await refreshDeviceCalendar()
        if (accept()) setMessage(ok ? 'Kalender auf diesem Handy aktualisiert.' : 'Gerade nicht aktualisierbar. Prüfe den Zugriff und deine Kalenderauswahl; der letzte Stand bleibt sichtbar.')
      })}>Jetzt Kalender aktualisieren</Button>
      <Button className="w-full" variant="ghost" onClick={() => {
        const generation = ++intent.current
        pending.current = false; setBusy(true); setCalendars(undefined); setIds([])
        void disconnectDeviceCalendars().then(() => { if (mounted.current && generation === intent.current) { setBusy(false); setMessage('Handykalender getrennt. Eigene Aufgaben und Termine bleiben erhalten.') } })
          .catch(() => { if (mounted.current && generation === intent.current) { setBusy(false); setMessage('Die Trennung konnte noch nicht gespeichert werden. Versuche es erneut.') } })
      }}>Handykalender trennen</Button>
    </div>}
    {message && <p role="status" className="break-words text-sm text-muted">{message}</p>}
  </section>
}

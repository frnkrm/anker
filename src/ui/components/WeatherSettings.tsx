import { useEffect, useRef, useState } from 'react'
import { randomId } from '../../core/defaults'
import { currentWeatherProfile } from '../../core/weatherProfile'
import type { Settings, WeatherProfile } from '../../core/types'
import { findCity } from '../../platform/weather'
import { useApp } from '../../state/store'
import { Button, Card, SettingRow, Stepper, TextInput, Toggle } from './ui'

const token = (profile: WeatherProfile | undefined) => JSON.stringify(profile && [profile.enabled, profile.city, profile.lat, profile.lng, profile.revision])

export function WeatherSettings({ s, save }: { s: Settings; save: (fn: (settings: Settings) => Settings) => void }) {
  const st = useApp()
  const profile = currentWeatherProfile(s, st.local)
  const [city, setCity] = useState(profile?.city ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)
  useEffect(() => () => { generation.current++ }, [])

  const changeEnabled = async (enabled: boolean) => {
    generation.current++
    setBusy(false)
    try {
      await st.saveLocal((local) => ({ ...local, weatherProfile: {
        ...(currentWeatherProfile(useApp.getState().settings, local) ?? { city: '' }), enabled, revision: randomId(),
      } }))
      setMessage(enabled ? 'Wetterhinweise eingeschaltet. Der Wetterort bleibt auf diesem Gerät.' : 'Wetter ausgeschaltet. Es werden keine neuen Wetterdaten abgefragt.')
    } catch { setMessage('Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.') }
  }

  const chooseCity = async () => {
    const query = city.trim()
    if (!query) return
    const version = ++generation.current
    const before = token(currentWeatherProfile(useApp.getState().settings, useApp.getState().local))
    setBusy(true); setMessage('')
    const found = await findCity(query)
    if (version !== generation.current) return
    if (!found) { setBusy(false); setMessage('Ort nicht gefunden oder Wetter gerade nicht erreichbar. Planung und Packlisten funktionieren weiter.'); return }
    let applied = false
    try {
      await st.saveLocal((local) => {
        if (version !== generation.current || token(currentWeatherProfile(useApp.getState().settings, local)) !== before) return local
        applied = true
        return { ...local, weatherProfile: { enabled: true, city: found.name, lat: found.lat, lng: found.lng, revision: randomId() } }
      })
      if (version === generation.current && applied) { setCity(found.name); setMessage(`${found.name} eingestellt. Deine Kleidungsvorlieben bleiben erhalten.`) }
    } catch { if (version === generation.current) setMessage('Der Ort konnte noch nicht sicher gespeichert werden.') }
    finally { if (version === generation.current) setBusy(false) }
  }

  return <Card className="space-y-3">
    <SettingRow label={<span>Wetterhinweise</span>}>
      <Toggle label="Wetterhinweise" checked={!!profile?.enabled} onChange={(value) => void changeEnabled(value)} />
    </SettingRow>
    <p className="text-sm text-muted">Freiwillig. Bei der Stadtsuche erhält Open-Meteo den eingegebenen Namen, für die Vorhersage die gewählten Koordinaten und deine IP-Adresse. Keine Termintitel und keine GPS-Abfrage.</p>
    <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void chooseCity() }}>
      <TextInput aria-label="Ort für das Wetter" placeholder="Deine Stadt" value={city} maxLength={200} onChange={(event) => {
        generation.current++; setBusy(false); setCity(event.target.value)
      }} />
      <Button type="submit" disabled={busy || !city.trim()}>{busy ? 'Ort wird gesucht …' : 'Stadt suchen & Wetter einschalten'}</Button>
    </form>
    {profile?.enabled && <p className="break-words text-sm text-muted">Gewählter Wetterort: {profile.city || 'Bei freigegebenen gespeicherten Orten'}. Nur Orte mit deiner eigenen Wetterfreigabe werden für einen Termin verwendet.</p>}
    {message && <p role="status" className="break-words text-sm text-muted">{message}</p>}
    <SettingRow label={<span>Jacke unter</span>}>
      <Stepper label="Jacke unter" value={s.weather.rules.jacketBelowC} step={1} min={-10} max={30} unit="°C" onChange={(value) => save((current) => ({ ...current, weather: { ...current.weather, rules: { ...current.weather.rules, jacketBelowC: value } } }))} />
    </SettingRow>
    <SettingRow label={<span>Regenschutz ab</span>}>
      <Stepper label="Regenschutz ab" value={s.weather.rules.rainAbovePct} step={10} min={10} max={100} unit="%" onChange={(value) => save((current) => ({ ...current, weather: { ...current.weather, rules: { ...current.weather.rules, rainAbovePct: value } } }))} />
    </SettingRow>
    {profile?.enabled && <Button size="sm" variant="ghost" onClick={() => void changeEnabled(false)}>Wetter ausschalten</Button>}
    <details className="text-sm text-muted">
      <summary className="min-h-11 py-2">Wetterdaten & Datenschutz</summary>
      <p>Open-Meteo ist für private nichtkommerzielle Nutzung ohne API-Key verfügbar. Fair Use: Bei mehr als 10.000 Anfragen am Tag verlangt der Anbieter Kontakt. Anker nutzt einen Cache für drei Stunden, begrenzt Wiederholungen und zeigt ältere Daten ausdrücklich an. Nach einem Tag werden sie nicht mehr als brauchbare Vorhersage angezeigt.</p>
      <p className="mt-2">Dein Wetterort und dessen Freigabe bleiben lokal. Kleidungsvorlieben können mit deinen übrigen Einstellungen synchronisiert werden. Bei fehlenden Daten bleiben Planung und Packlisten nutzbar.</p>
      <p className="mt-2"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline">Daten: CC BY 4.0</a>. Stundenwerte werden zusammengefasst; Vorschläge folgen deinen Regeln. Keine amtlichen Wetterwarnungen.</p>
      <p className="mt-2">Ortssuche: GeoNames-Daten über <a href="https://github.com/open-meteo/geocoding-api" target="_blank" rel="noreferrer" className="underline">Open-Meteo Geocoding</a>, <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer" className="underline">CC BY-NC 4.0</a>. Verwendung für nichtkommerzielle Zwecke.</p>
    </details>
  </Card>
}

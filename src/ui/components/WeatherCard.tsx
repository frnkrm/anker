import { useEffect, useState } from 'react'
import { addDays, fmtTime } from '../../core/time'
import { outdoorWindow, weatherAdvice } from '../../core/weather'
import type { WeatherCache } from '../../core/types'
import { loadWeather } from '../../platform/weather'
import { planFor, today, useApp } from '../../state/store'
import { Card } from './ui'

/** Abendkarte „Was brauche ich morgen?“. Erscheint nur, wenn Wetter eingeschaltet ist und du morgen rausgehst. */
export function WeatherCard() {
  const st = useApp()
  const enabled = st.settings.weather.enabled
  const [data, setData] = useState<WeatherCache>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!enabled) return
    void loadWeather().then((w) => {
      setData(w)
      setFailed(!w)
    })
  }, [enabled])
  if (!enabled) return null
  const date = addDays(today(), 1)
  const window = outdoorWindow(planFor(date))
  if (!window) return null
  if (failed) return <Card>Wetter gerade nicht verfügbar.</Card>
  if (!data) return null
  const a = weatherAdvice(data.hours.filter((h) => h.date === date), window, st.settings.weather.rules)
  if (!a) return <Card>Wetter gerade nicht verfügbar.</Card>
  return (
    <Card className="space-y-1">
      <p className="font-medium">{a.windowLabel}</p>
      <p>{a.summary}. Eine Vorhersage kann danebenliegen.</p>
      {a.suggestions.length > 0 && <p>Vorschlag: {a.suggestions.join(', ')}.</p>}
      <p className="text-sm text-muted">
        {st.settings.weather.city}, Stand {fmtTime(Math.floor((data.fetchedAt - new Date(data.fetchedAt).setHours(0, 0, 0, 0)) / 60_000))}. Daten:{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">
          Open-Meteo
        </a>{' '}
        (CC BY 4.0)
      </p>
    </Card>
  )
}

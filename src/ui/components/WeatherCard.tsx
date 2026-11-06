import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { addDays } from '../../core/time'
import { outdoorWindow, weatherAdvice, weatherAge, weatherHoursForPlan, WEATHER_CACHE_MS } from '../../core/weather'
import { currentWeatherProfile, weatherTarget } from '../../core/weatherProfile'
import type { WeatherCache } from '../../core/types'
import { loadWeather } from '../../platform/weather'
import { usePlan, useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { Button, Card } from './ui'

const stand = (at: number) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }).format(at)

/** Eine kompakte Vorhersage für den frühesten tatsächlichen Draußenabschnitt des gewählten Tags. */
export function WeatherCard({ date: selectedDate }: { date?: string }) {
  const st = useApp()
  const { date: currentDate, now } = useToday()
  const date = selectedDate ?? addDays(currentDate, 1)
  const plan = usePlan(date)
  const profile = currentWeatherProfile(st.settings, st.local)
  const window = useMemo(() => outdoorWindow(plan), [plan])
  const target = useMemo(() => weatherTarget(profile, st.local.places, window?.placeId, window?.placeKind), [profile, st.local.places, window?.placeId, window?.placeKind])
  const key = `${target?.key ?? ''}|${target?.source ?? ''}|${target?.placeId ?? ''}|${profile?.revision ?? ''}|${date}`
  const [result, setResult] = useState<{ key: string; data?: WeatherCache }>()
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    if (!window || !target || !profile?.enabled) return
    let active = true
    void loadWeather(false, target).then((data) => { if (active) setResult({ key, data }) })
    return () => { active = false }
  }, [key, target, profile?.enabled, window])
  if (!profile?.enabled || !window) return null
  if (!target) return <Card><p>Wetter gerade nicht verfügbar. Wähle eine Stadt oder einen ausdrücklich freigegebenen Wetterort.</p><Link to="/einstellungen/hilfen" className="flex min-h-11 items-center text-accent">Wetterort einstellen</Link></Card>
  const cached = st.local.weather?.key === target.key && weatherAge(st.local.weather, now) !== undefined ? st.local.weather : undefined
  const responseData = result?.key === key && weatherAge(result.data, now) !== undefined ? result.data : undefined
  const data = cached ?? responseData
  const advice = data ? weatherAdvice(weatherHoursForPlan(data, date), window, st.settings.weather.rules, date === currentDate ? 'Heute' : date === addDays(currentDate, 1) ? 'Morgen' : date) : undefined
  const age = weatherAge(data, now)
  const stale = age !== undefined && age >= WEATHER_CACHE_MS
  const refresh = async () => {
    const requestKey = key
    setRefreshing(true)
    const next = await loadWeather(true, target)
    setResult({ key: requestKey, data: next })
    setRefreshing(false)
  }
  return <Card className="space-y-2">
    <p className="font-medium">{advice?.windowLabel ?? 'Wetter für deine Draußenzeit'}</p>
    <p className="break-words">{target.label}{target.source === 'city' && window.label ? ` · gewählte Stadt für ${window.label}` : ''}</p>
    {advice ? <>
      <p>{advice.summary}. Eine Vorhersage kann danebenliegen.</p>
      {advice.suggestions.length > 0 && <p>Vorschlag: {advice.suggestions.join(', ')}. Du entscheidest.</p>}
      <p className={stale ? 'text-sm text-warm' : 'text-sm text-muted'}>{stale ? 'Ältere Vorhersage, ' : ''}Stand {stand(data!.fetchedAt)} (Berliner Zeit).</p>
    </> : <p>{result?.key === key ? 'Wetter gerade nicht verfügbar. Planung und Packliste bleiben nutzbar.' : 'Wetter wird abgefragt …'}</p>}
    <Button size="sm" variant="ghost" disabled={refreshing} onClick={() => void refresh()}>Wetter neu abfragen</Button>
    <p className="text-xs text-muted"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline">CC BY 4.0</a>. Stundenwerte zusammengefasst, Vorschläge nach deinen Regeln. Ortssuche: <a href="https://github.com/open-meteo/geocoding-api" target="_blank" rel="noreferrer" className="underline">GeoNames über Open-Meteo</a> (<a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer" className="underline">CC BY-NC 4.0</a>).</p>
  </Card>
}

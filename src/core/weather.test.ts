import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLocal } from './defaults'
import { buildDayPlan } from './planner'
import { changePrepared, packingTemplates, preparedItems, validPackingLocal } from './packing'
import { currentWeatherProfile, migrateWeatherState, validWeatherLocal, weatherRecordForSync, weatherTarget } from './weatherProfile'
import { outdoorWindow, parseForecast, validWeatherCache, weatherAdvice, weatherAge, weatherHoursForPlan, WEATHER_CACHE_MS } from './weather'
import type { Commitment, LocalData, WeatherCache } from './types'

const at = Date.parse('2026-11-06T19:00:00+01:00')
const settings = defaultSettings('2026-11-06')
const body = { hourly: { time: ['2026-11-07T07:00', '2026-11-07T08:00'], temperature_2m: [8, 10], apparent_temperature: [5, 7], precipitation_probability: [20, 70], wind_speed_10m: [12, 15] } }
const cache: WeatherCache = { key: '50,9', fetchedAt: at, validated: true, hours: parseForecast(body)! }

describe('Keine erfundenen Wetterwerte', () => {
  it('bewahrt wirkliche null Grad, verwirft null, NaN, ungültige Stunden und fehlende Spalten', () => {
    const valid = structuredClone(body)
    valid.hourly.temperature_2m[0] = 0
    expect(parseForecast(valid)?.[0]?.tempC).toBe(0)
    for (const bad of [null, {}, { hourly: {} }, { ...body, hourly: { ...body.hourly, temperature_2m: [null, null] } }, { ...body, hourly: { ...body.hourly, time: ['2026-02-31T07:00', '2026-11-07T25:00'] } }]) expect(parseForecast(bad)).toBeUndefined()
    expect(parseForecast({ hourly: { ...body.hourly, apparent_temperature: [NaN, 7] } })).toHaveLength(1)
  })

  it('kennt Cachealter und Uhrkorrekturen; alte ungeprüfte Parserdaten gelten nicht als Messung', () => {
    expect(validWeatherCache(cache)).toBe(true)
    expect(weatherAge(cache, at + WEATHER_CACHE_MS)).toBe(WEATHER_CACHE_MS)
    expect(weatherAge(cache, at - 1)).toBeUndefined()
    expect(weatherAge(cache, at + 25 * 3600_000)).toBeUndefined()
    expect(weatherAge({ ...cache, validated: undefined }, at)).toBeUndefined()
  })

  it('nutzt den früheren realen Pendelblock statt eines späteren Termins oder erfundener sechzig Minuten', () => {
    const plan = buildDayPlan({ date: '2026-11-06', settings })
    plan.blocks = [{ id: 'office-way', kind: 'commute', title: 'Losgehen', start: 420, end: 450 }]
    plan.legs = [{ commitment: { id: 'later', date: plan.date, label: 'Später', context: 'customer', commitment: 'hard', start: 600 }, fromLabel: 'Büro', toLabel: 'Kunde', leave: 550, travelMin: 40, travelOpen: false, items: [] }]
    expect(outdoorWindow(plan)).toMatchObject({ from: 420, to: 450, placeKind: 'office' })
    plan.homeOffice = true
    expect(outdoorWindow(plan)).toMatchObject({ from: 550, to: 590 })
    plan.legs[0]!.commitment.locationKind = 'remote'
    expect(outdoorWindow(plan)).toBeUndefined()
  })

  it('erhält den richtigen Kalendertag für späte Planminuten und zeigt Wind, tatsächliche/gefühlte Temperatur', () => {
    const hours = weatherHoursForPlan(cache, '2026-11-06')
    expect(hours[0]?.minutes).toBe(1440 + 420)
    const advice = weatherAdvice(hours, { from: 1440 + 420, to: 1440 + 480 }, settings.weather.rules)!
    expect(advice.summary).toContain('8 °C')
    expect(advice.summary).toContain('gefühlt 5 bis 7 °C')
    expect(advice.summary).toContain('Wind bis 15 km/h')
    expect(advice.suggestions).toEqual(['Jacke', 'Regenjacke oder Schirm'])
  })
})

describe('Wetterort bleibt lokal', () => {
  it('übernimmt alte gewählte Werte additiv und neutralisiert nur die Wetterortfelder im Settingsrecord', () => {
    const old = { ...settings, weather: { ...settings.weather, enabled: true, city: 'Altstadt', lat: 0, lng: 9 } }
    const local = { ...emptyLocal(), work: [{ id: 'work', title: 'Erhalten', createdAt: at }] }
    const migrated = migrateWeatherState(old, local)
    expect(migrated.changed).toBe(true)
    expect(migrated.local.weatherProfile).toMatchObject({ enabled: true, city: 'Altstadt', lat: 0, lng: 9 })
    expect(migrated.settings.weather).toEqual({ enabled: false, city: '', rules: settings.weather.rules })
    expect(migrated.local.work).toEqual(local.work)
    expect(old.weather.city).toBe('Altstadt')
    expect(migrateWeatherState(migrated.settings, migrated.local).changed).toBe(false)
  })

  it('überschreibt eine neue lokale Wahl nicht mit einem später eingespielten alten Settingsort', () => {
    const local: LocalData = { ...emptyLocal(), weatherProfile: { enabled: false, city: 'Neue Stadt', lat: 52, lng: 10 } }
    const old = { ...settings, weather: { ...settings.weather, enabled: true, city: 'Altstadt', lat: 50, lng: 9 } }
    expect(migrateWeatherState(old, local).local.weatherProfile).toEqual(local.weatherProfile)
    const projected = weatherRecordForSync({ collection: 'settings', id: 'main', data: old, updated_at: at, deleted: false })
    expect(JSON.stringify(projected)).not.toContain('Altstadt')
    expect(projected.data).toMatchObject({ weather: { enabled: false, city: '', rules: old.weather.rules } })
    expect(currentWeatherProfile(old, local)?.enabled).toBe(false)
  })

  it('verwendet gespeicherte Kundenkoordinaten ausschließlich nach Zweckfreigabe und ohne Namensübertragung', () => {
    const profile = { enabled: true, city: 'Gewählte Stadt', lat: 50, lng: 9 }
    const place = { id: 'customer', label: 'Privater Kundenname', latitude: 52, longitude: 10 }
    expect(weatherTarget(profile, [place], place.id)).toMatchObject({ key: '50,9', source: 'city' })
    expect(weatherTarget(profile, [{ ...place, externalUse: { weather: true } }], place.id)).toMatchObject({ key: '52,10', source: 'place' })
    expect(weatherTarget({ ...profile, enabled: false }, [{ ...place, externalUse: { weather: true } }], place.id)).toBeUndefined()
    expect(validWeatherLocal({ weatherProfile: { ...profile, lat: 200 } })).toBe(false)
  })
})

describe('Packen ist Vorbereitung, keine andere Erledigung', () => {
  const commitment: Commitment = { id: 'visit', date: '2026-11-07', label: 'Besuch', context: 'customer', commitment: 'hard', start: 540, items: ['Laptop', 'Netzteil', 'Unterlagen', 'Schlüssel'] }
  it('bewahrt vorbereitete Items über neuen Abfahrtspunkt, Reihenfolge und neu ergänzte Dinge', () => {
    const prepared = changePrepared(commitment, 'Laptop', true)
    const changed = { ...prepared, travelMin: 60, items: ['Schlüssel', 'Laptop', 'Netzteil', 'Unterlagen', 'Wasser'] }
    expect(preparedItems(changed, changed.items)).toEqual(['Laptop'])
    expect(commitment.preparedItems).toBeUndefined()
    expect(changePrepared(changed, 'Laptop', false).preparedItems).toEqual([])
  })
  it('hat veränderbare lokale Vorlagen und respektiert bewusst gelöschte Vorlagen', () => {
    expect(packingTemplates(emptyLocal())).toHaveLength(3)
    expect(packingTemplates({ ...emptyLocal(), packTemplates: [] })).toEqual([])
    expect(validPackingLocal({ packTemplates: packingTemplates(emptyLocal()), commitments: [commitment] })).toBe(true)
    expect(validPackingLocal({ packTemplates: [{ id: 'bad', label: '', context: 'customer', items: ['Laptop'] }] })).toBe(false)
    expect(validPackingLocal({ commitments: [{ ...commitment, preparedItems: [7] }] })).toBe(false)
  })
})

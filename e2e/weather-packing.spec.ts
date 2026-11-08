import { chooseValue, expandDetails } from './helpers/controls'
/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import type { GameState, LocalData, Settings, WeatherCache } from '../src/core/types'
import { storedRecord } from './helpers/storage'

const DATE = '2026-11-06'
const TOMORROW = '2026-11-07'
const START = new Date('2026-11-06T19:00:00+01:00').getTime()
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
const forecast = (start = 6, missing = false) => ({ hourly: {
  time: [6, 7, 8, 14].map((hour) => `${TOMORROW}T${String(hour).padStart(2, '0')}:00`),
  temperature_2m: missing ? [null, null, null, null] : [start, start + 1, start + 2, start + 20],
  apparent_temperature: [start - 2, start - 1, start, start + 18], precipitation_probability: [20, 70, 30, 0], wind_speed_10m: [12, 15, 10, 2],
} })

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date(START))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function seed(page: Page, patch: Partial<LocalData>, fontScale?: number) {
  await page.evaluate(({ patch, fallback, fontScale }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('records', 'readwrite')
      const records = transaction.objectStore('records')
      const read = records.get(['meta', 'local'])
      read.onsuccess = () => records.put({ collection: 'meta', id: 'local', data: { ...(read.result?.data ?? fallback), ...patch }, updated_at: Date.now(), deleted: false, dirty: 1 })
      if (fontScale !== undefined) {
        const settings = records.get(['settings', 'main'])
        settings.onsuccess = () => { settings.result.data.appearance.fontScale = fontScale; records.put(settings.result) }
      }
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }), { patch, fallback: emptyLocal(), fontScale })
}

function visit(enabled = true): Partial<LocalData> {
  return {
    weatherProfile: { enabled, city: 'Gewählte Stadt', lat: 50, lng: 9 },
    places: [{ id: 'weather-place', label: 'Wetterziel', kind: 'customer', latitude: 52, longitude: 10, externalUse: { weather: true } }],
    commitments: [{ id: 'visit', date: TOMORROW, label: 'Materialbesuch', context: 'customer', commitment: 'hard', start: 450, end: 510, placeId: 'weather-place', routeMode: 'driving', travelMin: 45, arrivalBufferMin: 0, prepMin: 0, items: ['Laptop', 'Netzteil', 'Unterlagen', 'Schlüssel'] }],
  }
}

test('Kundenwetter nutzt freigegebenen Zielort und frühes Stundenfenster; Packliste behält Vorbereitung ohne andere Erledigung', async ({ page }) => {
  const requests: string[] = []
  await page.route('https://api.open-meteo.com/**', async (route) => { requests.push(route.request().url()); await route.fulfill({ json: forecast() }) })
  await onboard(page)
  await seed(page, visit())
  const xp = (await storedRecord<GameState>(page, 'game', 'main'))?.xp ?? 0
  await page.goto('/vorbereitung')
  await expect(page.getByText('Morgen 06:45 bis 07:30 Uhr', { exact: true })).toBeVisible()
  await expect(page.getByText(/6 bis 7 °C, gefühlt 4 bis 5 °C/)).toBeVisible()
  await expect(page.getByText('Wetterziel', { exact: true })).toBeVisible()
  expect(requests).toHaveLength(1)
  expect(requests[0]).toContain('latitude=52&longitude=10')
  expect(requests[0]).not.toContain('Wetterziel')
  expect(requests[0]).not.toContain('Materialbesuch')
  await expect(page.getByRole('checkbox', { name: /für Materialbesuch vorbereitet$/ })).toHaveCount(3)
  await page.getByRole('button', { name: '1 weiteres Ding', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /für Materialbesuch vorbereitet$/ })).toHaveCount(4)
  const laptop = page.getByRole('checkbox', { name: 'Laptop für Materialbesuch vorbereitet', exact: true })
  await laptop.click()
  await expect(laptop).toBeChecked()
  await expect.poll(async () => (await local(page))?.commitments[0]?.preparedItems).toEqual(['Laptop'])
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Laptop für Materialbesuch vorbereitet', exact: true })).toBeChecked()
  await page.goto('/tag')
  await page.getByRole('radio', { name: 'Sa', exact: true }).click()
  await expandDetails(page, 'Weg & Vorbereitung')
  await expect(page.getByRole('checkbox', { name: 'Laptop für Materialbesuch vorbereitet', exact: true })).toBeChecked()
  expect((await local(page))?.commitments[0]?.arrivedAt).toBeUndefined()
  expect((await local(page))?.workSessions).toEqual([])
  expect((await storedRecord<GameState>(page, 'game', 'main'))?.xp ?? 0).toBe(xp)
  expect((await storedRecord<{ steps: Record<string, string> }>(page, 'days', DATE))?.steps ?? {}).toEqual({})
})

test('Bewusste Stadtsuche speichert Koordinaten nur lokal, Ortswechsel lädt passende Daten und Kleidungsvorlieben bleiben', async ({ page }) => {
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.fulfill({ json: { results: [{ name: 'Wetterstadt B', latitude: 53, longitude: 11 }] } }))
  const queries: string[] = []
  await page.route('https://api.open-meteo.com/**', async (route) => { queries.push(route.request().url()); await route.fulfill({ json: forecast(18) }) })
  await onboard(page)
  const data = visit(false)
  data.places![0]!.externalUse = { weather: false }
  await seed(page, data)
  await page.goto('/einstellungen/hilfen')
  await expandDetails(page, 'Wetter')
  await page.getByRole('textbox', { name: 'Ort für das Wetter', exact: true }).fill('Ort B')
  await page.getByRole('button', { name: 'Stadt suchen & Wetter einschalten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.weatherProfile?.city).toBe('Wetterstadt B')
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  expect(settings.weather.city).toBe('')
  expect(settings.weather.lat).toBeUndefined()
  expect(settings.weather.lng).toBeUndefined()
  expect(settings.weather.rules).toEqual({ jacketBelowC: 12, rainAbovePct: 40 })
  await page.goto('/vorbereitung')
  await expect(page.getByText(/18 bis 19 °C/)).toBeVisible()
  await expect(page.getByText(/Wetterstadt B · gewählte Stadt/)).toBeVisible()
  expect(queries[0]).toContain('latitude=53&longitude=11')
})

test('Fehlende Wetterwerte zeigen keine null Grad und ausgeschaltetes Wetter startet keinen Abruf', async ({ page }) => {
  let requests = 0
  await page.route('https://api.open-meteo.com/**', async (route) => { requests++; await route.fulfill({ json: forecast(6, true) }) })
  await onboard(page)
  await seed(page, visit(false))
  await page.goto('/vorbereitung')
  await expect(page.getByRole('checkbox', { name: 'Laptop für Materialbesuch vorbereitet', exact: true })).toBeVisible()
  expect(requests).toBe(0)
  await page.goto('/einstellungen/hilfen')
  await expandDetails(page, 'Wetter')
  await page.getByRole('switch', { name: 'Wetterhinweise', exact: true }).click()
  await expect.poll(async () => (await local(page))?.weatherProfile?.enabled).toBe(true)
  await page.goto('/vorbereitung')
  await expect(page.getByText('Wetter gerade nicht verfügbar. Planung und Packliste bleiben nutzbar.', { exact: true })).toBeVisible()
  await expect(page.getByText(/0 °C/)).toHaveCount(0)
  expect((await local(page))?.weather).toBeUndefined()
})

test('Offline bleiben ältere Wetterdaten beschriftet und Packvorlagen lassen sich bewusst bearbeiten und anwenden', async ({ page, context }) => {
  await onboard(page)
  const data = visit()
  const hours = [6, 7].map((hour) => ({ date: TOMORROW, minutes: hour * 60, tempC: 7, apparentC: 5, rainPct: 50, windKmh: 12 }))
  data.weather = { key: '52,10', fetchedAt: START - 4 * 3600_000, validated: true, hours } satisfies WeatherCache
  await seed(page, data)
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.goto('/vorbereitung')
  await expect(page.getByText(/Ältere Vorhersage, Stand/)).toBeVisible()
  await page.getByText('Packvorlagen anpassen', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Neue Packvorlage', exact: true }).fill('Unterwegs')
  await chooseValue(page, 'Art der Packvorlage', 'going-out')
  await page.getByRole('button', { name: 'Packvorlage anlegen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.packTemplates?.length).toBe(4)
  const card = page.getByText('Unterwegs · Ausgehen', { exact: true }).locator('..')
  await card.getByRole('textbox', { name: 'Gegenstände der Packvorlage Unterwegs', exact: true }).fill('Wasser\nKopfhörer')
  await card.getByRole('button', { name: 'Vorlage speichern', exact: true }).click()
  await expect.poll(async () => (await local(page))?.packTemplates?.find((template) => template.label === 'Unterwegs')?.items).toEqual(['Wasser', 'Kopfhörer'])
  expect((await local(page))?.commitments[0]?.items).toEqual(['Laptop', 'Netzteil', 'Unterlagen', 'Schlüssel'])
  await page.getByRole('button', { name: 'Packliste bearbeiten', exact: true }).click()
  const templateId = (await local(page))!.packTemplates!.find((template) => template.label === 'Unterwegs')!.id
  await chooseValue(page, 'Packvorlage Materialbesuch', templateId)
  await page.getByRole('button', { name: 'Vorlage ergänzen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments[0]?.items?.length).toBe(6)
  await page.reload()
  expect((await local(page))?.commitments[0]?.items).toEqual(['Laptop', 'Netzteil', 'Unterlagen', 'Schlüssel', 'Wasser', 'Kopfhörer'])
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
})

test('Wetter und Packdetails bleiben bei 320px und 160Prozent Schrift bedienbar', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: forecast() }))
  await onboard(page)
  await seed(page, visit(), 1.6)
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/vorbereitung')
  await expect(page.getByText(/Wind bis 15 km\/h/)).toBeVisible()
  await page.getByRole('button', { name: 'Packliste bearbeiten', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Packliste Materialbesuch', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(await page.getByRole('heading', { name: 'Für morgen vorbereiten', exact: true }).evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(24)
})

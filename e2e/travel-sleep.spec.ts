/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { chooseValue } from './helpers/controls'
import type { DayLog, GameState, LocalData, Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'

const DATE = '2026-11-02'
const TOMORROW = '2026-11-03'
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')

async function onboard(page: Page, homeOffice = false) {
  await page.clock.setFixedTime(new Date(`${DATE}T19:00:00+01:00`))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  // Ausschließlich Testkonfiguration; keine persönlichen Standardwerte werden vorausgesetzt.
  await page.evaluate((homeOffice) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('records', 'readwrite'); const store = tx.objectStore('records')
      const read = store.get(['settings', 'main'])
      read.onsuccess = () => {
        const record = read.result as { data: Settings }
        record.data.routines.morning = []
        record.data.sport.days = record.data.sport.days.map(() => false)
        record.data.travel.activationMin = 10
        record.data.travel.homeOfficeStartupMin = 5
        if (homeOffice) record.data.work[1] = { ...record.data.work[1]!, homeOffice: true, start: 9 * 60 }
        store.put(record)
      }
      tx.oncomplete = () => { db.close(); resolve() }; tx.onabort = () => { db.close(); reject(tx.error) }
    }
  }), homeOffice)
  await page.reload()
}

async function place(page: Page) {
  await page.goto('/orte')
  await page.getByRole('button', { name: 'Ort hinzufügen', exact: true }).click()
  await page.getByRole('textbox', { name: 'Name des Orts', exact: true }).fill('Kunde B')
  await page.getByText('Adresse und weitere Angaben', { exact: true }).click()
  await chooseValue(page, 'Art des Orts', 'customer')
  await page.getByRole('textbox', { name: 'Adresse des Orts', exact: true }).fill('Musterstraße 1, Köln')
  await page.getByRole('spinbutton', { name: 'Weg von Zuhause', exact: true }).fill('45')
  await page.getByText('Weitere Wege', { exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Weg von Büro', exact: true }).fill('20')
  await page.getByRole('textbox', { name: 'Dinge am Ort', exact: true }).fill('Laptop\nLadekabel')
  await page.getByRole('button', { name: 'Ort speichern', exact: true }).click()
  await expect.poll(async () => (await local(page))?.places.length).toBe(1)
  return (await local(page))!.places[0]!
}

async function tomorrow(page: Page) {
  await page.goto('/tag')
  await page.getByRole('radio', { name: 'Di', exact: true }).click()
}

async function customerForm(page: Page) {
  await tomorrow(page)
  await page.getByRole('button', { name: 'Morgen anders', exact: true }).click()
  await page.getByRole('button', { name: 'Ich habe morgen einen Termin', exact: true }).click()
  await page.getByRole('textbox', { name: 'Was hast du vor?', exact: true }).fill('Kundenbesuch')
  await page.getByRole('button', { name: 'Weg & Details', exact: true }).click()
  await chooseValue(page, 'Art', 'customer')
  await page.getByLabel('Beginn', { exact: true }).fill('09:00')
}

test('Orte bearbeiten bleibt lokal und startet ohne Zweckfreigabe keine externen Abfragen', async ({ page }) => {
  await onboard(page)
  const external: string[] = []
  const appOrigin = new URL(page.url()).origin
  page.on('request', (request) => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== appOrigin) external.push(request.url()) })
  const saved = await place(page)
  expect(saved).toMatchObject({ kind: 'customer', address: 'Musterstraße 1, Köln', travelFromHomeMin: 45, travelFrom: { office: 20 }, items: ['Laptop', 'Ladekabel'], externalUse: { weather: false, routes: false } })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Kunde B', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ort bearbeiten', exact: true }).click()
  await page.getByRole('textbox', { name: 'Name des Orts', exact: true }).fill('Kunde B geändert')
  await page.getByRole('button', { name: 'Ort speichern', exact: true }).click()
  await expect.poll(async () => (await local(page))?.places[0]?.label).toBe('Kunde B geändert')
  expect((await local(page))?.places[0]?.id).toBe(saved.id)
  expect(external).toEqual([])
})

test('Unklarer Kundenort bleibt offen; bewusst Remote ergibt im Homeoffice erst nach Wahl eine reine Plan-Weckzeit', async ({ page }) => {
  await onboard(page, true)
  const before = (await storedRecord<Settings>(page, 'settings', 'main'))!
  await customerForm(page)
  await page.getByRole('button', { name: 'So übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments.length).toBe(1)
  const id = (await local(page))!.commitments[0]!.id
  expect((await local(page))?.commitments[0]).toMatchObject({ locationKind: 'unknown' })
  await expect(page.getByText('Ort noch offen. Es wurde keine Fahrt oder sichere spätere Weckzeit angenommen.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Einmalig .* im Plan verwenden/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Termin bearbeiten', exact: true }).click()
  await page.getByRole('button', { name: 'Weg & Details', exact: true }).click()
  await page.getByRole('radiogroup', { name: 'Ort des Termins', exact: true }).getByRole('radio', { name: 'Remote', exact: true }).click()
  await page.getByRole('button', { name: 'Änderungen übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments[0]?.locationKind).toBe('remote')
  expect((await local(page))?.commitments[0]?.id).toBe(id)
  await expect(page.getByRole('button', { name: 'Einmalig 08:45 im Plan verwenden', exact: true })).toBeVisible()
  expect((await storedRecord<DayLog>(page, 'days', TOMORROW))?.override.wakeOverride).toBeUndefined()
  await page.getByRole('button', { name: 'Einmalig 08:45 im Plan verwenden', exact: true }).click()
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', TOMORROW))?.override.wakeOverride).toBe(525)
  await expect(page.getByText('Im Plan gespeichert. Die Web-Version stellt keinen Android-Wecker.', { exact: true })).toBeVisible()
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.anchor.wake).toBe(before.anchor.wake)
  expect((await local(page))?.meds).toEqual({}); expect((await local(page))?.workSessions).toEqual([])
})

test('Kundenweg und Vorbereitung liefern Q65/Q66, bleiben dieselbe Instanz und verändern den Wecker erst bewusst', async ({ page }) => {
  await onboard(page)
  const saved = await place(page)
  const game = await storedRecord<GameState>(page, 'game', 'main')
  await customerForm(page)
  await chooseValue(page, 'Gespeicherter Ort', saved.id)
  await page.getByRole('spinbutton', { name: 'Fahrzeit in Minuten', exact: true }).fill('45')
  await page.getByRole('spinbutton', { name: 'Ankunftspuffer Termin', exact: true }).fill('10')
  await page.getByRole('spinbutton', { name: 'Vorbereitung Termin', exact: true }).fill('30')
  await page.getByRole('checkbox', { name: 'Statt ins Büro, nur an diesem Tag', exact: true }).check()
  await page.getByRole('button', { name: 'So übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments[0]?.travelMin).toBe(45)
  const id = (await local(page))!.commitments[0]!.id
  await expect(page.getByRole('button', { name: 'Einmalig 07:25 im Plan verwenden', exact: true })).toBeVisible()
  expect((await storedRecord<DayLog>(page, 'days', TOMORROW))?.override.wakeOverride).toBeUndefined()
  await page.getByRole('button', { name: 'Termin bearbeiten', exact: true }).click()
  await page.getByRole('button', { name: 'Weg & Details', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Fahrzeit in Minuten', exact: true }).fill('60')
  await page.getByRole('button', { name: 'Änderungen übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments[0]?.travelMin).toBe(60)
  expect((await local(page))?.commitments).toHaveLength(1); expect((await local(page))?.commitments[0]?.id).toBe(id)
  await page.getByRole('button', { name: 'Einmalig 07:10 im Plan verwenden', exact: true }).click()
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', TOMORROW))?.override.wakeOverride).toBe(430)
  await page.reload(); await page.getByRole('radio', { name: 'Di', exact: true }).click()
  await expect(page.getByText(/Für diesen Tag im Plan:/)).toContainText('07:10')
  const standard = (await storedRecord<Settings>(page, 'settings', 'main'))!.anchor.wake
  await page.getByRole('button', { name: `Zurück zu ${String(Math.floor(standard / 60)).padStart(2, '0')}:${String(standard % 60).padStart(2, '0')}`, exact: true }).click()
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', TOMORROW))?.override.wakeOverride).toBeUndefined()
  expect((await storedRecord<DayLog>(page, 'days', TOMORROW))?.steps).toEqual({})
  expect(await storedRecord<GameState>(page, 'game', 'main')).toEqual(game)
})

test('Kalenderquelle wird bewusst einmal verknüpft und Maps bleibt ein manueller Aufruf ohne ETA-Rückkanal', async ({ page }) => {
  await onboard(page)
  await page.evaluate(({ date }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('records', 'readwrite')
      tx.objectStore('records').put({ collection: 'meta', id: 'events', updated_at: Date.now(), deleted: false, dirty: 1, data: [{ id: 'external-one', title: 'Kalenderquelle', start: Date.parse(`${date}T09:00:00+01:00`), end: Date.parse(`${date}T10:00:00+01:00`) }] })
      tx.oncomplete = () => { db.close(); resolve() }; tx.onabort = () => { db.close(); reject(tx.error) }
    }
  }), { date: TOMORROW })
  await customerForm(page)
  await page.getByRole('radiogroup', { name: 'Ort des Termins', exact: true }).getByRole('radio', { name: 'Vor Ort', exact: true }).click()
  await page.getByRole('textbox', { name: 'Ort', exact: true }).fill('Kunde B')
  await page.getByRole('textbox', { name: 'Adresse', exact: true }).fill('Musterstraße 1, Köln')
  await page.getByRole('spinbutton', { name: 'Fahrzeit in Minuten', exact: true }).fill('45')
  await chooseValue(page, 'Kalendertermin verbinden', 'external-one')
  await page.getByRole('button', { name: 'So übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments[0]?.source?.id).toBe('external-one')
  const timeline = page.getByRole('list', { name: 'Tageslinie', exact: true })
  await expect(timeline.getByRole('listitem').filter({ hasText: 'Kalenderquelle' })).toHaveCount(0)
  await expect(timeline.getByText('Kundenbesuch', { exact: true })).toHaveCount(1)
  await page.evaluate(() => {
    Object.assign(window, { __maps: [] as string[] })
    window.open = (url) => { (window as unknown as { __maps: string[] }).__maps.push(String(url)); return null }
  })
  const original = (await local(page))!.commitments[0]!
  await page.getByRole('button', { name: 'Route in Google Maps', exact: true }).click()
  const urls = await page.evaluate(() => (window as unknown as { __maps: string[] }).__maps)
  expect(urls).toHaveLength(1); expect(urls[0]).toContain('destination=Musterstra%C3%9Fe%201%2C%20K%C3%B6ln')
  expect((await local(page))!.commitments[0]).toEqual(original)
})

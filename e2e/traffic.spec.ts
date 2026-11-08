import { chooseValue, expandDetails } from './helpers/controls'
/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { AssistantRequest } from '../src/core/assistance'
import { emptyLocal } from '../src/core/defaults'
import type { Commitment, LocalData, Settings } from '../src/core/types'
import { installAssistanceBackend, startAssistanceServer } from './helpers/assistance-server'
import { storedRecord } from './helpers/storage'

const NOW = new Date('2026-11-09T06:00:00+01:00').getTime()
const visit: Commitment = { id: 'traffic-visit', date: '2026-11-09', label: 'Besuch am Montag', context: 'customer', commitment: 'hard', start: 9 * 60, locationKind: 'onsite', originPlaceId: 'home', placeId: 'customer', routeMode: 'driving', travelMin: 45, items: ['Mappe'] }
let server: Awaited<ReturnType<typeof startAssistanceServer>>
test.use({ serviceWorkers: 'block' })
test.beforeAll(async () => { test.setTimeout(120_000); server = await startAssistanceServer(4211) })
test.afterAll(async () => { await server?.close() })

async function seed(page: Page, consentedPlaces = true, extra: Partial<Commitment> = {}) {
  await page.clock.setFixedTime(new Date(NOW))
  await page.goto(`${server.url}/start`)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  const local = (await storedRecord<LocalData>(page, 'meta', 'local')) ?? emptyLocal()
  local.commitments = [{ ...visit, ...extra }]
  local.places = [
    { id: 'home', label: 'Nur der Name zuhause', kind: 'home', address: 'Bewusste Startadresse', externalUse: { routes: consentedPlaces } },
    { id: 'customer', label: 'Nur der Kundenname', kind: 'customer', latitude: 52, longitude: 13, externalUse: { routes: consentedPlaces } },
  ]
  local.assistance = { routes: { enabled: true, version: 1, at: NOW, automatic: false } }
  await page.evaluate((local) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('records', 'readwrite')
      transaction.objectStore('records').put({ collection: 'meta', id: 'local', data: local, updated_at: Date.now(), deleted: false, dirty: 1 })
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }), local)
  await page.goto(`${server.url}/tag`)
}
async function open(page: Page) {
  await expandDetails(page, 'Weg & Vorbereitung')
  await page.getByRole('button', { name: 'Fahrtzeit prüfen', exact: true }).click()
  return page.getByRole('dialog', { name: 'Fahrtzeit bewusst prüfen', exact: true })
}
function reply(input: AssistantRequest, durationMin = 70) {
  if (input.kind !== 'route') throw new Error('Der Test erwartet eine Routenanfrage')
  return { kind: 'route', revision: input.revision, route: { durationMin, source: 'Google Routes', fetchedAt: NOW, travelAt: input.at, mode: input.mode, trafficAware: input.mode === 'driving', estimated: true } }
}

test('E07: Vorschau sendet nichts, Quelle wird sichtbar und nur Übernehmen speichert eine eigene Fahrzeit', async ({ page }) => {
  const requests = await installAssistanceBackend(page, async (input, route) => { await route.fulfill({ json: reply(input) }) })
  await seed(page)
  const beforeSettings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  const dialog = await open(page)
  await expect(dialog.getByRole('textbox', { name: 'Start für die Fahrtschätzung' })).toHaveValue('Bewusste Startadresse')
  await expect(dialog.getByRole('textbox', { name: 'Ziel für die Fahrtschätzung' })).toHaveValue('52, 13')
  expect(requests).toEqual([])
  await dialog.getByRole('button', { name: 'Diese Daten senden und Schätzung anfragen', exact: true }).click()
  await expect(page.getByText('Vorschlag: etwa 70 Minuten', { exact: true })).toBeVisible()
  await expect(page.getByText(/Google Routes · abgerufen/)).toBeVisible()
  expect(requests).toHaveLength(1)
  expect(requests[0]).toMatchObject({ kind: 'route', origin: { address: 'Bewusste Startadresse' }, destination: { latitude: 52, longitude: 13 }, timing: 'arrival' })
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))!.commitments[0]?.travelMin).toBe(45)
  await page.getByRole('button', { name: 'Als eigene Fahrzeit übernehmen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))!.commitments[0]?.travelMin).toBe(70)
  const local = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  expect(local.commitments[0]).toEqual({ ...visit, travelMin: 70 })
  expect(JSON.stringify(local)).not.toMatch(/Google Routes|fetchedAt|trafficAware|durationMin/)
  expect((await storedRecord<Settings>(page, 'settings', 'main'))!.anchor).toEqual(beforeSettings.anchor)
  await page.reload()
  await expandDetails(page, 'Weg & Vorbereitung')
  await expect(page.getByText('Bisher etwa 70 Minuten aus deiner Planung.', { exact: true })).toBeVisible()
  await expect(page.getByText('Vorschlag: etwa 70 Minuten', { exact: true })).toHaveCount(0)
})

test('E07: unfreigegebene Orte und Namen werden nicht ergänzt; manuelle Angaben brauchen eine Einmalfreigabe', async ({ page }) => {
  const requests = await installAssistanceBackend(page, async (input, route) => { await route.fulfill({ json: reply(input, 55) }) })
  await seed(page, false)
  const dialog = await open(page)
  const start = dialog.getByRole('textbox', { name: 'Start für die Fahrtschätzung' })
  const destination = dialog.getByRole('textbox', { name: 'Ziel für die Fahrtschätzung' })
  await expect(start).toHaveValue(''); await expect(destination).toHaveValue('')
  await start.fill('Manuelle Startadresse'); await destination.fill('Manuelle Zieladresse')
  await chooseValue(page, 'Verkehrsmittel für die Schätzung', 'transit', dialog)
  const send = dialog.getByRole('button', { name: 'Diese Daten senden und Schätzung anfragen', exact: true })
  await expect(send).toBeEnabled()
  await send.click()
  await expect(dialog.getByRole('alert')).toContainText('freigegeben')
  expect(requests).toEqual([])
  await dialog.getByRole('checkbox', { name: 'Diese eingegebenen Orte für diese Anfrage freigeben', exact: true }).check()
  await send.click()
  await expect(page.getByText('Vorschlag: etwa 55 Minuten', { exact: true })).toBeVisible()
  expect(requests[0]).toMatchObject({ origin: { address: 'Manuelle Startadresse' }, destination: { address: 'Manuelle Zieladresse' }, mode: 'transit' })
  expect(JSON.stringify(requests)).not.toMatch(/Nur der Name|Nur der Kundenname|Mappe|Besuch am Montag/)
  await page.getByRole('button', { name: 'Vorschlag verwerfen', exact: true }).click()
  const local = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  expect(local.commitments[0]).toEqual(visit)
  expect(JSON.stringify(local)).not.toMatch(/Manuelle Startadresse|Manuelle Zieladresse|Google Routes/)
})

test('E07: Verbindungsfehler erhalten manuelle Wege und auch große Schrift bleibt bedienbar', async ({ page }) => {
  const requests = await installAssistanceBackend(page, async (_input, route) => { await route.abort('internetdisconnected') })
  await seed(page)
  await page.setViewportSize({ width: 320, height: 844 })
  await page.addStyleTag({ content: 'html { font-size: 160% !important }' })
  const dialog = await open(page)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await dialog.getByRole('button', { name: 'Diese Daten senden und Schätzung anfragen', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Verbindung ist gerade nicht verfügbar')
  expect(requests).toHaveLength(1)
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))!.commitments[0]).toEqual(visit)
})

test('E07: unterwegs wird weder eine Anfrage noch eine Reiseentscheidung angeboten', async ({ page }) => {
  const requests = await installAssistanceBackend(page, async (input, route) => { await route.fulfill({ json: reply(input) }) })
  await seed(page, true, { leftAt: NOW - 60_000 })
  await expandDetails(page, 'Weg & Vorbereitung')
  await expect(page.getByRole('button', { name: 'Fahrtzeit prüfen', exact: true })).toHaveCount(0)
  expect(requests).toEqual([])
})

test('E07: Abbrechen und anschließendes Absagen erhalten die eigene Entscheidung trotz später Antwort', async ({ page }) => {
  let release!: () => void
  let finished!: () => void
  const gate = new Promise<void>((done) => { release = done })
  const settled = new Promise<void>((done) => { finished = done })
  const requests = await installAssistanceBackend(page, async (input, route) => {
    await gate
    // Die Seite darf die Transportanfrage bereits abgebrochen haben.
    try { await route.fulfill({ json: reply(input) }) } catch { /* Erwarteter Abbruch im Browser. */ }
    finally { finished() }
  })
  await seed(page)
  const dialog = await open(page)
  await dialog.getByRole('button', { name: 'Diese Daten senden und Schätzung anfragen', exact: true }).click()
  await expect.poll(() => requests.length).toBe(1)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Absagen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))!.commitments[0]?.status).toBe('cancelled')
  release(); await settled
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))!.commitments[0]).toEqual({ ...visit, status: 'cancelled' })
  await expect(page.getByText('Vorschlag: etwa 70 Minuten', { exact: true })).toHaveCount(0)
})

test('E07: eine unbrauchbare Null-Minuten-Antwort erfindet keine sichere Fahrt', async ({ page }) => {
  await installAssistanceBackend(page, async (input, route) => { await route.fulfill({ json: reply(input, 0) }) })
  await seed(page)
  const dialog = await open(page)
  await dialog.getByRole('button', { name: 'Diese Daten senden und Schätzung anfragen', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Antwort ist nicht verwendbar')
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))!.commitments[0]).toEqual(visit)
  await expect(page.getByRole('button', { name: 'Als eigene Fahrzeit übernehmen', exact: true })).toHaveCount(0)
})

/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import type { Commitment, DayLog, LocalData, Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'

const date = '2026-11-09'
const visit: Commitment = { id: 'fixed', date, label: 'Fester Termin', context: 'personal', commitment: 'hard', start: 18 * 60, end: 19 * 60, locationKind: 'onsite', placeLabel: 'Bekannter Ort', travelMin: 45, arrivalBufferMin: 5, prepMin: 0 }
async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date(`${date}T10:00:00+01:00`))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}
async function seed(page: Page, sick: boolean, regularSession = false) {
  const local = (await storedRecord<LocalData>(page, 'meta', 'local')) ?? emptyLocal()
  local.commitments = [{ ...visit, ...(sick ? { start: 11 * 60, end: 12 * 60 } : {}) }]
  if (regularSession) local.workSessions = [{ id: 'running', date, kind: 'regular', startAt: new Date(`${date}T09:30:00+01:00`).getTime(), breaks: [] }]
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.work[0] = { ...settings.work[0]!, start: 480, durationMin: 480, pauseMin: 60 }
  settings.commute.minutes = 35
  settings.sport.days = settings.sport.days.map(() => false)
  const log: DayLog = { date, override: sick ? { dayType: 'sick' } : {}, steps: {} }
  await page.evaluate((records) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('records', 'readwrite')
      for (const record of records) tx.objectStore('records').put({ ...record, updated_at: Date.now(), deleted: false, dirty: 1 })
      tx.oncomplete = () => { db.close(); resolve() }; tx.onabort = () => { db.close(); reject(tx.error) }
    }
  }), [{ collection: 'meta', id: 'local', data: local }, { collection: 'settings', id: 'main', data: settings }, { collection: 'days', id: date, data: log }])
}

test('Krank reduziert eigene Aufgaben und erhält die vorhandenen festen Termine im tatsächlichen Bedienweg', async ({ page }) => {
  await onboard(page); await seed(page, true)
  await page.goto('/tag')
  const terms = page.getByRole('heading', { name: 'Termine', exact: true }).locator('..')
  await expect(terms).toContainText('Fester Termin')
  await expect(terms).toContainText('Fahrt etwa 45 min')
  await expect(terms).not.toContainText('Keine zusätzlichen Termine')
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.commitments[0]?.status).toBeUndefined()
  await page.clock.setFixedTime(new Date(`${date}T10:10:00+01:00`))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Los zu Fester Termin')
})

test('Knapp nach Feierabend beginnt der direkte Weg am Büro und erzeugt keinen gleichzeitig laufenden Heimweg', async ({ page }) => {
  await onboard(page); await seed(page, false)
  await page.goto('/tag')
  const terms = page.getByRole('heading', { name: 'Termine', exact: true }).locator('..')
  await expect(terms).toContainText('Büro → Bekannter Ort')
  await expect(page.getByRole('list', { name: 'Tageslinie', exact: true })).not.toContainText('Heimweg')
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))!.commitments[0]).toEqual(visit)
})

test('Eine echte laufende Arbeit ohne Tagesziel meldet keinen erfundenen Zielerfolg', async ({ page }) => {
  await onboard(page); await seed(page, true, true)
  await page.goto('/')
  await expect(page.getByTestId('workbar')).toContainText('Arbeit läuft seit 09:30.')
  await expect(page.getByTestId('workbar')).not.toContainText('Dein Ziel ist erreicht')
  await expect(page.getByRole('button', { name: 'Feierabend', exact: true })).toBeVisible()
})

for (const failure of ['missing', 'rejected'] as const) test(`Arbeitsnachricht: ${failure} Clipboard erzeugt keinen falschen Kopiererfolg`, async ({ page }) => {
  await page.addInitScript((failure) => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: failure === 'missing' ? undefined : { writeText: async () => { throw new Error('nicht erlaubt') } } }) }, failure)
  await onboard(page)
  await page.getByRole('button', { name: 'Heute anders', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Arbeit heute anders', exact: true }).click()
  await dialog.getByLabel('Arbeitsbeginn heute', { exact: true }).fill('10:00')
  await dialog.getByRole('button', { name: 'Nachricht kopieren', exact: true }).click()
  await expect(page.getByText('Kopieren ist gerade nicht möglich. Du kannst die Vorlage selbst auswählen; gesendet wurde nichts.', { exact: true })).toBeVisible()
  await expect(page.getByText('Kopiert. Gesendet ist damit noch nichts.', { exact: true })).toHaveCount(0)
  await expect(dialog.getByText('Ich starte heute etwas später und bin ab [Uhrzeit] da.', { exact: true })).toBeVisible()
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => undefined } }) })
  await dialog.getByRole('button', { name: 'Nachricht kopieren', exact: true }).click()
  await expect(page.getByText('Kopiert. Gesendet ist damit noch nichts.', { exact: true })).toBeVisible()
})

test('Die lange Abendvorschau nennt an der Sommerzeitgrenze die reale Schlafgelegenheit und verändert keinen Wecker', async ({ page }) => {
  await onboard(page)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.anchor = { ...settings.anchor, wake: 7 * 60, manual: { ...settings.anchor.manual, wake: true } }
  settings.pcStop = 21 * 60; settings.bed = 21 * 60 + 30
  settings.sleep = { ...settings.sleep, needMin: 480, fallAsleepMin: 0, screenOffMin: 30 }
  await page.evaluate((settings) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('records', 'readwrite')
      tx.objectStore('records').put({ collection: 'settings', id: 'main', data: settings, updated_at: Date.now(), deleted: false, dirty: 1 })
      tx.oncomplete = () => { db.close(); resolve() }; tx.onabort = () => { db.close(); reject(tx.error) }
    }
  }), settings)
  await page.clock.setFixedTime(new Date('2026-03-28T20:00:00+01:00'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Heute anders', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Länger wach bleiben', exact: true }).click()
  await dialog.getByLabel('Wach bis', { exact: true }).fill('22:30')
  await expect(dialog).toContainText('Bett im Plan 23:00.')
  await expect(dialog).toContainText('etwa 7 h mögliche Schlafzeit')
  await expect(dialog).toContainText('kürzer als deine gewünschten 8 h')
  expect(await storedRecord<Settings>(page, 'settings', 'main')).toEqual(settings)
  expect((await storedRecord<DayLog>(page, 'days', '2026-03-29'))?.override.wakeOverride).toBeUndefined()
})

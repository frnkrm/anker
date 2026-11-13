/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { seedRecords, storedRecord } from './helpers/storage'
import type { DayLog, Settings, WeeklyReview } from '../src/core/types'

const DATE = '2026-11-13', NOW = Date.parse(`${DATE}T10:00:00+01:00`)
const region = (page: Page) => page.getByRole('region', { name: 'Gespeicherte Wochenangaben', exact: true })
const open = (page: Page) => page.getByRole('button', { name: 'Vorhandene Wocheneinträge ansehen', exact: true }).click()
async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date(NOW))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
}
async function seed(page: Page) {
  const log = (date: string, patch: Partial<DayLog>): DayLog => ({ date, override: {}, steps: {}, ...patch })
  await seedRecords(page, [
    { collection: 'days', id: '2026-11-09', data: log('2026-11-09', { override: { mode: 'startschwierigkeit', shortMorning: true, reason: 'PRIVATE-REASON' }, changes: ['PRIVATE-CHANGE'], steps: { 'morning:PRIVATE-STEP': 'minimal', 'evening:old': 'done' } }) },
    { collection: 'days', id: '2026-11-10', data: log('2026-11-10', { override: { mode: 'wenig-energie', light: true, adjusted: true }, steps: { 'morning:skip': 'skipped', 'evening:omit': 'not-needed' } }) },
    { collection: 'days', id: '2026-11-11', data: log('2026-11-11', { wakeAt: NOW, reminderReceipts: ['PRIVATE-RECEIPT'] }) },
    { collection: 'days', id: '2026-11-08', data: log('2026-11-08', { override: { mode: 'ueberlastet' } }) },
    { collection: 'days', id: '2026-11-14', data: log('2026-11-14', { override: { mode: 'auf-kurs' } }) },
    { collection: 'reviews', id: DATE, data: { id: DATE, good: 'PRIVATE-GOOD', hard: 'PRIVATE-HARD', change: '' } },
  ])
}
async function setup(page: Page) {
  await onboard(page); await seed(page)
  await page.goto('/rueckblick')
  await expect(page.getByRole('heading', { level: 1, name: 'Rückblick', exact: true })).toBeVisible()
}
async function records(page: Page) {
  return page.evaluate(() => new Promise<unknown[]>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('records', 'readonly'), read = tx.objectStore('records').getAll()
      let value: unknown[] = []
      read.onsuccess = () => { value = read.result as unknown[] }
      tx.oncomplete = () => { db.close(); resolve(value) }
      tx.onabort = () => { db.close(); reject(tx.error) }
    }
  }))
}

test('F-010: Übersicht bleibt freiwillig; Öffnen, Zeitraumwechsel und Abwahl schreiben nichts', async ({ page }) => {
  await setup(page)
  await expect(region(page)).toHaveCount(0)
  const before = await records(page)
  await open(page)
  await expect(region(page)).toContainText('Auswertbare Tagesstände: 2 von 5.')
  await expect(region(page)).toContainText('3 Tage ohne passende Angaben')
  await expect(region(page)).toContainText('Wenige Tagesstände')
  await expect(region(page)).toContainText('Tagesmodus „Einfach anfangen“: 1 Tag.')
  await expect(region(page)).toContainText('Als kleine Version bestätigt: 1 Schritt.')
  await expect(region(page)).toContainText('Als übersprungen eingetragen: 1 Schritt.')
  await expect(region(page)).not.toContainText('PRIVATE-')
  await expect(region(page)).not.toContainText('Auf Kurs')
  expect(await records(page)).toEqual(before)
  await region(page).getByRole('radio', { name: 'Vorherige Woche', exact: true }).click()
  await expect(region(page).getByRole('heading', { level: 2 })).toHaveText('02.11.2026 bis 08.11.2026')
  await expect(region(page)).toContainText('Auswertbare Tagesstände: 1 von 7.')
  await expect(region(page)).toContainText('Tagesmodus „Überlastet“: 1 Tag.')
  expect(await records(page)).toEqual(before)
  await page.getByRole('button', { name: 'Ohne Wochenübersicht', exact: true }).click()
  await expect(region(page)).toHaveCount(0)
  expect(await records(page)).toEqual(before)
})

test('F-010: fehlende und leere Tagesstände sind keine Hindernis- oder Leistungsbewertung', async ({ page }) => {
  await onboard(page); await page.goto('/rueckblick'); await open(page)
  await expect(region(page)).toContainText('Auswertbare Tagesstände: 0 von 5.')
  await expect(region(page)).toContainText('Noch keine passenden Angaben')
  await expect(region(page)).toContainText('Das belegt weder ein Hindernis noch Nichtnutzung.')
  await expect(region(page).getByRole('heading', { name: 'Routinenangaben', exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Was war schwer?', exact: true })).toBeVisible()
})

test('F-010: Reload, Tabwechsel und erneutes Öffnen übernehmen keine Auswertungswahl', async ({ page }) => {
  await setup(page); await open(page)
  await region(page).getByRole('radio', { name: 'Vorherige Woche', exact: true }).click()
  const before = await records(page)
  await page.reload()
  await expect(region(page)).toHaveCount(0)
  await open(page)
  await expect(region(page).getByRole('heading', { level: 2 })).toHaveText('09.11.2026 bis 13.11.2026')
  await page.getByRole('radiogroup', { name: 'Rückblickbereich', exact: true }).getByRole('radio', { name: 'Schlaf', exact: true }).click()
  await page.getByRole('radiogroup', { name: 'Rückblickbereich', exact: true }).getByRole('radio', { name: 'Woche', exact: true }).click()
  await expect(region(page)).toHaveCount(0)
  expect(await records(page)).toEqual(before)
})

test('F-010: lokale Übersicht funktioniert offline ohne externen Abruf', async ({ page, context }) => {
  const external: string[] = []
  await page.route(/^https?:\/\//, route => {
    const host = new URL(route.request().url()).hostname
    if (host !== 'localhost') { external.push(host); return route.abort() }
    return route.continue()
  })
  await setup(page)
  const before = await records(page)
  await context.setOffline(true)
  await open(page)
  await expect(region(page)).toContainText('Auswertbare Tagesstände: 2 von 5.')
  await region(page).getByRole('radio', { name: 'Vorherige Woche', exact: true }).click()
  await expect(region(page)).toContainText('Auswertbare Tagesstände: 1 von 7.')
  expect(await records(page)).toEqual(before)
  expect(external).toEqual([])
})

test('F-010: Berliner Montag beginnt für diese Ansicht erst um 04:00', async ({ page }) => {
  await setup(page); await open(page); await page.clock.install()
  await page.clock.setFixedTime(new Date('2026-11-16T03:59:00+01:00'))
  await page.clock.runFor(30_001)
  await expect(region(page).getByRole('heading', { level: 2 })).toHaveText('09.11.2026 bis 15.11.2026')
  await page.clock.setFixedTime(new Date('2026-11-16T04:00:00+01:00'))
  await page.clock.runFor(30_001)
  await expect(region(page).getByRole('heading', { level: 2 })).toHaveText('16.11.2026 bis 16.11.2026')
  await expect(region(page)).toContainText('Der aktuelle Tag läuft noch.')
  await expect(region(page)).toContainText('Auswertbare Tagesstände: 0 von 1.')
})

test('F-010: drei eigene Fragen und ausdrückliches Speichern bleiben beim bisherigen Besitzer', async ({ page }) => {
  await setup(page); await open(page)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  const before = await storedRecord<unknown>(page, 'meta', 'local')
  const game = await storedRecord<unknown>(page, 'game', 'main')
  await expect(page.getByRole('textbox', { name: 'Was hat geklappt?', exact: true })).toHaveValue('PRIVATE-GOOD')
  await page.getByRole('textbox', { name: 'Was war schwer?', exact: true }).fill('Meine eigene Einordnung')
  await page.getByRole('textbox', { name: 'Eine kleine Änderung für nächste Woche?', exact: true }).fill('Eine bewusste kleine Änderung')
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await storedRecord<WeeklyReview>(page, 'reviews', DATE))?.hard).toBe('Meine eigene Einordnung')
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.suggestions.some(item => item.text === 'Eine bewusste kleine Änderung')).toBe(true)
  const after = (await storedRecord<Settings>(page, 'settings', 'main'))!
  expect(after.support).toEqual(settings.support)
  expect(after.work).toEqual(settings.work)
  expect(after.alarm).toEqual(settings.alarm)
  expect(await storedRecord<unknown>(page, 'meta', 'local')).toEqual(before)
  expect(await storedRecord<unknown>(page, 'game', 'main')).toEqual(game)
})

test('F-010: 320px und große Schrift erhalten Abwahl und eigene Antworten', async ({ page }) => {
  await setup(page); await page.setViewportSize({ width: 320, height: 740 })
  await page.addStyleTag({ content: 'html { font-size: 160% !important; }' })
  await open(page)
  const close = page.getByRole('button', { name: 'Ohne Wochenübersicht', exact: true })
  await close.scrollIntoViewIfNeeded(); await expect(close).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const answer = page.getByRole('textbox', { name: 'Was war schwer?', exact: true })
  await answer.scrollIntoViewIfNeeded(); await expect(answer).toBeInViewport()
  // Die vorhandene Erfolgseinblendung aus synthetischen Tagesdaten darf die Bildkontrolle nicht verdecken.
  await page.getByText(/Mehr unter Spiel\.$/).waitFor({ state: 'hidden' })
  await page.screenshot({ path: '/workspace/anker-f010-20261113/weekly-review-320-final.png', fullPage: true })
  await close.click(); await expect(region(page)).toHaveCount(0)
  await expect(answer).toHaveValue('PRIVATE-HARD')
})

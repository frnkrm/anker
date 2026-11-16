/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { DayLog, Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'

const DATE = '2026-11-11'

async function prepare(page: Page, override: boolean) {
  await page.clock.setFixedTime(new Date('2026-11-10T19:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.evaluate(({ date, override }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('records', 'readwrite')
      const store = tx.objectStore('records')
      const read = store.get(['settings', 'main'])
      read.onsuccess = () => {
        const record = read.result as { data: Settings }
        record.data.anchor.wake = 490
        record.data.anchor.manual = { ...record.data.anchor.manual, wake: true }
        record.data.alarm.enabled = true
        record.data.alarm.smartWake = { ...record.data.alarm.smartWake, enabled: true, windowMinutes: 45 }
        store.put(record)
        store.put({ collection: 'days', id: date, updated_at: Date.now(), deleted: false, dirty: 1,
          data: { date, override: override ? { wakeOverride: 365 } : {}, steps: { 'morning:teeth': 'done' } } })
      }
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onabort = () => { db.close(); reject(tx.error) }
    }
  }), { date: DATE, override })
}

test('Tageszeit ist sichtbar, nur bewusst änderbar und nach Entfernen gilt wieder der Standard', async ({ page }) => {
  await prepare(page, true)
  await page.goto('/einstellungen/schlaf')
  await expect(page.getByRole('heading', { name: 'Nächste wirksame Weckzeit', exact: true })).toBeVisible()
  await expect(page.getByText(/Tagesüberschreibung hat Vorrang/)).toBeVisible()
  await expect(page.getByText(/06:05/, { exact: false }).first()).toBeVisible()
  const input = page.getByLabel('Einmalige Weckzeit ändern', { exact: true })
  await input.fill('06:30')
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.override.wakeOverride).toBe(365)
  await page.getByRole('button', { name: 'Einmalige Zeit speichern', exact: true }).click()
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', DATE))?.override.wakeOverride).toBe(390)
  await input.fill('')
  await expect(page.getByRole('button', { name: 'Einmalige Zeit speichern', exact: true })).toBeDisabled()
  await page.goto('/wecker')
  await expect(page.getByText(/Geplantes Fenster:.*05:45.*06:30/)).toBeVisible()
  await page.getByRole('button', { name: 'Zurück zu 08:10', exact: true }).click()
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', DATE))?.override.wakeOverride).toBeUndefined()
  await expect(page.getByText(/Geplantes Fenster:.*07:25.*08:10/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/Geplantes Fenster:.*07:25.*08:10/)).toBeVisible()
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.steps['morning:teeth']).toBe('done')
})

test('Standardänderung erhält die Tagesausnahme und dieselbe effektive Zeit in der Übersicht', async ({ page }) => {
  await prepare(page, true)
  await page.goto('/einstellungen/schlaf')
  await page.getByLabel('Aufstehzeit', { exact: true }).fill('08:20')
  await page.getByRole('heading', { name: 'Schlaf & Anker', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.anchor.wake).toBe(500)
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.override.wakeOverride).toBe(365)
  await page.goto('/einstellungen')
  await expect(page.getByText(/Nächstes Aufstehen 06:05.*Tagesüberschreibung/)).toBeVisible()
  await page.goto('/wecker')
  await expect(page.getByText(/Geplantes Fenster:.*05:20.*06:05/)).toBeVisible()
  await page.getByRole('button', { name: 'Zurück zu 08:20', exact: true }).click()
  await expect(page.getByText(/Geplantes Fenster:.*07:35.*08:20/)).toBeVisible()
})

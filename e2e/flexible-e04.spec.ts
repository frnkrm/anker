/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import { initialGame } from '../src/core/game'
import { zonedToUtc } from '../src/core/time'
import type { Commitment, DayLog, GameState, LocalData, Settings } from '../src/core/types'
import type { Collection } from '../src/data/types'
import { storedRecord } from './helpers/storage'

const date = '2026-11-06'
const start = zonedToUtc(date, 18 * 60)
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
const day = (page: Page) => storedRecord<DayLog>(page, 'days', date)

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date(start))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}

/** Synthetischer Altbestand als Testvoraussetzung, keine Behauptung eines Geräte-/Importtests. */
async function seed(page: Page, records: { collection: Collection; id: string; data: unknown }[]) {
  await page.evaluate((records) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('records', 'readwrite')
      for (const record of records) transaction.objectStore('records').put({ ...record, updated_at: Date.now(), deleted: false, dirty: 1 })
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }), records)
}

async function different(page: Page) {
  await page.getByRole('button', { name: 'Heute anders', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Ich habe heute etwas anderes vor', exact: true })).toBeVisible()
  return dialog
}

test('Tages-Undo bewahrt vorhandene Verabredung und nimmt nur die neue Planung zurück', async ({ page }) => {
  await onboard(page)
  const original: Commitment = { id: 'original', date, label: 'Schon vorher vereinbart', context: 'social', commitment: 'soft', start: 21 * 60, end: 22 * 60, routeMode: 'none', status: 'planned' }
  await seed(page, [{ collection: 'meta', id: 'local', data: { ...(await local(page) ?? emptyLocal()), commitments: [original] } }])
  await page.reload()
  let dialog = await different(page)
  await dialog.getByRole('button', { name: 'Ich habe heute etwas anderes vor', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Was hast du vor?', exact: true }).fill('Spontaner Film ab 19 Uhr')
  await dialog.getByRole('button', { name: 'So übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments.length).toBe(2)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  dialog = await different(page)
  await dialog.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Zurück zum ursprünglichen Plan', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments.find((item) => item.id !== original.id)?.status).toBe('cancelled')
  await page.reload()
  expect((await local(page))?.commitments.find((item) => item.id === original.id)).toEqual(original)
  expect((await local(page))?.planUndo).toBeUndefined()
  expect((await day(page))?.before).toBeUndefined()
})

test('Heute anders ist direkt im Fokus erreichbar und Verschieben pausiert dieselbe Uhr ohne Abschluss', async ({ page }) => {
  await onboard(page)
  await page.goto('/fokus/evening')
  await expect.poll(async () => (await local(page))?.focus?.id).toBeTruthy()
  const before = (await local(page))!.focus!
  await page.clock.setFixedTime(new Date(start + 30_000))
  await page.getByRole('button', { name: 'Heute anders', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Länger wach bleiben', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Diese Routine später', exact: true }).click()
  await dialog.getByRole('button', { name: 'In einer Stunde', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  const paused = (await local(page))!.focus!
  expect(paused.id).toBe(before.id)
  expect((await day(page))?.steps).toEqual({})
  await page.reload()
  await page.goto('/fokus/evening')
  await expect(page.getByText('Pausiert. Die Restzeit bleibt erhalten.', { exact: true })).toBeVisible()
  expect((await local(page))?.focus?.id).toBe(before.id)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('running')
})

test('Freie Abendverlängerung und offenes Ende stimmen auf PC-Seite und im Tagesplan überein', async ({ page }) => {
  await onboard(page)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  await page.goto('/pc-stopp')
  await page.getByRole('button', { name: 'Abendzeit ändern', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '+30 Minuten', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect.poll(async () => (await day(page))?.override.lateUntil).toBe(settings.pcStop + 30)
  await page.getByRole('button', { name: 'Abendzeit ändern', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '+1 Stunde', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect.poll(async () => (await day(page))?.override.lateUntil).toBe(settings.pcStop + 90)
  await page.getByRole('button', { name: 'Abendzeit ändern', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Weiß ich noch nicht', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect.poll(async () => (await day(page))?.override.lateUntil).toBe('open')
  await expect(page.getByText('Ohne festen PC-Stopp', { exact: true })).toBeVisible()
  await expect(page.getByText('03:59', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Plan einmalig bereitstellen', exact: true }).click()
  await expect(page.getByRole('status')).toBeVisible()
  await expect(page.getByText(/Der PC weiß Bescheid/)).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Ohne festen PC-Stopp', { exact: true })).toBeVisible()
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.anchor.wake).toBe(settings.anchor.wake)
  expect((await day(page))?.steps ?? {}).toEqual({})
})

test('Vorabendregel ist nachvollziehbar, tagesweise übersteuerbar und im Tagesdruck ehrlich', async ({ page }) => {
  await onboard(page)
  await seed(page, [{ collection: 'days', id: '2026-11-05', data: { date: '2026-11-05', override: {}, steps: { 'evening:prep': 'done' } } }])
  await page.goto('/einstellungen/hilfen')
  await page.getByLabel('Abendschritt', { exact: true }).selectOption('prep')
  await page.getByLabel('Morgenschritt', { exact: true }).selectOption('dress')
  await page.getByRole('button', { name: 'Regel hinzufügen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.routineLinks.length).toBe(1)
  await page.goto(`/druck?typ=morning&tag=${date}`)
  await expect(page.locator('[data-sheet="morning"]')).toContainText('Schon versorgt: Anziehen (Vorabend 2026-11-05: Morgen vorbereiten)')
  await page.goto('/')
  const dialog = await different(page)
  await dialog.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Morgenroutine heute prüfen', exact: true }).click()
  await expect(dialog.getByText(/2026-11-05: Morgen vorbereiten/)).toBeVisible()
  const checkbox = dialog.getByRole('checkbox', { name: 'Anziehen morgens versorgt', exact: true })
  await expect(checkbox).toBeChecked()
  await checkbox.click()
  await expect(checkbox).not.toBeChecked()
  await expect.poll(async () => (await day(page))?.override.uncoveredSteps).toEqual(['morning:dress'])
  await dialog.getByRole('button', { name: 'Fertig', exact: true }).click()
  await page.goto(`/druck?typ=morning&tag=${date}`)
  await expect(page.locator('[data-sheet="morning"]')).not.toContainText('Schon versorgt: Anziehen')
  await expect(page.locator('[data-sheet="morning"]')).toContainText('Anziehen')
  expect((await day(page))?.steps['morning:dress']).toBeUndefined()
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.routineLinks).toEqual([{ eveningStepId: 'prep', morningStepId: 'dress' }])
})

test('Später verschiebt nur die Rückfrage und lässt eine echte manuelle Rückkehr jederzeit zu', async ({ page }) => {
  await onboard(page)
  const dialog = await different(page)
  await dialog.getByRole('button', { name: 'Diese Routine später', exact: true }).click()
  await dialog.getByRole('button', { name: 'Wenn ich zurück bin', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bist du wieder zuhause?', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Später', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dein Abend bleibt offen', exact: true })).toBeVisible()
  expect((await day(page))?.override.backAt).toBeUndefined()
  expect((await day(page))?.steps).toEqual({})
  await page.reload()
  await page.getByRole('button', { name: 'Ich bin zurück', exact: true }).click()
  await expect.poll(async () => (await day(page))?.override.backAt).toBe(start)
})

test('Ein echter Levelaufstieg zeigt einen passiven Hinweis und lässt den nächsten Schritt sofort bedienen', async ({ page }) => {
  await onboard(page)
  await seed(page, [{ collection: 'game', id: 'main', data: { ...initialGame(date), xp: 149 } }])
  await page.goto('/fokus/evening')
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect.poll(async () => (await storedRecord<GameState>(page, 'game', 'main'))?.xp ?? 0).toBeGreaterThanOrEqual(159)
  await expect(page.getByText(/^Level 2 /)).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect.poll(async () => Object.keys((await day(page))?.steps ?? {}).length).toBe(2)
  expect((await day(page))?.steps[`evening:${settings.routines.evening[1]!.id}`]).toBe('done')
})

test('Eine fehlgeschlagene Bedarfänderung zeigt den Speicherfehler und lässt die bisherige Auswahl bestehen', async ({ page }) => {
  await onboard(page)
  await seed(page, [{ collection: 'days', id: date, data: { date, override: { coveredSteps: ['morning:dress'] }, steps: {} } }])
  await page.reload()
  const dialog = await different(page)
  await dialog.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Morgenroutine heute prüfen', exact: true }).click()
  const checkbox = dialog.getByRole('checkbox', { name: 'Anziehen morgens versorgt', exact: true })
  await expect(checkbox).toBeChecked()
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      const record = value as { collection?: string; id?: string }
      if (this.name === 'records' && record.collection === 'days' && record.id === '2026-11-06') throw new DOMException('Test: Speicher voll', 'QuotaExceededError')
      return key === undefined ? put.call(this, value) : put.call(this, value, key)
    }
  })
  await checkbox.click()
  await expect(dialog.getByRole('alert')).toContainText('Speicher voll')
  await expect(checkbox).toBeChecked()
  expect((await day(page))?.override).toEqual({ coveredSteps: ['morning:dress'] })
  expect((await local(page))?.planUndo).toBeUndefined()
})

test('Eine ausdrücklich gewählte Weckänderung zeigt im Web nur Planbestätigung und lässt den Standard erhalten', async ({ page }) => {
  await onboard(page)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  const changed = structuredClone(settings)
  changed.anchor.wake = 300
  changed.work[5] = { ...changed.work[5]!, isWorkDay: true, start: 600, homeOffice: true }
  await seed(page, [{ collection: 'settings', id: 'main', data: changed }])
  await page.goto('/pc-stopp')
  await page.getByRole('button', { name: 'Abendzeit ändern', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const choice = dialog.getByRole('checkbox', { name: /Nur morgen so wecken/ })
  await expect(choice).toBeVisible()
  await choice.check()
  await dialog.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Die Web-Version stellt keinen Android-Wecker.')
  await expect(choice).toHaveCount(0)
  await expect(dialog.getByLabel('Wach bis', { exact: true })).toBeDisabled()
  const tomorrow = await storedRecord<DayLog>(page, 'days', '2026-11-07')
  expect(tomorrow?.override.wakeOverride).toBeGreaterThan(changed.anchor.wake)
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.anchor.wake).toBe(changed.anchor.wake)
  await dialog.getByRole('button', { name: 'Fertig', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

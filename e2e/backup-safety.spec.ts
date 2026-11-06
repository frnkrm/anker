/// <reference lib="dom" />
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { makeBackup, type Backup } from '../src/core/export/backup'
import type { LocalData, Settings } from '../src/core/types'
import type { Rec } from '../src/data/types'
import { storedRecord } from './helpers/storage'

const START = new Date('2026-11-02T10:00:00+01:00').getTime()
async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date(START))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}
async function choose(page: Page, records: Rec[]) {
  const picker = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Sicherung importieren', exact: true }).click()
  await (await picker).setFiles({ name: 'anker-sicherung.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeBackup(records))) })
}
const entry = (collection: Rec['collection'], id: string, data: unknown): Rec => ({ collection, id, data, updated_at: START + 1000, deleted: false })

test('Importvorschau verändert nichts; erst bewusster Import übernimmt neue Felder und bewahrt alte Angaben', async ({ page }) => {
  await onboard(page)
  const before = (await storedRecord<Settings>(page, 'settings', 'main'))!
  await page.goto('/backup')
  const incoming = [entry('settings', 'main', { version: 1, onboarded: true, themeId: 'piraten' })]
  await choose(page, incoming)
  await expect(page.getByRole('heading', { name: 'Vor dem Import prüfen', exact: true })).toBeVisible()
  expect(await storedRecord<Settings>(page, 'settings', 'main')).toEqual(before)
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
  expect(await storedRecord<Settings>(page, 'settings', 'main')).toEqual(before)
  await choose(page, incoming)
  await page.getByRole('button', { name: 'Jetzt importieren', exact: true }).click()
  await expect(page.getByText('1 Einträge übernommen. Neuere Daten auf dem Gerät bleiben erhalten.', { exact: true })).toBeVisible()
  const after = (await storedRecord<Settings>(page, 'settings', 'main'))!
  expect(after.themeId).toBe('piraten')
  expect(after.alarm.qrSecret).toBe(before.alarm.qrSecret)
  expect(after.work).toEqual(before.work)
})

test('Ein beschädigter Record verhindert den gesamten Import vor der Vorschau', async ({ page }) => {
  await onboard(page)
  const before = await storedRecord<Settings>(page, 'settings', 'main')
  await page.goto('/backup')
  await choose(page, [entry('settings', 'main', { version: 1, onboarded: true, themeId: 'piraten' }), entry('game', 'main', { xp: 4 })])
  await expect(page.getByRole('alert')).toContainText('ungültige Spielstände')
  await expect(page.getByRole('button', { name: 'Jetzt importieren', exact: true })).toHaveCount(0)
  expect(await storedRecord<Settings>(page, 'settings', 'main')).toEqual(before)
})

test('Ausgewählte Sicherung enthält keine ausgelassenen Arbeitsdaten und verändert keine Originaldaten', async ({ page }) => {
  await onboard(page)
  await page.goto('/arbeit')
  await page.getByRole('textbox', { name: 'Neue Aufgabe', exact: true }).fill('Vertraulicher Auftrag')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.work.length).toBe(1)
  const before = await storedRecord<LocalData>(page, 'meta', 'local')
  await page.goto('/backup')
  await page.getByText('Was soll die Sicherung enthalten?', { exact: true }).click()
  await page.getByRole('checkbox', { name: 'Arbeitsaufgaben, Arbeitszeiten und Übergaben', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Einnahme- und freiwilliges Schlafprotokoll', exact: true }).uncheck()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sicherung exportieren', exact: true }).click()
  const file = await downloading
  const content = await readFile((await file.path())!, 'utf8')
  const backup = JSON.parse(content) as Backup
  const local = backup.records.find((record) => record.collection === 'meta' && record.id === 'local')?.data as Partial<LocalData>
  expect(local.work).toBeUndefined()
  expect(local.workSessions).toBeUndefined()
  expect(local.meds).toBeUndefined()
  expect(content).not.toContain('Vertraulicher Auftrag')
  expect(await storedRecord<LocalData>(page, 'meta', 'local')).toEqual(before)
})

test('Dateilesefehler zeigt keinen Importerfolg und blockiert die nächste Auswahl nicht', async ({ page }) => {
  await page.addInitScript(() => { File.prototype.text = async () => { throw new Error('privater Dateiname') } })
  await onboard(page)
  await page.goto('/backup')
  await choose(page, [entry('settings', 'main', { version: 1, onboarded: true })])
  await expect(page.getByRole('alert')).toHaveText('Die ausgewählte Datei konnte nicht gelesen werden. Es wurde nichts importiert.')
  await expect(page.getByRole('button', { name: 'Sicherung importieren', exact: true })).toBeEnabled()
  await expect(page.getByText('privater Dateiname', { exact: true })).toHaveCount(0)
})

test('Eine Teilsicherung löscht keine bewusst ausgelassenen Arbeitsaufgaben im Ziel', async ({ page }) => {
  await onboard(page)
  await page.goto('/arbeit')
  await page.getByRole('textbox', { name: 'Neue Aufgabe', exact: true }).fill('Mein vorhandener Auftrag')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.work.length).toBe(1)
  const work = (await storedRecord<LocalData>(page, 'meta', 'local'))!.work
  await page.goto('/backup')
  await choose(page, [entry('meta', 'local', { handover: { '2026-11-02': { open: 'Übernommener Stand', next: 'Datei öffnen' } } })])
  await page.getByRole('button', { name: 'Jetzt importieren', exact: true }).click()
  await expect(page.getByText('1 Einträge übernommen. Neuere Daten auf dem Gerät bleiben erhalten.', { exact: true })).toBeVisible()
  const local = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  expect(local.work).toEqual(work)
  expect(local.handover['2026-11-02']?.next).toBe('Datei öffnen')
})

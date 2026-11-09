import { chooseValue, choiceValues } from './helpers/controls'
/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { DEVICE_TEST_SUITE } from '../src/core/deviceTests'
import type { DeviceTestReport, LocalData } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const old: DeviceTestReport = { result: 'passed', note: 'Am Handy früher geprüft', at: Date.parse('2026-10-01T12:00:00Z'), platform: 'android', device: 'Mein S26', os: 'Android 16', appVersion: '1.3.0-rc.1', build: '8', suiteVersion: DEVICE_TEST_SUITE, buildFingerprint: 'previous-build' }
const oldFile = JSON.stringify({ app: 'anker', exportedAt: '2026-11-06T12:00:00Z', reports: { 1: old, 21: { ...old, platform: 'web', build: 'Web' } } })

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-07T12:00:00Z'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/geraetetest')
}

async function chooseFile(page: Page, content: string) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Testberichte aus Datei prüfen', exact: true }).click()
  await (await chooser).setFiles({ name: 'anker-testberichte.json', mimeType: 'application/json', buffer: Buffer.from(content) })
}

async function downloadReports(page: Page) {
  const event = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Testberichte als Datei exportieren', exact: true }).click()
  return readFile((await (await event).path())!, 'utf8')
}

test('Sechs kurze Originalfälle sind Standard; alle 103 bleiben freiwillig erreichbar', async ({ page }) => {
  await onboard(page)
  await expect(page.getByLabel('Testbereich', { exact: true })).toContainText('Kurzer Updatecheck')
  expect(await choiceValues(page, 'Test auswählen')).toEqual(['1', '21', '62', '92', '95', '96'])
  await expect(page.getByText('Noch nie geprüft: 103 freiwillige Testpunkte.', { exact: false })).toBeVisible()
  await chooseValue(page, 'Testbereich', 'Alle')
  expect(await choiceValues(page, 'Test auswählen')).toHaveLength(103)
  await page.getByRole('button', { name: 'Kurzer Updatecheck', exact: true }).click()
  await chooseValue(page, 'Test auswählen', '96')
  await page.reload()
  await expect(page.getByLabel('Testbereich', { exact: true })).toContainText('Kurzer Updatecheck')
  await expect(page.getByRole('heading', { name: 'Test 96 · Stummer Schlafhinweis', exact: true })).toBeVisible()
})

test('Altdatei hat vor Bestätigung keine Wirkung; Historie bleibt sichtbar und exportierbar', async ({ page }) => {
  await onboard(page)
  const before = await storedRecord<LocalData>(page, 'meta', 'local')
  await chooseFile(page, oldFile)
  await expect(page.getByRole('heading', { name: 'Importvorschau – noch nichts übernommen', exact: true })).toBeVisible()
  await expect(page.getByText(/2 erhaltene Rückmeldungen: 1 Android, 1 Browser/)).toBeVisible()
  expect(await storedRecord<LocalData>(page, 'meta', 'local')).toEqual(before)
  await page.getByRole('button', { name: 'Importvorschau verwerfen', exact: true }).click()
  expect(await storedRecord<LocalData>(page, 'meta', 'local')).toEqual(before)
  await chooseFile(page, oldFile)
  await page.getByRole('button', { name: 'Berichte als frühere Belege übernehmen', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Die früheren Belege wurden gespeichert' })).toBeVisible()
  await expect(page.getByText('Früher geprüft: 2 Testpunkte mit erhaltenen Rückmeldungen.', { exact: true })).toBeVisible()
  await expect(page.getByText(/0 von 6 kurzen Updateprüfungen/)).toBeVisible()
  await expect(page.getByText('Noch nie geprüft: 101 freiwillige Testpunkte.', { exact: false })).toBeVisible()
  await expect(page.getByText('Am Handy früher geprüft', { exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: /Für diesen Stand noch offen/ }).check()
  await expect(page.getByLabel('Test auswählen', { exact: true })).toContainText('Früher geprüft')
  const saved = (await storedRecord<LocalData>(page, 'meta', 'local'))?.deviceTests
  expect(saved?.reports).toEqual({})
  expect(saved?.history?.[1]).toEqual([old])
  const exported = await downloadReports(page)
  expect(JSON.parse(exported).history['1']).toEqual([old])
  await page.reload()
  await expect(page.getByText('Früher geprüft: 2 Testpunkte mit erhaltenen Rückmeldungen.', { exact: true })).toBeVisible()
  await chooseFile(page, exported)
  await page.getByRole('button', { name: 'Berichte als frühere Belege übernehmen', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Die früheren Belege wurden gespeichert' })).toBeVisible()
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.deviceTests).toEqual(saved)
})

test('Import bewahrt aktuelle Fehler und ursprüngliche Android-/Browserbelege; ungültige Datei schreibt nichts', async ({ page }) => {
  await onboard(page)
  await page.getByLabel('Testbeobachtung').fill('Aktueller Fehler bleibt')
  await page.getByRole('button', { name: 'Problem', exact: true }).click()
  await expect(page.getByText(/Dein Browserbericht: Problem/)).toBeVisible()
  const before = await storedRecord<LocalData>(page, 'meta', 'local')
  const current = before!.deviceTests!.reports[1]!
  await chooseFile(page, JSON.stringify({ app: 'anker', exportedAt: new Date().toISOString(), reports: { 1: { ...current, result: 'passed', note: 'Fremder Erfolg', at: current.at + 1 } }, history: { 1: [old] } }))
  await page.getByRole('button', { name: 'Berichte als frühere Belege übernehmen', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Die früheren Belege wurden gespeichert' })).toBeVisible()
  const saved = await storedRecord<LocalData>(page, 'meta', 'local')
  expect(saved?.deviceTests?.reports[1]).toEqual(current)
  expect(saved?.deviceTests?.history?.[1]).toEqual([old, { ...current, result: 'passed', note: 'Fremder Erfolg', at: current.at + 1 }])
  await expect(page.getByText(/Dein Browserbericht: Problem/)).toBeVisible()
  await chooseFile(page, JSON.stringify({ app: 'anker', exportedAt: '2026-11-06', reports: {}, history: { 1: [null] } }))
  await expect(page.getByRole('alert')).toContainText('keine gültigen Anker-Testberichte')
  await expect(page.getByRole('button', { name: 'Berichte als frühere Belege übernehmen', exact: true })).toHaveCount(0)
  expect(await storedRecord<LocalData>(page, 'meta', 'local')).toEqual(saved)
})

test('Alter gespeicherter Androidbeleg bleibt sichtbar, neues Speichern und Wiederöffnen archivieren', async ({ page }) => {
  await onboard(page)
  const local = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  await seedRecords(page, [{ collection: 'meta', id: 'local', data: { ...local, deviceTests: { reports: { 1: old } } } }])
  await page.reload()
  await expect(page.getByText('Früher geprüft: 1 Testpunkte mit erhaltenen Rückmeldungen.', { exact: true })).toBeVisible()
  await expect(page.getByText(/Hat geklappt · Android/).last()).toBeVisible()
  await page.getByRole('button', { name: 'Teilweise', exact: true }).click()
  await expect(page.getByText(/Dein Browserbericht: Teilweise/)).toBeVisible()
  await page.getByRole('button', { name: 'Diesen Test wieder öffnen', exact: true }).click()
  await expect(page.getByText(/Dein Browserbericht/)).toHaveCount(0)
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.deviceTests?.history?.[1]).toHaveLength(2)
  await page.reload()
  await expect(page.getByText('Früher geprüft: 2 erhaltene Rückmeldungen zu Test 1', { exact: true })).toBeVisible()
})

test('Viele frühere Beobachtungen bleiben gespeichert und werden in kleinen Abschnitten angezeigt', async ({ page }) => {
  await onboard(page)
  const history = Array.from({ length: 30 }, (_, index) => ({ ...old, at: old.at + index, note: `Archivbeobachtung ${index}` }))
  await chooseFile(page, JSON.stringify({ app: 'anker', exportedAt: '2026-11-06T12:00:00Z', reports: {}, history: { 1: history } }))
  await page.getByRole('button', { name: 'Berichte als frühere Belege übernehmen', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Die früheren Belege wurden gespeichert' })).toBeVisible()
  await expect(page.getByText('Früher geprüft: 30 erhaltene Rückmeldungen zu Test 1', { exact: true })).toBeVisible()
  await page.getByText('Frühere Berichte zu diesem Test ansehen', { exact: true }).click()
  await expect(page.getByText('Archivbeobachtung 29', { exact: true })).toBeVisible()
  await expect(page.getByText('Archivbeobachtung 19', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Weitere frühere Berichte anzeigen (20)', exact: true }).click()
  await expect(page.getByText('Archivbeobachtung 19', { exact: true })).toBeVisible()
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.deviceTests?.history?.[1]).toEqual(history)
  expect(JSON.parse(await downloadReports(page)).history['1']).toEqual(history)
})

test('Speichern sperrt Export bis zum echten Persistieren; Import ist per Tastatur schmal erreichbar', async ({ page }) => {
  await onboard(page)
  await page.setViewportSize({ width: 320, height: 640 })
  await page.getByLabel('Testbeobachtung').fill('Persistierter Tastaturbericht')
  await page.getByLabel('Testbeobachtung').press('Tab')
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const state = window as unknown as { holdDeviceReportWrite: boolean }
    state.holdDeviceReportWrite = true
    const open = indexedDB.open('anker')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction('records', 'readwrite')
      transaction.oncomplete = () => db.close()
      const records = transaction.objectStore('records')
      const keep = () => { const read = records.get(['meta', 'local']); read.onsuccess = () => { if (state.holdDeviceReportWrite) keep() } }
      keep(); resolve()
    }
  }))
  try {
    await page.getByRole('button', { name: 'Teilweise', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Testberichte als Datei exportieren', exact: true })).toBeDisabled()
    await expect(page.getByText('Deine Rückmeldung wurde gespeichert: Teilweise.', { exact: true })).toHaveCount(0)
  } finally {
    await page.evaluate(() => { (window as unknown as { holdDeviceReportWrite: boolean }).holdDeviceReportWrite = false })
  }
  await expect(page.getByText('Deine Rückmeldung wurde gespeichert: Teilweise.', { exact: true })).toBeVisible()
  expect(JSON.parse(await downloadReports(page)).reports['1'].note).toBe('Persistierter Tastaturbericht')
  await chooseFile(page, oldFile)
  const confirm = page.getByRole('button', { name: 'Berichte als frühere Belege übernehmen', exact: true })
  await confirm.focus(); await expect(confirm).toBeFocused(); await confirm.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Die früheren Belege wurden gespeichert' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})

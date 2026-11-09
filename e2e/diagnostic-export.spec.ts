import { expect, test, type Page } from '@playwright/test'
import type { Settings } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

async function setup(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-09T08:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.alarm.qrSecret = 'PRIVATE_QR_CONTENT'
  settings.routines.morning[0]!.title = 'PRIVATE_ROUTINE_TITLE'
  settings.support.windDown.activity = 'PRIVATE_EVENING_TEXT'
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.goto('/diagnose')
  await expect(page.getByRole('heading', { name: 'Weckerverlauf & Diagnose', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ausgewählte Diagnose exportieren', exact: true })).toBeEnabled()
  return settings
}

async function exported(page: Page) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Ausgewählte Diagnose exportieren', exact: true }).click()
  const download = await pending
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const data of stream) chunks.push(Buffer.from(data))
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}

test('Diagnose ist direkt erreichbar und exportiert nur bewusst gewählte Einstellungen', async ({ page }) => {
  const settings = await setup(page)
  await expect(page.getByText('Im Browser gibt es kein Android-Weckerjournal.', { exact: false })).toBeVisible()
  await page.getByText('Log- und Einstellungsbereiche auswählen', { exact: true }).click()
  const alarmSettings = page.getByRole('checkbox', { name: 'Wecker und Aufstehzeiten', exact: true })
  await expect(alarmSettings).not.toBeChecked()
  await alarmSettings.check()
  const report = await exported(page)
  expect(report.kind).toBe('anker-diagnostics')
  expect(report.app).toMatchObject({ name: 'Anker', platform: 'web' })
  expect(Object.keys(report.settings as object)).toEqual(['alarm'])
  expect(JSON.stringify(report)).not.toContain('PRIVATE_')
  expect(report.logs).toEqual([])
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.routines).toEqual(settings.routines)
  await page.goto('/einstellungen')
  await page.getByRole('link', { name: /Weckerverlauf & Diagnose/ }).click()
  await expect(page).toHaveURL(/\/diagnose$/)
})

test('Komplette sichere Einstellungsauswahl bleibt bei großer Schrift ohne private Inhalte', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '160%' })
  await page.getByText('Log- und Einstellungsbereiche auswählen', { exact: true }).click()
  for (const name of ['Wecker und Aufstehzeiten', 'Schlaf- und Abendoptionen', 'Routinen: nur Dauern und Kernschritte', 'Erinnerungen und Ruhezeiten', 'Darstellung', 'Arbeitszeiten: nur Wochenstruktur']) {
    await page.getByRole('checkbox', { name, exact: true }).check()
  }
  const report = await exported(page)
  expect(Object.keys(report.settings as object)).toHaveLength(6)
  expect(JSON.stringify(report)).not.toContain('PRIVATE_')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const button = page.getByRole('button', { name: 'Ausgewählte Diagnose exportieren', exact: true })
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
})

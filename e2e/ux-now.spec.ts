import { expect, test, type Page } from '@playwright/test'
import { defaultSettings, emptyLocal } from '../src/core/defaults'
import { initialGame } from '../src/core/game'
import { seedRecords, storedRecord } from './helpers/storage'
import type { LocalData, Settings } from '../src/core/types'

const DATE = '2026-11-18'
async function setup(page: Page) {
  await page.clock.setFixedTime(new Date(`${DATE}T06:30:00+01:00`))
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: 'Hallo! ⚓', exact: true })).toBeVisible()
  const settings = { ...defaultSettings(DATE), onboarded: true }
  settings.anchor = { ...settings.anchor, wake: 420, manual: { wake: true, bed: true, pcStop: true } }
  await seedRecords(page, [
    { collection: 'settings', id: 'main', data: settings },
    { collection: 'meta', id: 'local', data: emptyLocal() },
    { collection: 'game', id: 'main', data: initialGame(DATE) },
    { collection: 'days', id: DATE, data: { date: DATE, override: { wakeOverride: 400 }, steps: {} } },
  ])
  await page.goto('/')
  await expect(page.getByTestId('now-page')).toBeVisible()
}

test('Jetzt nennt Countdown, Kalendertag und einmalige Abweichung; Details öffnen ohne Planänderung', async ({ page }) => {
  await setup(page)
  const before = await storedRecord(page, 'days', DATE)
  await expect(page.getByLabel('Nächster fester Zeitpunkt')).toContainText('Aufstehen in 10 min')
  await expect(page.getByLabel('Nächster fester Zeitpunkt')).toContainText('Heute um 06:40')
  await expect(page.getByLabel('Aktueller Planstatus')).toContainText('Aufstehzeit einmalig: Heute um 06:40')
  await expect(page.getByText(/Dein Standard bleibt/)).not.toBeVisible()
  await page.screenshot({ path: test.info().outputPath('jetzt.png'), fullPage: true })
  await page.getByRole('button', { name: 'Info: Heutige Abweichungen', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Dein Standard bleibt 07:00')
  await page.getByRole('button', { name: 'Schließen', exact: true }).click()
  await expect(page.locator('#root')).toHaveJSProperty('inert', false)
  expect(await storedRecord(page, 'days', DATE)).toEqual(before)
})

test('Suchfavoriten bleiben lokal, in gewählter Reihenfolge und ohne Änderung der Weckereinstellungen', async ({ page }) => {
  await setup(page)
  const before = await storedRecord<Settings>(page, 'settings', 'main')
  await page.getByRole('button', { name: 'Funktionen und Einstellungen suchen', exact: true }).click()
  const search = page.getByRole('searchbox', { name: 'Funktion oder Einstellung suchen', exact: true })
  await search.fill('PC bleibt an')
  await page.getByRole('group', { name: 'PC-Begleiter und PC-Stopp', exact: true }).getByRole('button', { name: 'Favorit merken', exact: true }).click()
  await search.fill('fotografieren')
  await page.getByRole('group', { name: 'Hobbys und freiwillige Ideen', exact: true }).getByRole('button', { name: 'Favorit merken', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Hobbys und freiwillige Ideen', exact: true }).getByRole('button', { name: 'Favorit entfernen', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Schließen', exact: true }).click()
  await expect(page.locator('#root')).toHaveJSProperty('inert', false)
  await page.reload()
  await page.getByRole('button', { name: 'Funktionen und Einstellungen suchen', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('group')).toHaveCount(2)
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.functionFavorites).toEqual(['pc', 'hobbies'])
  expect(await storedRecord<Settings>(page, 'settings', 'main')).toEqual(before)
  await page.getByRole('group', { name: 'PC-Begleiter und PC-Stopp', exact: true }).getByRole('button', { name: 'Favorit entfernen', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('group')).toHaveCount(1)
})

test('Große Schrift lässt Überschriften lesbar und den Info-Schließen-Knopf beim Scrollen erreichbar', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 320, height: 780 })
  await page.goto('/einstellungen/darstellung')
  await page.getByRole('spinbutton', { name: 'Schriftgröße', exact: true }).fill('160')
  await page.getByRole('spinbutton', { name: 'Schriftgröße', exact: true }).press('Tab')
  await page.goto('/wecker')
  const heading = await page.getByRole('heading', { level: 1 }).boundingBox()
  expect(heading!.width).toBeGreaterThan(230)
  await page.getByRole('button', { name: 'Info: Aktivitäts-Weckfenster', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.evaluate(node => { node.scrollTop = node.scrollHeight })
  const close = await dialog.getByRole('button', { name: 'Schließen', exact: true }).boundingBox()
  expect(close!.y).toBeGreaterThanOrEqual(0)
  expect(close!.y + close!.height).toBeLessThanOrEqual(780)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await dialog.getByRole('button', { name: 'Schließen', exact: true }).click()
  await expect(dialog).toHaveCount(0)
})

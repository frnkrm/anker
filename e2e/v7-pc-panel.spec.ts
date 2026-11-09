/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { LocalData, Settings } from '../src/core/types'
import { chooseValue, choiceValues } from './helpers/controls'
import { seedRecords, storedRecord } from './helpers/storage'

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-09T18:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
}

test('PC-Webvorschau trennt Verbindung, Eingriffe und privaten Text; die klassische Einrichtung bleibt erhalten', async ({ page }) => {
  await onboard(page)
  await page.goto('/pc-stopp')
  const panel = page.getByRole('region', { name: 'Lokaler PC-Begleiter', exact: true })
  await expect(panel).toContainText('Web-Vorschau')
  await expect(panel).toContainText('Die Web-Vorschau bestätigt weder eine Verbindung noch den Empfang am PC.')
  await panel.getByText('PC erstmals koppeln', { exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Kopplungs-QR am PC scannen', exact: true })).toBeDisabled()
  await panel.getByText('Hilfen und Freigaben für diesen PC', { exact: true }).click()
  for (const name of ['PC-Eingriffe erlauben', 'PC-Audio schrittweise senken', 'PC-Abdunklung erlauben', 'Brain-Dump mit dem PC teilen', 'Morgen-Countdown auf dem PC', 'Beobachtete PC-Pausen übernehmen']) {
    await expect(panel.getByRole('switch', { name, exact: true })).toHaveAttribute('aria-checked', 'false')
  }
  await panel.getByRole('switch', { name: 'PC-Audio schrittweise senken', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.pcBridge?.preferences.audioDuck).toBe(true)
  const saved = (await storedRecord<LocalData>(page, 'meta', 'local'))!.pcBridge!
  expect(saved.enabled).toBe(false)
  expect(saved.preferences.enforceEnabled).toBe(false)
  expect(saved.preferences.shareBrainDump).toBe(false)
  await expect(page.getByRole('button', { name: 'PC einrichten', exact: true })).toBeVisible()
})

test('PC-Einstellungen bleiben bei 320 Pixeln und 160 Prozent Schrift lesbar; ungültiges WoL wird nicht gespeichert', async ({ page }) => {
  await onboard(page)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.appearance.fontScale = 1.6
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/pc-stopp')
  const panel = page.getByRole('region', { name: 'Lokaler PC-Begleiter', exact: true })
  await panel.getByText('Hilfen und Freigaben für diesen PC', { exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
  await panel.getByText('PC nach dem Morgen per Wake-on-LAN wecken', { exact: true }).click()
  await panel.getByRole('switch', { name: 'Wake-on-LAN erlauben', exact: true }).click()
  await panel.getByRole('textbox', { name: 'Wake-on-LAN MAC-Adresse', exact: true }).fill('ungültig')
  await panel.getByRole('button', { name: 'Wake-on-LAN-Auswahl übernehmen', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('Noch nichts wurde geändert.')
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.pcBridge?.wakeOnLan).toBeUndefined()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
})

test('Die v7-Kurzrunde nutzt sieben vorhandene Berichtplätze und bewahrt die Standard-Kurzrunde', async ({ page }) => {
  await onboard(page)
  await page.goto('/geraetetest')
  expect(await choiceValues(page, 'Test auswählen')).toEqual(['1', '21', '62', '92', '95', '96'])
  await page.getByRole('button', { name: 'v7 gemeinsam ausprobieren · 7 Stationen', exact: true }).click()
  expect(await choiceValues(page, 'Test auswählen')).toEqual(['97', '98', '99', '100', '101', '102', '103'])
  await chooseValue(page, 'Test auswählen', '102')
  await page.getByRole('textbox', { name: 'Testbeobachtung', exact: true }).fill('PC-Empfang noch offen; Web-Vorschau gelesen.')
  await page.getByRole('button', { name: 'Teilweise', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.deviceTests?.reports['102']?.result).toBe('partial')
  await page.reload()
  expect(await choiceValues(page, 'Test auswählen')).toEqual(['97', '98', '99', '100', '101', '102', '103'])
  await expect(page.getByRole('textbox', { name: 'Testbeobachtung', exact: true })).toHaveValue('PC-Empfang noch offen; Web-Vorschau gelesen.')
})

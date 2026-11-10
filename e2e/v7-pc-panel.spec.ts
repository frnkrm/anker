/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { LocalData, Settings } from '../src/core/types'
import { guidancePreferences } from '../src/core/guidance'
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
  await panel.getByText('Was weiß dein PC?', { exact: true }).click()
  await panel.getByRole('button', { name: 'Lokale Vorschau anzeigen', exact: true }).click()
  await expect(panel.getByRole('list', { name: 'Vorbereitete PC-Tage', exact: true }).getByRole('listitem')).toHaveCount(14)
  await expect(panel).toContainText('Abendnotiz bleibt auf dem Handy')
  await expect(panel.getByRole('button', { name: 'Jetzt abgleichen', exact: true })).toBeDisabled()
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
  await panel.getByText('Was weiß dein PC?', { exact: true }).click()
  await panel.getByRole('button', { name: 'Lokale Vorschau anzeigen', exact: true }).click()
  await expect(panel.getByRole('list', { name: 'Vorbereitete PC-Tage', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
})

test('Gewählte Abendbegleitung zeigt Bettzeit als PC-Grenze und erhält die separate Standard-PC-Zeit', async ({ page }) => {
  await onboard(page)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.bed = 23 * 60; settings.pcStop = 22 * 60 + 30
  settings.anchor.manual = { ...settings.anchor.manual, bed: true, pcStop: true }
  settings.guidance = { ...guidancePreferences(), enabled: true, eveningEscalation: true }
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.goto('/pc-stopp')
  const panel = page.getByRole('region', { name: 'Lokaler PC-Begleiter', exact: true })
  await panel.getByText('Was weiß dein PC?', { exact: true }).click()
  await panel.getByRole('button', { name: 'Lokale Vorschau anzeigen', exact: true }).click()
  await expect(panel).toContainText('folgt deiner Bettzeit')
  const day = panel.getByRole('list', { name: 'Vorbereitete PC-Tage', exact: true }).getByRole('listitem').first()
  await expect(day.getByText('PC-Stopp', { exact: true }).locator('..').locator('dd')).toContainText('22:30')
  await expect(day.getByText('Speicherfrist am PC ab', { exact: true }).locator('..').locator('dd')).toContainText('23:00')
  const saved = (await storedRecord<Settings>(page, 'settings', 'main'))!
  expect(saved.pcStop).toBe(22 * 60 + 30)
  expect(saved.bed).toBe(23 * 60)
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.pcBridge?.enabled ?? false).toBe(false)
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

test('Der PC übernimmt den gewählten sanften Abendübergang; seine Abwahl erhält die Handyzeit und alle Routinen', async ({ page }) => {
  await onboard(page)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.support.windDown = { enabled: true, at: 30, activity: 'PRIVATE_GENTLE_ACTIVITY' }
  settings.anchor.manual = { ...settings.anchor.manual, pcStop: true, bed: true }
  settings.pcStop = 60; settings.bed = 90
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.goto('/pc-stopp')
  const panel = page.getByRole('region', { name: 'Lokaler PC-Begleiter', exact: true })
  await panel.getByText('Hilfen und Freigaben für diesen PC', { exact: true }).click()
  const follow = panel.getByRole('switch', { name: 'Meinen sanften Abendübergang am PC nutzen', exact: true })
  await expect(follow).toHaveAttribute('aria-checked', 'true')
  await panel.getByText('Was weiß dein PC?', { exact: true }).click()
  await panel.getByRole('button', { name: 'Lokale Vorschau anzeigen', exact: true }).click()
  await expect(panel).toContainText('Am PC gilt dein sanfter Abendübergang zur gewählten Uhrzeit.')
  const day = panel.getByRole('list', { name: 'Vorbereitete PC-Tage', exact: true }).getByRole('listitem').first()
  await expect(day.getByText('Abendübergang', { exact: true }).locator('..').locator('dd')).toContainText('00:30')
  await expect(panel).not.toContainText('PRIVATE_GENTLE_ACTIVITY')
  await follow.click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.pcBridge?.preferences.followGentleEvening).toBe(false)
  await panel.getByRole('button', { name: 'Lokale Vorschau aktualisieren', exact: true }).click()
  await expect(panel).toContainText('Der PC-Begleiter folgt deiner PC-Stoppzeit mit Vorhinweisen und anschließender Speicherfrist.')
  const saved = (await storedRecord<Settings>(page, 'settings', 'main'))!
  expect(saved.support.windDown).toEqual(settings.support.windDown)
  expect(saved.routines).toEqual(settings.routines)
  await page.reload()
  await panel.getByText('Hilfen und Freigaben für diesen PC', { exact: true }).click()
  await expect(panel.getByRole('switch', { name: 'Meinen sanften Abendübergang am PC nutzen', exact: true })).toHaveAttribute('aria-checked', 'false')
})

test('Die lokale Sanftwahl aktiviert keinen ausgeschalteten Handyübergang und bleibt bei großer Schrift lesbar', async ({ page }) => {
  await onboard(page)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.support.windDown.enabled = false
  settings.appearance.fontScale = 1.6
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/pc-stopp')
  const panel = page.getByRole('region', { name: 'Lokaler PC-Begleiter', exact: true })
  await panel.getByText('Hilfen und Freigaben für diesen PC', { exact: true }).click()
  await expect(panel).toContainText('Der sanfte Abendübergang ist derzeit ausgeschaltet.')
  const follow = panel.getByRole('switch', { name: 'Meinen sanften Abendübergang am PC nutzen', exact: true })
  await follow.click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.pcBridge?.preferences.followGentleEvening).toBe(false)
  await follow.click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.pcBridge?.preferences.followGentleEvening).toBe(true)
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.support.windDown.enabled).toBe(false)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await panel.getByText('Was weiß dein PC?', { exact: true }).click()
  await panel.getByRole('button', { name: 'Lokale Vorschau anzeigen', exact: true }).click()
  await expect(panel).not.toContainText('Am PC gilt dein sanfter Abendübergang zur gewählten Uhrzeit.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

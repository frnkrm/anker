/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import type { DayLog, GameState, LocalData, Settings } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const DAY = '2026-11-09'
const START = Date.parse(`${DAY}T10:00:00+01:00`)
async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date(START))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}

test('Mehr bleibt bei acht Zielen und die Hauptnavigation bei drei Bereichen, auch ohne Spiel', async ({ page }) => {
  await onboard(page)
  await page.goto('/mehr')
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation', exact: true })
  await expect(nav.getByRole('link')).toHaveCount(3)
  await expect(nav.getByRole('link', { name: 'Jetzt', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Heute', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Mehr', exact: true })).toBeVisible()
  await expect(page.locator('[data-more-hub] > section')).toHaveCount(4)
  await expect(page.locator('[data-more-hub] a')).toHaveCount(8)
  await page.getByRole('link', { name: /Abend & Alltag/ }).click()
  await expect(page.getByRole('link', { name: 'Essen', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Aufräumen', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Vorbereitung', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'PC-Stopp', exact: true })).toBeVisible()
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.support.gameVisible = false
  settings.appearance.fontScale = 1.3
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.goto('/mehr')
  await expect(page.locator('[data-more-hub] a')).toHaveCount(8)
  await expect(page.locator('[data-more-hub] a[href="/spiel"]')).toHaveCount(0)
  await expect(nav.getByRole('link')).toHaveCount(3)
  const widths = await nav.getByRole('link').evaluateAll((links) => links.map((link) => link.getBoundingClientRect().width))
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

const legacyRoutes = ['/', '/abend', '/arbeit', '/arbeitszeit', '/aufraeumen', '/backup', '/check', '/druck', '/einstellungen', '/einstellungen/abenduebergang', '/einstellungen/assistenz', '/essen', '/fokus-start', '/gedanke', '/geraetetest', '/hilfe', '/inbox', '/mehr', '/orte', '/pc-stopp', '/rueckblick', '/schlaf', '/spiel', '/spiel/shop', '/start', '/tag', '/verbindungen', '/vorbereitung', '/wecker', '/wecker/klingelt', '/wiedereinstieg', '/zeiten', ...['arbeit', 'weg', 'schlaf', 'sport', 'abende', 'abendmodus', 'morgenroutine', 'abendroutine', 'erinnerungen', 'darstellung', 'hilfen'].map((section) => `/einstellungen/${section}`), '/fokus/morning', '/fokus/evening', '/aufgabe/work/ui-route-work', '/aufgabe/task/ui-route-private', '/aufgabe/work/ui-route-work?teil=ui-route-part']

for (let batch = 0; batch < Math.ceil(legacyRoutes.length / 12); batch++) {
  const routes = legacyRoutes.slice(batch * 12, (batch + 1) * 12)
  test(`Bestehende Direktlinks bleiben erreichbar – Gruppe ${batch + 1}`, async ({ page }) => {
  await onboard(page)
  const data: LocalData = { ...emptyLocal(), work: [{ id: 'ui-route-work', title: 'Testbericht', nextStep: 'Dokument öffnen', createdAt: START, subtasks: [{id:'ui-route-part',title:'Erste Zeile schreiben'}] }] }
  await seedRecords(page, [{ collection: 'meta', id: 'local', data }, { collection: 'inbox', id: 'ui-route-private', data: { id: 'ui-route-private', text: 'Wäsche starten', status: 'task', taskDate: DAY, createdAt: START } }])
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  for (const route of routes) {
    await page.goto(route)
    await expect(page.locator('[aria-busy="true"]'), route).toHaveCount(0)
    // Capture and recovery routes intentionally render their content through a portal.
    await expect(page.locator('main h1:visible, [role="dialog"]:visible'), route).not.toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Aufgabe nicht verfügbar', exact: true }), route).toHaveCount(0)
  }
  expect(errors).toEqual([])
  })
}

test('Vorbereitung trennt Abhaken von Bearbeiten und Entfernen lässt sich ohne falsche Erledigung rückgängig machen', async ({ page }) => {
  await onboard(page)
  await page.goto('/vorbereitung')
  const before = (await storedRecord<Settings>(page, 'settings', 'main'))!.eveningPrep
  const beforeLocal = await storedRecord<LocalData>(page, 'meta', 'local')
  const beforeDay = await storedRecord<DayLog>(page, 'days', DAY)
  const beforeGame = await storedRecord<GameState>(page, 'game', 'main')
  await expect(page.getByRole('checkbox').first()).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Neue Vorbereitung' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Liste bearbeiten', exact: true }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await page.getByRole('button', { name: `${before[0]} entfernen`, exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.eveningPrep).toEqual(before.slice(1))
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.eveningPrep).toEqual(before)
  await page.getByRole('button', { name: 'Fertig', exact: true }).click()
  await expect(page.getByRole('checkbox').first()).not.toBeChecked()
  // A fresh installation may have no persisted local/day record yet. The edit
  // must preserve that exact baseline rather than create a fake completion.
  expect(await storedRecord<LocalData>(page, 'meta', 'local')).toEqual(beforeLocal)
  expect(await storedRecord<DayLog>(page, 'days', DAY)).toEqual(beforeDay)
  const afterGame = await storedRecord<GameState>(page, 'game', 'main')
  expect(afterGame?.xp).toBe(beforeGame?.xp)
  expect(afterGame?.spent).toBe(beforeGame?.spent)
})

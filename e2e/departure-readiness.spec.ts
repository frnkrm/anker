/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultSettings, emptyLocal } from '../src/core/defaults'
import { initialGame } from '../src/core/game'
import type { Commitment, DayLog, Settings } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const DATE = '2026-11-02'
const at = (time: string) => new Date(`${DATE}T${time}:00+01:00`)
const card = (page: Page) => page.getByRole('complementary', { name: 'Abfahrtsbereitschaft', exact: true })

async function seed(page: Page, homeOffice = false, commitments: Commitment[] = []) {
  await page.clock.setFixedTime(at('08:00'))
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: 'Hallo! ⚓', exact: true })).toBeVisible()
  const settings = { ...defaultSettings(DATE), onboarded: true }
  settings.anchor = { ...settings.anchor, wake: 420, manual: { wake: true, bed: true, pcStop: true } }
  settings.work[0] = { ...settings.work[0]!, start: 540, homeOffice }
  settings.commute.minutes = 20
  settings.commute.bufferMin = 10
  settings.sport.days = settings.sport.days.map(() => false)
  settings.routines.morning = [
    { id: 'first', title: 'Ein Glas Wasser', minutes: 10 },
    { id: 'second', title: 'Tasche nehmen', minutes: 5 },
  ]
  await seedRecords(page, [
    { collection: 'settings', id: 'main', data: settings },
    { collection: 'days', id: DATE, data: { date: DATE, override: {}, steps: {}, wakeAt: at('07:00').getTime() } satisfies DayLog },
    { collection: 'meta', id: 'local', data: { ...emptyLocal(), commitments } },
    { collection: 'game', id: 'main', data: initialGame(DATE) },
  ])
  await page.goto('/')
  await expect(page.getByTestId('now-page').getByRole('heading', { level: 1 })).toBeVisible()
}

test('Abfahrtspuffer folgt echten Erledigungen, erhält nächste Handlung und bucht beim Lesen nichts', async ({ page }) => {
  await seed(page)
  const beforeGame = await storedRecord(page, 'game', 'main')
  await expect(card(page)).toContainText('Losgehen 08:30 · noch 30 min')
  await expect(card(page)).toContainText('Vorbereitung ca. 15 min · 2 offene Routinen-Schritte')
  await expect(card(page)).toContainText('Rechnerischer Puffer 15 min')
  await expect(page.getByRole('heading', { level: 1, name: 'Ein Glas Wasser', exact: true })).toBeVisible()
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.steps).toEqual({})
  expect(await storedRecord(page, 'game', 'main')).toEqual(beforeGame)
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect(card(page)).toContainText('Vorbereitung ca. 5 min · 1 offener Routine-Schritt')
  await expect(card(page)).toContainText('Rechnerischer Puffer 25 min')
  await expect(page.getByRole('heading', { name: 'Tasche nehmen', exact: true })).toBeVisible()
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', DATE))?.steps['morning:first']).toBe('done')
  await page.reload()
  await expect(card(page)).toContainText('Rechnerischer Puffer 25 min')
})

test('Zeitablauf bleibt ohne Erledigung überfällig; bewusstes Losgehen entfernt die Karte', async ({ page }) => {
  await seed(page)
  const before = await storedRecord(page, 'game', 'main')
  await page.clock.setFixedTime(at('08:35'))
  await page.reload()
  await expect(card(page)).toContainText('Geplante Abfahrt 08:30 · seit 5 min erreicht')
  await expect(card(page)).toContainText('Rechnerisch fehlen 20 min')
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.steps).toEqual({})
  expect(await storedRecord(page, 'game', 'main')).toEqual(before)
  await page.getByRole('button', { name: 'Bin los', exact: true }).click()
  await expect(card(page)).toHaveCount(0)
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', DATE))?.leftAt).toBeTruthy()
})

test('Homeoffice erfindet keine Abfahrt; unklare Terminreise verspricht keinen Puffer', async ({ page }) => {
  await seed(page, true)
  await expect(card(page)).toHaveCount(0)
  await seedRecords(page, [{ collection: 'meta', id: 'local', data: {
    ...emptyLocal(), commitments: [{ id: 'visit', date: DATE, label: 'Besuch', context: 'personal', commitment: 'hard',
      start: 540, end: 600, locationKind: 'onsite', placeLabel: 'Anderer Ort', prepMin: 5 } satisfies Commitment],
  } }])
  await page.reload()
  await expect(card(page)).toContainText('Abfahrt noch offen')
  await expect(card(page)).toContainText('Puffer offen · Zeiten oder Weg noch unklar.')
  await expect(card(page)).not.toContainText('Rechnerischer Puffer')
})

test('Planwechsel aktualisiert Abfahrtszeit und Puffer', async ({ page }) => {
  await seed(page)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.work[0]!.start = 600
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.reload()
  await expect(card(page)).toContainText('Losgehen 09:30 · noch 1 h 30 min')
  await expect(card(page)).toContainText('Rechnerischer Puffer 1 h 15 min')
})

test('Abfahrtskarte bleibt bei 320px und 160 Prozent Schrift lesbar', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page)
  await page.evaluate(() => { document.documentElement.style.fontSize = '160%' })
  await expect(card(page)).toContainText('Rechnerischer Puffer 15 min')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  const box = await card(page).boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  await expect(page.getByRole('button', { name: 'Erledigt', exact: true })).toBeEnabled()
  await page.screenshot({ path: info.outputPath('abfahrt-320-160.png'), fullPage: true })
})

/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultSettings, emptyLocal } from '../src/core/defaults'
import { initialGame } from '../src/core/game'
import type { DayLog, Settings } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const DATE = '2026-11-02'
const at = (time: string) => new Date(`${DATE}T${time}:00+01:00`)
const offer = (page: Page) => page.getByRole('region', { name: 'Kurzmodusangebot', exact: true })
const card = (page: Page) => page.getByRole('complementary', { name: 'Abfahrtsbereitschaft', exact: true })
async function seed(page: Page, time = '08:22', short = false) {
  await page.clock.setFixedTime(at(time))
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: 'Hallo! ⚓', exact: true })).toBeVisible()
  const settings = { ...defaultSettings(DATE), onboarded: true }
  settings.anchor = { ...settings.anchor, wake: 420, manual: { wake: true, bed: true, pcStop: true } }
  settings.work[0] = { ...settings.work[0]!, start: 540, homeOffice: false }
  settings.commute.minutes = 20; settings.commute.bufferMin = 10
  settings.sport.days = settings.sport.days.map(() => false)
  settings.routines.morning = [
    { id: 'first', title: 'Frühstück', minutes: 10, minimal: { title: 'Banane mitnehmen', minutes: 2 } },
    { id: 'second', title: 'Schlüssel nehmen', minutes: 5 },
  ]
  await seedRecords(page, [
    { collection: 'settings', id: 'main', data: settings },
    { collection: 'days', id: DATE, data: { date: DATE, override: short ? { shortMorning: true } : {}, steps: {}, wakeAt: at('07:00').getTime() } satisfies DayLog },
    { collection: 'meta', id: 'local', data: emptyLocal() },
    { collection: 'game', id: 'main', data: initialGame(DATE) },
  ])
  await page.goto('/')
  await expect(page.getByTestId('now-page').getByRole('heading', { level: 1 })).toBeVisible()
}

test('Kurzmodus zeigt eine Vorschau, ändert erst nach Annahme den Morgen und erhält Schritte nach Reload', async ({ page }) => {
  await seed(page)
  const day = await storedRecord<DayLog>(page, 'days', DATE)
  const game = await storedRecord(page, 'game', 'main')
  const settings = await storedRecord(page, 'settings', 'main')
  await expect(offer(page)).toContainText('Vorbereitung ca. 15 min → ca. 7 min.')
  await expect(offer(page)).toContainText('Frühstück → Banane mitnehmen')
  await expect(page.getByRole('heading', { name: 'Frühstück', exact: true })).toBeVisible()
  expect(await storedRecord(page, 'days', DATE)).toEqual(day)
  await offer(page).getByRole('button', { name: 'Kurzmodus übernehmen', exact: true }).click()
  await expect(offer(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Banane mitnehmen', exact: true })).toBeVisible()
  await expect(card(page)).toContainText('Rechnerischer Puffer 1 min')
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', DATE))?.override.shortMorning).toBe(true)
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.steps).toEqual({})
  expect(await storedRecord(page, 'game', 'main')).toEqual(game)
  expect(await storedRecord(page, 'settings', 'main')).toEqual(settings)
  await page.reload()
  await expect(offer(page)).toHaveCount(0)
  await expect(card(page)).toContainText('2 offene Routinen-Schritte')
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.changes).toEqual(['Morgenroutine in kurzen Varianten'])
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Schlüssel nehmen', exact: true })).toBeVisible()
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', DATE))?.steps['morning:first']).toBe('minimal')
})

test('So lassen schreibt nichts und bleibt bei einem Uhrtick abgelehnt', async ({ page }) => {
  await seed(page)
  const day = await storedRecord(page, 'days', DATE), game = await storedRecord(page, 'game', 'main')
  await offer(page).getByRole('button', { name: 'So lassen', exact: true }).click()
  await expect(offer(page)).toHaveCount(0)
  await page.clock.setFixedTime(at('08:23'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(card(page)).toContainText('noch 7 min')
  await expect(offer(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Frühstück', exact: true })).toBeVisible()
  expect(await storedRecord(page, 'days', DATE)).toEqual(day)
  expect(await storedRecord(page, 'game', 'main')).toEqual(game)
})

test('Nach Ablauf verschwindet ein offenes Angebot ohne Erledigung oder Kürzung', async ({ page }) => {
  await seed(page)
  await expect(offer(page)).toBeVisible()
  await page.clock.setFixedTime(at('08:30'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(offer(page)).toHaveCount(0)
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.override.shortMorning).toBeUndefined()
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.steps).toEqual({})
})

test('Unklare Abfahrt bietet keinen Kurzmodus an; bereits gewählte Varianten werden nicht doppelt angeboten', async ({ page }) => {
  await seed(page, '08:22', true)
  await expect(offer(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Banane mitnehmen', exact: true })).toBeVisible()
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.work[0]!.homeOffice = true
  await seedRecords(page, [
    { collection: 'settings', id: 'main', data: settings },
    { collection: 'days', id: DATE, data: { date: DATE, override: {}, steps: {}, wakeAt: at('07:00').getTime() } satisfies DayLog },
    { collection: 'meta', id: 'local', data: { ...emptyLocal(), commitments: [{ id: 'visit', date: DATE, label: 'Besuch', context: 'personal', commitment: 'hard', start: 540, end: 600, locationKind: 'onsite', placeLabel: 'Anderer Ort', prepMin: 5 }] } },
  ])
  await page.reload()
  await expect(card(page)).toContainText('Abfahrt noch offen')
  await expect(offer(page)).toHaveCount(0)
})

test('Kurz bleibt bei sehr knapper Zeit eine bewusste Wahl ohne Pünktlichkeitszusage', async ({ page }) => {
  await seed(page, '08:29')
  await expect(offer(page)).toContainText('Auch kurz reicht die geschätzte Zeit nicht bis zur geplanten Abfahrt.')
  await offer(page).getByRole('button', { name: 'Kurzmodus übernehmen', exact: true }).click()
  await expect(offer(page)).toHaveCount(0)
  await expect(card(page)).toContainText('Rechnerisch fehlen 6 min')
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.steps).toEqual({})
})

test('Kurzmodusangebot ist bei 320px und 160 Prozent Schrift ohne Überlauf bedienbar', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page)
  await page.evaluate(() => { document.documentElement.style.fontSize = '160%' })
  await expect(offer(page)).toContainText('Alle Schritte bleiben erhalten.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  const accept = offer(page).getByRole('button', { name: 'Kurzmodus übernehmen', exact: true })
  await accept.scrollIntoViewIfNeeded()
  expect((await accept.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await page.screenshot({ path: info.outputPath('kurzmodus-320-160.png'), fullPage: true })
  await accept.click()
  await expect(offer(page)).toHaveCount(0)
})

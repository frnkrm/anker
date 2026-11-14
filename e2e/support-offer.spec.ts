/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import { SUPPORT_OFFER_DISMISSED } from '../src/core/support'
import type { DayLog, GameState, LocalData, Settings, SupportMode } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const DATE = '2026-11-13', NOW = new Date(`${DATE}T07:10:00+01:00`).getTime()
const day = (page: Page) => storedRecord<DayLog>(page, 'days', DATE)
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
async function prepare(page: Page, options: { mode?: SupportMode; smaller?: boolean; done?: boolean; large?: boolean } = {}) {
  await page.clock.setFixedTime(new Date(NOW))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.anchor = { ...settings.anchor, wake: 420, manual: { wake: true, pcStop: true, bed: true } }
  settings.work[4] = { ...settings.work[4]!, start: 600, homeOffice: true }
  settings.sport.days = settings.sport.days.map(() => false)
  settings.support.gameVisible = false
  settings.routines.morning = [{ id: 'first', title: 'Ein Glas Wasser', minutes: 30 }, { id: 'second', title: 'Tasche bereitstellen', minutes: 5 }]
  if (options.large) settings.appearance.fontScale = 1.6
  const facts: DayLog = { date: DATE, wakeAt: NOW - 10 * 60_000, override: { ...(options.mode ? { mode: options.mode } : {}) }, steps: options.done ? { 'morning:first': 'done' } : {} }
  const data = emptyLocal()
  if (options.smaller) data.stuck = { contextKey: `${DATE}:step:morning:first`, level: 1 }
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }, { collection: 'days', id: DATE, data: facts }, { collection: 'meta', id: 'local', data }])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: options.done ? 'Tasche bereitstellen' : 'Ein Glas Wasser', exact: true })).toBeVisible()
}
async function openHelp(page: Page) {
  await page.getByRole('button', { name: 'Ich hänge fest', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Ganz klein anfangen', exact: true })).toBeVisible()
}
async function closeHelp(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => history.state?.ankerSheet ?? null)).toBeNull()
}
const offer = (page: Page) => page.getByRole('region', { name: 'Freiwillige Vereinfachung', exact: true })

test('F-007: Angebot folgt nur ausdrücklicher Verkleinerung, Annahme ist bewusst und startet nichts', async ({ page }) => {
  await prepare(page)
  await openHelp(page)
  await expect(offer(page)).toHaveCount(0)
  expect((await local(page))?.stuck).toBeUndefined()
  await page.getByRole('button', { name: 'Etwas kleiner', exact: true }).click()
  await expect(offer(page)).toContainText('„Etwas kleiner“ gewählt')
  expect((await local(page))!.stuck!.timer).toBeUndefined()
  const before = (await local(page))!
  const game = await storedRecord<GameState>(page, 'game', 'main')
  const steps = (await day(page))!.steps
  await offer(page).getByRole('button', { name: 'Für heute Einfach anfangen', exact: true }).click()
  await expect.poll(async () => (await day(page))?.override.mode).toBe('startschwierigkeit')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Ein Glas Wasser', exact: true })).toBeVisible()
  expect(await local(page)).toEqual(before)
  expect((await day(page))!.steps).toEqual(steps)
  expect(await storedRecord<GameState>(page, 'game', 'main')).toEqual(game)
  await page.getByRole('button', { name: 'Klein anfangen', exact: true }).click()
  await expect(page.getByRole('timer')).toHaveText('0:30')
  await expect(offer(page)).toHaveCount(0)
  expect((await local(page))!.stuck!.timer).toBeUndefined()
})

test('F-007: Tagesabwahl bewahrt einen laufenden Hilfetimer und bleibt über Reload/anderen Schritt erhalten', async ({ page }) => {
  await prepare(page, { smaller: true })
  await openHelp(page)
  await expect(offer(page)).toBeVisible()
  await page.getByRole('button', { name: 'Starten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.stuck?.timer?.status).toBe('running')
  const before = (await local(page))!
  const facts = (await day(page))!
  await offer(page).getByRole('button', { name: 'Heute ohne Angebot', exact: true }).click()
  await expect(offer(page)).toHaveCount(0)
  expect(await local(page)).toEqual(before)
  expect((await day(page))!.override).toEqual(facts.override)
  expect((await day(page))!.steps).toEqual(facts.steps)
  expect((await day(page))!.dismissed).toContain(SUPPORT_OFFER_DISMISSED)
  await closeHelp(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Ein Glas Wasser', exact: true })).toBeVisible()
  await openHelp(page)
  await expect(offer(page)).toHaveCount(0)
  await closeHelp(page)
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tasche bereitstellen', exact: true })).toBeVisible()
  await openHelp(page)
  await page.getByRole('button', { name: 'Etwas kleiner', exact: true }).click()
  await expect.poll(async () => (await local(page))?.stuck?.contextKey).toBe(`${DATE}:step:morning:second`)
  await expect(offer(page)).toHaveCount(0)
})

test('F-007: überholter Routinenkontext liefert kein Angebot für den nächsten Schritt', async ({ page }) => {
  await prepare(page, { smaller: true, done: true })
  await openHelp(page)
  await expect(offer(page)).toHaveCount(0)
  await expect(page.getByRole('timer')).toHaveText('2:00')
  expect((await local(page))!.stuck!.contextKey).toBe(`${DATE}:step:morning:first`)
})

test('F-007: ausdrücklicher Auf-Kurs-Modus wird nicht durch ein Angebot unterbrochen', async ({ page }) => {
  await prepare(page, { smaller: true, mode: 'auf-kurs' })
  await openHelp(page)
  await expect(offer(page)).toHaveCount(0)
  expect((await day(page))!.override.mode).toBe('auf-kurs')
})

test('F-007: Angebot bleibt bei 320px und großer Schrift bedienbar, Schließen wählt keinen Modus', async ({ page }, info) => {
  await prepare(page, { smaller: true, large: true })
  await page.setViewportSize({ width: 320, height: 844 })
  await openHelp(page)
  const accept = offer(page).getByRole('button', { name: 'Für heute Einfach anfangen', exact: true })
  await accept.scrollIntoViewIfNeeded()
  await expect(accept).toBeInViewport()
  expect(await page.getByRole('dialog').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: info.outputPath('freiwillige-vereinfachung-320.png'), fullPage: true })
  const before = await day(page)
  await closeHelp(page)
  expect(await day(page)).toEqual(before)
})

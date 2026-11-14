/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import { guidancePreferences } from '../src/core/guidance'
import { buildDayPlan } from '../src/core/planner'
import { zonedToUtc } from '../src/core/time'
import type { DayLog, GameState, LocalData, Settings } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const DATE = '2026-11-13'
const time = (m: number) => zonedToUtc(DATE, m)
const day = (page: Page) => storedRecord<DayLog>(page, 'days', DATE)
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
async function at(page: Page, m: number) {
  await page.clock.setFixedTime(new Date(time(m)))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
}
async function prepare(page: Page, m = 1351) {
  await page.clock.setFixedTime(new Date(time(m)))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.anchor = { ...settings.anchor, wake: 420, manual: { wake: true, pcStop: true, bed: true } }
  settings.pcStop = 1350; settings.bed = 1380
  settings.sport.days = settings.sport.days.map(() => false)
  settings.routines.morning = [{ id: 'water', title: 'Ein Glas Wasser', minutes: 1 }]
  settings.routines.evening = [{ id: 'close', title: 'Eine Sache wegräumen', minutes: 1 }]
  const facts: DayLog = { date: DATE, wakeAt: time(420), override: {}, steps: { 'morning:water': 'done', 'evening:close': 'done' } }
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }, { collection: 'days', id: DATE, data: facts }, { collection: 'meta', id: 'local', data: emptyLocal() }])
  return { settings, facts }
}
async function closed(page: Page) {
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => history.state?.ankerSheet ?? null)).toBeNull()
}

test('F-006: nach dem letzten Abendschritt führt eine Handlung zur aktuellen Freizeit', async ({ page }) => {
  const { settings, facts } = await prepare(page)
  const plan = buildDayPlan({ date: DATE, settings })
  await at(page, plan.blocks.find(b => b.routine === 'evening')!.start + 1)
  delete facts.steps['evening:close']
  await seedRecords(page, [{ collection: 'days', id: DATE, data: facts }])
  await page.goto('/fokus/evening')
  await expect(page.getByRole('heading', { name: 'Eine Sache wegräumen', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  const next = page.getByRole('region', { name: 'Nächster Übergang', exact: true })
  await expect(next.getByRole('heading', { name: 'Freizeit – zocken erlaubt', exact: true })).toBeVisible()
  const before = await day(page)
  const game = await storedRecord<GameState>(page, 'game', 'main')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Freizeit – zocken erlaubt', exact: true })).toBeVisible()
  expect(await day(page)).toEqual(before)
  expect(await storedRecord<GameState>(page, 'game', 'main')).toEqual(game)
})

test('F-006: PC-Stopp zeigt Speicherhinweis und wartet auf ausdrückliche Rückmeldung', async ({ page }) => {
  const { settings } = await prepare(page)
  settings.support.windDown = { enabled: true, at: 1260, activity: 'Eine Seite lesen' }
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.goto('/fokus/evening')
  const next = page.getByRole('region', { name: 'Nächster Übergang', exact: true })
  await expect(next.getByRole('heading', { name: 'PC aus', exact: true })).toBeVisible()
  await expect(next).toContainText('Speichere deinen aktuellen Stand')
  expect((await day(page))?.pcOffAt).toBeUndefined()
  const game = await storedRecord<GameState>(page, 'game', 'main')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'PC aus', exact: true })).toBeVisible()
  expect((await day(page))?.pcOffAt).toBeUndefined()
  expect(await storedRecord<GameState>(page, 'game', 'main')).toEqual(game)
  await page.getByRole('button', { name: 'PC ist aus', exact: true }).click()
  await expect.poll(async () => (await day(page))?.pcOffAt).toBe(time(1351))
  await expect(page.getByRole('heading', { name: 'Runterkommen', exact: true })).toBeVisible()
  await expect(page.locator('.now-context')).toHaveText('Eine Seite lesen')
})

test('F-006: offener Abschluss bleibt beim Zeitwechsel aktuell und erledigt nichts', async ({ page }) => {
  await prepare(page, 1349)
  await page.goto('/fokus/evening')
  const next = page.getByRole('region', { name: 'Nächster Übergang', exact: true })
  await expect(next.getByRole('heading', { name: 'Freizeit – zocken erlaubt', exact: true })).toBeVisible()
  const before = await day(page)
  await at(page, 1351)
  await expect(next.getByRole('heading', { name: 'PC aus', exact: true })).toBeVisible()
  await expect(next.getByRole('heading', { name: 'Freizeit – zocken erlaubt', exact: true })).toHaveCount(0)
  expect(await day(page)).toEqual(before)
})

test('F-006: Abendverlängerung ist bewusst, Abbruch unverändert und ein offenes Ende bleibt offen', async ({ page }) => {
  const external: string[] = []
  page.on('request', req => { if (/^https?:/.test(req.url()) && !['localhost', '127.0.0.1'].includes(new URL(req.url()).hostname)) external.push(req.url()) })
  await prepare(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'PC ist aus', exact: true })).toBeVisible()
  const before = await day(page)
  await page.getByRole('button', { name: 'Abendzeit ändern', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '+30 Minuten', exact: true }).click()
  await page.keyboard.press('Escape')
  await closed(page)
  expect(await day(page)).toEqual(before)
  await page.getByRole('button', { name: 'Abendzeit ändern', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Weiß ich noch nicht', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect.poll(async () => (await day(page))?.override.lateUntil).toBe('open')
  await closed(page)
  await expect(page.getByRole('heading', { name: 'Freizeit – zocken erlaubt', exact: true })).toBeVisible()
  await expect(page.locator('.now-context')).toContainText('offen')
  await expect(page.getByRole('button', { name: 'PC ist aus', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.now-context')).toContainText('offen')
  expect((await day(page))?.pcOffAt).toBeUndefined()
  expect((await day(page))?.steps).toEqual(before?.steps)
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.guidance?.pcLock ?? false).toBe(false)
  expect(external).toEqual([])
})

test('F-006: früher Morgen, Pause und Rückkehr verwenden denselben Tag ohne automatische Fortsetzung', async ({ page }) => {
  const { settings, facts } = await prepare(page, 211)
  settings.anchor.wake = 210
  settings.guidance = { ...guidancePreferences(), enabled: true, zeroGapMorning: true }
  facts.wakeAt = time(210); facts.steps = {}
  const data = emptyLocal()
  data.guidance = { days: { [DATE]: { alarmOccurrenceId: 'early', alarmAt: time(210), morningActivatedAt: time(210) } }, receipts: ['early'] }
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }, { collection: 'days', id: DATE, data: facts }, { collection: 'meta', id: 'local', data }])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ein Glas Wasser', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Routine im Fokus öffnen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Ein Glas Wasser', exact: true })).toBeVisible()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('running')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  const paused = (await local(page))!.focus
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ein Glas Wasser', exact: true })).toBeVisible()
  expect((await local(page))!.focus).toEqual(paused)
  await page.getByRole('link', { name: 'Routine im Fokus öffnen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Weiter', exact: true })).toBeVisible()
  expect((await local(page))!.focus).toEqual(paused)
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Nächster Übergang', exact: true })).toBeVisible()
  expect((await day(page))?.steps['morning:water']).toBe('done')
  expect((await storedRecord<DayLog>(page, 'days', '2026-11-12'))?.steps['morning:water']).toBeUndefined()
})

test('F-006: Übergang und PC-Rückmeldung bleiben bei 320px und großer Schrift bedienbar', async ({ page }, info) => {
  const { settings } = await prepare(page)
  settings.appearance.fontScale = 1.6
  settings.support.gameVisible = false
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/fokus/evening')
  await expect(page.getByRole('region', { name: 'Nächster Übergang', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: info.outputPath('uebergang-320.png'), fullPage: true })
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect(page.getByRole('button', { name: 'PC ist aus', exact: true })).toBeVisible()
  expect(await page.locator('.now-action .now-buttons > button').count()).toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: info.outputPath('pc-stopp-320.png'), fullPage: true })
})

test('F-006: gewählte Nachtbegleitung bleibt nach Routinenabschluss dieselbe Ansicht mit einer Hauptaktion', async ({ page }) => {
  const { settings } = await prepare(page, 1381)
  settings.guidance = { ...guidancePreferences(), enabled: true, eveningEscalation: true, bedtimeQr: true }
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.goto('/fokus/evening')
  await expect(page.getByTestId('guidance-night-page')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Anker-QR scannen', exact: true })).toBeVisible()
  expect((await day(page))?.bedAt).toBeUndefined()
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Anker-QR scannen', exact: true })).toBeVisible()
  expect((await day(page))?.bedAt).toBeUndefined()
})

/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultSettings, emptyLocal } from '../src/core/defaults'
import { initialGame } from '../src/core/game'
import type { DayLog } from '../src/core/types'
import type { TimeCatalogSnapshot } from '../src/core/timeCatalog'
import { seedRecords, storedRecord } from './helpers/storage'

const date = '2026-11-02'
const at = (time: string) => new Date(`${date}T${time}:00+01:00`).getTime()
async function seed(page: Page) {
  await page.clock.setFixedTime(new Date(at('08:00')))
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: 'Hallo! ⚓', exact: true })).toBeVisible()
  const s = { ...defaultSettings(date), onboarded: true }
  s.anchor = { ...s.anchor, wake: 420, manual: { wake: true, bed: true, pcStop: true } }
  s.work[0] = { ...s.work[0]!, start: 540, homeOffice: false }
  s.commute.minutes = 20; s.commute.bufferMin = 10; s.travel.activationMin = 10
  s.sport.days = s.sport.days.map(() => false)
  s.routines.morning = [{ id: 'first', title: 'Frühstück', minutes: 10 }, { id: 'second', title: 'Schlüssel nehmen', minutes: 5 }]
  await seedRecords(page, [
    { collection: 'settings', id: 'main', data: s },
    { collection: 'meta', id: 'local', data: emptyLocal() },
    { collection: 'game', id: 'main', data: initialGame(date) },
    { collection: 'days', id: date, data: { date, steps: {}, override: {}, wakeAt: at('07:00') } satisfies DayLog },
  ])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Frühstück', exact: true })).toBeVisible()
}
async function current(page: Page, expected: number[]) {
  await page.goto('/zeiten')
  await expect(page.getByRole('heading', { name: 'Zeitübersicht', exact: true })).toBeVisible()
  await expect.poll(async () => (await storedRecord<TimeCatalogSnapshot>(page, 'meta', 'time-catalog'))?.entries
    .filter(e => e.source.date === date && e.functionId === 'reminder.prepare').map(e => e.at)).toEqual(expected)
  const cache = await storedRecord<TimeCatalogSnapshot>(page, 'meta', 'time-catalog')
  return cache!.entries.filter(e => e.source.date === date && e.functionId === 'reminder.prepare')
}

test('Zeitübersicht folgt offener Vorbereitung und erhält die bewusste nächste Handlung', async ({ page }) => {
  await seed(page)
  const facts = await storedRecord(page, 'days', date), game = await storedRecord(page, 'game', 'main')
  expect(await current(page, [at('08:05')])).toEqual([expect.objectContaining({ at: at('08:05'), category: 'travel', effect: 'notification' })])
  expect(await storedRecord(page, 'days', date)).toEqual(facts)
  expect(await storedRecord(page, 'game', 'main')).toEqual(game)
  await page.goto('/')
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Schlüssel nehmen', exact: true })).toBeVisible()
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', date))?.steps['morning:first']).toBe('done')
  expect(await current(page, [at('08:15')])).toEqual([expect.objectContaining({ at: at('08:15') })])
  await page.goto('/')
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', date))?.steps['morning:second']).toBe('done')
  expect(await current(page, [])).toEqual([])
  expect((await storedRecord<DayLog>(page, 'days', date))?.leftAt).toBeUndefined()
})

test('Kompakte Jetzt-Ansicht bleibt nach dem berechneten Impuls ohne automatische Erledigung bedienbar', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page)
  const facts = await storedRecord(page, 'days', date), game = await storedRecord(page, 'game', 'main')
  await page.clock.setFixedTime(new Date(at('08:06')))
  await page.evaluate(() => { document.body.style.fontSize = '160%'; document.dispatchEvent(new Event('visibilitychange')) })
  await expect(page.getByRole('heading', { name: 'Frühstück', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Erledigt', exact: true })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Abfahrtsbereitschaft', exact: true })).toContainText('noch 24 min')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await storedRecord(page, 'days', date)).toEqual(facts)
  expect(await storedRecord(page, 'game', 'main')).toEqual(game)
  await page.screenshot({ path: info.outputPath('preparation-now-320.png'), fullPage: true })
})

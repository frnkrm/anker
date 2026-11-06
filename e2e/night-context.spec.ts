/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { zonedToUtc } from '../src/core/time'
import type { LocalData, Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'

const date = '2026-11-02'
const nextDate = '2026-11-03'
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
async function at(page: Page, day: string, minute: number) {
  await page.clock.setFixedTime(new Date(zonedToUtc(day, minute)))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
}

for (const kind of ['regular', 'incident'] as const) {
  test(`Echte ${kind}-Nachtschicht bleibt nach 04:00 mit Pause und Ende bedienbar`, async ({ page }) => {
    await at(page, date, 23 * 60 + 40)
    await page.goto('/start')
    await page.getByRole('button', { name: 'Weiter', exact: true }).click()
    await page.getByRole('button', { name: /Passt, los/ }).click()
    await page.goto('/arbeitszeit')
    await page.getByRole('button', { name: kind === 'regular' ? 'Arbeit starten' : 'Kundenproblem jetzt bearbeiten', exact: true }).click()
    await expect.poll(async () => (await local(page))?.workSessions.length).toBe(1)
    const before = await storedRecord<Settings>(page, 'settings', 'main')
    const started = (await local(page))!.workSessions[0]!
    await at(page, nextDate, 270)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: kind === 'regular' ? 'Arbeit läuft' : 'Störung', exact: true })).toBeVisible()
    await expect(page.getByText('Läuft deine Arbeit noch?', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: kind === 'regular' ? 'Pause starten' : 'Pause', exact: true }).click()
    await expect.poll(async () => (await local(page))?.workSessions[0]?.breaks.length).toBe(1)
    await at(page, nextDate, 280)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Pause läuft', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Pause beenden', exact: true }).click()
    await expect.poll(async () => (await local(page))?.workSessions[0]?.breaks[0]?.endAt).toBe(zonedToUtc(nextDate, 280))
    await at(page, nextDate, 300)
    await page.reload()
    await page.getByRole('button', { name: kind === 'regular' ? 'Feierabend' : 'Einsatz beenden', exact: true }).click()
    await expect.poll(async () => (await local(page))?.workSessions[0]?.endAt).toBe(zonedToUtc(nextDate, 300))
    const finished = (await local(page))!.workSessions[0]!
    expect(finished.id).toBe(started.id)
    expect(finished.date).toBe(date)
    expect(finished.startAt).toBe(started.startAt)
    await expect(page.getByRole('heading', { name: /Arbeit läuft|Pause läuft|Störung|Läuft deine Arbeit noch\?/ })).toHaveCount(0)
    expect(await storedRecord<Settings>(page, 'settings', 'main')).toEqual(before)
  })
}

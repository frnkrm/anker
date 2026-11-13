/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultSettings, emptyLocal } from '../src/core/defaults'
import { createCountdown } from '../src/core/focus'
import { initialGame } from '../src/core/game'
import type { LocalData } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const date = '2026-11-13', START = Date.parse(`${date}T10:00:00+01:00`)
const route = '/aufgabe/work/f004'
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
const compare = (page: Page) => page.getByRole('region', { name: 'Zeitvergleich', exact: true })
async function at(page: Page, offset: number) {
  await page.clock.setFixedTime(new Date(START + offset))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}
async function seed(page: Page, learning = false) {
  await page.clock.setFixedTime(new Date(START))
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: 'Hallo! ⚓', exact: true })).toBeVisible()
  const data = { ...emptyLocal(), work: [{ id: 'f004', title: 'Bericht', nextStep: 'Tabelle öffnen', createdAt: START, estimateMin: 30, state: 'active' as const }],
    focus: { id: 'timer', target: { kind: 'work' as const, id: 'f004' }, timer: createCountdown(120, START) },
    ...(learning ? { taskLearning: { enabled: true, samples: [] } } : {}) }
  await seedRecords(page, [
    { collection: 'settings', id: 'main', data: { ...defaultSettings(date), onboarded: true } },
    { collection: 'meta', id: 'local', data },
    { collection: 'game', id: 'main', data: initialGame(date) },
  ])
  await page.goto(route)
  await expect(page.getByRole('heading', { name: 'Tabelle öffnen', exact: true })).toBeVisible()
}

test('Schätzung, Zeitfenster und Timerlaufzeit bleiben über Pause/Reload getrennt; Ablauf erledigt nichts', async ({ page }) => {
  await seed(page)
  const game = await storedRecord(page, 'game', 'main')
  await page.getByText('Details & Abschluss', { exact: true }).click()
  await expect(compare(page)).toBeVisible()
  await expect(compare(page)).toContainText('ca. 30 Minuten')
  await expect(compare(page)).toContainText('2 Minuten')
  await expect(compare(page)).toContainText('Noch nicht bestätigt')
  await page.getByText('Details & Abschluss', { exact: true }).click()
  await at(page, 90_450)
  await expect(page.getByTestId('focus-elapsed')).toContainText('Timerzeit 1:30 ohne Pause')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  await at(page, 3600_000)
  await page.reload()
  await page.getByText('Details & Abschluss', { exact: true }).click()
  await expect(compare(page)).toContainText('1:30 · pausiert')
  await page.getByText('Details & Abschluss', { exact: true }).click()
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('running')
  await at(page, 3600_000 + 40_000)
  await expect(page.getByTestId('focus-elapsed')).toContainText('Timerzeit 2:10 ohne Pause')
  await expect(page.getByRole('timer', { name: 'Restzeit im Fokus', exact: true })).toHaveText('0:00')
  await expect(page.getByRole('button', { name: 'Erledigt', exact: true })).toBeVisible()
  expect((await local(page))?.work[0]?.done).not.toBe(true)
  expect((await local(page))?.taskLearning).toBeUndefined()
  expect(await storedRecord(page, 'game', 'main')).toEqual(game)
})

test('Überzug bleibt nach bewusstem Unterbrechen erhalten und wird nicht als tatsächliche Dauer vorgegeben', async ({ page }) => {
  await seed(page, true)
  await at(page, 180_450)
  await expect(page.getByTestId('focus-elapsed')).toContainText('Timerzeit 3:00 ohne Pause')
  await page.getByRole('button', { name: 'Stopp', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Unterbrochen – Wiedereinstieg merken', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Pause und Wiedereinstieg merken', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(async () => (await local(page))?.focus?.timer.overrunMs).toBe(60_450)
  await at(page, 7200_000)
  await page.reload()
  await expect(page.getByTestId('focus-elapsed')).toContainText('Pausiert · Timerzeit 3:00 ohne Pause')
  await page.getByText('Details & Abschluss', { exact: true }).click()
  await expect(compare(page)).toContainText('3:00 · pausiert')
  await page.getByRole('checkbox', { name: 'Meine tatsächliche Dauer für Schätzvorschläge bestätigen', exact: true }).check()
  const field = page.getByRole('spinbutton', { name: 'Bestätigte tatsächliche Dauer', exact: true })
  await expect(field).toHaveValue('')
  await field.fill('7')
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect.poll(async () => (await local(page))?.taskLearning?.samples.length).toBe(1)
  await expect(compare(page)).toContainText('7 Minuten')
  expect((await local(page))?.taskLearning?.samples[0]?.minutes).toBe(7)
})

test('Zeitvergleich bleibt bei 320px und großer Schrift lesbar, Hauptaktion bleibt erreichbar', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page)
  await page.evaluate(() => { document.documentElement.style.fontSize = '160%'; document.body.style.fontSize = '160%' })
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('f004-main-320.png'), fullPage: true })
  await page.getByText('Details & Abschluss', { exact: true }).click()
  await expect(compare(page)).toBeVisible()
  await expect(compare(page)).toContainText('Noch nicht bestätigt')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('f004-320.png'), fullPage: true })
})

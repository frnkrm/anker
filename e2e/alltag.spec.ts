import { expect, test, type Page } from '@playwright/test'
import { defaultSettings, emptyLocal } from '../src/core/defaults'
import { initialGame } from '../src/core/game'
import { buildDayPlan } from '../src/core/planner'
import { zonedToUtc } from '../src/core/time'
import type { LocalData, Settings } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const date = '2026-11-17'
async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-17T10:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}

test('Suche führt zur markierten Rückkehr-Einstellung und schaltet sie nur durch eigene Wahl ein', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Funktionen und Einstellungen suchen', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Funktion oder Einstellung suchen' }).fill('bin wieder da')
  await page.getByRole('button', { name: /Rückkehr-Erinnerung/ }).click()
  await expect(page).toHaveURL(/\/einstellungen\/erinnerungen#rueckkehr$/)
  await expect(page.locator('#rueckkehr')).toHaveClass(/search-target-highlight/)
  const toggle = page.getByRole('switch', { name: 'Rückkehr-Erinnerung', exact: true })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.reminders.returnCheckAfterMin).toBe(60)
  await page.getByRole('button', { name: 'Info: Rückkehr-Erinnerung', exact: true }).click()
  const info = page.getByRole('dialog', { name: 'Rückkehr-Erinnerung', exact: true })
  await expect(info).toContainText('kein errechneter Rückkehrzeitpunkt')
  await page.keyboard.press('Escape')
  await expect(info).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Info: Rückkehr-Erinnerung', exact: true })).toBeFocused()
})

test('Hobby nur mit Namen anlegen, umbenennen, Vorlage anpassen und nach Neustart wiederfinden', async ({ page }) => {
  await onboard(page)
  await page.goto('/einstellungen/hobbys')
  await page.getByRole('textbox', { name: 'Hobbyname', exact: true }).fill('Fotografieren')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fotografieren', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Foto-Ideen als Vorlage', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.hobbies?.items[0]?.activities?.length).toBe(3)
  await page.getByRole('button', { name: 'Umbenennen', exact: true }).click()
  await page.getByRole('textbox', { name: 'Neuer Hobbyname' }).fill('Meine Fotografie')
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.hobbies?.items[0]?.name).toBe('Meine Fotografie')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Meine Fotografie', exact: true })).toBeVisible()
  await expect(page.getByText('Licht und Schatten ausprobieren', { exact: true })).toBeVisible()
  await page.getByRole('switch', { name: 'Meine Fotografie vorschlagen' }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.hobbies?.items[0]?.paused).toBe(true)
})

test('Hobby-Idee bleibt freiwillig und verschwindet nach Heute lieber Pause', async ({ page }) => {
  await onboard(page)
  const settings = { ...defaultSettings(date), onboarded: true }, plan = buildDayPlan({ date, settings })
  await page.clock.setFixedTime(new Date(zonedToUtc(date, plan.pcStop - 30)))
  const steps = Object.fromEntries(plan.blocks.flatMap(b => (b.steps ?? []).map(step => [`${b.routine}:${step.id}`, 'done'])))
  await seedRecords(page, [
    { collection: 'settings', id: 'main', data: settings },
    { collection: 'meta', id: 'local', data: { ...emptyLocal(), hobbies: { items: [{ id: 'photo', name: 'Fotografieren' }, { id: 'read', name: 'Lesen' }] } } },
    { collection: 'game', id: 'main', data: initialGame(date) },
    { collection: 'days', id: date, data: { date, steps, override: {}, wakeAt: zonedToUtc(date, plan.wake) } },
  ])
  await page.goto('/')
  await expect(page.getByText('Eine freiwillige Idee', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Andere Idee', exact: true }).click()
  await page.getByRole('button', { name: 'Heute lieber Pause', exact: true }).click()
  await expect(page.getByText('Eine freiwillige Idee', { exact: true })).toHaveCount(0)
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.hobbies?.dismissedDate).toBe(date)
  await page.reload()
  await expect(page.getByText('Eine freiwillige Idee', { exact: true })).toHaveCount(0)
})

test('kleines Display: Hilfen und Suche ohne horizontales Scrollen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await onboard(page)
  await page.goto('/wecker#nachtmessung')
  await page.getByRole('button', { name: 'Info: Aktivitäts-Weckfenster', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('keine verlässliche Erkennung')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Funktionen und Einstellungen suchen', exact: true }).click()
  await page.getByRole('searchbox').fill('fotografie')
  await expect(page.getByRole('button', { name: /Hobbys und freiwillige Ideen/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

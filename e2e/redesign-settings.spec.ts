/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { Settings } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

async function onboard(page: Page) {
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
}

test('Alte Einstellungslinks öffnen die gebündelte Abendseite und die richtige Routine', async ({ page }) => {
  await onboard(page)
  for (const [old, canonical, section] of [
    ['/einstellungen/abende', '/einstellungen/abend#plaene', 'plaene'],
    ['/einstellungen/abendmodus', '/einstellungen/abend#modus', 'modus'],
    ['/einstellungen/abenduebergang', '/einstellungen/abend#uebergang', 'uebergang'],
  ]) {
    await page.goto(old!)
    await expect(page).toHaveURL(new RegExp(canonical!.replaceAll('/', '\\/') + '$'))
    await expect(page.locator(`#${section}`)).toBeVisible()
    if (section !== 'uebergang') await expect(page.locator(`#${section}`)).toHaveAttribute('open', '')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  }
  for (const [route, name] of [['morgenroutine', 'Morgenroutine'], ['abendroutine', 'Abendroutine']]) {
    await page.goto(`/einstellungen/${route}`)
    await expect(page).toHaveURL(/\/einstellungen\/routinen#(?:morning|evening)$/)
    await expect(page.getByRole('heading', { name: name!, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  }
})

test('Entfernten Routinen-Schritt zurückholen erhält danach ergänzte Schritte und Originalwerte', async ({ page }) => {
  await onboard(page)
  const before = (await storedRecord<Settings>(page, 'settings', 'main'))!
  const original = { ...before.routines.morning[0]!, title: 'Wasser mit meiner letzten Änderung' }
  await page.goto('/einstellungen/morgenroutine')
  const rows = page.locator('.settings-routine-compact ol > li')
  await expect(rows).toHaveCount(before.routines.morning.length)
  await expect(page.getByRole('textbox', { name: 'Schritt', exact: true })).toHaveCount(0)
  await rows.first().locator('summary').click()
  await rows.first().getByRole('textbox', { name: 'Schritt', exact: true }).fill(original.title)
  await rows.first().getByRole('button', { name: 'Entfernen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.routines.morning.length).toBe(before.routines.morning.length - 1)
  await page.getByRole('button', { name: '+ Schritt hinzufügen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.routines.morning.length).toBe(before.routines.morning.length)
  const added = (await storedRecord<Settings>(page, 'settings', 'main'))!.routines.morning.at(-1)!
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.routines.morning).toEqual([original, ...before.routines.morning.slice(1), added])
  await page.reload()
  const after = (await storedRecord<Settings>(page, 'settings', 'main'))!
  expect(after.routines.morning[0]).toEqual(original)
  expect(after.routines.evening).toEqual(before.routines.evening)
})

test('Werktage werden nur nach bewusstem Zusammenfassen gleich; Wochenende und übrige Einstellungen bleiben erhalten', async ({ page }) => {
  await onboard(page)
  const before = (await storedRecord<Settings>(page, 'settings', 'main'))!
  before.work[4] = { ...before.work[4]!, start: 570, durationMin: 360 }
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: before }])
  await page.goto('/einstellungen/arbeit')
  const same = page.getByRole('switch', { name: 'Alle Werktage gleich', exact: true })
  await expect(same).toHaveAttribute('aria-checked', 'false')
  expect((await storedRecord<Settings>(page, 'settings', 'main'))!.work).toEqual(before.work)
  await same.click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.work).toEqual([...Array.from({ length: 5 }, () => before.work[0]!), ...before.work.slice(5)])
  await expect(page.getByRole('status').filter({ hasText: /^Gespeichert$/ })).toBeVisible()
  expect((await storedRecord<Settings>(page, 'settings', 'main'))!.routines).toEqual(before.routines)
})

test('Entwicklerwerkzeuge bleiben standardmäßig verborgen und ihre bewusste Auswahl übersteht Reload', async ({ page }) => {
  await onboard(page)
  await page.goto('/einstellungen')
  const toggle = page.getByRole('switch', { name: 'Test- und Entwicklerwerkzeuge anzeigen', exact: true })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('link', { name: 'Gemeinsam testen', exact: true })).toHaveCount(0)
  await toggle.click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.appearance.developerTools).toBe(true)
  await page.reload()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('link', { name: 'Gemeinsam testen', exact: true })).toHaveAttribute('href', '/geraetetest')
  await expect(page.getByRole('link', { name: 'Zeitübersicht', exact: true })).toHaveAttribute('href', '/zeiten')
})

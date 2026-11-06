/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { LocalData, Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-02T10:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}

test('Auswahlgruppen unterstützen Pfeile, Anfang und Ende; nur die gewählte Option liegt im Tabweg', async ({ page }) => {
  await onboard(page)
  await page.goto('/einstellungen/hilfen')
  await expect(page.getByRole('heading', { name: 'Alltagshilfen', exact: true })).toBeFocused()
  const group = page.getByRole('radiogroup', { name: 'Fokus-Puls', exact: true })
  const off = group.getByRole('radio', { name: 'Aus', exact: true })
  const gentle = group.getByRole('radio', { name: 'Sanft', exact: true })
  const strong = group.getByRole('radio', { name: 'Deutlich', exact: true })
  await off.focus(); await off.press('ArrowRight')
  await expect(gentle).toBeFocused()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.focus.pulse).toBe('gentle')
  await gentle.press('End')
  await expect(strong).toBeFocused()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.focus.pulse).toBe('strong')
  await strong.press('Home')
  await expect(off).toBeFocused()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.focus.pulse).toBe('off')
  await expect(off).toHaveAttribute('tabindex', '0')
  await expect(gentle).toHaveAttribute('tabindex', '-1')
  await expect(strong).toHaveAttribute('tabindex', '-1')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('switch', { name: 'Ankommen', exact: true })).toBeFocused()
})

test('Routinen bleiben ohne Ziehen tastaturbedienbar und haben ausreichend große Sortiertasten', async ({ page }) => {
  await onboard(page)
  await page.goto('/einstellungen/morgenroutine')
  const before = (await storedRecord<Settings>(page, 'settings', 'main'))!.routines.morning.map((step) => step.id)
  const button = page.getByRole('button', { name: 'Eintrag 2 nach oben', exact: true })
  const box = await button.boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(44)
  expect(box!.height).toBeGreaterThanOrEqual(44)
  await button.focus(); await button.press('Enter')
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.routines.morning[0]?.id).toBe(before[1])
  await expect(page.getByRole('status')).toHaveText('Eintrag von Position 2 auf 1 verschoben.')
})

test('Freiwillige Probe lässt sich per Tastatur starten, zeigt höchstens drei Punkte und löscht nur ihre Antworten', async ({ page }) => {
  await onboard(page)
  const settings = await storedRecord<Settings>(page, 'settings', 'main')
  await page.goto('/tag')
  await page.getByRole('button', { name: 'Freiwillig ausprobieren: Hilft mir Anker?', exact: true }).press('Enter')
  const seven = page.getByRole('button', { name: '7 Tage', exact: true })
  await seven.focus(); await seven.press('Space')
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.trial?.days).toBe(7)
  await page.getByRole('button', { name: 'Ja', exact: true }).press('Enter')
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.trial?.answers['2026-11-02']).toBe('ja')
  await page.clock.setFixedTime(new Date('2026-11-09T10:00:00+01:00'))
  await page.reload()
  const summary = page.getByRole('heading', { name: 'Die Probezeit ist vorbei', exact: true }).locator('..')
  await expect(summary).toBeVisible()
  await expect(summary.getByRole('listitem')).toHaveCount(2)
  await expect(summary).toContainText('1× geholfen, 0× teilweise, 0× nicht geholfen.')
  await expect(summary.getByRole('link', { name: 'Antworten mit einer Sicherung exportieren', exact: true })).toHaveAttribute('href', '/backup')
  await summary.getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.trial).toBeUndefined()
  expect(await storedRecord<Settings>(page, 'settings', 'main')).toEqual(settings)
})

test('Fehlgeschlagenes Kopieren meldet keinen Kopiererfolg', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('nicht erlaubt') } } }) })
  await onboard(page)
  await page.goto('/hilfe')
  await page.getByRole('button', { name: 'Text kopieren', exact: true }).click()
  await expect(page.getByText('Kopieren ist gerade nicht möglich. Du kannst den Text oben selbst auswählen.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kopiert', exact: true })).toHaveCount(0)
})

test('Reduzierte Bewegung gilt auch für Schalter und bewusstes Bearbeiten von Schlafangaben', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await onboard(page)
  await page.goto('/einstellungen/hilfen')
  const toggle = page.getByRole('switch', { name: 'Ankommen', exact: true })
  expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect(await toggle.locator('span').last().evaluate((node) => getComputedStyle(node).transitionDuration)).toBe('0s')
  await page.goto('/schlaf')
  await page.getByRole('button', { name: 'Jetzt aufgestanden', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.sleepDiary['2026-11-01']?.wakeAt).toBeTruthy()
  await page.evaluate(() => {
    const scroll = window.scrollTo.bind(window)
    window.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === 'object') { (window as unknown as { __scrollBehavior: string | undefined }).__scrollBehavior = options.behavior; scroll(options) }
      else scroll(options ?? 0, y ?? 0)
    }
  })
  await page.getByRole('button', { name: 'Nacht 2026-11-01 bearbeiten', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { __scrollBehavior: string | undefined }).__scrollBehavior)).toBe('auto')
})

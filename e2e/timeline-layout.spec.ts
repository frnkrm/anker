import { expect, test } from '@playwright/test'

test('Tageslinie bleibt bei 320 Pixeln und 160 Prozent Schrift vollständig innerhalb des Bildschirms', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00+01:00'))
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/einstellungen/darstellung')
  const size = page.getByRole('spinbutton', { name: 'Schriftgröße', exact: true })
  await size.fill('160'); await size.press('Tab')
  await page.goto('/tag')
  const line = page.getByRole('list', { name: 'Tageslinie', exact: true })
  await expect(line).toContainText('Morgenroutine')
  await expect(line).toContainText('Abendroutine')
  await expect(line.getByText(/^bis \d/).first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  const outside = await line.locator('li span').evaluateAll((spans) => spans.filter((span) => {
    const rect = span.getBoundingClientRect()
    return rect.left < -1 || rect.right > innerWidth + 1 || span.scrollWidth > span.clientWidth + 1
  }).map((span) => span.textContent))
  expect(outside).toEqual([])
})

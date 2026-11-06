import { expect, test } from '@playwright/test'

test('Aufräumtimer zählt Hintergrundzeit und bleibt beim Wiederöffnen erhalten', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T19:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/aufraeumen')
  await page.getByRole('button', { name: '10 Minuten starten' }).click()

  // Die Uhr springt weiter, ohne fünf Minuten Timer-Callbacks auszuführen:
  // so muss die Seite auch nach einer gedrosselten Hintergrundphase reagieren.
  await page.clock.setFixedTime(new Date('2026-11-02T19:05:00+01:00'))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
  await expect(page.getByText('5:00', { exact: true })).toBeVisible()

  await page.goto('/mehr')
  await page.goto('/aufraeumen')
  await expect(page.getByText('5:00', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('5:00', { exact: true })).toBeVisible()

  await page.clock.setFixedTime(new Date('2026-11-02T19:11:00+01:00'))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
  await expect(page.getByText('0:00', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Geschafft!', exact: true }).click()
  await expect(page).toHaveURL(/\/mehr$/)
  await page.goto('/aufraeumen')
  await expect(page.getByRole('button', { name: '10 Minuten starten' })).toBeVisible()
})

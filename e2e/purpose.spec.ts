/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import type { LocalData } from '../src/core/types'
import { storedRecord } from './helpers/storage'

test('Eigener Zielgrund bleibt mit nächstem Schritt an derselben Aufgabe und ändert keinen Abschluss', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-06T10:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/arbeit')
  await page.getByRole('textbox', { name: 'Neue Aufgabe', exact: true }).fill('Unterlagen ordnen')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  const card = page.getByRole('heading', { name: 'Unterlagen ordnen', exact: true }).locator('..')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  if (!await card.getByRole('textbox', { name: 'Mein Grund für die Aufgabe', exact: true }).isVisible()) await card.getByText('Weitere Angaben', { exact: true }).click()
  await card.getByRole('textbox', { name: 'Mein Grund für die Aufgabe', exact: true }).fill('Damit ich morgen leichter anfangen kann')
  await card.getByRole('textbox', { name: 'Nächster Schritt', exact: true }).fill('Eine Unterlage öffnen')
  await card.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.work[0]?.why).toBe('Damit ich morgen leichter anfangen kann')
  await card.getByRole('button', { name: /^Starten/ }).click()
  await expect(page).toHaveURL(/\/aufgabe\/work\//)
  const focus = (await storedRecord<LocalData>(page, 'meta', 'local'))!.focus!
  await page.reload()
  await page.getByText('Details & Abschluss', { exact: true }).click()
  await page.getByRole('button', { name: 'Warum mache ich das?', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('textbox', { name: 'Mein Grund für die Aufgabe', exact: true })).toHaveValue('Damit ich morgen leichter anfangen kann')
  await expect(dialog.getByText('Nächster kleiner Schritt: Eine Unterlage öffnen', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  const local = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  expect(local.focus).toEqual(focus)
  expect(local.work[0]?.done).not.toBe(true)
  expect(local.workSessions).toEqual([])
})

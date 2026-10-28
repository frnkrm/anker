import { expect, test } from '@playwright/test'

// Smoke-Test der Web-Version: Onboarding → Jetzt-Ansicht → Gedanke festhalten → Seiten erreichbar.
test('Onboarding und Hauptwege funktionieren', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/start$/)
  await expect(page.getByRole('heading', { name: /Hallo/ })).toBeVisible()

  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.getByRole('heading', { name: 'Dein Anker' })).toBeVisible()
  await page.getByRole('button', { name: /Seefahrt/ }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()

  // Startseite: genau eine große Aktion + Countdown
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()

  // Gedanken-Inbox
  await page.getByRole('button', { name: 'Gedanken festhalten' }).click()
  await page.getByPlaceholder('Was ist dir gerade eingefallen?').fill('Zahnarzt anrufen')
  await page.getByRole('button', { name: 'Merken' }).click()
  await expect(page.getByText(/Notiert/)).toBeVisible()
  await page.goto('/inbox')
  await expect(page.getByText('Zahnarzt anrufen')).toBeVisible()

  // Weitere Seiten
  for (const [path, heading] of [
    ['/tag', /Heute/],
    ['/spiel', /Seefahrt/],
    ['/einstellungen', 'Einstellungen'],
    ['/hilfe', 'Hilfe & Anlaufstellen'],
    ['/check', 'Einrichtungs-Check'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
  }

  // Daten bleiben nach Neuladen erhalten (IndexedDB)
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
})

test('Fokus-Modus zeigt immer nur einen Schritt', async ({ page }) => {
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await page.goto('/fokus/evening')
  await expect(page.getByText(/Schritt 1 von \d/)).toBeVisible()
  await page.getByRole('button', { name: 'Erledigt' }).click()
  await expect(page.getByText(/Schritt 2 von \d/)).toBeVisible()
})

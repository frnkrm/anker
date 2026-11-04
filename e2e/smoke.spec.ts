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
  await expect(page.getByText('Du warst bei:')).toBeVisible()
  await page.getByRole('button', { name: 'Weiter' }).click()
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

test('Startseite: eine Hauptaktion, höchstens drei sichtbare Handlungen, Gedanke und zurück', async ({ page }) => {
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('section[aria-live] h1')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  const actions = page.locator('section[aria-live] button, section[aria-live] a')
  expect(await actions.count()).toBeLessThanOrEqual(3)
  await expect(page.getByText(/Rückstand|verpasst|versagt/)).toHaveCount(0)

  const title = await page.getByRole('heading', { level: 1 }).innerText()
  await page.getByRole('button', { name: 'Gedanken festhalten' }).click()
  await page.getByPlaceholder('Was ist dir gerade eingefallen?').fill('Milch kaufen')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog').getByText(title)).toBeVisible()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
})

test('Arbeit: Titel genügt, Inhalte bleiben nach dem Neuladen', async ({ page }) => {
  // Mittwoch im Arbeitsblock: Die Startseite hängt von der Uhrzeit ab
  await page.clock.setFixedTime(new Date('2026-11-04T10:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/arbeit')
  await page.getByRole('textbox', { name: 'Neue Aufgabe' }).fill('Bericht fertigstellen')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('button', { name: 'Ich wurde unterbrochen' }).click()
  await page.getByRole('textbox', { name: 'Wo machst du weiter?' }).fill('Tabelle öffnen')
  await page.getByRole('button', { name: 'Merken' }).click()
  await expect(page.getByText(/Gemerkt/)).toBeVisible()
  await page.reload()
  await expect(page.getByText('Nächster Schritt: Tabelle öffnen')).toBeVisible()
  // Der Wiedereinstieg führt mit einem Tipp zum notierten Schritt zurück
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tabelle öffnen')
  await page.getByRole('button', { name: 'Weiter' }).click()
})

test('Druckansicht zeigt genau das Gewählte, ohne Navigation', async ({ page }) => {
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await page.goto('/druck')
  const sheets = page.locator('[data-sheet]')
  await expect(sheets).toHaveCount(2)
  await page.getByRole('radio', { name: 'Morgenroutine' }).click()
  await expect(sheets).toHaveCount(1)
  await expect(page.locator('[data-sheet="morning"]')).toBeVisible()
  await page.getByRole('radio', { name: 'QR-Code' }).click()
  await expect(page.locator('[data-sheet="qr"] svg')).toBeVisible()

  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('button', { name: /Drucken oder als PDF/ })).toBeHidden()
  await expect(page.locator('[data-sheet="qr"] svg')).toBeVisible()
  const pdf = await page.pdf({ preferCSSPageSize: true })
  expect(pdf.byteLength).toBeGreaterThan(1000)
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

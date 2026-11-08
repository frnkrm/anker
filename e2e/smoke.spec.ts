import { expect, test, type Page } from '@playwright/test'
import type { DayLog, GameState, LocalData, Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'
import { openTodayAdjust } from './helpers/controls'

async function changeToday(page: Page) {
  const direct = page.getByRole('button', { name: 'Heute anders', exact: true })
  if (await direct.isVisible()) { await direct.click(); return }
  const adjust = await openTodayAdjust(page)
  await adjust.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await adjust.getByRole('button', { name: 'Heute anders', exact: true }).click()
}

async function captureThought(page: Page) {
  const adjust = await openTodayAdjust(page)
  await adjust.getByRole('button', { name: 'Gedanke festhalten', exact: true }).click()
}


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
  await captureThought(page)
  await page.getByPlaceholder('Was ist dir gerade eingefallen?').fill('Zahnarzt anrufen')
  await page.getByRole('button', { name: 'Merken' }).click()
  await expect(page.getByText('Du warst bei:')).toBeVisible()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.goto('/inbox')
  await expect(page.getByText('Zahnarzt anrufen')).toBeVisible()

  // Weitere Seiten
  for (const [path, heading] of [
    ['/tag', /Heute/],
    ['/spiel', /Spiel & Belohnungen/],
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
  const actions = page.locator('section[aria-live] .now-buttons button, section[aria-live] .now-buttons a')
  expect(await actions.count()).toBeLessThanOrEqual(3)
  await expect(page.getByText(/Rückstand|verpasst|versagt/)).toHaveCount(0)

  const title = await page.getByRole('heading', { level: 1 }).innerText()
  await captureThought(page)
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
  await page.getByRole('button', { name: /^Starten/ }).click()
  await expect(page).toHaveURL(/\/aufgabe\/work\//)
  await page.goto('/arbeit')
  await page.getByRole('button', { name: 'Ich wurde unterbrochen' }).click()
  await page.getByRole('textbox', { name: 'Wo machst du weiter?' }).fill('Tabelle öffnen')
  await page.getByRole('button', { name: 'Merken' }).click()
  await expect(page.getByText(/Gemerkt/)).toBeVisible()
  await page.reload()
  await expect(page.getByText('Nächster Schritt: Tabelle öffnen')).toBeVisible()
  // Der Wiedereinstieg führt mit einem Tipp zum notierten Schritt zurück
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tabelle öffnen')
  await page.getByRole('button', { name: 'Dort weitermachen', exact: true }).click()
  await expect(page).toHaveURL(/\/aufgabe\/work\//)
  await expect(page.getByRole('heading', { name: 'Tabelle öffnen', exact: true })).toBeVisible()
})

test('Heute anders: Termin, Routine wartet, Spiel ohne falsches Erledigt, Rückgängig', async ({ page }) => {
  // Montag im Homeoffice-Fall des Auftrags: heute 17 Uhr Film, Ende offen
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)

  const adjust = await openTodayAdjust(page)
  await adjust.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await adjust.getByRole('button', { name: 'Homeoffice und Abendplan', exact: true }).click()
  await page.getByRole('radio', { name: 'Ja' }).click()
  await expect(page.getByRole('region', { name: 'Homeoffice-Kontakt', exact: true })).toContainText('sendet nichts automatisch')
  await page.getByRole('button', { name: 'Fertig' }).click()
  const beforeSteps = (await storedRecord<DayLog>(page, 'days', '2026-11-02'))?.steps ?? {}
  const beforeXp = (await storedRecord<GameState>(page, 'game', 'main'))?.xp ?? 0

  await changeToday(page)
  await page.getByRole('button', { name: /etwas anderes vor/ }).click()
  await page.getByRole('textbox', { name: 'Was hast du vor?' }).fill('Film bei einer Freundin ab 17 Uhr')
  await page.getByRole('button', { name: 'Weg & Details', exact: true }).click()
  await page.getByRole('radio', { name: 'Vor Ort', exact: true }).click()
  await page.getByRole('textbox', { name: 'Ort' }).fill('Bei Lena')
  // Vorschau zuerst: Anfahrt unklar wird benannt, nichts wird erfunden
  const preview = page.getByRole('dialog')
  await expect(preview.getByRole('textbox', { name: 'Was hast du vor?', exact: true })).toHaveValue('Film bei einer Freundin ab 17 Uhr')
  await expect(preview).toContainText('02.11.')
  await expect(preview).toContainText('17:00')
  await expect(preview).toContainText('Ende offen')
  await expect(preview.getByRole('textbox', { name: 'Ort', exact: true })).toHaveValue('Bei Lena')
  await expect(page.getByRole('spinbutton', { name: 'Fahrzeit in Minuten' })).toHaveValue('')
  await page.getByRole('spinbutton', { name: 'Fahrzeit in Minuten' }).fill('20')
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.commitments ?? []).toEqual([])
  expect((await storedRecord<DayLog>(page, 'days', '2026-11-02'))?.steps ?? {}).toEqual(beforeSteps)
  expect((await storedRecord<GameState>(page, 'game', 'main'))?.xp ?? 0).toBe(beforeXp)
  await page.getByRole('button', { name: 'So übernehmen' }).click()
  await expect(page.getByText(/^Eingeplant\./)).toBeVisible()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.commitments.length).toBe(1)
  const commitment = (await storedRecord<LocalData>(page, 'meta', 'local'))?.commitments[0]
  expect(commitment).toMatchObject({ date: '2026-11-02', start: 17 * 60, placeLabel: 'Bei Lena', travelMin: 20 })
  expect(commitment?.end).toBeUndefined()
  expect((await storedRecord<DayLog>(page, 'days', '2026-11-02'))?.steps ?? {}).toEqual(beforeSteps)
  expect((await storedRecord<GameState>(page, 'game', 'main'))?.xp ?? 0).toBe(beforeXp)

  await page.goto('/tag')
  await expect(page.getByText('Zuhause → Bei Lena', { exact: false }).first()).toBeVisible()
  await expect(page.getByText(/los um 16:30/)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Tageslinie' }).getByRole('listitem').filter({ hasText: 'Abendroutine' })).toHaveCount(0)
  await expect(page.getByText(/verpasst|versagt|Rückstand/)).toHaveCount(0)

  await changeToday(page)
  await page.getByRole('dialog').getByText('Weitere Möglichkeiten', { exact: true }).click()
  await page.getByRole('button', { name: 'Zurück zum ursprünglichen Plan' }).click()
  await expect(page.getByRole('list', { name: 'Tageslinie' }).getByRole('listitem').filter({ hasText: 'Abendroutine' })).toHaveCount(1)
  await page.reload()
  await expect(page.getByText(/los um 16:30/)).toHaveCount(0)
})

test('Länger wach: Folgen stehen sachlich da, Plan rückt mit', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T20:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await changeToday(page)
  await page.getByRole('dialog').getByText('Weitere Möglichkeiten', { exact: true }).click()
  await page.getByRole('button', { name: 'Länger wach bleiben' }).click()
  await page.getByRole('button', { name: 'Weiß ich noch nicht' }).click()
  await expect(page.getByText(/geplante Weckzeit morgen um .* bleibt unverändert/)).toBeVisible()
  await page.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(page.getByText(/Der Abend gehört dir/)).toBeVisible()
  await expect(page.getByText(/PC-Stopp \d/)).toHaveCount(0)
})

test('Druckansicht zeigt genau das Gewählte, ohne Navigation', async ({ page }) => {
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
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
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/fokus/evening')
  await expect(page.getByText(/Schritt 1 von \d/)).toBeVisible()
  await page.getByRole('button', { name: 'Erledigt' }).click()
  await expect(page.getByText(/Schritt 2 von \d/)).toBeVisible()
})

async function onboard(page: import('@playwright/test').Page) {
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}

test('Gleitzeit: Start, längere Pause, Feierabend übersteht Neuladen und zählt nichts doppelt', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T08:00:00+01:00'))
  await onboard(page)
  await page.goto('/arbeitszeit')
  const bar = page.getByRole('complementary', { name: 'Arbeitszeit im Überblick', exact: true })
  const details = page.getByRole('region', { name: 'Arbeitszeit', exact: true })
  await bar.getByRole('button', { name: 'Arbeit starten' }).click()
  await expect(details).toContainText('Feierabend etwa')
  await expect(details).toContainText('17:00')
  await expect(bar.getByRole('button', { name: 'Arbeit starten' })).toHaveCount(0)
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.workSessions.length).toBe(1)
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00+01:00'))
  await page.reload()
  await bar.getByRole('button', { name: 'Pause starten' }).click()
  await expect(bar).toContainText('Arbeitspause')
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.workSessions[0]?.breaks.length).toBe(1)
  await page.clock.setFixedTime(new Date('2026-11-02T13:30:00+01:00'))
  await page.reload()
  await expect(details).toContainText('Feierabend frühestens')
  await expect(details).toContainText('17:30')
  await bar.getByRole('button', { name: 'Pause beenden' }).click()
  await expect(details).toContainText('Feierabend etwa')
  await expect(details).toContainText('17:30')
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.workSessions[0]?.breaks[0]?.endAt).toBe(new Date('2026-11-02T13:30:00+01:00').getTime())
  await page.clock.setFixedTime(new Date('2026-11-02T18:00:00+01:00'))
  await page.reload()
  await expect(details.getByText('8 h 30 min', { exact: true })).toBeVisible()
  await bar.getByRole('button', { name: 'Feierabend' }).click()
  await expect(details).toContainText('30 min zusätzlich gearbeitet')
  await expect(page.getByText(/Überstunde|€|verpasst|versagt/)).toHaveCount(0)
})

test('Nichts erfasst: nachtragen ist möglich, korrigieren lässt sich zurücknehmen', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T19:00:00+01:00'))
  await onboard(page)
  await page.goto('/arbeitszeit')
  await expect(page.getByText(/Nichts erfasst/)).toBeVisible()
  await page.getByText('Nachtragen', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Nachtragen von' }).fill('08:15')
  await page.getByRole('textbox', { name: 'Nachtragen bis' }).fill('17:30')
  await page.getByRole('checkbox', { name: 'Mit Pause' }).check()
  await page.getByRole('textbox', { name: 'Pause von (Nachtrag)' }).fill('12:15')
  await page.getByRole('textbox', { name: 'Pause bis (Nachtrag)' }).fill('13:30')
  await page.getByRole('button', { name: 'Eintragen' }).click()
  await expect(page.getByText('8 h', { exact: true })).toBeVisible()
  await expect(page.getByText('Genau wie geplant.', { exact: true })).toBeVisible()
  await page.locator('summary').filter({ hasText: /^Arbeit\s*\d/ }).first().click()
  await page.getByRole('button', { name: 'Eintrag löschen' }).click()
  await expect(page.getByText(/Nichts erfasst/)).toBeVisible()
  await page.getByRole('button', { name: 'Letzte Korrektur rückgängig' }).click()
  await expect(page.getByText('Genau wie geplant.', { exact: true })).toBeVisible()
})

test('Sonntagseinsatz: geplant, gestartet, beendet, der Tag bleibt frei', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-08T09:00:00+01:00'))
  await onboard(page)
  await page.goto('/arbeitszeit')
  await page.getByText('Einsätze planen und erfassen', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Worum geht es?' }).fill('Update einspielen')
  await page.getByLabel('Beginn des Einsatzes').fill('09:30')
  await expect(page.getByText(/betriebliche Regelung/)).toBeVisible()
  await page.getByRole('button', { name: 'Einplanen' }).click()
  await expect(page.getByText(/Eingeplant/)).toBeVisible()

  await page.clock.setFixedTime(new Date('2026-11-08T09:20:00+01:00'))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Heute anpassen: Tagesart und Modus', exact: true })).toContainText('Frei')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Update einspielen')
  await page.getByRole('button', { name: 'Einsatz starten' }).click()
  await expect(page.getByText(/Läuft seit 09:20/)).toBeVisible()
  const startAt = Date.parse('2026-11-08T09:20:00+01:00')
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.workSessions.find(session => session.label === 'Update einspielen')?.startAt).toBe(startAt)
  const started = (await storedRecord<LocalData>(page, 'meta', 'local'))!.workSessions.find(session => session.label === 'Update einspielen')!
  expect(started.commitmentId).toBeTruthy()
  await page.clock.setFixedTime(new Date('2026-11-08T09:35:00+01:00'))
  await page.reload()
  await page.getByRole('button', { name: 'Einsatz beenden' }).click()
  // Die Klickzustellung und 15 projizierte Minuten beweisen noch keinen abgeschlossenen Write.
  // Vor dem harten Dokumentwechsel müssen Sitzung und Remote-Termin gemeinsam persistiert sein.
  const endAt = Date.parse('2026-11-08T09:35:00+01:00')
  await expect.poll(async () => {
    const local = await storedRecord<LocalData>(page, 'meta', 'local')
    const session = local?.workSessions.find(item => item.id === started.id)
    const commitment = local?.commitments.find(item => item.id === started.commitmentId)
    return { startAt: session?.startAt, endAt: session?.endAt, backAt: commitment?.backAt }
  }).toEqual({ startAt, endAt, backAt: endAt })
  await page.goto('/arbeitszeit')
  await expect(page.getByRole('complementary', { name: 'Arbeitszeit im Überblick' })).toContainText('15 min erfasst')
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Update einspielen')
  await expect(page.getByRole('button', { name: 'Heute anpassen: Tagesart und Modus', exact: true })).toContainText('Frei')
})

test('Heute anders: später anfangen, Freitag einstellen, Standard bleibt', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-06T06:30:00+01:00'))
  await onboard(page)
  await page.goto('/einstellungen/arbeit')
  await expect(page.getByLabel('Spätester Arbeitsbeginn')).toHaveValue('09:00')
  await expect(page.getByText('Eine Grenze, kein Ziel. Termine können früher beginnen.', { exact: true })).toBeVisible()
  const flex = page.getByRole('heading', { name: 'Gleitzeit', exact: true }).locator('..')
  await flex.getByText('Mehr erfahren', { exact: true }).click()
  await expect(flex).toContainText('Bezahlung und Ausgleich regelt dein Arbeitgeber.')

  await page.goto('/')
  await changeToday(page)
  await page.getByRole('button', { name: 'Arbeit heute anders' }).click()
  await page.getByLabel('Arbeitsbeginn heute').fill('09:15')
  await expect(page.getByText(/nach deiner Grenze 09:00/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nachricht kopieren' })).toBeVisible()
  await page.getByLabel('Arbeitsbeginn heute').fill('08:45')
  await expect(page.getByText(/nach deiner Grenze 09:00/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(page.getByText(/Arbeitsbeginn 08:45/)).toBeVisible()
  await page.goto('/einstellungen/arbeit')
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.work[4]?.start).toBe(8 * 60)
})

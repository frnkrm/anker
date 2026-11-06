/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { migrateSettings } from '../src/core/defaults'
import type { LocalData, Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-05T18:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function settings(page: Page): Promise<{ pcStop: number; bed: number; commute: { minutes: number }; sleep: { needMin: number }; anchor: { wake: number; manual: { wake?: boolean; pcStop?: boolean; bed?: boolean } } }> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('anker')
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const read = db.transaction('records').objectStore('records').get(['settings', 'main'])
      read.onsuccess = () => { resolve(read.result.data); db.close() }
      read.onerror = () => { reject(read.error); db.close() }
    }
  }))
}

test('Testseite beginnt offen und speichert ausschließlich bewusst berichtete Browserergebnisse', async ({ page }) => {
  await onboard(page)
  await page.goto('/mehr')
  await page.getByRole('link', { name: /Gemeinsam testen/ }).click()
  await expect(page.getByText(/0 von 95 im Browser/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Separaten Test in 10 Sekunden starten', exact: true })).toHaveCount(0)
  await page.getByLabel('Test auswählen', { exact: true }).selectOption('3')
  await expect(page.getByRole('heading', { name: 'Test 3 · Wecker', exact: true })).toBeVisible()
  await page.getByLabel('Testbeobachtung').fill('Plan angesehen, Ton am Handy noch offen')
  await page.getByRole('button', { name: 'Teilweise', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Deine Rückmeldung wurde gespeichert: Teilweise.')
  await expect(page.getByText(/0 von 95 im Browser/)).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Testbeobachtung')).toHaveValue('Plan angesehen, Ton am Handy noch offen')
  await expect(page.getByText(/Dein Browserbericht: Teilweise/)).toBeVisible()
  await page.getByRole('button', { name: '✓ Hat geklappt', exact: true }).click()
  await expect(page.getByText(/1 von 95 im Browser/)).toBeVisible()
  await expect(page.getByText(/Dieser Versuch braucht ein echtes Android-Gerät/)).toBeVisible()
  await page.getByRole('button', { name: 'Diesen Test wieder öffnen', exact: true }).click()
  await expect(page.getByText(/0 von 95 im Browser/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/Dein Browserbericht/)).toHaveCount(0)
})

test('Test begleitet direkt zur Einstellung und zurück, ohne selbst eine Zeit umzustellen', async ({ page }) => {
  await onboard(page)
  const before = await settings(page)
  await page.goto('/geraetetest?fall=62')
  await page.getByLabel('Testbeobachtung').fill('Meine Notiz vor dem Einstellungswechsel')
  await page.getByLabel('Testgerät').fill('Eigenes Testgerät')
  await page.getByRole('button', { name: 'Uhrzeiten direkt ändern', exact: true }).click()
  await expect(page).toHaveURL(/\/einstellungen\/schlaf$/)
  await expect(page.getByRole('link', { name: 'Zurück zu Test 62', exact: true })).toBeVisible()
  expect(await settings(page)).toEqual(before)
  await page.getByRole('link', { name: 'Zurück zu Test 62', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Test 62 ·/ })).toBeVisible()
  await expect(page.getByLabel('Testbeobachtung')).toHaveValue('Meine Notiz vor dem Einstellungswechsel')
  await expect(page.getByLabel('Testgerät')).toHaveValue('Eigenes Testgerät')
  await expect(page.getByText(/0 von 95 im Browser/)).toBeVisible()
  await page.getByRole('button', { name: 'Testbegleitung pausieren', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Testbegleitung pausiert. Deine Ergebnisse bleiben gespeichert.')
  await page.goto('/einstellungen/schlaf')
  await expect(page.getByRole('complementary', { name: 'Testbegleitung' })).toHaveCount(0)
})

test('Direkte Uhrzeiten bleiben geschützt; nach Mitternacht bleibt die Nachtzuordnung erhalten', async ({ page }) => {
  await onboard(page)
  await page.goto('/einstellungen/schlaf')
  await page.getByLabel('PC-Stopp', { exact: true }).fill('20:00')
  await page.getByLabel('Bettzeit', { exact: true }).fill('00:30')
  await page.getByLabel('Aufstehzeit', { exact: true }).fill('07:40')
  await expect.poll(async () => (await settings(page)).bed).toBe(1470)
  await page.reload()
  await expect(page.getByLabel('PC-Stopp', { exact: true })).toHaveValue('20:00')
  await expect(page.getByLabel('Bettzeit', { exact: true })).toHaveValue('00:30')
  await expect(page.getByLabel('Aufstehzeit', { exact: true })).toHaveValue('07:40')
  await page.goto('/einstellungen/weg')
  await page.getByRole('spinbutton', { name: 'Fahrzeit', exact: true }).fill('45')
  await page.getByRole('spinbutton', { name: 'Fahrzeit', exact: true }).press('Tab')
  await page.goto('/einstellungen/schlaf')
  const saved = await settings(page)
  expect(saved).toMatchObject({ pcStop: 1200, bed: 1470, anchor: { wake: 460, manual: { pcStop: true, bed: true, wake: true } } })
  await page.getByLabel('Aufstehzeit', { exact: true }).fill('00:00')
  await page.getByRole('button', { name: 'Aufstehzeit früher', exact: true }).click()
  await expect(page.getByLabel('Aufstehzeit', { exact: true })).toHaveValue('23:55')
  await page.getByRole('button', { name: 'Aufstehzeit später', exact: true }).click()
  await expect.poll(async () => (await settings(page)).anchor.wake).toBe(0)
})

test('Dauern lassen sich direkt ändern, leeres Tippen speichert keine Null und Grenzen gelten weiter', async ({ page }) => {
  await onboard(page)
  await page.goto('/einstellungen/weg')
  const duration = page.getByRole('spinbutton', { name: 'Fahrzeit', exact: true })
  await duration.fill('47'); await duration.press('Tab')
  await expect.poll(async () => (await settings(page)).commute.minutes).toBe(47)
  await page.reload(); await expect(duration).toHaveValue('47')
  await duration.fill(''); await duration.press('Tab')
  await page.reload(); await expect(duration).toHaveValue('47')
  await duration.fill('999'); await duration.press('Tab')
  await expect(duration).toHaveValue('180')
  await page.goto('/einstellungen/schlaf')
  const need = page.getByRole('spinbutton', { name: 'Schlafbedarf', exact: true })
  await need.fill('7.75'); await need.press('Enter')
  await expect.poll(async () => (await settings(page)).sleep.needMin).toBe(465)
  await page.reload(); await expect(need).toHaveValue('7.75')
})

test('Testauswahl zeigt neue Weckfensterpunkte und nicht relevant zählt nicht als Erfolg', async ({ page }) => {
  await onboard(page)
  await page.goto('/geraetetest')
  await page.getByText('Einzelne Bereiche prüfen', { exact: true }).click()
  await page.getByRole('button', { name: 'Weckfenster prüfen', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Test 53 ·/ })).toBeVisible()
  await page.getByRole('button', { name: 'Für mich nicht relevant', exact: true }).click()
  await expect(page.getByText(/0 von 95 im Browser/)).toBeVisible()
  await page.getByRole('button', { name: 'Nächster Test', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Test 54 ·/ })).toBeVisible()
})

test('Zeiteingabe und Testseite bleiben bei schmalem Bildschirm und großer Schrift erreichbar', async ({ page }) => {
  await onboard(page)
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/einstellungen/darstellung')
  const size = page.getByRole('spinbutton', { name: 'Schriftgröße', exact: true })
  await size.fill('160'); await size.press('Tab')
  for (const route of ['/einstellungen/schlaf', '/geraetetest?fall=62']) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  }
})

test('Nachtzeiten aus der Ersteinrichtung bleiben beim späteren Neuberechnen geschützt', async ({ page }) => {
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByLabel('Aufstehen (jeden Tag)', { exact: true }).fill('08:00')
  await page.getByLabel('PC-Stopp', { exact: true }).fill('23:55')
  await page.getByRole('button', { name: 'PC-Stopp später', exact: true }).click()
  await page.getByLabel('Bett', { exact: true }).fill('00:30')
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await settings(page)).bed).toBe(1470)
  await page.goto('/einstellungen/weg')
  await page.getByRole('button', { name: 'Fahrzeit erhöhen', exact: true }).click()
  await page.reload()
  expect(await settings(page)).toMatchObject({ pcStop: 1440, bed: 1470, anchor: { wake: 480, manual: { pcStop: true, bed: true, wake: true } } })
})

test('Bereichsfilter steuert auch den sichtbaren Versuch und die Navigation bis zur leeren Auswahl', async ({ page }) => {
  await onboard(page)
  await page.goto('/geraetetest')
  await page.getByLabel('Testbereich', { exact: true }).selectOption('Befund Vollbild (05.11.2026)')
  await expect(page.getByRole('heading', { name: /Test 47 ·/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vorheriger Test', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '✓ Hat geklappt', exact: true }).click()
  await page.getByRole('button', { name: 'Nächster Test', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Test 48 ·/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nächster Test', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '✓ Hat geklappt', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Nur noch nicht bestandene Tests' }).check()
  await expect(page.getByText(/In dieser Auswahl ist gerade nichts offen/)).toBeVisible()
  await expect(page.getByRole('heading', { name: /Test \d+ ·/ })).toHaveCount(0)
})

test('Export enthält nur bewusste Testberichte und deren Codestand', async ({ page }) => {
  await onboard(page)
  await page.goto('/geraetetest?fall=62')
  await page.getByLabel('Testbeobachtung').fill('Direkte Eingabe ausprobiert')
  await page.getByRole('button', { name: 'Teilweise', exact: true }).click()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Testberichte als Datei exportieren', exact: true }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('anker-testberichte.json')
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(Object.keys(exported).sort()).toEqual(['app', 'exportedAt', 'reports'])
  expect(Object.keys(exported.reports)).toEqual(['62'])
  expect(exported.reports['62']).toMatchObject({ result: 'partial', note: 'Direkte Eingabe ausprobiert', platform: 'web' })
  expect(exported.reports['62'].buildFingerprint).toMatch(/^[a-f\d]{64}$/)
})

test('E02-Prüfwege führen zu Erinnerungen und Papier und bleiben bis zur Rückmeldung offen', async ({ page }) => {
  await onboard(page)
  await page.goto('/geraetetest')
  await page.getByText('Einzelne Bereiche prüfen', { exact: true }).click()
  await page.getByRole('button', { name: 'Erinnerungen & Druck prüfen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Test 66 · E02: Erinnerungen und Papier', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Erinnerungen einstellen', exact: true }).click()
  await expect(page).toHaveURL(/\/einstellungen\/erinnerungen$/)
  await page.getByRole('link', { name: 'Zurück zu Test 66', exact: true }).click()
  await expect(page.getByText(/0 von 95 im Browser/)).toBeVisible()
  await page.getByLabel('Test auswählen', { exact: true }).selectOption('73')
  await expect(page.getByRole('heading', { name: 'Test 73 · E02: Erinnerungen und Papier', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Druckauswahl öffnen', exact: true }).click()
  await expect(page).toHaveURL(/\/druck$/)
  await page.getByRole('link', { name: 'Zurück zu Test 73', exact: true }).click()
  await expect(page.getByText(/0 von 95 im Browser/)).toBeVisible()
})

test('Systemleistenprüfung führt zu Jetzt, Fokus und Eingabe; Browseransichten bleiben ohne Gerätehaken', async ({ page }) => {
  await onboard(page)
  const before = await storedRecord<Settings>(page, 'settings', 'main')
  expect(before).toBeDefined()
  // Ein erneutes Laden ergänzt regulär die bisher fehlenden manuellen Zeitflags.
  const expectedSettings = migrateSettings(before!, '2026-11-05')
  // Prüft ausgelieferte Seiten und den nutzbaren Browserbereich, keine Android-WindowInsets oder echte Tastatur.
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=contain/)
  await page.goto('/geraetetest')
  await page.getByText('Einzelne Bereiche prüfen', { exact: true }).click()
  await page.getByRole('button', { name: 'Systemleisten prüfen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Test 75 · Android-Systemleisten', exact: true })).toBeVisible()
  await expect(page.getByText('Dieser Versuch braucht ein echtes Android-Gerät. Ein Ergebnis im Browser bestätigt ihn dafür nicht.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Druckauswahl öffnen', exact: true })).toHaveCount(0)

  const headerBelowBanner = async () => {
    await page.evaluate(() => window.scrollTo(0, 0))
    const banner = page.getByRole('complementary', { name: 'Testbegleitung' })
    await expect(banner).toBeVisible()
    await expect(page.locator('main header').first()).toBeVisible()
    const bounds = await page.evaluate(() => {
      const banner = document.querySelector('aside[aria-label="Testbegleitung"]')!.getBoundingClientRect()
      const header = document.querySelector('main header')!.getBoundingClientRect()
      return { top: banner.top, left: banner.left, right: banner.right, bannerBottom: banner.bottom, headerTop: header.top, headerBottom: header.bottom, width: innerWidth, height: innerHeight }
    })
    expect(bounds.top).toBeGreaterThanOrEqual(0)
    expect(bounds.left).toBeGreaterThanOrEqual(0)
    expect(bounds.right).toBeLessThanOrEqual(bounds.width)
    expect(bounds.headerTop).toBeGreaterThanOrEqual(bounds.bannerBottom)
    expect(bounds.headerBottom).toBeLessThanOrEqual(bounds.height)
  }

  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await page.getByRole('button', { name: 'Jetzt mit Testbegleitung öffnen', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await headerBelowBanner()
    const navigation = await page.getByRole('navigation', { name: 'Hauptnavigation' }).boundingBox()
    expect(navigation).not.toBeNull()
    expect(navigation!.y + navigation!.height).toBeLessThanOrEqual(viewport.height)
    await page.getByRole('link', { name: 'Zurück zu Test 75', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Test 75 · Android-Systemleisten', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Aufgabe für eigene Fokusprüfung wählen', exact: true }).click()
    await expect(page).toHaveURL(/\/arbeit$/)
    await headerBelowBanner()
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()
    await page.getByRole('link', { name: 'Zurück zu Test 75', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Test 75 · Android-Systemleisten', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Schrift & Tastatur prüfen', exact: true }).click()
    await expect(page).toHaveURL(/\/einstellungen\/darstellung$/)
    const input = page.getByRole('spinbutton', { name: 'Schriftgröße', exact: true })
    await expect(input).toBeEditable()
    await input.focus()
    await expect(input).toBeFocused()
    await page.getByRole('link', { name: 'Zurück zu Test 75', exact: true }).click()
    await expect(page.getByText(/0 von 95 im Browser/)).toBeVisible()
    await expect(page.getByText(/Dein Browserbericht:/)).toHaveCount(0)
  }
  await expect.poll(() => storedRecord<Settings>(page, 'settings', 'main')).toEqual(expectedSettings)
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.deviceTests?.reports[75]).toBeUndefined()
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.focus).toBeUndefined()
})

test('E03-Testlinks öffnen passende Bereiche ohne Timer, Aufgabenänderung oder automatische Berichte', async ({ page }) => {
  await onboard(page)
  const beforeSettings = await storedRecord<Settings>(page, 'settings', 'main')
  const before = await storedRecord<LocalData>(page, 'meta', 'local')
  await page.goto('/geraetetest')
  await page.getByText('Einzelne Bereiche prüfen', { exact: true }).click()
  await page.getByRole('button', { name: 'Aufgaben & Wiedereinstieg prüfen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Test 76 · E03: Aufgaben und Wiedereinstieg', exact: true })).toBeVisible()
  await expect(page.getByLabel('Testbereich', { exact: true })).toHaveValue('E03: Aufgaben und Wiedereinstieg')
  await expect(page.getByRole('button', { name: 'Vorheriger Test', exact: true })).toBeDisabled()
  const destinations: [number, string, RegExp][] = [
    [76, 'Aufgabe zum Fokus wählen', /\/arbeit$/],
    [77, 'Gedanken bewusst einplanen', /\/inbox$/],
    [78, 'Arbeitsaufgabe und Schritte öffnen', /\/arbeit$/],
    [79, 'Aufgabe für Fokus wählen', /\/arbeit$/],
    [80, 'Starthilfe auf Jetzt prüfen', /\/$/],
    [81, 'Wiedereinstieg auf Jetzt öffnen', /\/$/],
    [82, 'Tagesplan und Zeitfenster öffnen', /\/tag$/],
    [83, 'Eigene Zeitschätzungen öffnen', /\/arbeit$/],
    [84, 'Sicherung öffnen', /\/backup$/],
    [85, 'Aktuellen Stand auf Jetzt ansehen', /\/$/],
  ]
  for (const [id, label, destination] of destinations) {
    await page.getByLabel('Test auswählen', { exact: true }).selectOption(String(id))
    await expect(page.getByRole('heading', { name: `Test ${id} · E03: Aufgaben und Wiedereinstieg`, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Druckauswahl öffnen', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Separaten Test in 10 Sekunden starten', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page).toHaveURL(destination)
    await page.getByRole('link', { name: `Zurück zu Test ${id}`, exact: true }).click()
    await expect(page.getByText(/0 von 95 im Browser/)).toBeVisible()
    await expect(page.getByText(/Dein Browserbericht:/)).toHaveCount(0)
  }
  const after = await storedRecord<LocalData>(page, 'meta', 'local')
  expect(after?.focus).toEqual(before?.focus)
  expect(after?.stuck).toEqual(before?.stuck)
  expect(after?.resume).toEqual(before?.resume)
  expect(after?.captureDraft).toEqual(before?.captureDraft)
  expect(after?.work ?? []).toEqual(before?.work ?? [])
  expect(after?.taskLearning ?? { enabled: false, samples: [] }).toEqual(before?.taskLearning ?? { enabled: false, samples: [] })
  expect(after?.deviceTests?.reports).toEqual({})
  // Reine Testlinks schreiben auch die nur im RAM ergänzten Migrationsdefaults nicht zurück.
  expect(await storedRecord<Settings>(page, 'settings', 'main')).toEqual(beforeSettings)
})

test('Gemeinsamer Abschlusslauf bündelt genau zehn freiwillige Stationen und erhält ältere Einzelberichte', async ({ page }) => {
  await onboard(page)
  await page.goto('/geraetetest?fall=3')
  await page.getByLabel('Testbeobachtung').fill('Einzeltest bleibt erhalten')
  await page.getByRole('button', { name: 'Teilweise', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.deviceTests?.reports[3]).toMatchObject({ note: 'Einzeltest bleibt erhalten', result: 'partial' })
  await page.getByRole('button', { name: 'Gemeinsamer Abschlusslauf', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Test 86 · Gemeinsamer Abschlusslauf: E04–E09', exact: true })).toBeVisible()
  await expect(page.getByLabel('Testbereich', { exact: true })).toHaveValue('Gemeinsamer Abschlusslauf: E04–E09')
  expect(await page.getByLabel('Test auswählen', { exact: true }).locator('option:not([disabled])').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))).toEqual(Array.from({ length: 10 }, (_, index) => String(86 + index)))
  await expect(page.getByText(/0 von 10 Abschlussstationen im Browser/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vorheriger Test', exact: true })).toBeDisabled()
  await page.getByLabel('Test auswählen', { exact: true }).selectOption('95')
  await expect(page.getByRole('button', { name: 'Nächster Test', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Teilweise', exact: true }).click()
  // Teilweise erhöht den Bestanden-Zähler nicht. Er war schon vor diesem Speichervorgang bei 0.
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.deviceTests?.reports[95]).toMatchObject({ result: 'partial', platform: 'web' })
  await page.reload()
  await expect(page.getByLabel('Testbereich', { exact: true })).toHaveValue('Gemeinsamer Abschlusslauf: E04–E09')
  const local = await storedRecord<LocalData>(page, 'meta', 'local')
  expect(local?.deviceTests?.reports[3]).toMatchObject({ note: 'Einzeltest bleibt erhalten', result: 'partial' })
  expect(local?.deviceTests?.reports[95]).toMatchObject({ result: 'partial', platform: 'web' })
  await expect(page.getByRole('button', { name: 'Erster Weckertest', exact: true })).toHaveCount(0)
  await page.getByText('Einzelne Bereiche prüfen', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Erster Weckertest', exact: true })).toBeVisible()
})

test('Ein wartender Bericht wird erst nach echter IDB-Persistenz als gespeichert bestätigt und übersteht dann Reload', async ({ page }) => {
  await onboard(page)
  await page.goto('/geraetetest?fall=3')
  await page.getByLabel('Testbeobachtung').fill('Alter Einzelbericht bleibt')
  await page.getByRole('button', { name: 'Teilweise', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.deviceTests?.reports[3]).toMatchObject({ result: 'partial', note: 'Alter Einzelbericht bleibt' })
  await page.getByRole('button', { name: 'Gemeinsamer Abschlusslauf', exact: true }).click()
  await page.getByLabel('Test auswählen', { exact: true }).selectOption('95')
  // Echte IndexedDB-Schreibbarriere, keine verzögerte Produktfunktion oder feste Wartezeit.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const state = window as unknown as { holdDeviceReportWrite: boolean }
    state.holdDeviceReportWrite = true
    const open = indexedDB.open('anker')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction('records', 'readwrite')
      transaction.oncomplete = () => db.close()
      const records = transaction.objectStore('records')
      const keep = () => {
        const read = records.get(['meta', 'local'])
        read.onsuccess = () => { if (state.holdDeviceReportWrite) keep() }
      }
      keep(); resolve()
    }
  }))
  try {
    await page.getByRole('button', { name: 'Teilweise', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Teilweise', exact: true })).toBeDisabled()
    await expect(page.getByText(/0 von 10 Abschlussstationen im Browser/)).toBeVisible()
    await expect(page.getByText('Deine Rückmeldung wurde gespeichert: Teilweise.', { exact: true })).toHaveCount(0)
  } finally {
    await page.evaluate(() => { (window as unknown as { holdDeviceReportWrite: boolean }).holdDeviceReportWrite = false })
  }
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.deviceTests?.reports[95]).toMatchObject({ result: 'partial', platform: 'web' })
  await expect(page.getByText('Deine Rückmeldung wurde gespeichert: Teilweise.', { exact: true })).toBeVisible()
  await page.reload()
  const local = await storedRecord<LocalData>(page, 'meta', 'local')
  expect(local?.deviceTests?.reports[3]).toMatchObject({ result: 'partial', note: 'Alter Einzelbericht bleibt' })
  expect(local?.deviceTests?.reports[95]).toMatchObject({ result: 'partial', platform: 'web' })
})

test('Abschlussstationen führen begleitet durch vorhandene Bereiche und starten selbst keine Alltagsaktion', async ({ page }) => {
  await onboard(page)
  const beforeSettings = await storedRecord<Settings>(page, 'settings', 'main')
  const before = await storedRecord<LocalData>(page, 'meta', 'local')
  await page.goto('/geraetetest')
  await page.getByRole('button', { name: 'Gemeinsamer Abschlusslauf', exact: true }).click()
  const destinations: [number, string, RegExp][] = [
    [86, 'Sicherung und Vorschau öffnen', /\/backup$/],
    [87, 'Testabend im Tag planen', /\/tag$/],
    [88, 'Arbeitszeit und Testeinsatz öffnen', /\/arbeitszeit$/],
    [89, 'Termine und Orte vergleichen', /\/tag$/],
    [90, 'Morgenvorschau im Tag öffnen', /\/tag$/],
    [91, 'Vorbereitung und Packliste öffnen', /\/vorbereitung$/],
    [92, 'Testaufgabe bewusst wählen', /\/arbeit$/],
    [93, 'Lokalen Plan ohne Dienst öffnen', /\/tag$/],
    [94, 'Kalender und Integrationen öffnen', /\/verbindungen$/],
    [95, 'Darstellung und Eingabe öffnen', /\/einstellungen\/darstellung$/],
  ]
  for (const [id, label, destination] of destinations) {
    await page.getByLabel('Test auswählen', { exact: true }).selectOption(String(id))
    await expect(page.getByRole('button', { name: 'Separaten Test in 10 Sekunden starten', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page).toHaveURL(destination)
    await page.getByRole('link', { name: `Zurück zu Test ${id}`, exact: true }).click()
    await expect(page.getByText(/0 von 10 Abschlussstationen im Browser/)).toBeVisible()
  }
  const after = await storedRecord<LocalData>(page, 'meta', 'local')
  expect(after?.deviceTests?.reports).toEqual({})
  expect(after?.focus).toEqual(before?.focus)
  expect(after?.stuck).toEqual(before?.stuck)
  expect(after?.resume).toEqual(before?.resume)
  expect(after?.work ?? []).toEqual(before?.work ?? [])
  expect(after?.workSessions ?? []).toEqual(before?.workSessions ?? [])
  expect(after?.commitments ?? []).toEqual(before?.commitments ?? [])
  expect(await storedRecord<Settings>(page, 'settings', 'main')).toEqual(beforeSettings)
})

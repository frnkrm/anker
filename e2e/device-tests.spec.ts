/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

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
  await expect(page.getByText(/0 von 63 im Browser/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Separaten Test in 10 Sekunden starten', exact: true })).toHaveCount(0)
  await page.getByLabel('Test auswählen', { exact: true }).selectOption('3')
  await expect(page.getByRole('heading', { name: 'Test 3 · Wecker', exact: true })).toBeVisible()
  await page.getByLabel('Testbeobachtung').fill('Plan angesehen, Ton am Handy noch offen')
  await page.getByRole('button', { name: 'Teilweise', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Deine Rückmeldung wurde gespeichert: Teilweise.')
  await expect(page.getByText(/0 von 63 im Browser/)).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Testbeobachtung')).toHaveValue('Plan angesehen, Ton am Handy noch offen')
  await expect(page.getByText(/Dein Browserbericht: Teilweise/)).toBeVisible()
  await page.getByRole('button', { name: '✓ Hat geklappt', exact: true }).click()
  await expect(page.getByText(/1 von 63 im Browser/)).toBeVisible()
  await expect(page.getByText(/Dieser Versuch braucht ein echtes Android-Gerät/)).toBeVisible()
  await page.getByRole('button', { name: 'Diesen Test wieder öffnen', exact: true }).click()
  await expect(page.getByText(/0 von 63 im Browser/)).toBeVisible()
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
  await expect(page.getByText(/0 von 63 im Browser/)).toBeVisible()
  await page.getByRole('button', { name: 'Testbegleitung pausieren', exact: true }).click()
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
  await page.getByRole('button', { name: 'Weckfenster prüfen', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Test 53 ·/ })).toBeVisible()
  await page.getByRole('button', { name: 'Für mich nicht relevant', exact: true }).click()
  await expect(page.getByText(/0 von 63 im Browser/)).toBeVisible()
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

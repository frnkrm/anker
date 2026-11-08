/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { GameState, LocalData, Settings } from '../src/core/types'
import { installAssistanceBackend, startAssistanceServer } from './helpers/assistance-server'
import { storedRecord } from './helpers/storage'

let server: Awaited<ReturnType<typeof startAssistanceServer>>
// Der zusätzliche Produktionsbuild gehört zum Fixture-Setup, nicht zur Interaktionsfrist.
test.beforeAll(async () => { test.setTimeout(120_000); server = await startAssistanceServer() })
test.afterAll(async () => { await server?.close() })
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-06T09:00:00Z'))
  await page.goto(`${server.url}/start`)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(`${server.url}/`)
}
async function enableAI(page: Page) {
  await page.goto(`${server.url}/einstellungen/assistenz`)
  await page.getByRole('button', { name: 'Verbindung prüfen', exact: true }).click()
  await expect(page.getByText(/Server: KI eingerichtet/)).toBeVisible()
  await page.getByRole('checkbox', { name: /Übertragung an OpenAI und mögliche/ }).check()
  await page.getByRole('switch', { name: 'KI-Vorschläge erlauben', exact: true }).click()
  await expect.poll(async () => (await local(page))?.assistance?.ai?.enabled).toBe(true)
}
async function createWork(page: Page) {
  await page.goto(`${server.url}/arbeit`)
  await page.getByRole('textbox', { name: 'Neue Aufgabe', exact: true }).fill('Vertraulicher Auftrag')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  const card = page.getByRole('heading', { name: 'Vertraulicher Auftrag', exact: true }).locator('..')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  return card
}
async function openAI(page: Page) {
  await page.getByText('KI-Vorschlag', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Text für den KI-Vorschlag', exact: true }).fill('Neutraler Text für einen ersten Schritt')
  await page.getByRole('checkbox', { name: 'Diesen Inhalt für diese Anfrage an OpenAI freigeben', exact: true }).check()
  await page.getByRole('button', { name: 'KI-Vorschlag anfordern', exact: true }).click()
}

test('Dienste bleiben getrennt aus, erst Check und Kostenfreigabe erlauben Aktivierung; Widerruf funktioniert offline', async ({ page, context }) => {
  const requests = await installAssistanceBackend(page)
  const checks: string[] = []
  page.on('request', (request) => { if (request.url().includes('/functions/v1/assistant')) checks.push(request.method()) })
  await onboard(page)
  await page.goto(`${server.url}/einstellungen`)
  await page.getByRole('link', { name: /Optionale Vorschläge/ }).click()
  await expect(page.getByRole('heading', { name: 'Optionale Vorschläge', exact: true })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'KI-Vorschläge erlauben', exact: true })).toBeDisabled()
  expect(checks).toEqual([])
  expect((await local(page))?.assistance).toBeUndefined()
  await enableAI(page)
  expect(checks).toEqual(['GET', 'GET'])
  expect(requests).toEqual([])
  expect((await local(page))?.assistance?.routes).toBeUndefined()
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.integrations.sync).toBe(false)
  await page.getByRole('checkbox', { name: /Übertragung der gewählten Fahrtdaten/ }).check()
  await page.getByRole('switch', { name: 'Verkehrsvorschläge erlauben', exact: true }).click()
  await expect.poll(async () => (await local(page))?.assistance?.routes).toMatchObject({ enabled: true, automatic: false })
  expect((await local(page))?.assistance?.ai?.enabled).toBe(true)
  await context.setOffline(true)
  await page.getByRole('switch', { name: 'KI-Vorschläge erlauben', exact: true }).click()
  await expect.poll(async () => (await local(page))?.assistance?.ai?.enabled).toBe(false)
  await page.getByRole('button', { name: 'Freigaben und Abrufmerker löschen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.assistance).toBeUndefined()
  expect(checks).toEqual(['GET', 'GET', 'GET'])
})

test('Explizit freigegebene Inhalte liefern nur editierbare Vorschläge; bewusste Übernahme erhält erledigte Teile', async ({ page }) => {
  const requests = await installAssistanceBackend(page)
  await onboard(page); await enableAI(page)
  const card = await createWork(page)
  if (!await card.getByRole('textbox', { name: 'Beschreibung', exact: true }).isVisible()) await card.getByText('Weitere Angaben', { exact: true }).click()
  await card.getByRole('textbox', { name: 'Beschreibung', exact: true }).fill('Geheime Kundendaten bleiben lokal')
  await card.getByRole('textbox', { name: 'Nächster Schritt', exact: true }).fill('Vertrauliche Akte öffnen')
  await card.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect(card.getByText('Details gespeichert.', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'In kleine Schritte zerlegen', exact: true }).click()
  await card.getByRole('button', { name: 'Vorschlag übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.subtasks?.length).toBeGreaterThan(1)
  const first = (await local(page))!.work[0]!.subtasks![0]!
  await card.getByRole('checkbox', { name: `Teilschritt ${first.title} erledigt`, exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.subtasks?.[0]?.doneAt).toBeTruthy()
  const before = (await local(page))!.work[0]!
  const game = await storedRecord<GameState>(page, 'game', 'main')
  await openAI(page)
  await expect(page.getByRole('region', { name: 'KI-Vorschlag prüfen', exact: true })).toBeVisible()
  expect(requests).toHaveLength(1)
  expect(requests[0]).toMatchObject({ kind: 'steps', title: 'Neutraler Text für einen ersten Schritt' })
  expect(Object.keys(requests[0]!).sort()).toEqual(['depth', 'kind', 'revision', 'title'])
  expect((await local(page))!.work[0]).toEqual(before)
  await expect(page.getByRole('checkbox', { name: 'Diesen Inhalt für diese Anfrage an OpenAI freigeben', exact: true })).not.toBeChecked()
  await page.getByRole('checkbox', { name: 'Beschreibung mitsenden', exact: true }).check()
  await page.getByRole('textbox', { name: 'Beschreibung für die KI-Anfrage', exact: true }).fill('Bewusst gekürzte Beschreibung')
  await page.getByRole('checkbox', { name: 'Nächsten Schritt mitsenden', exact: true }).check()
  await page.getByRole('textbox', { name: 'Nächster Schritt für die KI-Anfrage', exact: true }).fill('Nur diese Kurzfassung')
  await page.getByRole('checkbox', { name: 'Diesen Inhalt für diese Anfrage an OpenAI freigeben', exact: true }).check()
  await page.getByRole('button', { name: 'KI-Vorschlag anfordern', exact: true }).click()
  await expect.poll(() => requests.length).toBe(2)
  await expect(page.getByRole('button', { name: 'KI-Vorschlag anfordern', exact: true })).toBeVisible()
  expect(requests[1]).toMatchObject({ description: 'Bewusst gekürzte Beschreibung', nextStep: 'Nur diese Kurzfassung' })
  expect(JSON.stringify(requests)).not.toContain('Geheime Kundendaten')
  expect((await local(page))!.work[0]).toEqual(before)
  await page.getByRole('textbox', { name: 'KI-Schritt 1', exact: true }).fill('Mein passender kleiner Schritt')
  await page.getByRole('checkbox', { name: 'Geprüfte offene Schritte durch diesen Vorschlag ersetzen', exact: true }).check()
  await page.getByRole('button', { name: 'Geprüfte KI-Schritte übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.subtasks?.[0]?.title).toBe('Mein passender kleiner Schritt')
  await expect(page.getByText('Geprüfte Schritte gespeichert. Erledigte Teile bleiben erhalten.', { exact: true })).toBeVisible()
  const after = (await local(page))!.work[0]!
  expect(after.subtasks?.find((part) => part.id === first.id)).toEqual(before.subtasks?.[0])
  expect(after.done).not.toBe(true)
  expect(await storedRecord<GameState>(page, 'game', 'main')).toEqual(game)
  await page.reload()
  expect((await local(page))!.work[0]!.subtasks).toEqual(after.subtasks)
})

test('Abbruch und während der Anfrage bearbeitete Aufgabe verhindern späte Planänderungen', async ({ page }) => {
  let finish!: () => void
  const requests = await installAssistanceBackend(page, async (request, route) => {
    await new Promise<void>((resolve) => { finish = resolve })
    await route.fulfill({ json: { kind: 'steps', revision: request.revision, steps: [{ title: 'Spät eingetroffen' }] } }).catch(() => undefined)
  })
  await onboard(page); await enableAI(page)
  const card = await createWork(page)
  const before = (await local(page))!.work[0]!
  await openAI(page)
  await expect.poll(() => requests.length).toBe(1)
  await page.getByRole('button', { name: 'KI-Anfrage abbrechen', exact: true }).click()
  finish()
  await expect(page.getByText('Anfrage beendet. Deine Aufgabe bleibt unverändert.', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'KI-Vorschlag prüfen', exact: true })).toHaveCount(0)
  expect((await local(page))!.work[0]).toEqual(before)
  await page.getByRole('checkbox', { name: 'Diesen Inhalt für diese Anfrage an OpenAI freigeben', exact: true }).check()
  await page.getByRole('button', { name: 'KI-Vorschlag anfordern', exact: true }).click()
  await expect.poll(() => requests.length).toBe(2)
  await card.getByRole('textbox', { name: 'Nächster Schritt', exact: true }).fill('Inzwischen selbst entschieden')
  await card.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.nextStep).toBe('Inzwischen selbst entschieden')
  finish()
  await expect(page.getByText(/Die Aufgabe hat sich geändert. Prüfe den Inhalt vor/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'KI-Vorschlag prüfen', exact: true })).toHaveCount(0)
  expect((await local(page))!.work[0]!.subtasks).toBeUndefined()
})

test('Fehlende Anbieter-Konfiguration schaltet keine Freigabe ein; kleine Ansicht bleibt bedienbar', async ({ page }) => {
  await installAssistanceBackend(page)
  await page.route('**/functions/v1/assistant', (route) => route.fulfill({ status: 503, json: { message: 'Kein echter Anbieter verbunden' } }))
  await onboard(page)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(`${server.url}/einstellungen/assistenz`)
  await page.evaluate(() => { document.documentElement.style.fontSize = '160%' })
  await page.getByRole('button', { name: 'Verbindung prüfen', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('noch nicht eingerichtet')
  await expect(page.getByRole('switch', { name: 'KI-Vorschläge erlauben', exact: true })).toBeDisabled()
  expect((await local(page))?.assistance).toBeUndefined()
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('body *')).filter((element) => element.getBoundingClientRect().right > innerWidth + 1).map((element) => ({ tag: element.tagName, text: element.textContent?.slice(0, 55), width: element.getBoundingClientRect().width })))).toEqual([])
})

test('Ohne Anmeldung bleibt der optionale Dienst aus; lokale Zerlegung funktioniert ohne Datenübertragung', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => { if (request.url().includes('/functions/v1/assistant')) requests.push(request.method()) })
  await onboard(page)
  await page.goto(`${server.url}/einstellungen/assistenz`)
  await page.getByRole('button', { name: 'Verbindung prüfen', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('gültige Anmeldung')
  await expect(page.getByRole('switch', { name: 'KI-Vorschläge erlauben', exact: true })).toBeDisabled()
  const card = await createWork(page)
  await card.getByRole('button', { name: 'In kleine Schritte zerlegen', exact: true }).click()
  await card.getByRole('button', { name: 'Vorschlag übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.subtasks?.length).toBeGreaterThan(1)
  expect(requests).toEqual([])
  expect((await local(page))?.assistance).toBeUndefined()
})

test('Verbindungsfehler bei der KI-Anfrage verändert keine Aufgabe und blockiert die lokale Vorlage nicht', async ({ page }) => {
  await installAssistanceBackend(page, async (_request, route) => { await route.abort('internetdisconnected') })
  await onboard(page); await enableAI(page)
  const card = await createWork(page)
  const before = (await local(page))!.work[0]!
  await openAI(page)
  await expect(page.getByRole('alert')).toContainText('Verbindung ist gerade nicht verfügbar')
  expect((await local(page))!.work[0]).toEqual(before)
  await expect(page.getByRole('region', { name: 'KI-Vorschlag prüfen', exact: true })).toHaveCount(0)
  await card.getByRole('button', { name: 'In kleine Schritte zerlegen', exact: true }).click()
  await card.getByRole('button', { name: 'Vorschlag übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.subtasks?.length).toBeGreaterThan(1)
})

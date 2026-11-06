/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { LocalData, Settings } from '../src/core/types'
import { configuredCapabilities, installAssistanceBackend, startAssistanceServer } from './helpers/assistance-server'
import { storedRecord } from './helpers/storage'

let server: Awaited<ReturnType<typeof startAssistanceServer>>
let unconfiguredServer: Awaited<ReturnType<typeof startAssistanceServer>>
test.beforeAll(async () => {
  test.setTimeout(120_000)
  server = await startAssistanceServer(4271)
  unconfiguredServer = await startAssistanceServer(4270, false)
})
test.afterAll(async () => { await unconfiguredServer?.close(); await server?.close() })
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
const aiCard = (page: Page) => page.getByRole('switch', { name: 'KI-Vorschläge erlauben', exact: true }).locator('xpath=ancestor::fieldset/..')

async function openSettings(page: Page, url = server.url) {
  await page.clock.setFixedTime(new Date('2026-11-06T09:00:00Z'))
  await page.goto(`${url}/start`)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(`${url}/`)
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
  await page.goto(`${url}/einstellungen/assistenz`)
  await expect(page.getByRole('heading', { name: 'Optionale Vorschläge', exact: true })).toBeVisible()
}

test('App ohne Server-Verbindung erklärt die Sperre direkt am KI-Schalter und bleibt ohne Anfrage', async ({ page }) => {
  const checks: string[] = []
  page.on('request', (request) => { if (request.url().includes('/functions/v1/assistant')) checks.push(request.method()) })
  await openSettings(page, unconfiguredServer.url)
  const card = aiCard(page)
  await expect(card.getByRole('status')).toContainText('In dieser App-Version fehlt die Server-Verbindung')
  await card.getByRole('checkbox', { name: /Übertragung an OpenAI und mögliche/ }).check()
  await expect(card.getByRole('switch', { name: 'KI-Vorschläge erlauben', exact: true })).toBeDisabled()
  await expect(card.getByRole('button', { name: 'Verbindung für KI prüfen', exact: true })).toHaveCount(0)
  await card.getByRole('link', { name: 'Anmeldung und Verbindungen öffnen', exact: true }).click()
  await expect(page).toHaveURL(`${unconfiguredServer.url}/verbindungen`)
  await expect(page.getByRole('heading', { name: 'Kalender & Sync', exact: true })).toBeVisible()
  expect(checks).toEqual([])
  expect((await local(page))?.assistance).toBeUndefined()
})

test('KI-Karte erklärt die nächste Freigabeaktion direkt am gesperrten Schalter', async ({ page }) => {
  await installAssistanceBackend(page)
  const checks: string[] = []
  page.on('request', (request) => { if (request.url().includes('/functions/v1/assistant')) checks.push(request.method()) })
  await openSettings(page)
  const card = aiCard(page)
  const toggle = card.getByRole('switch', { name: 'KI-Vorschläge erlauben', exact: true })
  await expect(toggle).toBeDisabled()
  await expect(card.getByRole('status')).toContainText('Prüfe zuerst die Verbindung')
  expect(checks).toEqual([])
  expect((await local(page))?.assistance).toBeUndefined()
  await card.getByRole('button', { name: 'Verbindung für KI prüfen', exact: true }).click()
  await expect(card.getByRole('status')).toContainText('Bestätige zuerst den Daten- und Kostenhinweis')
  await expect(toggle).toBeDisabled()
  await card.getByRole('checkbox', { name: /Übertragung an OpenAI und mögliche/ }).check()
  await expect(toggle).toBeEnabled()
  await page.route('**/functions/v1/assistant', (route) => route.fulfill({ status: 503, json: {} }))
  await page.getByRole('button', { name: 'Verbindung prüfen', exact: true }).click()
  await expect(card.getByRole('status')).toContainText('noch nicht eingerichtet')
  await expect(card.getByRole('button', { name: 'Verbindung für KI prüfen', exact: true })).toBeVisible()
})

test('Geprüfte KI-Freigabe bleibt nach Reload gespeichert und offline widerrufbar, ohne Vorschläge abzurufen', async ({ page, context }) => {
  const requests = await installAssistanceBackend(page)
  const checks: string[] = []
  page.on('request', (request) => { if (request.url().includes('/functions/v1/assistant')) checks.push(request.method()) })
  await openSettings(page)
  await page.getByRole('button', { name: 'Verbindung prüfen', exact: true }).click()
  await expect(page.getByText(/Server: KI eingerichtet/)).toBeVisible()
  const card = aiCard(page)
  const toggle = card.getByRole('switch', { name: 'KI-Vorschläge erlauben', exact: true })
  await card.getByRole('checkbox', { name: /Übertragung an OpenAI und mögliche/ }).check()
  await toggle.click()
  await expect.poll(async () => (await local(page))?.assistance?.ai).toMatchObject({ enabled: true, version: 1 })
  expect(checks).toEqual(['GET', 'GET'])
  expect(requests).toEqual([])
  expect((await local(page))?.assistance?.routes).toBeUndefined()
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.integrations.sync).toBe(false)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Optionale Vorschläge', exact: true })).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(toggle).toBeEnabled()
  await context.setOffline(true)
  await toggle.click()
  await expect.poll(async () => (await local(page))?.assistance?.ai?.enabled).toBe(false)
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(checks).toEqual(['GET', 'GET'])
  expect(requests).toEqual([])
})

test('Fehlende KI-Einrichtung wird direkt am gesperrten Schalter erklärt und bietet den vorhandenen lokalen Weg an', async ({ page }) => {
  const requests = await installAssistanceBackend(page)
  await page.route('**/functions/v1/assistant', (route) => route.fulfill({ json: { ...configuredCapabilities, ai: { ...configuredCapabilities.ai, configured: false } } }))
  await openSettings(page)
  const card = aiCard(page)
  await card.getByRole('button', { name: 'Verbindung für KI prüfen', exact: true }).click()
  await expect(card.getByRole('status')).toContainText('KI ist auf deinem Server noch nicht eingerichtet')
  await card.getByRole('checkbox', { name: /Übertragung an OpenAI und mögliche/ }).check()
  await expect(card.getByRole('switch', { name: 'KI-Vorschläge erlauben', exact: true })).toBeDisabled()
  await expect(card.getByRole('link', { name: 'Anmeldung und Verbindungen öffnen', exact: true })).toHaveAttribute('href', '/verbindungen')
  await card.getByRole('link', { name: 'Lokale Teilschritte unter Arbeit öffnen', exact: true }).click()
  await expect(page).toHaveURL(`${server.url}/arbeit`)
  await expect(page.getByRole('textbox', { name: 'Neue Aufgabe', exact: true })).toBeVisible()
  expect((await local(page))?.assistance).toBeUndefined()
  expect(requests).toEqual([])
})

/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { Settings } from '../src/core/types'
import { assistanceHost, installAssistanceBackend, startAssistanceServer } from './helpers/assistance-server'
import { storedRecord } from './helpers/storage'

let server: Awaited<ReturnType<typeof startAssistanceServer>>
test.beforeAll(async () => { test.setTimeout(120_000); server = await startAssistanceServer(4225) })
test.afterAll(async () => { await server?.close() })
async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-06T09:00:00Z'))
  await page.goto(`${server.url}/start`)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await page.goto(`${server.url}/verbindungen`)
  await expect(page.getByText('Angemeldet als browser-fixture@example.invalid', { exact: true })).toBeVisible()
}
const settings = (page: Page) => storedRecord<Settings>(page, 'settings', 'main')

test('Manueller Sync lässt Automatik aus und sendet keine QR-/Medikationskonfiguration', async ({ page }) => {
  await installAssistanceBackend(page)
  const uploads: unknown[] = []
  await page.route(`${assistanceHost}/rest/v1/rpc/upsert_records`, async (route) => { uploads.push(route.request().postDataJSON()); await route.fulfill({ json: null }) })
  await page.route(`${assistanceHost}/rest/v1/records**`, async (route) => { await route.fulfill({ json: [] }) })
  await onboard(page)
  const before = (await settings(page))!
  expect(before.integrations.sync).toBe(false)
  await page.getByRole('button', { name: 'Jetzt synchronisieren', exact: true }).click()
  await expect(page.getByText('Synchronisiert.', { exact: true })).toBeVisible()
  expect(uploads.length).toBeGreaterThan(0)
  const payload = JSON.stringify(uploads)
  expect(payload).not.toContain(before.alarm.qrSecret)
  expect(payload).not.toContain('medicationEnabled')
  expect(payload).not.toContain('medicationReminderAt')
  expect((await settings(page))?.integrations.sync).toBe(false)
  expect((await settings(page))?.alarm.qrSecret).toBe(before.alarm.qrSecret)
})

test('Automatischer Sync lässt sich während einer wartenden Serverantwort sofort ausschalten', async ({ page }) => {
  await installAssistanceBackend(page)
  let entered!: () => void; let release!: () => void
  const uploading = new Promise<void>((resolve) => { entered = resolve })
  const hold = new Promise<void>((resolve) => { release = resolve })
  let pulls = 0
  await page.route(`${assistanceHost}/rest/v1/rpc/upsert_records`, async (route) => { entered(); await hold; await route.fulfill({ json: null }) })
  await page.route(`${assistanceHost}/rest/v1/records**`, async (route) => { pulls++; await route.fulfill({ json: [] }) })
  await onboard(page)
  await page.getByRole('switch', { name: 'Automatischer Sync', exact: true }).click()
  await uploading
  try {
    await page.getByRole('switch', { name: 'Automatischer Sync', exact: true }).click()
    await expect.poll(async () => (await settings(page))?.integrations.sync).toBe(false)
  } finally { release() }
  await expect(page.getByRole('button', { name: 'Jetzt synchronisieren', exact: true })).toBeEnabled()
  expect(pulls).toBe(0)
  expect((await settings(page))?.integrations.sync).toBe(false)
})

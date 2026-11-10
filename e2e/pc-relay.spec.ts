import { expect, test, type Page } from '@playwright/test'
import type { LocalData, Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'
import { installRelaySession, relayProject, relayStart, startRelayServer } from './helpers/relay-server'

test.use({ serviceWorkers: 'block' })
const SETUP = 'anker-pc-relay:v1:' + 'A'.repeat(72)
interface RelayState { enabled: boolean; paired: boolean; status: string; phoneExpiresAt?: number; lastExchangeAt?: number }
interface RelayProbe { state: RelayState; reads: number; setups: number; renews: number; disables: number; revokes: number; clears: number; authorized: number; project?: string; holdSetup: boolean; release?: () => void }
type RelayWindow = Window & { __relay: RelayProbe; CapacitorCustomPlatform: { name: string } }
let configured: Awaited<ReturnType<typeof startRelayServer>>, unconfigured: Awaited<ReturnType<typeof startRelayServer>>
test.beforeAll(async () => { test.setTimeout(120_000); configured = await startRelayServer(4238, true); unconfigured = await startRelayServer(4239, false) })
test.afterAll(async () => { await configured?.close(); await unconfigured?.close() })

/** Production facade, SDK session, panel and Store with controlled native transport, never a real relay service. */
async function open(page: Page, options: { native?: boolean; configured?: boolean; session?: boolean; paired?: boolean; expired?: boolean } = {}) {
  const settings = { native: true, configured: true, session: true, paired: true, expired: false, ...options }
  const server = settings.configured ? configured : unconfigured
  if (settings.session) await installRelaySession(page)
  await page.addInitScript(({ setup, paired, expired }) => {
    const probe: RelayProbe = { state: { enabled: expired, paired, status: expired ? 'expired' : 'off', ...(expired ? { phoneExpiresAt: Date.now() - 1 } : {}) }, reads: 0, setups: 0, renews: 0, disables: 0, revokes: 0, clears: 0, authorized: 0, holdSetup: false }
    const methods = ['pcRelaySetup', 'pcRelayRenew', 'pcRelayRevoke', 'pcRelayDisable', 'pcRelayClear', 'pcRelayStatus',
      'pcBridgeGetState', 'pcBridgeConfigure', 'pcBridgeDrainEvents', 'getAlarmState', 'syncAlarmConfig', 'syncReminders', 'drainReminderActions',
      'ackReminderActions', 'setReminderFocus', 'updateWidget', 'getSmartWakeState', 'getGuidanceState', 'syncGuidance', 'getBedtimePromptState', 'syncBedtimePrompt']
    Object.assign(window, { __relay: probe, CapacitorCustomPlatform: { name: 'web' }, Capacitor: {
      PluginHeaders: [{ name: 'AnkerNative', methods: methods.map(name => ({ name, rtype: 'promise' })) }],
      async nativePromise(_plugin: string, method: string, options?: { project?: string; accessToken?: string }) {
        if (method === 'pcRelayStatus') { probe.reads++; return { ...probe.state } }
        if (method === 'pcRelaySetup') {
          probe.setups++; probe.project = options?.project
          if (typeof options?.accessToken === 'string' && options.accessToken.length > 20) probe.authorized++
          if (probe.holdSetup) { probe.holdSetup = false; await new Promise<void>(resolve => { probe.release = resolve }) }
          probe.state = { enabled: true, paired: true, status: 'waiting', phoneExpiresAt: Date.now() + 14 * 86_400_000 }
          return { state: { ...probe.state }, desktopSetup: setup }
        }
        if (method === 'pcRelayRenew') { probe.renews++; probe.state = { enabled: true, paired: true, status: 'waiting', phoneExpiresAt: Date.now() + 14 * 86_400_000 }; return { state: { ...probe.state } } }
        if (method === 'pcRelayDisable') { probe.disables++; probe.state = { ...probe.state, enabled: false, status: 'off' }; return { state: { ...probe.state } } }
        if (method === 'pcRelayRevoke') { probe.revokes++; probe.state = { enabled: false, paired: true, status: 'off' }; return { state: { ...probe.state }, cloudRevoked: true } }
        if (method === 'pcRelayClear') { probe.clears++; probe.state = { enabled: false, paired: true, status: 'off' }; return { state: { ...probe.state } } }
        if (method === 'pcBridgeGetState' || method === 'pcBridgeConfigure') return { state: paired ? 'paired-never-reached' : 'unpaired', connected: false, active: false }
        if (method === 'pcBridgeDrainEvents') return { events: [], lastSeq: 0 }
        if (method === 'getAlarmState' || method === 'syncAlarmConfig') return { ringing: false, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: Date.now() + 86_400_000 }
        if (method === 'drainReminderActions') return { actions: [] }
        if (method === 'getSmartWakeState') return { active: false, phase: 'idle', message: '', targetAt: 0, windowAt: 0, hasMotion: true, microphoneGranted: true }
        return {}
      },
    } })
  }, { setup: SETUP, paired: settings.paired, expired: settings.expired })
  await page.clock.setFixedTime(new Date(relayStart))
  await page.goto(`${server.url}/start`)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click(); await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
  if (settings.native) await page.evaluate(() => { (window as unknown as RelayWindow).CapacitorCustomPlatform.name = 'android' })
  await page.getByRole('link', { name: 'Mehr', exact: true }).click(); await page.getByRole('link', { name: /Abend & Alltag/ }).click(); await page.getByRole('link', { name: 'PC-Stopp', exact: true }).click()
  await page.getByText('Optional außerhalb des Heimnetzes verbinden', { exact: true }).click()
  return page.getByLabel('Optionales PC-Relay', { exact: true })
}
const optin = (page: Page) => page.getByRole('switch', { name: 'Ich möchte das verschlüsselte Relay über mein eigenes Supabase-Projekt einrichten', exact: true })
async function enable(page: Page) {
  await optin(page).click()
  await page.getByRole('button', { name: 'Relay bewusst einrichten', exact: true }).click()
}

test('Relay-Setup braucht ausdrückliche Wahl, vorhandene Paarung und SDK-Sitzung; private Daten bleiben außerhalb des Stores', async ({ page }) => {
  const panel = await open(page)
  const button = panel.getByRole('button', { name: 'Relay bewusst einrichten', exact: true })
  await expect(button).toBeDisabled(); expect(await page.evaluate(() => (window as unknown as RelayWindow).__relay.setups)).toBe(0)
  await enable(page)
  const code = panel.getByLabel('Privater PC-Relay-Einrichtungscode', { exact: true })
  await expect(code).toHaveAttribute('type', 'password'); await expect(code).toHaveValue(SETUP)
  await expect(panel).toContainText('Ein PC-Empfang ist damit noch nicht bestätigt.')
  const calls = await page.evaluate(() => { const probe = (window as unknown as RelayWindow).__relay; return { setups: probe.setups, authorized: probe.authorized, project: probe.project } })
  expect(calls).toEqual({ setups: 1, authorized: 1, project: relayProject })
  const local = await storedRecord<LocalData>(page, 'meta', 'local'), settings = await storedRecord<Settings>(page, 'settings', 'main')
  expect(JSON.stringify({ local, settings })).not.toContain('anker-pc-relay:'); expect(JSON.stringify({ local, settings })).not.toContain(SETUP)
  await panel.getByRole('button', { name: 'Code hier verbergen', exact: true }).click(); await expect(code).toHaveCount(0)
  await panel.getByRole('button', { name: 'Relay auf diesem Handy ausschalten', exact: true }).click()
  await expect(panel).toContainText('Relay auf diesem Handy ausgeschaltet.')
  expect(await page.evaluate(() => (window as unknown as RelayWindow).__relay.disables)).toBe(1)
  await panel.getByRole('button', { name: 'Relay für beide Geräte widerrufen', exact: true }).click()
  await expect(panel).toContainText('Relay für beide Geräte beim Dienst widerrufen.')
  expect(await page.evaluate(() => (window as unknown as RelayWindow).__relay.revokes)).toBe(1)
})

test('Nach Verbergen während ausstehender Einrichtung erscheint ein späterer privater Code auch bei Rückkehr nicht', async ({ page }) => {
  const panel = await open(page)
  await page.evaluate(() => { (window as unknown as RelayWindow).__relay.holdSetup = true })
  await enable(page)
  await expect.poll(() => page.evaluate(() => (window as unknown as RelayWindow).__relay.setups)).toBe(1)
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.evaluate(() => (window as unknown as RelayWindow).__relay.release?.())
  await expect.poll(() => page.evaluate(() => (window as unknown as RelayWindow).__relay.state.enabled)).toBe(true)
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect(panel.getByLabel('Privater PC-Relay-Einrichtungscode', { exact: true })).toHaveCount(0)
})

test('Ohne SDK-Anmeldung wird kein natives Relay provisioniert und kein Login still gestartet', async ({ page }) => {
  const panel = await open(page, { session: false })
  await enable(page)
  await expect(panel.getByRole('alert')).toContainText('Prüfe Anmeldung')
  expect(await page.evaluate(() => (window as unknown as RelayWindow).__relay.setups)).toBe(0)
  await expect(panel.getByLabel('Privater PC-Relay-Einrichtungscode', { exact: true })).toHaveCount(0)
})

test('Fehlende Heimnetz-Paarung hält die Relay-Einrichtung auch nach Einwilligung aus', async ({ page }) => {
  const panel = await open(page, { paired: false })
  await optin(page).click()
  await expect(panel.getByRole('button', { name: 'Relay bewusst einrichten', exact: true })).toBeDisabled()
  await expect(panel).toContainText('Kopple zuerst deinen PC im Heimnetz')
  expect(await page.evaluate(() => (window as unknown as RelayWindow).__relay.setups)).toBe(0)
})

test('Abgelaufene Handyfreigabe kann bewusst ohne neuen privaten PC-Code erneuert werden', async ({ page }) => {
  const panel = await open(page, { expired: true })
  await expect(panel).toContainText('Handyfreigabe abgelaufen')
  expect(await page.evaluate(() => (window as unknown as RelayWindow).__relay.renews)).toBe(0)
  await panel.getByRole('button', { name: 'Handyfreigabe für 14 Tage erneuern', exact: true }).click()
  await expect(panel).toContainText('Die endliche Handyfreigabe wurde erneuert.')
  expect(await page.evaluate(() => (window as unknown as RelayWindow).__relay.renews)).toBe(1)
  await expect(panel.getByLabel('Privater PC-Relay-Einrichtungscode', { exact: true })).toHaveCount(0)
})

test('Unkonfigurierter Build bleibt ehrlich, ohne Einrichtungsschalter oder Cloud-Aktivierung', async ({ page }) => {
  const panel = await open(page, { configured: false })
  await expect(panel).toContainText('kein Supabase-Zugang eingerichtet')
  await expect(optin(page)).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as RelayWindow).__relay.setups)).toBe(0)
})

test('Webvorschau zeigt Android-Hinweis ohne native Einrichtung', async ({ page }) => {
  const panel = await open(page, { native: false })
  await expect(panel).toContainText('in der Android-App verfügbar')
  await expect(optin(page)).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as RelayWindow).__relay.reads)).toBe(0)
})

test('Relay-Einrichtung passt bei 320 Pixeln und 160 Prozent Schrift ohne horizontale Überlappung', async ({ page }) => {
  const panel = await open(page)
  await page.setViewportSize({ width: 320, height: 844 }); await page.evaluate(() => { document.documentElement.style.fontSize = '160%' })
  await enable(page)
  await expect(panel.getByLabel('Privater PC-Relay-Einrichtungscode', { exact: true })).toHaveValue(SETUP)
  const boxes = await panel.locator('p, button, input').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, tag: node.tagName } }))
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(320)
    if (box.tag !== 'INPUT') expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

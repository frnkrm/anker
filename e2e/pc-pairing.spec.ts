import { expect, test, type Page } from '@playwright/test'
import type { LocalData, Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'

const START = Date.parse('2026-11-10T10:00:00+01:00')
const CHECK_CODE = '0482'
const QR = 'anker-pc-pair:v3:' + Buffer.from(JSON.stringify({
  t: 'anker-pc-pair', v: 3, id: 'pc-pairing-ui-test', n: 'Test-PC',
  k: Buffer.from([4, ...Array<number>(64).fill(2)]).toString('base64url'),
  c: 'a'.repeat(64), s: Buffer.alloc(32, 3).toString('base64url'),
  a: ['192.168.1.2:47830'], e: new Date(START + 300_000).toISOString(),
})).toString('base64url')

interface PairView { state: string; connected: boolean; active: boolean; code?: unknown; error?: string }
interface PairProbe { view: PairView; reads: number; requests: number; pending: boolean; holdNextRead: boolean; heldReads: number; releaseView?: () => void; release?: () => void }
type PairWindow = Window & { __pairProbe: PairProbe; CapacitorCustomPlatform: { name: string } }

/** Production UI with a controlled Capacitor contract; no Android crypto, LAN or camera proof. */
async function setup(page: Page) {
  await page.addInitScript(({ qr, checkCode }) => {
    const probe: PairProbe = { view: { state: 'unpaired', connected: false, active: false }, reads: 0, requests: 0, pending: false, holdNextRead: false, heldReads: 0 }
    const methods = ['pcBridgeGetState', 'pcBridgeConfigure', 'pcBridgePair', 'pcBridgeDrainEvents', 'pcBridgeStop',
      'getAlarmState', 'syncAlarmConfig', 'syncReminders', 'drainReminderActions', 'ackReminderActions',
      'setReminderFocus', 'updateWidget', 'getSmartWakeState', 'getGuidanceState', 'syncGuidance', 'getBedtimePromptState', 'syncBedtimePrompt']
    Object.assign(window, { __pairProbe: probe, CapacitorCustomPlatform: { name: 'web' }, Capacitor: {
      PluginHeaders: [
        { name: 'AnkerNative', methods: methods.map(name => ({ name, rtype: 'promise' })) },
        { name: 'BarcodeScanner', methods: ['isGoogleBarcodeScannerModuleAvailable', 'scan'].map(name => ({ name, rtype: 'promise' })) },
      ],
      async nativePromise(plugin: string, method: string) {
        if (plugin === 'BarcodeScanner') return method === 'scan' ? { barcodes: [{ rawValue: qr }] } : { available: true }
        if (method === 'pcBridgeGetState') {
          probe.reads++
          const snapshot = { ...probe.view }
          if (probe.holdNextRead) {
            probe.holdNextRead = false; probe.heldReads++
            await new Promise<void>(resolve => { probe.releaseView = resolve })
          }
          return snapshot
        }
        if (method === 'pcBridgePair') {
          probe.requests++; probe.pending = true
          probe.view = { state: 'pairing', connected: false, active: true, code: checkCode }
          await new Promise<void>(resolve => { probe.release = resolve })
          probe.pending = false
          return { ...probe.view }
        }
        if (method === 'pcBridgeConfigure' || method === 'pcBridgeStop') return { ...probe.view }
        if (method === 'pcBridgeDrainEvents') return { events: [], lastSeq: 0 }
        if (method === 'getAlarmState' || method === 'syncAlarmConfig') return { ringing: false, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: Date.now() + 86_400_000 }
        if (method === 'drainReminderActions') return { actions: [] }
        if (method === 'getSmartWakeState') return { active: false, phase: 'idle', message: '', targetAt: 0, windowAt: 0, hasMotion: true, microphoneGranted: true }
        return {}
      },
    } })
  }, { qr: QR, checkCode: CHECK_CODE })
  await page.clock.setFixedTime(new Date(START))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
}

async function openPanel(page: Page, native = true) {
  if (native) await page.evaluate(() => { (window as unknown as PairWindow).CapacitorCustomPlatform.name = 'android' })
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await page.getByRole('link', { name: /Abend & Alltag/ }).click()
  await page.getByRole('link', { name: 'PC-Stopp', exact: true }).click()
  return page.getByRole('region', { name: 'Lokaler PC-Begleiter', exact: true })
}

async function view(page: Page, value: PairView) {
  const reads = await page.evaluate(value => {
    const probe = (window as unknown as PairWindow).__pairProbe
    const reads = probe.reads
    probe.view = value
    document.dispatchEvent(new Event('visibilitychange'))
    return reads
  }, value)
  await expect.poll(() => page.evaluate(() => (window as unknown as PairWindow).__pairProbe.reads)).toBeGreaterThan(reads)
}

test('PC-Scan zeigt den Prüfcode schon während einer offenen nativen Kopplungsantwort', async ({ page }) => {
  await setup(page)
  const panel = await openPanel(page)
  await panel.getByText('PC erstmals koppeln', { exact: true }).click()
  const scan = panel.getByRole('button', { name: 'Kopplungs-QR am PC scannen', exact: true })
  await scan.click()
  await expect.poll(() => page.evaluate(() => (window as unknown as PairWindow).__pairProbe.requests)).toBe(1)
  await expect.poll(() => page.evaluate(() => (window as unknown as PairWindow).__pairProbe.pending)).toBe(true)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  const confirmation = panel.getByRole('status', { name: 'PC-Kopplung bestätigen', exact: true })
  await expect(confirmation.getByLabel('Prüfcode zur PC-Kopplung', { exact: true })).toHaveText(CHECK_CODE)
  await expect(confirmation).toContainText('„Ja, koppeln“')
  await expect(scan).toBeDisabled()
  await page.evaluate(() => {
    const probe = (window as unknown as PairWindow).__pairProbe
    probe.view = { state: 'connected', connected: true, active: true, code: '0482' }
    probe.release?.()
  })
  await expect(confirmation).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as unknown as PairWindow).__pairProbe.pending)).toBe(false)
  const local = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  expect(local.pcBridge?.enabled).toBe(true)
  expect(JSON.stringify(local)).not.toContain(`"${CHECK_CODE}"`)
  expect(JSON.stringify(local)).not.toContain(QR)
})

test('Nur der aktuelle Pending-Zustand zeigt den Code, nie verbundene, abgelaufene oder aufgehobene Kopplungen', async ({ page }) => {
  await setup(page)
  const panel = await openPanel(page)
  const code = panel.getByLabel('Prüfcode zur PC-Kopplung', { exact: true })
  for (const state of ['connected', 'paired-never-reached', 'rejected', 'unpaired', 'unreachable', 'companion-outdated']) {
    await view(page, { state: 'pairing', connected: false, active: true, code: CHECK_CODE })
    await expect(code).toHaveText(CHECK_CODE)
    await view(page, { state, connected: state === 'connected', active: false, code: CHECK_CODE, error: 'PC_PAIR_EXPIRED' })
    await expect(code).toHaveCount(0)
    await expect(panel.getByRole('status', { name: 'PC-Kopplung bestätigen', exact: true })).toHaveCount(0)
  }
})

test('Eine verspätete Pending-Antwort zeigt nach neuerer Kopplungsbestätigung keinen alten Code erneut', async ({ page }) => {
  await setup(page)
  const panel = await openPanel(page)
  await panel.getByText('PC erstmals koppeln', { exact: true }).click()
  await panel.getByRole('button', { name: 'Kopplungs-QR am PC scannen', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as PairWindow).__pairProbe.pending)).toBe(true)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  const code = panel.getByLabel('Prüfcode zur PC-Kopplung', { exact: true })
  await expect(code).toHaveText(CHECK_CODE)
  await page.evaluate(() => {
    const probe = (window as unknown as PairWindow).__pairProbe
    probe.holdNextRead = true
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as PairWindow).__pairProbe.heldReads)).toBe(1)
  await page.evaluate(() => {
    const probe = (window as unknown as PairWindow).__pairProbe
    probe.view = { state: 'connected', connected: true, active: true }
    probe.release?.()
  })
  await expect(code).toHaveCount(0)
  const reappeared = await page.evaluate(async () => {
    let shownAgain = false
    const observer = new MutationObserver(() => { if (document.querySelector('[aria-label="Prüfcode zur PC-Kopplung"]')) shownAgain = true })
    observer.observe(document.body, { childList: true, subtree: true })
    ;(window as unknown as PairWindow).__pairProbe.releaseView?.()
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    observer.disconnect()
    return shownAgain
  })
  expect(reappeared).toBe(false)
  await expect(code).toHaveCount(0)
})

test('Ungültige native Codes werden nicht angezeigt oder zu einer Bestätigung aufgefordert', async ({ page }) => {
  await setup(page)
  const panel = await openPanel(page)
  const confirmation = panel.getByRole('status', { name: 'PC-Kopplung bestätigen', exact: true })
  for (const code of ['12345', '1234\n', '<img src=x onerror=alert(1)>', 1234, null]) {
    await view(page, { state: 'pairing', connected: false, active: true, code })
    await expect(confirmation).toContainText('Der Prüfcode ist noch nicht verfügbar.')
    await expect(confirmation.getByLabel('Prüfcode zur PC-Kopplung', { exact: true })).toHaveCount(0)
    await expect(confirmation).not.toContainText(String(code))
  }
})

test('Prüfcode und Bestätigungstext passen bei 320 Pixeln und großer Schrift ohne Überlappung', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 320, height: 844 })
  const panel = await openPanel(page)
  await page.evaluate(() => { document.documentElement.style.fontSize = '160%' })
  await view(page, { state: 'pairing', connected: false, active: true, code: CHECK_CODE })
  const confirmation = panel.getByRole('status', { name: 'PC-Kopplung bestätigen', exact: true })
  const code = confirmation.getByLabel('Prüfcode zur PC-Kopplung', { exact: true })
  await expect(code).toHaveText(CHECK_CODE)
  const boxes = await confirmation.locator('h3, p').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect()
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }
  }))
  for (const [index, box] of boxes.entries()) {
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(320)
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1)
    if (index) expect(box.top).toBeGreaterThanOrEqual(boxes[index - 1]!.bottom)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('Die Webvorschau liest und zeigt keinen nativen Kopplungs-Prüfcode', async ({ page }) => {
  await setup(page)
  await page.evaluate(() => { (window as unknown as PairWindow).__pairProbe.view = { state: 'pairing', connected: false, active: true, code: '0482' } })
  const panel = await openPanel(page, false)
  await expect(panel).toContainText('Web-Vorschau')
  await expect(panel.getByRole('status', { name: 'PC-Kopplung bestätigen', exact: true })).toHaveCount(0)
  await expect(panel).not.toContainText(CHECK_CODE)
  expect(await page.evaluate(() => (window as unknown as PairWindow).__pairProbe.reads)).toBe(0)
})

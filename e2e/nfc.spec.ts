/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { storedRecord } from './helpers/storage'
import type { LocalData } from '../src/core/types'

interface Probe {
  starts: string[]; cancels: string[]; confirmations: number
  availability: string; canOpen: boolean; allow: boolean
  releases: ((value: unknown) => void)[]; alarm: () => void
  holdConfirmation?: boolean; confirmationRelease?: (value: unknown) => void
}
declare global { interface Window { __nfcProbe: Probe; CapacitorCustomPlatform: { name: string } } }

async function setup(page: Page, native = true) {
  await page.addInitScript(() => {
    const listeners = new Map<string, { event: string; callback: (value: unknown) => void }>()
    let serial = 0
    const probe: Probe = { starts: [], cancels: [], confirmations: 0, availability: 'ready', canOpen: true, allow: true, releases: [], alarm: () => { for (const listener of listeners.values()) if (listener.event === 'alarmRinging') listener.callback({}) } }
    const methods = ['getNfcStatus', 'scanNfcAnchor', 'cancelNfcScan', 'confirmNfcAnchor', 'getAlarmState', 'getSmartWakeState', 'drainReminderActions', 'syncAlarmConfig', 'syncReminders', 'setReminderFocus', 'updateWidget']
    Object.assign(window, { __nfcProbe: probe, CapacitorCustomPlatform: { name: 'web' }, Capacitor: {
      PluginHeaders: [{ name: 'AnkerNative', methods: [...methods.map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }] }],
      nativeCallback(_plugin: string, _method: string, options: { eventName: string }, callback: (value: unknown) => void) {
        const id = String(++serial); listeners.set(id, { event: options.eventName, callback }); return id
      },
      async nativePromise(_plugin: string, method: string, options: { sessionId?: string; callbackId?: string }) {
        if (method === 'removeListener') { listeners.delete(options.callbackId ?? ''); return {} }
        if (method === 'getNfcStatus') return { status: probe.availability, canOpen: probe.canOpen }
        if (method === 'scanNfcAnchor') { probe.starts.push(options.sessionId!); return new Promise(resolve => probe.releases.push(resolve)) }
        if (method === 'cancelNfcScan') { probe.cancels.push(options.sessionId!); return {} }
        if (method === 'confirmNfcAnchor') {
          probe.confirmations++
          if (probe.holdConfirmation) return new Promise(resolve => { probe.confirmationRelease = resolve })
          return { allowed: probe.allow }
        }
        if (method === 'getAlarmState' || method === 'syncAlarmConfig') return { ringing: false, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: Date.now() + 86400_000 }
        if (method === 'drainReminderActions') return { actions: [] }
        if (method === 'getSmartWakeState') return { active: false, phase: 'idle' }
        return {}
      },
    } })
  })
  await page.clock.setFixedTime(new Date('2026-11-13T10:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await storedRecord<{ onboarded: boolean }>(page, 'settings', 'main'))?.onboarded).toBe(true)
  if (native) await page.evaluate(() => { window.CapacitorCustomPlatform.name = 'android' })
  await anchors(page)
}
async function anchors(page: Page) {
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await page.getByRole('link', { name: /Ankerpunkte/ }).click()
  await expect(page.getByRole('heading', { name: 'Ankerpunkte', exact: true })).toBeVisible()
}
async function scan(page: Page, starts = 1) {
  await page.getByRole('button', { name: 'Anker-Tag lesen', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__nfcProbe.starts.length)).toBe(starts)
}
async function release(page: Page, value: unknown, index = 0) { await page.evaluate(({ value, index }) => window.__nfcProbe.releases[index](value), { value, index }) }
async function visibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate(state => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: state }); document.dispatchEvent(new Event('visibilitychange')) }, state)
}
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')

test('Eintritt bleibt inaktiv; Tag zeigt nur neutrale Vorschau und öffnet erst ausdrücklich', async ({ page }) => {
  await setup(page)
  expect(await page.evaluate(() => window.__nfcProbe.starts)).toEqual([])
  const before = await local(page)
  await scan(page)
  await release(page, { status: 'read', target: 'prep' })
  await expect(page.getByRole('region', { name: 'Erkanntes Ankerziel' })).toBeVisible()
  await expect(page).toHaveURL(/\/anker$/)
  expect(await local(page)).toEqual(before)
  await page.getByRole('button', { name: 'Vorbereitung öffnen', exact: true }).dblclick()
  await expect(page).toHaveURL(/\/vorbereitung$/)
  expect(await page.evaluate(() => window.__nfcProbe.confirmations)).toBe(1)
  const after = await local(page)
  expect(after?.focus).toEqual(before?.focus)
  expect(after?.workSessions).toEqual(before?.workSessions)
})

test('Abwahl verändert keine gespeicherten Daten', async ({ page }) => {
  await setup(page); const before = await local(page)
  await scan(page); await release(page, { status: 'read', target: 'recover' })
  await page.getByRole('button', { name: 'Nicht öffnen', exact: true }).click()
  await expect(page.getByText('Ziel verworfen.', { exact: true })).toBeVisible()
  expect(await local(page)).toEqual(before)
  expect(await page.evaluate(() => window.__nfcProbe.confirmations)).toBe(0)
})

test('Abbruch und neue Sitzung verwerfen die verspätete alte Antwort', async ({ page }) => {
  await setup(page); await scan(page)
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
  await scan(page, 2)
  await release(page, { status: 'read', target: 'now' })
  await expect(page.getByRole('region', { name: 'Erkanntes Ankerziel' })).toHaveCount(0)
  await release(page, { status: 'read', target: 'recover' }, 1)
  await expect(page.getByRole('button', { name: 'Wiedereinstieg öffnen', exact: true })).toBeVisible()
  expect(await page.evaluate(() => new Set(window.__nfcProbe.starts).size)).toBe(2)
})

test('Pause verwirft Scanantwort; Resume startet keinen Reader', async ({ page }) => {
  await setup(page); await scan(page)
  await visibility(page, 'hidden'); await visibility(page, 'visible')
  await release(page, { status: 'read', target: 'prep' })
  await expect(page.getByRole('button', { name: 'Anker-Tag lesen', exact: true })).toBeEnabled()
  await expect(page.getByRole('region', { name: 'Erkanntes Ankerziel' })).toHaveCount(0)
  expect(await page.evaluate(() => window.__nfcProbe.starts.length)).toBe(1)
  expect(await page.evaluate(() => window.__nfcProbe.cancels.length)).toBeGreaterThan(0)
})

test('Wecker verwirft eine Vorschau und bleibt vorrangig', async ({ page }) => {
  await setup(page); await scan(page); await release(page, { status: 'read', target: 'now' })
  await expect(page.getByRole('button', { name: 'Jetzt öffnen', exact: true })).toBeVisible()
  await page.evaluate(() => { window.__nfcProbe.canOpen = false; window.__nfcProbe.availability = 'blocked'; window.__nfcProbe.alarm() })
  await expect(page.getByRole('region', { name: 'Erkanntes Ankerziel' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Jetzt manuell öffnen', exact: true }).click()
  await expect(page).toHaveURL(/\/anker$/)
})

test('Native Revalidierung kann nach Vorschau das Öffnen ablehnen', async ({ page }) => {
  await setup(page); await scan(page); await release(page, { status: 'read', target: 'recover' })
  await page.evaluate(() => { window.__nfcProbe.allow = false })
  await page.getByRole('button', { name: 'Wiedereinstieg öffnen', exact: true }).click()
  await expect(page.getByText(/Das Ziel kann gerade nicht geöffnet/)).toBeVisible()
  await expect(page).toHaveURL(/\/anker$/)
})

test('UI-Frist verwirft auch eine hängende Brücke und deren spätes Ergebnis', async ({ page }) => {
  await setup(page); await page.clock.install(); await scan(page)
  await page.clock.runFor(30_001)
  await expect(page.getByText(/Das Lesefenster ist zu Ende/)).toBeVisible()
  await release(page, { status: 'read', target: 'now' })
  await expect(page.getByRole('region', { name: 'Erkanntes Ankerziel' })).toHaveCount(0)
  expect(await page.evaluate(() => window.__nfcProbe.starts.length)).toBe(1)
})

test('Vorschau verfällt an der ursprünglichen Frist ohne neuen Scan', async ({ page }) => {
  await setup(page); await page.clock.install(); await scan(page)
  await page.clock.runFor(20_000)
  await release(page, { status: 'read', target: 'prep' })
  await expect(page.getByRole('button', { name: 'Vorbereitung öffnen', exact: true })).toBeVisible()
  await page.clock.runFor(10_001)
  await expect(page.getByRole('region', { name: 'Erkanntes Ankerziel' })).toHaveCount(0)
  await expect(page.getByText(/Das Lesefenster ist zu Ende/)).toBeVisible()
  expect(await page.evaluate(() => window.__nfcProbe.confirmations)).toBe(0)
})

test('Verlassen während Öffnungsbestätigung verwirft das verspätete Ja', async ({ page }) => {
  await setup(page); await scan(page); await release(page, { status: 'read', target: 'prep' })
  await page.evaluate(() => { window.__nfcProbe.holdConfirmation = true })
  await page.getByRole('button', { name: 'Vorbereitung öffnen', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__nfcProbe.confirmations)).toBe(1)
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await expect(page).toHaveURL(/\/mehr$/)
  await page.evaluate(() => window.__nfcProbe.confirmationRelease!({ allowed: true }))
  await expect(page).toHaveURL(/\/mehr$/)
  await page.getByRole('link', { name: /Ankerpunkte/ }).click()
  await expect(page.getByRole('region', { name: 'Erkanntes Ankerziel' })).toHaveCount(0)
  expect(await page.evaluate(() => window.__nfcProbe.starts.length)).toBe(1)
})

test('Navigationsbeginn verwirft ein Ja bereits vor dem React-Unmount', async ({ page }) => {
  await setup(page); await scan(page); await release(page, { status: 'read', target: 'prep' })
  const before = await local(page)
  await page.evaluate(() => { window.__nfcProbe.holdConfirmation = true })
  await page.getByRole('button', { name: 'Vorbereitung öffnen', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__nfcProbe.confirmations)).toBe(1)
  await page.evaluate(() => {
    const push = history.pushState.bind(history)
    history.pushState = (...args) => {
      push(...args)
      if (location.pathname === '/mehr') {
        history.pushState = push
        // Echte Linknavigation beibehalten; nur die Brückenantwort genau zwischen
        // Historywechsel und dem anschließenden Router-Render auflösen.
        window.__nfcProbe.confirmationRelease!({ allowed: true })
      }
    }
  })
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await expect(page).toHaveURL(/\/mehr$/)
  await expect(page.getByRole('link', { name: /Ankerpunkte/ })).toBeVisible()
  expect(await local(page)).toEqual(before)
  await page.getByRole('link', { name: /Ankerpunkte/ }).click()
  await expect(page.getByRole('region', { name: 'Erkanntes Ankerziel' })).toHaveCount(0)
  expect(await page.evaluate(() => window.__nfcProbe.starts.length)).toBe(1)
})

test('Doppeltipp startet nur eine Sitzung; große Vorschau bleibt bedienbar', async ({ page }, info) => {
  await setup(page); await page.setViewportSize({ width: 320, height: 740 })
  await page.evaluate(() => document.documentElement.style.setProperty('--font-scale', '1.6'))
  await page.getByRole('button', { name: 'Anker-Tag lesen', exact: true }).dblclick()
  await expect.poll(() => page.evaluate(() => window.__nfcProbe.starts.length)).toBe(1)
  await release(page, { status: 'read', target: 'recover' })
  await expect(page.getByRole('button', { name: 'Wiedereinstieg öffnen', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('nfc-preview-320.png'), fullPage: true })
  await page.getByRole('button', { name: 'Nicht öffnen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Anker-Tag lesen', exact: true })).toBeEnabled()
})

for (const result of [{ status: 'invalid' }, { status: 'timeout' }, { status: 'read', target: 'now', uid: 'PRIVATE-PAYLOAD' }, { status: 'read', target: '/fokus-start' }]) {
  test(`Ungültige oder beendete Antwort öffnet nichts: ${JSON.stringify(result)}`, async ({ page }) => {
    await setup(page); const before = await local(page)
    await scan(page); await release(page, result)
    await expect(page.getByRole('button', { name: 'Anker-Tag lesen', exact: true })).toBeEnabled()
    await expect(page.getByRole('region', { name: 'Erkanntes Ankerziel' })).toHaveCount(0)
    await expect(page.getByText('PRIVATE-PAYLOAD')).toHaveCount(0)
    expect(await local(page)).toEqual(before)
    await expect(page).toHaveURL(/\/anker$/)
  })
}

for (const availability of ['unsupported', 'disabled']) {
  test(`Android ${availability} behält manuelle Wege ohne Scan`, async ({ page }) => {
    await setup(page)
    await page.evaluate(value => { window.__nfcProbe.availability = value }, availability)
    await page.getByRole('button', { name: 'Status prüfen', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Anker-Tag lesen', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Jetzt manuell öffnen', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    expect(await page.evaluate(() => window.__nfcProbe.starts)).toEqual([])
  })
}

test('Web bleibt manuell; 320px mit großer Schrift bleibt ohne Überlauf bedienbar', async ({ page }) => {
  await setup(page, false); await page.setViewportSize({ width: 320, height: 740 })
  await page.evaluate(() => document.documentElement.style.setProperty('--font-scale', '1.6'))
  await expect(page.getByRole('button', { name: 'Anker-Tag lesen', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  for (const name of ['Jetzt', 'Vorbereitung', 'Wiedereinstieg']) await expect(page.getByRole('button', { name: `${name} manuell öffnen`, exact: true })).toBeEnabled()
  const before = await local(page)
  await page.getByRole('button', { name: 'Wiedereinstieg manuell öffnen', exact: true }).click()
  await expect(page).toHaveURL(/\/wiedereinstieg$/)
  expect((await local(page))?.focus).toEqual(before?.focus)
  expect((await local(page))?.workSessions).toEqual(before?.workSessions)
  expect(await page.evaluate(() => window.__nfcProbe.starts)).toEqual([])
})

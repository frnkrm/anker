/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultSettings } from '../src/core/defaults'

interface BridgeProbe {
  launchReads: number
  focusUntil: number
  listeners: Record<string, number>
  emit: (plugin: string, event: string, value: { url: string } | Record<string, never>) => void
  setRinging: (ringing: boolean) => void
}

/** Browser simulation of Capacitor entry events, not an Android execution test. */
async function nativeEntry(page: Page, launchUrl: string, measurementEnabled = false) {
  const settings = { ...defaultSettings('2026-11-05'), onboarded: true }
  settings.alarm.preWakeEnabled = measurementEnabled
  settings.alarm.smartWake.enabled = measurementEnabled
  await page.addInitScript(({ launchUrl, settings }) => {
    const callbacks = new Map<string, { plugin: string; event: string; callback: (value: unknown) => void }>()
    let nextId = 0
    const alarm = { ringing: false, kind: null as string | null, snoozed: 0, scheduledAt: new Date('2026-11-06T06:30:00+01:00').getTime(), preWakeAt: new Date('2026-11-06T06:00:00+01:00').getTime() as number | null, preWakePausedForTargetAt: 0, exact: true, mainConfirmed: true, preWakeConfirmed: true }
    let measurementActive = false
    const records = [{ collection: 'settings', id: 'main', data: JSON.stringify(settings), updated_at: Date.now(), deleted: 0, dirty: 0 }]
    const probe: BridgeProbe = {
      launchReads: 0,
      focusUntil: 0,
      listeners: {},
      emit(plugin, event, value) {
        for (const entry of [...callbacks.values()]) {
          if (entry.plugin === plugin && entry.event === event) entry.callback(value)
        }
      },
      setRinging(ringing) { alarm.ringing = ringing; alarm.kind = ringing ? 'test' : null },
    }
    Object.assign(window, {
      __ankerBridge: probe,
      CapacitorCustomPlatform: { name: 'android' },
      Capacitor: {
        PluginHeaders: [
          { name: 'App', methods: ['getLaunchUrl', 'getInfo', 'removeListener'].map((name) => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
          { name: 'AnkerNative', methods: ['getAlarmState', 'getAlarmDiagnostics', 'getSmartWakeState', 'startSmartWake', 'stopSmartWake', 'syncAlarmConfig', 'drainReminderActions', 'setReminderFocus', 'removeListener'].map((name) => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
          { name: 'CapacitorSQLite', methods: ['checkConnectionsConsistency', 'createConnection', 'open', 'execute', 'executeSet', 'query', 'run'].map((name) => ({ name, rtype: 'promise' })) },
        ],
        async nativePromise(plugin: string, method: string, options: { callbackId?: string; values?: (string | number)[]; set?: { values: (string | number)[] }[]; until?: number }) {
          if (method === 'removeListener') { callbacks.delete(options.callbackId!); return {} }
          if (plugin === 'App' && method === 'getLaunchUrl') { probe.launchReads++; return { url: launchUrl } }
          if (plugin === 'App' && method === 'getInfo') return { id: 'de.frnkrm.anker', name: 'Anker', version: 'simulation', build: '0' }
          if (plugin === 'AnkerNative' && (method === 'getAlarmState' || method === 'syncAlarmConfig')) return { ...alarm }
          if (plugin === 'AnkerNative' && method === 'getAlarmDiagnostics') return { ...alarm, notificationsEnabled: true, fullScreen: true, alarmVolume: 5, alarmVolumeMax: 7, audioOk: true, interruptionFilter: 1, testResult: '', sdk: 36, device: 'Browser simulation' }
          if (plugin === 'AnkerNative' && method === 'getSmartWakeState') return { active: measurementActive, phase: measurementActive ? 'waiting' : 'stopped', targetAt: alarm.scheduledAt, windowAt: alarm.scheduledAt - 45 * 60_000, hasMotion: true, microphoneGranted: true, preWakePausedForTargetAt: alarm.preWakePausedForTargetAt, message: measurementActive ? 'Vorbereitet.' : 'Beendet.' }
          if (plugin === 'AnkerNative' && method === 'startSmartWake') { measurementActive = true; alarm.preWakeAt = null; alarm.preWakePausedForTargetAt = alarm.scheduledAt; return {} }
          if (plugin === 'AnkerNative' && method === 'stopSmartWake') { measurementActive = false; return {} }
          if (plugin === 'AnkerNative' && method === 'setReminderFocus') { probe.focusUntil = options.until ?? 0; return {} }
          if (plugin === 'AnkerNative' && method === 'drainReminderActions') return { actions: [] }
          if (plugin === 'CapacitorSQLite') {
            if (method === 'checkConnectionsConsistency') return { result: false }
            if (method === 'query') return { values: records.filter((r) => !options.values?.length || (r.collection === options.values[0] && (!options.values[1] || r.id === options.values[1]))) }
            if (method === 'run' || method === 'executeSet') {
              const writes = method === 'executeSet' ? options.set!.map((entry) => entry.values) : [options.values!]
              for (const values of writes) {
                const [collection, id, data, updated_at, deleted, dirty] = values as [string, string, string, number, number, number]
                const index = records.findIndex((r) => r.collection === collection && r.id === id)
                const row = { collection, id, data, updated_at, deleted, dirty }
                if (index < 0) records.push(row); else records[index] = row
              }
            }
            return {}
          }
          throw new Error(`Unexpected native method: ${plugin}.${method}`)
        },
        nativeCallback(plugin: string, method: string, options: { eventName: string }, callback: (value: unknown) => void) {
          if (method !== 'addListener') throw new Error(`Unexpected native callback: ${plugin}.${method}`)
          const id = String(++nextId)
          callbacks.set(id, { plugin, event: options.eventName, callback })
          const key = `${plugin}.${options.eventName}`
          probe.listeners[key] = (probe.listeners[key] ?? 0) + 1
          return id
        },
      },
    })
  }, { launchUrl, settings })
  await page.clock.setFixedTime(new Date('2026-11-06T02:00:00+01:00'))
  await page.goto('/')
  await expect.poll(async () => (await probe(page)).launchReads).toBe(1)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gute Nacht')
}

async function probe(page: Page) {
  return page.evaluate(() => {
    const bridge = (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge
    return { launchReads: bridge.launchReads, listeners: bridge.listeners }
  })
}

for (const target of ['now', 'alarm']) {
  test(`Alter ${target}-Öffnungslink sperrt die Navigation bei Gute Nacht nicht`, async ({ page }) => {
    await nativeEntry(page, `de.frnkrm.anker://${target}`)
    const before = await probe(page)
    await page.getByRole('link', { name: 'Mehr', exact: true }).click()
    await expect(page.getByRole('link', { name: /Gemeinsam testen/ })).toBeVisible()
    await page.getByRole('link', { name: /Gemeinsam testen/ }).click()
    await expect(page.getByLabel('Test auswählen', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Zeiteingabe prüfen', exact: true }).click()
    await page.getByRole('button', { name: 'Uhrzeiten direkt ändern', exact: true }).click()
    await expect(page.getByLabel('PC-Stopp', { exact: true })).toBeVisible()
    expect(await probe(page)).toEqual(before)
    expect(before.launchReads).toBe(1)
    expect(before.listeners['App.appUrlOpen']).toBe(1)
    expect(before.listeners['AnkerNative.alarmRinging']).toBeGreaterThanOrEqual(1)
  })
}

test('Neue native Links und ein echter Klingelzustand bleiben nach Seitenwechsel erreichbar', async ({ page }) => {
  await nativeEntry(page, 'de.frnkrm.anker://now')
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await expect(page.getByRole('link', { name: /Gemeinsam testen/ })).toBeVisible()
  await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.emit('App', 'appUrlOpen', { url: 'de.frnkrm.anker://evening' }))
  await expect(page).toHaveURL(/\/abend$/)
  await expect(page.getByRole('heading', { name: 'Abend & morgen', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const bridge = (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge
    bridge.setRinging(true)
    bridge.emit('AnkerNative', 'alarmRinging', {})
  })
  await expect(page.getByRole('button', { name: 'Test beenden', exact: true })).toBeVisible()
  await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.emit('App', 'appUrlOpen', { url: 'de.frnkrm.anker://thoughts' }))
  await expect(page).toHaveURL(/\/wecker\/klingelt$/)
  expect((await probe(page)).launchReads).toBe(1)
})

test('Messnacht zeigt die Vorweckerpause vor Start, im Status und nach Messungsende', async ({ page }) => {
  await nativeEntry(page, 'de.frnkrm.anker://now', true)
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await page.getByRole('link', { name: /Wecker & QR-Code/ }).click()
  await expect(page.getByText(/Beim Start wird der Vorwecker für diese Nacht pausiert/)).toBeVisible()
  await page.getByRole('button', { name: 'Messung für diese Nacht starten', exact: true }).click()
  await expect(page.getByText(/Vorwecker für .* pausiert\./)).toBeVisible()
  await expect(page.getByText('Vorwecker: für diese Messnacht pausiert', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Messung beenden', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Messung für diese Nacht starten', exact: true })).toBeVisible()
  await expect(page.getByText(/Vorwecker für .* pausiert\./)).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Vorwecker', exact: true })).toBeChecked()
})

test('Laufender Fokus spiegelt nur sein tatsächliches Timerende und räumt beim Verlassen auf', async ({ page }) => {
  await nativeEntry(page, 'de.frnkrm.anker://now')
  await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.emit('App', 'appUrlOpen', { url: 'de.frnkrm.anker://now' }))
  // A real route transition without reloading the native session.
  await page.getByRole('link', { name: 'Tag', exact: true }).click()
  await page.evaluate(() => { history.pushState({}, '', '/fokus/morning'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.getByRole('link', { name: 'Fokus-Modus verlassen', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.focusUntil)).toBeGreaterThan(new Date('2026-11-06T02:00:00+01:00').getTime())
  await page.getByRole('link', { name: 'Fokus-Modus verlassen', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.focusUntil)).toBe(0)
})

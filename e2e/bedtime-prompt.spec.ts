/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultSettings, emptyLocal } from '../src/core/defaults'
import { initialGame, XP } from '../src/core/game'
import type { BedtimePromptState } from '../src/platform/bedtimePrompt'
import type { Settings } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const START = Date.parse('2026-11-06T23:30:00+01:00')
const TEXT = 'Deine geplante Einschlafzeit ist erreicht. Du entscheidest, wie du weitermachst.'
interface SqlRow { collection: string; id: string; data: string; updated_at: number; deleted: number; dirty: number }
interface BedtimeProbe {
  state: BedtimePromptState
  calls: { method: string; options: Record<string, unknown> }[]
  records: SqlRow[]
  holdNextRead: boolean
  pendingReads: number
  release: (() => void)[]
  grant: (granted: boolean) => void
  phase: (phase: BedtimePromptState['phase'], reason?: string) => void
  appActive: (active: boolean) => void
}

/** Kontrollierte Capacitor-/SQLite-Brücke. Dies prüft weder Android-Overlays noch Entsperrung am Gerät. */
async function nativeBedtime(page: Page, options: { granted?: boolean; delay?: number; daytime?: boolean; waiting?: boolean } = {}) {
  const settings = { ...defaultSettings('2026-11-06'), onboarded: true }
  settings.sleep.fallAsleepMin = options.delay ?? 15
  settings.sleep.bedtimePromptEnabled = true
  const now = options.daytime ? Date.parse('2026-11-06T10:00:00+01:00') : START
  await page.clock.setFixedTime(new Date(now))
  await page.addInitScript(({ settings, local, game, options, now }) => {
    const listeners = new Map<string, { event: string; callback: (value: unknown) => void }>()
    let listenerId = 0
    let session = 0
    const initial: BedtimePromptState = { phase: options.waiting ? 'waiting' : 'idle', overlayPermission: options.granted ?? false, exact: true, ...(options.waiting ? { sessionId: 'existing-session', dueAt: now + 900_000 } : {}) }
    const cachedState = localStorage.getItem('bedtime-native-fixture')
    const alarm = { ringing: false, snoozed: 0, exact: true, mainConfirmed: true, preWakeConfirmed: true, scheduledAt: Date.parse('2026-11-07T06:30:00+01:00') }
    const savedRecords = localStorage.getItem('bedtime-sqlite-fixture')
    const records: SqlRow[] = savedRecords ? JSON.parse(savedRecords) as SqlRow[] : [
      { collection: 'settings', id: 'main', data: JSON.stringify(settings), updated_at: now, deleted: 0, dirty: 0 },
      { collection: 'meta', id: 'local', data: JSON.stringify(local), updated_at: now, deleted: 0, dirty: 0 },
      { collection: 'game', id: 'main', data: JSON.stringify(game), updated_at: now, deleted: 0, dirty: 0 },
    ]
    const persistState = () => localStorage.setItem('bedtime-native-fixture', JSON.stringify(probe.state))
    const changed = () => { persistState(); for (const listener of listeners.values()) if (listener.event === 'bedtimePromptChanged') listener.callback({ ...probe.state }) }
    const probe: BedtimeProbe = {
      state: cachedState ? JSON.parse(cachedState) as BedtimePromptState : initial,
      records, calls: [], holdNextRead: false, pendingReads: 0, release: [],
      grant(granted) { probe.state.overlayPermission = granted; changed() },
      phase(phase, reason) { probe.state = { ...probe.state, phase, reason }; changed() },
      appActive(isActive) { for (const listener of listeners.values()) if (listener.event === 'appStateChange') listener.callback({ isActive }) },
    }
    const bedtime = ['getBedtimePromptState', 'startBedtimePrompt', 'stopBedtimePrompt', 'ackBedtimePrompt', 'openOverlayPermissionSettings']
    const common = ['getAlarmState', 'getAlarmDiagnostics', 'getSmartWakeState', 'syncAlarmConfig', 'syncReminders', 'drainReminderActions', 'ackReminderActions', 'setReminderFocus', 'updateWidget', 'getGeofenceState', 'ackGeofenceSuggestions', 'stopSpeaking']
    Object.assign(window, { __bedtimeProbe: probe, CapacitorCustomPlatform: { name: 'android' }, Capacitor: {
      PluginHeaders: [
        { name: 'App', methods: ['getLaunchUrl', 'getInfo', 'removeListener'].map((name) => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
        { name: 'AnkerNative', methods: [...bedtime, ...common, 'removeListener'].map((name) => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
        { name: 'CapacitorSQLite', methods: ['checkConnectionsConsistency', 'createConnection', 'open', 'execute', 'executeSet', 'query', 'run'].map((name) => ({ name, rtype: 'promise' })) },
      ],
      async nativePromise(plugin: string, method: string, raw: Record<string, unknown> = {}) {
        if (method === 'removeListener') { listeners.delete(String(raw.callbackId)); return {} }
        if (plugin === 'App') return method === 'getLaunchUrl' ? { url: 'de.frnkrm.anker.mobile://now' } : { id: 'de.frnkrm.anker.mobile', name: 'Anker', version: 'Browserfixture', build: '0' }
        if (plugin === 'AnkerNative') {
          if (bedtime.includes(method)) probe.calls.push({ method, options: { ...raw } })
          if (method === 'getBedtimePromptState') {
            const value = { ...probe.state }
            if (probe.holdNextRead) {
              probe.holdNextRead = false; probe.pendingReads++
              return await new Promise<BedtimePromptState>((resolve) => probe.release.push(() => { probe.pendingReads--; resolve(value) }))
            }
            return value
          }
          if (method === 'startBedtimePrompt') {
            if (!probe.state.overlayPermission) throw new Error('overlay-permission-required')
            if (!Number.isInteger(raw.delayMinutes) || Number(raw.delayMinutes) < 0 || Number(raw.delayMinutes) > 60) throw new Error('invalid-delay')
            probe.state = { phase: raw.delayMinutes === 0 ? 'shown' : 'waiting', sessionId: `fixture-session-${++session}`, dueAt: Date.now() + Number(raw.delayMinutes) * 60_000, overlayPermission: true, exact: true }
            changed(); return {}
          }
          if (method === 'stopBedtimePrompt' && (!raw.sessionId || raw.sessionId === probe.state.sessionId)) {
            probe.state = { phase: 'idle', overlayPermission: probe.state.overlayPermission, exact: true, reason: 'stopped' }; changed(); return {}
          }
          if (method === 'ackBedtimePrompt' && raw.sessionId === probe.state.sessionId && probe.state.phase === 'shown') {
            probe.state = { phase: 'idle', overlayPermission: probe.state.overlayPermission, exact: true, reason: 'acknowledged' }; changed(); return {}
          }
          if (method === 'openOverlayPermissionSettings' || method === 'stopBedtimePrompt' || method === 'ackBedtimePrompt') return {}
          if (method === 'getAlarmState' || method === 'syncAlarmConfig') return alarm
          if (method === 'getAlarmDiagnostics') return { ...alarm, notificationsEnabled: true, fullScreen: true, sdk: 36, device: 'Browserfixture', alarmVolume: 5, alarmVolumeMax: 7 }
          if (method === 'getSmartWakeState') return { active: false, phase: 'idle', message: '', targetAt: 0, windowAt: 0, hasMotion: true, microphoneGranted: false }
          if (method === 'drainReminderActions') return { actions: [] }
          if (method === 'getGeofenceState') return { registered: 0, fineGranted: false, backgroundGranted: false, suggestions: [] }
          return {}
        }
        if (plugin === 'CapacitorSQLite') {
          const values = raw.values as (string | number)[] | undefined
          if (method === 'checkConnectionsConsistency') return { result: false }
          if (method === 'query') return { values: records.filter((row) => !values?.length || (row.collection === values[0] && (!values[1] || row.id === values[1]))) }
          if (method === 'run' || method === 'executeSet') {
            const writes = method === 'executeSet' ? (raw.set as { values: (string | number)[] }[]).map((entry) => entry.values) : [values!]
            for (const write of writes) {
              const [collection, id, data, updated_at, deleted, dirty] = write as [string, string, string, number, number, number]
              const row = { collection, id, data, updated_at, deleted, dirty }
              const index = records.findIndex((old) => old.collection === collection && old.id === id)
              if (index < 0) records.push(row); else records[index] = row
            }
            localStorage.setItem('bedtime-sqlite-fixture', JSON.stringify(records))
          }
          return {}
        }
        throw new Error(`Unexpected native method ${plugin}.${method}`)
      },
      nativeCallback(_plugin: string, method: string, options: { eventName: string }, callback: (value: unknown) => void) {
        if (method !== 'addListener') throw new Error(`Unexpected native callback ${method}`)
        const id = String(++listenerId); listeners.set(id, { event: options.eventName, callback }); return id
      },
    } })
  }, { settings, local: emptyLocal(), game: initialGame('2026-11-06'), options, now })
  await page.goto('/')
  if (!options.daytime) await expect(page.getByRole('heading', { name: 'Ab ins Bett', exact: true })).toBeVisible()
  if (options.waiting) await openControls(page)
  if (!options.daytime || options.waiting) await expect.poll(async () => (await probe(page)).calls.filter((call) => call.method === 'getBedtimePromptState').length).toBeGreaterThan(0)
}

async function probe(page: Page) {
  return page.evaluate(() => {
    const value = (window as unknown as { __bedtimeProbe: BedtimeProbe }).__bedtimeProbe
    return { state: value.state, calls: value.calls, records: value.records, pendingReads: value.pendingReads }
  })
}
const starts = async (page: Page) => (await probe(page)).calls.filter((call) => call.method === 'startBedtimePrompt')
const stored = async (page: Page) => (await probe(page)).records.map((row) => ({ collection: row.collection, id: row.id, data: row.data })).sort((a, b) => `${a.collection}:${a.id}`.localeCompare(`${b.collection}:${b.id}`))

async function openControls(page: Page) {
  if (!(await page.getByRole('dialog', { name: 'Heute anpassen', exact: true }).count())) {
    await page.getByRole('button', { name: 'Heute anpassen', exact: true }).click()
    await page.getByRole('dialog').getByText('Weitere Möglichkeiten', { exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: 'Stummer Schlafhinweis', exact: true })).toBeVisible()
}
async function closeControls(page: Page) { await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0) }
const withoutBedRewards = async (page: Page) => (await stored(page)).filter((row) => !['days', 'game'].includes(row.collection))

test('Eigene Aktivierung und Android-Freigabe starten nichts; die kombinierte Betthandlung startet bewusst', async ({ page }) => {
  await nativeBedtime(page)
  expect(await starts(page)).toEqual([])
  await openControls(page)
  await page.getByRole('button', { name: 'Android-Freigabe einrichten', exact: true }).click()
  expect((await probe(page)).calls.filter((call) => call.method === 'openOverlayPermissionSettings')).toHaveLength(1)
  expect(await starts(page)).toEqual([])
  await page.evaluate(() => (window as unknown as { __bedtimeProbe: BedtimeProbe }).__bedtimeProbe.grant(true))
  await expect(page.getByText('Bereit. „Ich liege im Bett“ startet den Hinweis nach deiner Einschlafzeit.', { exact: true })).toBeVisible()
  expect(await starts(page)).toEqual([])
  const before = await withoutBedRewards(page)
  const xpBefore = JSON.parse((await probe(page)).records.find(row => row.collection === 'game')!.data).xp
  await closeControls(page)
  await page.getByRole('button', { name: 'Ich liege im Bett', exact: true }).click()
  await expect.poll(async () => (await starts(page)).length).toBe(1)
  expect((await starts(page))[0]?.options.delayMinutes).toBe(15)
  const day = (await probe(page)).records.find((row) => row.collection === 'days')
  expect(JSON.parse(day!.data).bedAt).toBe(START)
  expect(JSON.parse((await probe(page)).records.find(row => row.collection === 'game')!.data).xp).toBe(xpBefore + XP.bonusBed)
  await openControls(page)
  await page.getByRole('button', { name: 'Schlafhinweis abbrechen', exact: true }).click()
  await expect(page.getByText('Bereit. „Ich liege im Bett“ startet den Hinweis nach deiner Einschlafzeit.', { exact: true })).toBeVisible()
  expect(await withoutBedRewards(page)).toEqual(before)
})

test('Nur nativer shown-Status zeigt die Info; Bestätigen erhält Navigation und alle gespeicherten Handlungen', async ({ page }) => {
  await nativeBedtime(page, { granted: true })
  await page.getByRole('button', { name: 'Ich liege im Bett', exact: true }).click()
  await openControls(page)
  const before = await stored(page)
  const sessionId = (await probe(page)).state.sessionId
  await page.clock.setFixedTime(new Date(START + 20 * 60_000))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
  await expect(page.getByText(TEXT, { exact: true })).toHaveCount(0)
  await page.evaluate(() => { const value = (window as unknown as { __bedtimeProbe: BedtimeProbe }).__bedtimeProbe; value.appActive(false); value.phase('shown') })
  await expect(page.getByText(TEXT, { exact: true })).toHaveCount(0)
  expect((await probe(page)).calls.filter((call) => call.method === 'ackBedtimePrompt')).toHaveLength(0)
  await page.evaluate(() => (window as unknown as { __bedtimeProbe: BedtimeProbe }).__bedtimeProbe.appActive(true))
  await expect(page.getByText(TEXT, { exact: true })).toBeVisible()
  await page.evaluate(() => (window as unknown as { __bedtimeProbe: BedtimeProbe }).__bedtimeProbe.appActive(false))
  await page.getByRole('button', { name: 'Hinweis beenden', exact: true }).click()
  expect((await probe(page)).calls.filter((call) => call.method === 'ackBedtimePrompt')).toHaveLength(0)
  await page.evaluate(() => (window as unknown as { __bedtimeProbe: BedtimeProbe }).__bedtimeProbe.appActive(true))
  await page.getByRole('button', { name: 'Hinweis beenden', exact: true }).click()
  await expect(page.getByText(TEXT, { exact: true })).toHaveCount(0)
  expect((await probe(page)).calls.find((call) => call.method === 'ackBedtimePrompt')?.options.sessionId).toBe(sessionId)
  expect(await stored(page)).toEqual(before)
  await closeControls(page)
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await expect(page).toHaveURL(/\/mehr$/)
  await expect(page.getByRole('heading', { name: 'Mehr', exact: true })).toBeVisible()
})

test('Bekannte Sitzung bleibt tagsüber erreichbar; ausgelassener Hinweis startet nach Rückkehr nicht neu', async ({ page }) => {
  await nativeBedtime(page, { granted: true, daytime: true, waiting: true })
  await expect(page.getByRole('button', { name: 'Schlafhinweis abbrechen', exact: true })).toBeVisible()
  expect(await starts(page)).toEqual([])
  await page.evaluate(() => (window as unknown as { __bedtimeProbe: BedtimeProbe }).__bedtimeProbe.phase('skipped', 'locked'))
  await expect(page.getByText('Das Handy war gesperrt. Dieser Schlafhinweis wurde ausgelassen.', { exact: true })).toBeVisible()
  await page.reload(); await openControls(page)
  await expect(page.getByText('Das Handy war gesperrt. Dieser Schlafhinweis wurde ausgelassen.', { exact: true })).toBeVisible()
  expect(await starts(page)).toEqual([])
  await page.getByRole('button', { name: 'Status schließen', exact: true }).click()
  await expect(page.getByText('Das Handy war gesperrt. Dieser Schlafhinweis wurde ausgelassen.', { exact: true })).toHaveCount(0)
})

test('Späte Statusantwort macht einen abgebrochenen Hinweis nicht wieder aktiv', async ({ page }) => {
  await nativeBedtime(page, { granted: true, waiting: true })
  await page.evaluate(() => { (window as unknown as { __bedtimeProbe: BedtimeProbe }).__bedtimeProbe.holdNextRead = true })
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
  await expect.poll(async () => (await probe(page)).pendingReads).toBe(1)
  await page.getByRole('button', { name: 'Schlafhinweis abbrechen', exact: true }).click()
  await expect(page.getByText('Bereit. „Ich liege im Bett“ startet den Hinweis nach deiner Einschlafzeit.', { exact: true })).toBeVisible()
  await page.evaluate(() => { for (const release of (window as unknown as { __bedtimeProbe: BedtimeProbe }).__bedtimeProbe.release.splice(0)) release() })
  await expect.poll(async () => (await probe(page)).pendingReads).toBe(0)
  await expect(page.getByRole('button', { name: 'Schlafhinweis abbrechen', exact: true })).toHaveCount(0)
  expect((await probe(page)).state.phase).toBe('idle')
})

test('Native Zustandsänderung während eines gehaltenen Reads wird frisch gelesen', async ({ page }) => {
  await nativeBedtime(page, { granted: true, waiting: true })
  await page.evaluate(() => (window as unknown as { __bedtimeProbe: BedtimeProbe }).__bedtimeProbe.phase('shown'))
  await expect(page.getByText(TEXT, { exact: true })).toBeVisible()
  await page.evaluate(() => { (window as unknown as { __bedtimeProbe: BedtimeProbe }).__bedtimeProbe.holdNextRead = true })
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
  await expect.poll(async () => (await probe(page)).pendingReads).toBe(1)
  await page.evaluate(() => { const value = (window as unknown as { __bedtimeProbe: BedtimeProbe }).__bedtimeProbe; value.phase('skipped', 'expired'); for (const release of value.release.splice(0)) release() })
  await expect(page.getByText('Der vorgesehene Zeitpunkt ist verstrichen. Dieser Schlafhinweis wird nicht nachgeholt.', { exact: true })).toBeVisible()
  await expect(page.getByText(TEXT, { exact: true })).toHaveCount(0)
  expect((await probe(page)).calls.filter((call) => call.method === 'ackBedtimePrompt')).toHaveLength(0)
})

test('Null Minuten starten nur bewusst; große Schrift und Tastatur halten den Hinweis bedienbar', async ({ page }, testInfo) => {
  await nativeBedtime(page, { granted: true, delay: 0 })
  expect(await starts(page)).toEqual([])
  await page.setViewportSize({ width: 320, height: 740 })
  await page.evaluate(() => document.documentElement.style.fontSize = '160%')
  const button = page.getByRole('button', { name: 'Ich liege im Bett', exact: true })
  await button.focus(); await page.keyboard.press('Enter')
  await expect(page.getByText(TEXT, { exact: true })).toBeVisible()
  expect((await starts(page))[0]?.options.delayMinutes).toBe(0)
  await openControls(page)
  const done = page.getByRole('button', { name: 'Hinweis beenden', exact: true })
  expect((await done.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: testInfo.outputPath('schlafhinweis-320.png'), fullPage: true })
  await done.focus(); await page.keyboard.press('Enter')
  await expect(page.getByText(TEXT, { exact: true })).toHaveCount(0)
})

test('Einschlafdauer60Minuten wird unverändert an den bewussten Bettstart übergeben', async ({ page }) => {
  await nativeBedtime(page, { granted: true, delay: 60 })
  expect(await starts(page)).toEqual([])
  await page.getByRole('button', { name: 'Ich liege im Bett', exact: true }).click()
  await expect.poll(async () => (await starts(page)).length).toBe(1)
  expect((await starts(page))[0]?.options.delayMinutes).toBe(60)
  expect((await probe(page)).state.dueAt).toBe(START + 3_600_000)
})

test('Im Tageskontext ohne Sitzung erscheint kein Schlafhinweis-Start', async ({ page }) => {
  await nativeBedtime(page, { granted: true, daytime: true })
  await expect(page.getByRole('heading', { name: 'Stummer Schlafhinweis', exact: true })).toHaveCount(0)
  expect(await starts(page)).toEqual([])
})

test('Web startet keine native Messung und beschreibt die Grenze nur bei aktivierter Option', async ({ page }) => {
  await page.clock.setFixedTime(new Date(START))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  expect(settings.sleep.bedtimePromptEnabled).toBe(false)
  await expect(page.getByText('Im Browser wird kein Schlafhinweis gestartet.', { exact: true })).toHaveCount(0)
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: { ...settings, sleep: { ...settings.sleep, bedtimePromptEnabled: true } } }])
  await page.reload()
  await expect(page.getByText('Im Browser wird kein Schlafhinweis gestartet.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Android-Freigabe einrichten', exact: true })).toHaveCount(0)
})

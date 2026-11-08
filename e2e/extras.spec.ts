/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { LocalData, Settings, InboxItem } from '../src/core/types'
import { storedRecord } from './helpers/storage'
import { openTodayAdjust } from './helpers/controls'

const START = Date.parse('2026-11-06T10:00:00+01:00')
interface VoiceProbe { starts: number; cancels: number; pending: number; speaks: string[]; stops: number; release: ((value: { status: string; text?: string }) => void)[]; backListeners: number; back: () => void }
async function onboard(page: Page, bridge = false) {
  if (bridge) await page.addInitScript(() => {
    const listeners = new Map<string, (value: { canGoBack: boolean }) => void>()
    let listenerId = 0
    const probe: VoiceProbe = { starts: 0, cancels: 0, pending: 0, speaks: [], stops: 0, release: [], backListeners: 0, back: () => { for (const listener of listeners.values()) listener({ canGoBack: true }) } }
    const methods = ['getVoiceCapabilities', 'startDictation', 'stopDictation', 'speakCue', 'stopSpeaking', 'getAlarmState', 'syncAlarmConfig', 'syncReminders', 'drainReminderActions', 'ackReminderActions', 'setReminderFocus', 'updateWidget', 'vibratePulse', 'getSmartWakeState', 'openFocusSettings']
    Object.assign(window, { __voiceProbe: probe, CapacitorCustomPlatform: { name: 'web' }, Capacitor: {
      PluginHeaders: [
        { name: 'AnkerNative', methods: methods.map((name) => ({ name, rtype: 'promise' })) },
        { name: 'App', methods: [{ name: 'removeListener', rtype: 'promise' }, { name: 'addListener', rtype: 'callback' }] },
      ],
      nativeCallback(plugin: string, _method: string, options: { eventName: string }, callback: (value: { canGoBack: boolean }) => void) {
        const id = String(++listenerId)
        if (plugin === 'App' && options.eventName === 'backButton') { listeners.set(id, callback); probe.backListeners = listeners.size }
        return id
      },
      async nativePromise(plugin: string, method: string, options: { text?: string; callbackId?: string }) {
        if (plugin === 'App' && method === 'removeListener') { listeners.delete(options.callbackId ?? ''); probe.backListeners = listeners.size; return {} }
        if (method === 'getVoiceCapabilities') return { dictationSupported: true, speechSupported: true, localOnly: true }
        if (method === 'startDictation') { probe.starts++; probe.pending++; const result = await new Promise<{ status: string; text?: string }>((resolve) => probe.release.push(resolve)); probe.pending--; return result }
        if (method === 'stopDictation') { probe.cancels++; return {} }
        if (method === 'speakCue') { probe.speaks.push(options.text ?? ''); return { status: 'spoken' } }
        if (method === 'stopSpeaking') { probe.stops++; return {} }
        if (method === 'getAlarmState' || method === 'syncAlarmConfig') return { ringing: false, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: Date.now() + 86400_000 }
        if (method === 'drainReminderActions') return { actions: [] }
        if (method === 'getSmartWakeState') return { active: false, phase: 'idle', message: '', targetAt: 0, windowAt: 0, hasMotion: true, microphoneGranted: true }
        if (method === 'openFocusSettings') return { opened: false, destination: 'unavailable' }
        return {}
      },
    } })
  })
  await page.clock.setFixedTime(new Date(START))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}
async function native(page: Page) { await page.evaluate(() => { (window as unknown as { CapacitorCustomPlatform: { name: string } }).CapacitorCustomPlatform.name = 'android' }) }
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
const settings = (page: Page) => storedRecord<Settings>(page, 'settings', 'main')
const probe = (page: Page) => page.evaluate(() => { const value = (window as unknown as { __voiceProbe: VoiceProbe }).__voiceProbe; return { starts: value.starts, pending: value.pending, cancels: value.cancels, speaks: value.speaks, stops: value.stops } })
async function result(page: Page, text: string) { await page.evaluate((text) => { const value = (window as unknown as { __voiceProbe: VoiceProbe }).__voiceProbe; for (const release of value.release.splice(0)) release({ status: 'text', text }) }, text) }
async function openCapture(page: Page) {
  await openTodayAdjust(page)
  await page.getByRole('button', { name: 'Gedanke festhalten', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Gedanke festhalten', exact: true })).toBeVisible()
}
async function enableDictation(page: Page) {
  await page.getByRole('button', { name: 'Diktieren', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Lokales Diktieren', exact: true })).toBeVisible()
  expect((await probe(page)).starts).toBe(0)
  await page.getByRole('button', { name: 'Einschalten', exact: true }).click()
  await expect.poll(async () => (await settings(page))?.extras?.dictation).toBe(true)
}

test('Lokales Diktieren beginnt erst nach Einwilligung und Start; Text bleibt ein bearbeitbarer Entwurf', async ({ page }) => {
  await onboard(page, true); await native(page)
  expect((await settings(page))?.extras?.dictation ?? false).toBe(false)
  await openCapture(page)
  await enableDictation(page)
  await page.getByRole('button', { name: 'Diktieren', exact: true }).click()
  await expect.poll(async () => (await probe(page)).starts).toBe(1)
  await page.getByRole('textbox', { name: 'Gedanke', exact: true }).fill('Manuelle Idee')
  await result(page, 'Gesprochene Ergänzung')
  await expect(page.getByRole('textbox', { name: 'Gedanke', exact: true })).toHaveValue('Manuelle Idee Gesprochene Ergänzung')
  await expect.poll(async () => (await local(page))?.captureDraft?.text).toBe('Manuelle Idee Gesprochene Ergänzung')
  const id = (await local(page))!.captureDraft!.id
  expect(await storedRecord<InboxItem>(page, 'inbox', id)).toBeUndefined()
  await page.getByRole('button', { name: 'Merken', exact: true }).click()
  await expect.poll(async () => (await storedRecord<InboxItem>(page, 'inbox', id))?.status).toBe('open')
  expect((await probe(page)).speaks).toEqual([])
})

test('Abbruch und Verlassen verwerfen auch eine verspätete native Diktierantwort', async ({ page }) => {
  await onboard(page, true); await native(page)
  await openCapture(page)
  await enableDictation(page)
  await page.getByRole('textbox', { name: 'Gedanke', exact: true }).fill('Bewahrter Entwurf')
  await expect.poll(async () => (await local(page))?.captureDraft?.text).toBe('Bewahrter Entwurf')
  await page.getByRole('button', { name: 'Diktieren', exact: true }).click()
  await expect.poll(async () => (await probe(page)).pending).toBe(1)
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await probe(page)).cancels).toBeGreaterThan(0)
  await result(page, 'Darf nicht nachträglich eingefügt werden')
  await expect.poll(async () => (await probe(page)).pending).toBe(0)
  await openCapture(page)
  await expect(page.getByRole('textbox', { name: 'Gedanke', exact: true })).toHaveValue('Bewahrter Entwurf')
  expect((await local(page))?.captureDraft?.text).toBe('Bewahrter Entwurf')
})

test('Quick-Recovery und Fokusshortcut verwenden dieselbe echte Aufgabe ohne neue Arbeitszeit', async ({ page }) => {
  await onboard(page)
  await page.goto('/arbeit')
  await page.getByRole('textbox', { name: 'Neue Aufgabe', exact: true }).fill('Beleg öffnen')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nächster Schritt', exact: true }).fill('Erste Zeile ansehen')
  await page.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.nextStep).toBe('Erste Zeile ansehen')
  await page.getByRole('button', { name: /^Starten\s+25 min$/ }).click()
  await expect.poll(async () => (await local(page))?.focus?.id).toBeTruthy()
  const focus = (await local(page))!.focus!
  await page.goto('/wiedereinstieg')
  await expect(page.getByRole('dialog').getByText('Erste Zeile ansehen', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Dort weitermachen', exact: true }).click()
  await expect(page).toHaveURL(/\/aufgabe\/work\//)
  expect((await local(page))?.focus?.id).toBe(focus.id)
  await page.goto('/fokus-start')
  await expect(page).toHaveURL(/\/aufgabe\/work\//)
  await expect(page.getByRole('heading', { name: 'Erste Zeile ansehen', exact: true })).toBeVisible()
  expect((await local(page))?.focus?.id).toBe(focus.id)
  expect((await local(page))?.workSessions).toEqual([])
})

test('Gesprochene Zeitinfos sind eine eigene Wahl, bleiben allgemein und stoppen bei Pause', async ({ page }) => {
  await onboard(page, true)
  await page.goto('/einstellungen/hilfen'); await native(page)
  await page.getByRole('switch', { name: 'Lokale Zeitinfos vorlesen', exact: true }).click()
  expect((await probe(page)).speaks).toEqual([])
  await page.getByRole('button', { name: 'Einschalten', exact: true }).click()
  await expect.poll(async () => (await settings(page))?.extras?.spokenCues).toBe(true)
  expect((await settings(page))?.focus.pulse).toBe('off')
  // Clientnavigation hält die Brückensimulation aktiv; dies ist kein Hörnachweis.
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await page.getByRole('link', { name: /^Arbeit Aufgaben/ }).click()
  await page.getByRole('textbox', { name: 'Neue Aufgabe', exact: true }).fill('Private Kundenunterlage')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await page.getByRole('button', { name: /^Starten\s+25 min$/ }).click()
  await expect.poll(async () => (await local(page))?.focus?.id).toBeTruthy()
  await page.clock.setFixedTime(new Date(START + 5 * 60_000))
  await expect.poll(async () => (await probe(page)).speaks.length).toBe(1)
  expect((await probe(page)).speaks[0]).toBe('Noch etwa 20 Minuten in deinem Zeitfenster.')
  expect((await probe(page)).speaks[0]).not.toContain('Private')
  const stops = (await probe(page)).stops
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  await expect.poll(async () => (await probe(page)).stops).toBeGreaterThan(stops)
  await page.clock.setFixedTime(new Date(START + 15 * 60_000))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
  expect((await probe(page)).speaks).toHaveLength(1)
})

test('Simulierte Android-Zurücktaste schließt nur das oberste Sheet und hinterlässt keinen Listener', async ({ page }) => {
  await onboard(page, true); await native(page)
  await openTodayAdjust(page)
  await page.getByRole('combobox', { name: 'Unterstützung', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Unterstützung', exact: true })).toBeVisible()
  const backListeners = () => page.evaluate(() => (window as unknown as { __voiceProbe: VoiceProbe }).__voiceProbe.backListeners)
  await expect.poll(backListeners).toBe(1)
  const back = () => page.evaluate(() => (window as unknown as { __voiceProbe: VoiceProbe }).__voiceProbe.back())
  await back()
  await expect(page.getByRole('dialog', { name: 'Heute anpassen', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await back()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(backListeners).toBe(0)
  await expect(page).toHaveURL(/\/$/)
})

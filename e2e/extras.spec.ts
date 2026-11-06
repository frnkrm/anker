/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { LocalData, Settings, InboxItem } from '../src/core/types'
import { storedRecord } from './helpers/storage'

const START = Date.parse('2026-11-06T10:00:00+01:00')
interface VoiceProbe { starts: number; cancels: number; pending: number; speaks: string[]; stops: number; release: ((value: { status: string; text?: string }) => void)[] }
async function onboard(page: Page, bridge = false) {
  if (bridge) await page.addInitScript(() => {
    const probe: VoiceProbe = { starts: 0, cancels: 0, pending: 0, speaks: [], stops: 0, release: [] }
    const methods = ['getVoiceCapabilities', 'startDictation', 'stopDictation', 'speakCue', 'stopSpeaking', 'getAlarmState', 'syncAlarmConfig', 'syncReminders', 'drainReminderActions', 'ackReminderActions', 'setReminderFocus', 'updateWidget', 'vibratePulse', 'getSmartWakeState', 'openFocusSettings']
    Object.assign(window, { __voiceProbe: probe, CapacitorCustomPlatform: { name: 'web' }, Capacitor: {
      PluginHeaders: [{ name: 'AnkerNative', methods: methods.map((name) => ({ name, rtype: 'promise' })) }],
      async nativePromise(_plugin: string, method: string, options: { text?: string }) {
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
async function enableDictation(page: Page) {
  await page.getByRole('button', { name: 'Diktieren (freiwillig)', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Lokales Diktieren', exact: true })).toBeVisible()
  expect((await probe(page)).starts).toBe(0)
  await page.getByRole('button', { name: 'Freiwillig aktivieren', exact: true }).click()
  await expect.poll(async () => (await settings(page))?.extras?.dictation).toBe(true)
}

test('Lokales Diktieren beginnt erst nach Einwilligung und Start; Text bleibt ein bearbeitbarer Entwurf', async ({ page }) => {
  await onboard(page, true); await native(page)
  expect((await settings(page))?.extras?.dictation ?? false).toBe(false)
  await page.getByRole('button', { name: 'Gedanken festhalten', exact: true }).click()
  await enableDictation(page)
  await page.getByRole('button', { name: 'Diktieren (freiwillig)', exact: true }).click()
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
  await page.getByRole('button', { name: 'Gedanken festhalten', exact: true }).click()
  await enableDictation(page)
  await page.getByRole('textbox', { name: 'Gedanke', exact: true }).fill('Bewahrter Entwurf')
  await expect.poll(async () => (await local(page))?.captureDraft?.text).toBe('Bewahrter Entwurf')
  await page.getByRole('button', { name: 'Diktieren (freiwillig)', exact: true }).click()
  await expect.poll(async () => (await probe(page)).pending).toBe(1)
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await probe(page)).cancels).toBeGreaterThan(0)
  await result(page, 'Darf nicht nachträglich eingefügt werden')
  await expect.poll(async () => (await probe(page)).pending).toBe(0)
  await page.getByRole('button', { name: 'Gedanken festhalten', exact: true }).click()
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
  await page.getByRole('button', { name: 'Details speichern', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.nextStep).toBe('Erste Zeile ansehen')
  await page.getByRole('button', { name: 'Starten · 25 min', exact: true }).click()
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
  await page.getByRole('button', { name: 'Freiwillig aktivieren', exact: true }).click()
  await expect.poll(async () => (await settings(page))?.extras?.spokenCues).toBe(true)
  expect((await settings(page))?.focus.pulse).toBe('off')
  // Clientnavigation hält die Brückensimulation aktiv; dies ist kein Hörnachweis.
  await page.getByRole('button', { name: 'Zurück', exact: true }).click()
  await page.getByRole('button', { name: 'Zurück', exact: true }).click()
  await page.getByRole('link', { name: /^💼 Arbeit/ }).click()
  await page.getByRole('textbox', { name: 'Neue Aufgabe', exact: true }).fill('Private Kundenunterlage')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await page.getByRole('button', { name: 'Starten · 25 min', exact: true }).click()
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

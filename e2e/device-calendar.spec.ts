import { expect, test, type Page } from '@playwright/test'
import type { LocalData, Settings, CalendarEvent } from '../src/core/types'
import { storedRecord } from './helpers/storage'

const START = Date.parse('2026-11-10T10:00:00+01:00')
const CALENDAR = '17:' + 'a'.repeat(64), SECOND = '22:' + 'b'.repeat(64)
interface CalendarProbe {
  granted: boolean; permissions: boolean[]; lists: number; reads: { calendarIds: string[]; from: number; to: number }[]
  events: unknown[]; hold: boolean; release?: () => void
}
type CalendarWindow = Window & { __calendar: CalendarProbe; CapacitorCustomPlatform: { name: string } }

/** Real production UI and persistence with a controlled native contract, no real Android consent/provider proof. */
async function setup(page: Page, native = true) {
  await page.addInitScript(({ calendar, second, start }) => {
    const probe: CalendarProbe = { granted: true, permissions: [], lists: 0, reads: [], hold: false,
      events: [{ id: 'opaque:bound-account:instance', title: 'Vom Handy eingelesener Termin', start: start + 3600_000, end: start + 7200_000, allDay: false }] }
    const methods = ['deviceCalendarPermission', 'listDeviceCalendars', 'readDeviceCalendarEvents',
      'getAlarmState', 'syncAlarmConfig', 'syncReminders', 'drainReminderActions', 'ackReminderActions', 'setReminderFocus', 'updateWidget',
      'getSmartWakeState', 'getGuidanceState', 'syncGuidance', 'getBedtimePromptState', 'syncBedtimePrompt', 'pcBridgeGetState', 'pcBridgeDrainEvents']
    Object.assign(window, { __calendar: probe, CapacitorCustomPlatform: { name: 'web' }, Capacitor: {
      PluginHeaders: [{ name: 'AnkerNative', methods: methods.map(name => ({ name, rtype: 'promise' })) }],
      async nativePromise(_plugin: string, method: string, options?: { request?: boolean; calendarIds: string[]; from: number; to: number }) {
        if (method === 'deviceCalendarPermission') { probe.permissions.push(options?.request === true); return { granted: probe.granted } }
        if (method === 'listDeviceCalendars') { probe.lists++; return { calendars: [
          { id: calendar, name: 'Persönlicher Google-Kalender', account: 'sehr.langer.kalenderkonto.name.mit.mehreren.woertern@example.test' },
          { id: second, name: 'Zweiter Kalender', account: 'andere.person@example.test' },
        ] } }
        if (method === 'readDeviceCalendarEvents') {
          probe.reads.push({ calendarIds: [...options!.calendarIds], from: options!.from, to: options!.to })
          const events = structuredClone(probe.events)
          if (probe.hold) { probe.hold = false; await new Promise<void>(resolve => { probe.release = resolve }) }
          return { events, readAt: Date.now() }
        }
        if (method === 'getAlarmState' || method === 'syncAlarmConfig') return { ringing: false, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: Date.now() + 86_400_000 }
        if (method === 'drainReminderActions') return { actions: [] }
        if (method === 'pcBridgeGetState') return { state: 'unpaired', connected: false, active: false }
        if (method === 'pcBridgeDrainEvents') return { events: [], lastSeq: 0 }
        if (method === 'getSmartWakeState') return { active: false, phase: 'idle', message: '', targetAt: 0, windowAt: 0, hasMotion: true, microphoneGranted: true }
        return {}
      },
    } })
  }, { calendar: CALENDAR, second: SECOND, start: START })
  await page.clock.setFixedTime(new Date(START))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
  if (native) await page.evaluate(() => { (window as unknown as CalendarWindow).CapacitorCustomPlatform.name = 'android' })
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await page.getByRole('link', { name: /Einstellungen/ }).click()
  await page.getByRole('link', { name: 'Kalender & Sync', exact: true }).click()
}
function panel(page: Page) { return page.getByRole('region', { name: 'Google-Kalender vom Handy', exact: true }) }
async function choose(page: Page) {
  await panel(page).getByRole('button', { name: 'Google-Kalender auf dem Handy auswählen', exact: true }).click()
  await panel(page).getByRole('checkbox', { name: /^Persönlicher Google-Kalender/ }).check()
  await panel(page).getByRole('button', { name: 'Ausgewählte Kalender lesen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.extras?.calendar?.state).toBe('ready')
}

test('Handykalender erst nach bewusster Berechtigung und Auswahl lesen, danach normal aktualisieren', async ({ page }) => {
  await setup(page)
  expect(await page.evaluate(() => (window as unknown as CalendarWindow).__calendar.permissions)).toEqual([])
  await page.evaluate(() => { (window as unknown as CalendarWindow).__calendar.granted = false })
  await panel(page).getByRole('button', { name: 'Google-Kalender auf dem Handy auswählen', exact: true }).click()
  await expect(panel(page)).toContainText('Kalenderzugriff wurde nicht erteilt.')
  expect(await page.evaluate(() => (window as unknown as CalendarWindow).__calendar.lists)).toBe(0)
  await page.evaluate(() => { (window as unknown as CalendarWindow).__calendar.granted = true })
  await panel(page).getByRole('button', { name: 'Google-Kalender auf dem Handy auswählen', exact: true }).click()
  const importButton = panel(page).getByRole('button', { name: 'Ausgewählte Kalender lesen', exact: true })
  await expect(importButton).toBeDisabled()
  expect(await page.evaluate(() => (window as unknown as CalendarWindow).__calendar.reads)).toEqual([])
  await panel(page).getByRole('checkbox', { name: /^Persönlicher Google-Kalender/ }).check()
  await importButton.click()
  await expect(panel(page)).toContainText('Ausgewählte Kalender sind eingelesen.')
  await expect.poll(async () => (await storedRecord<CalendarEvent[]>(page, 'meta', 'events'))?.[0]?.title).toBe('Vom Handy eingelesener Termin')
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.extras?.deviceCalendar).toEqual({ enabled: true, calendarIds: [CALENDAR], selectedAt: START })
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.integrations.googleCalendar).toBe(true)
  const calls = await page.evaluate(() => (window as unknown as CalendarWindow).__calendar)
  expect(calls.permissions.slice(0, 2)).toEqual([true, true]); expect(calls.permissions.slice(2).every(value => value === false)).toBe(true)
  expect(calls.reads[0]?.calendarIds).toEqual([CALENDAR])
  await page.evaluate(() => { (window as unknown as CalendarWindow).__calendar.events = [{ id: 'new-instance', title: 'Aktualisierter Termin', start: Date.now() + 3600_000, end: Date.now() + 7200_000, allDay: false }] })
  await panel(page).getByRole('button', { name: 'Jetzt Kalender aktualisieren', exact: true }).click()
  await expect.poll(async () => (await storedRecord<CalendarEvent[]>(page, 'meta', 'events'))?.[0]?.title).toBe('Aktualisierter Termin')
})

test('Trennen während des Imports verwirft eine späte native Antwort dauerhaft', async ({ page }) => {
  await setup(page); await choose(page)
  const before = await page.evaluate(() => { const probe = (window as unknown as CalendarWindow).__calendar; probe.hold = true; return probe.reads.length })
  await panel(page).getByRole('button', { name: 'Jetzt Kalender aktualisieren', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as CalendarWindow).__calendar.reads.length)).toBeGreaterThan(before)
  await panel(page).getByRole('button', { name: 'Handykalender trennen', exact: true }).click()
  await expect(panel(page)).toContainText('Handykalender getrennt.')
  await page.evaluate(() => (window as unknown as CalendarWindow).__calendar.release?.())
  await expect.poll(async () => (await storedRecord<CalendarEvent[]>(page, 'meta', 'events'))?.length).toBe(0)
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.integrations.googleCalendar).toBe(false)
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.extras?.deviceCalendar).toMatchObject({ enabled: false, calendarIds: [] })
  await expect(panel(page).getByRole('button', { name: 'Handykalender trennen', exact: true })).toHaveCount(0)
})

test('Kalenderauswahl mit langem Konto passt bei 320 Pixeln und 160 Prozent Schrift ohne Überlappung', async ({ page }) => {
  await setup(page); await page.setViewportSize({ width: 320, height: 844 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '160%' })
  await panel(page).getByRole('button', { name: 'Google-Kalender auf dem Handy auswählen', exact: true }).click()
  const labels = panel(page).locator('fieldset > label')
  await expect(labels).toHaveCount(2)
  for (const label of await labels.all()) {
    const boxes = await label.locator('input, span.block').evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth } }))
    for (const box of boxes) { expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(320); expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1) }
    expect(boxes[0]!.right).toBeLessThanOrEqual(boxes[1]!.left); expect(boxes[2]!.top).toBeGreaterThanOrEqual(boxes[1]!.bottom)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await panel(page).getByRole('checkbox', { name: /^Persönlicher Google-Kalender/ }).check()
  await panel(page).getByRole('button', { name: 'Ausgewählte Kalender lesen', exact: true }).click()
  await expect(panel(page)).toContainText('Ausgewählte Kalender sind eingelesen.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('Webvorschau bietet keinen Gerätekalenderzugriff an und fordert keine Berechtigung an', async ({ page }) => {
  await setup(page, false)
  await expect(panel(page)).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as CalendarWindow).__calendar.permissions)).toEqual([])
  expect(await page.evaluate(() => (window as unknown as CalendarWindow).__calendar.reads)).toEqual([])
  await expect(page.getByText('Zusätzliche Google-Anmeldung', { exact: true })).toBeVisible()
})

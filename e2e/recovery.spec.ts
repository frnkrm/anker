/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import { initialGame } from '../src/core/game'
import type { FocusSession } from '../src/core/focus'
import type { DayLog, GameState, LocalData, Settings, WorkTask } from '../src/core/types'
import { storedRecord } from './helpers/storage'

const START = new Date('2026-11-02T19:00:00+01:00').getTime()

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date(START))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}

const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
async function focus(page: Page): Promise<FocusSession> {
  await expect.poll(async () => (await local(page))?.focus?.id).toBeTruthy()
  return (await local(page))!.focus!
}

async function at(page: Page, ms: number) {
  await page.clock.setFixedTime(new Date(ms))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
}

async function seedWork(page: Page, task: WorkTask) {
  await page.evaluate(({ task, fallback }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('records', 'readwrite')
      const records = transaction.objectStore('records')
      const read = records.get(['meta', 'local'])
      read.onsuccess = () => {
        const value = read.result?.data ?? fallback
        records.put({ collection: 'meta', id: 'local', data: { ...value, work: [task] }, updated_at: Date.now(), deleted: false, dirty: 1 })
      }
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }), { task, fallback: emptyLocal() })
}

test('Routinepause und Restzeit überstehen Neuladen; Zeitablauf erledigt keinen Schritt', async ({ page }) => {
  await onboard(page)
  const xp = (await storedRecord<GameState>(page, 'game', 'main'))?.xp ?? initialGame('2026-11-02').xp
  await page.goto('/fokus/evening')
  const initial = await focus(page)
  expect(initial.target.kind).toBe('routine')
  await at(page, START + 30_450)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  const paused = await focus(page)
  expect(paused.id).toBe(initial.id)
  if (paused.timer.status !== 'paused') throw new Error('Pausenzustand fehlt')
  expect(paused.timer.remainingMs).toBe(initial.timer.durationMs - 30_450)
  const text = `${Math.floor(Math.ceil(paused.timer.remainingMs / 1000) / 60)}:${String(Math.ceil(paused.timer.remainingMs / 1000) % 60).padStart(2, '0')}`
  await at(page, START + 3_600_000)
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText(text)
  await expect(page.locator('.ring-timer-pause')).toContainText('Pausiert')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('running')
  const resumed = await focus(page)
  expect(resumed.id).toBe(initial.id)
  if (resumed.timer.status !== 'running') throw new Error('Laufender Zustand fehlt')
  expect(resumed.timer.deadlineAt).toBe(START + 3_600_000 + paused.timer.remainingMs)
  await at(page, resumed.timer.deadlineAt + 1000)
  await expect(page.getByRole('timer')).toHaveText('0:00')
  await expect(page.getByText('Zeitfenster zu Ende. Du entscheidest, wann du abschließt.', { exact: true })).toBeVisible()
  const day = await storedRecord<DayLog>(page, 'days', '2026-11-02')
  if (initial.target.kind !== 'routine') throw new Error('Routinenreferenz fehlt')
  expect(day?.steps[`evening:${initial.target.stepId}`]).toBeUndefined()
  expect((await storedRecord<GameState>(page, 'game', 'main'))?.xp).toBe(xp)
})

test('Starthilfe wartet auf Start und bewahrt ihre Pause getrennt vom Routinenfokus', async ({ page }) => {
  await onboard(page)
  await page.goto('/fokus/evening')
  const previousFocus = await focus(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Ich hänge fest', exact: true }).click()
  await expect(page.getByRole('timer')).toHaveText('2:00')
  await at(page, START + 120_000)
  await expect(page.getByRole('timer')).toHaveText('2:00')
  expect((await local(page))?.stuck?.timer).toBeUndefined()
  await page.getByRole('button', { name: 'Starten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.stuck?.timer?.status).toBe('running')
  await at(page, START + 150_000)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.stuck?.timer?.status).toBe('paused')
  await expect(page.getByRole('timer')).toHaveText('1:30')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => history.state?.ankerSheet ?? null)).toBeNull()
  await at(page, START + 180_000)
  await page.reload()
  await page.getByRole('button', { name: 'Ich hänge fest', exact: true }).click()
  await expect(page.getByRole('timer')).toHaveText('1:30')
  await expect(page.locator('.ring-timer-pause')).toContainText('Pausiert')
  expect((await local(page))?.focus).toEqual(previousFocus)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect.poll(async () => (await local(page))?.stuck?.timer?.status).toBe('running')
  await page.getByRole('button', { name: 'Fertig', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await local(page))?.stuck).toBeUndefined()
  expect((await local(page))?.focus).toEqual(previousFocus)
})

test('Nur übersprungene Routinen bekommen keine fertige Routine und keine Erledigungszeit', async ({ page }) => {
  await onboard(page)
  const xp = (await storedRecord<GameState>(page, 'game', 'main'))?.xp ?? initialGame('2026-11-02').xp
  await page.goto('/fokus/evening')
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  await page.getByText('Weitere Möglichkeiten', { exact: true }).click()
  for (const item of settings.routines.evening) {
    await page.getByRole('button', { name: 'Überspringen', exact: true }).click()
    await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', '2026-11-02'))?.steps[`evening:${item.id}`]).toBe('skipped')
  }
  await expect(page.getByRole('heading', { name: 'Für heute nichts mehr offen', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Abendroutine fertig', exact: true })).toHaveCount(0)
  const day = await storedRecord<DayLog>(page, 'days', '2026-11-02')
  expect(day?.eveningRoutineDoneAt).toBeUndefined()
  expect((await storedRecord<GameState>(page, 'game', 'main'))?.xp).toBe(xp)
})

test('Aufgaben-Deep-Link startet erst bewusst; Pause und neues Zeitfenster buchen keine Arbeit', async ({ page }) => {
  await onboard(page)
  await seedWork(page, { id: 'focus-work', title: 'Bericht', nextStep: 'Tabelle öffnen', createdAt: START, state: 'pending' })
  await page.goto('/aufgabe/work/focus-work')
  await expect(page.getByRole('heading', { name: 'Tabelle öffnen', exact: true })).toBeVisible()
  await expect(page.getByRole('timer')).toHaveCount(0)
  await at(page, START + 180_000)
  expect((await local(page))?.focus).toBeUndefined()
  await page.getByRole('button', { name: /^Fokus starten/ }).click()
  const initial = await focus(page)
  expect(initial.timer.durationMs).toBe(25 * 60_000)
  expect((await local(page))?.workSessions).toEqual([])
  await at(page, START + 300_000)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  const paused = await focus(page)
  if (paused.timer.status !== 'paused') throw new Error('Pausenzustand fehlt')
  expect(paused.timer.remainingMs).toBe(23 * 60_000)
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('23:00')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('running')
  expect((await focus(page)).id).toBe(initial.id)
  await at(page, START + 30 * 60_000)
  await expect(page.getByRole('timer')).toHaveText('0:00')
  expect((await local(page))?.work[0]?.done).not.toBe(true)
  await page.getByRole('radio', { name: '40 min', exact: true }).click()
  await page.getByRole('button', { name: /^Neues Zeitfenster starten/ }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.durationMs).toBe(40 * 60_000)
  expect((await focus(page)).id).not.toBe(initial.id)
  expect((await local(page))?.workSessions).toEqual([])
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.done).toBe(true)
  expect((await local(page))?.work[0]?.doneAt).toBe(START + 30 * 60_000)
})

test('Gültiger alter Routinenstart wird erst nach Speicherung verlustfrei übernommen', async ({ page }) => {
  await onboard(page)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  const step = settings.routines.evening[0]!
  const key = `anker.step.2026-11-02.evening.${step.id}`
  await page.evaluate(({ key, start }) => localStorage.setItem(key, String(start)), { key, start: START - 30_000 })
  await page.goto('/fokus/evening')
  const migrated = await focus(page)
  expect(migrated.timer.startedAt).toBe(START - 30_000)
  if (migrated.timer.status !== 'running') throw new Error('Laufender Zustand fehlt')
  expect(migrated.timer.deadlineAt).toBe(START - 30_000 + step.minutes * 60_000)
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBeNull()
  await page.reload()
  expect((await focus(page)).timer.startedAt).toBe(START - 30_000)
})

interface PulseProbe { vibrations: number; pending: number; hold: boolean; release: (() => void)[] }

/** Brückensimulation für Aufrufreihenfolge; dies ist kein Android-Hör-/Vibrationstest. */
async function pulseBridge(page: Page) {
  await page.addInitScript(({ start }) => {
    const probe: PulseProbe = { vibrations: 0, pending: 0, hold: false, release: [] }
    const methods = ['getAlarmState', 'vibratePulse', 'setReminderFocus', 'drainReminderActions', 'ackReminderActions', 'syncReminders', 'syncAlarmConfig', 'updateWidget', 'getSmartWakeState']
    Object.assign(window, {
      __pulseProbe: probe,
      CapacitorCustomPlatform: { name: 'web' },
      Capacitor: {
        PluginHeaders: [{ name: 'AnkerNative', methods: methods.map((name) => ({ name, rtype: 'promise' })) }],
        async nativePromise(_plugin: string, method: string) {
          if (method === 'vibratePulse') { probe.vibrations++; return {} }
          if (method === 'getAlarmState') {
            if (probe.hold) {
              probe.pending++
              await new Promise<void>((resolve) => probe.release.push(resolve))
              probe.pending--
            }
            return { ringing: false, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: start + 86_400_000 }
          }
          if (method === 'syncAlarmConfig') return { ringing: false, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: start + 86_400_000 }
          if (method === 'drainReminderActions') return { actions: [] }
          if (method === 'getSmartWakeState') return { active: false, phase: 'idle', message: '', targetAt: 0, windowAt: 0, hasMotion: true, microphoneGranted: true }
          return {}
        },
      },
    })
  }, { start: START })
  await onboard(page)
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('records', 'readwrite')
      const records = transaction.objectStore('records')
      const read = records.get(['settings', 'main'])
      read.onsuccess = () => {
        const record = read.result as { data: Settings }
        record.data.routines.evening[0]!.minutes = 4
        record.data.focus = { pulse: 'gentle', everyMin: 2, halfway: true, lastMinute: true }
        records.put(record)
      }
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }))
  await page.goto('/fokus/evening')
  await focus(page)
  await expect(page.getByRole('timer')).toHaveText('4:00')
  await page.evaluate(() => { (window as unknown as { CapacitorCustomPlatform: { name: string } }).CapacitorCustomPlatform.name = 'android' })
}

const pulseCount = (page: Page) => page.evaluate(() => (window as unknown as { __pulseProbe: PulseProbe }).__pulseProbe.vibrations)

test('Zusammenfallende Fokusmarken senden nur einen Brückenaufruf; ausgeschaltet bleibt still', async ({ page }) => {
  await pulseBridge(page)
  // Ein sichtbarer Uhrtick überschreitet zugleich Zweiminuten- und Halbzeitmarke.
  await page.clock.setFixedTime(new Date(START + 120_000))
  await expect.poll(() => pulseCount(page)).toBe(1)
  await expect.poll(async () => (await focus(page)).timer.pulseCheckpointMs).toBe(120_000)
  await page.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await page.getByRole('radiogroup', { name: 'Fokus-Puls', exact: true }).getByRole('radio', { name: 'Deutlich', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.focus.pulse).toBe('strong')
  await page.getByRole('radiogroup', { name: 'Fokus-Puls', exact: true }).getByRole('radio', { name: 'Aus', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.focus.pulse).toBe('off')
  await page.clock.setFixedTime(new Date(START + 180_000))
  await expect(page.getByRole('timer')).toHaveText('1:00')
  expect(await pulseCount(page)).toBe(1)
})

test('Verspätete native Pulsantwort bleibt nach Verlassen des Fokus ohne Vibration', async ({ page }) => {
  await pulseBridge(page)
  await page.evaluate(() => { (window as unknown as { __pulseProbe: PulseProbe }).__pulseProbe.hold = true })
  await page.clock.setFixedTime(new Date(START + 120_000))
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pulseProbe: PulseProbe }).__pulseProbe.pending)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Zurück', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.evaluate(() => {
    const probe = (window as unknown as { __pulseProbe: PulseProbe }).__pulseProbe
    probe.hold = false
    for (const release of probe.release.splice(0)) release()
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pulseProbe: PulseProbe }).__pulseProbe.pending)).toBe(0)
  expect(await pulseCount(page)).toBe(0)
})

test('Begonnene Navigation verwirft den alten Puls schon vor dem React-Unmount', async ({ page }) => {
  await pulseBridge(page)
  await page.evaluate(() => { (window as unknown as { __pulseProbe: PulseProbe }).__pulseProbe.hold = true })
  await page.clock.setFixedTime(new Date(START + 120_000))
  await expect.poll(async () => (await focus(page)).timer.pulseCheckpointMs).toBe(120_000)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pulseProbe: PulseProbe }).__pulseProbe.pending)).toBeGreaterThan(0)
  // React Router kann die Adresse bereits ändern, während die alte Ansicht während einer Transition noch steht.
  // Diese bewusste Plattformsimulation hält genau dieses Zwischenstadium fest.
  await page.evaluate(() => history.pushState(null, '', '/'))
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Zurück', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const probe = (window as unknown as { __pulseProbe: PulseProbe }).__pulseProbe
    probe.hold = false
    for (const release of probe.release.splice(0)) release()
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pulseProbe: PulseProbe }).__pulseProbe.pending)).toBe(0)
  expect(await pulseCount(page)).toBe(0)
})

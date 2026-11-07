/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultSettings, emptyLocal } from '../src/core/defaults'
import { initialGame, XP } from '../src/core/game'
import { reminderDeliveryToken } from '../src/core/reminders/build'
import type { ReminderAction } from '../src/core/reminders/actions'
import { zonedToUtc } from '../src/core/time'
import type { DayLog, GameState, StepResult } from '../src/core/types'

const DATE = '2026-11-02'
const PREVIOUS: Record<string, StepResult> = { 'evening:old-done': 'done', 'evening:old-small': 'minimal', 'evening:old-not-needed': 'not-needed', 'evening:old-skipped': 'skipped' }
interface SqlRow { collection: string; id: string; data: string; updated_at: number; deleted: number; dirty: number }
interface QueueState { rows: SqlRow[]; queue: ReminderAction[]; acks: { id: string; receiptPersisted: boolean; xp: number }[] }
interface QueueProbe extends QueueState {
  revisions: Record<string, string>
  listeners: Record<string, number>
  blockedId?: string
  waitingId?: string
  releaseWrite?: () => void
  read: <T>(collection: string, id: string) => T | undefined
  enqueue: (action: ReminderAction, event: 'native' | 'resume') => void
}

/** Controlled Capacitor/SQLite-contract simulation, never an Android delivery or SQLite-engine proof. */
async function queueFixture(page: Page, mode: 'evening' | 'leave' | 'pcstop') {
  const settings = defaultSettings(DATE)
  settings.onboarded = true
  settings.alarm.enabled = false
  settings.sport.days = settings.sport.days.map(() => false)
  settings.evenings = settings.evenings.map(() => 'free')
  settings.support.gameVisible = false
  settings.anchor.manual = { wake: true, pcStop: true, bed: true }
  settings.pcStop = 23 * 60; settings.bed = 23 * 60 + 30
  settings.routines.morning = []
  settings.routines.evening = mode === 'evening' ? [
    { id: 'old-done', title: 'Schon erledigt', minutes: 2 }, { id: 'old-small', title: 'Schon klein erledigt', minutes: 2 },
    { id: 'old-not-needed', title: 'Schon nicht nötig', minutes: 2 }, { id: 'old-skipped', title: 'Schon übersprungen', minutes: 2 },
    { id: 'open-one', title: 'Offener Abendschritt eins', minutes: 2 }, { id: 'open-two', title: 'Offener Abendschritt zwei', minutes: 2 },
  ] : []
  const log: DayLog = { date: DATE, override: mode === 'evening' ? { dayType: 'weekend', routineAt: { evening: 19 * 60 } } : {}, steps: mode === 'evening' ? { ...PREVIOUS } : {}, awarded: mode === 'evening' ? ['step:evening:old-done', 'step:evening:old-small'] : [] }
  const initial = [
    { collection: 'settings', id: 'main', value: settings }, { collection: 'meta', id: 'local', value: emptyLocal() },
    { collection: 'days', id: DATE, value: log }, { collection: 'game', id: 'main', value: { ...initialGame(DATE), xp: 37 } },
  ]
  await page.addInitScript(({ initial, date }) => {
    const key = 'anker-e2e-notification-sql-contract'
    const saved = sessionStorage.getItem(key)
    const state: QueueState = saved ? JSON.parse(saved) : { rows: initial.map(({ collection, id, value }) => ({ collection, id, data: JSON.stringify(value), updated_at: 1, deleted: 0, dirty: 0 })), queue: [], acks: [] }
    const callbacks = new Map<string, { plugin: string; event: string; callback: (value: unknown) => void }>()
    let nextId = 0
    const persist = () => sessionStorage.setItem(key, JSON.stringify({ rows: state.rows, queue: state.queue, acks: state.acks }))
    const emit = (plugin: string, event: string, value: unknown) => { for (const listener of callbacks.values()) if (listener.plugin === plugin && listener.event === event) listener.callback(value) }
    const probe: QueueProbe = Object.assign(state, {
      revisions: {}, listeners: {},
      read<T>(collection: string, id: string): T | undefined { const row = state.rows.find((entry) => entry.collection === collection && entry.id === id && !entry.deleted); return row ? JSON.parse(row.data) as T : undefined },
      enqueue(action: ReminderAction, event: 'native' | 'resume') { state.queue.push(action); persist(); if (event === 'native') emit('AnkerNative', 'reminderAction', {}); else emit('App', 'appStateChange', { isActive: true }) },
    })
    const nativeMethods = ['getAlarmState', 'syncAlarmConfig', 'getBedtimePromptState', 'getSmartWakeState', 'syncReminders', 'drainReminderActions', 'ackReminderActions', 'setReminderFocus', 'updateWidget', 'syncGeofences', 'getGeofenceState', 'ackGeofenceSuggestions', 'removeListener']
    Object.assign(window, {
      __notificationQueue: probe,
      CapacitorCustomPlatform: { name: 'android' },
      Capacitor: {
        PluginHeaders: [
          { name: 'App', methods: ['getLaunchUrl', 'getInfo', 'removeListener'].map((name) => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
          { name: 'AnkerNative', methods: nativeMethods.map((name) => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
          { name: 'CapacitorSQLite', methods: ['checkConnectionsConsistency', 'createConnection', 'open', 'execute', 'executeSet', 'query', 'run'].map((name) => ({ name, rtype: 'promise' })) },
          { name: 'LocalNotifications', methods: ['getPending', 'getDeliveredNotifications', 'cancel', 'removeDeliveredNotifications'].map((name) => ({ name, rtype: 'promise' })) },
        ],
        async nativePromise(plugin: string, method: string, options: { callbackId?: string; values?: (string | number)[]; set?: { values: (string | number)[] }[]; ids?: string[]; revisions?: Record<string, string> }) {
          if (method === 'removeListener') { callbacks.delete(options.callbackId!); return {} }
          if (plugin === 'App') return method === 'getLaunchUrl' ? {} : { version: 'browser-queue-simulation', build: '0' }
          if (plugin === 'LocalNotifications') return { notifications: [] }
          if (plugin === 'AnkerNative') {
            if (method === 'getAlarmState' || method === 'syncAlarmConfig') return { ringing: false, snoozed: 0, exact: true }
            if (method === 'getBedtimePromptState') return { phase: 'idle', overlayPermission: false, exact: true }
            if (method === 'getSmartWakeState') return { active: false, phase: 'idle', targetAt: 0, windowAt: 0, message: '' }
            if (method === 'syncGeofences' || method === 'getGeofenceState') return { registered: 0, fineGranted: false, backgroundGranted: false, suggestions: [] }
            if (method === 'syncReminders') { probe.revisions = options.revisions ?? {}; return {} }
            if (method === 'drainReminderActions') return { actions: structuredClone(state.queue) }
            if (method === 'ackReminderActions') {
              for (const id of options.ids ?? []) state.acks.push({ id, receiptPersisted: probe.read<DayLog>('days', date)?.reminderReceipts?.includes(id) === true, xp: probe.read<GameState>('game', 'main')!.xp })
              state.queue = state.queue.filter((action) => !options.ids?.includes(action.id)); persist(); return {}
            }
            return {}
          }
          if (plugin === 'CapacitorSQLite') {
            if (method === 'checkConnectionsConsistency') return { result: false }
            if (method === 'query') return { values: state.rows.filter((row) => !options.values?.length || (row.collection === options.values[0] && (!options.values[1] || row.id === options.values[1]))) }
            if (method === 'run' || method === 'executeSet') {
              const writes = method === 'executeSet' ? options.set!.map((entry) => entry.values) : [options.values!]
              if (probe.blockedId && writes.some((values) => values[0] === 'days' && values[1] === date && (JSON.parse(String(values[2])) as DayLog).reminderReceipts?.includes(probe.blockedId!))) {
                probe.waitingId = probe.blockedId
                await new Promise<void>((resolve) => { probe.releaseWrite = () => { probe.blockedId = undefined; resolve() } })
                probe.waitingId = undefined
              }
              for (const values of writes) {
                const [collection, id, data, updated_at, deleted, dirty] = values as [string, string, string, number, number, number]
                const index = state.rows.findIndex((row) => row.collection === collection && row.id === id)
                const row = { collection, id, data, updated_at, deleted, dirty }
                if (index < 0) state.rows.push(row); else state.rows[index] = row
              }
              persist()
            }
            return {}
          }
          throw new Error(`Unexpected fixture method: ${plugin}.${method}`)
        },
        nativeCallback(plugin: string, method: string, options: { eventName: string }, callback: (value: unknown) => void) {
          if (method !== 'addListener') throw new Error('Unexpected fixture callback')
          const id = String(++nextId)
          callbacks.set(id, { plugin, event: options.eventName, callback })
          const key = `${plugin}.${options.eventName}`
          probe.listeners[key] = (probe.listeners[key] ?? 0) + 1
          return id
        },
      },
    })
    persist()
  }, { initial, date: DATE })
  const minute = mode === 'evening' ? 20 * 60 : mode === 'leave' ? 7 * 60 + 10 : 22 * 60 + 50
  await page.clock.setFixedTime(new Date(zonedToUtc(DATE, minute)))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // load() wertet bestehende echte Schritte aus und wartet auf den Game-Commit.
  // Die alten Schritte verdienen einmalig den bislang nicht gesetzten first-step-Erfolg.
  await expect.poll(() => sqlRecord<GameState>(page, 'game', 'main')).toMatchObject({
    lastEvaluated: DATE, xp: 37 + (mode === 'evening' ? XP.achievement : 0),
    ...(mode === 'evening' ? { achievements: { 'first-step': DATE } } : {}),
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as { __notificationQueue: QueueProbe }).__notificationQueue.listeners['AnkerNative.reminderAction'] ?? 0)).toBe(1)
  await expect.poll(() => page.evaluate(({ date, key }) => (window as unknown as { __notificationQueue: QueueProbe }).__notificationQueue.revisions[`${date}|${key}`], { date: DATE, key: mode === 'evening' ? 'evening' : mode === 'leave' ? 'leave-10' : 'pcstop-15' })).toMatch(/^r2-[a-f0-9]{16}$/)
}

async function sqlRecord<T>(page: Page, collection: string, id: string): Promise<T | undefined> {
  return page.evaluate(({ collection, id }) => (window as unknown as { __notificationQueue: QueueProbe }).__notificationQueue.read<T>(collection, id), { collection, id })
}
async function queueAction(page: Page, key: string, action: 'done' | 'skip', event: 'native' | 'resume' = 'native', existing?: ReminderAction) {
  const revision = await page.evaluate(({ date, key }) => (window as unknown as { __notificationQueue: QueueProbe }).__notificationQueue.revisions[`${date}|${key}`], { date: DATE, key })
  const at = await page.evaluate(() => Date.now())
  const queued = existing ?? { id: `browser-native:${key}:${action}`, key, action, date: DATE, at, revision, token: reminderDeliveryToken(revision, at) }
  await page.evaluate(({ queued, event }) => (window as unknown as { __notificationQueue: QueueProbe }).__notificationQueue.enqueue(queued, event), { queued, event })
  return queued
}
async function ackCount(page: Page, id: string) { return page.evaluate((id) => (window as unknown as { __notificationQueue: QueueProbe }).__notificationQueue.acks.filter((ack) => ack.id === id).length, id) }

for (const action of ['done', 'skip'] as const) test(`Native Abend-Queue ${action}: nur offene Schritte ändern, Jetzt verlassen und Receipt/XP nach Reload nicht verdoppeln`, async ({ page }) => {
  await queueFixture(page, 'evening')
  await expect(page.getByRole('heading', { name: 'Offener Abendschritt eins', exact: true })).toBeVisible()
  const beforeGame = (await sqlRecord<GameState>(page, 'game', 'main'))!
  const id = `browser-native:evening:${action}`
  await page.evaluate((id) => { (window as unknown as { __notificationQueue: QueueProbe }).__notificationQueue.blockedId = id }, id)
  const queued = await queueAction(page, 'evening', action)
  try {
    await expect.poll(() => page.evaluate(() => (window as unknown as { __notificationQueue: QueueProbe }).__notificationQueue.waitingId)).toBe(id)
    expect(await ackCount(page, id)).toBe(0)
    expect((await sqlRecord<DayLog>(page, 'days', DATE))?.steps).toEqual(PREVIOUS)
    expect(await sqlRecord<GameState>(page, 'game', 'main')).toEqual(beforeGame)
    await expect(page.getByRole('heading', { name: 'Offener Abendschritt eins', exact: true })).toBeVisible()
  } finally { await page.evaluate(() => (window as unknown as { __notificationQueue: QueueProbe }).__notificationQueue.releaseWrite?.()) }
  await expect.poll(() => ackCount(page, id)).toBe(1)
  const log = (await sqlRecord<DayLog>(page, 'days', DATE))!
  expect(log.steps).toEqual({ ...PREVIOUS, 'evening:open-one': action === 'done' ? 'done' : 'not-needed', 'evening:open-two': action === 'done' ? 'done' : 'not-needed' })
  expect(log.eveningRoutineDoneAt).toBe(action === 'done' ? queued.at : undefined)
  const game = (await sqlRecord<GameState>(page, 'game', 'main'))!
  expect(game.xp - beforeGame.xp).toBe(action === 'done' ? 20 : 0)
  await expect(page.getByRole('heading', { name: 'Freizeit – zocken erlaubt', exact: true })).toBeVisible()
  expect(await page.evaluate((id) => (window as unknown as { __notificationQueue: QueueProbe }).__notificationQueue.acks.find((ack) => ack.id === id), id)).toEqual({ id, receiptPersisted: true, xp: game.xp })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Freizeit – zocken erlaubt', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __notificationQueue: QueueProbe }).__notificationQueue.listeners['AnkerNative.reminderAction'] ?? 0)).toBe(1)
  expect(await sqlRecord<DayLog>(page, 'days', DATE)).toEqual(log)
  await queueAction(page, 'evening', action, 'resume', queued)
  await expect.poll(() => ackCount(page, id)).toBe(2)
  expect(await sqlRecord<DayLog>(page, 'days', DATE)).toEqual(log)
  expect(await sqlRecord<GameState>(page, 'game', 'main')).toEqual(game)
})

for (const [mode, key, field] of [['leave', 'leave-10', 'leftAt'], ['pcstop', 'pcstop-15', 'pcOffAt']] as const) test(`Native Vorwarnung ${key}: bewusstes Erledigt speichert ${field} statt nur den Hinweis zu verstecken`, async ({ page }) => {
  await queueFixture(page, mode)
  const queued = await queueAction(page, key, 'done')
  await expect.poll(() => ackCount(page, queued.id)).toBe(1)
  const log = (await sqlRecord<DayLog>(page, 'days', DATE))!
  expect(log[field]).toBe(queued.at)
  expect(log.dismissed ?? []).not.toContain(key)
  expect(log.reminderReceipts).toContain(queued.id)
  const game = await sqlRecord<GameState>(page, 'game', 'main')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __notificationQueue: QueueProbe }).__notificationQueue.listeners['AnkerNative.reminderAction'] ?? 0)).toBe(1)
  expect((await sqlRecord<DayLog>(page, 'days', DATE))?.[field]).toBe(queued.at)
  await queueAction(page, key, 'done', 'resume', queued)
  await expect.poll(() => ackCount(page, queued.id)).toBe(2)
  expect(await sqlRecord<GameState>(page, 'game', 'main')).toEqual(game)
})

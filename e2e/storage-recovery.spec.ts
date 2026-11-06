/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultSettings, emptyLocal } from '../src/core/defaults'
import { initialGame } from '../src/core/game'

interface StorageProbe {
  failOpen: boolean
  alarmReadFails: boolean
  stopFails: boolean
  attempts: number
  writes: number
  stops: string[]
  rows: { collection: string; id: string; data: string; updated_at: number; deleted: number; dirty: number }[]
}

/** Nur eine Brückensimulation: SQLite-Fehler dürfen keine neue flüchtige Nutzerdatenbank erzeugen. */
async function blockedStorage(page: Page, ringing = false, unreadableAlarm = false) {
  const date = '2026-11-06'
  const settings = { ...defaultSettings(date), onboarded: true }
  const local = { ...emptyLocal(), work: [{ id: 'old-work', title: 'Altbestand bleibt erhalten', createdAt: 1 }] }
  const game = { ...initialGame(date), xp: 230, spent: 40, badges: ['alt'] }
  await page.addInitScript(({ settings, local, game, ringing, unreadableAlarm }) => {
    const rows = [['settings', 'main', settings], ['meta', 'local', local], ['game', 'main', game]].map(([collection, id, data]) => ({ collection: String(collection), id: String(id), data: JSON.stringify(data), updated_at: 1, deleted: 0, dirty: 0 }))
    const probe: StorageProbe = { failOpen: true, alarmReadFails: unreadableAlarm, stopFails: unreadableAlarm, attempts: 0, writes: 0, stops: [], rows }
    let activeAlarm = ringing
    let callbackId = 0
    Object.assign(window, {
      __storageProbe: probe,
      CapacitorCustomPlatform: { name: 'android' },
      Capacitor: {
        PluginHeaders: [
          { name: 'App', methods: ['getLaunchUrl', 'getInfo', 'removeListener'].map((name) => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
          { name: 'AnkerNative', methods: ['getAlarmState', 'stopAlarm', 'syncAlarmConfig', 'drainReminderActions', 'ackReminderActions', 'getSmartWakeState', 'syncReminders', 'setReminderFocus', 'updateWidget', 'removeListener'].map((name) => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
          { name: 'CapacitorSQLite', methods: ['checkConnectionsConsistency', 'createConnection', 'open', 'execute', 'executeSet', 'query', 'run'].map((name) => ({ name, rtype: 'promise' })) },
        ],
        async nativePromise(plugin: string, method: string, options: { method?: string; values?: (string | number)[]; set?: { values: (string | number)[] }[] }) {
          if (plugin === 'AnkerNative') {
            if (method === 'getAlarmState' && probe.alarmReadFails) throw new Error('Status vorübergehend nicht erreichbar')
            if (method === 'stopAlarm') {
              probe.stops.push(options.method ?? '')
              if (probe.stopFails) throw new Error('Stopp vorübergehend nicht erreichbar')
              activeAlarm = false
            }
            if (['getAlarmState', 'stopAlarm', 'syncAlarmConfig'].includes(method)) return { ringing: activeAlarm, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: Date.now() + 86_400_000 }
            if (method === 'drainReminderActions') return { actions: [] }
            if (method === 'getSmartWakeState') return { active: false, phase: 'idle', targetAt: 0, windowAt: 0, hasMotion: true, microphoneGranted: true, message: '' }
            return {}
          }
          if (plugin === 'CapacitorSQLite') {
            if (method === 'checkConnectionsConsistency') return { result: false }
            if (method === 'open') { probe.attempts++; if (probe.failOpen) throw new Error('private Eingangsdaten im Speicherfehler') }
            if (method === 'query') return { values: rows.filter((row) => !row.deleted && (!options.values?.length || (row.collection === options.values[0] && (options.values.length < 2 || row.id === options.values[1])))) }
            if (method === 'run' || method === 'executeSet') {
              const entries = method === 'run' ? [options.values!] : options.set!.map((entry) => entry.values)
              for (const values of entries) {
                probe.writes++
                const [collection, id, data, updated_at, deleted, dirty] = values as [string, string, string, number, number, number]
                const index = rows.findIndex((row) => row.collection === collection && row.id === id)
                const row = { collection, id, data, updated_at, deleted, dirty }
                if (index < 0) rows.push(row); else rows[index] = row
              }
            }
            return {}
          }
          return {}
        },
        nativeCallback() { return String(++callbackId) },
      },
    })
  }, { settings, local, game, ringing, unreadableAlarm })
  await page.clock.setFixedTime(new Date('2026-11-06T10:00:00+01:00'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Daten gerade nicht erreichbar', exact: true })).toBeVisible()
  await expect(page.getByText('private Eingangsdaten im Speicherfehler', { exact: true })).toHaveCount(0)
}

const probe = (page: Page) => page.evaluate(() => {
  const probe = (window as unknown as { __storageProbe: StorageProbe }).__storageProbe
  return { attempts: probe.attempts, writes: probe.writes, stops: probe.stops, rows: probe.rows }
})

test('Speicheröffnung bleibt ehrlich, Retry lädt den unveränderten alten Bestand', async ({ page }) => {
  await blockedStorage(page)
  const before = await probe(page)
  expect(before.writes).toBe(0)
  await expect(page.getByRole('button', { name: 'Passt, los', exact: true })).toHaveCount(0)
  await page.evaluate(() => { (window as unknown as { __storageProbe: StorageProbe }).__storageProbe.failOpen = false })
  await page.getByRole('button', { name: 'Erneut versuchen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Altbestand bleibt erhalten', exact: true })).toBeVisible()
  const after = await probe(page)
  expect(after.attempts).toBeGreaterThan(before.attempts)
  expect(JSON.parse(after.rows.find((row) => row.collection === 'meta' && row.id === 'local')!.data)).toMatchObject({ work: [{ id: 'old-work', title: 'Altbestand bleibt erhalten' }], meds: {} })
  expect(JSON.parse(after.rows.find((row) => row.collection === 'game')!.data)).toMatchObject({ xp: 230, spent: 40, badges: ['alt'] })
})

test('Klingelnder Wecker bleibt bei Speicherfehler bewusst stoppbar ohne fiktive Einnahme oder Rücksetzung', async ({ page }) => {
  await blockedStorage(page, true)
  const before = await probe(page)
  await page.getByRole('button', { name: 'Wecker im Notfall beenden', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Wecker im Notfall beenden', exact: true })).toHaveCount(0)
  const after = await probe(page)
  expect(after.stops).toEqual(['emergency'])
  expect(after.writes).toBe(0)
  expect(after.rows).toEqual(before.rows)
})

test('Unlesbarer Alarmstatus und fehlgeschlagener Stopp lassen den Notfallweg erreichbar', async ({ page }) => {
  await blockedStorage(page, true, true)
  await expect(page.getByText('Der Weckerstatus ist gerade nicht abrufbar. Der Notfallstopp bleibt erreichbar.', { exact: true })).toBeVisible()
  const button = page.getByRole('button', { name: 'Wecker im Notfall beenden', exact: true })
  await button.click()
  await expect(page.getByText('Der Wecker konnte noch nicht beendet werden. Du kannst es erneut versuchen.', { exact: true })).toBeVisible()
  await expect(button).toBeEnabled()
  await page.evaluate(() => { (window as unknown as { __storageProbe: StorageProbe }).__storageProbe.stopFails = false })
  await button.click()
  await expect(button).toHaveCount(0)
  expect((await probe(page)).writes).toBe(0)
})

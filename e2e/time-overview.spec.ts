/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultSettings, emptyLocal } from '../src/core/defaults'
import { makeBackup } from '../src/core/export/backup'
import { initialGame } from '../src/core/game'
import { activePlanDate } from '../src/core/now'
import { todayBerlin } from '../src/core/time'
import type { TimeCatalogSnapshot } from '../src/core/timeCatalog'
import type { LocalData, Settings, WorkTask } from '../src/core/types'
import type { Rec } from '../src/data/types'
import { seedRecords, storedRecord } from './helpers/storage'

const START = Date.parse('2026-11-06T10:00:00+01:00')
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
const settings = (page: Page) => storedRecord<Settings>(page, 'settings', 'main')
const catalog = (page: Page) => storedRecord<TimeCatalogSnapshot>(page, 'meta', 'time-catalog')

async function onboard(page: Page, at = START, running = false) {
  if (running) await page.clock.install({ time: new Date(at) })
  else await page.clock.setFixedTime(new Date(at))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await settings(page))?.onboarded).toBe(true)
  // Die bewusste Ersteinrichtung wertet den Spieltag aus. Erst den bestätigten DB-Stand
  // als Vergleichsbasis nehmen; das anschließende Lesen der Übersicht darf nichts ändern.
  await expect.poll(async () => (await storedRecord<ReturnType<typeof initialGame>>(page, 'game', 'main'))?.lastEvaluated).toBe(activePlanDate(at, todayBerlin))
}

async function seedWork(page: Page, work: WorkTask[] = [{ id: 'catalog-work', title: 'Mein Bericht', nextStep: 'Tabelle öffnen', state: 'pending', createdAt: START, earliestStart: START + 30 * 60_000, deadline: START + 60 * 60_000 }]) {
  const data = (await local(page)) ?? emptyLocal()
  data.work = work
  data.deviceTests ??= { reports: {} }
  await seedRecords(page, [{ collection: 'meta', id: 'local', data }])
}

async function open(page: Page): Promise<TimeCatalogSnapshot> {
  await page.goto('/zeiten')
  await expect(page.getByRole('heading', { name: 'Zeitübersicht', exact: true })).toBeVisible()
  await expect.poll(async () => (await catalog(page))?.version).toBe(1)
  await expect(page.getByText(/^Berechnet:/)).toBeVisible()
  return (await catalog(page))!
}

async function recordsWithoutCache(page: Page) {
  return page.evaluate(() => new Promise<unknown[]>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('records', 'readonly')
      const read = transaction.objectStore('records').getAll()
      let rows: { collection: string; id: string; data: unknown; deleted: boolean }[] = []
      read.onsuccess = () => {
        rows = read.result.filter((row) => !(row.collection === 'meta' && row.id === 'time-catalog')).map((row) => {
          const data = structuredClone(row.data) as Record<string, unknown>
          if (row.collection === 'meta' && row.id === 'local') delete data.timeCatalog
          return { collection: row.collection as string, id: row.id as string, data, deleted: row.deleted as boolean }
        }).sort((a, b) => `${a.collection}:${a.id}`.localeCompare(`${b.collection}:${b.id}`))
      }
      // Optionale undefined-RAM-Defaults ändern keine JSON-Quelle.
      transaction.oncomplete = () => { db.close(); resolve(JSON.parse(JSON.stringify(rows)) as unknown[]) }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }))
}

const orderedTimes = (page: Page) => page.getByRole('list', { name: /^Zeiten am / }).evaluateAll((lists) => lists.flatMap((list) => Array.from(list.children).flatMap((row) => {
  const at = row.querySelector('summary time')?.getAttribute('datetime')
  return at ? [Date.parse(at)] : []
})))

test('Zeitübersicht speichert nur den lokalen Cache, bleibt chronologisch und startet nichts', async ({ page }) => {
  await onboard(page)
  await seedWork(page)
  const before = await recordsWithoutCache(page)
  const cache = await open(page)
  expect(cache.entries.length).toBeGreaterThan(10)
  expect(await recordsWithoutCache(page)).toEqual(before)
  const at = await orderedTimes(page)
  expect(at.length).toBeGreaterThan(3)
  expect(at).toEqual([...at].sort((a, b) => a - b))
  await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption('work')
  await expect(page.getByText('Frühester Start: Mein Bericht', { exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('planned')
  await page.getByRole('radio', { name: 'Demnächst', exact: true }).click()
  expect(await recordsWithoutCache(page)).toEqual(before)
  expect((await local(page))?.focus).toBeUndefined()
  expect((await local(page))?.workSessions).toEqual([])
  await expect(page.getByText('Nativer Status ausgelesen', { exact: true })).toHaveCount(0)
})

test('Bewusste Quellenänderung aktualisiert den Cache im Hintergrund vor erneutem Öffnen', async ({ page }) => {
  await onboard(page)
  await seedWork(page)
  const original = await open(page)
  await page.goto('/arbeit')
  await page.getByText(/^Für später vorgemerkt/).click()
  const card = page.getByRole('heading', { name: 'Mein Bericht', exact: true }).locator('..')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  await card.getByLabel('Frühestens ab', { exact: true }).fill('2026-11-06T12:00')
  await card.getByRole('button', { name: 'Details speichern', exact: true }).click()
  const next = Date.parse('2026-11-06T12:00:00+01:00')
  await expect.poll(async () => (await local(page))?.work[0]?.earliestStart).toBe(next)
  await expect.poll(async () => (await catalog(page))?.entries.find((entry) => entry.functionId === 'task.earliest' && entry.source.refId === 'catalog-work')?.at).toBe(next)
  expect((await catalog(page))?.sourceRevision).not.toBe(original.sourceRevision)
  await open(page)
  await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption('work')
  const row = page.getByText('Frühester Start: Mein Bericht', { exact: true }).locator('xpath=ancestor::li')
  await expect(row.locator('summary time').first()).toHaveText('12:00')
})

test('Abendübergang führt PC- und Bett-Hinweise als abgestimmt; Ausschalten braucht die bestehende Speicheraktion', async ({ page }) => {
  await onboard(page)
  await seedWork(page, [])
  const value = (await settings(page))!
  value.support.windDown.enabled = true
  value.support.windDown.at = 21 * 60
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: value }])
  const cache = await open(page)
  const coordinated = cache.entries.filter((entry) => ['reminder.pcstop-15', 'reminder.pcstop', 'reminder.bed'].includes(entry.functionId))
  expect(coordinated.length).toBeGreaterThan(0)
  expect(coordinated.every((entry) => entry.status === 'inactive' && entry.reason?.includes('Bereits abgestimmt'))).toBe(true)
  expect(cache.suggestions.some((suggestion) => suggestion.kind === 'overlap' && suggestion.entryIds.some((id) => coordinated.some((entry) => entry.id === id)))).toBe(false)
  expect((await settings(page))?.support.windDown.enabled).toBe(true)
  await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption('sleep')
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('inactive')
  const row = page.getByText('PC-Stopp-Erinnerung', { exact: true }).first().locator('xpath=ancestor::li')
  await row.locator('summary').click()
  await expect(row.getByText('Bereits abgestimmt: Der Abendübergang ersetzt diesen Hinweis.', { exact: true })).toBeVisible()
  await row.getByRole('link', { name: /^Quelle öffnen:/ }).click()
  await expect(page).toHaveURL(/\/einstellungen\/abenduebergang$/)
  const toggle = page.getByRole('switch', { name: 'Sanften Abendübergang einschalten', exact: true })
  await toggle.click()
  expect((await settings(page))?.support.windDown.enabled).toBe(true)
  await page.getByRole('button', { name: 'Übergang speichern', exact: true }).click()
  await expect.poll(async () => (await settings(page))?.support.windDown.enabled).toBe(false)
  expect((await settings(page))?.anchor.wake).toBe(value.anchor.wake)
})

test('Gleichzeitige echte Hinweise ergeben einen begründeten Prüfpunkt ohne automatisches Abschalten', async ({ page }) => {
  await onboard(page)
  await seedWork(page, [])
  const value = (await settings(page))!
  value.pcStop = 21 * 60
  value.anchor.manual = { ...value.anchor.manual, pcStop: true }
  value.support.windDown.enabled = false
  value.alarm.medicationEnabled = true
  value.alarm.medicationReminderAt = 21 * 60
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: value }])
  const before = await recordsWithoutCache(page)
  const cache = await open(page)
  expect(cache.suggestions.some((suggestion) => suggestion.kind === 'overlap')).toBe(true)
  await expect(page.getByRole('heading', { name: 'Mehrere Hinweise zur gleichen Zeit', exact: true }).first()).toBeVisible()
  await expect(page.getByText('Das kann passen. Prüfe bei Bedarf die jeweiligen Quellen; nichts wird automatisch ausgeschaltet.', { exact: true }).first()).toBeVisible()
  expect(await recordsWithoutCache(page)).toEqual(before)
  expect((await settings(page))?.alarm.medicationEnabled).toBe(true)
  expect((await settings(page))?.pcStop).toBe(21 * 60)
})

test('Bedingte Regeln und pausierter Fokus erhalten keine erfundene Uhrzeit', async ({ page }) => {
  await onboard(page)
  await seedWork(page)
  const data = (await local(page))!
  data.focus = { id: 'paused-catalog', target: { kind: 'work', id: 'catalog-work' }, timer: { status: 'paused', durationMs: 900_000, startedAt: START - 300_000, remainingMs: 600_000, pausedAt: START, pulseCheckpointMs: 0 } }
  await seedRecords(page, [{ collection: 'meta', id: 'local', data }])
  await open(page)
  await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption('technology')
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('conditional')
  await page.getByText(/^Ohne feste Uhrzeit & abgestimmte Hilfen/).click()
  const testAlarm = page.getByText('Separater Testalarm', { exact: true }).locator('xpath=ancestor::li')
  await expect(testAlarm).toBeVisible()
  await expect(testAlarm.locator('time')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption('focus')
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('paused')
  const paused = page.getByText('Fokus-Zeitfenster endet', { exact: true }).locator('xpath=ancestor::li')
  await expect(paused).toBeVisible()
  await expect(paused.locator('time')).toHaveCount(0)
  expect((await local(page))?.focus).toEqual(data.focus)
  expect((await local(page))?.workSessions).toEqual([])
})

test('Demnächst bleibt über Mitternacht chronologisch und bei 320px/160Prozent bedienbar', async ({ page }, testInfo) => {
  await onboard(page, Date.parse('2026-11-06T23:00:00+01:00'))
  await seedWork(page, [{ id: 'after-midnight', title: 'Später Termin', state: 'pending', createdAt: START, earliestStart: Date.parse('2026-11-07T00:30:00+01:00'), deadline: Date.parse('2026-11-07T00:45:00+01:00') }])
  await open(page)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.evaluate(() => document.documentElement.style.fontSize = '160%')
  await page.getByRole('radio', { name: 'Demnächst', exact: true }).click()
  await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption('work')
  const at = await orderedTimes(page)
  expect(at).toEqual([...at].sort((a, b) => a - b))
  const row = page.getByText('Frühester Start: Später Termin', { exact: true }).locator('xpath=ancestor::li')
  await expect(row.locator('summary time').first()).toHaveText('00:30')
  await row.locator('summary').focus(); await page.keyboard.press('Enter')
  await expect(row.getByRole('link', { name: /^Quelle öffnen:/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  expect((await page.getByRole('button', { name: 'Ansicht aktualisieren', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await page.screenshot({ path: testInfo.outputPath('zeituebersicht-320.png'), fullPage: true })
})

test('Sicherungsvorschau verändert weder Quellen noch bestehenden Zeitcache', async ({ page }) => {
  await onboard(page)
  await seedWork(page)
  await open(page)
  const before = await recordsWithoutCache(page)
  const cache = await catalog(page)
  await page.goto('/backup')
  const incoming: Rec[] = [{ collection: 'settings', id: 'main', data: { version: 1, onboarded: true, pcStop: 23 * 60 }, updated_at: START + 1, deleted: false }]
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Sicherung importieren', exact: true }).click()
  await (await chooser).setFiles({ name: 'zeit-vorschau.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeBackup(incoming))) })
  await expect(page.getByRole('heading', { name: 'Vor dem Import prüfen', exact: true })).toBeVisible()
  expect(await recordsWithoutCache(page)).toEqual(before)
  expect(await catalog(page)).toEqual(cache)
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
  expect(await catalog(page)).toEqual(cache)
})

test('Cache-only-Schreibvorgänge bleiben nach Filtern und bestätigten IDB-Leseabschlüssen endlich', async ({ page }) => {
  await page.addInitScript(() => {
    let count = 0
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      const row = value as { collection?: string; id?: string }
      if (row?.collection === 'meta' && row.id === 'time-catalog') count++
      return key === undefined ? put.call(this, value) : put.call(this, value, key)
    }
    Object.defineProperty(window, '__catalogWrites', { get: () => count })
  })
  await onboard(page)
  await seedWork(page)
  await open(page)
  const initial = await page.evaluate(() => (window as unknown as { __catalogWrites: number }).__catalogWrites)
  expect(initial).toBe(1)
  for (const category of ['work', 'sleep', 'all']) {
    await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption(category)
    await local(page)
  }
  expect(await page.evaluate(() => (window as unknown as { __catalogWrites: number }).__catalogWrites)).toBe(initial)
})

test('Fortschreitende Uhr lässt einen frisch gespeicherten Cache sofort sichtbar und löst keine Aktualisierungsschleife aus', async ({ page }) => {
  await onboard(page, START, true)
  await seedWork(page)
  const first = await open(page)
  await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption('work')
  await expect(page.getByText('Frühester Start: Mein Bericht', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ansicht aktualisieren', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ansicht aktualisieren', exact: true })).toBeEnabled()
  await expect(page.getByText(/^Berechnet:/)).toBeVisible()
  expect((await catalog(page))?.sourceRevision).toBe(first.sourceRevision)
  expect(await page.evaluate(() => Date.now())).toBeGreaterThan(first.generatedAt)
})

test('Routineplan-Quelle öffnet den vorhandenen Editor und startet keinen Fokus', async ({ page }) => {
  await onboard(page)
  await seedWork(page, [])
  await open(page)
  await page.getByRole('combobox', { name: 'Kategorie', exact: true }).selectOption('routines')
  const row = page.getByText('Morgenroutine', { exact: true }).first().locator('xpath=ancestor::li')
  await row.locator('summary').click()
  await row.getByRole('link', { name: 'Quelle öffnen: Morgenroutine', exact: true }).click()
  await expect(page).toHaveURL(/\/einstellungen\/morgenroutine$/)
  expect((await local(page))?.focus).toBeUndefined()
  expect((await local(page))?.focusHistory ?? []).toEqual([])
})

test('Native Momentaufnahme bleibt als Abfrage gekennzeichnet und plant beim Öffnen keinen Wecker neu', async ({ page }) => {
  await page.clock.setFixedTime(new Date(START))
  await page.addInitScript(({ settings, local, game, start }) => {
    const calls: string[] = []
    const records = [
      { collection: 'settings', id: 'main', data: JSON.stringify(settings), updated_at: start, deleted: 0, dirty: 0 },
      { collection: 'meta', id: 'local', data: JSON.stringify(local), updated_at: start, deleted: 0, dirty: 0 },
      { collection: 'game', id: 'main', data: JSON.stringify(game), updated_at: start, deleted: 0, dirty: 0 },
    ]
    const listeners = new Map<string, (value: unknown) => void>()
    let next = 0
    const forbidden = ['startBedtimePrompt', 'stopBedtimePrompt', 'ackBedtimePrompt', 'openOverlayPermissionSettings', 'startSmartWake', 'stopSmartWake', 'testAlarm', 'stopAlarm', 'snoozeAlarm', 'openExactAlarmSettings']
    const methods = ['getAlarmState', 'syncAlarmConfig', 'syncReminders', 'drainReminderActions', 'ackReminderActions', 'setReminderFocus', 'updateWidget', 'getBedtimePromptState', 'getSmartWakeState', 'stopSpeaking', 'removeListener', ...forbidden]
    Object.assign(window, { __catalogNativeCalls: calls, __catalogNativeRecords: records, __catalogHoldBedtime: false, __catalogBedtimePending: false, CapacitorCustomPlatform: { name: 'android' }, Capacitor: {
      PluginHeaders: [
        { name: 'App', methods: ['getLaunchUrl', 'getInfo', 'removeListener'].map((name) => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
        { name: 'AnkerNative', methods: methods.map((name) => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
        { name: 'CapacitorSQLite', methods: ['checkConnectionsConsistency', 'createConnection', 'open', 'execute', 'executeSet', 'query', 'run'].map((name) => ({ name, rtype: 'promise' })) },
      ],
      async nativePromise(plugin: string, method: string, options: { callbackId?: string; values?: (string | number)[]; set?: { values: (string | number)[] }[] }) {
        if (method === 'removeListener') { listeners.delete(options.callbackId!); return {} }
        if (plugin === 'App') return method === 'getLaunchUrl' ? { url: 'de.frnkrm.anker.mobile://now' } : { id: 'de.frnkrm.anker.mobile', version: 'Browserfixture', build: '0', name: 'Anker' }
        if (plugin === 'AnkerNative') {
          calls.push(method)
          if (method === 'getAlarmState' || method === 'syncAlarmConfig') return { ringing: false, snoozed: 0, scheduledAt: Date.parse('2026-11-07T06:30:00+01:00'), mainConfirmed: true, exact: true }
          if (method === 'getBedtimePromptState') {
            const value = { phase: 'waiting', sessionId: 'catalog-native', dueAt: start + 15 * 60_000, overlayPermission: true, exact: true }
            const control = window as unknown as { __catalogHoldBedtime: boolean; __catalogBedtimePending: boolean; __catalogReleaseBedtime?: () => void }
            if (control.__catalogHoldBedtime) {
              control.__catalogHoldBedtime = false; control.__catalogBedtimePending = true
              return await new Promise((resolve) => { control.__catalogReleaseBedtime = () => { control.__catalogBedtimePending = false; resolve(value) } })
            }
            return value
          }
          if (method === 'getSmartWakeState') return { active: false, phase: 'idle', targetAt: 0, windowAt: 0, hasMotion: true, microphoneGranted: false, message: '' }
          if (method === 'drainReminderActions') return { actions: [] }
          return {}
        }
        if (plugin === 'CapacitorSQLite') {
          if (method === 'checkConnectionsConsistency') return { result: false }
          if (method === 'query') return { values: records.filter((row) => !options.values?.length || (row.collection === options.values[0] && (!options.values[1] || row.id === options.values[1]))) }
          if (method === 'run' || method === 'executeSet') for (const values of method === 'executeSet' ? options.set!.map((row) => row.values) : [options.values!]) {
            const [collection, id, data, updated_at, deleted, dirty] = values as [string, string, string, number, number, number]
            const index = records.findIndex((row) => row.collection === collection && row.id === id)
            const row = { collection, id, data, updated_at, deleted, dirty }
            if (index < 0) records.push(row); else records[index] = row
          }
          return {}
        }
        throw new Error(`Unexpected native method ${plugin}.${method}`)
      },
      nativeCallback(_plugin: string, method: string, _options: unknown, callback: (value: unknown) => void) {
        if (method !== 'addListener') throw new Error(`Unexpected callback ${method}`)
        const id = String(++next); listeners.set(id, callback); return id
      },
    } })
  }, { settings: { ...defaultSettings('2026-11-06'), onboarded: true }, local: emptyLocal(), game: initialGame('2026-11-06'), start: START })
  await page.goto('/')
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mehr', exact: true })).toBeVisible()
  const calls = () => page.evaluate(() => (window as unknown as { __catalogNativeCalls: string[] }).__catalogNativeCalls)
  // Der Appstart wertet den Spieltag aus und gleicht danach nochmals ab; beides vor dem Seitenwechsel abwarten.
  await expect.poll(async () => (await calls()).filter((name) => name === 'syncAlarmConfig').length).toBeGreaterThanOrEqual(2)
  const before = (await calls()).filter((name) => name === 'syncAlarmConfig').length
  await page.getByRole('link', { name: /Zeitübersicht/ }).click()
  await expect(page.getByText(/^Berechnet:/)).toBeVisible()
  await expect(page.getByText('Stummer Einschlafhinweis', { exact: true })).toBeVisible()
  const row = page.getByText('Stummer Einschlafhinweis', { exact: true }).locator('xpath=ancestor::li')
  await expect(row.getByText(/Nativer Status ausgelesen/)).toBeVisible()
  await row.locator('summary').click()
  await expect(row.getByText(/^Nativer Stand gelesen:/)).toBeVisible()
  expect((await calls()).filter((name) => name === 'syncAlarmConfig')).toHaveLength(before)
  expect((await calls()).filter((name) => ['startBedtimePrompt', 'stopBedtimePrompt', 'ackBedtimePrompt', 'openOverlayPermissionSettings', 'startSmartWake', 'stopSmartWake', 'testAlarm', 'stopAlarm', 'snoozeAlarm', 'openExactAlarmSettings'].includes(name))).toEqual([])
  await page.evaluate(() => { (window as unknown as { __catalogHoldBedtime: boolean }).__catalogHoldBedtime = true })
  await page.getByRole('button', { name: 'Ansicht aktualisieren', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __catalogBedtimePending: boolean }).__catalogBedtimePending)).toBe(true)
  await page.clock.setFixedTime(new Date(START + 3 * 60_000))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
  await page.evaluate(() => (window as unknown as { __catalogReleaseBedtime: () => void }).__catalogReleaseBedtime())
  await expect(page.getByRole('button', { name: 'Ansicht aktualisieren', exact: true })).toBeEnabled()
  const snapshot = await page.evaluate(() => {
    const records = (window as unknown as { __catalogNativeRecords: { collection: string; id: string; data: string }[] }).__catalogNativeRecords
    return JSON.parse(records.find((record) => record.collection === 'meta' && record.id === 'time-catalog')!.data) as TimeCatalogSnapshot
  })
  expect(snapshot.entries.filter((entry) => entry.functionId === 'alarm.main').every((entry) => entry.evidence === 'calculated')).toBe(true)
  expect(snapshot.entries.find((entry) => entry.functionId === 'sleep.native-prompt')?.observedAt).toBe(START + 3 * 60_000)
  expect((await calls()).filter((name) => name === 'syncAlarmConfig')).toHaveLength(before)
})

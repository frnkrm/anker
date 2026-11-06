/// <reference lib="dom" />
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import { initialGame } from '../src/core/game'
import { widgetEntry } from '../src/core/now'
import { buildDayPlan } from '../src/core/planner'
import { nextAction } from '../src/core/support'
import { zonedToUtc } from '../src/core/time'
import type { Commitment, DayLog, GameState, LocalData, Settings } from '../src/core/types'
import type { AssistantRequest } from '../src/core/assistance'
import { installAssistanceBackend, startAssistanceServer } from './helpers/assistance-server'
import { seedRecords, storedRecord } from './helpers/storage'

const DATE = '2026-11-02'
const TOMORROW = '2026-11-03'
const PRIVATE = 'Verabredung am Abend'
const visit: Commitment = { id: 'q84-private', date: DATE, label: PRIVATE, context: 'personal', commitment: 'hard', start: 18 * 60, locationKind: 'onsite', originPlaceId: 'office', placeId: 'private', routeMode: 'driving', travelMin: 45, arrivalBufferMin: 10, prepMin: 15, thenTo: 'home', status: 'planned' }
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
const day = (page: Page, date = DATE) => storedRecord<DayLog>(page, 'days', date)
let server: Awaited<ReturnType<typeof startAssistanceServer>>
test.use({ serviceWorkers: 'block' })
test.beforeAll(async () => { server = await startAssistanceServer(4217) })
test.afterAll(async () => { await server?.close() })

async function clock(page: Page, minute: number) {
  await page.clock.setFixedTime(new Date(zonedToUtc(DATE, minute)))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
}
async function onboard(page: Page, minute = 8 * 60) {
  await page.clock.setFixedTime(new Date(zonedToUtc(DATE, minute)))
  await page.goto(`${server.url}/start`)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}
async function fixture(page: Page) {
  const requests = await installAssistanceBackend(page, async (input: AssistantRequest, route) => {
    if (input.kind !== 'route') throw new Error('Q84 erwartet nur die ausdrücklich angeforderte Fahrtschätzung')
    await route.fulfill({ json: { kind: 'route', revision: input.revision, route: { durationMin: 70, source: 'Google Routes', fetchedAt: zonedToUtc(DATE, 750), travelAt: input.at, mode: input.mode, trafficAware: true, estimated: true } } })
  })
  await onboard(page)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.anchor.wake = 360
  settings.work[0] = { ...settings.work[0]!, isWorkDay: true, start: 480, durationMin: 480, pauseMin: 30, homeOffice: false, endPreference: undefined }
  settings.work[1] = { ...settings.work[1]!, isWorkDay: true, start: 540, homeOffice: true }
  settings.sport.days = settings.sport.days.map(() => false)
  settings.travel.activationMin = 10
  settings.travel.homeOfficeStartupMin = 5
  settings.routines.morning = [{ id: 'q84-morning', title: 'In Ruhe bereitmachen', minutes: 30 }]
  const data = (await local(page)) ?? emptyLocal()
  // Bereits früher bewusst gespeicherte Planung und Dienstfreigaben, keine erfassten Ist-Handlungen.
  data.commitments = [visit]
  data.places = [
    { id: 'office', label: 'Büro', kind: 'office', latitude: 50, longitude: 7, externalUse: { routes: true } },
    { id: 'private', label: 'Privater Ort', kind: 'private', latitude: 50.1, longitude: 7.1, externalUse: { routes: true } },
  ]
  data.assistance = { routes: { enabled: true, version: 1, at: zonedToUtc(DATE, 480), automatic: false } }
  await seedRecords(page, [
    { collection: 'settings', id: 'main', data: settings },
    { collection: 'meta', id: 'local', data },
    { collection: 'game', id: 'main', data: { ...initialGame(DATE), xp: 37 } },
  ])
  await page.goto(`${server.url}/arbeitszeit`)
  await page.getByRole('button', { name: 'Arbeit starten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions.length).toBe(1)
  await clock(page, 720)
  await page.getByRole('button', { name: 'Pause starten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions[0]?.breaks.length).toBe(1)
  await clock(page, 750)
  await page.reload()
  await expect(page.getByText('Feierabend frühestens', { exact: true })).toBeVisible()
  await page.getByLabel('Pause voraussichtlich bis', { exact: true }).fill(`${DATE}T13:30`)
  await page.getByRole('button', { name: 'Endschätzung merken', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions[0]?.breaks[0]?.expectedEndAt).toBe(zonedToUtc(DATE, 810))
  return requests
}
async function traffic(page: Page) {
  await page.goto(`${server.url}/tag`)
  await page.getByText('Wegdetails', { exact: true }).click()
  await page.getByRole('button', { name: 'Fahrtzeit prüfen', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Fahrtzeit bewusst prüfen', exact: true })
  await dialog.getByRole('button', { name: 'Diese Daten senden und Schätzung anfragen', exact: true }).click()
  await expect(page.getByText('Vorschlag: etwa 70 Minuten', { exact: true })).toBeVisible()
  expect((await local(page))?.commitments.find((item) => item.id === visit.id)?.travelMin).toBe(45)
  await page.getByRole('button', { name: 'Als eigene Fahrzeit übernehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments.find((item) => item.id === visit.id)?.travelMin).toBe(70)
}
async function projection(page: Page, minute: number) {
  const data = (await local(page))!
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  const log = await day(page)
  const nowMs = zonedToUtc(DATE, minute)
  const plan = buildDayPlan({ date: DATE, settings, override: log?.override, commitments: data.commitments.filter((item) => item.date === DATE), places: data.places, sessions: data.workSessions, nowMs })
  const view = nextAction({ plan, log, m: minute, nowMs, settings, inbox: [], work: data.work, sessions: data.workSessions, context: data.taskContext })
  return { plan, view, widget: widgetEntry(nowMs, view) }
}
async function noFalseCompletion(page: Page) {
  expect(Object.values((await day(page))?.steps ?? {})).not.toContain('done')
  expect(Object.values((await day(page))?.steps ?? {})).not.toContain('minimal')
  expect((await storedRecord<GameState>(page, 'game', 'main'))?.xp).toBe(37)
  expect((await local(page))?.meds).toEqual({})
}

test('Q84: längere echte Pause und neuer Verkehr bleiben ein gemeinsamer Plan mit genau einem Arbeitskonflikt', async ({ page }) => {
  const requests = await fixture(page)
  const before = (await local(page))!.workSessions
  await traffic(page)
  expect(requests).toHaveLength(1)
  const { plan, widget } = await projection(page, 750)
  expect(plan.workInfo?.forecastEnd).toBe(1050)
  expect(plan.legs?.find((leg) => leg.commitment.id === visit.id)?.leave).toBe(1000)
  expect(plan.conflicts).toHaveLength(1)
  const conflict = plan.conflicts![0]!
  await expect(page.getByText(conflict + ' Ändern kannst nur du: Einen Termin hier absagen oder mit der anderen Seite verschieben.', { exact: true })).toHaveCount(1)
  await page.getByRole('link', { name: 'Jetzt', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pause läuft', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: conflict + ' Ansehen', exact: true })).toHaveCount(1)
  await expect(page.locator('header')).toContainText('16:40')
  expect(widget).toMatchObject({ action: 'Pause läuft', hardLabel: 'Losgehen', hardTime: '16:40' })
  expect(JSON.stringify(widget)).not.toContain(PRIVATE)
  // Produktionsprojektion des Widgetinhalts; keine Behauptung tatsächlicher Launcher-Zustellung.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Pause läuft', exact: true })).toBeVisible()
  expect((await local(page))?.workSessions).toEqual(before)
  expect((await local(page))?.workSessions[0]?.breaks[0]?.endAt).toBeUndefined()
  expect((await local(page))?.commitments).toHaveLength(1)
  expect((await local(page))?.commitments[0]).toMatchObject({ id: visit.id, start: 1080, travelMin: 70 })
  await noFalseCompletion(page)
})

test('Q84: freie Tagesänderung und Rücknahme bewahren echte Arbeits- und Reisehandlungen; Druck bleibt ehrlich', async ({ page }) => {
  await fixture(page)
  await traffic(page)
  await clock(page, 810)
  await page.goto(`${server.url}/arbeitszeit`)
  await page.getByRole('button', { name: 'Pause beenden', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions[0]?.breaks[0]?.endAt).toBe(zonedToUtc(DATE, 810))
  await clock(page, 1000)
  await page.getByRole('button', { name: 'Feierabend', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions[0]?.endAt).toBe(zonedToUtc(DATE, 1000))
  await page.goto(`${server.url}/`)
  await page.getByRole('button', { name: 'Bin los', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments[0]?.leftAt).toBe(zonedToUtc(DATE, 1000))
  await clock(page, 1070)
  await page.reload()
  await page.getByRole('button', { name: 'Ich bin angekommen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments[0]?.arrivedAt).toBe(zonedToUtc(DATE, 1070))
  await clock(page, 1140)
  await page.reload()
  await page.getByRole('button', { name: 'Bin wieder da', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments[0]?.backAt).toBe(zonedToUtc(DATE, 1140))
  const sessions = (await local(page))!.workSessions
  await page.goto(`${server.url}/tag`)
  await page.getByRole('button', { name: 'Heute anders', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Heute nicht nötig', exact: true }).click()
  await dialog.getByRole('button', { name: 'Ganze Abendroutine', exact: true }).click()
  await expect.poll(async () => Object.values((await day(page))?.steps ?? {}).filter((value) => value === 'not-needed').length).toBeGreaterThan(0)
  await page.goto(`${server.url}/druck?typ=evening&tag=${DATE}`)
  await expect(page.locator('[data-sheet="evening"]')).toContainText('Heute nicht nötig:')
  await expect(page.locator('[data-sheet="evening"]')).not.toContainText('Erledigt:')
  await noFalseCompletion(page)
  await page.goto(`${server.url}/tag`)
  await page.getByRole('button', { name: 'Heute anders', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Zurück zum ursprünglichen Plan', exact: true }).click()
  await expect.poll(async () => (await local(page))?.planUndo).toBeUndefined()
  await page.reload()
  expect((await local(page))?.workSessions).toEqual(sessions)
  // Bereits angetretene Reisen behalten auch ihren tatsächlich verwendeten Planungskontext.
  expect((await local(page))?.commitments).toEqual([{ ...visit, travelMin: 70, leftAt: zonedToUtc(DATE, 1000), arrivedAt: zonedToUtc(DATE, 1070), backAt: zonedToUtc(DATE, 1140) }])
  expect((await day(page))?.steps ?? {}).toEqual({})
  await page.goto(`${server.url}/druck?typ=evening&tag=${DATE}`)
  await expect(page.locator('[data-sheet="evening"]')).not.toContainText('Heute nicht nötig:')
  await expect(page.locator('[data-sheet="evening"]')).not.toContainText('Erledigt:')
  await noFalseCompletion(page)
})

test('Q84: einmalige Weckwahl und offene Ist-Pause überstehen bewussten Offline-Backup-Roundtrip', async ({ page, browser }) => {
  await fixture(page)
  await page.goto(`${server.url}/tag`)
  await page.getByRole('radio', { name: 'Morgen', exact: true }).click()
  await page.getByRole('button', { name: 'Morgen anders', exact: true }).click()
  await page.getByRole('button', { name: 'Ich habe morgen einen Termin', exact: true }).click()
  await page.getByRole('textbox', { name: 'Was hast du vor?', exact: true }).fill('Früher Remote-Termin')
  await page.getByRole('radio', { name: 'Termin', exact: true }).click()
  await page.getByLabel('Beginn', { exact: true }).fill('07:30')
  await page.getByRole('radiogroup', { name: 'Termin findet statt', exact: true }).getByRole('radio', { name: 'Remote', exact: true }).click()
  await page.getByRole('button', { name: 'So übernehmen', exact: true }).click()
  const apply = page.getByRole('button', { name: 'Einmalig 06:45 im Plan verwenden', exact: true })
  await expect(apply).toBeVisible()
  expect((await day(page, TOMORROW))?.override.wakeOverride).toBeUndefined()
  await apply.click()
  await expect(page.getByText('Im Plan gespeichert. Die Web-Version stellt keinen Android-Wecker.', { exact: true })).toBeVisible()
  await expect.poll(async () => (await day(page, TOMORROW))?.override.wakeOverride).toBe(405)
  const originalSettings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  const originalLocal = (await local(page))!
  const originalDay = (await day(page, TOMORROW))!
  expect(originalSettings.anchor.wake).toBe(360)
  await page.goto(`${server.url}/backup`)
  await expect(page.getByRole('button', { name: 'Sicherung exportieren', exact: true })).toBeVisible()
  await page.context().setOffline(true)
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sicherung exportieren', exact: true }).click()
  const download = await downloading
  const backup = await readFile((await download.path())!)
  const restoreContext = await browser.newContext({ serviceWorkers: 'block' })
  try {
    const restored = await restoreContext.newPage()
    await onboard(restored, 420) // Neue leere Installation vor den gesicherten Record-Zeitstempeln.
    expect((await storedRecord<Settings>(restored, 'settings', 'main'))?.alarm.qrSecret).not.toBe(originalSettings.alarm.qrSecret)
    await restored.goto(`${server.url}/backup`)
    await expect(restored.getByRole('button', { name: 'Sicherung importieren', exact: true })).toBeVisible()
    await restoreContext.setOffline(true)
    const beforePreview = await local(restored)
    const choosing = restored.waitForEvent('filechooser')
    await restored.getByRole('button', { name: 'Sicherung importieren', exact: true }).click()
    await (await choosing).setFiles({ name: 'q84-offline-sicherung.json', mimeType: 'application/json', buffer: backup })
    await expect(restored.getByRole('heading', { name: 'Vor dem Import prüfen', exact: true })).toBeVisible()
    expect(await local(restored)).toEqual(beforePreview)
    await restored.getByRole('button', { name: 'Jetzt importieren', exact: true }).click()
    await expect.poll(async () => (await local(restored))?.workSessions.length).toBe(1)
    await clock(restored, 750)
    expect(await local(restored)).toEqual(originalLocal)
    expect(await day(restored, TOMORROW)).toEqual(originalDay)
    expect(await storedRecord<Settings>(restored, 'settings', 'main')).toEqual(originalSettings)
    await noFalseCompletion(restored)
    // Offline-Import ist oben belegt. Der frische Server-Reload prüft anschließend die Persistenz.
    await restoreContext.setOffline(false)
    await restored.reload()
    expect(await local(restored)).toEqual(originalLocal)
    expect((await day(restored, TOMORROW))?.override.wakeOverride).toBe(405)
    await restored.getByRole('link', { name: 'Jetzt', exact: true }).click()
    await expect(restored.getByRole('heading', { name: 'Pause läuft', exact: true })).toBeVisible()
  } finally { await restoreContext.close(); await page.context().setOffline(false) }
})

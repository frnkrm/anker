/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { zonedToUtc } from '../src/core/time'
import type { LocalData, Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'

const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
const settings = (page: Page) => storedRecord<Settings>(page, 'settings', 'main')
const date = '2026-11-02'
async function clock(page: Page, day: string, minute: number) {
  await page.clock.setFixedTime(new Date(zonedToUtc(day, minute)))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
}
async function onboard(page: Page, day = date, minute = 19 * 60) {
  await page.clock.setFixedTime(new Date(zonedToUtc(day, minute)))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/arbeitszeit')
}
async function manual(page: Page, start: string, end: string) {
  await page.getByLabel('Nachtragen von', { exact: true }).fill(start)
  await page.getByLabel('Nachtragen bis', { exact: true }).fill(end)
  await page.getByRole('button', { name: 'Eintragen', exact: true }).click()
}

test('Überlappender Nachtrag bleibt sichtbar abgelehnt und verändert den gespeicherten Altstand nicht', async ({ page }) => {
  await onboard(page)
  await manual(page, '08:00', '12:00')
  await expect.poll(async () => (await local(page))?.workSessions.length).toBe(1)
  const before = (await local(page))!.workSessions
  await manual(page, '11:00', '14:00')
  await expect(page.getByRole('alert')).toContainText('überschneiden')
  expect((await local(page))?.workSessions).toEqual(before)
  await page.reload()
  expect((await local(page))?.workSessions).toEqual(before)
  await expect(page.getByText('Erfasste Zeiten', { exact: true })).toBeVisible()
})

test('Älterer Nachtabschnitt bleibt per Datum erreichbar und die Endkorrektur erhält den folgenden Kalendertag', async ({ page }) => {
  await onboard(page, '2026-11-06')
  await page.getByLabel('Arbeitstag auswählen', { exact: true }).fill(date)
  await manual(page, '23:40', '00:30')
  await expect.poll(async () => (await local(page))?.workSessions[0]?.endAt).toBe(zonedToUtc(date, 1470))
  const id = (await local(page))!.workSessions[0]!.id
  await page.reload()
  await page.getByLabel('Arbeitstag auswählen', { exact: true }).fill(date)
  await page.getByLabel('Ende', { exact: true }).fill('00:40')
  await expect.poll(async () => (await local(page))?.workSessions.find((session) => session.id === id)?.endAt).toBe(zonedToUtc(date, 1480))
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect((await local(page))?.workSessions[0]?.date).toBe(date)
  await expect(page.getByText('1 h', { exact: true }).first()).toBeVisible()
})

test('Laufende Pause zeigt zunächst frühestens und nimmt eine freiwillige Endschätzung ohne falsches Beenden auf', async ({ page }) => {
  await onboard(page, date, 480)
  await page.getByRole('button', { name: 'Arbeit starten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions.length).toBe(1)
  await clock(page, date, 720)
  await page.getByRole('button', { name: 'Pause starten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions[0]?.breaks.length).toBe(1)
  await clock(page, date, 750)
  await page.reload()
  await expect(page.getByText('Feierabend frühestens', { exact: true })).toBeVisible()
  await expect(page.getByText('16:30', { exact: true })).toBeVisible()
  await page.getByLabel('Pause voraussichtlich bis', { exact: true }).fill('2026-11-02T13:30')
  await page.getByRole('button', { name: 'Endschätzung merken', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions[0]?.breaks[0]?.expectedEndAt).toBe(zonedToUtc(date, 810))
  await expect(page.getByText('Feierabend etwa', { exact: true })).toBeVisible()
  await expect(page.getByText('17:30', { exact: true })).toBeVisible()
  expect((await local(page))?.workSessions[0]?.breaks[0]?.endAt).toBeUndefined()
  await clock(page, date, 780)
  await page.reload()
  await expect(page.getByText('17:30', { exact: true })).toBeVisible()
  expect((await local(page))?.workSessions[0]?.breaks[0]?.endAt).toBeUndefined()
})

test('Vergessene Session wird im Wochenblick unbestätigt und verlangt statt Jetzt-Beenden ein tatsächliches Ende', async ({ page }) => {
  await onboard(page, date, 480)
  await page.getByRole('button', { name: 'Arbeit starten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions.length).toBe(1)
  const id = (await local(page))!.workSessions[0]!.id
  await clock(page, '2026-11-06', 1140)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Feierabend', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Läuft noch, jetzt beenden', exact: true })).toHaveCount(0)
  await page.getByText('Diese Woche ansehen', { exact: true }).click()
  await expect(page.getByText(/unbestätigt/).first()).toBeVisible()
  await page.getByLabel('Tatsächliches Ende bestätigen', { exact: true }).fill('2026-11-02T17:00')
  await page.getByRole('button', { name: 'Endzeit speichern', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions.find((session) => session.id === id)?.endAt).toBe(zonedToUtc(date, 1020))
  await page.getByLabel('Arbeitstag auswählen', { exact: true }).fill(date)
  await expect(page.getByText('9 h', { exact: true }).first()).toBeVisible()
  expect((await local(page))?.workSessions[0]?.id).toBe(id)
})

test('Wochenprofil bewahrt Start und Soll und trennt optionale Tagesgrenze sowie Feierabendwunsch', async ({ page }) => {
  await onboard(page, '2026-11-06')
  const before = (await settings(page))!
  await page.goto('/einstellungen/arbeit')
  await page.getByText('Weitere Wochenwerte', { exact: true }).nth(0).click()
  await page.getByLabel('Montag Startgrenze', { exact: true }).selectOption('custom')
  await expect.poll(async () => (await settings(page))?.work[0]?.latestStart).toBe(540)
  await page.getByLabel('Montag spätester Beginn', { exact: true }).fill('08:30')
  await expect.poll(async () => (await settings(page))?.work[0]?.latestStart).toBe(510)
  await page.getByText('Weitere Wochenwerte', { exact: true }).nth(4).click()
  await page.getByRole('switch', { name: 'Freitag Feierabendwunsch', exact: true }).click()
  await expect.poll(async () => (await settings(page))?.work[4]?.endPreference).toBeTruthy()
  await page.getByLabel('Freitag Feierabendwunsch Uhrzeit', { exact: true }).fill('14:00')
  await expect.poll(async () => (await settings(page))?.work[4]?.endPreference).toBe(840)
  await page.reload()
  const after = (await settings(page))!
  expect(after.work[0]?.start).toBe(before.work[0]?.start)
  expect(after.work[4]?.durationMin).toBe(before.work[4]?.durationMin)
  expect(after.flex.latestStart).toBe(before.flex.latestStart)
  expect(after.work[0]?.latestStart).toBe(510)
  expect(after.work[4]?.endPreference).toBe(840)
})

test('Rücknahme einer alten Korrektur steht nach neuem Arbeitsstart nicht mehr zur Verfügung und verliert keine Session', async ({ page }) => {
  await onboard(page)
  await manual(page, '08:00', '12:00')
  await expect.poll(async () => (await local(page))?.workSessions.length).toBe(1)
  await expect(page.getByRole('button', { name: 'Letzte Korrektur rückgängig', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Arbeit starten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions.length).toBe(2)
  await expect(page.getByRole('button', { name: 'Letzte Korrektur rückgängig', exact: true })).toHaveCount(0)
  const sessions = (await local(page))!.workSessions
  await page.reload()
  expect((await local(page))?.workSessions).toEqual(sessions)
  expect(sessions.filter((session) => session.endAt === undefined)).toHaveLength(1)
})

test('Nachtrag vor 04 Uhr landet am richtigen Kalendertag und bleibt beim gewählten Plantag', async ({ page }) => {
  await onboard(page, '2026-11-06')
  await page.getByLabel('Arbeitstag auswählen', { exact: true }).fill(date)
  await manual(page, '01:00', '02:00')
  await expect.poll(async () => (await local(page))?.workSessions.length).toBe(1)
  expect((await local(page))?.workSessions[0]).toMatchObject({ date, startAt: zonedToUtc('2026-11-03', 60), endAt: zonedToUtc('2026-11-03', 120) })
  await page.reload()
  await page.getByLabel('Arbeitstag auswählen', { exact: true }).fill(date)
  await expect(page.getByText('1 h', { exact: true }).first()).toBeVisible()
})

test('Echte Nachtschicht bleibt nach 04 Uhr pausierbar ohne erzwungenen falschen Abschluss', async ({ page }) => {
  await onboard(page, date, 1420)
  await page.getByRole('button', { name: 'Kundenproblem jetzt bearbeiten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions.length).toBe(1)
  const id = (await local(page))!.workSessions[0]!.id
  await clock(page, '2026-11-03', 270)
  await page.reload()
  await expect(page.getByLabel('Tatsächliches Ende bestätigen', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Pause starten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions[0]?.breaks.length).toBe(1)
  expect((await local(page))?.workSessions[0]).toMatchObject({ id, date })
  expect((await local(page))?.workSessions[0]?.endAt).toBeUndefined()
  await page.getByRole('button', { name: 'Pause beenden', exact: true }).click()
  await expect.poll(async () => (await local(page))?.workSessions[0]?.breaks[0]?.endAt).toBe(zonedToUtc('2026-11-03', 270))
  expect((await local(page))?.workSessions[0]?.endAt).toBeUndefined()
})

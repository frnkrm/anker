/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { LocalData, Settings, WorkTask } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

async function onboard(page: Page, at = '2026-11-06T10:00:00+01:00') {
  await page.clock.setFixedTime(new Date(at))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
}

async function seedWork(page: Page, work: WorkTask[]) {
  const local = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  await seedRecords(page, [{ collection: 'meta', id: 'local', data: { ...local, work } }])
  await page.goto('/')
}

test('Eine unter Arbeit gespeicherte Startzeit erscheint zusätzlich auf Jetzt; Öffnen startet nichts', async ({ page }) => {
  await onboard(page)
  await page.goto('/arbeit')
  await page.getByRole('textbox', { name: 'Neue Aufgabe', exact: true }).fill('Tabelle vorbereiten')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  const card = page.getByRole('heading', { name: 'Tabelle vorbereiten', exact: true }).locator('..')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  await card.getByLabel('Frühestens ab', { exact: true }).fill('2026-11-06T10:30')
  await card.getByRole('button', { name: 'Details speichern', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.work[0]?.earliestStart).toBe(new Date('2026-11-06T10:30:00+01:00').getTime())
  await page.getByRole('link', { name: 'Jetzt', exact: true }).click()
  const hints = page.getByRole('complementary', { name: 'Demnächst bei der Arbeit', exact: true })
  await expect(hints.getByText('Ab 10:30', { exact: true })).toBeVisible()
  await expect(page.locator('section[aria-live] h1')).toHaveCount(1)
  expect(await page.locator('section[aria-live] button, section[aria-live] a').count()).toBeLessThanOrEqual(3)
  const before = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  await hints.getByRole('link', { name: /Tabelle vorbereiten/ }).click()
  await expect(page).toHaveURL(/\/aufgabe\/work\//)
  await expect(page.getByRole('button', { name: 'Fokus starten', exact: true })).toBeVisible()
  const after = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  expect(after.focus).toEqual(before.focus)
  expect(after.work).toEqual(before.work)
  expect(after.workSessions).toEqual(before.workSessions)
})

test('Frist und Start sind getrennt beschriftet, vergangene und erledigte Aufgaben werden nicht wiederbelebt', async ({ page }) => {
  await onboard(page)
  const time = (clock: string) => new Date(`2026-11-06T${clock}:00+01:00`).getTime()
  await seedWork(page, [
    { id: 'deadline', title: 'Rückmeldung', createdAt: 1, deadline: time('10:20') },
    { id: 'start', title: 'Datei öffnen', createdAt: 1, earliestStart: time('10:40'), deadline: time('10:50') },
    { id: 'far', title: 'Viel später', createdAt: 1, earliestStart: time('12:00') },
    { id: 'done', title: 'Schon erledigt', createdAt: 1, deadline: time('10:15'), done: true },
    { id: 'past', title: 'Alter Zeitpunkt', createdAt: 1, deadline: time('09:50') },
  ])
  const hints = page.getByRole('complementary', { name: 'Demnächst bei der Arbeit', exact: true })
  await expect(hints.getByRole('link')).toHaveCount(2)
  await expect(hints.getByText('Frist 10:20', { exact: true })).toBeVisible()
  await expect(hints.getByText('Ab 10:40', { exact: true })).toBeVisible()
  await expect(hints.getByText('Frist 10:50', { exact: true })).toHaveCount(0)
  await expect(hints).not.toContainText(/Viel später|Schon erledigt|Alter Zeitpunkt/)
  await page.reload()
  await expect(hints.getByRole('link')).toHaveCount(2)
  await page.clock.setFixedTime(new Date('2026-11-06T10:21:00+01:00'))
  await page.reload()
  await expect(hints.getByRole('link')).toHaveCount(1)
  await expect(hints).not.toContainText('Rückmeldung')
})

test('Der vorhandene Feierabendschalter gilt auch für neue Hinweise; die Arbeitsaufgabe bleibt bestehen', async ({ page }) => {
  await onboard(page, '2026-11-06T19:00:00+01:00')
  await seedWork(page, [{ id: 'evening', title: 'Eigene Abendaufgabe', createdAt: 1, earliestStart: new Date('2026-11-06T19:30:00+01:00').getTime() }])
  const hints = page.getByRole('complementary', { name: 'Demnächst bei der Arbeit', exact: true })
  await expect(hints).toContainText('Eigene Abendaufgabe')
  await page.goto('/einstellungen/arbeit')
  await page.getByRole('switch', { name: 'Arbeitsaufgaben nach Feierabend ruhigstellen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.support.workAfterHoursQuiet).toBe(true)
  await page.getByRole('link', { name: 'Jetzt', exact: true }).click()
  await expect(hints).toHaveCount(0)
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))!.work[0]?.title).toBe('Eigene Abendaufgabe')
  await page.goto('/einstellungen/arbeit')
  await page.getByRole('switch', { name: 'Arbeitsaufgaben nach Feierabend ruhigstellen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.support.workAfterHoursQuiet).toBe(false)
  await page.getByRole('link', { name: 'Jetzt', exact: true }).click()
  await expect(hints).toContainText('Eigene Abendaufgabe')
})

test('Eine Zeit nach Mitternacht steht als morgen auf Jetzt und wird nicht dem falschen Tag zugeordnet', async ({ page }) => {
  await onboard(page, '2026-11-06T23:45:00+01:00')
  await seedWork(page, [{ id: 'night', title: 'Kurz abgleichen', createdAt: 1, earliestStart: new Date('2026-11-07T00:10:00+01:00').getTime() }])
  const hints = page.getByRole('complementary', { name: 'Demnächst bei der Arbeit', exact: true })
  await expect(hints.getByText('Ab morgen 00:10', { exact: true })).toBeVisible()
  const local = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  expect(local.focus).toBeUndefined()
  expect(local.workSessions ?? []).toEqual([])
  expect(local.work[0]?.state).not.toBe('active')
})

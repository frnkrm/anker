/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import { createCountdown, pauseCountdown } from '../src/core/focus'
import type { DayLog, GameState, LocalData, Settings, WorkTask } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const DATE = '2026-11-13'
const NOW = new Date(`${DATE}T10:00:00+01:00`).getTime()
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
const task: WorkTask = { id: 'recovery-work', title: 'Vertraulicher Auftrag', createdAt: NOW, state: 'paused', nextStep: 'Unterlagen prüfen', resumeNote: 'Bei Zeile zwei weiter', subtasks: [{ id: 'first', title: 'Erster offener Teil' }, { id: 'second', title: 'Aktueller zweiter Teil' }] }

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date(NOW))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
}

async function seed(page: Page, patch: Partial<LocalData> = {}) {
  const data = (await local(page)) ?? emptyLocal()
  Object.assign(data, { work: [structuredClone(task)],
    resume: { kind: 'work', refId: task.id, partId: 'second', title: 'Alter Titel', nextStep: 'Alter Schritt', note: 'Alte Notiz', at: NOW - 86_400_000 },
    focus: { id: 'paused-focus', target: { kind: 'work', id: task.id, partId: 'second' }, timer: pauseCountdown(createCountdown(300, NOW - 120_000), NOW - 60_000) }, ...patch })
  await seedRecords(page, [{ collection: 'meta', id: 'local', data }])
}

test('F-005: aktuelle Karte bleibt lokal, erhält die Pause und wartet im Fokus auf Weiter', async ({ page }, info) => {
  await onboard(page)
  await seed(page)
  await page.goto('/wiedereinstieg')
  const card = page.getByRole('region', { name: 'Wiedereinstieg', exact: true })
  await expect(card.getByRole('heading', { name: 'Aktueller zweiter Teil', exact: true })).toBeVisible()
  await expect(card).toContainText(task.title)
  await expect(card).toContainText('Pausiert · noch 4:00 im Zeitfenster')
  await expect(card).toContainText(task.resumeNote!)
  await expect(card).not.toContainText('Alter Schritt')
  const before = (await local(page))!
  const game = await storedRecord<GameState>(page, 'game', 'main')
  const day = await storedRecord<DayLog>(page, 'days', DATE)
  await page.reload()
  await expect(card).toContainText('4:00')
  expect(await local(page)).toEqual(before)
  await page.screenshot({ path: info.outputPath('wiedereinstieg.png'), fullPage: true })
  await page.getByRole('button', { name: 'Dort weitermachen', exact: true }).click()
  await expect(page).toHaveURL(/\/aufgabe\/work\/recovery-work\?teil=second$/)
  await expect(page.getByRole('timer')).toHaveText('4:00')
  expect((await local(page))!.focus).toEqual(before.focus)
  expect((await local(page))!.taskLearning).toEqual(before.taskLearning)
  expect(await storedRecord<GameState>(page, 'game', 'main')).toEqual(game)
  expect(await storedRecord<DayLog>(page, 'days', DATE)).toEqual(day)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('running')
  expect((await local(page))!.focus?.id).toBe(before.focus?.id)
})

test('F-005: abgelaufenes oder fehlendes Zeitfenster wird ehrlich gezeigt und nicht neu gestartet', async ({ page }) => {
  await onboard(page)
  await seed(page, { focus: { id: 'expired', target: { kind: 'work', id: task.id, partId: 'second' }, timer: createCountdown(60, NOW - 120_000) } })
  await page.goto('/wiedereinstieg')
  const card = page.getByRole('region', { name: 'Wiedereinstieg', exact: true })
  await expect(card).toContainText('Zeitfenster beendet')
  const before = (await local(page))!.focus
  await page.getByRole('button', { name: 'Dort weitermachen', exact: true }).click()
  await expect(page.getByRole('timer')).toHaveText('0:00')
  expect((await local(page))!.focus).toEqual(before)
  await seed(page, { focus: undefined, focusHistory: [] })
  await page.goto('/wiedereinstieg')
  await expect(card).toContainText('Kein gespeichertes Zeitfenster')
  await page.getByRole('button', { name: 'Dort weitermachen', exact: true }).click()
  await expect(page).toHaveURL(/\/aufgabe\/work\/recovery-work\?teil=second$/)
  await expect(page.getByRole('timer')).toHaveCount(0)
  expect((await local(page))!.focus).toBeUndefined()
})

test('F-005: erledigte oder entfernte Teilschritte ergeben keine private Rückkehrkarte und keinen Ersatztimer', async ({ page }) => {
  await onboard(page)
  for (const subtasks of [[{ id: 'second', title: 'Nicht mehr offen', doneAt: NOW }], []]) {
    await seed(page, { work: [{ ...task, subtasks }] })
    await page.goto('/wiedereinstieg')
    const card = page.getByRole('region', { name: 'Wiedereinstieg', exact: true })
    await expect(card).toContainText('Ein kleiner Einstieg reicht.')
    await expect(card).not.toContainText(task.title)
    await expect(card).not.toContainText(task.resumeNote!)
    expect((await local(page))!.focus).toBeUndefined()
    expect((await local(page))!.work[0]!.done).not.toBe(true)
  }
})

test('F-005: Routine verwendet den aktuellen Plan und bewahrt ihren pausierten Timer', async ({ page }) => {
  await onboard(page)
  await page.goto('/fokus/evening')
  await expect.poll(async () => (await local(page))?.focus?.target.kind).toBe('routine')
  const title = await page.getByRole('heading', { level: 1 }).innerText()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  const before = (await local(page))!.focus!
  await page.goto('/wiedereinstieg')
  const card = page.getByRole('region', { name: 'Wiedereinstieg', exact: true })
  await expect(card.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(card).toContainText('Pausiert')
  await page.getByRole('button', { name: 'Dort weitermachen', exact: true }).click()
  await expect(page).toHaveURL(/\/fokus\/evening$/)
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  expect((await local(page))!.focus).toEqual(before)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.routines.evening = settings.routines.evening.slice(1)
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.goto('/wiedereinstieg')
  await expect(card).toContainText('Ein kleiner Einstieg reicht.')
  await expect(card).not.toContainText(title)
  expect((await local(page))!.focus).toEqual(before)
})

test('F-005: Berliner Tageswechsel verwirft einen alten Routinenkontext', async ({ page }) => {
  await onboard(page)
  await page.goto('/fokus/evening')
  await expect.poll(async () => (await local(page))?.focus?.id).toBeTruthy()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  await page.clock.setFixedTime(new Date('2026-11-14T04:01:00+01:00'))
  await page.goto('/wiedereinstieg')
  await expect(page.getByRole('region', { name: 'Wiedereinstieg', exact: true })).toContainText('Ein kleiner Einstieg reicht.')
  await expect(page.getByRole('heading', { name: 'Hier warst du', exact: true })).toHaveCount(0)
})

test('F-005: lange lokale Notizen bleiben bei 320px und großer Schrift bedienbar', async ({ page }, info) => {
  await onboard(page)
  await seed(page, { work: [{ ...task, resumeNote: 'SehrLangeLokaleNotiz'.repeat(15) }] })
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/wiedereinstieg')
  await expect(page.getByRole('region', { name: 'Wiedereinstieg', exact: true })).toBeVisible()
  await page.addStyleTag({ content: 'html { font-size: 160% !important; }' })
  const button = page.getByRole('button', { name: 'Dort weitermachen', exact: true })
  await button.scrollIntoViewIfNeeded()
  await expect(button).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  expect(await page.getByRole('dialog').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: info.outputPath('wiedereinstieg-320.png'), fullPage: true })
  await button.click()
  await expect(page).toHaveURL(/\/aufgabe\/work\/recovery-work\?teil=second$/)
  expect((await local(page))!.focus!.timer.status).toBe('paused')
})

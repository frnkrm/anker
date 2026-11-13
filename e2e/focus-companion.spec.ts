/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import { createCountdown } from '../src/core/focus'
import type { DayLog, GameState, InboxItem, LocalData, Settings, WorkTask } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const DATE = '2026-11-13', NOW = Date.parse(`${DATE}T10:00:00+01:00`)
const PRIVATE = { title: 'PRIVATE-AUFGABE', note: 'PRIVATE-NOTIZ', part: 'PRIVATE-TEILSCHRITT' }
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
const card = (page: Page) => page.getByRole('region', { name: 'Stille Begleitung', exact: true })
const start = (page: Page) => card(page).getByRole('button', { name: 'Stille Begleitung starten', exact: true }).click()
const active = (page: Page) => card(page).getByRole('button', { name: 'Begleitung beenden', exact: true })

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date(NOW))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
}
async function setup(page: Page, kind: 'task' | 'work' = 'task', withTimer = true) {
  await onboard(page)
  const task = { id: 'companion', createdAt: NOW, state: 'active' as const, nextStep: PRIVATE.part, resumeNote: PRIVATE.note,
    subtasks: [{ id: 'a', title: 'Anderer Teil' }, { id: 'b', title: PRIVATE.part }] }
  const data: LocalData = { ...((await local(page)) ?? emptyLocal()), work: kind === 'work' ? [{ ...task, title: PRIVATE.title }] : [],
    ...(withTimer ? { focus: { id: 'focus', target: { kind, id: task.id, partId: 'b' }, timer: createCountdown(300, NOW) } } : { focus: undefined }),
  }
  const records: Parameters<typeof seedRecords>[1] = [{ collection: 'meta', id: 'local', data }]
  if (kind === 'task') records.push({ collection: 'inbox', id: task.id, data: { ...task, text: PRIVATE.title, status: 'task', taskDate: DATE } })
  await seedRecords(page, records)
  await page.goto(`/aufgabe/${kind}/companion?teil=b`)
  await expect(page.getByRole('heading', { level: 1, name: PRIVATE.part, exact: true })).toBeVisible()
}
async function state(page: Page) {
  return {
    local: await local(page), settings: await storedRecord<Settings>(page, 'settings', 'main'),
    game: await storedRecord<GameState>(page, 'game', 'main'), day: await storedRecord<DayLog>(page, 'days', DATE),
    task: await storedRecord<InboxItem>(page, 'inbox', 'companion'),
  }
}

test('F-009: offline ausdrücklich starten/beenden, ohne gespeicherte Änderungen oder private Begleittexte', async ({ page, context }) => {
  const external: string[] = []
  await page.route(/^https?:\/\//, route => {
    if (new URL(route.request().url()).hostname !== 'localhost') { external.push(new URL(route.request().url()).origin); return route.abort() }
    return route.continue()
  })
  await setup(page)
  await expect(card(page)).toBeVisible()
  await expect(active(page)).toHaveCount(0)
  const before = await state(page)
  await context.setOffline(true)
  await start(page)
  await expect(active(page)).toBeVisible()
  for (const text of Object.values(PRIVATE)) await expect(card(page)).not.toContainText(text)
  await expect(card(page)).toContainText('ohne Kontakt zu einer anderen Person')
  expect(await state(page)).toEqual(before)
  await active(page).click()
  await expect(card(page).getByRole('button', { name: 'Stille Begleitung starten', exact: true })).toBeVisible()
  expect(await state(page)).toEqual(before)
  expect(external).toEqual([])
})

test('F-009: Fokus erst bewusst starten; Begleitung startet und stoppt keinen Timer', async ({ page }) => {
  await setup(page, 'task', false)
  await expect(card(page)).toHaveCount(0)
  expect((await local(page))?.focus).toBeUndefined()
  await page.getByRole('button', { name: /^Fokus starten/ }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('running')
  await expect(card(page)).toBeVisible()
  const before = await state(page)
  await start(page); await expect(active(page)).toBeVisible(); await active(page).click()
  expect(await state(page)).toEqual(before)
})

test('F-009: Pause und Weiter übernehmen keine Begleitwahl oder automatische Fortsetzung', async ({ page }) => {
  await setup(page); await start(page)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  await expect(card(page)).toContainText('Dein Fokus ist pausiert')
  await expect(active(page)).toHaveCount(0)
  await expect(card(page).getByRole('button')).toHaveCount(0)
  const paused = (await local(page))!.focus!
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect(card(page).getByRole('button', { name: 'Stille Begleitung starten', exact: true })).toBeVisible()
  await expect(active(page)).toHaveCount(0)
  expect((await local(page))?.focus?.id).toBe(paused.id)
  const before = await state(page)
  await start(page)
  expect(await state(page)).toEqual(before)
})

test('F-009: Ausblenden, Wiederöffnen und Reload starten keine Begleitung', async ({ page }) => {
  await setup(page); await start(page)
  const before = await state(page)
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect(active(page)).toHaveCount(0)
  await start(page)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(active(page)).toHaveCount(0)
  expect(await state(page)).toEqual(before)
  await start(page); await page.reload()
  await expect(card(page)).toBeVisible(); await expect(active(page)).toHaveCount(0)
  expect(await state(page)).toEqual(before)
})

test('F-009: Ende des Zeitfensters beendet nur die Begleitung, ohne Erledigung oder Arbeitszeit', async ({ page }) => {
  await setup(page); await start(page)
  const before = await state(page)
  await page.clock.setFixedTime(new Date(NOW + 300_000))
  await expect(card(page)).toContainText('Dein Zeitfenster ist zu Ende')
  await expect(active(page)).toHaveCount(0)
  const after = await state(page)
  expect(after.local?.focus).toEqual(before.local?.focus)
  expect(after.local?.workSessions).toEqual(before.local?.workSessions)
  expect(after.local?.taskLearning).toEqual(before.local?.taskLearning)
  expect(after.task).toEqual(before.task); expect(after.game).toEqual(before.game); expect(after.day).toEqual(before.day)
  await page.getByRole('button', { name: /^Neues Zeitfenster starten/ }).click()
  await expect(card(page).getByRole('button', { name: 'Stille Begleitung starten', exact: true })).toBeVisible()
  await expect(active(page)).toHaveCount(0)
})

test('F-009: anderer oder erledigter Teil übernimmt weder Begleitung noch Ersatztimer', async ({ page }) => {
  await setup(page); await start(page)
  const before = (await local(page))!.focus!
  await page.getByRole('button', { name: 'Stopp', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Fokus stoppen', exact: true })
  await sheet.getByText('Anderen Schritt wählen', { exact: true }).click()
  await sheet.getByRole('radiogroup', { name: 'Fokus für', exact: true }).getByRole('radio', { name: 'Anderer Teil', exact: true }).click()
  await expect(card(page)).toHaveCount(0)
  expect((await local(page))?.focus).toEqual(before)
  await page.getByRole('radiogroup', { name: 'Fokus für', exact: true }).getByRole('radio', { name: PRIVATE.part, exact: true }).click()
  await expect(card(page)).toBeVisible(); await expect(active(page)).toHaveCount(0)
  await start(page)
  await page.getByRole('button', { name: 'Teilschritt erledigt', exact: true }).click()
  await expect(card(page)).toHaveCount(0)
  expect((await storedRecord<InboxItem>(page, 'inbox', 'companion'))?.done).not.toBe(true)
})

test('F-009: Routineplanwechsel und Wiedereinstieg halten die Begleitung ausgeschaltet', async ({ page }) => {
  await onboard(page)
  await page.goto('/fokus/evening')
  await expect(card(page)).toBeVisible()
  await start(page)
  await page.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await page.getByRole('button', { name: 'Heute anpassen', exact: true }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Heute anders', exact: true })
  await sheet.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await sheet.getByRole('button', { name: 'Plan ab jetzt neu machen', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/fokus/evening')
  await expect(card(page)).toBeVisible(); await expect(active(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  const before = (await local(page))!.focus!
  await page.goto('/wiedereinstieg')
  await page.getByRole('button', { name: 'Dort weitermachen', exact: true }).click()
  await expect(card(page)).toContainText('Dein Fokus ist pausiert')
  expect((await local(page))?.focus).toEqual(before)
})

test('F-009: Arbeitsruhe zeigt keine Begleitung für private Arbeitskontexte', async ({ page }) => {
  await setup(page, 'work')
  await expect(card(page)).toBeVisible()
  await start(page)
  await page.clock.setFixedTime(new Date(`${DATE}T22:00:00+01:00`))
  await expect(card(page)).toHaveCount(0)
  const work = (await local(page))!.work[0] as WorkTask
  expect(work.done).not.toBe(true)
  expect((await local(page))?.workSessions).toEqual([])
})

test('F-009: neuer Plan in derselben Ansicht übernimmt die laufende Begleitung nicht', async ({ page }) => {
  await setup(page); await start(page)
  const before = (await local(page))!.focus!
  await page.getByText('Details & Abschluss', { exact: true }).click()
  // Die bewusste bestehende Einstellung erzeugt eine neue Planreferenz ohne Routen-/Fokuswechsel.
  await page.getByRole('radiogroup', { name: 'Fokus-Puls', exact: true }).getByRole('radio', { name: 'Sanft', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.focus.pulse).toBe('gentle')
  await expect(active(page)).toHaveCount(0)
  await expect(card(page).getByRole('button', { name: 'Stille Begleitung starten', exact: true })).toBeVisible()
  expect((await local(page))?.focus).toEqual(before)
  await start(page)
  await expect(active(page)).toBeVisible()
})

test('F-009: 320px und große Schrift erhalten Hauptaktion und Begleitstopp', async ({ page }, info) => {
  await setup(page); await page.setViewportSize({ width: 320, height: 740 })
  await page.addStyleTag({ content: 'html { font-size: 160% !important; }' })
  await start(page)
  await active(page).scrollIntoViewIfNeeded(); await expect(active(page)).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const pause = page.getByRole('button', { name: 'Pause', exact: true })
  await pause.scrollIntoViewIfNeeded(); await expect(pause).toBeInViewport()
  await page.screenshot({ path: info.outputPath('focus-companion-320.png'), fullPage: true })
  await active(page).click()
  expect((await local(page))?.focus?.timer.status).toBe('running')
})

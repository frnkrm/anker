/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import type { FocusSession } from '../src/core/focus'
import type { GameState, InboxItem, LocalData } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

test.use({ hasTouch: true, timezoneId: 'Europe/Berlin' })
const START = Date.parse('2026-11-09T10:00:00+01:00')
const WORK = '/aufgabe/work/ui-bericht'
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')

async function setup(page: Page) {
  await page.clock.setFixedTime(new Date(START))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  const data = (await local(page)) ?? emptyLocal()
  data.work = [{ id: 'ui-bericht', title: 'Bericht', nextStep: 'Dokument öffnen', state: 'pending', createdAt: START, subtasks: [{ id: 'teil-a', title: 'Stichpunkte sammeln', estimateMin: 7 }, { id: 'teil-b', title: 'Text prüfen', estimateMin: 2 }] }]
  await seedRecords(page, [{ collection: 'meta', id: 'local', data }])
}

async function savedFocus(page: Page): Promise<FocusSession> {
  await expect.poll(async () => (await local(page))?.focus?.id).toBeTruthy()
  return (await local(page))!.focus!
}

async function clock(page: Page, at: number) {
  await page.clock.setFixedTime(new Date(at))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
}

test('Eigene Teilschrittdauer bleibt exakt; Ring-Pause und Ablauf erledigen nichts', async ({ page }) => {
  await setup(page)
  const xp = (await storedRecord<GameState>(page, 'game', 'main'))?.xp ?? 0
  await page.goto(`${WORK}?teil=teil-a`)
  await expect(page.getByRole('radiogroup', { name: 'Fokus für', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stopp', exact: true })).toHaveCount(0)
  await page.getByRole('radiogroup', { name: 'Teilschritt-Timer Minuten', exact: true }).getByRole('radio', { name: /Eigene/ }).click()
  const own = page.getByRole('dialog', { name: 'Teilschritt-Timer Minuten wählen', exact: true })
  await own.getByRole('spinbutton', { name: 'Teilschritt-Timer Minuten in Minuten', exact: true }).fill('3.5')
  await own.getByRole('spinbutton').blur()
  await own.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await page.getByRole('button', { name: /Fokus starten/ }).click()
  const session = await savedFocus(page)
  expect(session.timer.durationMs).toBe(210_000)
  await expect(page.getByRole('radiogroup', { name: 'Fokus für', exact: true })).toHaveCount(0)
  await expect(page.getByRole('timer')).toHaveText('3:30')
  await clock(page, START + 30_450)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  const paused = await savedFocus(page)
  if (paused.timer.status !== 'paused') throw new Error('Pause fehlt')
  expect(paused.timer.remainingMs).toBe(179_550)
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('3:00')
  await expect(page.getByText(/^Pausiert ·/)).toBeVisible()
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  const resumed = await savedFocus(page)
  if (resumed.timer.status !== 'running') throw new Error('Fortsetzung fehlt')
  await clock(page, resumed.timer.deadlineAt + 1)
  await expect(page.getByRole('timer')).toHaveText('0:00')
  const after = (await local(page))!
  expect(after.work[0]?.done).not.toBe(true)
  expect(after.work[0]?.subtasks?.every(part => part.doneAt === undefined)).toBe(true)
  expect(after.workSessions).toEqual([])
  expect((await storedRecord<GameState>(page, 'game', 'main'))?.xp ?? 0).toBe(xp)
})

test('Stopp bietet Wiedereinstieg und erhält Notiz, Aufgabe und Teilschritt', async ({ page }) => {
  await setup(page)
  await page.goto(`${WORK}?teil=teil-b`)
  await page.getByRole('button', { name: /Fokus starten/ }).click()
  await savedFocus(page)
  await page.getByRole('button', { name: 'Stopp', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Unterbrochen – Wiedereinstieg merken', exact: true }).click()
  await page.getByRole('textbox', { name: 'Wenn ich zurückkomme', exact: true }).fill('Beim zweiten Absatz weiterlesen')
  await page.getByRole('button', { name: 'Pause und Wiedereinstieg merken', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(async () => (await local(page))?.resume?.note).toBe('Beim zweiten Absatz weiterlesen')
  expect((await local(page))?.resume?.partId).toBe('teil-b')
  expect((await local(page))?.work[0]?.state).toBe('paused')
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('2:00')
  await page.getByRole('button', { name: 'Stopp', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Einfach beenden', exact: true }).click()
  await expect(page.getByRole('timer')).toHaveCount(0)
  expect((await local(page))?.work[0]?.done).not.toBe(true)
  expect((await local(page))?.work[0]?.resumeNote).toBe('Beim zweiten Absatz weiterlesen')
})

test('Gedanke lässt sich sofort festhalten; Filter verändern keine Einordnung', async ({ page }) => {
  await setup(page)
  const note: InboxItem = { id: 'ui-privat', text: 'Private Aufgabe', status: 'task', taskDate: '2026-11-09', createdAt: START }
  await seedRecords(page, [{ collection: 'inbox', id: note.id, data: note }])
  await page.goto('/inbox')
  await page.getByRole('button', { name: 'Merken', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Trage deinen Gedanken ein. Ein paar Worte genügen.')
  await page.getByRole('textbox', { name: 'Gedanke festhalten', exact: true }).fill('Eine Idee für später')
  await page.getByRole('button', { name: 'Merken', exact: true }).click()
  await expect(page.getByText('1 offener Gedanke', { exact: true })).toBeVisible()
  await expect(page.getByText('Eine Idee für später', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Private Aufgabe', exact: true })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Private Aufgaben', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Private Aufgabe', exact: true })).toBeVisible()
  await page.getByRole('radio', { name: 'Gedanken', exact: true }).click()
  expect((await storedRecord<InboxItem>(page, 'inbox', note.id))?.status).toBe('task')
  await page.reload()
  await expect(page.getByText('Eine Idee für später', { exact: true })).toBeVisible()
})

test('Schneller Gedanke übernimmt einen bestehenden Teil-Entwurf samt lokalem Kontext', async ({ page }) => {
  await setup(page)
  await page.goto(`${WORK}?teil=teil-a`)
  await page.getByRole('button', { name: /Fokus starten/ }).click()
  const session = await savedFocus(page)
  await page.getByRole('button', { name: 'Gedanken festhalten', exact: true }).click()
  await page.getByRole('textbox', { name: 'Gedanke', exact: true }).fill('Unfertiger Einfall')
  await page.getByRole('textbox', { name: 'Gedanke', exact: true }).blur()
  await expect.poll(async () => (await local(page))?.captureDraft?.context?.partId).toBe('teil-a')
  const draft = (await local(page))!.captureDraft!
  await page.goto('/inbox')
  await expect(page.getByRole('textbox', { name: 'Gedanke festhalten', exact: true })).toHaveValue('Unfertiger Einfall')
  await page.getByRole('textbox', { name: 'Gedanke festhalten', exact: true }).fill('Einfall vollständig ergänzt')
  await page.getByRole('button', { name: 'Merken', exact: true }).click()
  await expect.poll(async () => (await storedRecord<InboxItem>(page, 'inbox', draft.id))?.text).toBe('Einfall vollständig ergänzt')
  const note = (await storedRecord<InboxItem>(page, 'inbox', draft.id))!
  expect(note.captureContext).toBe('Arbeit')
  expect(JSON.stringify(note)).not.toContain('Stichpunkte sammeln')
  expect((await local(page))?.captureDraft).toBeUndefined()
  expect((await local(page))?.focus).toEqual(session)
})

test('Pausierte Arbeit zeigt keine Unterbrechungsaktion; Karten bleiben bei 130 Prozent in einer Reihe', async ({ page }) => {
  await setup(page)
  const data = (await local(page))!
  data.work[0]!.state = 'paused'
  await seedRecords(page, [{ collection: 'meta', id: 'local', data }])
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/arbeit')
  await page.evaluate(() => document.documentElement.style.fontSize = '130%')
  await expect(page.getByRole('button', { name: 'Ich wurde unterbrochen', exact: true })).toHaveCount(0)
  const card = page.getByRole('heading', { name: 'Bericht', exact: true }).locator('..')
  const buttons = await Promise.all(['Weiter', 'Erledigt', 'Details'].map(name => card.getByRole('button', { name: new RegExp(`^${name}`) }).boundingBox()))
  expect(buttons.every(Boolean)).toBe(true)
  const [start, done, details] = buttons.map(box => box!)
  expect(Math.abs(start!.y - done!.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(start!.y - details!.y)).toBeLessThanOrEqual(1)
  expect(start!.x + start!.width).toBeLessThanOrEqual(done!.x)
  expect(done!.x + done!.width).toBeLessThanOrEqual(details!.x)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import { makeBackup } from '../src/core/export/backup'
import { initialGame } from '../src/core/game'
import { buildDayPlan } from '../src/core/planner'
import { suggestTaskWindow } from '../src/core/support'
import { zonedToUtc } from '../src/core/time'
import type { DayLog, GameState, InboxItem, LocalData, Settings } from '../src/core/types'
import type { Rec } from '../src/data/types'
import { storedRecord } from './helpers/storage'

const DATE = '2026-11-02'
const START = zonedToUtc(DATE, 10 * 60)
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date(START))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function clock(page: Page, at: number) {
  await page.clock.setFixedTime(new Date(at))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
}

/** Ein Dokumentwechsel wartet auf Dialog und den asynchron aufgeräumten Modal-Verlauf. */
async function sheetsClosed(page: Page) {
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => history.state?.ankerSheet ?? null)).toBeNull()
}

/** Erst nach dem geladenen Einstieg entscheiden; ein Neustart rendert den Fokus verzögert. */
async function openCapture(page: Page) {
  const direct = page.getByRole('button', { name: 'Gedanken festhalten', exact: true })
  const adjust = page.getByRole('button', { name: 'Heute anpassen', exact: true })
  await expect(direct.or(adjust).first()).toBeVisible()
  if (await direct.isVisible()) await direct.click()
  else {
    await adjust.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Gedanke festhalten', exact: true }).click()
  }
}

async function capture(page: Page, text: string) {
  await openCapture(page)
  await page.getByRole('textbox', { name: 'Gedanke', exact: true }).fill(text)
  await expect.poll(async () => (await local(page))?.captureDraft?.text).toBe(text)
  const id = (await local(page))!.captureDraft!.id
  await page.getByRole('button', { name: 'Merken', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gespeichert', exact: true })).toBeVisible()
  await expect.poll(async () => (await storedRecord<InboxItem>(page, 'inbox', id))?.text).toBe(text)
  return id
}

test('Fokus-Capture erhält einen unfertigen Entwurf beim Neustart und kehrt zum tatsächlichen Schritt zurück', async ({ page }) => {
  await onboard(page)
  // Der globale Tagesplan ist bei der Arbeit; die bewusst geöffnete Abendroutine ist der reale Capture-Kontext.
  await expect(page.getByRole('heading', { name: 'Arbeit', exact: true })).toBeVisible()
  await page.goto('/fokus/evening')
  await expect.poll(async () => (await local(page))?.focus?.id).toBeTruthy()
  const before = (await local(page))!.focus!
  const heading = await page.getByRole('heading', { level: 1 }).innerText()
  await openCapture(page)
  await page.getByRole('textbox', { name: 'Gedanke', exact: true }).fill('Die Idee bleibt eine Notiz')
  await expect.poll(async () => (await local(page))?.captureDraft?.text).toBe('Die Idee bleibt eine Notiz')
  const draft = (await local(page))!.captureDraft!
  expect(draft.context).toMatchObject({ kind: 'step', title: heading, route: '/fokus/evening' })
  await page.reload()
  await openCapture(page)
  await expect(page.getByRole('textbox', { name: 'Gedanke', exact: true })).toHaveValue(draft.text)
  await page.getByRole('button', { name: 'Merken', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(heading, { exact: true })).toBeVisible()
  await expect.poll(async () => (await storedRecord<InboxItem>(page, 'inbox', draft.id))?.status).toBe('open')
  await dialog.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect(page).toHaveURL(/\/fokus\/evening$/)
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  expect((await local(page))?.focus).toEqual(before)
  expect((await local(page))?.captureDraft).toBeUndefined()
  const note = (await storedRecord<InboxItem>(page, 'inbox', draft.id))!
  expect(note).toMatchObject({ text: draft.text, captureContext: heading, status: 'open' })
  expect(note.taskDate).toBeUndefined()
  if (before.target.kind !== 'routine') throw new Error('Routinenfokus fehlt')
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.steps[`evening:${before.target.stepId}`]).toBeUndefined()
})

test('Arbeitsunterbrechung findet nach drei Tagen denselben nächsten Schritt, Timer und lokale Notiz wieder', async ({ page }) => {
  await onboard(page)
  await page.goto('/arbeit')
  await page.getByRole('textbox', { name: 'Neue Aufgabe', exact: true }).fill('Vertraulicher Kundenbericht')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  const card = page.getByRole('heading', { name: 'Vertraulicher Kundenbericht', exact: true }).locator('..')
  await card.getByRole('button', { name: /^Starten/ }).click()
  await expect(page).toHaveURL(/\/aufgabe\/work\//)
  const initial = (await local(page))!.focus!
  const id = await capture(page, 'Privater Einfall neben der Arbeit')
  await page.getByRole('dialog').getByRole('button', { name: 'Weiter', exact: true }).click()
  const note = (await storedRecord<InboxItem>(page, 'inbox', id))!
  expect(note.captureContext).toBe('Arbeit')
  expect(JSON.stringify(note)).not.toContain('Vertraulicher Kundenbericht')
  await clock(page, START + 5 * 60_000)
  await page.getByRole('button', { name: 'Stopp', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Unterbrochen – Wiedereinstieg merken', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nächster kleiner Schritt', exact: true }).fill('Tabelle öffnen')
  await page.getByRole('textbox', { name: 'Wenn ich zurückkomme', exact: true }).fill('Die zweite Zeile ansehen')
  await page.getByRole('button', { name: 'Pause und Wiedereinstieg merken', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  const paused = (await local(page))!.focus!
  if (paused.timer.status !== 'paused') throw new Error('Pausenzustand fehlt')
  expect(paused.timer.remainingMs).toBe(20 * 60_000)
  await clock(page, START + 3 * 86_400_000)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tabelle öffnen', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Dort weitermachen', exact: true }).click()
  await expect(page).toHaveURL(/\/aufgabe\/work\//)
  await expect(page.getByRole('heading', { name: 'Tabelle öffnen', exact: true })).toBeVisible()
  await expect(page.getByText('Für den Wiedereinstieg: Die zweite Zeile ansehen', { exact: true })).toBeVisible()
  await expect(page.getByRole('timer')).toHaveText('20:00')
  expect((await local(page))!.focus).toEqual(paused)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('running')
  const resumed = (await local(page))!.focus!
  expect(resumed.id).toBe(initial.id)
  expect(resumed.target).toEqual(initial.target)
  expect(resumed.timer.status).toBe('running')
  expect((await local(page))?.workSessions).toEqual([])
  expect((await local(page))?.work[0]?.done).not.toBe(true)
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('20:00')
  expect((await local(page))?.resume?.note).toBe('Die zweite Zeile ansehen')
})

test('Altbackup bleibt nach echter Offline-Migration, Nichtnutzung und Arbeits-Undo vollständig erhalten', async ({ page, context }) => {
  await onboard(page)
  const legacy = emptyLocal()
  legacy.work = [{ id: 'legacy-work', title: 'Alter Arbeitsauftrag', createdAt: START - 86_400_000 }]
  const report = { result: 'partial' as const, note: 'Historische Beobachtung', at: START - 86_400_000, platform: 'android' as const, device: 'Galaxy S26 Ultra', os: '', appVersion: '1.0.1', build: '1', suiteVersion: 'alter-pruefstand' }
  legacy.deviceTests = { reports: { '1': report } }
  const game = { ...initialGame('2026-10-15'), xp: 137, spent: 40, chapter: { index: 0, startDate: '2026-10-15', jokerUsed: true, attempt: 4 }, badges: ['vorhanden'] }
  const oldNote: InboxItem = { id: 'legacy-note', text: 'Alter offener Gedanke', status: 'open', createdAt: START - 86_400_000 }
  const records: Rec[] = [
    { collection: 'meta', id: 'local', data: legacy, updated_at: START + 1000, deleted: false },
    { collection: 'game', id: 'main', data: game, updated_at: START + 1000, deleted: false },
    { collection: 'inbox', id: oldNote.id, data: oldNote, updated_at: START + 1000, deleted: false },
  ]
  await page.goto('/backup')
  const file = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Sicherung importieren', exact: true }).click()
  await (await file).setFiles({ name: 'anker-altbestand.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeBackup(records))) })
  await expect(page.getByRole('heading', { name: 'Vor dem Import prüfen', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Jetzt importieren', exact: true }).click()
  await expect(page.getByText('3 Einträge übernommen. Neuere Daten auf dem Gerät bleiben erhalten.', { exact: true })).toBeVisible()
  await expect.poll(async () => (await local(page))?.work[0]?.title).toBe('Alter Arbeitsauftrag')
  expect((await local(page))?.deviceTests?.reports['1']).toEqual(report)
  expect((await storedRecord<GameState>(page, 'game', 'main'))).toMatchObject(game)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await context.setOffline(true)
  await clock(page, START + 3 * 86_400_000)
  await page.goto('/arbeit')
  const card = page.getByRole('heading', { name: 'Alter Arbeitsauftrag', exact: true }).locator('..')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  await card.getByRole('textbox', { name: 'Nächster Schritt', exact: true }).fill('Alte Datei öffnen')
  await card.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect(card.getByText('Details gespeichert.', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.done).toBe(true)
  await page.getByText('Erledigt (1)', { exact: true }).click()
  await page.getByRole('button', { name: 'Alter Arbeitsauftrag zurücknehmen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.done).toBe(false)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Alter Arbeitsauftrag', exact: true })).toBeVisible()
  expect((await local(page))?.work[0]).toMatchObject({ title: 'Alter Arbeitsauftrag', nextStep: 'Alte Datei öffnen', done: false })
  expect((await local(page))?.deviceTests?.reports['1']).toEqual(report)
  expect((await storedRecord<GameState>(page, 'game', 'main'))).toMatchObject({ xp: game.xp, spent: game.spent, chapter: game.chapter, badges: game.badges })
  expect(await storedRecord<InboxItem>(page, 'inbox', oldNote.id)).toEqual(oldNote)
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
})

test('Bewusst morgen eingeplanter Gedanke nutzt in Tagesplan und Jetzt dieselbe Aufgabe mit einmaligem Abschluss und Undo', async ({ page }) => {
  await onboard(page)
  const id = await capture(page, 'Schublade ordnen')
  await page.getByRole('dialog').getByRole('button', { name: 'Weiter', exact: true }).click()
  await sheetsClosed(page)
  await page.goto('/inbox')
  await page.getByRole('button', { name: 'Für morgen einplanen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<InboxItem>(page, 'inbox', id))?.taskDate).toBe('2026-11-03')
  expect((await storedRecord<InboxItem>(page, 'inbox', id))?.done).not.toBe(true)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  const plan = buildDayPlan({ date: '2026-11-03', settings })
  const window = suggestTaskWindow(plan, 5)
  if (!window?.fits) throw new Error('Kein freies, passendes Aufgabenfenster im tatsächlichen Plan')
  await clock(page, zonedToUtc('2026-11-03', window.start + 1))
  await page.goto('/tag')
  await expect(page.getByRole('heading', { name: 'Schublade ordnen', exact: true })).toHaveCount(1)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Schublade ordnen', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect.poll(async () => (await storedRecord<InboxItem>(page, 'inbox', id))?.done).toBe(true)
  const doneAt = (await storedRecord<InboxItem>(page, 'inbox', id))!.doneAt
  expect(doneAt).toBe(zonedToUtc('2026-11-03', window.start + 1))
  await page.goto('/tag')
  await expect(page.getByRole('heading', { name: 'Schublade ordnen', exact: true })).toHaveCount(0)
  await page.goto('/inbox')
  await page.getByRole('radio', { name: 'Private Aufgaben', exact: true }).click()
  await page.getByText('Erledigt (1)', { exact: true }).click()
  await page.getByRole('button', { name: 'Schublade ordnen zurücknehmen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<InboxItem>(page, 'inbox', id))?.done).toBe(false)
  await page.goto('/tag')
  await expect(page.getByRole('heading', { name: 'Schublade ordnen', exact: true })).toHaveCount(1)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Schublade ordnen', exact: true })).toBeVisible()
  expect((await storedRecord<InboxItem>(page, 'inbox', id))?.doneAt).toBeUndefined()
})

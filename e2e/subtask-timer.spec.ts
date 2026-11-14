/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import type { FocusSession } from '../src/core/focus'
import type { GameState, InboxItem, LocalData, Settings, WorkTask } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

test.use({ hasTouch: true })

const START = new Date('2026-11-06T10:00:00+01:00').getTime()
const ROUTE = '/aufgabe/work/teil-bericht'
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')

async function widthDiagnostics(page: Page) {
  return page.evaluate(() => ({
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    font: getComputedStyle(document.body).fontFamily,
    overflowing: Array.from(document.querySelectorAll<HTMLElement>('body *')).flatMap((element) => {
      const box = element.getBoundingClientRect()
      if (!box.width || (box.right <= innerWidth + 1 && box.left >= -1)) return []
      const style = getComputedStyle(element)
      return [{ tag: element.tagName, label: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 50), left: box.left, right: box.right, width: box.width, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, minWidth: style.minWidth, display: style.display, font: style.font, overflowWrap: style.overflowWrap }]
    }).slice(0, 15),
  }))
}

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date(START))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
}

async function seedWork(page: Page, change: Partial<WorkTask> = {}) {
  const data = (await local(page)) ?? emptyLocal()
  data.work = [{ id: 'teil-bericht', title: 'Bericht', nextStep: 'Unterlagen sichten', createdAt: START, state: 'pending', subtasks: [
    { id: 'teil-a', title: 'Tabelle öffnen', estimateMin: 7 },
    { id: 'teil-b', title: 'Zahlen prüfen', estimateMin: 2 },
  ], ...change }]
  await seedRecords(page, [{ collection: 'meta', id: 'local', data }])
}

async function focus(page: Page): Promise<FocusSession> {
  await expect.poll(async () => (await local(page))?.focus?.id).toBeTruthy()
  return (await local(page))!.focus!
}

async function at(page: Page, ms: number) {
  await page.clock.setFixedTime(new Date(ms))
  await page.locator('body').dispatchEvent('visibilitychange', { bubbles: true })
}

/** Vor einem Dokumentwechsel muss auch der geschlossene Modal-Verlauf aufgeräumt sein. */
async function sheetsClosed(page: Page) {
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => history.state?.ankerSheet ?? null)).toBeNull()
  await expect.poll(() => page.locator('#root').evaluate((node) => !!node.closest('[inert]'))).toBe(false)
}

async function target(page: Page, partId: string) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const visibleChoice = page.getByRole('radiogroup', { name: 'Fokus für', exact: true })
  await expect(visibleChoice.or(page.getByRole('button', { name: 'Stopp', exact: true })).first()).toBeVisible()
  if (!await visibleChoice.isVisible()) {
    await page.getByRole('button', { name: 'Stopp', exact: true }).click()
    await page.getByRole('dialog').getByText('Anderen Schritt wählen', { exact: true }).click()
  }
  // This choice navigates and consumes the stop dialog. A saved timer can also
  // remove the root choice, so validate its destination instead of the old radio.
  const task = (await local(page))!.work.find((item) => item.id === 'teil-bericht')!
  const heading = partId ? task.subtasks!.find((part) => part.id === partId)!.title : task.nextStep!
  await visibleChoice.locator(`button[value=${JSON.stringify(partId)}]`).click()
  await expect(page).toHaveURL((url) => url.pathname === ROUTE && url.searchParams.get('teil') === partId)
  await sheetsClosed(page)
  await expect.poll(() => page.locator('#root').evaluate((node) => !!node.closest('[inert]'))).toBe(false)
  await expect(page.getByRole('heading', { name: heading, level: 1, exact: true })).toBeVisible()
  if (await visibleChoice.isVisible()) await expect(visibleChoice.locator(`button[value=${JSON.stringify(partId)}]`)).toHaveAttribute('aria-checked', 'true')
}

async function duration(page: Page, minutes: string) {
  await page.getByRole('radiogroup', { name: 'Teilschritt-Timer Minuten', exact: true }).getByRole('radio', { name: /Eigene/ }).click()
  const dialog = page.getByRole('dialog').last()
  const field = dialog.getByRole('spinbutton', { name: 'Teilschritt-Timer Minuten in Minuten', exact: true })
  await field.fill(minutes)
  await field.blur()
  await dialog.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await sheetsClosed(page)
}

async function stop(page: Page) {
  await page.getByRole('button', { name: 'Stopp', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Einfach beenden', exact: true }).click()
}

async function start(page: Page, partId: string, minutes: string) {
  await target(page, partId)
  await duration(page, minutes)
  await page.getByRole('button', { name: /^Fokus starten/ }).click()
  await expect.poll(async () => {
    const target = (await local(page))?.focus?.target
    return target?.kind === 'work' ? target.partId : undefined
  }).toBe(partId)
  return focus(page)
}

test('Bewusster freier Teilschritt-Timer erhält Pause und Reload; Ablauf bucht und erledigt nichts', async ({ page }) => {
  await onboard(page)
  await seedWork(page)
  const xp = (await storedRecord<GameState>(page, 'game', 'main'))?.xp ?? 0
  await page.goto(`${ROUTE}?teil=teil-a`)
  await expect(page.getByRole('heading', { name: 'Tabelle öffnen', exact: true })).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Teilschritt-Timer Minuten' }).getByRole('radio', { name: 'Eigene · 7 min', exact: true })).toHaveAttribute('aria-checked', 'true')
  await at(page, START + 120_000)
  expect((await local(page))?.focus).toBeUndefined()
  const initial = await start(page, 'teil-a', '3.5')
  expect(initial.timer.durationMs).toBe(210_000)
  expect((await local(page))!.work[0]!.subtasks![0]!.timerMin).toBe(3.5)
  await at(page, START + 150_450)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  const paused = await focus(page)
  if (paused.timer.status !== 'paused') throw new Error('Persistierte Pause fehlt')
  expect(paused.timer.remainingMs).toBe(179_550)
  await at(page, START + 3_600_000)
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('3:00')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('running')
  const resumed = await focus(page)
  expect(resumed.id).toBe(initial.id)
  if (resumed.timer.status !== 'running') throw new Error('Fortgesetzter Timer fehlt')
  expect(resumed.timer.deadlineAt).toBe(START + 3_600_000 + paused.timer.remainingMs)
  await at(page, resumed.timer.deadlineAt + 1)
  await expect(page.getByRole('timer')).toHaveText('0:00')
  await expect(page.getByText(/^Zeitfenster zu Ende\./)).toBeVisible()
  const after = (await local(page))!
  expect(after.work[0]!.done).not.toBe(true)
  expect(after.work[0]!.subtasks!.every((part) => part.doneAt === undefined)).toBe(true)
  expect(after.workSessions).toEqual([])
  expect((await storedRecord<GameState>(page, 'game', 'main'))?.xp ?? 0).toBe(xp)
  await stop(page)
  await expect.poll(async () => (await local(page))?.focus).toBeUndefined()
  await page.reload()
  await expect(page.getByRole('timer')).toHaveCount(0)
  await expect(page.getByRole('radiogroup', { name: 'Teilschritt-Timer Minuten' }).getByRole('radio', { name: 'Eigene · 3,5 min', exact: true })).toHaveAttribute('aria-checked', 'true')
})

test('Teilschritte A und B sowie ganze Aufgabe behalten eigene Timer und wechseln erst auf Start', async ({ page }) => {
  await onboard(page)
  await seedWork(page)
  await page.goto(ROUTE)
  const first = await start(page, 'teil-a', '7')
  await at(page, START + 20_000)
  await target(page, 'teil-b')
  expect((await local(page))?.focus).toEqual(first)
  const second = await start(page, 'teil-b', '2')
  expect(second.id).not.toBe(first.id)
  const archivedA = (await local(page))!.focusHistory!.find((saved) => saved.id === first.id)!
  if (archivedA.timer.status !== 'paused') throw new Error('Archivpause fehlt')
  expect(archivedA.timer.remainingMs).toBe(400_000)
  await at(page, START + 40_000)
  await target(page, '')
  await page.getByRole('button', { name: /^Fokus starten/ }).click()
  await expect.poll(async () => (await local(page))?.focus?.id).not.toBe(second.id)
  const parent = await focus(page)
  expect(parent.target).toEqual({ kind: 'work', id: 'teil-bericht' })
  expect(parent.timer.durationMs).toBe(25 * 60_000)
  await at(page, START + 50_000)
  await target(page, 'teil-a')
  await expect(page.getByRole('timer')).toHaveText('6:40')
  expect((await local(page))?.focus?.id).toBe(parent.id)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.id).toBe(first.id)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Tabelle öffnen', exact: true })).toBeVisible()
  const restored = await focus(page)
  if (restored.timer.status !== 'running') throw new Error('Laufender Timer fehlt')
  expect(restored.timer.deadlineAt).toBe(START + 450_000)
  expect((await local(page))!.focusHistory!.map((saved) => saved.id).sort()).toEqual([second.id, parent.id].sort())
  expect((await local(page))!.workSessions).toEqual([])
})

test('Details wählen den Timer ohne Start; Umbenennen erhält ID und Restzeit, Teilabschluss bleibt Teilabschluss', async ({ page }) => {
  await onboard(page)
  await seedWork(page)
  await page.goto('/arbeit')
  let card = page.getByRole('heading', { name: 'Bericht', exact: true }).locator('..')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  const choose = card.getByRole('button', { name: 'Timer wählen: Tabelle öffnen', exact: true })
  const size = await choose.boundingBox()
  expect(size!.height).toBeGreaterThanOrEqual(44)
  await choose.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\?teil=teil-a$/)
  await expect(page.getByRole('timer')).toHaveCount(0)
  expect((await local(page))?.focus).toBeUndefined()
  const before = await start(page, 'teil-a', '8')
  await page.goto('/arbeit')
  card = page.getByRole('heading', { name: 'Bericht', exact: true }).locator('..')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  await card.getByRole('textbox', { name: 'Text Teilschritt 1', exact: true }).fill('Aktuelle Tabelle öffnen')
  await card.getByRole('textbox', { name: 'Text Teilschritt 1', exact: true }).blur()
  await expect.poll(async () => (await local(page))?.work[0]?.subtasks?.[0]?.title).toBe('Aktuelle Tabelle öffnen')
  await card.getByRole('button', { name: 'Eintrag 1 nach unten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.subtasks?.[1]?.id).toBe('teil-a')
  await page.goto(`${ROUTE}?teil=teil-a`)
  await expect(page.getByRole('heading', { name: 'Aktuelle Tabelle öffnen', exact: true })).toBeVisible()
  expect((await local(page))?.focus).toEqual(before)
  await page.getByRole('button', { name: 'Teilschritt erledigt', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.subtasks?.find((part) => part.id === 'teil-a')?.doneAt).toBe(START)
  await expect(page.getByRole('heading', { name: 'Teilschritt nicht verfügbar', exact: true })).toBeVisible()
  await expect(page.getByText('Dieser Teilschritt ist bereits erledigt.', { exact: false })).toBeVisible()
  expect((await local(page))?.focus).toBeUndefined()
  expect((await local(page))?.work[0]?.done).not.toBe(true)
  expect((await local(page))?.work[0]?.subtasks?.find((part) => part.id === 'teil-b')?.doneAt).toBeUndefined()
  await page.reload()
  await expect(page.getByRole('timer')).toHaveCount(0)
  await start(page, 'teil-b', '2')
  await page.goto('/arbeit')
  card = page.getByRole('heading', { name: 'Bericht', exact: true }).locator('..')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  await card.getByRole('button', { name: 'Teilschritt entfernen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.work[0]?.subtasks?.map((part) => part.id)).toEqual(['teil-a'])
  await page.goto(`${ROUTE}?teil=teil-b`)
  await expect(page.getByText('Dieser Teilschritt ist nicht mehr in der Aufgabe.', { exact: false })).toBeVisible()
  expect((await local(page))?.focus).toBeUndefined()
  expect((await local(page))?.work[0]?.done).not.toBe(true)
})

for (const state of ['erledigt', 'entfernt'] as const) {
  test(`Veralteter Teilschritt-Link (${state}) startet keinen Eltern- oder Ersatz-Timer`, async ({ page }) => {
    await onboard(page)
    await seedWork(page, { subtasks: state === 'erledigt' ? [{ id: 'teil-a', title: 'Tabelle öffnen', doneAt: START - 1 }] : [{ id: 'teil-b', title: 'Zahlen prüfen' }] })
    await page.goto(ROUTE)
    await page.getByRole('button', { name: /^Fokus starten/ }).click()
    const parent = await focus(page)
    await page.goto(`${ROUTE}?teil=teil-a`)
    await expect(page.getByRole('heading', { name: 'Teilschritt nicht verfügbar', exact: true })).toBeVisible()
    await expect(page.getByRole('timer')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Fokus starten/ })).toHaveCount(0)
    expect((await local(page))?.focus).toEqual(parent)
    await target(page, '')
    await expect(page.getByRole('timer')).toHaveText('25:00')
    expect((await local(page))?.focus).toEqual(parent)
  })
}

async function startFocusByKeyboard(page: Page) {
  await sheetsClosed(page)
  const start = page.getByRole('button', { name: /^Fokus starten/ })
  await expect(start).toBeEnabled()
  await start.focus()
  await expect(start).toBeFocused()
  await page.keyboard.press('Enter')
}

test('Freie Minuten sind per Tastatur bedienbar, ungültige Dauer bleibt ohne Start, kleine Anzeige läuft nicht über', async ({ page }, testInfo) => {
  await onboard(page)
  await seedWork(page)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(`${ROUTE}?teil=teil-a`)
  await page.evaluate(() => document.documentElement.style.fontSize = '160%')
  await page.getByRole('radiogroup', { name: 'Teilschritt-Timer Minuten' }).getByRole('radio', { name: /Eigene/ }).click()
  const picker = page.getByRole('dialog').last()
  const minutes = picker.getByRole('spinbutton', { name: 'Teilschritt-Timer Minuten in Minuten', exact: true })
  await minutes.fill('0')
  await minutes.blur()
  await expect(minutes).toHaveValue('0.01')
  expect((await local(page))?.focus).toBeUndefined()
  await minutes.fill('11.25')
  await minutes.press('Tab')
  await picker.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await startFocusByKeyboard(page)
  await expect.poll(async () => (await local(page))?.focus?.timer.durationMs).toBe(675_000)
  const originalFont = await page.evaluate(() => document.body.style.fontFamily)
  const widths = []
  for (const font of ['"DejaVu Sans", sans-serif', 'monospace']) {
    await page.evaluate((family) => { document.body.style.fontFamily = family }, font)
    widths.push(await widthDiagnostics(page))
  }
  await page.evaluate((family) => { document.body.style.fontFamily = family }, originalFont)
  await testInfo.attach('taskfocus-font-widths', { body: Buffer.from(JSON.stringify(widths, null, 2)), contentType: 'application/json' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  for (const width of widths) expect(width.scrollWidth - width.viewport, JSON.stringify(width)).toBeLessThanOrEqual(1)
  for (const name of ['Pause', 'Stopp']) {
    const size = await page.getByRole('button', { name, exact: true }).boundingBox()
    expect(size!.height).toBeGreaterThanOrEqual(44)
  }
  await page.screenshot({ path: testInfo.outputPath('teilschritt-320.png'), fullPage: true })
  await stop(page)
  await expect.poll(async () => (await local(page))?.focus).toBeUndefined()
  await duration(page, '1440')
  await page.getByRole('button', { name: /^Fokus starten/ }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.durationMs).toBe(86_400_000)
  await expect(page.getByRole('timer')).toHaveText('1440:00')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
})

test('Arbeitskarte und Fokusshortcut setzen denselben pausierten Teilschritt fort', async ({ page }) => {
  await onboard(page)
  await seedWork(page)
  await page.goto(`${ROUTE}?teil=teil-a`)
  const initial = await start(page, 'teil-a', '9')
  await at(page, START + 60_000)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  await page.goto('/arbeit')
  const card = page.getByRole('heading', { name: 'Bericht', exact: true }).locator('..')
  await card.getByRole('button', { name: /^Weiter/ }).click()
  await expect(page).toHaveURL(/\?teil=teil-a$/)
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('running')
  expect((await local(page))?.focus?.id).toBe(initial.id)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  await page.goto('/fokus-start')
  await expect(page).toHaveURL(/\/aufgabe\/work\/teil-bericht\?teil=teil-a$/)
  await expect(page.getByRole('heading', { name: 'Tabelle öffnen', exact: true })).toBeVisible()
  await expect(page.getByRole('timer')).toHaveText('8:00')
  expect((await local(page))?.focus?.id).toBe(initial.id)
  expect((await local(page))?.workSessions).toEqual([])
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('paused')
  await page.goto('/wiedereinstieg')
  await expect(page.getByRole('dialog').getByText('Tabelle öffnen', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Dort weitermachen', exact: true }).click()
  await expect(page).toHaveURL(/\/aufgabe\/work\/teil-bericht\?teil=teil-a$/)
  expect((await local(page))?.focus?.timer.status).toBe('paused')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.timer.status).toBe('running')
  expect((await local(page))?.focus?.id).toBe(initial.id)
})

test('Arbeits-Capture behält den Teilkontext lokal; private Teilschritte nutzen denselben bewussten Timer', async ({ page }) => {
  await onboard(page)
  await seedWork(page)
  await page.goto(`${ROUTE}?teil=teil-a`)
  const workFocus = await start(page, 'teil-a', '6')
  await page.getByRole('button', { name: 'Gedanken festhalten', exact: true }).click()
  await page.getByRole('textbox', { name: 'Gedanke', exact: true }).fill('Milch holen')
  await page.getByRole('textbox', { name: 'Gedanke', exact: true }).press('Tab')
  await expect.poll(async () => (await local(page))?.captureDraft?.context?.partId).toBe('teil-a')
  expect((await local(page))?.captureDraft?.context?.route).toBe(`${ROUTE}?teil=teil-a`)
  await page.getByRole('button', { name: 'Merken', exact: true }).click()
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  const notes = await page.evaluate(() => new Promise<InboxItem[]>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('records', 'readonly')
      const read = transaction.objectStore('records').getAll()
      let notes: InboxItem[] = []
      read.onsuccess = () => { notes = read.result.filter((record) => record.collection === 'inbox' && !record.deleted).map((record) => record.data as InboxItem) }
      transaction.oncomplete = () => { db.close(); resolve(notes) }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }))
  expect(notes).toHaveLength(1)
  expect(notes[0]?.text).toBe('Milch holen')
  expect(JSON.stringify(notes)).not.toContain('Bericht')
  expect(JSON.stringify(notes)).not.toContain('Tabelle öffnen')
  expect((await local(page))?.focus).toEqual(workFocus)
  const task: InboxItem = { id: 'privat', text: 'Schreibtisch ordnen', status: 'task', taskDate: '2026-11-06', createdAt: START, subtasks: [{ id: 'constructor', title: 'Papier stapeln' }] }
  await seedRecords(page, [{ collection: 'inbox', id: task.id, data: task }])
  await page.goto('/aufgabe/task/privat?teil=constructor')
  await expect(page.getByRole('heading', { name: 'Papier stapeln', exact: true })).toBeVisible()
  expect((await local(page))?.focus).toEqual(workFocus)
  await duration(page, '4.25')
  await page.getByRole('button', { name: /^Fokus starten/ }).click()
  await expect.poll(async () => (await local(page))?.focus?.target).toEqual({ kind: 'task', id: task.id, partId: 'constructor' })
  expect((await storedRecord<InboxItem>(page, 'inbox', task.id))?.subtasks?.[0]?.timerMin).toBe(4.25)
  expect((await local(page))?.workSessions).toEqual([])
})

test('Starthilfe verwechselt beim Wechsel zwischen Teilschritten keine gespeicherte Pause', async ({ page }) => {
  await onboard(page)
  await seedWork(page)
  await page.goto(`${ROUTE}?teil=teil-a`)
  await start(page, 'teil-a', '6')
  await page.goto('/')
  await page.getByRole('button', { name: 'Ich hänge fest', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Starten', exact: true }).click()
  await expect.poll(async () => (await local(page))?.stuck?.timer?.status).toBe('running')
  await at(page, START + 30_000)
  await dialog.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await local(page))?.stuck?.timer?.status).toBe('paused')
  const saved = (await local(page))!.stuck!
  await page.keyboard.press('Escape')
  await sheetsClosed(page)
  await page.goto(`${ROUTE}?teil=teil-b`)
  await start(page, 'teil-b', '2')
  await page.goto('/')
  await page.getByRole('button', { name: 'Ich hänge fest', exact: true }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Starten', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Weiter', exact: true })).toHaveCount(0)
  expect((await local(page))?.stuck).toEqual(saved)
  await page.keyboard.press('Escape')
  await sheetsClosed(page)
  await page.goto(`${ROUTE}?teil=teil-a`)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect.poll(async () => (await local(page))?.focus?.target).toEqual({ kind: 'work', id: 'teil-bericht', partId: 'teil-a' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ich hänge fest', exact: true }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Weiter', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Starten', exact: true })).toHaveCount(0)
  expect((await local(page))?.stuck).toEqual(saved)
})

test('Tastaturstart nach eigenen Minuten wartet auf den gehaltenen Browser-Zurücklauf', async ({ page }) => {
  await onboard(page)
  await seedWork(page)
  await page.goto(`${ROUTE}?teil=teil-a`)
  await page.getByRole('radiogroup', { name: 'Teilschritt-Timer Minuten' }).getByRole('radio', { name: /Eigene/ }).click()
  const picker = page.getByRole('dialog').last()
  await picker.getByRole('spinbutton', { name: 'Teilschritt-Timer Minuten in Minuten', exact: true }).fill('11.25')
  await expect.poll(() => page.evaluate(() => history.state?.ankerSheet)).toBeTruthy()
  // Only hold the real browser traversal, never the timer or persistence action.
  await page.evaluate(() => {
    const back = history.back.bind(history)
    history.back = () => {
      Object.assign(window, { __releaseTimerSheetBack: () => { history.back = back; back() } })
    }
  })
  await picker.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect(page.locator('#root')).toHaveAttribute('inert', '')
  // The helper must remain pending until the real popstate unblocks the page.
  let settled = false
  const starting = startFocusByKeyboard(page).then(() => { settled = true })
  try {
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('#root')).toHaveAttribute('inert', '')
    expect((await local(page))?.focus).toBeUndefined()
    expect(settled).toBe(false)
  } finally {
    await page.evaluate(() => {
      ;(window as unknown as { __releaseTimerSheetBack: () => void }).__releaseTimerSheetBack()
    })
  }
  await starting
  await expect.poll(async () => (await local(page))?.focus?.timer.durationMs).toBe(675_000)
})

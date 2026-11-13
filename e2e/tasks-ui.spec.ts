/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { LocalData, Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'
import { chooseValue, fillDate } from './helpers/controls'

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-06T10:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function addWork(page: Page, title = 'Bericht') {
  await page.goto('/arbeit')
  await page.getByRole('textbox', { name: 'Neue Aufgabe', exact: true }).fill(title)
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  const heading = page.getByRole('heading', { name: title, exact: true })
  await expect(heading).toBeVisible()
  return heading.locator('..')
}

async function seed(page: Page, records: { collection: string; id: string; data: unknown }[]) {
  await page.evaluate((records) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('records', 'readwrite')
      for (const record of records) transaction.objectStore('records').put({ ...record, updated_at: Date.now(), dirty: 1, deleted: false })
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }), records)
}

test('Arbeitsdetails und lokale Zerlegung erhalten echte Teilabschlüsse über neue Detailtiefe und Neustart', async ({ page }) => {
  await onboard(page)
  let card = await addWork(page)
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  await card.getByRole('textbox', { name: 'Nächster Schritt', exact: true }).fill('Tabelle öffnen')
  await card.getByText('Weitere Angaben', { exact: true }).click()
  await card.getByRole('spinbutton', { name: 'Schätzung Minuten', exact: true }).fill('35')
  await fillDate(page, 'Frist', '2026-11-06T15:30', card)
  await chooseValue(page, 'Priorität', 'high', card)
  await card.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect(card.getByText('Details gespeichert.', { exact: true })).toBeVisible()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.work[0]?.deadline).toBe(new Date('2026-11-06T15:30:00+01:00').getTime())
  await card.getByRole('button', { name: 'In kleine Schritte zerlegen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.work[0]?.subtasks?.length ?? 0).toBe(0)
  await card.getByRole('button', { name: 'Vorschlag übernehmen', exact: true }).click()
  await expect(card.getByText('Schritte gespeichert.', { exact: true })).toBeVisible()
  const firstPart = card.getByRole('checkbox', { name: /^Teilschritt .* erledigt$/ }).first()
  await firstPart.click()
  await expect(firstPart).toBeChecked()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.work[0]?.subtasks?.filter((part) => part.doneAt !== undefined).length).toBe(1)
  const confirmed = (await storedRecord<LocalData>(page, 'meta', 'local'))!.work[0]!.subtasks!.find((part) => part.doneAt !== undefined)!
  await card.getByRole('radio', { name: 'Sehr klein', exact: true }).click()
  await card.getByRole('button', { name: 'In kleine Schritte zerlegen', exact: true }).click()
  await card.getByRole('button', { name: 'Vorschlag übernehmen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.work[0]?.subtasks?.length).toBe(8)
  await page.reload()
  card = page.getByRole('heading', { name: 'Bericht', exact: true }).locator('..')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(card.getByRole('textbox', { name: 'Nächster Schritt', exact: true })).toHaveValue('Tabelle öffnen')
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.work[0]?.subtasks?.find((part) => part.id === confirmed.id)).toEqual(confirmed)
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.work[0]?.done).not.toBe(true)
})

test('Wiederholungsabschluss zeigt die nächste Instanz erst im späteren Bereich und bleibt rücknehmbar', async ({ page }) => {
  await onboard(page)
  const card = await addWork(page, 'Ablage ordnen')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  await card.getByText('Weitere Angaben', { exact: true }).click()
  await card.getByRole('checkbox', { name: 'Aufgabe wiederholen', exact: true }).check()
  await card.getByRole('spinbutton', { name: 'Wiederholungsabstand', exact: true }).fill('1')
  await card.getByRole('spinbutton', { name: 'Wiederholungsabstand', exact: true }).press('Tab')
  await card.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect(card.getByText('Details gespeichert.', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Erledigt', exact: true }).dblclick()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.work.length).toBe(2)
  const work = (await storedRecord<LocalData>(page, 'meta', 'local'))!.work
  expect(work.filter((task) => task.done)).toHaveLength(1)
  expect(work.find((task) => !task.done)?.recurrence?.occurrenceDate).toBe('2026-11-07')
  await expect(page.getByRole('button', { name: 'Erledigt', exact: true })).toHaveCount(0)
  await expect(page.getByText('Für später (1)', { exact: true })).toBeVisible()
  await page.getByText('Erledigt (1)', { exact: true }).click()
  await page.getByRole('button', { name: 'Ablage ordnen zurücknehmen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.work.filter((task) => task.done).length).toBe(0)
})

test('Gedanke wird mit bestehender Arbeit verknüpft; Entfernen der Aufgabe erhält die Notiz', async ({ page }) => {
  await onboard(page)
  await addWork(page)
  const workId = (await storedRecord<LocalData>(page, 'meta', 'local'))!.work[0]!.id
  await page.goto('/inbox')
  await page.getByRole('button', { name: 'Gedanke mit Optionen festhalten', exact: true }).click()
  await page.getByPlaceholder('Was ist dir gerade eingefallen?').fill('Eine Notiz zum Bericht')
  await page.getByRole('dialog').getByRole('button', { name: 'Merken', exact: true }).click()
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  const note = page.getByText('Eine Notiz zum Bericht', { exact: true }).locator('..')
  await note.getByText('Tag wählen oder verknüpfen', { exact: true }).click()
  await chooseValue(page, 'Mit vorhandener Aufgabe verbinden', `work:${workId}`, note)
  await note.getByRole('button', { name: 'Gedanke verknüpfen', exact: true }).click()
  await page.getByText('Gesammelte Gedanken (1)', { exact: true }).click()
  await expect(page.getByRole('link', { name: 'Bericht', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Eingeplant', exact: true })).toHaveCount(0)
  await page.goto('/arbeit')
  const card = page.getByRole('heading', { name: 'Bericht', exact: true }).locator('..')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  await card.getByRole('button', { name: 'Entfernen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.work.length).toBe(0)
  await page.goto('/inbox')
  await page.getByText('Gesammelte Gedanken (1)', { exact: true }).click()
  await expect(page.getByText('Eine Notiz zum Bericht', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Bericht', exact: true })).toHaveCount(0)
})

test('Lokale Zeitvorschläge bleiben freiwillig und werden nur ausdrücklich übernommen oder zurückgesetzt', async ({ page }) => {
  await onboard(page)
  await addWork(page)
  await page.getByText('Eigene Zeitschätzungen', { exact: true }).click()
  const toggle = page.getByRole('switch', { name: 'Lokal aus bestätigten Zeiten lernen', exact: true })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.taskLearning?.enabled).toBe(true)
  const local = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  // Keep real source identities: a title-only imported sample is not sufficient evidence.
  local.work.push(...[0, 1, 2, 3].map(index => ({ id: `earlier-${index}`, title: `Früherer Auftrag ${index}`, createdAt: 1, done: true })))
  const sampleAt = Date.parse('2026-11-06T09:00:00Z')
  local.taskLearning = { enabled: true, samples: [10, 12, 14, 400].map((minutes, index) => ({ id: `work:earlier-${index}:${sampleAt}`, key: 'work:bericht', label: 'Bericht', minutes, at: sampleAt, confirmed: true })) }
  await seed(page, [{ collection: 'meta', id: 'local', data: local }])
  await page.reload()
  const card = page.getByRole('heading', { name: 'Bericht', exact: true }).locator('..')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(card.getByText('Aus 4 bestätigten lokalen Zeiten: Vorschlag etwa 12 Minuten.', { exact: true })).toBeVisible()
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.work[0]?.estimateMin).toBeUndefined()
  await card.getByRole('button', { name: 'Schätzung übernehmen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.work[0]?.estimateMin).toBe(12)
  await page.getByText('Eigene Zeitschätzungen', { exact: true }).click()
  await expect(page.getByText('4 bestätigte Zeiten gespeichert.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Gelernte Zeiten zurücksetzen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.taskLearning?.samples.length).toBe(0)
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.work[0]?.estimateMin).toBe(12)
})

test('Tagesaufgaben beginnen mit höchstens drei sichtbaren Prioritäten und lassen sich bewusst erweitern', async ({ page }) => {
  await onboard(page)
  await seed(page, Array.from({ length: 4 }, (_, index) => ({ collection: 'inbox', id: `private-${index}`, data: { id: `private-${index}`, text: `Private Aufgabe ${index + 1}`, status: 'task', taskDate: '2026-11-06', createdAt: index + 1 } })))
  await page.goto('/tag')
  await expect(page.getByRole('heading', { name: /^Private Aufgabe/ })).toHaveCount(3)
  await page.getByRole('button', { name: '1 weitere Aufgaben', exact: true }).click()
  await expect(page.getByRole('heading', { name: /^Private Aufgabe/ })).toHaveCount(4)
  await page.getByRole('button', { name: 'Weniger Aufgaben zeigen', exact: true }).click()
  await expect(page.getByRole('heading', { name: /^Private Aufgabe/ })).toHaveCount(3)
})

test('Aufgabendetails und Teilschritte bleiben bei 320px und 160Prozent Schrift ohne horizontalen Überlauf', async ({ page }) => {
  await onboard(page)
  await addWork(page)
  await page.goto('/einstellungen/darstellung')
  const size = page.getByRole('spinbutton', { name: 'Schriftgröße', exact: true })
  await size.fill('160'); await size.press('Tab')
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.appearance.fontScale).toBe(1.6)
  await page.goto('/arbeit')
  await page.setViewportSize({ width: 320, height: 844 })
  await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeGreaterThan(24)
  const card = page.getByRole('heading', { name: 'Bericht', exact: true }).locator('..')
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  await card.getByRole('button', { name: 'In kleine Schritte zerlegen', exact: true }).click()
  await card.getByRole('button', { name: 'Vorschlag übernehmen', exact: true }).click()
  await expect(card.getByText('Schritte gespeichert.', { exact: true })).toBeVisible()
  await page.getByText('Eigene Zeitschätzungen', { exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { GameState, LocalData, Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'

const date = '2026-11-06'
const start = Date.parse(`${date}T09:00:00+01:00`)
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date(start))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
}
async function openHomeoffice(page: Page) {
  await page.getByRole('button', { name: 'Heute anpassen: Tagesart und Modus', exact: true }).click()
  await page.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await page.getByRole('button', { name: 'Homeoffice und Abendplan', exact: true }).click()
  await page.getByRole('radiogroup', { name: 'Homeoffice', exact: true }).getByRole('radio', { name: 'Ja', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Homeoffice-Kontakt', exact: true })).toBeVisible()
}
async function closeDay(page: Page) { await page.getByRole('dialog').getByRole('button', { name: 'Fertig', exact: true }).click() }
async function expectHomeofficeReady(page: Page) {
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Heute anpassen: Tagesart und Modus', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Arbeit (Homeoffice)', exact: true })).toBeVisible()
}

test('Homeoffice-Kontakt ist eine eigene Tageswahl; fehlgeschlagenes Kopieren oder abgebrochenes Teilen bestätigt nichts', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied') } } })
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('cancelled', 'AbortError') } })
  })
  await onboard(page); await openHomeoffice(page)
  expect((await local(page))?.homeOfficeContact).toBeUndefined()
  const game = await storedRecord<GameState>(page, 'game', 'main')
  await page.getByRole('button', { name: 'Homeoffice-Text kopieren', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Kopieren ist gerade nicht möglich. Du kannst den Text oben selbst auswählen.')
  await expect(page.getByText('Text kopiert. Gesendet und erledigt ist damit noch nichts.', { exact: true })).toHaveCount(0)
  expect((await local(page))?.homeOfficeContact).toBeUndefined()
  await page.getByRole('button', { name: 'Homeoffice-Text teilen', exact: true }).click()
  await expect(page.getByText('Teilen abgebrochen oder gerade nicht verfügbar. Dein Kontaktstatus bleibt unverändert.', { exact: true })).toBeVisible()
  expect((await local(page))?.homeOfficeContact).toBeUndefined()
  await page.getByRole('button', { name: 'Schon erledigt', exact: true }).click()
  await expect.poll(async () => (await local(page))?.homeOfficeContact?.[date]?.status).toBe('done')
  await page.getByRole('button', { name: 'Nein, nicht nötig', exact: true }).click()
  await expect.poll(async () => (await local(page))?.homeOfficeContact?.[date]?.status).toBe('not-needed')
  expect(await storedRecord<GameState>(page, 'game', 'main')).toEqual(game)
  await closeDay(page); await page.reload()
  await expect(page.getByRole('region', { name: 'Einmalige Homeoffice-Rückfrage', exact: true })).toHaveCount(0)
})

test('Bewusstes Später fragt frühestens nach30Minuten einmal ruhig nach und wiederholt die Rückfrage nach Reload nicht', async ({ page }) => {
  await onboard(page); await openHomeoffice(page)
  await page.getByRole('button', { name: 'Später', exact: true }).click()
  await expect.poll(async () => (await local(page))?.homeOfficeContact?.[date]?.remindAt).toBe(start + 30 * 60_000)
  await closeDay(page)
  await page.clock.setFixedTime(new Date(start + 29 * 60_000)); await page.reload()
  // Eine leere Ladeansicht erfüllt ebenfalls „keine Rückfrage“. Erst den echten Jetzt-Stand prüfen.
  await expectHomeofficeReady(page)
  await expect.poll(async () => (await local(page))?.homeOfficeContact?.[date]).toEqual({ status: 'later', at: start, remindAt: start + 30 * 60_000 })
  await expect(page.getByRole('region', { name: 'Einmalige Homeoffice-Rückfrage', exact: true })).toHaveCount(0)
  // Now vor dem Uhrwechsel wirklich verlassen: kein alter Mount darf die Einmalrückfrage verbrauchen.
  await page.getByRole('link', { name: 'Heute', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/tag$/)
  await page.clock.setFixedTime(new Date(start + 30 * 60_000))
  await page.getByRole('link', { name: 'Jetzt', exact: true }).click()
  await expectHomeofficeReady(page)
  const reminder = page.getByRole('region', { name: 'Einmalige Homeoffice-Rückfrage', exact: true })
  await expect(reminder).toBeVisible()
  await expect.poll(async () => (await local(page))?.homeOfficeContact?.[date]).toEqual({ status: 'later', at: start })
  await reminder.getByRole('button', { name: 'Für heute schließen', exact: true }).click()
  await page.reload()
  await expectHomeofficeReady(page)
  await expect(page.getByRole('region', { name: 'Einmalige Homeoffice-Rückfrage', exact: true })).toHaveCount(0)
  expect((await local(page))?.homeOfficeContact?.[date]).toEqual({ status: 'later', at: start })
})

test('Eine vorgemerkte Homeoffice-Rückfrage bleibt während Ruhezeit aus und wird erst danach einmal angeboten', async ({ page }) => {
  await onboard(page); await openHomeoffice(page)
  await page.getByRole('button', { name: 'Später', exact: true }).click()
  await expect.poll(async () => (await local(page))?.homeOfficeContact?.[date]?.status).toBe('later')
  await closeDay(page)
  await page.goto('/einstellungen/erinnerungen')
  await page.getByRole('textbox', { name: 'Ruhezeit von', exact: true }).fill('08:00')
  await page.getByRole('textbox', { name: 'Ruhezeit bis', exact: true }).fill('12:00')
  await page.getByRole('textbox', { name: 'Ruhezeit bis', exact: true }).blur()
  await page.clock.setFixedTime(new Date(start + 31 * 60_000)); await page.goto('/')
  await expect(page.getByRole('region', { name: 'Einmalige Homeoffice-Rückfrage', exact: true })).toHaveCount(0)
  expect((await local(page))?.homeOfficeContact?.[date]?.remindAt).toBe(start + 30 * 60_000)
  await page.clock.setFixedTime(new Date(`${date}T20:45:00+01:00`)); await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Einmalige Homeoffice-Rückfrage', exact: true })).toHaveCount(0)
  expect((await local(page))?.homeOfficeContact?.[date]?.remindAt).toBe(start + 30 * 60_000)
  await page.clock.setFixedTime(new Date(start + 31 * 60_000))
  await page.goto('/einstellungen/erinnerungen')
  await page.getByRole('textbox', { name: 'Ruhezeit von', exact: true }).fill('23:30')
  await page.getByRole('textbox', { name: 'Ruhezeit bis', exact: true }).fill('05:00')
  await page.getByRole('textbox', { name: 'Ruhezeit bis', exact: true }).blur()
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Einmalige Homeoffice-Rückfrage', exact: true })).toBeVisible()
  await page.getByRole('region', { name: 'Einmalige Homeoffice-Rückfrage', exact: true }).getByRole('button', { name: 'Nein, nicht nötig', exact: true }).click()
  await expect.poll(async () => (await local(page))?.homeOfficeContact?.[date]?.status).toBe('not-needed')
})

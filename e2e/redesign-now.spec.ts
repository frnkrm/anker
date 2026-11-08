/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultSettings, emptyLocal } from '../src/core/defaults'
import { initialGame } from '../src/core/game'
import type { DayLog, LocalData, Settings } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const DATE = '2026-11-09'
const clock = (time: string, date = DATE) => new Date(`${date}T${time}:00+01:00`)
const START = clock('10:00').getTime()

async function seed(page: Page, time = '10:00', date = DATE) {
  await page.clock.setFixedTime(clock(time, date))
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: 'Hallo! ⚓', exact: true })).toBeVisible()
  const settings = { ...defaultSettings(date), onboarded: true }
  settings.anchor = { ...settings.anchor, wake: 420, manual: { wake: true, bed: true, pcStop: true } }
  settings.bed = 22 * 60 + 30; settings.pcStop = 22 * 60
  settings.alarm.qrSecret = 'ANKER-REDESIGN-DEMO'
  const local = { ...emptyLocal(), work: [{ id: 'bericht', title: 'Wochenbericht vorbereiten', nextStep: 'Dokument öffnen', estimateMin: 25, createdAt: START, deadline: clock('12:00').getTime() }],
    commitments: date === DATE ? [{ id: 'buecher', date, label: 'Bücher zurückbringen', context: 'personal' as const, commitment: 'hard' as const, start: 1080, end: 1110, originPlaceId: 'home', travelMin: 15, travelHomeMin: 15, status: 'planned' as const }] : [] }
  await seedRecords(page, [
    { collection: 'settings', id: 'main', data: settings },
    { collection: 'meta', id: 'local', data: local },
    { collection: 'game', id: 'main', data: initialGame(date) },
    { collection: 'days', id: date, data: { date, override: {}, steps: {}, wakeAt: clock('07:00', date).getTime() } },
  ])
  await page.goto('/')
  await expect(page.locator('[data-testid="now-page"] h1')).toBeVisible()
}

test('Jetzt hat eine Hauptaktion und höchstens sieben inhaltliche Tippziele um10Uhr', async ({ page }) => {
  await seed(page)
  const main = page.getByTestId('now-page')
  await expect(main.getByRole('heading', { name: 'Dokument öffnen', exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Starten · 25 min', exact: true })).toHaveCount(1)
  expect(await main.locator('button:visible, a:visible, input:visible, summary:visible').count()).toBeLessThanOrEqual(7)
  expect(await main.locator('.now-buttons .bg-accent').count()).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1)
  await expect(main.getByLabel('Zeit bis zum nächsten festen Punkt', { exact: true })).toHaveCount(0)
  await expect(main.getByRole('list', { name: 'Tageslinie' })).toHaveCount(0)
})

test('Sieben Tageszustände zeigen abends keine berufliche Hauptaufgabe; Handyansichten bleiben frei', async ({ page }, info) => {
  await seed(page)
  for (const time of ['07:05', '10:00', '16:30', '19:00', '21:45', '22:05', '22:45']) {
    await page.clock.setFixedTime(clock(time)); await page.goto('/')
    const main = page.getByTestId('now-page')
    await expect(main.locator('h1')).toBeVisible()
    if (['19:00', '21:45', '22:05'].includes(time)) await expect(main.getByRole('heading', { name: 'Dokument öffnen', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    const footer = await main.getByRole('button', { name: 'Heute anpassen', exact: true }).boundingBox()
    const nav = await page.getByRole('navigation', { name: 'Hauptnavigation' }).boundingBox()
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(nav!.y + 1)
    await page.screenshot({ path: info.outputPath(`jetzt-${time.replace(':', '')}.png`), fullPage: true })
  }
})

test('Konflikt ist früh nur ein Hinweis, im Vorfenster quittierbar und danach weg', async ({ page }) => {
  await seed(page)
  await expect(page.getByRole('link', { name: '1 Hinweis für heute ›', exact: true })).toBeVisible()
  await expect(page.getByLabel('Überschneidung prüfen', { exact: true })).toHaveCount(0)
  await page.clock.setFixedTime(clock('16:30')); await page.goto('/')
  const conflict = page.getByLabel('Überschneidung prüfen', { exact: true })
  await expect(conflict).toContainText('17:20')
  const beforeGame = await storedRecord(page, 'game', 'main')
  await conflict.getByRole('button', { name: 'Passt so', exact: true }).click()
  await expect(conflict).toHaveCount(0)
  await expect.poll(async () => Object.values((await storedRecord<LocalData>(page, 'meta', 'local'))?.acknowledgedPlanConflicts ?? {}).flat().length).toBe(1)
  await page.reload(); await expect(conflict).toHaveCount(0)
  expect(await storedRecord(page, 'game', 'main')).toEqual(beforeGame)
  await page.clock.setFixedTime(clock('19:00')); await page.goto('/')
  await expect(page.getByRole('link', { name: /Hinweis.*für heute/ })).toHaveCount(0)
  await page.goto('/tag'); await expect(page.getByText('überschneidet sich mit Heimweg', { exact: true })).toBeVisible()
})

test('Heute anpassen erhält Planänderung und Hilfen ohne automatische Erledigung', async ({ page }) => {
  await seed(page)
  const before = await storedRecord<DayLog>(page, 'days', DATE)
  await page.getByRole('button', { name: 'Heute anpassen', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Heute anpassen', exact: true })
  await expect(sheet.getByRole('combobox', { name: 'Unterstützung', exact: true })).toBeVisible()
  await sheet.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await sheet.getByRole('button', { name: 'Termin planen', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Was hast du vor?', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.steps).toEqual(before?.steps)
  await page.getByRole('button', { name: 'Heute anpassen', exact: true }).click()
  await page.getByRole('dialog').getByText('Weitere Möglichkeiten', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Heute länger arbeiten', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abend & morgen', exact: true })).toBeVisible()
})

test('Bettansicht am freien Abend bleibt bei einer Handlung; Browser startet keinen Schlafhinweis', async ({ page }, info) => {
  const sunday = '2026-11-15'
  await seed(page, '23:30', sunday)
  const main = page.getByTestId('now-page')
  await expect(main.getByRole('heading', { name: 'Ab ins Bett', exact: true })).toBeVisible()
  expect(await main.locator('button:visible, a:visible').count()).toBe(2)
  await main.getByRole('button', { name: 'Ich liege im Bett', exact: true }).click()
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', sunday))?.bedAt).toBe(clock('23:30', sunday).getTime())
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: { ...settings, sleep: { ...settings.sleep, bedtimePromptEnabled: true } } }])
  await page.reload(); await expect(main.getByText('Im Browser wird kein Schlafhinweis gestartet.', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('freier-tag-2330.png'), fullPage: true })
})

test('Große Schrift bleibt vollständig bedienbar und Tag fasst nur echte Abschlüsse zusammen', async ({ page }) => {
  await seed(page)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: { ...settings, appearance: { ...settings.appearance, fontScale: 1.3 } } }])
  await page.setViewportSize({ width: 320, height: 844 }); await page.reload()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await expect(page.getByRole('button', { name: 'Heute anpassen', exact: true })).toBeVisible()
  await page.goto('/tag')
  await expect(page.getByText('Erledigt (1)', { exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Erledigte Tagesabschnitte', exact: true })).toBeHidden()
  await page.getByText('Erledigt (1)', { exact: true }).click()
  await expect(page.getByRole('list', { name: 'Erledigte Tagesabschnitte', exact: true })).toContainText('Aufstehen')
  await page.getByRole('radio', { name: 'Di', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Morgen', exact: true })).toBeVisible()
})

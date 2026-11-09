/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { guidancePreferences } from '../src/core/guidance'
import type { DayLog, GameState, LocalData, Settings } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const DATE = '2026-11-09'
const at = (date: string, time: string) => new Date(`${date}T${time}:00+01:00`)
async function onboard(page: Page, time = '06:15') {
  await page.clock.setFixedTime(at(DATE, time))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
  return (await storedRecord<Settings>(page, 'settings', 'main'))!
}

async function closeSheets(page: Page) {
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => history.state?.ankerSheet ?? null)).toBeNull()
}

test('Begleitung ist ausgeschaltet und bewusste Auswahl sowie Kernschritte bleiben gespeichert', async ({ page }) => {
  const before = await onboard(page)
  await page.goto('/einstellungen/begleitung')
  const enabled = page.getByRole('switch', { name: 'Begleitung einschalten', exact: true })
  await expect(enabled).toHaveAttribute('aria-checked', 'false')
  await enabled.click()
  await page.getByRole('switch', { name: 'Routinenschritte lokal vorlesen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.guidance?.speakSteps).toBe(true)
  await page.goto('/einstellungen/routinen#morning')
  await page.locator('.routine-detail > summary').first().click()
  const essential = page.getByRole('checkbox', { name: 'Kernschritt im Zombie-Modus', exact: true }).first()
  await essential.check()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.routines.morning[0]?.isEssentialForZombieMode).toBe(true)
  const after = (await storedRecord<Settings>(page, 'settings', 'main'))!
  expect(after.routines.morning.map(step => step.id)).toEqual(before.routines.morning.map(step => step.id))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Morgenroutine', exact: true })).toBeVisible()
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.guidance?.enabled).toBe(true)
})

test('Zombie-Auswahl reduziert vorhandene Schritte, ohne ausgelassene Schritte zu erledigen', async ({ page }) => {
  const settings = await onboard(page)
  settings.guidance = { ...guidancePreferences(), enabled: true }
  settings.routines.morning = [
    { id: 'water', title: 'Ein Glas Wasser', minutes: 1, isEssentialForZombieMode: true, minimal: { title: 'Ein Schluck Wasser', minutes: 1 } },
    { id: 'stretch', title: 'Bewegen', minutes: 5, isEssentialForZombieMode: false },
  ]
  settings.sport.days = []
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.goto('/fokus/morning')
  await expect(page.getByRole('heading', { name: 'Ein Glas Wasser', exact: true })).toBeVisible()
  await page.getByText('Weitere Möglichkeiten', { exact: true }).click()
  await page.getByRole('button', { name: 'Zombie-Modus – nur meine Kernschritte', exact: true }).click()
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', DATE))?.override.zombie).toBe(true)
  await expect(page.getByText('Zombie-Modus · deine Kernschritte', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Morgenroutine fertig', exact: true })).toBeVisible()
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.steps['morning:stretch']).toBeUndefined()
})

test('Abendgedanke bleibt lokal und erscheint erst nach einer echten Morgenroutine', async ({ page }) => {
  const settings = await onboard(page, '22:50')
  settings.guidance = { ...guidancePreferences(), enabled: true, eveningEscalation: true }
  settings.anchor = { ...settings.anchor, wake: 370, manual: { wake: true, bed: true, pcStop: true } }
  settings.bed = 23 * 60; settings.pcStop = 22 * 60 + 30
  settings.routines.morning = [{ id: 'water', title: 'Ein Glas Wasser', minutes: 1, isEssentialForZombieMode: true }]
  settings.sport.days = []
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  const game = await storedRecord<GameState>(page, 'game', 'main')
  await page.goto('/')
  const sheet = page.getByRole('dialog', { name: 'Für morgen parken', exact: true })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('textbox', { name: 'Gedanken für morgen', exact: true }).fill('Meine Idee fürs Wochenende')
  await sheet.getByRole('textbox', { name: 'Nächster Schritt für morgen', exact: true }).fill('Eine kurze Notiz ergänzen')
  await sheet.getByRole('button', { name: 'Für morgen parken', exact: true }).click()
  await closeSheets(page)
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.guidance?.days[DATE]?.brainDumpIds?.length).toBe(1)
  expect(await storedRecord<GameState>(page, 'game', 'main')).toEqual(game)
  await expect(page.getByRole('region', { name: 'Gestern für heute gemerkt', exact: true })).toHaveCount(0)
  await page.clock.setFixedTime(at('2026-11-10', '06:15'))
  await page.goto('/fokus/morning')
  await expect(page.getByRole('heading', { name: 'Ein Glas Wasser', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Erledigt', exact: true }).click()
  const recap = page.getByRole('region', { name: 'Gestern für heute gemerkt', exact: true })
  await expect(recap).toContainText('Meine Idee fürs Wochenende')
  await expect(recap).toContainText('Eine kurze Notiz ergänzen')
  const local = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  const id = local.guidance!.days[DATE]!.brainDumpIds![0]!
  expect(local.tomorrowSteps.find(note => note.id === id)?.doneAt).toBeUndefined()
})

test('Rhythmus bleibt auch bei großer Schrift lesbar und erfindet keine tatsächlichen Zeiten', async ({ page }) => {
  const settings = await onboard(page)
  settings.appearance.fontScale = 1.6
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/rhythmus')
  await expect(page.getByRole('heading', { name: 'Deine Rhythmus-Woche', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Nächte im Überblick', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
  await page.getByRole('button', { name: 'Als Tabelle anzeigen', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Geplant und tatsächlich', exact: true })).toBeVisible()
  await expect(page.getByRole('table')).toContainText('Tatsächlich ohne Eintrag')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
})

test('Ein Morgenübergang vor vier Uhr behält seinen tatsächlichen Routinentag', async ({ page }) => {
  const settings = await onboard(page)
  settings.guidance = { ...guidancePreferences(), enabled: true, zeroGapMorning: true }
  settings.anchor = { ...settings.anchor, wake: 210, manual: { wake: true, bed: true, pcStop: true } }
  settings.routines.morning = [{ id: 'water', title: 'Ein Glas Wasser', minutes: 1 }]
  settings.sport.days = []
  const local = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  const date = '2026-11-10'
  const alarmAt = at(date, '03:30').getTime()
  local.guidance = { days: { [date]: { alarmOccurrenceId: 'native-morning-fixture', alarmAt, morningActivatedAt: alarmAt } }, receipts: ['native-morning-fixture'] }
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }, { collection: 'meta', id: 'local', data: local }])
  await page.clock.setFixedTime(at(date, '03:31'))
  await page.goto('/fokus/morning')
  await expect(page.getByRole('heading', { name: 'Ein Glas Wasser', exact: true })).toBeVisible()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.focus?.target).toMatchObject({ kind: 'routine', date, routine: 'morning', stepId: 'water' })
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.steps['morning:water']).toBeUndefined()
})

test('Automatischer Zombie-Fallback erfindet keine erste Nutzerinteraktion', async ({ page }) => {
  const settings = await onboard(page)
  settings.guidance = { ...guidancePreferences(), enabled: true, autoZombie: true, autoZombieAfterSeconds: 10 }
  settings.routines.morning = [
    { id: 'water', title: 'Ein Glas Wasser', minutes: 1, isEssentialForZombieMode: true },
    { id: 'stretch', title: 'Bewegen', minutes: 5, isEssentialForZombieMode: false },
  ]
  settings.sport.days = []
  const local = (await storedRecord<LocalData>(page, 'meta', 'local'))!
  const alarmAt = at(DATE, '06:15').getTime()
  local.guidance = { days: { [DATE]: { alarmOccurrenceId: 'automatic-fixture', alarmAt, morningActivatedAt: alarmAt } }, receipts: ['automatic-fixture'] }
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }, { collection: 'meta', id: 'local', data: local }])
  await page.clock.setFixedTime(at(DATE, '06:16'))
  await page.goto('/fokus/morning')
  await expect(page.getByText('Zombie-Modus · deine Kernschritte', { exact: true })).toBeVisible()
  expect((await storedRecord<LocalData>(page, 'meta', 'local'))?.guidance?.days[DATE]?.firstInteractionAt).toBeUndefined()
  expect((await storedRecord<DayLog>(page, 'days', DATE))?.steps['morning:water']).toBeUndefined()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect.poll(async () => (await storedRecord<LocalData>(page, 'meta', 'local'))?.guidance?.days[DATE]?.firstInteractionAt).toBeGreaterThanOrEqual(alarmAt)
})

test('Zeitbogen und Tagesart überlappen sich bei schmalem Bildschirm und großer Schrift nicht', async ({ page }) => {
  const settings = await onboard(page, '22:10')
  settings.guidance = { ...guidancePreferences(), enabled: true, timeArc: true }
  settings.appearance.fontScale = 1.6
  settings.anchor.manual = { wake: true, bed: true, pcStop: true }
  settings.pcStop = 22 * 60 + 30
  settings.bed = 23 * 60
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/')
  const arc = page.locator('.guidance-time-arc')
  const chip = page.getByRole('button', { name: 'Heute anpassen: Tagesart und Modus', exact: true })
  await expect(arc).toBeVisible()
  const a = (await arc.boundingBox())!
  const b = (await chip.boundingBox())!
  expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
})

test('Die freiwillige Nachtansicht bleibt schwarz, lesbar und bei einer Hauptaktion', async ({ page }) => {
  const settings = await onboard(page, '23:10')
  settings.guidance = { ...guidancePreferences(), enabled: true, circadianUi: true, eveningEscalation: true, bedtimeQr: true }
  settings.appearance.fontScale = 1.6
  settings.anchor.manual = { wake: true, bed: true, pcStop: true }
  settings.bed = 23 * 60; settings.pcStop = 22 * 60 + 30
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Den Abend abschließen', exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-guidance-theme', 'night')
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 0, 0)')
  await expect(page.getByTestId('guidance-night-page').locator('button.bg-accent:visible')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
})

test('Gedanken merken nennt nachts dieselbe Handlung wie die sichtbare Jetzt-Seite', async ({ page }) => {
  const settings = await onboard(page, '23:10')
  settings.anchor.manual = { wake: true, bed: true, pcStop: true }
  settings.bed = 23 * 60; settings.pcStop = 22 * 60 + 30
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ab ins Bett', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Heute anpassen', exact: true }).click()
  await page.getByRole('button', { name: 'Gedanke festhalten', exact: true }).click()
  await page.getByRole('textbox', { name: 'Gedanke', exact: true }).fill('Eine Idee für morgen')
  await page.getByRole('button', { name: 'Merken', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Gespeichert', exact: true })).toContainText('Ab ins Bett')
})

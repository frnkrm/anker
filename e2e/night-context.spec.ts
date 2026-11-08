/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { zonedToUtc } from '../src/core/time'
import type { LocalData, Settings } from '../src/core/types'
import { currentWorkActual } from '../src/core/worktime'
import { storedRecord } from './helpers/storage'
import { heldRecordsProbe, holdRecordsWrites, releaseRecordsWrites } from './helpers/held-records'

const date = '2026-11-02'
const nextDate = '2026-11-03'
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
async function finishOnboarding(page: Page) {
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await onboardingFinished(page)
}
async function onboardingFinished(page: Page) {
  // Der Klick bestätigt nur die Eingabe. Erst der abgeschlossene Write erlaubt den Dokumentwechsel.
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
}
async function at(page: Page, day: string, minute: number) {
  await page.clock.setFixedTime(new Date(zonedToUtc(day, minute)))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}

/** Nur synthetische Zeit-/Zustandswerte, keine Aufgaben-, Kunden-, Medikations- oder Authinhalte. */
async function nightObservation(page: Page) {
  const browser = await page.evaluate(() => {
    const known = ['Arbeit läuft', 'Arbeit', 'Arbeit (Homeoffice)', 'Störung', 'Pause läuft', 'Läuft deine Arbeit noch?', 'Schlafen', 'Aufstehen', 'Gute Nacht', 'Ab ins Bett', 'Arbeitszeit', 'Dein Anker', 'Hallo! ⚓', 'Erholen', 'Kurz durchatmen', 'Runterkommen']
    const heading = document.querySelector('h1')?.textContent?.trim()
    return {
      nowMs: Date.now(), constructorMs: new Date().getTime(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone.slice(0, 80),
      ready: document.readyState, visibility: document.visibilityState,
      route: location.pathname === '/' || location.pathname === '/start' ? location.pathname : 'other',
      heading: heading === undefined ? 'missing' : known.includes(heading) ? heading : 'other',
      workBar: !!document.querySelector('[data-testid="workbar"]'),
    }
  })
  const saved = await local(page)
  const sessions = saved?.workSessions ?? []
  const actual = currentWorkActual(sessions, nextDate, browser.nowMs)
  return {
    browser: { ...browser, headingVisible: await page.getByRole('heading', { level: 1 }).first().isVisible() },
    persisted: {
      localPresent: saved !== undefined, sessionCount: sessions.length,
      sessions: sessions.slice(0, 2).map((session) => ({ date: session.date, kind: session.kind, startAt: session.startAt, endAt: session.endAt ?? null,
        breaks: session.breaks.slice(0, 2).map((pause) => ({ startAt: pause.startAt, endAt: pause.endAt ?? null })) })),
    },
    projection: { open: !!actual.open, paused: !!actual.openBreak, unconfirmed: actual.unconfirmed, kind: actual.open?.kind ?? null, netMin: actual.netMin, issueCount: actual.issues.length },
  }
}

async function expectNightContext(page: Page, kind: 'regular' | 'incident', minute: number, pause: 'none' | 'open' | 'closed') {
  let observed: Awaited<ReturnType<typeof nightObservation>> | undefined
  try {
    await expect.poll(async () => { observed = await nightObservation(page); return observed }, { message: 'Nachtkontext nach Navigation: Browseruhr, persistierte Sitzung, reine Projektion und sichtbarer H1 müssen zusammenpassen.' }).toMatchObject({
      browser: { nowMs: zonedToUtc(nextDate, minute), constructorMs: zonedToUtc(nextDate, minute), route: '/', heading: pause === 'open' ? 'Pause läuft' : kind === 'regular' ? 'Arbeit läuft' : 'Störung', headingVisible: true },
      persisted: { localPresent: true, sessionCount: 1, sessions: [{ kind, date, startAt: zonedToUtc(date, 23 * 60 + 40), endAt: null,
        breaks: pause === 'none' ? [] : [{ startAt: zonedToUtc(nextDate, 270), endAt: pause === 'open' ? null : zonedToUtc(nextDate, 280) }] }] },
      projection: { open: true, paused: pause === 'open', unconfirmed: false, kind },
    })
  } catch (error) {
    // Auch übereinstimmende Felder zeigen: Matcher-Diffs blenden sie sonst gerade im CI aus.
    throw new Error(`Begrenzte Nachtkontext-Diagnose: ${JSON.stringify(observed ?? { observation: 'unavailable' })}\n${error instanceof Error ? error.message : 'Nachtprüfung fehlgeschlagen.'}`, { cause: error })
  }
}

for (const kind of ['regular', 'incident'] as const) {
  test(`Echte ${kind}-Nachtschicht bleibt nach 04:00 mit Pause und Ende bedienbar`, async ({ page }) => {
    await at(page, date, 23 * 60 + 40)
    await page.goto('/start')
    await page.getByRole('button', { name: 'Weiter', exact: true }).click()
    await finishOnboarding(page)
    await page.goto('/arbeitszeit')
    if (kind === 'incident') await page.getByText('Einsätze planen und erfassen', { exact: true }).click()
    await page.getByRole('button', { name: kind === 'regular' ? 'Arbeit starten' : 'Kundenproblem jetzt bearbeiten', exact: true }).click()
    await expect.poll(async () => (await local(page))?.workSessions.length).toBe(1)
    const before = await storedRecord<Settings>(page, 'settings', 'main')
    const started = (await local(page))!.workSessions[0]!
    expect(started).toMatchObject({ kind, date, startAt: zonedToUtc(date, 23 * 60 + 40) })
    await at(page, nextDate, 270)
    await page.goto('/')
    // Nicht nur auf einen Titel warten: Ein CI-Fehler zeigt, ob Clock/DB/Core oder erst die UI abweicht.
    await expectNightContext(page, kind, 270, 'none')
    await expect(page.getByText('Läuft deine Arbeit noch?', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: kind === 'regular' ? 'Pause starten' : 'Pause', exact: true }).click()
    await expect.poll(async () => (await local(page))?.workSessions[0]?.breaks.length).toBe(1)
    await expect.poll(async () => (await local(page))?.workSessions[0]?.breaks[0]?.startAt).toBe(zonedToUtc(nextDate, 270))
    await at(page, nextDate, 280)
    await page.reload()
    await expectNightContext(page, kind, 280, 'open')
    await page.getByRole('button', { name: 'Pause beenden', exact: true }).click()
    await expect.poll(async () => (await local(page))?.workSessions[0]?.breaks[0]?.endAt).toBe(zonedToUtc(nextDate, 280))
    await at(page, nextDate, 300)
    await page.reload()
    await expectNightContext(page, kind, 300, 'closed')
    await page.getByRole('button', { name: kind === 'regular' ? 'Feierabend' : 'Einsatz beenden', exact: true }).click()
    await expect.poll(async () => (await local(page))?.workSessions[0]?.endAt).toBe(zonedToUtc(nextDate, 300))
    const finished = (await local(page))!.workSessions[0]!
    expect(finished.id).toBe(started.id)
    expect(finished.date).toBe(date)
    expect(finished.startAt).toBe(started.startAt)
    await expect(page.getByRole('heading', { name: /Arbeit läuft|Pause läuft|Störung|Läuft deine Arbeit noch\?/ })).toHaveCount(0)
    expect(await storedRecord<Settings>(page, 'settings', 'main')).toEqual(before)
  })
}

test('Nacht-Testaufbau verlässt die Ersteinrichtung erst nach ihrem echten Settings-Commit', async ({ page }) => {
  await at(page, date, 23 * 60 + 40)
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await holdRecordsWrites(page)
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect.poll(async () => (await heldRecordsProbe(page)).writes.some((write) => write.collection === 'settings' && write.id === 'main')).toBe(true)
  let continued = false
  const completing = onboardingFinished(page).then(() => { continued = true })
  await Promise.resolve()
  try {
    expect((await heldRecordsProbe(page)).writes.some((write) => write.committed)).toBe(false)
    expect(continued, 'Der Test darf vor dem Ersteinrichtungs-Commit keinen harten Seitenwechsel starten.').toBe(false)
    await expect(page).toHaveURL(/\/start$/)
  } finally {
    await releaseRecordsWrites(page)
    await completing
  }
  await page.goto('/arbeitszeit')
  await expect(page).toHaveURL(/\/arbeitszeit$/)
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Arbeit', exact: true })).toBeVisible()
})

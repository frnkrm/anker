/// <reference lib="dom" />
import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test'
import type { RoutineId, RoutineStep, Settings } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

// CDP sends browser touch input, including its native pan/pointercancel decision.
// DOM-dispatched PointerEvents cannot reproduce the Android scrolling regression.
test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

type Point = { x: number; y: number }
type Contact = Point & { id: number }

const routines: { id: RoutineId; path: string; heading: string }[] = [
  { id: 'morning', path: '/einstellungen/morgenroutine', heading: 'Morgenroutine' },
  { id: 'evening', path: '/einstellungen/abendroutine', heading: 'Abendroutine' },
]

async function setup(page: Page, routine: typeof routines[number]) {
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  // Hard navigation is safe only after the asynchronous onboarding write commits.
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  const steps: RoutineStep[] = [
    { id: `${routine.id}-water`, title: 'Wasser bereitstellen', minutes: 3, minimal: { title: 'Ein Schluck', minutes: 1 } },
    { id: `${routine.id}-move`, title: 'Bewegung mit eigener Dauer', minutes: 12, tag: 'movement', minimal: { title: 'Kurz strecken', minutes: 2 } },
    { id: `${routine.id}-face`, title: 'Gesichtspflege', minutes: 5, tag: 'face', minimal: { title: 'Creme', minutes: 1 } },
    { id: `${routine.id}-teeth`, title: 'Zähne putzen', minutes: 4, tag: 'teeth', minimal: { title: 'Kurz putzen', minutes: 2 } },
    { id: `${routine.id}-prep`, title: 'Tasche vorbereiten', minutes: 7, tag: 'prep', minimal: { title: 'Schlüssel hinlegen', minutes: 1 } },
    { id: `${routine.id}-last`, title: 'Eigener Schritt ohne Minimal-Version', minutes: 9 },
  ]
  steps.push(...Array.from({ length: 6 }, (_, index) => ({ id: `${routine.id}-extra-${index}`, title: `Weiterer eigener Schritt ${index + 1}`, minutes: index + 1 })))
  const seeded = { ...settings, routines: { ...settings.routines, [routine.id]: steps } }
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: seeded }])
  await page.goto(routine.path)
  await expect(page.getByRole('heading', { name: routine.heading, exact: true })).toBeVisible()
  await expect(page.locator('input[aria-label="Schritt"]')).toHaveCount(steps.length)
  return { steps, seeded }
}

function handle(page: Page, index: number) {
  return page.getByRole('button', { name: `Eintrag ${index + 1} zum Verschieben ziehen`, exact: true })
}

async function center(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
}

async function input(session: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', points: Contact[]) {
  await session.send('Input.dispatchTouchEvent', { type, touchPoints: points })
}

async function moveFinger(page: Page, session: CDPSession, from: Point, to: Point, id = 1) {
  for (let frame = 1; frame <= 16; frame++) {
    await input(session, 'touchMove', [{ id, x: from.x + (to.x - from.x) * frame / 16, y: from.y + (to.y - from.y) * frame / 16 }])
    // Gesture duration, not an application readiness delay: let Chromium pan on real frames.
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  }
}

async function drag(page: Page, from: Point, to: Point, end: 'touchEnd' | 'touchCancel' = 'touchEnd', holdMs = 0) {
  const session = await page.context().newCDPSession(page)
  try {
    await input(session, 'touchStart', [{ ...from, id: 1 }])
    // Deliberate long-press duration; application readiness uses explicit barriers.
    if (holdMs) await page.waitForTimeout(holdMs)
    await moveFinger(page, session, from, to)
    await input(session, end, [])
  } finally {
    await session.detach()
  }
}

async function target(page: Page, index: number, direction: 'abwärts' | 'aufwärts' = 'aufwärts') {
  const row = await handle(page, index).locator('xpath=ancestor::li').boundingBox()
  expect(row).not.toBeNull()
  const sourceIndex = index + (direction === 'abwärts' ? -1 : 1)
  const source = await handle(page, sourceIndex).locator('xpath=ancestor::li').boundingBox()
  const grip = await center(handle(page, sourceIndex))
  expect(source).not.toBeNull()
  // Keep the grabbed point's offset from its own card centre: an expanded source
  // can be much taller than the collapsed adjacent target. Move its centre just
  // across that neighbour, without accidentally dragging it across later rows.
  const offset = source!.y + source!.height / 2 - grip.y
  return { x: grip.x, y: row!.y + row!.height / 2 - offset + row!.height / 4 * (direction === 'abwärts' ? 1 : -1) }
}

async function assertSaved(page: Page, routine: typeof routines[number], expected: RoutineStep[], seeded: Settings) {
  const other = routine.id === 'morning' ? 'evening' : 'morning'
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.routines[routine.id]).toEqual(expected)
  expect((await storedRecord<Settings>(page, 'settings', 'main'))!.routines[other]).toEqual(seeded.routines[other])
  await page.reload()
  await expect(page.getByRole('heading', { name: routine.heading, exact: true })).toBeVisible()
  await expect.poll(() => page.locator('input[aria-label="Schritt"]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value))).toEqual(expected.map((step) => step.title))
  expect((await storedRecord<Settings>(page, 'settings', 'main'))!.routines[routine.id]).toEqual(expected)
}

test('Touchgriff unterbindet Browser-Pan, die restliche Routine bleibt scrollbar', async ({ page }) => {
  await setup(page, routines[0]!)
  expect(await handle(page, 0).evaluate((node) => getComputedStyle(node).touchAction)).toBe('none')
  expect(await handle(page, 0).locator('xpath=ancestor::li').evaluate((node) => getComputedStyle(node).touchAction)).toBe('auto')
})

for (const routine of routines) {
  for (const direction of ['abwärts', 'aufwärts'] as const) {
    test(`${routine.heading}: echter Touchdrag ${direction} erhält IDs und alle Schrittwerte nach Reload`, async ({ page }) => {
      const { steps, seeded } = await setup(page, routine)
      const from = direction === 'abwärts' ? 0 : 1
      const to = direction === 'abwärts' ? 1 : 0
      const scrollBefore = await page.evaluate(() => scrollY)
      await drag(page, await center(handle(page, from)), await target(page, to, direction), 'touchEnd', routine.id === 'morning' && direction === 'abwärts' ? 650 : 0)
      const expected = [...steps]
      const [moved] = expected.splice(from, 1)
      expected.splice(to, 0, moved!)
      expect(await page.evaluate(() => scrollY)).toBe(scrollBefore)
      await assertSaved(page, routine, expected, seeded)
    })
  }

  test(`${routine.heading}: Wischen außerhalb des Griffs scrollt ohne Umordnung`, async ({ page }) => {
    const { steps, seeded } = await setup(page, routine)
    const row = await handle(page, 1).locator('xpath=ancestor::li').boundingBox()
    expect(row).not.toBeNull()
    const start = { x: row!.x + row!.width - 8, y: row!.y + row!.height / 2 }
    const scrollBefore = await page.evaluate(() => scrollY)
    await drag(page, start, { x: start.x, y: start.y - 220 })
    await expect.poll(async () => page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore + 80)
    expect((await storedRecord<Settings>(page, 'settings', 'main'))!.routines[routine.id]).toEqual(steps)
    await assertSaved(page, routine, steps, seeded)
  })
}

test('Abgebrochene Touchgeste ordnet nichts um; der nächste Griff funktioniert', async ({ page }) => {
  const routine = routines[0]!
  const { steps, seeded } = await setup(page, routine)
  const from = await center(handle(page, 1))
  const to = await target(page, 0)
  await drag(page, from, to, 'touchCancel')
  expect((await storedRecord<Settings>(page, 'settings', 'main'))!.routines.morning).toEqual(steps)
  await expect(handle(page, 1).locator('xpath=ancestor::li')).not.toHaveAttribute('style', /translateY/)
  await drag(page, await center(handle(page, 1)), await target(page, 0))
  await assertSaved(page, routine, [steps[1]!, steps[0]!, ...steps.slice(2)], seeded)
})

test('Schnelle Text- und Daueränderungen vor dem Touchsortieren bleiben mit allen Schrittwerten gespeichert', async ({ page }) => {
  const routine = routines[0]!
  const { steps, seeded } = await setup(page, routine)
  await page.locator('.routine-summary').first().click()
  await page.locator('input[aria-label="Schritt"]').nth(0).fill('Wasser mit neuem Titel')
  await page.getByRole('textbox', { name: 'Minimal-Version', exact: true }).nth(0).fill('Ein kleiner Schluck')
  const duration = page.getByRole('spinbutton', { name: 'Dauer', exact: true }).nth(0)
  await duration.fill('17')
  await duration.press('Tab')
  // No DB barrier between editing and sorting: queued saves must keep the latest fields.
  await drag(page, await center(handle(page, 0)), await target(page, 1, 'abwärts'))
  const edited = { ...steps[0]!, title: 'Wasser mit neuem Titel', minutes: 17, minimal: { ...steps[0]!.minimal!, title: 'Ein kleiner Schluck' } }
  await assertSaved(page, routine, [steps[1]!, edited, ...steps.slice(2)], seeded)
})

test('Sortiertasten behalten den Tastaturfokus für wiederholtes Verschieben und ihre genaue Ansage', async ({ page }) => {
  const routine = routines[0]!
  const { steps, seeded } = await setup(page, routine)
  await page.locator('.routine-summary').nth(2).click()
  const up = page.getByRole('button', { name: 'Eintrag 3 nach oben', exact: true })
  await up.focus()
  await up.press('Enter')
  await expect(page.locator('.settings-routine-list [role="status"]')).toHaveText('Eintrag von Position 3 auf 2 verschoben.')
  const movedUp = page.getByRole('button', { name: 'Eintrag 2 nach oben', exact: true })
  await expect(movedUp).toBeFocused()
  await movedUp.press('Enter')
  await expect(page.locator('.settings-routine-list [role="status"]')).toHaveText('Eintrag von Position 2 auf 1 verschoben.')
  await assertSaved(page, routine, [steps[2]!, steps[0]!, steps[1]!, ...steps.slice(3)], seeded)
})

test('Maus sortiert in beide Richtungen; Rechtsziehen verändert die Reihenfolge nicht', async ({ page }) => {
  const routine = routines[0]!
  const { steps, seeded } = await setup(page, routine)
  for (const direction of ['abwärts', 'aufwärts'] as const) {
    const from = await center(handle(page, direction === 'abwärts' ? 0 : 1))
    const to = await target(page, direction === 'abwärts' ? 1 : 0, direction)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 16 })
    await page.mouse.up()
    await assertSaved(page, routine, direction === 'abwärts' ? [steps[1]!, steps[0]!, ...steps.slice(2)] : steps, seeded)
  }
  const from = await center(handle(page, 1))
  const to = await target(page, 0)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(to.x, to.y, { steps: 16 })
  await page.mouse.up({ button: 'right' })
  await assertSaved(page, routine, steps, seeded)
})

test('Entfernen während einer Touchgeste gibt den nächsten Sortiergriff wieder frei', async ({ page }) => {
  const routine = routines[0]!
  const { steps, seeded } = await setup(page, routine)
  await page.locator('.routine-summary').first().click()
  const first = await center(handle(page, 0))
  const session = await page.context().newCDPSession(page)
  try {
    await input(session, 'touchStart', [{ ...first, id: 1 }])
    await moveFinger(page, session, first, await target(page, 1, 'abwärts'))
    // A second UI action can remove the captured element while touch remains down.
    await page.getByRole('button', { name: 'Entfernen', exact: true }).nth(0).press('Enter')
    await expect(page.locator('input[aria-label="Schritt"]')).toHaveCount(steps.length - 1)
    await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.routines.morning).toEqual(steps.slice(1))
    await input(session, 'touchEnd', [])
  } finally {
    await session.detach()
  }
  await drag(page, await center(handle(page, 0)), await target(page, 1, 'abwärts'))
  await assertSaved(page, routine, [steps[2]!, steps[1]!, ...steps.slice(3)], seeded)
})

test('Ein zweiter Finger übernimmt den aktiven Sortiergriff nicht', async ({ page }) => {
  const routine = routines[0]!
  const { steps, seeded } = await setup(page, routine)
  const first = await center(handle(page, 0))
  const second = await center(handle(page, 1))
  const session = await page.context().newCDPSession(page)
  try {
    await input(session, 'touchStart', [{ ...first, id: 1 }])
    await input(session, 'touchStart', [{ ...first, id: 1 }, { ...second, id: 2 }])
    await input(session, 'touchMove', [{ ...first, id: 1 }, { x: second.x, y: second.y - 150, id: 2 }])
    // For touchEnd, CDP points identify the contacts being released.
    await input(session, 'touchEnd', [{ x: second.x, y: second.y - 150, id: 2 }])
    expect((await storedRecord<Settings>(page, 'settings', 'main'))!.routines.morning).toEqual(steps)
    await moveFinger(page, session, first, await target(page, 1, 'abwärts'))
    await input(session, 'touchEnd', [])
  } finally {
    await session.detach()
  }
  await assertSaved(page, routine, [steps[1]!, steps[0]!, ...steps.slice(2)], seeded)
})

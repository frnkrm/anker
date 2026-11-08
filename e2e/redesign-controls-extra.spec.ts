/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { Settings } from '../src/core/types'
import { storedRecord } from './helpers/storage'

interface SheetRaceProbe {
  holdCleanup: boolean
  holdBack: boolean
  backCalls: number
  flushCleanup: () => void
  releaseBack: () => void
}

/** Hold browser scheduling, not app data, to reproduce a slow popstate deterministically. */
async function prepare(page: Page) {
  await page.addInitScript(() => {
    const nativeTimeout = window.setTimeout.bind(window)
    const nativeClear = window.clearTimeout.bind(window)
    const nativeBack = history.back.bind(history)
    const cleanup = new Map<number, () => void>()
    const backs: (() => void)[] = []
    let timerId = -1
    const probe: SheetRaceProbe = {
      holdCleanup: false, holdBack: false, backCalls: 0,
      flushCleanup() { const batch = [...cleanup.values()]; cleanup.clear(); for (const run of batch) run() },
      releaseBack() { probe.holdBack = false; for (const run of backs.splice(0)) run() },
    }
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (probe.holdCleanup && (delay ?? 0) === 0 && typeof handler === 'function') {
        const id = timerId--
        cleanup.set(id, () => handler(...args))
        return id
      }
      return nativeTimeout(handler, delay, ...args)
    }) as typeof window.setTimeout
    window.clearTimeout = ((id?: number) => { if (id !== undefined && cleanup.delete(id)) return; nativeClear(id) }) as typeof window.clearTimeout
    history.back = () => { probe.backCalls++; if (probe.holdBack) backs.push(nativeBack); else nativeBack() }
    Object.assign(window, { __sheetRace: probe })
  })
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}

const hold = (page: Page) => page.evaluate(() => {
  const probe = (window as unknown as { __sheetRace: SheetRaceProbe }).__sheetRace
  probe.holdCleanup = true; probe.holdBack = true
})
const flushCleanup = (page: Page) => page.evaluate(() => {
  const probe = (window as unknown as { __sheetRace: SheetRaceProbe }).__sheetRace
  probe.flushCleanup()
  return probe.backCalls
})
const releaseBack = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => {
  window.addEventListener('popstate', () => requestAnimationFrame(() => resolve()), { once: true })
  ;(window as unknown as { __sheetRace: SheetRaceProbe }).__sheetRace.releaseBack()
}))

test('Schneller Sheetwechsel und Schließen fordern auch bei gestauter Bereinigung nur einmal Zurück an', async ({ page }) => {
  await prepare(page)
  const before = await storedRecord<Settings>(page, 'settings', 'main')
  const opener = page.getByRole('button', { name: 'Heute anpassen', exact: true })
  await opener.click()
  await hold(page)
  await page.getByRole('dialog').getByText('Weitere Möglichkeiten', { exact: true }).click()
  await page.getByRole('button', { name: 'Termin planen', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Was hast du vor?', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // All unmount effects must have queued their held cleanup before it is drained.
  await expect.poll(() => page.locator('#root').evaluate((node) => node.hasAttribute('inert'))).toBe(false)
  expect(await flushCleanup(page)).toBe(1)
  expect(await page.locator('#root').evaluate((node) => node.hasAttribute('inert'))).toBe(true)
  // A real click waits for the guarded page to become interactive after popstate.
  const reopening = opener.click()
  await releaseBack(page)
  await reopening
  await expect(page.getByRole('dialog', { name: 'Heute anpassen', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  expect(await storedRecord<Settings>(page, 'settings', 'main')).toEqual(before)
})

test('Ein ausstehendes Zurück verwirft keine bereits eingeplante neue Sheetöffnung', async ({ page }) => {
  await prepare(page)
  await page.getByRole('button', { name: 'Heute anpassen', exact: true }).click()
  await hold(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.locator('#root').evaluate((node) => node.hasAttribute('inert'))).toBe(false)
  expect(await flushCleanup(page)).toBe(1)
  // This models a queued React/native intent. Trusted user input remains blocked.
  await page.evaluate(() => {
    const opener = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Heute anpassen')
    if (!opener) throw new Error('Heute-anpassen-Knopf fehlt')
    opener.click()
  })
  await expect(page.getByRole('dialog', { name: 'Heute anpassen', exact: true })).toBeVisible()
  await releaseBack(page)
  await expect(page.getByRole('dialog', { name: 'Heute anpassen', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
})

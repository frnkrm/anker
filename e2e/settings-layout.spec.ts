/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { expect, test, type Page } from '@playwright/test'
import type { Settings } from '../src/core/types'
import { guidancePreferences } from '../src/core/guidance'
import { seedRecords, storedRecord } from './helpers/storage'
import { chooseValue } from './helpers/controls'

async function setup(page: Page, fontScale = 1) {
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.appearance.fontScale = fontScale
  settings.guidance = { ...guidancePreferences(settings.guidance), eveningLight: true, sleepNoise: true, paceKeeper: true, autoZombie: true }
  settings.sport.kind = 'gym'
  settings.support.eveningPreset.enabled = true
  settings.support.windDown = { enabled: true, at: 21 * 60, activity: 'In Ruhe ein paar Seiten lesen' }
  settings.work[0]!.latestStart = 9 * 60
  settings.work[0]!.endPreference = 17 * 60
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
}

const routes = [
  '/einstellungen', '/einstellungen/schlaf', '/einstellungen/begleitung', '/einstellungen/arbeit', '/einstellungen/weg',
  '/einstellungen/sport', '/einstellungen/abende', '/einstellungen/abendmodus',
  '/einstellungen/morgenroutine', '/einstellungen/abendroutine', '/einstellungen/erinnerungen',
  '/einstellungen/hilfen', '/einstellungen/darstellung', '/einstellungen/assistenz',
  '/einstellungen/abenduebergang', '/verbindungen', '/schlaf',
]

for (const width of [390, 320]) for (const fontScale of [1, 1.6]) {
  test(`Einstellungen: Felder und Texte passen bei ${width}px und ${Math.round(fontScale * 100)}% Schrift`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await setup(page, fontScale)
    for (const route of routes) {
      await page.goto(route)
      await expect(page.locator('.settings-page')).toBeVisible()
      for (const summary of await page.locator('details > summary').all()) if (!(await summary.evaluate((node) => (node.parentElement as HTMLDetailsElement).open))) await summary.click()
      if (route === '/schlaf') await page.getByRole('button', { name: 'Nachtragen und korrigieren', exact: true }).click()
      await expect(page.locator('select,input[type="time"]')).toHaveCount(0)
      const geometry = await page.locator('.settings-page').evaluate((root) => {
        const visible = (node: HTMLElement) => node.getClientRects().length > 0
        const groups = [...root.querySelectorAll<HTMLElement>('.setting-control')].filter(visible).map((group) => {
          const fields = [...group.querySelectorAll<HTMLElement>('button,input')].map((node) => {
            const box = node.getBoundingClientRect()
            return { x: box.x, right: box.right, y: box.y, width: box.width, height: box.height }
          })
          const unit = group.querySelector<HTMLElement>('.setting-unit')?.getBoundingClientRect()
          const box = group.getBoundingClientRect()
          return { fields, unit: unit ? { x: unit.x, right: unit.right } : null, routine: !!group.closest('.settings-routine-list'), x: box.x, right: box.right, width: box.width }
        })
        const values = [...root.querySelectorAll<HTMLInputElement>('.setting-value')].filter(visible).map((node) => {
          const box = node.getBoundingClientRect()
          return { x: box.x, width: box.width, height: box.height, routine: !!node.closest('.settings-routine-list') }
        })
        // Einzeilige Freitexte dürfen beim Bearbeiten horizontal scrollen. Beschriftungen
        // und die vollständigen kurzen Zeit-/Zahlenwerte müssen ohne Abschneiden passen.
        const clipped = [...root.querySelectorAll<HTMLElement>('.setting-label,.setting-unit,p,h1,h2,summary,input.setting-value,select')].filter(visible)
          .filter((node) => node.scrollWidth > node.clientWidth + 1 || getComputedStyle(node).textOverflow === 'ellipsis')
          .map((node) => ({ tag: node.tagName, label: node.getAttribute('aria-label') || node.textContent?.slice(0, 100), width: node.clientWidth, content: node.scrollWidth }))
        const context = document.createElement('canvas').getContext('2d')!
        for (const input of [...root.querySelectorAll<HTMLInputElement>('.settings-routine-list input.setting-value')].filter(visible)) {
          const style = getComputedStyle(input)
          context.font = style.font
          const textWidth = context.measureText(input.value).width
          const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
          if (textWidth > available) clipped.push({ tag: 'NUMBER', label: input.getAttribute('aria-label') ?? '', width: available, content: textWidth })
        }
        for (const input of [...root.querySelectorAll<HTMLInputElement>('.time-field')].filter(visible)) {
          const style = getComputedStyle(input)
          context.font = style.font
          const textWidth = context.measureText(input.value).width
          const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
          if (!/^\d{2}:\d{2}$/.test(input.value) || textWidth > available) clipped.push({ tag: 'TIME24H', label: input.getAttribute('aria-label') ?? '', width: available, content: textWidth })
        }
        return { groups, values, clipped, pageWidth: document.documentElement.scrollWidth, viewport: innerWidth }
      })
      expect(geometry.pageWidth, route).toBeLessThanOrEqual(geometry.viewport + 1)
      expect(geometry.clipped, route).toEqual([])
      for (const { fields, unit, routine, x, right, width: controlWidth } of geometry.groups) {
        expect(fields, route).toHaveLength(3)
        const [minus, value, plus] = fields
        expect(minus!.width, route).toBeGreaterThanOrEqual(44)
        expect(plus!.width, route).toBeGreaterThanOrEqual(44)
        expect(minus!.height, route).toBeGreaterThanOrEqual(44)
        expect(plus!.height, route).toBeGreaterThanOrEqual(44)
        if (routine) {
          // Die Routinevariante darf Platz an Zahl und Einheit verteilen. Jede
          // Spalte bleibt getrennt und die gesamte Bedienung innerhalb 196px.
          expect(controlWidth, route).toBeLessThanOrEqual(196)
          expect(value!.width, route).toBeGreaterThanOrEqual(44)
          expect(unit, route).not.toBeNull()
          expect(minus!.x, route).toBeCloseTo(x, 0)
          expect(value!.x - minus!.right, route).toBeCloseTo(2, 0)
          expect(unit!.x - value!.right, route).toBeCloseTo(2, 0)
          expect(plus!.x - unit!.right, route).toBeCloseTo(2, 0)
          expect(plus!.right, route).toBeCloseTo(right, 0)
          expect(value!.y + value!.height / 2, route).toBeCloseTo(minus!.y + minus!.height / 2, 0)
          expect(plus!.y + plus!.height / 2, route).toBeCloseTo(minus!.y + minus!.height / 2, 0)
        } else {
          // Andere Einstellungsfelder behalten exakt ihre vorhandenen Maße.
          expect(controlWidth, route).toBeCloseTo(256, 0)
          expect(value!.width, route).toBeCloseTo(160, 0)
          expect(value!.x - minus!.x, route).toBeCloseTo(48, 0)
          expect(plus!.x - value!.x, route).toBeCloseTo(164, 0)
        }
      }
      for (const value of geometry.values) {
        if (value.routine) expect(value.width, route).toBeGreaterThanOrEqual(44)
        else expect(value.width, route).toBeCloseTo(160, 0)
        expect(value.height, route).toBeGreaterThanOrEqual(44)
      }
      if (geometry.values.length > 1) expect(Math.max(...geometry.values.map((value) => value.x)) - Math.min(...geometry.values.map((value) => value.x)), route).toBeLessThanOrEqual(1)
    }
  })
}

test('Schlaf & Anker: direkte Zahlen, Grenzen und symmetrische Tasten bleiben wirksam', async ({ page }) => {
  await setup(page)
  await page.goto('/einstellungen/schlaf')
  const need = page.getByRole('spinbutton', { name: 'Schlafbedarf', exact: true })
  await need.fill('9.5'); await need.press('Tab')
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.sleep.needMin).toBe(570)
  await page.getByRole('button', { name: 'Schlafbedarf erhöhen', exact: true }).click()
  await expect(need).toHaveValue('10')
  await page.getByRole('button', { name: 'Schlafbedarf erhöhen', exact: true }).click()
  await expect(need).toHaveValue('10')
  await page.getByRole('button', { name: 'Schlafbedarf verringern', exact: true }).click()
  await expect(need).toHaveValue('9.5')
  await need.fill(''); await need.press('Tab')
  await expect(need).toHaveValue('9.5')
  await need.fill('2'); await need.press('Tab')
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.sleep.needMin).toBe(300)
  const fall = page.getByRole('spinbutton', { name: 'Einschlafzeit', exact: true })
  await fall.fill('75'); await fall.press('Tab')
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.sleep.fallAsleepMin).toBe(60)
  await page.getByRole('button', { name: 'Einschlafzeit verringern', exact: true }).click()
  await expect(fall).toHaveValue('55')
})

test('Uhrzeiten bleiben direkt eingebbar, in Fünferschritten änderbar und nachts im selben Plantag', async ({ page }) => {
  await setup(page)
  await page.goto('/einstellungen/schlaf')
  const wake = page.getByLabel('Aufstehzeit', { exact: true })
  await wake.fill('06:13')
  await page.getByRole('button', { name: 'Aufstehzeit später', exact: true }).click()
  await expect(wake).toHaveValue('06:18')
  await page.getByRole('button', { name: 'Aufstehzeit früher', exact: true }).click()
  await expect(wake).toHaveValue('06:13')
  await page.getByLabel('Bettzeit', { exact: true }).fill('00:30')
  await page.getByRole('button', { name: 'Bettzeit später', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.bed).toBe(1475)
  await page.getByRole('button', { name: 'Bettzeit früher', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.bed).toBe(1470)
})

test('Schlaf-Erklärungen erhalten manuelle Zeiten und benennen den vorhandenen Abendübergang', async ({ page }) => {
  await setup(page)
  await page.goto('/einstellungen/schlaf')
  await page.getByLabel('PC-Stopp', { exact: true }).fill('22:10')
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  await page.getByRole('spinbutton', { name: 'Bildschirm aus', exact: true }).fill('45')
  await page.getByRole('spinbutton', { name: 'Bildschirm aus', exact: true }).press('Tab')
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.sleep.screenOffMin).toBe(45)
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.pcStop).toBe(settings.pcStop)
  await page.getByText('Wie diese Zeiten zusammenhängen', { exact: true }).click()
  await expect(page.getByText(/Dein von Hand gesetzter PC-Stopp bleibt dabei erhalten/)).toBeVisible()
  await expect(page.getByText(/weder den Handybildschirm noch den PC automatisch aus/)).toBeVisible()
  await expect(page.getByText(/In Ruhe ein paar Seiten lesen/)).toBeVisible()
  await expect(page.getByText(/ersetzt die PC-Stopp- und Bett-Erinnerungen/)).toBeVisible()
  await expect(page.getByText(/erst, wenn du ihn selbst startest/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Sanften Abendübergang einstellen/ })).toHaveAttribute('href', '/einstellungen/abenduebergang')
  await page.goto('/einstellungen')
  await expect(page.getByRole('link', { name: /Zeitübersicht/ })).toHaveCount(0)
  await page.getByRole('switch', { name: 'Test- und Entwicklerwerkzeuge anzeigen', exact: true }).click()
  await expect(page.getByRole('link', { name: /Zeitübersicht/ })).toHaveAttribute('href', '/zeiten')
})

test('Lange Routinentitel bleiben neben kompakten Auswahlen lesbar und Regeln speichern die vorhandenen IDs', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await setup(page, 1.6)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  const evening = settings.routines.evening[1]!
  const morning = settings.routines.morning[1]!
  evening.title = 'Die vollständige Tasche für den nächsten Arbeitstag ohne Eile vorbereiten'
  morning.title = 'Alle nötigen Unterlagen und meine vorbereitete Tasche an der Tür bereitlegen'
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
  await page.goto('/einstellungen/hilfen')
  await page.getByText('Abends schon erledigt', { exact: true }).click()
  await chooseValue(page, 'Abendschritt', evening.id)
  await chooseValue(page, 'Morgenschritt', morning.id)
  await expect(page.getByText(`Abends: ${evening.title}`, { exact: true })).toBeVisible()
  await expect(page.getByText(`Morgens nicht nötig: ${morning.title}`, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Regel hinzufügen', exact: true }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.routineLinks.at(-1)).toEqual({ eveningStepId: evening.id, morningStepId: morning.id })
  expect((await storedRecord<Settings>(page, 'settings', 'main'))?.routines).toEqual(settings.routines)
})

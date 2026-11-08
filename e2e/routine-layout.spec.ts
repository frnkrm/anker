/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { expect, test, type Page } from '@playwright/test'
import type { RoutineStep, Settings } from '../src/core/types'
import { seedRecords, storedRecord } from './helpers/storage'

const routines = [
  { id: 'morning', path: '/einstellungen/morgenroutine', heading: 'Morgenroutine' },
  { id: 'evening', path: '/einstellungen/abendroutine', heading: 'Abendroutine' },
] as const

async function setup(page: Page, fontScale: number) {
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.onboarded).toBe(true)
  const settings = (await storedRecord<Settings>(page, 'settings', 'main'))!
  settings.appearance.fontScale = fontScale
  for (const routine of routines) {
    const steps: RoutineStep[] = [
      { id: `${routine.id}-long`, title: 'Die vollständige Tasche für den nächsten Arbeitstag vorbereiten', minutes: 120, minimal: { title: 'Nur den Schlüssel an die Tür legen', minutes: 1 } },
      { id: `${routine.id}-short`, title: 'Wasser bereitstellen', minutes: 1, minimal: { title: 'Ein Schluck', minutes: 1 } },
      { id: `${routine.id}-custom`, title: 'Eigener Schritt', minutes: 47 },
    ]
    settings.routines[routine.id] = steps
  }
  await seedRecords(page, [{ collection: 'settings', id: 'main', data: settings }])
}

const viewports: { width: number; fontScale: number; availableWidth?: number }[] = [
  { width: 390, fontScale: 1 }, { width: 390, fontScale: 1.6 },
  { width: 320, fontScale: 1 }, { width: 320, fontScale: 1.6 },
  // Die Seitenbreite ist unabhängig davon, ob der Browser für seine Scrollbar
  // Platz reserviert. So prüfen alle Browser denselben zusätzlichen Engpass.
  { width: 305, fontScale: 1.6, availableWidth: 305 },
]

for (const { width, fontScale, availableWidth } of viewports) {
  const widthLabel = availableWidth ? `${availableWidth}px verfügbarer Seitenbreite` : `${width}px`
  test(`Routinezeilen: Griff links, Details erreichbar und Dauer ohne Überlagerung bei ${widthLabel} und ${Math.round(fontScale * 100)}% Schrift`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await setup(page, fontScale)
    for (const routine of routines) {
      await page.goto(routine.path)
      await expect(page.getByRole('heading', { name: routine.heading, exact: true })).toBeVisible()
      const cards = page.locator('.settings-routine-list ol > li')
      await expect(cards).toHaveCount(3)
      if (availableWidth) {
        const measuredWidth = (await page.locator('.settings-page').boundingBox())!.width
        const viewport = page.viewportSize()!
        await page.setViewportSize({ width: Math.round(viewport.width + availableWidth - measuredWidth), height: viewport.height })
        await expect.poll(async () => (await page.locator('.settings-page').boundingBox())!.width, routine.heading).toBeCloseTo(availableWidth, 0)
      }
      const collapsed = await cards.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect()
        const grip = node.querySelector('button[aria-label$="zum Verschieben ziehen"]')!.getBoundingClientRect()
        const summary = node.querySelector('summary')!.getBoundingClientRect()
        return { height: box.height, gripX: grip.x, gripBottom: grip.bottom, summaryX: summary.x, summaryRight: summary.right, cardRight: box.right }
      }))
      for (const item of collapsed) {
        expect(item.gripX).toBeLessThan(item.summaryX)
        expect(item.summaryRight).toBeLessThanOrEqual(item.cardRight + 1)
      }
      if (width === 390 && fontScale === 1) {
        for (const item of collapsed) expect(item.height).toBeLessThanOrEqual(120)
        const navTop = await page.getByRole('navigation', { name: 'Hauptnavigation' }).evaluate((node) => node.getBoundingClientRect().top)
        expect(collapsed[1]!.gripBottom).toBeLessThanOrEqual(navTop)
      }
      for (const summary of await cards.locator('summary').all()) await summary.click()
      const geometry = await cards.evaluateAll((nodes) => {
        const rect = (node: Element | Range) => {
          const box = node.getBoundingClientRect()
          return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height }
        }
        return nodes.map((card) => {
          const inputs = [...card.querySelectorAll<HTMLInputElement>('input')]
          const buttons = [...card.querySelectorAll<HTMLButtonElement>('button')]
          const duration = card.querySelector<HTMLInputElement>('input[aria-label="Dauer"]')!
          const remove = buttons.find((node) => node.textContent?.trim() === 'Entfernen')!
          const grip = buttons.find((node) => node.getAttribute('aria-label')?.endsWith('zum Verschieben ziehen'))!
          const unit = card.querySelector('.setting-unit')!
          const unitText = document.createRange()
          unitText.selectNodeContents(unit)
          // Die tatsächlichen Buchstaben messen, nicht die ggf. breitere Gridzelle.
          const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
          let label: Range | undefined
          while (walker.nextNode()) if (walker.currentNode.textContent?.trim() === 'Dauer') {
            label = document.createRange()
            label.selectNodeContents(walker.currentNode)
            break
          }
          if (!label) throw new Error('Sichtbare Dauer-Beschriftung fehlt')
          const controls = [...inputs, ...buttons].map((node) => ({
            name: node.getAttribute('aria-label') ?? node.textContent?.trim() ?? '',
            ...rect(node),
          }))
          const buttonTexts = buttons.map((button) => {
            const range = document.createRange()
            range.selectNodeContents(button)
            return { name: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '', button: rect(button), text: rect(range) }
          })
          const labelLineHeight = parseFloat(getComputedStyle(label.startContainer.parentElement!).lineHeight)
          const labelLines = [...label.getClientRects()].filter((box) => box.width > 0 && box.height > 0).length
          const style = getComputedStyle(duration)
          const canvas = document.createElement('canvas').getContext('2d')!
          canvas.font = style.font
          const numberFits = canvas.measureText(duration.value).width <= duration.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
          return { card: rect(card), label: rect(label), labelLines, labelLineHeight, duration: rect(duration), unit: rect(unitText), remove: rect(remove), grip: rect(grip), inputs: inputs.map(rect), controls, buttonTexts, numberFits }
        })
      })
      for (const [index, item] of geometry.entries()) {
        const context = `${routine.heading}, Karte ${index + 1}`
        const inline = Math.min(item.duration.bottom, item.label.bottom) - Math.max(item.duration.y, item.label.y) > 0
        if (inline) expect(item.duration.x, context).toBeGreaterThanOrEqual(item.label.right)
        else expect(item.duration.y, context).toBeGreaterThanOrEqual(item.label.bottom)
        expect(item.labelLines, `${context}: Dauer bleibt vollständig in einer Zeile`).toBe(1)
        expect(item.label.height, `${context}: Dauer bleibt vollständig in einer Zeile`).toBeLessThanOrEqual(item.labelLineHeight + 1)
        expect(item.numberFits, `${context}: vollständiger Minutenwert`).toBe(true)
        expect(item.grip.x, context).toBeLessThan(Math.min(...item.inputs.map((input) => input.x)))
        expect(item.remove.x, context).toBeLessThanOrEqual(item.card.right)
        const visibleParts = [...item.controls, { name: 'Beschriftung Dauer', ...item.label }, { name: 'Einheit min', ...item.unit }]
        for (const part of visibleParts) {
          expect(part.x, `${context}: ${part.name}`).toBeGreaterThanOrEqual(item.card.x - 1)
          expect(part.right, `${context}: ${part.name}`).toBeLessThanOrEqual(item.card.right + 1)
          expect(part.y, `${context}: ${part.name}`).toBeGreaterThanOrEqual(item.card.y - 1)
          expect(part.bottom, `${context}: ${part.name}`).toBeLessThanOrEqual(item.card.bottom + 1)
        }
        for (const control of item.controls) {
          expect(control.width, `${context}: ${control.name}`).toBeGreaterThanOrEqual(44)
          expect(control.height, `${context}: ${control.name}`).toBeGreaterThanOrEqual(44)
        }
        // Eine passende Buttonbox allein reicht nicht: umgebrochene Griffzeichen
        // können unten herausragen, obwohl alle Bedienflächen korrekt liegen.
        for (const { name, button, text } of item.buttonTexts) {
          expect(text.x, `${context}: Zeichen in ${name}`).toBeGreaterThanOrEqual(button.x - 1)
          expect(text.right, `${context}: Zeichen in ${name}`).toBeLessThanOrEqual(button.right + 1)
          expect(text.y, `${context}: Zeichen in ${name}`).toBeGreaterThanOrEqual(button.y - 1)
          expect(text.bottom, `${context}: Zeichen in ${name}`).toBeLessThanOrEqual(button.bottom + 1)
          for (const part of visibleParts.filter((part) => part.name !== name)) {
            const overlapX = Math.min(text.right, part.right) - Math.max(text.x, part.x)
            const overlapY = Math.min(text.bottom, part.bottom) - Math.max(text.y, part.y)
            expect(overlapX > 1 && overlapY > 1, `${context}: Zeichen in ${name} überlagern ${part.name}`).toBe(false)
          }
        }
        for (let i = 0; i < visibleParts.length; i++) for (let j = i + 1; j < visibleParts.length; j++) {
          const a = visibleParts[i]!
          const b = visibleParts[j]!
          const overlapX = Math.min(a.right, b.right) - Math.max(a.x, b.x)
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)
          expect(overlapX > 1 && overlapY > 1, `${context}: ${a.name} überlagert ${b.name}`).toBe(false)
        }
      }
      const pageGeometry = await page.locator('.settings-page').evaluate((root) => ({
        width: root.getBoundingClientRect().width,
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
      }))
      expect(pageGeometry.documentWidth, routine.heading).toBeLessThanOrEqual(pageGeometry.viewportWidth + 1)
      expect(pageGeometry.scrollWidth, routine.heading).toBeLessThanOrEqual(pageGeometry.clientWidth + 1)
      if (availableWidth) expect(Math.abs(pageGeometry.width - availableWidth), routine.heading).toBeLessThanOrEqual(1)

    }
  })
}

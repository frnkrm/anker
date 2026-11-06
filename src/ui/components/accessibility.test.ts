import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Progress } from './ui'

describe('Zugängliche Fortschrittsanzeige', () => {
  it('hat einen verständlichen Namen und bildet auch Randwerte in einem gültigen Bereich ab', () => {
    for (const [value, expected] of [[0.25, 25], [-1, 0], [2, 100], [Infinity, 0], [NaN, 0]]) {
      const html = renderToStaticMarkup(createElement(Progress, { value: value!, label: 'Abgelaufene Fokuszeit' }))
      expect(html).toContain('aria-label="Abgelaufene Fokuszeit"')
      expect(html).toContain(`aria-valuenow="${expected}"`)
      expect(html).toContain(`width:${expected}%`)
    }
  })
})

const luminance = (hex: string): number => {
  const values = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722
}

describe('Lesbarkeit der verwendeten Farbrollen', () => {
  it('erreicht in beiden Themes mindestens4,5:1 für die normalen Textkombinationen', () => {
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')
    for (const block of [':root', '.dark']) {
      const values = Object.fromEntries([...css.split(`${block} {`)[1]!.split('}')[0]!.matchAll(/--([\w-]+): (#[a-fA-F0-9]{6})/g)].map((match) => [match[1], match[2]!]))
      for (const [foreground, background] of [['text', 'bg'], ['muted', 'bg'], ['muted', 'surface-2'], ['accent', 'surface'], ['accent-ink', 'accent'], ['warm', 'warm-soft']]) {
        const [low, high] = [luminance(values[foreground!]!), luminance(values[background!]!)].sort((a, b) => a - b)
        expect((high! + 0.05) / (low! + 0.05), `${block}: ${foreground} auf ${background}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

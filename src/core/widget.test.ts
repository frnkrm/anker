import { expect, it } from 'vitest'
import { widgetSnapshot } from './widget'

it('begrenzt den Widgetstand auf die tatsächlich vorbereitete Zukunft statt unbegrenzter Gültigkeit', () => {
  const entry = (at: number) => ({ at, action: 'Anker öffnen', sub: '', hardLabel: '', hardTime: '' })
  expect(widgetSnapshot([entry(1000), entry(3_601_000)], 1000).expiresAt).toBe(3_601_000)
  expect(widgetSnapshot([entry(1_000 + 7 * 86400_000)], 1000).expiresAt).toBe(1000 + 48 * 3600_000)
  expect(widgetSnapshot([], 1000)).toEqual({ entries: [], generatedAt: 1000, expiresAt: 61_000 })
})

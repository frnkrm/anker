import { describe, expect, it } from 'vitest'
import { restoreTextEntries } from './listUndo'

describe('Rücknahme in eigenen Textlisten', () => {
  it('erhält gleiche vorhandene Einträge und stellt ihre ursprünglichen Plätze wieder her', () => {
    expect(restoreTextEntries(['Bad', 'Flur'], ['Küche', 'Bad', 'Küche', 'Flur'], 'Küche')).toEqual(['Küche', 'Bad', 'Küche', 'Flur'])
  })
  it('verwirft beim Rückgängigmachen keine zwischenzeitlich ergänzten Einträge', () => {
    expect(restoreTextEntries(['Bad', 'Neu'], ['Küche', 'Bad'], 'Küche')).toEqual(['Küche', 'Bad', 'Neu'])
  })
  it('legt bei erneuter Rücknahme keine zusätzlichen Duplikate an', () => {
    const original = ['Küche', 'Bad', 'Küche']
    expect(restoreTextEntries(original, original, 'Küche')).toEqual(original)
  })
})

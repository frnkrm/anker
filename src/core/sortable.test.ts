import { describe, expect, it } from 'vitest'
import { moveById } from './sortable'

describe('Sortieren mit stabilen IDs', () => {
  it('verschiebt nach unten und oben, ohne Inhalt, IDs oder Ausgangsliste zu verändern', () => {
    const items = [
      { id: 'a', title: 'Wasser', minutes: 2, minimal: { title: 'Ein Schluck', minutes: 1 } },
      { id: 'b', title: 'Zähne', minutes: 3 },
      { id: 'c', title: 'Anziehen', minutes: 4 },
    ]
    const before = structuredClone(items)
    const down = moveById(items, 'a', 'c')
    expect(down).toEqual([items[1], items[2], items[0]])
    expect(down[2]).toBe(items[0])
    expect(moveById(down, 'a', 'b')).toEqual(items)
    expect(items).toEqual(before)
  })

  it('erhält aktuelle Texte und neue Zeilen, statt einen alten Drag-Schnappschuss einzusetzen', () => {
    const current = [{ id: 'new', title: 'Neu' }, { id: 'a', title: 'Gerade bearbeitet' }, { id: 'b', title: 'Ziel' }]
    expect(moveById(current, 'a', 'b')).toEqual([current[0], current[2], current[1]])
  })

  it.each([['missing', 'b'], ['a', 'missing'], ['a', 'a']])('erzeugt bei fehlender oder gleicher ID keine Zeile neu: %s → %s', (source, target) => {
    const current = [{ id: 'a' }, { id: 'b' }]
    expect(moveById(current, source, target)).toBe(current)
  })
})

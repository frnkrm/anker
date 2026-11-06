import { describe, expect, it } from 'vitest'
import { widgetEntry } from './now'

describe('Widgetprojektion gemeinsamer Handlungen', () => {
  it('zeigt Aufgaben und Wiedereinstiege ohne ihre privaten Inhalte', () => {
    for (const [type, label] of [['task', 'Deine Aufgabe'], ['worktask', 'Arbeit weiterführen'], ['resume', 'Wieder einsteigen'], ['einsatz-running', 'Arbeitseinsatz läuft']]) {
      const entry = widgetEntry(1, { action: { type: type!, title: 'Kunde Geheim', sub: 'Private Adresse' } })
      expect(entry.action).toBe(label)
      expect(entry.sub).toBe('')
      expect(JSON.stringify(entry)).not.toMatch(/Kunde|Geheim|Private Adresse/)
    }
  })

  it('maskiert auch Kalendertitel und die Ankunft am privaten Termin', () => {
    const entry = widgetEntry(1, {
      action: { type: 'info', title: 'Privater Kalendertitel', sub: 'Vertrauliche Adresse' },
      block: { id: 'event', kind: 'event', title: 'Privater Kalendertitel', start: 600, end: 660 },
      hard: { key: 'commitment', label: 'Los: Geheimer Kunde', at: 660 },
    })
    expect(entry.action).toBe('Termin')
    expect(entry.hardLabel).toBe('Losgehen')
    expect(JSON.stringify(entry)).not.toMatch(/Privater|Vertrauliche|Geheimer/)
  })

  it('gibt neue unbekannte Aktionstypen sicher aus und erhält öffentliche Routinehinweise', () => {
    for (const type of ['future-private-action', 'constructor', '__proto__']) {
      const unknown = widgetEntry(1, { action: { type, title: 'Vertraulich', sub: 'Privat' } })
      expect(unknown).toMatchObject({ action: 'Anker öffnen', sub: '' })
    }
    const routine = widgetEntry(1, { action: { type: 'step', title: 'Wasser trinken', sub: 'Morgenroutine' } })
    expect(routine).toMatchObject({ action: 'Wasser trinken', sub: 'Morgenroutine' })
  })
})

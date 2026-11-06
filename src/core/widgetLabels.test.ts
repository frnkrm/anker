import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { nowView, widgetEntry } from './now'
import { buildDayPlan } from './planner'

describe('Datensparsame Widgetanker unterscheiden Termin und tatsächlichen Weg', () => {
  it('zeigt für einen Remote-Termin keinen erfundenen Abfahrtsauftrag oder privaten Inhalt', () => {
    const entry = widgetEntry(1, { action: { type: 'info', title: 'Vertrauliches Thema', sub: 'Private Adresse' },
      block: { id: 'private', kind: 'commitment', title: 'Vertrauliches Thema', start: 400, end: 450 },
      hard: { key: 'commitment', label: 'Vertrauliches Thema', at: 420 } })
    expect(entry).toMatchObject({ action: 'Termin', sub: '', hardLabel: 'Termin', hardTime: '07:00' })
    expect(JSON.stringify(entry)).not.toMatch(/Vertrauliches|Private Adresse/)
  })
  it('bewahrt den allgemeinen Abfahrtstext ohne Kundenname und verwechselt freie Termintitel nicht mit Wegmetadaten', () => {
    expect(widgetEntry(1, { action: { type: 'go', title: 'Kunde geheim' }, hard: { key: 'commitment', label: 'Los: Kunde geheim', at: 400 } })).toMatchObject({ action: 'Losgehen', hardLabel: 'Losgehen', sub: '' })
    const date = '2026-11-09'
    const plan = buildDayPlan({ date, settings: defaultSettings(date), commitments: [{ id: 'remote', date, label: 'Los: vertraulicher Remote-Titel', context: 'personal', commitment: 'hard', start: 420, end: 450, locationKind: 'remote' }] })
    const entry = widgetEntry(1, nowView(plan, undefined, 400))
    expect(entry.hardLabel).toBe('Termin')
    expect(JSON.stringify(entry)).not.toContain('vertraulich')
  })
})

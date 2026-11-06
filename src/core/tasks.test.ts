import { describe, expect, it } from 'vitest'
import { decomposeTask, durationSuggestion, nextTaskOccurrence, resolveTask, taskIsActionable, taskIsOpen, taskLearningKey, taskNextStep, taskPriority, taskState, taskStateLabel, taskTitle, validTaskFields, validTaskParts, validTaskRef } from './tasks'
import type { TaskFields, TaskPart } from './types'

describe('Ehrliche Aufgabenfelder und Altstände', () => {
  it('löst Referenzen in ihren vorhandenen Bereichen auf, ohne Notizen zu Aufgaben zu machen', () => {
    const inbox = [{ id: 'same', text: 'Gedanke', status: 'kept' as const, createdAt: 1 }, { id: 'private', text: 'Privat', status: 'task' as const, createdAt: 1 }]
    const work = [{ id: 'same', title: 'Arbeit', createdAt: 1 }]
    expect(resolveTask({ kind: 'task', id: 'same' }, inbox, work)).toBeUndefined()
    expect(taskTitle(resolveTask({ kind: 'work', id: 'same' }, inbox, work)!)).toBe('Arbeit')
    expect(taskTitle(resolveTask({ kind: 'task', id: 'private' }, inbox, work)!)).toBe('Privat')
  })
  it('liest alte Erledigungen weiterhin ohne neues Pflichtfeld', () => {
    expect(taskState({})).toBe('pending')
    expect(taskState({ done: true, doneAt: 1, state: 'paused' })).toBe('completed')
    expect(taskState({ done: true, doneMode: 'minimal' })).toBe('completed-minimal')
    expect(taskStateLabel({ state: 'not-needed' })).toBe('Nicht nötig')
    expect(validTaskFields({ done: true, doneAt: 0 })).toBe(true)
  })

  it('behandelt nicht nötig, abgesagt und Erledigung getrennt', () => {
    for (const task of [{ done: true }, { state: 'not-needed' as const }, { state: 'cancelled' as const }]) expect(taskIsOpen(task)).toBe(false)
    for (const state of ['active', 'paused', 'partial', 'deferred'] as const) expect(taskIsOpen({ state })).toBe(true)
  })

  it('achtet bei Empfehlungen auf Start und bewusstes Verschieben', () => {
    expect(taskIsActionable({ earliestStart: 200 }, 100)).toBe(false)
    expect(taskIsActionable({ earliestStart: 100 }, 100)).toBe(true)
    expect(taskIsActionable({ state: 'deferred' }, 100)).toBe(false)
    expect(taskIsActionable({ state: 'deferred', deferredUntil: 101 }, 100)).toBe(false)
    expect(taskIsActionable({ state: 'deferred', deferredUntil: 100 }, 100)).toBe(true)
    expect(taskIsActionable({ done: true }, 100)).toBe(false)
  })

  it('nimmt den eigenen nächsten Schritt vor offenen Teilschritten und Titel', () => {
    const subtasks: TaskPart[] = [{ id: 'done', title: 'Fertig', doneAt: 1 }, { id: 'next', title: 'Tabelle öffnen' }]
    expect(taskNextStep({ nextStep: '   ', subtasks }, 'Bericht')).toBe('Tabelle öffnen')
    expect(taskNextStep({ nextStep: 'Datei suchen', subtasks }, 'Bericht')).toBe('Datei suchen')
    expect(taskNextStep({ subtasks: subtasks.slice(0, 1) }, 'Bericht')).toBe('Bericht')
    expect([taskPriority({ priority: 'high' }), taskPriority({}), taskPriority({ priority: 'low' })]).toEqual([2, 1, 0])
  })

  it('prüft nur vorhandene optionale Felder und stabile Referenzen', () => {
    expect(validTaskFields({})).toBe(true)
    expect(validTaskFields({ priority: 'high', energy: 'low', context: 'home', subtasks: [{ id: 'one', title: 'Öffnen', estimateMin: 2 }], recurrence: { seriesId: 's', everyDays: 7, occurrenceDate: '2026-11-06' } })).toBe(true)
    expect(validTaskRef({ kind: 'work', id: 'w' })).toBe(true)
    expect(validTaskRef({ kind: 'task', id: '' })).toBe(false)
    expect(validTaskRef({ kind: 'note', id: 'n' })).toBe(false)
  })

  it.each([
    { estimateMin: 0 }, { estimateMin: Infinity }, { deadline: NaN }, { doneAt: -1 }, { priority: ['high'] },
    { context: 'unknown' }, { energy: 'extreme' }, { state: 'failed' }, { doneMode: 'automatic' },
    { recurrence: { seriesId: 's', everyDays: 0, occurrenceDate: '2026-11-06' } },
    { recurrence: { seriesId: 's', everyDays: 7, occurrenceDate: '2026-02-31' } },
    { source: { kind: 'ai' } }, { subtasks: [{ id: 'a', title: 'Erster' }, { id: 'a', title: 'Zweiter' }] },
  ])('weist fehlerhafte neue Daten zurück: %j', (fields) => {
    expect(validTaskFields(fields)).toBe(false)
  })
})

describe('Lokale Aufgabenzerlegung', () => {
  it('liefert konkrete Vorschläge mit passender Detailtiefe und stabilen IDs', () => {
    expect(decomposeTask('Bericht schreiben', 'three')).toHaveLength(3)
    expect(decomposeTask('Bericht schreiben', 'normal')).toHaveLength(5)
    expect(decomposeTask('Bericht schreiben', 'tiny')).toHaveLength(8)
    expect(decomposeTask('Bericht schreiben', 'three')).toEqual(decomposeTask('Bericht schreiben', 'three'))
    expect(decomposeTask('Beim Zahnarzt anrufen', 'three')[0]?.title).toMatch(/Kontakt/)
    expect(decomposeTask('Küche aufräumen', 'three')[0]?.title).toMatch(/Bereich/)
  })

  it('erhält bestätigte Teile samt Zeitpunkt, manueller Bearbeitung und Reihenfolge', () => {
    const normal = decomposeTask('Bericht', 'normal')
    const existing: TaskPart[] = [{ id: 'custom', title: 'Schon selbst gemacht', doneAt: 20 }, ...normal]
    existing[2] = { ...existing[2]!, title: 'Meine benannte Datei öffnen', doneAt: 30 }
    const before = structuredClone(existing)
    const changed = decomposeTask('Bericht', 'tiny', existing)
    expect(changed.filter((part) => part.doneAt !== undefined)).toEqual([existing[0], existing[2]])
    expect(changed.filter((part) => part.id === existing[2]!.id)).toHaveLength(1)
    expect(existing).toEqual(before)
    expect(validTaskParts(changed)).toBe(true)
  })

  it('behält bearbeitete offene Teiltexte und verliert bei leerem Titel keine Daten', () => {
    const parts = decomposeTask('Bericht', 'three')
    parts[0] = { ...parts[0]!, title: 'Meinen Ordner öffnen', estimateMin: 4 }
    expect(decomposeTask('Bericht', 'normal', parts)[0]).toEqual(parts[0])
    expect(decomposeTask(' ', 'three', parts)).toEqual(parts)
  })
})

describe('Wiederholungen ohne Nachholstapel', () => {
  const task: TaskFields & { id: string } = { id: 'first', recurrence: { seriesId: 'series', everyDays: 1, occurrenceDate: '2026-11-01' } }
  it('berechnet genau eine künftige, stabile Instanz nach mehreren Tagen Nichtnutzung', () => {
    expect(nextTaskOccurrence(task, '2026-11-06')).toEqual({ id: 'repeat:series:2026-11-07', date: '2026-11-07', recurrence: { seriesId: 'series', everyDays: 1, occurrenceDate: '2026-11-07' } })
    expect(nextTaskOccurrence(task, '2026-11-06')).toEqual(nextTaskOccurrence(task, '2026-11-06'))
  })

  it('bewahrt den Serienabstand und berücksichtigt Kalendergrenzen', () => {
    expect(nextTaskOccurrence({ ...task, recurrence: { seriesId: 'weekly', everyDays: 7, occurrenceDate: '2026-10-25' } }, '2026-11-03')?.date).toBe('2026-11-08')
    expect(nextTaskOccurrence({ ...task, recurrence: { seriesId: 'leap', everyDays: 1, occurrenceDate: '2028-02-28' } }, '2028-02-28')?.date).toBe('2028-02-29')
    expect(nextTaskOccurrence({ ...task, recurrence: { seriesId: 'future', everyDays: 7, occurrenceDate: '2026-12-01' } }, '2026-11-06')?.date).toBe('2026-12-08')
  })

  it('macht ohne ausdrückliche Serie keine Wiederholung', () => {
    expect(nextTaskOccurrence({ id: 'note' }, '2026-11-06')).toBeUndefined()
    expect(nextTaskOccurrence(task, 'invalid')).toBeUndefined()
  })
})

describe('Vorsichtige lokale Dauer-Vorschläge', () => {
  const samples = (...values: number[]) => values.map((minutes) => ({ minutes, confirmed: true }))
  it('braucht mindestens drei bestätigte brauchbare Messwerte', () => {
    expect(durationSuggestion(samples(10, 12))).toBeUndefined()
    expect(durationSuggestion([{ minutes: 10 }, { minutes: 11, confirmed: false }, ...samples(12, 13)])).toBeUndefined()
    expect(durationSuggestion(samples(10, 12, 14))).toBe(12)
  })

  it('ein extremer Ausreißer verschiebt die Schätzung nicht unkontrolliert', () => {
    expect(durationSuggestion(samples(10, 12, 14, 400))).toBe(12)
    expect(durationSuggestion(samples(10, 12, 400))).toBe(12)
    expect(durationSuggestion(samples(10, 12, 14, 99999, -1, NaN))).toBe(12)
  })

  it('trennt Arbeit und Privat sowie verschiedene Serien', () => {
    expect(taskLearningKey({ kind: 'work', id: 'a' }, { title: '  Bericht  ' })).toBe('work:bericht')
    expect(taskLearningKey({ kind: 'task', id: 'a' }, { text: 'BERICHT' })).toBe('task:bericht')
    expect(taskLearningKey({ kind: 'task', id: 'a' }, { text: 'Titel', recurrence: { seriesId: 's', everyDays: 1, occurrenceDate: '2026-11-06' } })).toBe('task:s')
  })
})

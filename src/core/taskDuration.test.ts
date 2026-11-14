import { describe, expect, it } from 'vitest'
import { taskDurationEvidence } from './tasks'
import type { InboxItem, TaskDurationSample, WorkTask } from './types'

const at = Date.parse('2026-11-13T10:00:00+01:00')
const task: InboxItem = { id: 'current', text: 'Bericht', status: 'task', createdAt: at }
const source = (id: string, business = false): InboxItem => ({ ...task, id, ...(business ? { captureContext: 'Arbeit' as const } : {}) })
const sample = (id: string, minutes: number, patch: Partial<TaskDurationSample> = {}): TaskDurationSample => ({
  id: `task:${id}:${at}`, key: 'task:bericht', label: 'Bericht', at, minutes, confirmed: true, ...patch,
})
const read = (samples: TaskDurationSample[], sources: InboxItem[] = [], current = task) => taskDurationEvidence({ kind: 'task', id: current.id }, current, samples, [current, ...sources], [])

describe('F-004: vorsichtige Vorschläge aus vorhandenen Bestätigungen', () => {
  it('braucht drei brauchbare zuordenbare Bestätigungen und zählt dieselbe Grundlage wie der Schätzer', () => {
    const sources = ['a', 'b', 'c'].map(id => source(id))
    const samples = [sample('a', 10), sample('b', 12)]
    expect(read(samples, sources)).toEqual({ count: 2, suggestion: undefined })
    expect(read([...samples, sample('c', 14)], sources)).toEqual({ count: 3, suggestion: 12 })
  })
  it('zählt ungültige/außerhalb des Vorschlagsbereichs liegende und unbestätigte Werte nicht mit', () => {
    const sources = ['a', 'b', 'c', 'bad'].map(id => source(id))
    const samples = [sample('a', 10), sample('b', 12), sample('c', 14)]
    for (const minutes of [NaN, Infinity, -1, 0, 481, 1440]) expect(read([...samples, sample('bad', minutes)], sources)).toEqual({ count: 3, suggestion: 12 })
    expect(read([...samples, sample('bad', 5, { confirmed: false as true })], sources).count).toBe(3)
  })
  it('vermischt gleich benannte private und ausdrücklich geschäftliche Inbox-Aufgaben nicht', () => {
    const sources = [source('a'), source('b'), source('c', true)]
    expect(read([sample('a', 10), sample('b', 12), sample('c', 100)], sources)).toEqual({ count: 2, suggestion: undefined })
    expect(read([sample('c', 100)], sources, source('current', true))).toEqual({ count: 1, suggestion: undefined })
  })
  it('erfindet bei gelöschter/unbekannter Herkunft aus dem Titel keine Vergleichbarkeit', () => {
    const samples = [sample('missing', 10), sample('another', 12), sample('legacy', 14, { id: 'old-import-id' })]
    expect(read(samples)).toEqual({ count: 0, suggestion: undefined })
    expect(samples).toHaveLength(3)
  })
  it('trennt vorhandene Serien und prüft die Quelle auch bei übernommenen Altdaten', () => {
    const current = { ...task, recurrence: { seriesId: 'series', everyDays: 1, occurrenceDate: '2026-11-13' } }
    expect(read([sample('a', 7, { key: 'task:series' }), sample('b', 8, { key: 'task:other' })], [source('a'), source('b')], current)).toEqual({ count: 1, suggestion: undefined })
  })
  it('zählt dieselbe Bestätigung nur einmal und verwirft widersprüchliche Kopien', () => {
    const sources = ['a', 'b', 'c'].map(id => source(id))
    expect(read([sample('a', 10), sample('a', 10), sample('a', 10)], sources)).toEqual({ count: 1, suggestion: undefined })
    expect(read([sample('a', 10), sample('a', 20), sample('b', 12), sample('c', 14)], sources)).toEqual({ count: 2, suggestion: undefined })
  })
  it('verwendet den bisherigen robusten Median, speichert nichts und verändert keine Schätzung', () => {
    const work: WorkTask = { id: 'work', title: 'Bericht', createdAt: at, estimateMin: 30 }
    const sources = ['a', 'b', 'c', 'd'].map(id => ({ ...work, id }))
    const samples = [10, 12, 14, 400].map((minutes, i) => sample(sources[i]!.id, minutes, { id: `work:${sources[i]!.id}:${at}`, key: 'work:bericht' }))
    const before = structuredClone({ work, sources, samples })
    expect(taskDurationEvidence({ kind: 'work', id: 'work' }, work, samples, [], sources)).toEqual({ count: 4, suggestion: 12 })
    expect({ work, sources, samples }).toEqual(before)
  })
})

import { describe, expect, it } from 'vitest'
import { upcomingWorkTasks } from './upcomingWork'
import type { WorkTask } from './types'

const MINUTE = 60_000
const NOW = Date.parse('2026-11-07T08:00:35.000Z')
const task = (id: string, fields: Partial<WorkTask> = {}): WorkTask => ({ id, title: `Aufgabe ${id}`, createdAt: NOW - MINUTE, ...fields })

describe('Arbeitsaufgaben demnächst auf Jetzt', () => {
  it('zeigt gewählte Startzeiten und Fristen, aber keine alten Aufgaben ohne Zeit', () => {
    const start = task('start', { earliestStart: NOW + 10 * MINUTE })
    const deadline = task('deadline', { deadline: NOW + 20 * MINUTE })
    expect(upcomingWorkTasks([task('alt'), deadline, start], NOW)).toEqual([
      { task: start, kind: 'start', at: start.earliestStart },
      { task: deadline, kind: 'deadline', at: deadline.deadline },
    ])
  })

  it('bezieht die Grenze nach genau 60 Minuten ein und spätere Millisekunden nicht', () => {
    const boundary = task('boundary', { earliestStart: NOW + 60 * MINUTE })
    expect(upcomingWorkTasks([
      task('later', { earliestStart: NOW + 60 * MINUTE + 1 }), boundary,
      task('later-deadline', { deadline: NOW + 60 * MINUTE + 1 }),
    ], NOW)).toEqual([{ task: boundary, kind: 'start', at: boundary.earliestStart }])
  })

  it('behält Start und Frist während ihrer ganzen aktuellen Minute und entfernt frühere Minuten', () => {
    const minuteStart = Date.parse('2026-11-07T08:00:00.000Z')
    const start = task('start', { earliestStart: minuteStart })
    const deadline = task('deadline', { deadline: minuteStart })
    const old = task('old', { deadline: minuteStart - 1, earliestStart: minuteStart - MINUTE })
    expect(upcomingWorkTasks([start, old, deadline], minuteStart + MINUTE - 1)).toEqual([
      { task: deadline, kind: 'deadline', at: minuteStart },
      { task: start, kind: 'start', at: minuteStart },
    ])
    expect(upcomingWorkTasks([start, deadline], minuteStart + MINUTE)).toEqual([])
  })

  it.each([
    { done: true }, { done: true, doneMode: 'minimal' as const },
    { state: 'cancelled' as const }, { state: 'not-needed' as const },
  ])('schließt bestätigte Erledigung, Absage und nicht nötig aus: %j', (fields) => {
    expect(upcomingWorkTasks([task('closed', { earliestStart: NOW, deadline: NOW, ...fields })], NOW)).toEqual([])
  })

  it.each(['pending', 'active', 'paused', 'partial', 'deferred'] as const)('bewahrt den offenen Zustand %s ohne automatische Aktivierung', (state) => {
    const work = task('open', { state, deadline: NOW + MINUTE, deferredUntil: NOW + 120 * MINUTE })
    const before = structuredClone(work)
    expect(upcomingWorkTasks([work], NOW)[0]?.task).toBe(work)
    expect(work).toEqual(before)
  })

  it('liefert bei zwei Angaben genau den nächsten Zeitpunkt; Gleichstand bezeichnet die Frist', () => {
    const firstStart = task('first-start', { earliestStart: NOW + MINUTE, deadline: NOW + 2 * MINUTE })
    const firstDeadline = task('first-deadline', { earliestStart: NOW + 3 * MINUTE, deadline: NOW + 2 * MINUTE })
    const sameTime = task('same-time', { earliestStart: NOW + 4 * MINUTE, deadline: NOW + 4 * MINUTE })
    expect(upcomingWorkTasks([sameTime, firstDeadline, firstStart], NOW)).toEqual([
      { task: firstStart, kind: 'start', at: firstStart.earliestStart },
      { task: firstDeadline, kind: 'deadline', at: firstDeadline.deadline },
      { task: sameTime, kind: 'deadline', at: sameTime.deadline },
    ])
  })

  it('nutzt einen künftigen Zeitpunkt auch wenn die jeweils andere Angabe schon vorbei ist', () => {
    const start = task('start', { earliestStart: NOW + MINUTE, deadline: NOW - 2 * MINUTE })
    const deadline = task('deadline', { earliestStart: NOW - 2 * MINUTE, deadline: NOW + 2 * MINUTE })
    expect(upcomingWorkTasks([deadline, start], NOW)).toEqual([
      { task: start, kind: 'start', at: start.earliestStart },
      { task: deadline, kind: 'deadline', at: deadline.deadline },
    ])
  })

  it('begrenzt chronologisch auf drei Hinweise und löst gleiche Zeiten unabhängig von der Eingabereihenfolge auf', () => {
    const a = task('a', { deadline: NOW + MINUTE })
    const b = task('b', { deadline: NOW + MINUTE })
    const start = task('0', { earliestStart: NOW + MINUTE })
    const fourth = task('fourth', { earliestStart: NOW + 2 * MINUTE, priority: 'high' })
    const input = [fourth, start, b, a]
    expect(upcomingWorkTasks(input, NOW).map((item) => item.task.id)).toEqual(['a', 'b', '0'])
    expect(upcomingWorkTasks([...input].reverse(), NOW).map((item) => item.task.id)).toEqual(['a', 'b', '0'])
    expect(input).toEqual([fourth, start, b, a])
  })

  it.each([NaN, Infinity, -Infinity, -1, 8.64e15 + 1])('ignoriert ungültige Zeitwerte %s und erhält die andere gültige Angabe', (invalid) => {
    const start = task('start', { earliestStart: NOW + MINUTE, deadline: invalid })
    const deadline = task('deadline', { earliestStart: invalid, deadline: NOW + 2 * MINUTE })
    expect(upcomingWorkTasks([task('invalid', { earliestStart: invalid, deadline: invalid }), deadline, start], NOW)).toEqual([
      { task: start, kind: 'start', at: start.earliestStart },
      { task: deadline, kind: 'deadline', at: deadline.deadline },
    ])
    expect(upcomingWorkTasks([start], invalid)).toEqual([])
  })

  it('zählt am Berliner Sommerzeitbeginn reale UTC-Minuten statt übersprungener Wandzeit', () => {
    const now = Date.parse('2026-03-29T01:30:00+01:00')
    const at = Date.parse('2026-03-29T03:30:00+02:00')
    const work = task('spring', { earliestStart: at })
    expect(at - now).toBe(60 * MINUTE)
    expect(upcomingWorkTasks([work], now)).toEqual([{ task: work, kind: 'start', at }])
  })

  it('unterscheidet die beiden gleichen Berliner Stunden beim Sommerzeitende', () => {
    const now = Date.parse('2026-10-25T02:30:00+02:00')
    const at = Date.parse('2026-10-25T02:30:00+01:00')
    const work = task('autumn', { deadline: at })
    expect(at - now).toBe(60 * MINUTE)
    expect(upcomingWorkTasks([work], now)).toEqual([{ task: work, kind: 'deadline', at }])
    expect(upcomingWorkTasks([task('later', { deadline: at + 1 })], now)).toEqual([])
  })

  it('gibt unveränderte Elternreferenzen zurück und erzeugt weder Aufgaben noch Abschlüsse', () => {
    const work = task('parent', { earliestStart: NOW, subtasks: [{ id: 'part', title: 'Kleiner Schritt' }] })
    const before = structuredClone(work)
    const input = Object.freeze([Object.freeze(work)])
    const result = upcomingWorkTasks(input, NOW)
    expect(result[0]?.task).toBe(work)
    expect(work).toEqual(before)
    expect(work.done).toBeUndefined()
    expect(work.subtasks?.[0]?.doneAt).toBeUndefined()
    expect(upcomingWorkTasks([task(' ', { deadline: NOW })], NOW)).toEqual([])
  })
})

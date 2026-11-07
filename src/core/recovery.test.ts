import { describe, expect, it } from 'vitest'
import { createCountdown, pauseCountdown } from './focus'
import { normaliseTask, recoveryFields, resumeRoute, usableResume, validRecoveryLocal, validResume } from './recovery'
import type { InboxItem, ResumePoint, WorkTask } from './types'

const at = Date.parse('2026-11-02T10:00:00+01:00')
const work: WorkTask = { id: 'bericht', title: 'Bericht', createdAt: at, nextStep: 'Tabelle öffnen' }
const resume: ResumePoint = { kind: 'work', refId: work.id, title: 'Alter Titel', nextStep: 'Alt', note: 'Zweite Zeile prüfen', at }

describe('Wiedereinstieg und additive Altdatenübernahme', () => {
  it('behält eine reale offene Aufgabe unabhängig von der Dauer der Pause und nimmt ihren aktuellen Schritt', () => {
    expect(usableResume(resume, [], [work])).toEqual({ ...resume, title: work.title, nextStep: work.nextStep })
    expect(resume.title).toBe('Alter Titel')
  })

  it('führt nach Erledigung, Absage oder Löschung nicht mehr zur alten Referenz', () => {
    for (const tasks of [[], [{ ...work, done: true }], [{ ...work, state: 'cancelled' as const }], [{ ...work, state: 'not-needed' as const }]]) {
      expect(usableResume(resume, [], tasks)).toBeUndefined()
    }
    expect(usableResume({ ...resume, kind: 'task' }, [{ id: work.id, text: 'Nur Notiz', status: 'open', createdAt: at }], [])).toBeUndefined()
  })

  it('behält den gewählten Teilschritt nach Umbenennen und verwechselt ihn nie mit dem nächsten offenen Schritt', () => {
    const point = { ...resume, partId: 'zweiter' }
    const task = { ...work, subtasks: [{ id: 'erster', title: 'Zuerst' }, { id: 'zweiter', title: 'Neu benannt' }] }
    expect(usableResume(point, [], [task])).toMatchObject({ partId: 'zweiter', nextStep: 'Neu benannt' })
    expect(usableResume(point, [], [{ ...task, subtasks: [{ id: 'erster', title: 'Zuerst' }] }])).toBeUndefined()
    expect(usableResume(point, [], [{ ...task, subtasks: [{ id: 'zweiter', title: 'Erledigt', doneAt: at }] }])).toBeUndefined()
    expect(resumeRoute({ ...point, partId: 'a/b?#', route: '/veraltet' })).toBe('/aufgabe/work/bericht?teil=a%2Fb%3F%23')
    for (const extra of [{ partId: '' }, { partId: 7 }, { partId: 'a', refId: undefined }, { partId: 'a', kind: 'free' }]) expect(validResume({ ...point, ...extra })).toBe(false)
  })

  it('verwendet die kanonische Referenz statt einer veralteten Route und kodiert IDs', () => {
    expect(resumeRoute({ ...resume, refId: 'a/b?#', route: '/veraltet' })).toBe('/aufgabe/work/a%2Fb%3F%23')
    expect(resumeRoute({ kind: 'step', title: 'Zähne', at, route: '/fokus/morning' })).toBe('/fokus/morning')
  })

  it('weist externe oder manipulierte Wiedereinstiegsrouten vor Import ab', () => {
    for (const route of ['//example.org', 'https://example.org', '/\\example.org', '/x\npath', '/x\0path']) {
      expect(validResume({ ...resume, route })).toBe(false)
    }
    expect(validResume({ ...resume, route: '/arbeit' })).toBe(true)
  })

  it('akzeptiert den alten lokalen Bestand ohne neue Pflichtfelder', () => {
    expect(validRecoveryLocal({ work: [{ id: work.id, title: work.title, createdAt: at }], unrelatedLegacyField: { keep: true } })).toBe(true)
    expect(recoveryFields({ work: [work] }).focus).toBeUndefined()
  })

  it('isoliert kaputte neue optionale Felder, ohne das Ursprungsobjekt zu verändern', () => {
    const source = { ...work, description: 'Erhalten', nextStep: 'Öffnen', estimateMin: -5, state: 'invented', reminderRevision: 9, oldUnknownField: 'Erhalten' }
    const result = normaliseTask(source as unknown as WorkTask)
    expect(result).toMatchObject({ id: work.id, description: 'Erhalten', nextStep: 'Öffnen', oldUnknownField: 'Erhalten' })
    expect(result.estimateMin).toBeUndefined()
    expect(result.state).toBeUndefined()
    expect(result.reminderRevision).toBeUndefined()
    expect(source.estimateMin).toBe(-5)
    const note: InboxItem = { id: 'note', text: 'Wichtig', createdAt: at, status: 'kept', linkedTo: { kind: 'work', id: work.id } }
    expect(normaliseTask(note)).toEqual(note)
  })

  it('verliert bei beschädigtem neuem Timerdauerfeld keine alten Teiltitel oder Erledigungen', () => {
    const task = { ...work, subtasks: [{ id: 'alt', title: 'Erhalten', doneAt: at, timerMin: -1 }] }
    expect(normaliseTask(task).subtasks).toEqual([{ id: 'alt', title: 'Erhalten', doneAt: at }])
    expect(task.subtasks[0]?.timerMin).toBe(-1)
  })

  it('übernimmt nur gültige pausierte historische Uhren und startet keine beschädigten Daten', () => {
    const running = { id: 'focus', target: { kind: 'work' as const, id: work.id }, timer: createCountdown(1500, at) }
    const paused = { ...running, timer: pauseCountdown(running.timer, at + 60_000) }
    const broken = { ...running, timer: { status: 'running' } }
    const source = { focus: broken, focusHistory: [running, paused, broken], resume: { ...resume, at: Infinity }, captureDraft: { id: 'draft', text: 'Noch nicht speichern', updatedAt: at } }
    expect(validRecoveryLocal(source)).toBe(false)
    expect(recoveryFields(source)).toMatchObject({ focus: undefined, focusHistory: [paused], resume: undefined, captureDraft: source.captureDraft })
    expect(source.focusHistory).toHaveLength(3)
  })

  it('begrenzt importierte Dauerlerndaten auf bestätigte, gültige Angaben', () => {
    const sample = { id: 'sample', key: 'work:bericht', label: 'Bericht', minutes: 20, at, confirmed: true }
    expect(validRecoveryLocal({ taskLearning: { enabled: true, samples: [sample] } })).toBe(true)
    for (const change of [{ confirmed: false }, { minutes: 0 }, { minutes: Infinity }, { at: -1 }]) {
      expect(validRecoveryLocal({ taskLearning: { enabled: true, samples: [{ ...sample, ...change }] } })).toBe(false)
    }
  })
})

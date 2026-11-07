import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { makeBackup, parseBackup, selectBackupRecords } from '../core/export/backup'
import { createCountdown, remainingMs } from '../core/focus'
import { initialGame } from '../core/game'
import { resumeRoute } from '../core/recovery'
import { recordForSync } from '../core/syncPrivacy'
import { validTaskParts } from '../core/tasks'
import type { LocalData, TaskRef } from '../core/types'
import { MemoryRepository } from '../data/memory'
import type { Rec, Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-02'
const at = Date.parse(`${date}T10:00:00+01:00`)
const app = () => useApp.getState()

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at)
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal(), days: {}, inbox: [], game: initialGame(date) })
  await app().load()
  await app().setGame((game) => game)
})
afterEach(() => vi.useRealTimers())

async function task(kind: TaskRef['kind'] = 'task'): Promise<TaskRef> {
  const id = kind === 'work' ? (await app().addWorkTask('Privater Kundentitel'))! : (await app().addInbox('Unterlagen'))!
  if (kind === 'task') await app().updateInbox(id, { status: 'task', taskDate: date })
  const ref = { kind, id }
  await app().replaceTaskParts(ref, [{ id: 'a', title: 'Öffnen', estimateMin: 2 }, { id: 'b', title: 'Prüfen', estimateMin: 3 }])
  return ref
}

describe('Teilschritttimer im bestehenden Fokusmodell', () => {
  it('öffnet und schätzt ohne Start; bewusstes freies Zeitfenster bleibt über Pause und drei Tage exakt erhalten', async () => {
    const ref = await task()
    await app().load()
    expect(app().local.focus).toBeUndefined()
    const game = structuredClone(app().game)
    await app().startTaskFocus(ref, 7.5, 'b')
    const id = app().local.focus!.id
    expect(app().local.focus?.target).toEqual({ ...ref, partId: 'b' })
    expect(app().inbox[0]?.subtasks?.[1]).toMatchObject({ estimateMin: 3, timerMin: 7.5 })
    vi.setSystemTime(at + 90_450)
    await app().pauseTaskFocus(ref, 'Prüfen', 'Zweite Seite')
    expect(app().inbox[0]?.nextStep).toBeUndefined()
    expect(app().local.resume).toMatchObject({ partId: 'b', nextStep: 'Prüfen', note: 'Zweite Seite' })
    expect(resumeRoute(app().local.resume!)).toContain('?teil=b')
    vi.setSystemTime(at + 3 * 86400_000)
    await app().load()
    expect(remainingMs(app().local.focus!.timer, Date.now())).toBe(359_550)
    await app().startTaskFocus(ref, undefined, 'b')
    expect(app().local.focus?.id).toBe(id)
    vi.setSystemTime(Date.now() + 550)
    expect(remainingMs(app().local.focus!.timer, Date.now())).toBe(359_000)
    expect(app().local.workSessions).toEqual([])
    expect(app().game).toEqual(game)
  })

  it('archiviert Elternfokus und verschiedene Teile einzeln und erhält sie bei Umbenennen sowie Sortieren', async () => {
    const ref = await task('work')
    await app().startTaskFocus(ref)
    const parent = app().local.focus!.id
    vi.setSystemTime(at + 60_000)
    await app().startTaskFocus(ref, 7, 'a')
    const a = app().local.focus!.id
    vi.setSystemTime(at + 120_000)
    await app().startTaskFocus(ref, 9, 'b')
    const b = app().local.focus!.id
    await app().replaceTaskParts(ref, [{ ...app().local.work[0]!.subtasks![1]!, title: 'Neuer Titel' }, app().local.work[0]!.subtasks![0]!])
    await app().load()
    expect(app().local.focus?.id).toBe(b)
    expect(app().local.focusHistory).toHaveLength(2)
    await app().startTaskFocus(ref, undefined, 'a')
    expect(app().local.focus?.id).toBe(a)
    expect(remainingMs(app().local.focus!.timer, Date.now())).toBe(6 * 60_000)
    await app().startTaskFocus(ref)
    expect(app().local.focus?.id).toBe(parent)
    expect(remainingMs(app().local.focus!.timer, Date.now())).toBe(24 * 60_000)
  })

  it('beendet durch Ablauf weder Teil noch Aufgabe und bucht keine Arbeit, Lernzeit oder XP', async () => {
    const ref = await task('work')
    await app().setTaskLearning(true)
    const game = structuredClone(app().game)
    await app().startTaskFocus(ref, 1, 'a')
    const id = app().local.focus!.id
    vi.setSystemTime(at + 86_400_000)
    await app().load()
    expect(remainingMs(app().local.focus!.timer, Date.now())).toBe(0)
    expect(app().local.work[0]?.done).not.toBe(true)
    expect(app().local.work[0]?.subtasks?.[0]?.doneAt).toBeUndefined()
    expect(app().local.workSessions).toEqual([])
    expect(app().local.taskLearning?.samples).toEqual([])
    expect(app().game).toEqual(game)
    await app().startTaskFocus(ref, 4.25, 'a')
    expect(app().local.focus?.id).not.toBe(id)
    expect(app().local.focus?.timer.durationMs).toBe(255_000)
  })

  it('verwirft erledigte oder entfernte Teile samt Archiv, ohne verbleibende Teile oder die Elternaufgabe zu erledigen', async () => {
    const ref = await task()
    await app().startTaskFocus(ref, 7, 'a')
    await app().startTaskFocus(ref, 8, 'b')
    await app().pauseTaskFocus(ref)
    await app().setTaskPartDone(ref, 'a', true)
    expect(app().local.focusHistory).toEqual([])
    const b = app().local.focus!.id
    await app().replaceTaskParts(ref, [{ id: 'c', title: 'Noch offen' }])
    expect(app().local.focus).toBeUndefined()
    expect(app().local.resume).toBeUndefined()
    expect(app().inbox[0]?.subtasks).toEqual([{ id: 'c', title: 'Noch offen' }, { id: 'a', title: 'Öffnen', estimateMin: 2, timerMin: 7, doneAt: at }])
    expect(app().inbox[0]?.done).not.toBe(true)
    await app().startTaskFocus(ref)
    const current = app().local.focus!.id
    await app().updateFocus(b, (focus) => ({ ...focus, timer: createCountdown(999, Date.now()) }))
    await app().startTaskFocus(ref, 3, 'b')
    await app().startTaskFocus(ref, 3, 'a')
    expect(app().local.focus?.id).toBe(current)
  })

  it('hält Altaufrufe bei 25 Minuten und beseitigt alle Teiluhren bei bewusstem Elternabschluss', async () => {
    const ref = await task()
    await app().startTaskFocus(ref, undefined, 'a')
    expect(app().local.focus?.timer.durationMs).toBe(120_000)
    await app().startTaskFocus(ref)
    expect(app().local.focus?.target).toEqual(ref)
    expect(app().local.focus?.timer.durationMs).toBe(1_500_000)
    await app().startTaskFocus(ref, undefined, 'b')
    await app().pauseTaskFocus(ref)
    await app().completeTask(ref, true)
    expect(app().local.focus).toBeUndefined()
    expect(app().local.focusHistory).toEqual([])
    expect(app().local.resume).toBeUndefined()
    const doneAt = app().inbox[0]?.doneAt
    await app().completeTask(ref, false)
    await app().load()
    expect(app().local.focus).toBeUndefined()
    expect(doneAt).toBe(at)
    expect(app().inbox[0]?.done).toBe(false)
  })

  it('lässt eine verspätete Teilschrittpause keinen inzwischen anderen Fokus oder Wiedereinstieg ändern', async () => {
    const ref = await task()
    await app().startTaskFocus(ref, 7, 'a')
    await app().startTaskFocus(ref, 8, 'b')
    const before = structuredClone({ focus: app().local.focus, task: app().inbox[0], resume: app().local.resume })
    await app().pauseTaskFocus(ref, 'Veraltet', 'Alte Notiz', 'a')
    expect({ focus: app().local.focus, task: app().inbox[0], resume: app().local.resume }).toEqual(before)
    await app().pauseTaskFocus(ref, undefined, 'Aktuelle Notiz', 'b')
    expect(app().local.focus?.timer.status).toBe('paused')
    expect(app().local.resume).toMatchObject({ partId: 'b', note: 'Aktuelle Notiz' })
  })

  it('erhält durch Transfer ins lokale Arbeitsmodell aktive und archivierte Teile sowie den Wiedereinstieg', async () => {
    const ref = await task()
    await app().startTaskFocus(ref, 7, 'a')
    await app().startTaskFocus(ref, 8, 'b')
    await app().pauseTaskFocus(ref)
    const id = app().local.focus!.id
    await app().moveInboxToWork(ref.id)
    expect(app().local.focus).toMatchObject({ id, target: { kind: 'work', id: ref.id, partId: 'b' } })
    expect(app().local.focusHistory?.[0]?.target).toEqual({ kind: 'work', id: ref.id, partId: 'a' })
    expect(app().local.resume).toMatchObject({ kind: 'work', partId: 'b' })
    expect(resumeRoute(app().local.resume!)).toContain('?teil=b')
    await app().removeTask({ kind: 'work', id: ref.id })
    expect(app().local.focus).toBeUndefined()
    expect(app().local.focusHistory).toEqual([])
    expect(app().local.resume).toBeUndefined()
  })

  it('bereinigt auch durch eine alte Aufgabenliste verschwundene Teilreferenzen im selben Importcommit dauerhaft', async () => {
    const ref = await task()
    await app().startTaskFocus(ref, 7, 'a')
    await app().startTaskFocus(ref, 8, 'b')
    await app().pauseTaskFocus(ref)
    const original = structuredClone(app().inbox[0]!)
    const incoming = (data: unknown, time: number): Rec => ({ collection: 'inbox', id: ref.id, data, updated_at: time, deleted: false })
    const merge = vi.spyOn(storage.repo!, 'merge')
    await app().mergeRecords([incoming({ ...original, subtasks: undefined }, at + 1000)])
    expect(merge).toHaveBeenCalledTimes(1)
    expect(merge.mock.calls[0]![0].map((r) => r.collection).sort()).toEqual(['inbox', 'meta'])
    const saved = (await storage.repo!.get<LocalData>('meta', 'local'))!
    expect(saved.focus).toBeUndefined()
    expect(saved.focusHistory).toEqual([])
    expect(saved.resume).toBeUndefined()
    await app().mergeRecords([incoming(original, at + 2000)])
    await app().load()
    expect(app().local.focus).toBeUndefined()
    expect(app().local.focusHistory).toEqual([])
  })

  it('entfernt beim Laden eines älteren lokalen Stands nur unbrauchbare Teilmerker dauerhaft', async () => {
    const ref = await task('work')
    await app().startTaskFocus(ref, 7, 'a')
    await app().pauseTaskFocus(ref)
    const local = structuredClone(app().local)
    local.work[0]!.subtasks = []
    await storage.repo!.put('meta', 'local', local)
    await app().load()
    expect(app().local.focus).toBeUndefined()
    expect((await storage.repo!.get<LocalData>('meta', 'local'))?.focus).toBeUndefined()
    await app().replaceTaskParts(ref, [{ id: 'a', title: 'Wieder vorhandener alter Teil' }])
    await app().load()
    expect(app().local.focus).toBeUndefined()
  })

  it('ersetzt alte explizite Elternfokussitzungen vollständig und erbt keine partId oder Startzeit', async () => {
    const ref = await task('work')
    await app().startTaskFocus(ref, 7, 'a')
    await app().pauseTaskFocus(ref)
    await app().saveCaptureDraft('Neuer Entwurf', app().local.resume)
    const oldStart = at - 4 * 60_000
    const timer = createCountdown(25 * 60, oldStart)
    const old = { focus: { id: 'alter-elternfokus', target: ref, timer }, resume: { kind: ref.kind, refId: ref.id, title: 'Alt', at: oldStart }, captureDraft: { id: 'alt', text: 'Alter Entwurf', updatedAt: oldStart } }
    await app().importRecords([{ collection: 'meta', id: 'local', data: old, updated_at: at + 1000, deleted: false }])
    expect(app().local.focus).toEqual(old.focus)
    expect(remainingMs(app().local.focus!.timer, Date.now())).toBe(21 * 60_000)
    expect(app().local.resume?.partId).toBeUndefined()
    expect(app().local.captureDraft).toEqual(old.captureDraft)
    expect(app().local.work).toHaveLength(1)
  })

  it('rollt ungültige Dauer und fehlgeschlagenen Start oder Import ohne halben Fokus zurück', async () => {
    const ref = await task()
    for (const minutes of [0, -1, NaN, Infinity, 1441]) await expect(app().startTaskFocus(ref, minutes, 'a')).rejects.toThrow('Dauer')
    expect(app().local.focus).toBeUndefined()
    const before = structuredClone(app().inbox)
    vi.spyOn(storage.repo!, 'putMany').mockRejectedValueOnce(new Error('Speicher voll'))
    await expect(app().startTaskFocus(ref, 7, 'a')).rejects.toThrow('Speicher voll')
    expect(app().inbox).toEqual(before)
    expect(app().local.focus).toBeUndefined()
    await app().startTaskFocus(ref, 7, 'a')
    const focus = structuredClone(app().local.focus)
    vi.spyOn(storage.repo!, 'merge').mockRejectedValueOnce(new Error('Importfehler'))
    await expect(app().mergeRecords([{ collection: 'inbox', id: ref.id, data: { ...app().inbox[0], subtasks: [] }, updated_at: at + 1000, deleted: false }])).rejects.toThrow('Importfehler')
    expect(app().local.focus).toEqual(focus)
    expect((await storage.repo!.get<LocalData>('meta', 'local'))?.focus).toEqual(focus)
  })

  it('liest Altbackup und optionalen Timerwert additiv und hält Arbeitsanteile aus Sync und Teilsicherung fern', async () => {
    const ref = await task('work')
    await app().startTaskFocus(ref, 7, 'a')
    await app().startTaskFocus(ref, 8, 'b')
    await app().pauseTaskFocus(ref)
    await app().saveCaptureDraft('Privater Arbeitsentwurf', app().local.resume)
    const records = await storage.repo!.all()
    const backup = parseBackup(JSON.stringify(makeBackup(records)))
    expect(backup.find((r) => r.collection === 'meta')?.data).toMatchObject({ focus: { target: { partId: 'b' } }, work: [{ subtasks: [{ timerMin: 7 }, { timerMin: 8 }] }] })
    const safe = selectBackupRecords(records, { work: false })
    const encoded = JSON.stringify(safe)
    expect(encoded).not.toContain('Privater Kundentitel')
    expect(encoded).not.toContain('Privater Arbeitsentwurf')
    expect(safe.find((r) => r.collection === 'meta')?.data).not.toHaveProperty('focus')
    const synced = JSON.stringify(records.map(recordForSync).filter(Boolean))
    expect(synced).not.toContain('Privater Kundentitel')
    expect(synced).not.toContain('Privater Arbeitsentwurf')
    expect(synced).not.toContain('partId')
    expect(validTaskParts([{ id: 'alt', title: 'Früherer Schritt', estimateMin: 2, doneAt: at }])).toBe(true)
    expect(validTaskParts([{ id: 'neu', title: 'Neu', timerMin: 2.5 }])).toBe(true)
    expect(validTaskParts([{ id: 'neu', title: 'Neu', timerMin: 0 }])).toBe(false)
    for (const data of [{ focus: { id: 'kaputt', target: { ...ref, partId: 1 }, timer: createCountdown(60, at) } }, { work: [{ id: ref.id, title: 'Arbeitsaufgabe', createdAt: at, subtasks: [{ id: 'a', title: 'Alt', timerMin: -1 }] }] }]) {
      expect(() => parseBackup(JSON.stringify(makeBackup([{ collection: 'meta', id: 'local', data, updated_at: at, deleted: false }])))).toThrow('Fokus-')
    }
  })
})

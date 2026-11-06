import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { makeBackup, parseBackup } from '../core/export/backup'
import { remainingMs } from '../core/focus'
import { initialGame } from '../core/game'
import { usableResume } from '../core/recovery'
import { buildReminders } from '../core/reminders/build'
import { zonedToUtc } from '../core/time'
import type { TaskRef } from '../core/types'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { planFor, useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-02'
const at = zonedToUtc(date, 10 * 60)
const app = () => useApp.getState()

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at)
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal(), days: {}, inbox: [], game: initialGame(date) })
  await app().load()
})
afterEach(() => vi.useRealTimers())

async function task(title = 'Die Unterlage öffnen'): Promise<TaskRef> {
  const id = (await app().addInbox(title))!
  await app().updateInbox(id, { status: 'task', taskDate: date })
  return { kind: 'task', id }
}
async function work(title = 'Bericht'): Promise<TaskRef> { return { kind: 'work', id: (await app().addWorkTask(title))! } }

describe('Eine gemeinsame dauerhafte Aufgabenhandlung', () => {
  it('speichert privaten Start und Fokus atomar, ohne Arbeitszeit oder XP zu buchen', async () => {
    const ref = await task()
    const write = vi.spyOn(storage.repo!, 'putMany')
    const game = structuredClone(app().game)
    await app().startTaskFocus(ref, 25)
    expect(write).toHaveBeenCalledTimes(1)
    expect(write.mock.calls[0]![0].map((record) => record.collection).sort()).toEqual(['inbox', 'meta'])
    await app().load()
    expect(app().inbox[0]).toMatchObject({ id: ref.id, state: 'active' })
    expect(app().local.focus?.target).toEqual(ref)
    expect(app().local.workSessions).toEqual([])
    expect(app().game).toEqual(game)
  })

  it('erhält Pause und konkreten Wiedereinstieg über drei Tage und nimmt dieselbe Uhr wieder auf', async () => {
    const ref = await work()
    await app().startTaskFocus(ref, 25)
    const id = app().local.focus!.id
    vi.setSystemTime(at + 5 * 60_000)
    await app().pauseTaskFocus(ref, 'Tabelle öffnen', 'Die zweite Zeile ansehen')
    vi.setSystemTime(at + 3 * 86400_000)
    await app().load()
    expect(remainingMs(app().local.focus!.timer, Date.now())).toBe(20 * 60_000)
    expect(usableResume(app().local.resume, app().inbox, app().local.work)).toMatchObject({ nextStep: 'Tabelle öffnen', note: 'Die zweite Zeile ansehen' })
    await app().startTaskFocus(ref)
    expect(app().local.focus?.id).toBe(id)
    expect(remainingMs(app().local.focus!.timer, Date.now())).toBe(20 * 60_000)
    expect(app().local.resume?.note).toBe('Die zweite Zeile ansehen')
  })

  it('wechselt bewusst zwischen Aufgaben, ohne pausierte Uhren zurückzusetzen', async () => {
    const a = await work('A'); const b = await work('B')
    await app().startTaskFocus(a, 25)
    vi.setSystemTime(at + 4 * 60_000)
    const old = app().local.focus!.id
    await app().pauseTaskFocus(a, 'Bei A weiter', 'Notiz zu A')
    await app().startTaskFocus(b, 15)
    vi.setSystemTime(at + 40 * 60_000)
    await app().pauseTaskFocus(b, 'Bei B weiter', 'Notiz zu B')
    await app().startTaskFocus(a)
    expect(app().local.focus?.id).toBe(old)
    expect(remainingMs(app().local.focus!.timer, Date.now())).toBe(21 * 60_000)
    expect(app().local.work.find((item) => item.id === b.id)?.state).toBe('paused')
    expect(app().local.work.find((item) => item.id === a.id)?.resumeNote).toBe('Notiz zu A')
    expect(app().local.work.find((item) => item.id === b.id)?.resumeNote).toBe('Notiz zu B')
    await app().pauseTaskFocus(a)
    expect(app().local.resume?.note).toBe('Notiz zu A')
    await app().pauseTaskFocus(a, undefined, '')
    expect(app().local.work.find((item) => item.id === a.id)?.resumeNote).toBeUndefined()
    expect(app().local.resume?.note).toBeUndefined()
    expect(app().local.focusHistory?.some((focus) => focus.target.kind === 'work' && focus.target.id === b.id)).toBe(true)
  })

  it('bedeutet Ablauf keinen Abschluss; nur ein bewusstes neues Zeitfenster ersetzt die abgelaufene Uhr', async () => {
    const ref = await task()
    await app().startTaskFocus(ref, 15)
    const previous = app().local.focus!.id
    vi.setSystemTime(at + 30 * 60_000)
    await app().load()
    expect(app().inbox[0]?.done).not.toBe(true)
    expect(remainingMs(app().local.focus!.timer, Date.now())).toBe(0)
    await app().startTaskFocus(ref, 40)
    expect(app().local.focus?.id).not.toBe(previous)
    expect(remainingMs(app().local.focus!.timer, Date.now())).toBe(40 * 60_000)
  })

  it('erzeugt bei Doppeltap genau eine künftige Wiederholungsinstanz und bewahrt die Abschlusszeit', async () => {
    const ref = await task()
    await app().updateTask(ref, { recurrence: { seriesId: ref.id, everyDays: 1, occurrenceDate: '2026-10-29' } })
    await Promise.all([app().completeTask(ref, true), app().completeTask(ref, true)])
    vi.setSystemTime(at + 10_000)
    await app().completeTask(ref, true)
    expect(app().inbox).toHaveLength(2)
    expect(app().inbox.find((item) => item.id === ref.id)?.doneAt).toBe(at)
    expect(app().inbox.find((item) => item.id !== ref.id)).toMatchObject({ taskDate: '2026-11-03', done: false, recurrence: { occurrenceDate: '2026-11-03' } })
    await app().completeTask(ref, false)
    await app().completeTask(ref, true)
    expect(app().inbox).toHaveLength(2)
  })

  it('bestätigt einen Teilschritt, ohne den Eltern-Task zu erledigen oder beim Detailwechsel Fortschritt zu löschen', async () => {
    const ref = await task()
    await app().replaceTaskParts(ref, [{ id: 'a', title: 'Öffnen' }, { id: 'b', title: 'Prüfen' }])
    await app().setTaskPartDone(ref, 'a', true)
    await app().replaceTaskParts(ref, [{ id: 'b', title: 'Prüfen' }, { id: 'c', title: 'Weiter' }])
    await app().load()
    expect(app().inbox[0]?.state).toBe('partial')
    expect(app().inbox[0]?.done).not.toBe(true)
    expect(app().inbox[0]?.subtasks?.find((part) => part.id === 'a')).toMatchObject({ title: 'Öffnen', doneAt: at })
  })

  it('unterscheidet verschoben, nicht nötig und abgesagt von echter Erledigung', async () => {
    const ref = await task()
    for (const state of ['deferred', 'not-needed', 'cancelled'] as const) {
      await app().setTaskState(ref, state)
      expect(app().inbox[0]?.done).not.toBe(true)
      expect(app().inbox[0]?.doneAt).toBeUndefined()
    }
    await app().setTaskState(ref, 'pending')
    await app().completeTask(ref, true, true)
    expect(app().inbox[0]).toMatchObject({ done: true, doneMode: 'minimal' })
  })

  it('transferiert Inbox nach Arbeit atomar/idempotent und lässt keinen Gedankeninhalt im Sync-Tombstone', async () => {
    const id = (await app().addInbox('Vertrauliche Arbeitsunterlage'))!
    await Promise.all([app().moveInboxToWork(id), app().moveInboxToWork(id)])
    expect(app().inbox).toEqual([])
    expect(app().local.work).toHaveLength(1)
    const tombstone = (await storage.repo!.all()).find((record) => record.collection === 'inbox' && record.id === id)
    expect(tombstone).toMatchObject({ deleted: true, data: null })
    await app().load()
    expect(app().local.work[0]?.title).toBe('Vertrauliche Arbeitsunterlage')
  })

  it('lässt bei Transaktionsfehler weder halben Transfer noch falschen RAM-Erfolg zurück', async () => {
    const id = (await app().addInbox('Nicht verlieren'))!
    vi.spyOn(storage.repo!, 'putMany').mockRejectedValueOnce(new Error('Speicher voll'))
    await expect(app().moveInboxToWork(id)).rejects.toThrow('Speicher voll')
    expect(app().inbox).toHaveLength(1)
    expect(app().local.work).toHaveLength(0)
    expect(await storage.repo!.get('inbox', id)).toMatchObject({ text: 'Nicht verlieren' })
    await app().moveInboxToWork(id)
    expect(app().local.work).toHaveLength(1)
  })

  it('bewahrt bei einer erneut importierten Herkunft beide Texte statt die neue Notiz still zu löschen', async () => {
    const id = (await app().addInbox('Originaltext'))!
    const original = { ...app().inbox[0]! }
    await app().moveInboxToWork(id)
    const restored = { ...original, text: 'Nach dem Backup ergänzter Gedanke', description: 'Neue Einzelheit', subtasks: [{ id: 'extra', title: 'Erhalten' }] }
    await app().mergeRecords([{ collection: 'inbox', id, data: restored, updated_at: at + 1000, deleted: false }], true)
    await expect(app().moveInboxToWork(id)).rejects.toThrow('Dein Gedanke bleibt erhalten')
    await app().load()
    expect(app().inbox[0]).toMatchObject(restored)
    expect(app().local.work).toHaveLength(1)
    expect(app().local.work[0]?.title).toBe('Originaltext')
  })

  it('bereinigt gelöschte Referenzen, erhält aber verknüpfte Notizen und ihre Texte', async () => {
    const ref = await work()
    const note = (await app().addInbox('Dazugehörige Notiz'))!
    await app().linkInbox(note, ref)
    await app().startTaskFocus(ref)
    await app().pauseTaskFocus(ref, 'Datei öffnen')
    await app().removeTask(ref)
    expect(app().local.resume).toBeUndefined()
    expect(app().local.focus).toBeUndefined()
    expect(app().inbox[0]).toMatchObject({ text: 'Dazugehörige Notiz', status: 'kept' })
    expect(app().inbox[0]?.linkedTo).toBeUndefined()
  })

  it('lässt verspätete Fokus-Callbacks keine neuere Sitzung überschreiben', async () => {
    const a = await work('A'); const b = await work('B')
    await app().startTaskFocus(a)
    const old = app().local.focus!.id
    await app().startTaskFocus(b)
    const current = app().local.focus!.id
    const fn = vi.fn((focus) => focus)
    await app().updateFocus(old, fn)
    await app().clearFocus(old)
    expect(fn).not.toHaveBeenCalled()
    expect(app().local.focus?.id).toBe(current)
  })

  it('bewahrt Capture-Entwurf und Fokus, speichert Note plus Entwurfsende zusammen und hält Arbeitskontext lokal', async () => {
    const ref = await work('Kundenname bleibt lokal')
    await app().startTaskFocus(ref)
    const focus = structuredClone(app().local.focus)
    await app().saveCaptureDraft('Eine Idee', { kind: 'work', refId: ref.id, title: 'Kundenname bleibt lokal', at })
    await app().load()
    expect(app().local.captureDraft?.text).toBe('Eine Idee')
    const id = (await app().addInbox('Eine Idee', 'Kundenname bleibt lokal'))!
    expect(app().inbox.find((item) => item.id === id)).toMatchObject({ status: 'open', captureContext: 'Arbeit' })
    expect(app().local.captureDraft).toBeUndefined()
    expect(app().local.focus).toEqual(focus)
  })

  it('lernt nur aus ausdrücklich bestätigten Dauern, bleibt beim Doppeltap einmalig und lässt sich löschen', async () => {
    const a = await work('Dauer')
    await app().completeTask(a, true, false, 20)
    expect(app().local.taskLearning).toBeUndefined()
    const b = await work('Dauer')
    await app().setTaskLearning(true)
    await Promise.all([app().completeTask(b, true, false, 25), app().completeTask(b, true, false, 25)])
    expect(app().local.taskLearning?.samples).toHaveLength(1)
    await app().completeTask(b, false)
    expect(app().local.taskLearning?.samples).toHaveLength(0)
    await app().completeTask(b, true, false, 25)
    expect(app().local.taskLearning?.samples).toHaveLength(1)
    await app().clearTaskLearning()
    expect(app().local.taskLearning).toEqual({ enabled: false, samples: [] })
  })

  it('prüft gleichzeitige Belohnungen nach der vorherigen Buchung und überzieht kein Guthaben', async () => {
    await app().saveSettings((settings) => ({ ...settings, rewards: [{ id: 'reward', title: 'Eine Pause', price: 80 }] }))
    await app().setGame((game) => ({ ...game, xp: 100, spent: 0 }))
    const firstWrite = storage.repo!.put.bind(storage.repo!)
    let release!: () => void
    const held = new Promise<void>((resolve) => { release = resolve })
    vi.spyOn(storage.repo!, 'put').mockImplementationOnce(async (...args) => { await held; await firstWrite(...args) })
    const saving = app().saveLocal((local) => ({ ...local, taskContext: 'home' }))
    const redemptions = Promise.all([app().redeem('reward'), app().redeem('reward')])
    release()
    await saving
    expect(await redemptions).toEqual([true, false])
    expect(app().game.spent).toBe(80)
    expect(app().game.redeemed).toHaveLength(1)
    await app().load()
    expect(app().game.spent).toBe(80)
  })

  it('wendet eine lokale Detailänderung nach einem Import auf den bereits übernommenen Task an', async () => {
    const ref = await task('Alter Titel')
    const incoming = { ...app().inbox[0]!, text: 'Übernommener Titel', subtasks: [{ id: 'import-part', title: 'Erhaltener Schritt', doneAt: at }] }
    await app().mergeRecords([{ collection: 'inbox', id: ref.id, data: incoming, updated_at: at + 1000, deleted: false }])
    await app().updateTask(ref, { estimateMin: 10 })
    expect(app().inbox[0]).toMatchObject({ text: incoming.text, estimateMin: 10, subtasks: incoming.subtasks })
    await app().load()
    expect(app().inbox[0]).toMatchObject({ text: incoming.text, estimateMin: 10, subtasks: incoming.subtasks })
  })

  it('lässt gewöhnliche UI-Änderungen nach einem wartenden Aufgabenstart dessen Fokuszustand erhalten', async () => {
    const ref = await task()
    const original = storage.repo!.putMany.bind(storage.repo!)
    let release!: () => void
    let reached!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    const began = new Promise<void>((resolve) => { reached = resolve })
    vi.spyOn(storage.repo!, 'putMany').mockImplementationOnce(async (records) => { reached(); await pending; await original(records) })
    const starting = app().startTaskFocus(ref)
    await began
    const context = app().saveLocal((local) => ({ ...local, taskContext: 'home' }))
    const report = app().saveDeviceTests((tests) => ({ ...tests, device: 'Galaxy S26 Ultra' }))
    expect(app().local.focus).toBeUndefined()
    release()
    await Promise.all([starting, context, report])
    await app().load()
    expect(app().local).toMatchObject({ taskContext: 'home', focus: { target: ref }, deviceTests: { device: 'Galaxy S26 Ultra' } })
    expect(app().inbox[0]?.state).toBe('active')
  })

  it('erhält den RAM-Altstand auch bei mutierendem Callback und fehlgeschlagenem Speichern', async () => {
    vi.spyOn(storage.repo!, 'put').mockRejectedValueOnce(new Error('Speicher voll'))
    await expect(app().saveLocal((local) => { local.work.push({ id: 'nicht-gespeichert', title: 'Nicht verlieren', createdAt: at }); return local })).rejects.toThrow('Speicher voll')
    expect(app().local.work).toEqual([])
  })

  it('übernimmt native Erledigung samt Wiederholung und Receipt atomar, ohne einen alten Knopf nach Rücknahme zu akzeptieren', async () => {
    const ref = await work('Vertraulicher Titel')
    await app().updateTask(ref, { deadline: zonedToUtc(date, 15 * 60), recurrence: { seriesId: ref.id, everyDays: 1, occurrenceDate: date } })
    await app().startTaskFocus(ref)
    await app().pauseTaskFocus(ref, 'Tabelle öffnen')
    const item = app().local.work[0]!
    const extras = { deadlines: [{ id: item.id, at: item.deadline!, reminderRevision: item.reminderRevision }] }
    const spec = buildReminders([planFor(date)], app().days, app().settings, zonedToUtc(date, 0), undefined, extras).find((event) => event.key === `deadline-hour:${ref.id}`)!
    expect(spec).toBeDefined()
    vi.setSystemTime(spec.at + 1000)
    const action = { id: 'native-task-action', action: 'done' as const, key: spec.key, date, at: spec.at, revision: spec.revision, token: spec.token }
    const writes = vi.spyOn(storage.repo!, 'putMany')
    expect(await app().applyReminderAction(action)).toBe('applied')
    expect(writes).toHaveBeenCalledTimes(1)
    expect(writes.mock.calls[0]![0]).toHaveLength(1)
    expect(app().local).toMatchObject({ reminderReceipts: [action.id] })
    expect(app().local.focus).toBeUndefined()
    expect(app().local.resume).toBeUndefined()
    expect(app().local.work).toHaveLength(2)
    expect(app().local.work[0]).toMatchObject({ done: true, doneAt: spec.at })
    expect(app().local.work[1]).toMatchObject({ done: false, recurrence: { occurrenceDate: '2026-11-03' } })
    await app().completeTask(ref, false)
    expect(await app().applyReminderAction({ ...action, id: 'delayed-copy' })).toBe('obsolete')
    await app().load()
    expect(app().local.work[0]?.done).toBe(false)
    expect(app().local.work).toHaveLength(2)
  })

  it('erhält neue optionale Daten im Backup und weist beschädigte Fokus-/Taskfelder vor einem Import ab', async () => {
    const ref = await task()
    await app().startTaskFocus(ref)
    const backup = parseBackup(JSON.stringify(makeBackup(await storage.repo!.all())))
    expect(backup.find((record) => record.collection === 'meta')?.data).toMatchObject({ focus: { target: ref } })
    const bad = (data: unknown, collection: 'inbox' | 'meta' = 'meta') => JSON.stringify(makeBackup([{ collection, id: collection === 'meta' ? 'local' : 'broken', updated_at: 1, deleted: false, data }]))
    for (const data of [{ resume: { kind: 'work', title: 'x', at, nextStep: 7 } }, { focus: { id: 'broken', target: ref, timer: { status: 'running' } } }, { taskLearning: { enabled: true, samples: [{ minutes: 10, confirmed: false }] } }]) expect(() => parseBackup(bad(data))).toThrow('Aufgaben-')
    expect(() => parseBackup(bad({ id: 'broken', text: 'x', state: 'automatisch-erledigt' }, 'inbox'))).toThrow('Aufgabenangaben')
  })
})

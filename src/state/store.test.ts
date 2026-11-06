import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { makeBackup, parseBackup } from '../core/export/backup'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { buildReminders } from '../core/reminders/build'
import { zonedToUtc } from '../core/time'
import { planFor, useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(async () => {
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings('2026-11-02'), local: emptyLocal(), workUndo: undefined })
  await useApp.getState().load()
})

describe('Dauerhafte Erinnerungsaktionen', () => {
  const date = '2026-11-02'
  afterEach(() => vi.useRealTimers())

  function actionFor(key: string, id = 'action-one') {
    const st = useApp.getState()
    const extras = { deadlines: st.local.work.filter((w) => w.deadline && !w.done).map((w) => ({ id: w.id, at: w.deadline!, reminderRevision: w.reminderRevision })) }
    const event = buildReminders([planFor(date)], st.days, st.settings, zonedToUtc(date, 0), undefined, extras).find((e) => e.key === key)!
    expect(event).toBeDefined()
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(event.at + 1000)
    return { id, action: 'done' as const, key, date, at: event.at, revision: event.revision, token: event.token }
  }

  it('verarbeitet Doppeltippen einmal und erhält Zeit, Receipt und XP nach erneutem Laden', async () => {
    const a = actionFor('bed')
    const put = vi.spyOn(storage.repo!, 'putMany')
    expect(await Promise.all([useApp.getState().applyReminderAction(a), useApp.getState().applyReminderAction(a)])).toEqual(['applied', 'duplicate'])
    expect(put).toHaveBeenCalledTimes(1)
    const xp = useApp.getState().game.xp
    expect(xp).toBeGreaterThan(0)
    expect(useApp.getState().days[date]?.bedAt).toBe(a.at)
    await useApp.getState().load()
    expect(await useApp.getState().applyReminderAction({ ...a, at: a.at + 1 })).toBe('duplicate')
    expect(useApp.getState().days[date]?.bedAt).toBe(a.at)
    expect(useApp.getState().game.xp).toBe(xp)
    expect(useApp.getState().days[date]?.reminderReceipts).toEqual([a.id])
  })

  it('ignoriert den alten Button nach einer geänderten Uhrzeit', async () => {
    const a = actionFor('bed')
    await useApp.getState().saveSettings((s) => ({ ...s, bed: s.bed + 30 }))
    const before = structuredClone(useApp.getState().game)
    expect(await useApp.getState().applyReminderAction(a)).toBe('obsolete')
    expect(useApp.getState().days[date]?.bedAt).toBeUndefined()
    expect(useApp.getState().game).toEqual(before)
  })

  it('speichert Heute nicht als Ablehnung ohne falsche Erledigung oder XP', async () => {
    const a = { ...actionFor('evening'), action: 'skip' as const }
    const xp = useApp.getState().game.xp
    expect(await useApp.getState().applyReminderAction(a)).toBe('applied')
    expect(useApp.getState().days[date]?.dismissed).toContain('evening')
    expect(useApp.getState().days[date]?.eveningRoutineDoneAt).toBeUndefined()
    expect(useApp.getState().game.xp).toBe(xp)
  })

  it('erhält nach Transaktionsfehler die alten Daten und lässt eine gleichzeitige UI-Änderung erst danach durch', async () => {
    const a = actionFor('bed')
    const reached = deferred(); const release = deferred()
    const putMany = storage.repo!.putMany.bind(storage.repo!)
    let first = true
    vi.spyOn(storage.repo!, 'putMany').mockImplementation(async (records) => {
      if (first) { first = false; reached.resolve(); await release.promise; throw new Error('Disk full') }
      await putMany(records)
    })
    const xp = useApp.getState().game.xp
    const processing = useApp.getState().applyReminderAction(a)
    const rejected = expect(processing).rejects.toThrow('Disk full')
    await reached.promise
    const edit = useApp.getState().updateDay(date, (l) => ({ ...l, changes: ['Eigene Notiz'] }))
    expect(useApp.getState().days[date]?.bedAt).toBeUndefined()
    expect(useApp.getState().days[date]?.changes).toBeUndefined()
    release.resolve(); await rejected; await edit
    expect(useApp.getState().days[date]?.changes).toEqual(['Eigene Notiz'])
    expect(useApp.getState().days[date]?.bedAt).toBeUndefined()
    expect(useApp.getState().days[date]?.reminderReceipts).toBeUndefined()
    expect(useApp.getState().game.xp).toBe(xp)
    expect(await useApp.getState().applyReminderAction(a)).toBe('applied')
    expect(useApp.getState().days[date]?.bedAt).toBe(a.at)
    expect(useApp.getState().days[date]?.changes).toEqual(['Eigene Notiz'])
    expect(useApp.getState().game.xp).toBeGreaterThan(xp)
  })

  it('ordnet Deadline-Erledigt dem vorhandenen lokalen Arbeitseintrag zu', async () => {
    const deadline = zonedToUtc(date, 15 * 60)
    await useApp.getState().saveLocal((l) => ({ ...l, work: [{ id: 'w1', title: 'Privater Inhalt', createdAt: 1, deadline }, { id: 'w2', title: 'Bleibt offen', createdAt: 1 }] }))
    const a = actionFor('deadline-hour:w1')
    expect(await useApp.getState().applyReminderAction(a)).toBe('applied')
    expect(useApp.getState().local.work[0]).toMatchObject({ id: 'w1', done: true, doneAt: a.at })
    expect(useApp.getState().local.work[1]?.done).toBeUndefined()
    await useApp.getState().load()
    expect(await useApp.getState().applyReminderAction(a)).toBe('duplicate')
    expect(useApp.getState().local.reminderReceipts).toEqual([a.id])
  })

  it('vermerkt Losgehen nur für den zugehörigen unveränderten Termin', async () => {
    await useApp.getState().saveCommitment({ id: 'c1', date, label: 'Privater Termin', context: 'personal', commitment: 'hard', start: 12 * 60, placeLabel: 'Ein Ort', travelMin: 20, status: 'planned' })
    const a = actionFor('go:c1')
    const commitment = useApp.getState().local.commitments[0]!
    await useApp.getState().saveCommitment({ ...commitment, start: commitment.start + 60 })
    expect(await useApp.getState().applyReminderAction(a)).toBe('obsolete')
    expect(useApp.getState().local.commitments[0]?.leftAt).toBeUndefined()
    const current = actionFor('go:c1', 'new-action')
    expect(await useApp.getState().applyReminderAction(current)).toBe('applied')
    expect(useApp.getState().local.commitments[0]?.leftAt).toBe(current.at)
  })

  it('erhält Receipts in Backups und weist beschädigte Receiptfelder vor Import ab', async () => {
    const a = actionFor('bed')
    await useApp.getState().applyReminderAction(a)
    const backup = parseBackup(JSON.stringify(makeBackup(await storage.repo!.all())))
    expect(backup.find((r) => r.collection === 'days' && r.id === date)?.data).toMatchObject({ reminderReceipts: [a.id] })
    for (const collection of ['days', 'meta'] as const) {
      expect(() => parseBackup(JSON.stringify(makeBackup([{ collection, id: collection === 'meta' ? 'local' : date, data: { reminderReceipts: ['good', 5] }, updated_at: 1, deleted: false }])))).toThrow('Erinnerungsbestätigungen')
    }
  })
})

describe('Speichern und erneutes Laden', () => {
  it('behält gerade gestartete Arbeit, wenn ein Hintergrund-Laden noch einen alten Stand liest', async () => {
    const repo = storage.repo!
    const read = repo.get.bind(repo)
    const reached = deferred()
    const release = deferred()
    vi.spyOn(repo, 'get').mockImplementation(async (collection, id) => {
      const value = await read(collection, id)
      if (collection === 'meta' && id === 'local') {
        reached.resolve()
        await release.promise
      }
      return value
    })
    const reload = useApp.getState().load()
    await reached.promise
    await useApp.getState().workStart()
    release.resolve()
    await reload
    await useApp.getState().workStart() // Ein weiterer Tipp darf keine zweite Sitzung erzeugen.
    expect(useApp.getState().local.workSessions).toHaveLength(1)
    expect(await read('meta', 'local')).toEqual(useApp.getState().local)
  })

  it('zeigt nach gleichzeitiger lokaler Eingabe sowohl neue Sync-Daten als auch den eigenen Eintrag', async () => {
    const repo = storage.repo!
    await repo.merge([{
      collection: 'inbox', id: 'remote', updated_at: 1, deleted: false,
      data: { id: 'remote', text: 'Vom anderen Gerät', status: 'open', createdAt: 1 },
    }])
    const list = repo.list.bind(repo)
    const reached = deferred()
    const release = deferred()
    vi.spyOn(repo, 'list').mockImplementation(async (collection) => {
      const value = await list(collection)
      if (collection === 'inbox') {
        reached.resolve()
        await release.promise
      }
      return value
    })
    const reload = useApp.getState().load()
    await reached.promise
    await useApp.getState().addInbox('Mein neuer Gedanke')
    release.resolve()
    await reload
    expect(useApp.getState().inbox.map((item) => item.text).sort()).toEqual(['Mein neuer Gedanke', 'Vom anderen Gerät'])
  })

  it('wartet vor einem erneuten Laden auf bereits laufende Schreibvorgänge', async () => {
    const repo = storage.repo!
    const put = repo.put.bind(repo)
    const reached = deferred()
    const release = deferred()
    vi.spyOn(repo, 'put').mockImplementation(async (collection, id, data) => {
      if (collection === 'meta' && id === 'local') {
        reached.resolve()
        await release.promise
      }
      await put(collection, id, data)
    })
    const start = useApp.getState().workStart()
    await reached.promise
    let loaded = false
    const reload = useApp.getState().load().then(() => { loaded = true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(loaded).toBe(false)
    release.resolve()
    await Promise.all([start, reload])
    expect(useApp.getState().local.workSessions).toHaveLength(1)
  })

  it('schreibt Tagespunkte vor einer späteren Spieländerung und verliert keine Einlösung', async () => {
    const repo = storage.repo!
    const put = repo.putMany.bind(repo)
    const reached = deferred()
    const release = deferred()
    let first = true
    vi.spyOn(repo, 'putMany').mockImplementation(async (records) => {
      if (first) {
        first = false
        reached.resolve()
        await release.promise
      }
      await put(records)
    })
    const step = useApp.getState().setStep('2026-11-02', 'morning', 'water', 'done')
    await reached.promise
    const game = useApp.getState().setGame((current) => ({ ...current, spent: 10 }))
    release.resolve()
    await Promise.all([step, game])
    await useApp.getState().load()
    expect(useApp.getState().game.spent).toBe(10)
    expect(useApp.getState().game.xp).toBeGreaterThan(0)
  })

  it('speichert Start und Stopp in Eingabereihenfolge und startet bei Doppeltippen nur einmal', async () => {
    const repo = storage.repo!
    const put = repo.put.bind(repo)
    const reached = deferred()
    const release = deferred()
    let writes = 0
    vi.spyOn(repo, 'put').mockImplementation(async (collection, id, data) => {
      writes++
      if (writes === 1) {
        reached.resolve()
        await release.promise
      }
      await put(collection, id, data)
    })
    const start = useApp.getState().workStart({ at: 100 })
    await reached.promise
    const duplicate = useApp.getState().workStart({ at: 200 })
    const stop = useApp.getState().workStop(300)
    expect(writes).toBe(1)
    release.resolve()
    await Promise.all([start, duplicate, stop])
    await useApp.getState().load()
    expect(useApp.getState().local.workSessions).toHaveLength(1)
    expect(useApp.getState().local.workSessions[0]).toMatchObject({ startAt: 100, endAt: 300 })
  })
})

describe('Sicherungsimport', () => {
  it('ergänzt fehlende Einstellungen aus älteren Sicherungen und bleibt nach Neustart ladbar', async () => {
    const records = parseBackup(JSON.stringify(makeBackup([
      { collection: 'settings', id: 'main', data: { version: 1, onboarded: true }, updated_at: Date.now() + 1000, deleted: false },
    ])))
    expect(await useApp.getState().importRecords(records)).toBe(1)
    expect((await storage.repo!.dirty()).some((record) => record.collection === 'settings' && record.id === 'main')).toBe(true)
    await useApp.getState().load()
    const settings = useApp.getState().settings
    expect(settings.onboarded).toBe(true)
    expect(settings.anchor.wake).toBeTypeOf('number')
    expect(settings.work).toHaveLength(7)
  })

  it('weist beschädigte Einstellungen vor dem Schreiben ab und erhält vorhandene Daten', async () => {
    await useApp.getState().saveSettings((settings) => ({ ...settings, homeOfficeMessage: 'Mein gespeicherter Text' }))
    const before = await storage.repo!.all()
    const malformed = [
      {},
      { version: 1, onboarded: true, work: Array.from({ length: 7 }, () => ({})) },
      { version: 1, onboarded: true, routines: { morning: [{ id: 'water', title: 'Wasser' }] } },
    ]
    for (const data of malformed) {
      await expect(async () => {
        const records = parseBackup(JSON.stringify(makeBackup([
          { collection: 'settings', id: 'main', data, updated_at: Date.now() + 1000, deleted: false },
        ])))
        await useApp.getState().importRecords(records)
      }).rejects.toThrow('ungültige Einstellungen')
      expect(await storage.repo!.all()).toEqual(before)
    }
    await useApp.getState().load()
    expect(useApp.getState().settings.homeOfficeMessage).toBe('Mein gespeicherter Text')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { makeBackup, parseBackup } from '../core/export/backup'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { buildReminders } from '../core/reminders/build'
import { openSteps, routineCompleted, stepKey } from '../core/now'
import { nextAction } from '../core/support'
import { minutesOnPlanDay, zonedToUtc } from '../core/time'
import type { LocalData, Settings } from '../core/types'
import type { Rec } from '../data/types'
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

  it('revidiert den Vorbereitungsimpuls über die vorhandene Schrittaktion und entfernt ihn nach vollständiger Vorbereitung', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(zonedToUtc(date, 300))
    const current = () => buildReminders([planFor(date)], useApp.getState().days, useApp.getState().settings, Date.now()).find(e => e.key === 'prepare:work')
    const before = current()!
    expect(before).toBeDefined()
    const steps = openSteps(planFor(date), useApp.getState().days[date], 'morning')
    await useApp.getState().setStep(date, 'morning', steps[0]!.id, 'done')
    expect(current()!.revision).not.toBe(before.revision)
    expect(current()!.token).toBe(before.token)
    for (const step of steps.slice(1)) await useApp.getState().setStep(date, 'morning', step.id, 'not-needed')
    expect(current()).toBeUndefined()
    await useApp.getState().load()
    expect(current()).toBeUndefined()
    expect(useApp.getState().days[date]?.leftAt).toBeUndefined()
  })

  it.each(['done', 'skip'] as const)('weist selbst eine passende native %s-Aktion des actionlosen Impulses ohne Fakten, Receipt oder Punkte ab', async action => {
    const a = { ...actionFor('prepare:work'), action }
    const before = structuredClone({ days: useApp.getState().days, game: useApp.getState().game })
    expect(await useApp.getState().applyReminderAction(a)).toBe('obsolete')
    expect({ days: useApp.getState().days, game: useApp.getState().game }).toEqual(before)
  })

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
    // Der installierte Spielstand bleibt stabil; ein fehlender Datensatz würde beim
    // Laden einen neuen Kapitelstart aus dem inzwischen umgestellten Testdatum bilden.
    await storage.repo!.put('game', 'main', useApp.getState().game)
    const game = structuredClone(useApp.getState().game)
    const plan = planFor(date)
    const next = () => nextAction({ plan: planFor(date), log: useApp.getState().days[date], m: minutesOnPlanDay(date, a.at), nowMs: a.at, settings: useApp.getState().settings, inbox: [], work: [] }).action
    expect(next()).toMatchObject({ type: 'step', routine: 'evening' })
    expect(await useApp.getState().applyReminderAction(a)).toBe('applied')
    expect(useApp.getState().days[date]?.dismissed).toContain('evening')
    expect(useApp.getState().days[date]?.eveningRoutineDoneAt).toBeUndefined()
    expect(openSteps(plan, useApp.getState().days[date], 'evening')).toEqual([])
    expect(routineCompleted(plan, useApp.getState().days[date], 'evening')).toBe(false)
    expect(Object.values(useApp.getState().days[date]!.steps)).toEqual(plan.blocks.find((b) => b.routine === 'evening')!.steps!.map(() => 'not-needed'))
    expect(next().type).not.toBe('step')
    expect(useApp.getState().game).toEqual(game)
    await useApp.getState().load()
    expect(next().type).not.toBe('step')
    expect(useApp.getState().days[date]?.eveningRoutineDoneAt).toBeUndefined()
    expect(useApp.getState().game).toEqual(game)
    expect(await useApp.getState().applyReminderAction(a)).toBe('duplicate')
    expect(buildReminders([planFor(date)], useApp.getState().days, useApp.getState().settings, zonedToUtc(date, 0)).some((e) => e.key === 'evening')).toBe(false)
  })

  it('schließt mit Abend-Erledigt nur offene geplante Schritte und erhält frühere Entscheidungen', async () => {
    const steps = planFor(date).blocks.find((b) => b.routine === 'evening')!.steps!
    const previous = Object.fromEntries(steps.slice(0, 4).map((step, i) => [stepKey('evening', step.id), ['done', 'minimal', 'skipped', 'not-needed'][i]!]))
    await useApp.getState().updateDay(date, (log) => ({ ...log, steps: { 'morning:water': 'done', ...previous } as typeof log.steps }))
    const a = actionFor('evening')
    expect(await useApp.getState().applyReminderAction(a)).toBe('applied')
    expect(useApp.getState().days[date]).toMatchObject({ eveningRoutineDoneAt: a.at, steps: { 'morning:water': 'done', ...previous, [stepKey('evening', steps[4]!.id)]: 'done' } })
    expect(openSteps(planFor(date), useApp.getState().days[date], 'evening')).toEqual([])
    const game = structuredClone(useApp.getState().game)
    await useApp.getState().load()
    expect(openSteps(planFor(date), useApp.getState().days[date], 'evening')).toEqual([])
    expect(await useApp.getState().applyReminderAction(a)).toBe('duplicate')
    expect(useApp.getState().game).toEqual(game)
  })

  it('bestätigt die aktuell geplanten Minimalversionen und lässt frühere nicht geplante Schritte erhalten', async () => {
    await useApp.getState().setOverride(date, { mode: 'wenig-energie' })
    await useApp.getState().setStep(date, 'evening', 'nicht-mehr-geplant', 'skipped')
    const steps = planFor(date).blocks.find((b) => b.routine === 'evening')!.steps!
    expect(steps.some((step) => step.useMinimal)).toBe(true)
    const a = actionFor('evening')
    expect(await useApp.getState().applyReminderAction(a)).toBe('applied')
    expect(useApp.getState().days[date]?.steps).toEqual({ 'evening:nicht-mehr-geplant': 'skipped', ...Object.fromEntries(steps.map((step) => [stepKey('evening', step.id), step.useMinimal ? 'minimal' : 'done'])) })
    expect(useApp.getState().days[date]?.eveningRoutineDoneAt).toBe(a.at)
  })

  it.each([
    ['leave-10', 'leftAt', 'leave'],
    ['pcstop-15', 'pcOffAt', 'pcstop'],
  ] as const)('ordnet Erledigt bei %s der tatsächlichen Handlung zu', async (key, field, main) => {
    // Legacy fallback still has its historical explicit action when no routine can replace it.
    if (key === 'leave-10') await useApp.getState().saveSettings(s => ({ ...s, routines: { ...s.routines, morning: [] }, sport: { ...s.sport, days: s.sport.days.map(() => false) } }))
    const a = actionFor(key)
    expect(await useApp.getState().applyReminderAction(a)).toBe('applied')
    expect(useApp.getState().days[date]?.[field]).toBe(a.at)
    expect(useApp.getState().days[date]?.dismissed ?? []).not.toContain(key)
    const game = structuredClone(useApp.getState().game)
    await useApp.getState().load()
    expect(useApp.getState().days[date]?.[field]).toBe(a.at)
    expect(await useApp.getState().applyReminderAction(a)).toBe('duplicate')
    expect(useApp.getState().game).toEqual(game)
    const reminders = buildReminders([planFor(date)], useApp.getState().days, useApp.getState().settings, zonedToUtc(date, 0))
    expect(reminders.some((event) => event.key === key || event.key === main)).toBe(false)
  })

  it('erhält bei Abend-entfällt frühere Schritte und vergibt auch nach späteren Änderungen keine Erledigung oder XP', async () => {
    const steps = planFor(date).blocks.find((b) => b.routine === 'evening')!.steps!
    const previous = Object.fromEntries(steps.slice(0, 4).map((step, i) => [stepKey('evening', step.id), ['done', 'minimal', 'skipped', 'not-needed'][i]!]))
    await useApp.getState().updateDay(date, (log) => ({ ...log, steps: previous as typeof log.steps }))
    const a = { ...actionFor('evening'), action: 'skip' as const }
    const game = structuredClone(useApp.getState().game)
    expect(await useApp.getState().applyReminderAction(a)).toBe('applied')
    expect(useApp.getState().days[date]?.steps).toEqual({ ...previous, [stepKey('evening', steps[4]!.id)]: 'not-needed' })
    expect(useApp.getState().days[date]?.eveningRoutineDoneAt).toBeUndefined()
    expect(useApp.getState().game).toEqual(game)
    await useApp.getState().load()
    await useApp.getState().updateDay(date, (log) => ({ ...log, changes: ['Eigene Notiz'] }))
    expect(useApp.getState().days[date]?.eveningRoutineDoneAt).toBeUndefined()
    expect(useApp.getState().game).toEqual(game)
  })

  it('erlaubt nach Abend-entfällt eine bewusst neu erledigte Minimalhandlung ohne doppelte Punkte', async () => {
    const a = { ...actionFor('evening'), action: 'skip' as const }
    expect(await useApp.getState().applyReminderAction(a)).toBe('applied')
    const game = structuredClone(useApp.getState().game)
    const step = planFor(date).blocks.find((b) => b.routine === 'evening')!.steps!.find((step) => step.minimal)!
    await useApp.getState().setStep(date, 'evening', step.id, undefined)
    expect(useApp.getState().days[date]?.eveningRoutineDoneAt).toBeUndefined()
    expect(useApp.getState().game).toEqual(game)
    await useApp.getState().setStep(date, 'evening', step.id, 'minimal')
    expect(useApp.getState().days[date]?.eveningRoutineDoneAt).toBe(Date.now())
    expect(useApp.getState().days[date]?.steps[stepKey('evening', step.id)]).toBe('minimal')
    const earned = structuredClone(useApp.getState().game)
    expect(earned.xp).toBeGreaterThan(game.xp)
    await useApp.getState().load()
    await useApp.getState().setStep(date, 'evening', step.id, 'minimal')
    expect(useApp.getState().game).toEqual(earned)
  })

  it.each(['done', 'skip'] as const)('speichert Abend-%s mit Schritten und Receipt gemeinsam oder gar nicht', async (action) => {
    const a = { ...actionFor('evening'), action }
    const before = structuredClone(useApp.getState().days)
    const game = structuredClone(useApp.getState().game)
    vi.spyOn(storage.repo!, 'putMany').mockRejectedValueOnce(new Error('Disk full'))
    await expect(useApp.getState().applyReminderAction(a)).rejects.toThrow('Disk full')
    expect(useApp.getState().days).toEqual(before)
    expect(useApp.getState().game).toEqual(game)
    expect(await storage.repo!.get('days', date)).toBeUndefined()
    expect(await useApp.getState().applyReminderAction(a)).toBe('applied')
    expect(openSteps(planFor(date), useApp.getState().days[date], 'evening')).toEqual([])
    await useApp.getState().load()
    expect(useApp.getState().days[date]?.reminderReceipts).toEqual([a.id])
    expect(await useApp.getState().applyReminderAction(a)).toBe('duplicate')
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

describe('Wetterort-Migration im echten Store und Sicherungsimport', () => {
  const legacyWeather = { enabled: true, city: 'Bewusst gewählter Altort', lat: 0, lng: 13.42, rules: { jacketBelowC: 7, rainAbovePct: 60 } }
  const oldSettings = () => ({ version: 1, onboarded: false, weather: structuredClone(legacyWeather) })
  const oldLocal = (): LocalData => ({ ...emptyLocal(), places: [{ id: 'private', label: 'Privater Ort', latitude: 48, longitude: 11 }],
    meds: { '2026-11-02': { status: 'taken', at: 100 } }, workSessions: [{ id: 'work', date: '2026-11-02', kind: 'regular', startAt: 100, endAt: 200, breaks: [] }] })
  const backup = (local = oldLocal()) => parseBackup(JSON.stringify(makeBackup([
    { collection: 'settings', id: 'main', data: oldSettings(), updated_at: Date.now() + 10_000, deleted: false },
    { collection: 'meta', id: 'local', data: local, updated_at: Date.now() + 10_000, deleted: false },
  ])))
  const expected = { enabled: true, city: legacyWeather.city, lat: 0, lng: legacyWeather.lng, revision: 'legacy-weather' }

  it('importiert ein echtes Altbackup, committet Ort und bereinigte Settings gemeinsam und bleibt nach Reload lokal', async () => {
    const records = backup(); const before = structuredClone(records)
    const put = vi.spyOn(storage.repo!, 'putMany')
    const merge = vi.spyOn(storage.repo!, 'merge')
    expect(await useApp.getState().importRecords(records)).toBe(2)
    expect(records).toEqual(before)
    expect(put).not.toHaveBeenCalled()
    expect(merge).toHaveBeenCalledTimes(1)
    expect(merge.mock.calls[0]![0].map(({ collection, id }) => `${collection}/${id}`)).toEqual(['settings/main', 'meta/local'])
    const saved = (await storage.repo!.get<LocalData>('meta', 'local'))!
    expect(saved.weatherProfile).toEqual(expected)
    expect(saved.places).toEqual(oldLocal().places)
    expect(saved.meds).toEqual(oldLocal().meds)
    expect(saved.workSessions).toEqual(oldLocal().workSessions)
    const settings = (await storage.repo!.get<Settings>('settings', 'main'))!
    expect(settings.weather).toEqual({ enabled: false, city: '', rules: legacyWeather.rules })
    expect(settings.anchor.wake).toBeTypeOf('number')
    const shared = (await storage.repo!.all()).filter((record) => record.collection !== 'meta')
    expect(JSON.stringify(shared)).not.toContain(legacyWeather.city)
    expect(JSON.stringify(shared)).not.toContain('13.42')
    await useApp.getState().load()
    expect(useApp.getState().local.weatherProfile).toEqual(expected)
    expect(useApp.getState().settings.weather).toEqual(settings.weather)
    expect(put).not.toHaveBeenCalled()
    const exported = parseBackup(JSON.stringify(makeBackup(await storage.repo!.all())))
    expect((exported.find((record) => record.collection === 'meta' && record.id === 'local')!.data as LocalData).weatherProfile).toEqual(expected)
  })

  it('bewahrt ein schon vorhandenes lokales Profil auch beim Altbackup mit eigenem meta/local', async () => {
    const chosen = { enabled: false, city: 'Inzwischen bewusst gewählter Ort', lat: 52, lng: 10, revision: 'local-choice' }
    await useApp.getState().saveLocal((local) => ({ ...local, weatherProfile: chosen }))
    await useApp.getState().importRecords(backup())
    await useApp.getState().load()
    expect(useApp.getState().local.weatherProfile).toEqual(chosen)
    expect(await storage.repo!.get<Settings>('settings', 'main')).toMatchObject({ weather: { enabled: false, city: '' } })
    expect((await storage.repo!.get<LocalData>('meta', 'local'))!.weatherProfile).toEqual(chosen)
  })

  it('übernimmt ein ausdrücklich vorhandenes neues Backup-Profil und erfindet bei frischen Daten keinen Ort', async () => {
    expect(useApp.getState().local.weatherProfile).toBeUndefined()
    const put = vi.spyOn(storage.repo!, 'putMany')
    await useApp.getState().load()
    expect(put).not.toHaveBeenCalled()
    await useApp.getState().saveLocal((local) => ({ ...local, weatherProfile: { enabled: true, city: 'Bisheriger Ort', lat: 52, lng: 10 } }))
    const restored = { enabled: false, city: 'Expliziter Sicherungsort', lat: 50, lng: 9 }
    await useApp.getState().importRecords(backup({ ...oldLocal(), weatherProfile: restored }))
    expect(useApp.getState().local.weatherProfile).toEqual(restored)
  })

  it('veröffentlicht bei fehlgeschlagenem kanonischem Importbatch weder Disk-Teilerfolg noch bereinigtes RAM', async () => {
    const records = backup().map((record) => ({ ...record, updated_at: 1 })); const before = useApp.getState()
    const diskBefore = await storage.repo!.all()
    vi.spyOn(storage.repo!, 'merge').mockRejectedValueOnce(new Error('Migration disk full'))
    await expect(useApp.getState().importRecords(records)).rejects.toThrow('Migration disk full')
    expect(useApp.getState().local).toBe(before.local)
    expect(useApp.getState().settings).toBe(before.settings)
    expect(await storage.repo!.all()).toEqual(diskBefore)
    expect(await useApp.getState().importRecords(records)).toBe(2)
    expect(useApp.getState().local.weatherProfile).toEqual(expected)
    expect((await storage.repo!.get<Settings>('settings', 'main'))!.weather).toEqual({ enabled: false, city: '', rules: legacyWeather.rules })
    await useApp.getState().load()
    expect(useApp.getState().local.weatherProfile).toEqual(expected)
  })

  it('lässt einen fehlgeschlagenen ersten Load unpubliziert und migriert bei erneutem Laden vollständig', async () => {
    await storage.repo!.merge(backup())
    const before = useApp.getState()
    useApp.setState({ ready: false })
    const batch = vi.spyOn(storage.repo!, 'putMany').mockRejectedValueOnce(new Error('Load disk full'))
    await expect(useApp.getState().load()).rejects.toThrow('Load disk full')
    expect(useApp.getState().ready).toBe(false)
    expect(useApp.getState().local).toBe(before.local)
    expect(useApp.getState().settings).toBe(before.settings)
    await useApp.getState().load()
    expect(useApp.getState().ready).toBe(true)
    expect(useApp.getState().local.weatherProfile).toEqual(expected)
    expect(batch).toHaveBeenCalledTimes(2)
    for (const [records] of batch.mock.calls) expect(records.map(({ collection, id }) => `${collection}/${id}`)).toEqual(['settings/main', 'meta/local'])
  })

  it('verliert bei einem Settings-only-Altbackup keine vorhandenen lokalen Daten', async () => {
    await useApp.getState().saveLocal(() => oldLocal())
    const records = backup().filter((record) => record.collection === 'settings')
    expect(await useApp.getState().importRecords(records)).toBe(2)
    expect(useApp.getState().local).toMatchObject({ ...oldLocal(), weatherProfile: expected })
    expect(await storage.repo!.get<LocalData>('meta', 'local')).toMatchObject({ ...oldLocal(), weatherProfile: expected })
  })

  it('erweckt einen ausdrücklich importierten privaten Löschrecord nicht aus Legacy-Settings wieder', async () => {
    await useApp.getState().saveLocal(() => oldLocal())
    const records = backup().map((record) => record.collection === 'meta' ? { ...record, deleted: true, data: null } : record)
    expect(await useApp.getState().importRecords(records)).toBe(2)
    await useApp.getState().load()
    expect(await storage.repo!.get('meta', 'local')).toBeUndefined()
    expect(useApp.getState().local.weatherProfile).toBeUndefined()
    expect((await storage.repo!.all()).find((record) => record.collection === 'meta' && record.id === 'local')?.deleted).toBe(true)
  })

  it('liest beim Migrationscommit nach einem parallelen lokalen Edit erneut den aktuellen Stand', async () => {
    await storage.repo!.merge(backup())
    useApp.setState({ local: oldLocal() })
    const read = storage.repo!.get.bind(storage.repo!)
    const reached = deferred(); const release = deferred()
    let first = true
    vi.spyOn(storage.repo!, 'get').mockImplementation(async (collection, id) => {
      const result = await read(collection, id)
      if (first && collection === 'meta' && id === 'local') { first = false; reached.resolve(); await release.promise }
      return result
    })
    const loading = useApp.getState().load()
    await reached.promise
    await useApp.getState().saveLocal((local) => ({ ...local, weatherProfile: { enabled: false, city: 'Wahl während Laden', lat: 53, lng: 11 }, handover: { '2026-11-02': { open: 'Neue private Notiz', next: 'Datei öffnen' } } }))
    release.resolve(); await loading
    expect(useApp.getState().local.weatherProfile?.city).toBe('Wahl während Laden')
    expect(useApp.getState().local.handover['2026-11-02']?.open).toBe('Neue private Notiz')
    expect(useApp.getState().local.meds).toEqual(oldLocal().meds)
    expect(useApp.getState().local.workSessions).toEqual(oldLocal().workSessions)
    expect(await read('meta', 'local')).toEqual(useApp.getState().local)
  })

  it('hält nach begonnenem Migrationsbatch Settings- und lokale Eingaben bis zum Commit geordnet', async () => {
    await storage.repo!.merge(backup())
    useApp.setState({ local: oldLocal() })
    const put = storage.repo!.putMany.bind(storage.repo!)
    const reached = deferred(); const release = deferred()
    let first = true
    vi.spyOn(storage.repo!, 'putMany').mockImplementation(async (records) => {
      if (first) { first = false; reached.resolve(); await release.promise }
      await put(records)
    })
    const loading = useApp.getState().load(); await reached.promise
    expect(useApp.getState().local.weatherProfile).toBeUndefined()
    const edit = useApp.getState().saveLocal((local) => ({ ...local, weatherProfile: { enabled: false, city: 'Neu nach Migration', lat: 54, lng: 12 } }))
    const settings = useApp.getState().saveSettings((value) => ({ ...value, homeOfficeMessage: 'Neue Einstellungsnotiz' }))
    release.resolve(); await Promise.all([loading, edit, settings])
    await useApp.getState().load()
    expect(useApp.getState().local.weatherProfile?.city).toBe('Neu nach Migration')
    expect(useApp.getState().settings.homeOfficeMessage).toBe('Neue Einstellungsnotiz')
    expect(useApp.getState().settings.weather).toEqual({ enabled: false, city: '', rules: legacyWeather.rules })
    expect(useApp.getState().local.meds).toEqual(oldLocal().meds)
    expect(useApp.getState().local.workSessions).toEqual(oldLocal().workSessions)
  })

  it('berechnet Importmigration nach einem bereits wartenden aktuellen Profil-Edit aus dem frischen E09-Bestand', async () => {
    const put = storage.repo!.put.bind(storage.repo!)
    const reached = deferred(); const release = deferred()
    vi.spyOn(storage.repo!, 'put').mockImplementationOnce(async (...args) => { reached.resolve(); await release.promise; await put(...args) })
    const chosen = { enabled: false, city: 'Neue lokale Wahl vor Import', lat: 51, lng: 8 }
    const saving = useApp.getState().saveLocal((local) => ({ ...local, weatherProfile: chosen }))
    await reached.promise
    const importing = useApp.getState().importRecords(backup())
    release.resolve(); await saving; await importing
    expect(useApp.getState().local.weatherProfile).toEqual(chosen)
    expect((await storage.repo!.get<LocalData>('meta', 'local'))!.weatherProfile).toEqual(chosen)
    expect((await storage.repo!.get<Settings>('settings', 'main'))!.weather.city).toBe('')
  })

  it('braucht nach Importcommit keine fehleranfälligen DB-Reads und erhält den ganzen Import beim nächsten Taskedit', async () => {
    const imported = { ...oldLocal(), work: [{ id: 'imported-work', title: 'Importierte Arbeit', createdAt: 100 }] }
    const records = [...backup(imported), { collection: 'inbox' as const, id: 'imported-note', data: { id: 'imported-note', text: 'Importierte Notiz', status: 'open', createdAt: 100 }, updated_at: Date.now() + 10_000, deleted: false }]
    const repo = storage.repo!
    const merge = repo.merge.bind(repo); const read = repo.get.bind(repo); const list = repo.list.bind(repo)
    let committed = false
    let readsAfterCommit = 0
    vi.spyOn(repo, 'merge').mockImplementation(async (...args) => { const count = await merge(...args); committed = true; return count })
    vi.spyOn(repo, 'get').mockImplementation(async (...args) => {
      if (committed) { readsAfterCommit++; throw new Error('DB read failed after commit') }
      return read(...args)
    })
    vi.spyOn(repo, 'list').mockImplementation(async (...args) => {
      if (committed) { readsAfterCommit++; throw new Error('DB list failed after commit') }
      return list(...args)
    })
    expect(await useApp.getState().importRecords(records)).toBe(3)
    expect(readsAfterCommit).toBe(0)
    expect(useApp.getState().local.weatherProfile).toEqual(expected)
    await useApp.getState().updateTask({ kind: 'work', id: 'imported-work' }, { title: 'Bewusst bearbeitet', nextStep: 'Datei öffnen' })
    const saved = (await read<LocalData>('meta', 'local'))!
    expect(saved.work[0]).toMatchObject({ id: 'imported-work', title: 'Bewusst bearbeitet', nextStep: 'Datei öffnen' })
    expect(saved.meds).toEqual(imported.meds)
    expect(saved.places).toEqual(imported.places)
    expect(saved.workSessions).toEqual(imported.workSessions)
    expect(saved.weatherProfile).toEqual(expected)
    expect((await read<Settings>('settings', 'main'))!.weather.city).toBe('')
    expect(await read('inbox', 'imported-note')).toMatchObject({ text: 'Importierte Notiz' })
    expect(useApp.getState().inbox).toContainEqual(expect.objectContaining({ id: 'imported-note', text: 'Importierte Notiz' }))
    expect(readsAfterCommit).toBe(0)
  })

  it('migriert einen übernommenen Settingsrecord innerhalb der vorhandenen Sync-Barriere ohne deadlock', async () => {
    const record: Rec = { collection: 'settings', id: 'main', data: oldSettings(), updated_at: Date.now() + 10_000, deleted: false }
    expect(await useApp.getState().mergeRecords([record])).toBe(2)
    expect(useApp.getState().local.weatherProfile).toEqual(expected)
    expect((await storage.repo!.get<Settings>('settings', 'main'))!.weather.city).toBe('')
    expect((await storage.repo!.get<LocalData>('meta', 'local'))!.weatherProfile).toEqual(expected)
  })
})

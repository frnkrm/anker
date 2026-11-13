import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { createCountdown, pauseCountdown } from '../core/focus'
import { makeBackup, parseBackup, previewImport } from '../core/export/backup'
import { recordForSync } from '../core/syncPrivacy'
import { simplificationOffer, SUPPORT_OFFER_DISMISSED, supportContextKey } from '../core/support'
import { zonedToUtc } from '../core/time'
import { MemoryRepository } from '../data/memory'
import type { Rec, Repository } from '../data/types'
import { nextNow } from './hooks'
import { planFor, supportInput, useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-13', now = zonedToUtc(date, 600)
const offer = () => simplificationOffer(supportInput(), useApp.getState().local)!
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now)
  storage.repo = new MemoryRepository()
  const settings = defaultSettings(date)
  settings.sport.days = settings.sport.days.map(() => false)
  await storage.repo.put('settings', 'main', settings)
  await storage.repo.put('days', date, { date, override: {}, steps: {}, wakeAt: now - 3600_000 })
  useApp.setState({ ready: false, local: emptyLocal() })
  await useApp.getState().load()
  await useApp.getState().saveLocal(local => ({ ...local,
    work: [{ id: 'private', title: 'PRIVATE-WORK', createdAt: now, state: 'paused' }],
    resume: { kind: 'work', refId: 'private', title: 'PRIVATE-WORK', at: now },
    focus: { id: 'focus', target: { kind: 'work', id: 'private' }, timer: pauseCountdown(createCountdown(300, now), now) },
  }))
  const key = supportContextKey(nextNow().action, date, useApp.getState().local.focus?.target)
  await useApp.getState().saveStuck(() => ({ contextKey: key, level: 1 }))
  expect(offer()).toBeDefined()
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('F-007: eine bewusste Tageswahl in der Storequeue', () => {
  it('nimmt genau einmal an, erhält Timer/Kernschritte und vergibt keine Punkte', async () => {
    const before = structuredClone({ local: useApp.getState().local, game: useApp.getState().game, day: useApp.getState().days[date]!, plan: planFor(date) })
    const writes = vi.spyOn(storage.repo!, 'putMany')
    const revision = offer().revision
    expect(await Promise.all([useApp.getState().respondSupportOffer(date, revision, 'accept'), useApp.getState().respondSupportOffer(date, revision, 'accept')])).toEqual([true, false])
    expect(writes).toHaveBeenCalledTimes(1)
    expect(writes.mock.calls[0]![0].map(r => [r.collection, r.id])).toEqual([['days', date]])
    expect(useApp.getState().days[date]!.override.mode).toBe('startschwierigkeit')
    expect(useApp.getState().days[date]!.steps).toEqual(before.day.steps)
    expect(planFor(date).blocks.filter(b => b.routine).map(b => b.steps)).toEqual(before.plan.blocks.filter(b => b.routine).map(b => b.steps))
    expect(useApp.getState().local).toEqual(before.local)
    expect(useApp.getState().game).toEqual(before.game)
    expect(offer()).toBeUndefined()
  })
  it('lehnt für den Tag ab, ohne die Planung zu ändern, und behält Abwahl nach Reload/Moduswechsel', async () => {
    const before = structuredClone(planFor(date))
    expect(await useApp.getState().respondSupportOffer(date, offer().revision, 'dismiss')).toBe(true)
    expect(planFor(date)).toEqual(before)
    expect(useApp.getState().days[date]!.override.mode).toBeUndefined()
    await useApp.getState().load()
    expect(offer()).toBeUndefined()
    await useApp.getState().setOverride(date, { mode: 'normal' })
    expect(offer()).toBeUndefined()
    expect(useApp.getState().days[date]!.dismissed).toEqual([SUPPORT_OFFER_DISMISSED])
  })
  it('verwirft veraltete Annahmen nach Inhalt, Plan, Modus oder Erledigung ohne Schreiben', async () => {
    const revision = offer().revision
    await useApp.getState().updateTask({ kind: 'work', id: 'private' }, { title: 'Umbenannt' })
    const writes = vi.spyOn(storage.repo!, 'putMany')
    expect(await useApp.getState().respondSupportOffer(date, revision, 'accept')).toBe(false)
    expect(writes).not.toHaveBeenCalled()
    const fresh = offer().revision
    await useApp.getState().completeTask({ kind: 'work', id: 'private' }, true)
    writes.mockClear()
    expect(await useApp.getState().respondSupportOffer(date, fresh, 'accept')).toBe(false)
    expect(writes).not.toHaveBeenCalled()
  })
  it('wendet eine Annahme nicht über die Tagesgrenze an; globale heutige Abwahl bleibt ausdrücklich', async () => {
    const revision = offer().revision
    await useApp.getState().removeTask({ kind: 'work', id: 'private' })
    expect(await useApp.getState().respondSupportOffer(date, revision, 'dismiss')).toBe(true)
    vi.setSystemTime(zonedToUtc('2026-11-14', 241))
    expect(await useApp.getState().respondSupportOffer(date, revision, 'accept')).toBe(false)
    expect(await useApp.getState().respondSupportOffer(date, revision, 'dismiss')).toBe(false)
    expect(useApp.getState().days['2026-11-14']).toBeUndefined()
  })
  it('prüft nach einem wartenden Queueauftrag erneut', async () => {
    const revision = offer().revision
    let release!: () => void, entered!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const writing = new Promise<void>(resolve => { entered = resolve })
    const original = storage.repo!.putMany.bind(storage.repo!)
    vi.spyOn(storage.repo!, 'putMany').mockImplementationOnce(async records => { entered(); await gate; await original(records) })
    const change = useApp.getState().updateTask({ kind: 'work', id: 'private' }, { title: 'Jetzt anders' })
    await writing
    const accept = useApp.getState().respondSupportOffer(date, revision, 'accept')
    release(); await change
    expect(await accept).toBe(false)
    expect(useApp.getState().days[date]!.override.mode).toBeUndefined()
    expect(useApp.getState().days[date]!.dismissed ?? []).not.toContain(SUPPORT_OFFER_DISMISSED)
  })
  it('überschreibt keine zwischenzeitliche ausdrückliche Moduswahl', async () => {
    const revision = offer().revision
    await useApp.getState().setOverride(date, { mode: 'auf-kurs' })
    const writes = vi.spyOn(storage.repo!, 'putMany')
    expect(await useApp.getState().respondSupportOffer(date, revision, 'accept')).toBe(false)
    expect(writes).not.toHaveBeenCalled()
    expect(useApp.getState().days[date]!.override.mode).toBe('auf-kurs')
  })
  it('publiziert bei Speicherfehler weder Modus noch Abwahl und erlaubt einen neuen Versuch', async () => {
    const before = useApp.getState().days[date]!
    const revision = offer().revision
    vi.spyOn(storage.repo!, 'putMany').mockRejectedValueOnce(new Error('Speicherfehler'))
    await expect(useApp.getState().respondSupportOffer(date, revision, 'accept')).rejects.toThrow('Speicherfehler')
    expect(useApp.getState().days[date]!).toBe(before)
    expect(offer()).toBeDefined()
    expect(await useApp.getState().respondSupportOffer(date, revision, 'accept')).toBe(true)
  })
  it('überträgt nur die allgemeine Tagespräferenz in Backup/Sync, keine verursachende Arbeitsreferenz', async () => {
    await useApp.getState().respondSupportOffer(date, offer().revision, 'dismiss')
    const record: Rec = { collection: 'days', id: date, data: useApp.getState().days[date]!, updated_at: now, deleted: false }
    const backup = makeBackup([record], new Date(now), { work: false })
    expect(JSON.stringify(backup)).not.toContain('PRIVATE-WORK')
    expect(JSON.stringify(recordForSync(record))).toContain(SUPPORT_OFFER_DISMISSED)
    expect(parseBackup(JSON.stringify(backup))[0]!.data).toMatchObject({ dismissed: [SUPPORT_OFFER_DISMISSED] })
    expect(previewImport(backup.records, []).records[0]!.data).toMatchObject({ dismissed: [SUPPORT_OFFER_DISMISSED] })
  })
})

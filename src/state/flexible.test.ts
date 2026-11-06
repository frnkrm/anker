import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { initialGame } from '../core/game'
import { zonedToUtc } from '../core/time'
import type { Commitment } from '../core/types'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-06'
const at = zonedToUtc(date, 18 * 60)
const app = () => useApp.getState()
const commitment = (id: string, patch: Partial<Commitment> = {}): Commitment => ({ id, date, label: id, context: 'social', commitment: 'soft', start: 20 * 60, status: 'planned', ...patch })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at)
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal(), days: {}, inbox: [], game: initialGame(date) })
  await app().load()
})
afterEach(() => vi.useRealTimers())

describe('Rückgängig bewahrt echte Handlungen und private Termine', () => {
  it('sagt einen schon vor der Tagesänderung vorhandenen Termin nicht ab', async () => {
    const existing = commitment('Schon vorher vereinbart')
    await app().saveCommitment(existing)
    await app().adjustDay(date, 'Heute klein', (log) => ({ ...log, override: { ...log.override, light: true } }))
    await app().restoreDay(date)
    expect(app().local.commitments).toEqual([existing])
  })

  it('verändert ohne vorhandene Rücknahme überhaupt keinen Termin', async () => {
    const existing = commitment('Nicht verlieren')
    await app().saveCommitment(existing)
    await app().restoreDay(date)
    expect(app().local.commitments).toEqual([existing])
  })

  it('lässt bei einem Speicherfehler Tagesplan und private Daten gemeinsam im Altstand', async () => {
    await app().saveCommitment(commitment('Vorher'))
    await app().adjustDay(date, 'Heute klein', (log) => ({ ...log, override: { ...log.override, light: true } }))
    const before = { day: structuredClone(app().days[date]), local: structuredClone(app().local) }
    const put = storage.repo!.put.bind(storage.repo!)
    const putMany = storage.repo!.putMany.bind(storage.repo!)
    vi.spyOn(storage.repo!, 'put').mockImplementation(async (...args) => {
      if (args[0] === 'meta') throw new Error('Speicher voll')
      await put(...args)
    })
    vi.spyOn(storage.repo!, 'putMany').mockImplementation(async (records) => {
      if (records.some((record) => record.collection === 'meta')) throw new Error('Speicher voll')
      await putMany(records)
    })
    await expect(app().restoreDay(date)).rejects.toThrow('Speicher voll')
    expect(app().days[date]).toEqual(before.day)
    expect(app().local).toEqual(before.local)
  })

  it('nimmt einen tatsächlich bestätigten Rückkehrzeitpunkt nicht zurück', async () => {
    await app().adjustDay(date, 'Abend später', (log) => ({ ...log, override: { ...log.override, routineAt: { evening: 'return' } } }))
    await app().updateDay(date, (log) => ({ ...log, override: { ...log.override, backAt: at } }))
    await app().restoreDay(date)
    expect(app().days[date]?.override.backAt).toBe(at)
  })

  it('erfasst neue und bearbeitete Termine samt Rücknahmebasis in einer Transaktion und hält Texte privat', async () => {
    const existing = commitment('Vertrauliche Bestandsverabredung')
    await app().saveCommitment(existing)
    const writes = vi.spyOn(storage.repo!, 'putMany')
    await app().adjustCommitment(commitment(existing.id, { start: 21 * 60 }), 'Terminzeit angepasst')
    expect(writes).toHaveBeenCalledTimes(1)
    expect(writes.mock.calls[0]![0].map((record) => record.collection).sort()).toEqual(['days', 'meta'])
    await app().adjustCommitment(commitment('Neue private Verabredung'), 'Ein weiterer Termin')
    await app().load()
    const all = await storage.repo!.all()
    expect(JSON.stringify(all.filter((record) => record.collection !== 'meta'))).not.toContain(existing.label)
    await app().restoreDay(date)
    expect(app().local.commitments.find((item) => item.id === existing.id)).toEqual(existing)
    expect(app().local.commitments.find((item) => item.id === 'Neue private Verabredung')?.status).toBe('cancelled')
    expect(app().local.planUndo).toBeUndefined()
  })

  it('bewahrt begonnene Fahrt, Arbeitsreferenz, echten Routinenabschluss und XP beim Undo', async () => {
    await app().adjustCommitment(commitment('Unterwegs'), 'Termin eingeplant')
    await app().saveCommitment(commitment('Unterwegs', { leftAt: at }))
    await app().adjustCommitment(commitment('Einsatz'), 'Einsatz eingeplant')
    await app().workStart({ commitmentId: 'Einsatz', kind: 'incident' })
    const step = app().settings.routines.evening[0]!
    await app().setStep(date, 'evening', step.id, 'minimal')
    const xp = app().game.xp
    await app().restoreDay(date)
    expect(app().local.commitments.map((item) => item.status)).toEqual(['planned', 'planned'])
    expect(app().local.commitments[0]?.leftAt).toBe(at)
    expect(app().local.workSessions[0]?.commitmentId).toBe('Einsatz')
    expect(app().days[date]?.steps[`evening:${step.id}`]).toBe('minimal')
    expect(app().game.xp).toBe(xp)
  })

  it('nimmt wiederholte Rücknahme still als No-op und behält eine spätere neue Rücknahmebasis', async () => {
    await app().adjustCommitment(commitment('Erster'), 'Erster Termin')
    await Promise.all([app().restoreDay(date), app().restoreDay(date)])
    const old = structuredClone(app().local.commitments)
    await app().adjustDay(date, 'Später anderer Plan', (log) => ({ ...log, override: { ...log.override, lateUntil: 1500 } }))
    await app().restoreDay(date)
    expect(app().local.commitments).toEqual(old)
    expect(app().days[date]?.override.lateUntil).toBeUndefined()
  })

  it('sagt bei einer alten Sicherung ohne private Rücknahmebasis keine unbekannten Termine ab', async () => {
    await app().saveCommitment(commitment('Altbestand'))
    await app().updateDay(date, (log) => ({ ...log, before: { override: {}, steps: {} }, override: { light: true } }))
    await app().restoreDay(date)
    expect(app().local.commitments[0]?.status).toBe('planned')
    expect(app().days[date]?.override.light).toBeUndefined()
  })
})

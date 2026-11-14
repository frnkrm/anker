import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { validatedRecords } from '../core/export/backup'
import { morningShortOffer } from '../core/morningShort'
import { zonedToUtc } from '../core/time'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { planFor, useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const DATE = '2026-11-02'
const at = (minute: number) => zonedToUtc(DATE, minute)
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at(502))
  storage.repo = new MemoryRepository()
  const s = defaultSettings(DATE)
  s.anchor = { ...s.anchor, wake: 420, manual: { wake: true, bed: true, pcStop: true } }
  s.work[0] = { ...s.work[0]!, start: 540, homeOffice: false }
  s.commute.minutes = 20; s.commute.bufferMin = 10
  s.sport.days = s.sport.days.map(() => false)
  s.routines.morning = [
    { id: 'first', title: 'Frühstück', minutes: 10, minimal: { title: 'Banane', minutes: 2 } },
    { id: 'second', title: 'Schlüssel', minutes: 5 },
  ]
  await storage.repo.put('settings', 'main', s)
  await storage.repo.put('days', DATE, { date: DATE, override: {}, steps: {}, wakeAt: at(420) })
  useApp.setState({ ready: false, local: emptyLocal() })
  await useApp.getState().load()
  await storage.repo.put('game', 'main', useApp.getState().game)
})
afterEach(() => vi.useRealTimers())
const offer = () => morningShortOffer(planFor(DATE), useApp.getState().days[DATE], Date.now())!

describe('Kurzmodus über bestehende Tagesplan-Schreibqueue', () => {
  it('vergibt auch für vorher unquittierte echte Handlungen keine Punkte aus der Kurzmoduswahl', async () => {
    const game = structuredClone(useApp.getState().game)
    const previous = structuredClone(useApp.getState().days[DATE])
    expect(await useApp.getState().acceptMorningShort(DATE, offer().revision)).toBe(true)
    expect(useApp.getState().game).toEqual(game)
    expect(useApp.getState().days[DATE]?.steps).toEqual(previous?.steps)
    expect(useApp.getState().days[DATE]?.awarded).toEqual(previous?.awarded)
  })
  it('übernimmt Doppeltippen einmal, erhält Schritte und Spielstand und übersteht Reload und Rücknahme', async () => {
    await useApp.getState().setStep(DATE, 'morning', 'second', 'done')
    vi.setSystemTime(at(505))
    const revision = offer().revision
    const state = useApp.getState()
    const before = structuredClone({ game: state.game, settings: state.settings, local: state.local })
    const writes = vi.spyOn(storage.repo!, 'putMany')
    expect(await Promise.all([useApp.getState().acceptMorningShort(DATE, revision), useApp.getState().acceptMorningShort(DATE, revision)])).toEqual([true, false])
    expect(writes).toHaveBeenCalledTimes(1)
    expect(useApp.getState().days[DATE]).toMatchObject({ override: { shortMorning: true, adjusted: true }, steps: { 'morning:second': 'done' }, changes: ['Morgenroutine in kurzen Varianten'] })
    expect(useApp.getState().game).toEqual(before.game)
    expect(useApp.getState().settings).toEqual(before.settings)
    expect(useApp.getState().local.commitments).toEqual(before.local.commitments)
    await useApp.getState().load()
    expect(useApp.getState().days[DATE]?.override.shortMorning).toBe(true)
    expect(await useApp.getState().acceptMorningShort(DATE, revision)).toBe(false)
    await useApp.getState().restoreDay(DATE)
    expect(useApp.getState().days[DATE]?.override.shortMorning).toBeUndefined()
    expect(useApp.getState().days[DATE]?.steps['morning:second']).toBe('done')
  })
  it('verwirft neue Pläne, echte Erledigung und abgelaufene Angebote vor jedem Schreiben', async () => {
    const revision = offer().revision
    await useApp.getState().setOverride(DATE, { workStart: 541 })
    const writes = vi.spyOn(storage.repo!, 'putMany')
    expect(await useApp.getState().acceptMorningShort(DATE, revision)).toBe(false)
    const current = offer().revision
    await useApp.getState().setStep(DATE, 'morning', 'first', 'done')
    writes.mockClear()
    expect(await useApp.getState().acceptMorningShort(DATE, current)).toBe(false)
    expect(writes).not.toHaveBeenCalled()
    expect(useApp.getState().days[DATE]?.override.shortMorning).toBeUndefined()
  })
  it('prüft nach einem wartenden Schreibauftrag erneut statt einen alten Screenshot zu übernehmen', async () => {
    const revision = offer().revision
    let release!: () => void
    let entered!: () => void
    const inWrite = new Promise<void>(resolve => { entered = resolve })
    const gate = new Promise<void>(resolve => { release = resolve })
    const original = storage.repo!.putMany.bind(storage.repo!)
    vi.spyOn(storage.repo!, 'putMany').mockImplementationOnce(async records => { entered(); await gate; await original(records) })
    const changing = useApp.getState().adjustDay(DATE, 'Homeoffice', day => ({ ...day, override: { ...day.override, homeOffice: true } }))
    await inWrite
    const accepting = useApp.getState().acceptMorningShort(DATE, revision)
    release(); await changing
    expect(await accepting).toBe(false)
    expect(useApp.getState().days[DATE]?.override).toMatchObject({ homeOffice: true })
    expect(useApp.getState().days[DATE]?.override.shortMorning).toBeUndefined()
  })
  it('übernimmt nach Zeitablauf oder Tageswechsel nichts', async () => {
    const revision = offer().revision
    vi.setSystemTime(at(510))
    expect(await useApp.getState().acceptMorningShort(DATE, revision)).toBe(false)
    vi.setSystemTime(zonedToUtc('2026-11-03', 500))
    expect(await useApp.getState().acceptMorningShort(DATE, revision)).toBe(false)
  })
  it('lässt bei Speicherfehler Zustand und Rücknahmebasis unangetastet und erlaubt denselben Versuch erneut', async () => {
    const revision = offer().revision
    const before = { days: structuredClone(useApp.getState().days), local: structuredClone(useApp.getState().local) }
    vi.spyOn(storage.repo!, 'putMany').mockRejectedValueOnce(new Error('Speicherfehler'))
    await expect(useApp.getState().acceptMorningShort(DATE, revision)).rejects.toThrow('Speicherfehler')
    expect(useApp.getState().days).toEqual(before.days)
    expect(useApp.getState().local).toEqual(before.local)
    expect(await useApp.getState().acceptMorningShort(DATE, revision)).toBe(true)
  })
  it('validiert die optionale Tageswahl auch in Sicherungen und erhält alte Logs', async () => {
    await useApp.getState().acceptMorningShort(DATE, offer().revision)
    const records = (await storage.repo!.all()).filter(r => r.collection === 'days')
    expect(validatedRecords(records)).toHaveLength(1)
    const record = records[0]!
    expect(() => validatedRecords([{ ...record, data: { ...useApp.getState().days[DATE], override: { shortMorning: 'ja' } } }])).toThrow()
    expect(validatedRecords([{ ...record, data: { date: DATE, override: {}, steps: {} } }])).toHaveLength(1)
  })
})

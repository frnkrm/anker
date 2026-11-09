import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { makeBackup, parseBackup } from '../core/export/backup'
import { zonedToUtc } from '../core/time'
import type { LocalData, SleepDiaryEntry } from '../core/types'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-08'
const now = zonedToUtc('2026-11-09', 600)
const times = { bedAt: zonedToUtc(date, 1380), wakeAt: zonedToUtc('2026-11-09', 420) }

beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(now)
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings('2026-11-09'), local: emptyLocal(), workUndo: undefined })
  await useApp.getState().load()
})
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers() })

describe('Bewusste lokale Übernahme einer Health-Schlafsitzung', () => {
  it('importiert ohne eigene Wahl nichts und schreibt nach Freigabe nur das private Schlafprotokoll', async () => {
    expect(await useApp.getState().acceptHealthSleep(date, times)).toBe(false)
    await useApp.getState().saveLocal(local => ({ ...local, healthSleepEnabled: true }))
    const before = useApp.getState(), game = structuredClone(before.game), settings = structuredClone(before.settings)
    expect(await useApp.getState().acceptHealthSleep(date, times)).toBe(true)
    expect(useApp.getState().days).toEqual({}); expect(useApp.getState().game).toEqual(game); expect(useApp.getState().settings).toEqual(settings)
    await useApp.getState().load()
    expect(useApp.getState().local.sleepDiary[date]).toEqual({ ...times, source: 'health-connect' })
    expect((await storage.repo!.all()).every(row => row.collection === 'meta')).toBe(true)
  })
  it('schützt auch nur teilweise eigene Nächte und doppelte Übernahmen', async () => {
    await useApp.getState().saveLocal(local => ({ ...local, healthSleepEnabled: true }))
    for (const entry of [{ sleepyAt: times.bedAt }, { bedAt: times.bedAt }, { wakeAt: times.wakeAt }]) {
      await useApp.getState().saveSleepEntry(date, entry)
      expect(await useApp.getState().acceptHealthSleep(date, times)).toBe(false)
      expect(useApp.getState().local.sleepDiary[date]).toEqual(entry)
    }
    await useApp.getState().removeSleepEntry(date)
    expect(await useApp.getState().acceptHealthSleep(date, times)).toBe(true)
    expect(await useApp.getState().acceptHealthSleep(date, { ...times, bedAt: times.bedAt - 60_000 })).toBe(false)
  })
  it('prüft eigene Eingaben erst an der echten seriellen Storegrenze', async () => {
    await useApp.getState().saveLocal(local => ({ ...local, healthSleepEnabled: true }))
    const manual = useApp.getState().saveSleepEntry(date, { bedAt: times.bedAt + 60_000 })
    const incoming = useApp.getState().acceptHealthSleep(date, times)
    await manual
    expect(await incoming).toBe(false)
    expect(useApp.getState().local.sleepDiary[date]).toEqual({ bedAt: times.bedAt + 60_000 })
  })
  it('prüft den während einer Warteschlange abgebrochenen Lesekontext erneut', async () => {
    await useApp.getState().saveLocal(local => ({ ...local, healthSleepEnabled: true }))
    let accept = true
    const queue = useApp.getState().saveLocal(local => { accept = false; return local })
    const incoming = useApp.getState().acceptHealthSleep(date, times, () => accept)
    await queue
    expect(await incoming).toBe(false)
    expect(useApp.getState().local.sleepDiary).toEqual({})
  })
  it('hält bisherige Daten bei Schreibfehlern unverändert und kann erneut übernehmen', async () => {
    await useApp.getState().saveLocal(local => ({ ...local, healthSleepEnabled: true }))
    vi.spyOn(storage.repo!, 'put').mockRejectedValueOnce(new Error('speichern fehlgeschlagen'))
    await expect(useApp.getState().acceptHealthSleep(date, times)).rejects.toThrow('speichern fehlgeschlagen')
    expect(useApp.getState().local.sleepDiary).toEqual({})
    expect(await useApp.getState().acceptHealthSleep(date, times)).toBe(true)
  })
  it('entfernt Herkunft bei eigener Korrektur, löscht Zeiten bewusst und erhält sie beim Abschalten', async () => {
    await useApp.getState().saveLocal(local => ({ ...local, healthSleepEnabled: true }))
    await useApp.getState().acceptHealthSleep(date, times)
    await useApp.getState().saveLocal(local => ({ ...local, healthSleepEnabled: false }))
    expect(useApp.getState().local.sleepDiary[date]?.source).toBe('health-connect')
    await useApp.getState().saveSleepEntry(date, { ...useApp.getState().local.sleepDiary[date], bedAt: times.bedAt + 120_000 })
    expect(useApp.getState().local.sleepDiary[date]).toEqual({ ...times, bedAt: times.bedAt + 120_000 })
    await useApp.getState().removeSleepEntry(date)
    expect(useApp.getState().local.sleepDiary[date]).toBeUndefined()
  })
  it('sichert Herkunft nur mit Gesundheit, niemals den Leseschalter und lehnt fremde Herkunft ab', async () => {
    await useApp.getState().saveLocal(local => ({ ...local, healthSleepEnabled: true }))
    await useApp.getState().acceptHealthSleep(date, times)
    const records = await storage.repo!.all()
    const full = makeBackup(records)
    const parsed = parseBackup(JSON.stringify(full)).find(row => row.collection === 'meta' && row.id === 'local')?.data as LocalData
    expect(parsed.healthSleepEnabled).toBeUndefined()
    expect(parsed.sleepDiary[date]).toEqual({ ...times, source: 'health-connect' })
    const reduced = makeBackup(records, new Date(now), { health: false })
    expect(JSON.stringify(reduced)).not.toContain('health-connect'); expect(JSON.stringify(reduced)).not.toContain('healthSleepEnabled')
    const local = records.find(row => row.collection === 'meta' && row.id === 'local')!
    const data = { ...(local.data as LocalData), healthSleepEnabled: true }
    const raw = { app: 'anker', version: 1, exportedAt: new Date(now).toISOString(), records: [{ ...local, data }] }
    expect((parseBackup(JSON.stringify(raw))[0]?.data as LocalData).healthSleepEnabled).toBe(false)
    data.sleepDiary[date] = { ...times, source: 'fremd' as SleepDiaryEntry['source'] }
    expect(() => parseBackup(JSON.stringify(raw))).toThrow(/Schlafdaten/)
  })
})

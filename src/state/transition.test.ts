import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { guidancePreferences } from '../core/guidance'
import { zonedToUtc } from '../core/time'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { nextNow } from './hooks'
import { useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-13'
const at = (minute: number) => zonedToUtc(date, minute)

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at(600))
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal(), workUndo: undefined })
  await useApp.getState().load()
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('F-006: gemeinsamer nächster Handgriff', () => {
  it('behält nach frühem Wecker beim Wechsel zu Jetzt dieselbe Morgeninstanz', async () => {
    vi.setSystemTime(at(211))
    await useApp.getState().saveSettings(s => ({ ...s,
      anchor: { ...s.anchor, wake: 210, manual: { wake: true, pcStop: true, bed: true } },
      guidance: { ...guidancePreferences(), enabled: true, zeroGapMorning: true },
      sport: { ...s.sport, days: s.sport.days.map(() => false) },
      routines: { ...s.routines, morning: [{ id: 'water', title: 'Ein Glas Wasser', minutes: 1 }] },
    }))
    await useApp.getState().activateMorningFromAlarm({ occurrenceId: 'early', targetDate: date, alarmAt: at(210), confirmedAt: at(210) })
    expect(nextNow().action).toMatchObject({ type: 'step', routine: 'morning', step: { id: 'water' } })
    const before = structuredClone(useApp.getState().days)
    await useApp.getState().setStep(date, 'morning', 'water', 'done')
    expect(nextNow().action.type).not.toBe('step')
    expect(useApp.getState().days['2026-11-12']).toEqual(before['2026-11-12'])
  })
  it('bietet nach einem Wechsel keine erledigten Routinenmerker oder verschobenen Aufgaben an', async () => {
    await useApp.getState().setResume({ kind: 'step', refId: 'old', route: '/fokus/morning', title: 'Alter Morgen', at: at(400) })
    expect(nextNow().action.type).not.toBe('resume')
    await useApp.getState().saveLocal(local => ({ ...local,
      work: [{ id: 'later', title: 'Später', createdAt: at(500), state: 'deferred', deferredUntil: at(900) }],
      resume: { kind: 'work', refId: 'later', title: 'Später', at: at(500) },
    }))
    expect(nextNow().action.type).not.toBe('resume')
  })
  it('liest gültige pausierte Kontexte ohne Timerstart, Punkte oder weiteren Schreibauftrag', async () => {
    await useApp.getState().saveLocal(local => ({ ...local, work: [{ id: 'w', title: 'Privater Auftrag', nextStep: 'Datei öffnen', createdAt: at(500), state: 'paused' }], resume: { kind: 'work', refId: 'w', title: 'Alt', at: at(500) } }))
    const before = structuredClone({ local: useApp.getState().local, game: useApp.getState().game, days: useApp.getState().days })
    const write = vi.spyOn(storage.repo!, 'putMany')
    expect(nextNow().action).toMatchObject({ type: 'resume', title: 'Datei öffnen' })
    expect(nextNow()).toEqual(nextNow())
    expect(write).not.toHaveBeenCalled()
    expect({ local: useApp.getState().local, game: useApp.getState().game, days: useApp.getState().days }).toEqual(before)
  })
})

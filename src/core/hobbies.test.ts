import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLocal } from './defaults'
import { buildDayPlan } from './planner'
import { suggestHobby, validHobbies } from './hobbies'
import { zonedToUtc } from './time'
import type { NextInput } from './support'
import type { LocalData } from './types'
import { validatedRecords } from './export/backupValidation'
import { recordForSync } from './syncPrivacy'

function setup() {
  const date = '2026-11-02', settings = defaultSettings(date)
  const plan = buildDayPlan({ date, settings })
  const input: NextInput = { plan, settings, m: plan.pcStop - 30, nowMs: zonedToUtc(date, plan.pcStop - 30),
    log: { date, override: {}, steps: Object.fromEntries((plan.blocks.find(b => b.routine === 'evening')?.steps ?? []).map(s => [`evening:${s.id}`, 'done'])), wakeAt: 1, leftAt: 1 }, inbox: [], work: [] }
  const local: LocalData = { ...emptyLocal(), hobbies: { items: [{ id: 'photo', name: 'Fotografieren' }] } }
  return { input, local }
}
describe('Freiwillige Hobby-Vorschläge', () => {
  it('genügt mit einem Namen und verändert weder Plan, Punkte noch Tagesfakten', () => {
    const { input, local } = setup(), before = JSON.stringify({ input, local })
    expect(suggestHobby(input, local)).toMatchObject({ hobbyId: 'photo', title: 'Fotografieren' })
    expect(suggestHobby(input, local)?.minutes).toBeUndefined()
    expect(JSON.stringify({ input, local })).toBe(before)
  })
  it('bleibt im Zeitfenster stabil, bis bewusst eine andere Idee gewählt wird', () => {
    const { input, local } = setup()
    local.hobbies!.items.push({ id: 'read', name: 'Lesen' })
    const first = suggestHobby(input, local)!
    expect(suggestHobby({ ...input, m: input.m + 1 }, local)?.title).toBe(first.title)
    expect(suggestHobby(input, local, { rotation: 1 })?.title).not.toBe(first.title)
  })
  it('beachtet Dauer und bewusst angegebenen Kontext/Energie', () => {
    const { input, local } = setup()
    local.hobbies!.items[0]!.activities = [
      { id: 'long', title: 'Fotorunde', minutes: 90 },
      { id: 'small', title: 'Ein Motiv', minutes: 5, energy: 'low', context: 'inside' },
    ]
    expect(suggestHobby(input, local)).toBeUndefined()
    expect(suggestHobby(input, local, { energy: 'low', context: 'inside' })?.activityId).toBe('small')
    expect(suggestHobby(input, local, { energy: 'high', context: 'outside' })).toBeUndefined()
  })
  it('respektiert Pause und Heute nicht', () => {
    const { input, local } = setup()
    local.hobbies!.dismissedDate = input.plan.date
    expect(suggestHobby(input, local)).toBeUndefined()
    delete local.hobbies!.dismissedDate
    local.hobbies!.items[0]!.paused = true
    expect(suggestHobby(input, local)).toBeUndefined()
  })
  it('bietet bei Alarm, Nacht, offenem Abend und Terminstatus nichts an', () => {
    const { input, local } = setup()
    expect(suggestHobby(input, local, { alarmActive: true })).toBeUndefined()
    expect(suggestHobby({ ...input, m: input.plan.bed + 1 }, local)).toBeUndefined()
    expect(suggestHobby({ ...input, plan: { ...input.plan, openEnd: true } }, local)).toBeUndefined()
    const commitment = { id: 'visit', date: input.plan.date, label: 'Privat', start: input.m - 60, end: input.m - 30, context: 'personal' as const, commitment: 'hard' as const, locationKind: 'onsite' as const }
    input.plan.legs = [{ commitment, fromLabel: '', travelOpen: false, items: [] }]
    expect(suggestHobby(input, local)).toBeUndefined()
    commitment.end = input.m + 60
    expect(suggestHobby(input, local)).toBeUndefined()
  })
  it('prüft importierte Daten und synchronisiert keine Hobbytexte', () => {
    const { local } = setup()
    const record = { collection: 'meta' as const, id: 'local', data: local, updated_at: 1, deleted: false, dirty: 1 }
    expect(validatedRecords([record])[0]?.data).toMatchObject({ hobbies: local.hobbies })
    expect(recordForSync(record)).toBeUndefined()
    local.hobbies!.items[0]!.activities = [{ id: 'a', title: 'Motiv', minutes: NaN }]
    expect(() => validatedRecords([record])).toThrow()
    expect(validHobbies({ items: [{ id: 'x', name: '' }] })).toBe(false)
    expect(validHobbies({ items: [{ id: 'x', name: 'A' }, { id: 'x', name: 'B' }] })).toBe(false)
  })
})

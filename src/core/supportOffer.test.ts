import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLocal } from './defaults'
import { createCountdown } from './focus'
import { buildDayPlan } from './planner'
import { buildReminders } from './reminders/build'
import { currentSupportView, simplificationOffer, SUPPORT_OFFER_DISMISSED, supportContextKey, type NextInput } from './support'
import { zonedToUtc } from './time'

const date = '2026-11-13', now = zonedToUtc(date, 600)
const settings = defaultSettings(date)
const plan = buildDayPlan({ date, settings })
const task = { id: 'private-work', title: 'Vertraulicher Auftrag', createdAt: now - 1000, state: 'paused' as const }
const local = { ...emptyLocal(), work: [task], resume: { kind: 'work' as const, refId: task.id, title: task.title, at: now }, stuck: { contextKey: `work:${task.id}`, level: 1 } }
const input: NextInput = { plan, settings, log: { date, steps: {}, override: {}, wakeAt: now - 3600_000 }, inbox: [], work: [task], nowMs: now, m: 600 }

describe('F-007: belegte freiwillige Vereinfachung', () => {
  it('ändert durch den allgemeinen Tageswert keine vorhandenen Reminder', () => {
    const before = buildReminders([plan], { [date]: input.log! }, settings, now)
    const after = buildReminders([plan], { [date]: { ...input.log!, dismissed: [SUPPORT_OFFER_DISMISSED] } }, settings, now)
    expect(after).toEqual(before)
  })
  it('verlangt eine ausdrücklich verkleinerte Hilfe desselben aktuellen Kontexts', () => {
    expect(simplificationOffer(input, local)).toMatchObject({ date, contextKey: local.stuck.contextKey })
    expect(simplificationOffer(input, { ...local, stuck: undefined })).toBeUndefined()
    expect(simplificationOffer(input, { ...local, stuck: { contextKey: local.stuck.contextKey, level: 0, timer: createCountdown(60, now - 120_000) } })).toBeUndefined()
    expect(simplificationOffer(input, { ...local, stuck: { contextKey: 'work:anderer', level: 1 } })).toBeUndefined()
  })
  it('erfindet aus einem Verschiebedatum und Nichtnutzung keinen Verlauf oder eine Blockade', () => {
    const work = [{ ...task, state: 'deferred' as const, deferredUntil: now - 1000 }]
    expect(simplificationOffer({ ...input, work }, { ...local, stuck: undefined })).toBeUndefined()
  })
  it.each(['startschwierigkeit', 'wenig-energie', 'ueberlastet', 'auf-kurs'] as const)('respektiert die bestehende Moduswahl %s', mode => {
    expect(simplificationOffer({ ...input, log: { ...input.log!, override: { mode } } }, local)).toBeUndefined()
  })
  it('respektiert Tagesabwahl, Datumsgrenze und einen fremden Log', () => {
    expect(simplificationOffer({ ...input, log: { ...input.log!, dismissed: [SUPPORT_OFFER_DISMISSED] } }, local)).toBeUndefined()
    expect(simplificationOffer({ ...input, log: { ...input.log!, date: '2026-11-12' } }, local)).toBeUndefined()
    expect(simplificationOffer({ ...input, nowMs: zonedToUtc('2026-11-14', 241) }, local)).toBeUndefined()
  })
  it('schließt erledigte, entfernte, abgesagte und noch verschobene Aufgaben aus', () => {
    for (const work of [[], [{ ...task, done: true }], [{ ...task, state: 'cancelled' as const }], [{ ...task, state: 'not-needed' as const }], [{ ...task, state: 'deferred' as const, deferredUntil: now + 60000 }]]) {
      expect(simplificationOffer({ ...input, work }, local)).toBeUndefined()
    }
  })
  it('ordnet einem entfernten Teil keinen Elternkontext als Ersatz zu', () => {
    const focus = { id: 'focus', target: { kind: 'work' as const, id: task.id, partId: 'gone' }, timer: createCountdown(60, now) }
    const work = [{ ...task, state: 'active' as const, subtasks: [] }]
    const action = currentSupportView({ ...input, work }, local).action
    const stuck = { contextKey: supportContextKey(action, date, focus.target), level: 1 }
    expect(simplificationOffer({ ...input, work }, { ...local, focus, stuck })).toBeUndefined()
  })
  it('ändert nichts und bindet die flüchtige Revision an aktuellen Plan und Inhalt', () => {
    const before = structuredClone({ input, local })
    const offer = simplificationOffer(input, local)!
    const renamed = [{ ...task, title: 'Anderer Titel' }]
    expect(simplificationOffer({ ...input, work: renamed }, local)?.revision).not.toBe(offer.revision)
    expect(simplificationOffer({ ...input, plan: { ...plan, pcStop: plan.pcStop + 30 } }, local)?.revision).not.toBe(offer.revision)
    expect({ input, local }).toEqual(before)
    expect(SUPPORT_OFFER_DISMISSED).not.toContain(task.id)
    expect(SUPPORT_OFFER_DISMISSED).not.toContain(task.title)
  })
})

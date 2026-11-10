import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLocal } from '../defaults'
import { guidancePreferences } from '../guidance'
import { buildDayPlan } from '../planner'
import { addDays, zonedToUtc } from '../time'
import type { DayLog } from '../types'
import { buildPcBriefing, buildPcState, defaultPcBridgeLocal, matchingPcAck, pcConnectionStatus, pcConnectionText, pcRevision } from './index'
import type { PcAck, PcLinkPreferences } from './types'

const date = '2026-11-12'
const next = addDays(date, 1)
const at = (minute: number, day = date) => zonedToUtc(day, minute)
const prefs = (): PcLinkPreferences => {
  const { followGentleEvening, ...wire } = defaultPcBridgeLocal().preferences
  return { ...wire, strictLock: true, enforceEnabled: true, singleTransition: followGentleEvening !== false }
}
const settings = () => {
  const s = defaultSettings(date)
  s.anchor = { ...s.anchor, wake: 420, manual: { wake: true, pcStop: true, bed: true } }
  s.bed = 1380; s.pcStop = 1350
  s.guidance = { ...guidancePreferences(), enabled: true, eveningEscalation: true, pcLock: true }
  return s
}
const ack = (revision: string, receivedAt: string, effectiveDate = date): PcAck => ({ type: 'ack', revision, receivedAt, effective: { date: effectiveDate, mode: 'scheduled' }, companion: { version: '0.1.0', protocol: 3 }, warnings: [] })

describe('PC-Ableitung aus dem vorhandenen Tagesplan', () => {
  it('überträgt optionale Morgenzeiten abends vom Folgeplan und morgens vom tatsächlichen Wecktag', () => {
    const s = settings(); const plan = buildDayPlan({ date, settings: s })
    const morning = buildDayPlan({ date: next, settings: s, override: { workStart: 600, wakeOverride: 480, homeOffice: false } })
    const options = { ...prefs(), morningCountdown: true }
    const eveningInput = { plan, settings: s, local: emptyLocal(), prefs: options, nowMs: at(1320), nextPlan: morning }
    const evening = buildPcState(eveningInput)
    expect(evening.schedule).toMatchObject({ wakeAt: new Date(at(morning.wake, next)).toISOString(), homeOffice: morning.homeOffice,
      leaveAt: new Date(at(morning.leave!, next)).toISOString(), workStartAt: new Date(at(morning.workInfo!.plannedStart, next)).toISOString() })
    const morningState = buildPcState({ ...eveningInput, plan: morning, nowMs: at(morning.wake + 1, next), nextPlan: undefined })
    expect(morningState.schedule.wakeAt).toBe(evening.schedule.wakeAt)
    expect(morningState.schedule.leaveAt).toBe(evening.schedule.leaveAt)
    expect(morningState.schedule.workStartAt).toBe(evening.schedule.workStartAt)
    expect(morningState.schedule.homeOffice).toBe(evening.schedule.homeOffice)
    for (const nextPlan of [undefined, buildDayPlan({ date: addDays(next, 1), settings: s })]) {
      const unknown = buildPcState({ ...eveningInput, nextPlan })
      expect(unknown.schedule.leaveAt).toBeUndefined()
      expect(unknown.schedule.workStartAt).toBeUndefined()
      expect(unknown.schedule.homeOffice).toBeUndefined()
    }
    const briefing = buildPcBriefing([plan, morning], s, options, at(1320))
    expect(briefing.days[0]?.wakeAt).toBe(evening.schedule.wakeAt)
    expect(briefing.days[0]?.morning).toEqual({ homeOffice: morning.homeOffice, leaveAt: evening.schedule.leaveAt, workStartAt: evening.schedule.workStartAt })
    expect(briefing.days[1]?.morning).toBeUndefined()
  })
  it('erfindet für das freie Wochenende keine Arbeitszeit des vorherigen Freitags', () => {
    const s = settings(); const friday = buildDayPlan({ date: next, settings: s })
    const saturday = buildDayPlan({ date: addDays(next, 1), settings: s })
    const result = buildPcBriefing([friday, saturday], s, { ...prefs(), morningCountdown: true }, at(1320, next))
    expect(result.days[0]?.morning).toEqual({ homeOffice: saturday.homeOffice })
    expect(result.days[0]?.wakeAt).toBe(new Date(at(saturday.wake, saturday.date)).toISOString())
  })
  it('gibt exakt die datierten PC-Stopp-/Bettzeiten inklusive offenem Ende und Sommerzeit weiter', () => {
    const s = settings()
    const plans = [date, next].map((value, index) => buildDayPlan({ date: value, settings: s, override: index ? { lateUntil: 'open' } : undefined }))
    const value = buildPcBriefing(plans, s, prefs(), at(1200))
    expect(value.days[0]).toMatchObject({ date, pc: { mode: 'scheduled', stopAt: new Date(at(plans[0]!.pcStop)).toISOString() }, bedAt: new Date(at(plans[0]!.bed)).toISOString() })
    expect(value.days[1]?.pc).toEqual({ mode: 'paused' })
    expect(value.days[1]?.bedAt).toBeUndefined()
    for (const d of ['2026-03-28', '2026-10-24']) {
      const p = buildDayPlan({ date: d, settings: s })
      const result = buildPcBriefing([p], s, prefs(), at(1200, d))
      expect(result.days[0]?.wakeAt).toBe(new Date(zonedToUtc(addDays(d, 1), s.anchor.wake)).toISOString())
    }
  })
  it('hält dieselbe Nachtidentität über 04 Uhr und verlängert ihre 18-Stunden-Lease nicht beim Reconnect', () => {
    const s = settings(); const local = emptyLocal()
    local.guidance = { receipts: [], days: { [date]: { nightLockedAt: at(1380) } } }
    const before = buildPcState({ plan: buildDayPlan({ date, settings: s }), settings: s, local, prefs: prefs(), nowMs: at(1440 + 239) })
    const after = buildPcState({ plan: buildDayPlan({ date: next, settings: s }), settings: s, local, prefs: prefs(), nowMs: at(240, next) })
    expect(before.sessionId).toBe(after.sessionId)
    expect(before.validUntil).toBe(new Date(at(1380) + 18 * 3600_000).toISOString())
    expect(after.validUntil).toBe(before.validUntil)
    expect(after.lockEnforced).toBe(true)
    const actualWakeAt = new Date(at(s.anchor.wake, next)).toISOString()
    expect(before.schedule.wakeAt).toBe(actualWakeAt)
    expect(after.schedule.wakeAt).toBe(actualWakeAt)
    expect(after.schedule.morningDeadlineAt).toBe(before.schedule.morningDeadlineAt)
    const earlyRing = buildPcState({ plan: buildDayPlan({ date, settings: s }), settings: s, local, prefs: prefs(), nowMs: at(1440 + 210), alarm: { ringing: true, kind: 'main' } })
    expect(earlyRing.state).toBe('ALARM_RINGING')
    expect(earlyRing.schedule.wakeAt).toBe(actualWakeAt)
  })
  it('meldet nach echter Morgenroutine auch mittags MORNING_COMPLETED, übersprungene Schritte lösen nicht', () => {
    const s = settings(); const plan = buildDayPlan({ date: next, settings: s }); const local = emptyLocal()
    local.guidance = { receipts: [], days: { [date]: { nightLockedAt: at(1380) }, [next]: { morningActivatedAt: at(420, next), morningCompletedAt: at(450, next) } } }
    const steps = plan.blocks.find(b => b.routine === 'morning')!.steps!
    const done: DayLog = { date: next, override: {}, steps: Object.fromEntries(steps.map(step => [`morning:${step.id}`, 'done' as const])) }
    const input = { plan, log: done, local, settings: s, prefs: prefs(), nowMs: at(840, next) }
    expect(buildPcState(input)).toMatchObject({ state: 'MORNING_COMPLETED', lockEnforced: false })
    expect(buildPcState({ ...input, log: { ...done, steps: Object.fromEntries(steps.map(step => [`morning:${step.id}`, 'skipped' as const])) } }).state).not.toBe('MORNING_COMPLETED')
    expect(buildPcState({ ...input, prefs: { ...prefs(), enforceEnabled: false } }).lockEnforced).toBe(false)
  })
  it('teilt private Notizen nur bei Einzelwahl, ohne Aufgaben-/Schritttitel und ohne halbe Emoji', () => {
    const s = settings(); const plan = buildDayPlan({ date: next, settings: s }); const local = emptyLocal()
    local.guidance = { receipts: [], days: { [date]: { nightLockedAt: at(1380), brainDumpIds: ['note'] }, [next]: { morningActivatedAt: at(420, next), morningCompletedAt: at(450, next) } } }
    local.tomorrowSteps = [{ id: 'note', title: 'a'.repeat(499) + '🌅x', nextStep: '🌅'.repeat(501), createdAt: at(1370), resumeAt: at(480, next), remind: false }]
    const log: DayLog = { date: next, override: {}, steps: Object.fromEntries(plan.blocks.find(b => b.routine === 'morning')!.steps!.map(step => [`morning:${step.id}`, 'minimal' as const])) }
    const input = { plan, local, log, settings: s, prefs: prefs(), nowMs: at(840, next) }
    expect(buildPcState(input).brainDump).toBeUndefined()
    const shared = buildPcState({ ...input, prefs: { ...prefs(), shareBrainDump: true } })
    expect(shared.brainDump?.text).toBe('a'.repeat(499))
    expect(shared.brainDump!.nextStep!).toHaveLength(500)
    expect([...shared.brainDump!.nextStep!]).toHaveLength(250)
    expect(JSON.stringify(shared)).not.toContain(s.routines.morning[0]!.title)
  })
  it('hält Revisionen unabhängig von Abrufzeit und kanonischer Schlüsselfolge stabil', () => {
    expect(pcRevision({ b: 2, a: 1 })).toBe(pcRevision({ a: 1, b: 2 }))
    const s = settings(); const plan = buildDayPlan({ date, settings: s })
    const input = { plan, settings: s, local: emptyLocal(), prefs: prefs(), nowMs: at(1300) }
    expect(buildPcState(input).revision).toBe(buildPcState({ ...input, nowMs: at(1301) }).revision)
  })
})

describe('Ehrliche Empfangsbestätigung', () => {
  const wanted = { revision: 'pc3:1234', date, generatedAt: new Date(at(1200)).toISOString(), validUntil: new Date(at(1380)).toISOString() }
  it('bestätigt ausschließlich passendes datiertes ACK und keine bloß verbundene oder alte Revision', () => {
    const valid = ack(wanted.revision, new Date(at(1201)).toISOString())
    expect(matchingPcAck(valid, wanted, at(1202))).toBe(true)
    expect(matchingPcAck({ ...valid, revision: 'old' }, wanted, at(1202))).toBe(false)
    expect(matchingPcAck({ ...valid, effective: { ...valid.effective, date: next } }, wanted, at(1202))).toBe(false)
    expect(matchingPcAck(valid, wanted, at(1400))).toBe(false)
    const state = buildPcState({ plan: buildDayPlan({ date, settings: settings() }), settings: settings(), local: emptyLocal(), prefs: prefs(), nowMs: at(1200) })
    expect(pcConnectionStatus({ nativeState: 'paired', connected: true, wanted: state, nowMs: at(1200) })).toBe('paired-never-reached')
    expect(pcConnectionStatus({ nativeState: 'paired', connected: false, ack: valid, wanted: state, nowMs: at(1200) })).toBe('unreachable')
    expect(pcConnectionText({ ...defaultPcBridgeLocal(), status: 'unreachable', ack: valid })).toContain('letzte Bestätigung')
  })
})

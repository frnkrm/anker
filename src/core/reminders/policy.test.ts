import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { zonedToUtc } from '../time'
import type { DayLog, DayPlan } from '../types'
import { currentReminderAction, validReminderAction } from './actions'
import { buildReminders, reminderAllowed, reminderPolicy, reminderRevisions } from './build'

const date = '2026-11-02'
const plan: DayPlan = {
  date, dayType: 'weekend', homeOffice: false, wake: 420, pcStop: 21 * 60, bed: 22 * 60, hardTimes: [], notes: [],
  blocks: [{ id: 'evening', kind: 'evening-routine', title: 'Abendroutine', start: 18 * 60, end: 18 * 60 + 15, routine: 'evening', steps: [{ id: 'private', title: 'Mein privater Schritt', minutes: 5, useMinimal: false, tag: 'teeth' }] }],
}
const log: DayLog = { date, override: {}, steps: {} }
const now = zonedToUtc(date, 17 * 60)

describe('Erinnerungen: einzelne Zustellung und logische Version', () => {
  it('unterdrückt Wiederholungen, die erst nach der Basiszeit in Ruhezeit fallen', () => {
    const s = defaultSettings(date)
    s.reminders = { intensity: 'persistent', repeatAfterMin: 8, quietStart: 18 * 60 + 5, quietEnd: 6 * 60 }
    const events = buildReminders([plan], { [date]: log }, s, now).filter((e) => e.key === 'evening')
    expect(events.map((e) => e.escalation)).toEqual([0])
  })

  it('unterdrückt Wiederholungen in Film/Freizeit, behält den bewusst geplanten Weg', () => {
    const s = defaultSettings(date)
    s.reminders.intensity = 'persistent'
    const quiet = { ...plan, quiet: [[18 * 60 + 5, 19 * 60]] as [number, number][] }
    const events = buildReminders([quiet], { [date]: log }, s, now).filter((e) => e.key === 'evening')
    expect(events.map((e) => e.escalation)).toEqual([0])
    expect(reminderAllowed(quiet, log, s, zonedToUtc(date, 18 * 60 + 10), true, 'go:termin')).toBe(true)
    expect(reminderAllowed(quiet, log, s, zonedToUtc(date, 18 * 60 + 10), true, 'bed')).toBe(false)
  })

  it('lässt Auf Kurs und Fokus ohne Haushaltsstörung, feste Anker bleiben', () => {
    const s = defaultSettings(date)
    const focused = { ...log, override: { mode: 'auf-kurs' as const } }
    const inMode = buildReminders([plan], { [date]: focused }, s, now)
    expect(inMode.some((e) => e.key === 'evening')).toBe(false)
    expect(inMode.some((e) => e.key === 'bed' && e.critical)).toBe(true)
    const inSession = buildReminders([plan], { [date]: log }, s, now, undefined, { focusUntil: zonedToUtc(date, 19 * 60) })
    expect(inSession.some((e) => e.key === 'evening')).toBe(false)
    expect(inSession.some((e) => e.key === 'pcstop' && e.critical)).toBe(true)
  })

  it('teilt eine logische Revision über Stufen, aber niemals ihre Button-Identität', () => {
    const s = defaultSettings(date)
    s.reminders.intensity = 'persistent'
    const events = buildReminders([plan], { [date]: log }, s, now).filter((e) => e.key === 'evening')
    expect(events).toHaveLength(3)
    expect(new Set(events.map((e) => e.revision)).size).toBe(1)
    expect(new Set(events.map((e) => e.token)).size).toBe(3)
    // Last-stage delivery is already past; snooze and queued actions still need its logical version.
    expect(buildReminders([plan], { [date]: log }, s, zonedToUtc(date, 19 * 60)).some((e) => e.key === 'evening')).toBe(false)
    expect(reminderRevisions([plan], { [date]: log }, s)[`${date}|evening`]).toBe(events[0]!.revision)
  })

  it('weist eine alte Aktion nach Verschieben zurück, auch bei gleichem Datum und Schlüssel', () => {
    const s = defaultSettings(date)
    const event = buildReminders([plan], { [date]: log }, s, now).find((e) => e.key === 'evening')!
    const action = { id: 'opaque-id', action: 'done' as const, key: event.key, date, at: event.at, revision: event.revision, token: event.token }
    const at = event.at + 1000
    expect(currentReminderAction(action, [plan], { [date]: log }, s, {}, at)).toBe(true)
    const moved = { ...plan, blocks: plan.blocks.map((b) => ({ ...b, start: b.start + 60, end: b.end + 60 })) }
    expect(currentReminderAction(action, [moved], { [date]: log }, s, {}, at)).toBe(false)
    expect(currentReminderAction(action, [plan], { [date]: { ...log, dismissed: ['evening'] } }, s, {}, at)).toBe(false)
    expect(validReminderAction({ ...action, date: '2026-02-30' })).toBe(false)
  })

  it('gibt private Routinentexte weder als Titel noch als ersten Schritt auf dem Sperrbildschirm aus', () => {
    const s = defaultSettings(date)
    const morning: DayPlan = { ...plan, blocks: [{ ...plan.blocks[0]!, id: 'morning', kind: 'morning', routine: 'morning', start: 420, end: 435 }] }
    const events = buildReminders([morning, plan], {}, s, zonedToUtc(date, 400))
    expect(JSON.stringify(events)).not.toContain('Mein privater Schritt')
    expect(events.find((e) => e.key === 'evening')!.title).not.toContain('darfst')
    expect(events.find((e) => e.key === 'morning')!.body).toBe('Dein nächster Schritt steht in Anker bereit.')
  })

  it('prüft private Hinweise und Deadlines gegen die gleichen absoluten Freizeitfenster', () => {
    const s = defaultSettings(date)
    const quiet = { ...plan, quiet: [[18 * 60, 20 * 60]] as [number, number][] }
    const deadline = zonedToUtc(date, 20 * 60)
    const extras = { deadlines: [{ id: 'work', at: deadline }] }
    expect(buildReminders([quiet], {}, s, now, undefined, extras).some((e) => e.key === 'deadline-hour:work')).toBe(false)
    expect(reminderRevisions([quiet], {}, s, extras)[`${date}|deadline-hour:work`]).toBeUndefined()
    expect(reminderPolicy([quiet], s).ranges).toEqual([{ from: zonedToUtc(date, 18 * 60), to: zonedToUtc(date, 20 * 60) }])
  })
})

import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { buildDayPlan } from '../planner'
import { zonedToUtc } from '../time'
import { currentReminderAction, type ReminderAction } from './actions'
import { buildReminders, reminderRevision, reminderRevisions, type ReminderExtras } from './build'

const date = '2026-11-02'
const settings = defaultSettings(date)
const plans = [buildDayPlan({ date, settings })]
const at = zonedToUtc(date, 17 * 60)
const now = zonedToUtc(date, 5 * 60)

function source(reminderRevision?: string, deadline = at): ReminderExtras {
  return { deadlines: [{ id: 'task-1', at: deadline, ...(reminderRevision === undefined ? {} : { reminderRevision }) }] }
}
function action(extras: ReminderExtras): ReminderAction {
  const event = buildReminders(plans, {}, settings, now, 48 * 3600_000, extras).find((event) => event.key === 'deadline-hour:task-1')!
  expect(event).toBeDefined()
  return { id: 'native-done', action: 'done', key: event.key, date: event.date, at: event.at, revision: event.revision, token: event.token }
}
const current = (value: ReminderAction, extras: ReminderExtras) => currentReminderAction(value, plans, {}, settings, extras, at)

describe('Deadline-Aktionen gehören zum unveränderten Aufgabenstand', () => {
  it.each(['Erledigt → Rückgängig', 'Abgesagt → Wieder öffnen'])('verwirft alten nativen Abschluss nach %s', () => {
    const old = action(source('before-user-change'))
    expect(current(old, source('before-user-change'))).toBe(true)
    expect(current(old, { deadlines: [] })).toBe(false)
    const reopened = source('after-user-change')
    expect(current(old, reopened)).toBe(false)
    expect(current(action(reopened), reopened)).toBe(true)
  })

  it('verwirft einen alten Abschluss bei geänderter Deadline auch mit derselben Aufgabenrevision', () => {
    const old = action(source('same-task-epoch'))
    expect(current(old, source('same-task-epoch', at + 60_000))).toBe(false)
  })

  it('behält Revision und Zustellungstoken bei einem unveränderten Neuaufbau', () => {
    const extras = source('stable-task-epoch')
    const first = action(extras)
    const rebuilt = action(structuredClone(extras))
    expect(rebuilt).toEqual(first)
    const revisions = reminderRevisions(plans, {}, settings, extras)
    for (const event of buildReminders(plans, {}, settings, now, 48 * 3600_000, extras).filter((event) => event.key.startsWith('deadline-'))) {
      expect(event.revision).toBe(revisions[`${event.date}|${event.key}`])
      expect(event.token).toContain(event.revision)
      expect(JSON.stringify(event)).not.toContain('stable-task-epoch')
    }
  })

  it('behält für alte Aufgaben ohne Zusatzfeld exakt die bisherigen Revisionswerte', () => {
    const extras = source()
    const revisions = reminderRevisions(plans, {}, settings, extras)
    for (const key of ['deadline-day:task-1', 'deadline-hour:task-1']) {
      expect(revisions[`${date}|${key}`]).toBe(reminderRevision([date, key, at]))
    }
    expect(current(action(extras), extras)).toBe(true)
  })
})

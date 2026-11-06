import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import { buildDayPlan } from '../planner'
import { zonedToUtc } from '../time'
import type { InboxItem, TomorrowStep } from '../types'
import { buildReminders, relevantReminderKeys } from './build'

const date = '2026-11-02'
const now = zonedToUtc(date, 5 * 60)
const at = zonedToUtc(date, 21 * 60)
const thought: InboxItem = { id: 'idea', text: 'Sehr privater Gedanke', status: 'open', createdAt: now, reviewAt: at, reviewNotify: true }
const step: TomorrowStep = { id: 'step', title: 'Privates Projekt', nextStep: 'Geheimes Detail', createdAt: now, resumeAt: at, remind: true }

describe('Freiwillige Abendhinweise', () => {
  it('ersetzt nur eingeschaltet die PC-/Bett-Meldungen durch genau einen sanften Hinweis', () => {
    const settings = defaultSettings(date)
    const plan = buildDayPlan({ date, settings })
    expect(buildReminders([plan], {}, settings, now).some((entry) => entry.key === 'pcstop')).toBe(true)
    settings.support.windDown.enabled = true
    settings.reminders.intensity = 'persistent'
    const entries = buildReminders([plan], {}, settings, now)
    expect(entries.filter((entry) => entry.key === 'wind-down')).toHaveLength(1)
    expect(entries.find((entry) => entry.key === 'wind-down')).toMatchObject({ channel: 'sanft', escalation: 0, actions: false, exact: false })
    expect(entries.some((entry) => ['pcstop-15', 'pcstop', 'bed'].includes(entry.key))).toBe(false)
    expect(entries.some((entry) => entry.key === 'leave')).toBe(true)
  })

  it('plant private Inhalte nur nach Opt-in und verrät keine Inhalte im Meldungstext', () => {
    const settings = defaultSettings(date)
    const extras = { thoughtReviews: [thought], tomorrowSteps: [step] }
    const entries = buildReminders([], {}, settings, now, 48 * 3600_000, extras)
    expect(entries).toHaveLength(2)
    expect(entries.every((entry) => entry.channel === 'sanft' && !entry.actions && entry.escalation === 0)).toBe(true)
    expect(entries.map((entry) => entry.title + entry.body).join()).not.toMatch(/Sehr privater|Privates Projekt|Geheimes Detail/)
    expect(buildReminders([], {}, settings, now, undefined, { thoughtReviews: [{ ...thought, reviewNotify: false }], tomorrowSteps: [{ ...step, remind: false }] })).toEqual([])
  })

  it('hält entfernte oder erledigte Einträge nicht mehr relevant und holt alte Hinweise nicht nach', () => {
    const settings = defaultSettings(date)
    expect(relevantReminderKeys([], {}, settings, { thoughtReviews: [thought], tomorrowSteps: [step] })).toContain(`${date}|thought-review:idea`)
    expect(relevantReminderKeys([], {}, settings, { thoughtReviews: [{ ...thought, status: 'kept' }], tomorrowSteps: [{ ...step, doneAt: at }] })).toEqual([])
    expect(buildReminders([], {}, settings, at + 1, undefined, { thoughtReviews: [thought], tomorrowSteps: [step] })).toEqual([])
    const logs = { [date]: { date, override: {}, steps: {}, dismissed: ['thought-review:idea'] } }
    expect(buildReminders([], logs, settings, now, undefined, { thoughtReviews: [thought] })).toEqual([])
  })

  it('respektiert Ruhezeiten und ordnet einen Hinweis nach Mitternacht dem Vorabend zu', () => {
    const settings = defaultSettings(date)
    settings.support.windDown = { enabled: true, at: 30, activity: 'Lesen' }
    const plan = buildDayPlan({ date, settings })
    expect(buildReminders([plan], {}, settings, now).filter((entry) => entry.key === 'wind-down')).toEqual([])
    settings.reminders.quietStart = 5 * 60
    settings.reminders.quietEnd = 6 * 60
    const entry = buildReminders([plan], {}, settings, now).find((item) => item.key === 'wind-down')
    expect(entry?.at).toBe(zonedToUtc('2026-11-03', 30))
    settings.support.windDown.enabled = false
    expect(relevantReminderKeys([plan], {}, settings)).not.toContain(`${date}|wind-down`)
  })
})

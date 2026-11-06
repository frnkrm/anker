import { buildDayPlan } from '../planner'
import { addDays, minutesOnPlanDay, zonedToUtc } from '../time'
import type { Settings } from '../types'
import { buildReminders, type Channel } from './build'

/** A weekly baseline compiled by the existing planner, not a second planning model. */
export interface NativeReminderRule {
  ruleId: string
  key: string
  /** Monday=0, matching the existing Settings.work profile. */
  weekday: number
  /** Minutes on the logical plan day; 00:30 after the evening is1470. */
  minute: number
  channel: Channel
  title: string
  body: string
  slot: 0 | 1 | 2
  rank: number
  exact: boolean
  revision: string
}

export interface NativeReminderRuleSnapshot {
  /** Exact dated planning owns all events before this UTC boundary. */
  validFrom: number
  /** Logical plan dates with known exceptions; no baseline is invented for these dates. */
  excludedDates: string[]
  rules: NativeReminderRule[]
}

const REFERENCE_MONDAY = '2026-01-05'
const CRITICAL_BASE_KEYS = new Set(['leave', 'latest-leave', 'latest-start', 'pcstop', 'bed', 'meds'])

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const ms = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value
}

/**
 * After dated snapshots end, only explicitly configured critical baseline roles continue.
 * No appointments, private task contents, escalation or assumed completion is projected.
 */
export function buildReminderRuleSnapshot(settings: Settings, knownExcludedDates: readonly string[], validFrom: number): NativeReminderRuleSnapshot {
  if (!Number.isSafeInteger(validFrom) || validFrom < 0 || !Number.isFinite(new Date(validFrom).getTime())) throw new RangeError('Ungültiger Beginn der Erinnerungsregeln.')
  const plans = Array.from({ length: 7 }, (_, offset) => buildDayPlan({ date: addDays(REFERENCE_MONDAY, offset), settings }))
  const start = zonedToUtc(REFERENCE_MONDAY, 0)
  const entries = buildReminders(plans, {}, settings, start - 1, 9 * 24 * 3600_000)
  const rules: NativeReminderRule[] = []
  for (let weekday = 0; weekday < plans.length; weekday++) {
    const date = plans[weekday]!.date
    for (const entry of entries) {
      if (entry.date !== date || entry.escalation !== 0 || !CRITICAL_BASE_KEYS.has(entry.key)) continue
      const rule = {
        ruleId: `basis:${weekday}:${entry.key}`,
        key: entry.key,
        weekday,
        minute: minutesOnPlanDay(date, entry.at),
        channel: entry.channel,
        title: entry.title,
        body: entry.body,
        slot: entry.slot,
        rank: entry.rank,
        exact: entry.exact,
      }
      // Complete canonical content avoids collision-prone short hashes for stale-rule checks.
      rules.push({ ...rule, revision: JSON.stringify(rule) })
    }
  }
  return { validFrom, excludedDates: [...new Set(knownExcludedDates.filter(validDate))].sort(), rules }
}

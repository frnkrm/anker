import { describe, expect, it } from 'vitest'
import { applySchedule, defaultSettings, emptyLocal } from './defaults'
import { validatedRecords } from './export/backup'
import { createCountdown, pauseCountdown } from './focus'
import { buildDayPlan } from './planner'
import { buildReminders } from './reminders/build'
import { addDays, zonedToUtc } from './time'
import { buildTimeCatalog, currentTimeCatalog, timeCatalogPlanDates, timeCatalogSourceRevision, validTimeCatalog, type TimeCatalogRuntime, type TimeCatalogState } from './timeCatalog'

const date = '2026-11-02'
const now = zonedToUtc(date, 5 * 60)
const state = (): TimeCatalogState => ({ settings: defaultSettings(date), days: {}, local: emptyLocal(), inbox: [], events: [] })
function build(st: TimeCatalogState, at = now, runtime?: TimeCatalogRuntime) {
  const plans = timeCatalogPlanDates(st, at).map((day) => buildDayPlan({ date: day, settings: st.settings, override: st.days[day]?.override,
    events: st.events, commitments: st.local.commitments.filter((c) => c.date === day), places: st.local.places }))
  return buildTimeCatalog({ ...st, nowMs: at, plans, runtime })
}

describe('Abgeleitete Zeitübersicht', () => {
  it('ordnet echte v7-Abendzeiten ein und erklärt ersetzte Alt-Hinweise ohne Doppelwarnung', () => {
    const st = state()
    st.settings.guidance = { enabled: true, eveningEscalation: true }
    st.settings.anchor.manual = { ...st.settings.anchor.manual, bed: true, pcStop: true }
    st.settings.bed = 23 * 60; st.settings.pcStop = 22 * 60
    st.settings.support.windDown = { enabled: true, at: 21 * 60, activity: 'Lesen' }
    st.days[date] = { date, override: {}, steps: {}, eveningRoutineDoneAt: now }
    const result = build(st)
    const roles = ['guidance-wind-down', 'guidance-brain-dump', 'bed']
    const active = result.entries.filter(entry => entry.source.date === date && roles.includes(entry.source.refId ?? '') && entry.status === 'planned')
    expect(active.map(entry => [entry.source.refId, entry.at])).toEqual(buildReminders([buildDayPlan({ date, settings: st.settings })], st.days, st.settings, result.rangeStart - 1).filter(entry => roles.includes(entry.key)).map(entry => [entry.key, entry.at]))
    expect(active).toHaveLength(3)
    expect(active.every(entry => entry.category === 'sleep' && entry.source.route === '/einstellungen/begleitung')).toBe(true)
    const replaced = result.entries.filter(entry => entry.source.date === date && ['reminder.wind-down', 'reminder.pcstop', 'reminder.pcstop-15'].includes(entry.functionId))
    expect(replaced).toHaveLength(3)
    expect(replaced.every(entry => entry.status === 'inactive' && entry.reason?.includes('Abend & Morgen begleiten') && entry.source.route === '/einstellungen/begleitung')).toBe(true)
    expect(result.suggestions.some(suggestion => suggestion.kind === 'overlap' && suggestion.entryIds.some(id => replaced.some(entry => entry.id === id)))).toBe(false)
    st.days[date]!.bedAt = now
    expect(build(st).entries.filter(entry => entry.source.date === date && roles.includes(entry.source.refId ?? '') && entry.status === 'planned')).toEqual([])
    const far = addDays(date, 20)
    st.settings.reminders.quietStart = 4 * 60; st.settings.reminders.quietEnd = 5 * 60
    st.days[far] = { date: far, override: { lateUntil: 23 * 60 + 20 }, steps: {} }
    expect(build(st).entries.filter(entry => entry.source.date === far && roles.includes(entry.source.refId ?? '') && entry.status === 'planned').map(entry => entry.source.refId)).toEqual(roles)
  })
  it('übernimmt genau die aktiven Erinnerungsregeln und kennzeichnet die bereits abgestimmten Abendhinweise', () => {
    const st = state()
    st.settings.support.windDown = { enabled: true, at: st.settings.pcStop, activity: 'Lesen' }
    const before = structuredClone(st)
    const result = build(st)
    const active = result.entries.filter((entry) => entry.source.date === date && entry.source.kind === 'reminder' && entry.status === 'planned')
    const plan = buildDayPlan({ date, settings: st.settings })
    expect(active.map((entry) => [entry.source.refId, entry.at])).toEqual(buildReminders([plan], {}, st.settings, result.rangeStart - 1)
      .map((entry) => [entry.key, entry.at]))
    expect(result.entries.filter((entry) => entry.source.date === date && ['reminder.pcstop-15', 'reminder.pcstop', 'reminder.bed'].includes(entry.functionId)))
      .toEqual(expect.arrayContaining([expect.objectContaining({ status: 'inactive', reason: expect.stringContaining('Bereits abgestimmt') })]))
    expect(result.entries.find((entry) => entry.functionId === 'pc.stop-command' && entry.source.date === date))
      .toMatchObject({ status: 'conditional', effect: 'pc-command' })
    expect(result.entries.find((entry) => entry.functionId === 'plan.morning' && entry.source.date === date)?.source.route).toBe('/einstellungen/morgenroutine')
    expect(result.entries.find((entry) => entry.functionId === 'plan.evening-routine' && entry.source.date === date)?.source.route).toBe('/einstellungen/abendroutine')
    const windDownIds = result.entries.filter((entry) => entry.functionId === 'reminder.wind-down').map((entry) => entry.id)
    expect(result.suggestions.filter((suggestion) => suggestion.kind === 'overlap' && suggestion.entryIds.some((id) => windDownIds.includes(id)))).toEqual([])
    expect(st).toEqual(before)
  })

  it('schlägt nur bei zwei aktiven Hinweisrollen einen Blick auf die Quellen vor', () => {
    const st = state()
    st.settings.support.windDown = { enabled: true, at: 21 * 60, activity: 'Lesen' }
    st.settings.alarm.medicationEnabled = true
    st.settings.alarm.medicationReminderAt = 21 * 60
    const result = build(st)
    const overlap = result.suggestions.find((suggestion) => suggestion.kind === 'overlap')!
    expect(overlap).toBeDefined()
    const affected = result.entries.filter((entry) => overlap.entryIds.includes(entry.id))
    expect(affected.map((entry) => entry.functionId).sort()).toEqual(['reminder.meds', 'reminder.wind-down'])
    expect(affected.every((entry) => entry.status === 'planned' && entry.effect === 'notification')).toBe(true)
    expect(overlap.route).toMatch(/^\//)
    expect(st.settings.support.windDown.enabled).toBe(true)
    expect(st.settings.alarm.medicationEnabled).toBe(true)
  })

  it('vergleicht tatsächliche UTC-Zeiten auch bei unterschiedlichen Plantagen und mehreren Daten derselben Funktion', () => {
    const st = state()
    st.settings.support.windDown = { enabled: true, at: 21 * 60, activity: 'Lesen' }
    const at = zonedToUtc(date, 21 * 60)
    st.local.work = [{ id: 'tomorrow', title: 'Morgen', createdAt: now, deadline: at + 24 * 3600_000 }]
    st.inbox = ['a', 'b'].map((id) => ({ id, text: id, status: 'open' as const, createdAt: now, reviewAt: at, reviewNotify: true }))
    const result = build(st)
    const overlap = result.suggestions.find((suggestion) => suggestion.kind === 'overlap'
      && suggestion.entryIds.some((id) => result.entries.find((entry) => entry.id === id)?.functionId === 'reminder.deadline-day'))!
    expect(overlap).toBeDefined()
    const group = result.entries.filter((entry) => overlap.entryIds.includes(entry.id))
    expect(new Set(group.map((entry) => entry.at))).toEqual(new Set([at]))
    expect(new Set(group.map((entry) => entry.source.date)).size).toBe(2)
    expect(group.filter((entry) => entry.functionId === 'reminder.thought-review')).toHaveLength(2)
  })

  it('verwendet den Bildschirmabstand ausschließlich als Berechnung und bewahrt die manuelle PC-Zeit', () => {
    const st = state()
    st.settings.anchor.manual = { pcStop: true, bed: true }
    st.settings.pcStop = 21 * 60 + 45
    st.settings.bed = 23 * 60
    st.settings.sleep.screenOffMin = 60
    st.settings = applySchedule(st.settings)
    const result = build(st)
    expect(st.settings.pcStop).toBe(21 * 60 + 45)
    expect(result.entries.find((entry) => entry.functionId === 'sleep.screen-off-calculation' && entry.source.date === date))
      .toMatchObject({ at: zonedToUtc(date, 22 * 60), status: 'inactive', effect: 'calculation', reason: expect.stringContaining('manuelle') })
    expect(result.entries.find((entry) => entry.functionId === 'pc.stop-command' && entry.source.date === date)?.at).toBe(zonedToUtc(date, 21 * 60 + 45))
  })

  it('respektiert Kranktage und deaktivierte Vor-/Hauptwecker ohne einen Ersatzwecker zu erfinden', () => {
    const st = state()
    st.settings.alarm.preWakeEnabled = true
    st.days[date] = { date, override: { dayType: 'sick' }, steps: {} }
    const result = build(st)
    expect(result.entries.find((entry) => entry.functionId === 'alarm.main' && entry.source.date === date)).toMatchObject({ status: 'inactive' })
    expect(result.entries.find((entry) => entry.functionId === 'alarm.prewake' && entry.source.date === date)).toMatchObject({ status: 'inactive' })
    expect(result.entries.find((entry) => entry.functionId === 'reminder.pcstop' && entry.source.date === date)?.status).toBe('inactive')
    expect(result.entries.some((entry) => entry.functionId === 'reminder.review' && entry.source.date === date && entry.status === 'planned')).toBe(false)
    st.settings.alarm.enabled = false
    st.settings.alarm.preWakeLeadMinutes = 0
    const disabled = build(st)
    expect(disabled.entries.filter((entry) => entry.functionId === 'alarm.main').every((entry) => entry.status === 'inactive')).toBe(true)
    expect(disabled.entries.filter((entry) => entry.functionId === 'alarm.prewake')).toEqual([expect.objectContaining({ status: 'inactive' })])
    expect(disabled.entries.find((entry) => entry.functionId === 'alarm.prewake')?.at).toBeUndefined()
  })

  it('führt Mitternachts-Abendhinweise am richtigen Plantag und wechselt den Horizont erst um 04 Uhr', () => {
    const st = state()
    st.settings.support.windDown = { enabled: true, at: 30, activity: 'Lesen' }
    st.settings.reminders.quietStart = 5 * 60
    st.settings.reminders.quietEnd = 6 * 60
    const before = build(st, zonedToUtc('2026-11-03', 3 * 60 + 30))
    expect(before.planDate).toBe(date)
    expect(before.entries.find((entry) => entry.functionId === 'reminder.wind-down' && entry.source.date === date)?.at).toBe(zonedToUtc('2026-11-03', 30))
    const after = build(st, zonedToUtc('2026-11-03', 4 * 60))
    expect(after.planDate).toBe('2026-11-03')
    expect(after.entries.some((entry) => entry.source.date === date)).toBe(false)
    expect(after.rangeEnd).toBe(zonedToUtc('2026-11-17', 4 * 60))
  })

  it('begrenzt Wiederholungen auf 14 Tage und bewahrt ausdrücklich bekannte Einzelzeiten außerhalb', () => {
    const st = state()
    const far = addDays(date, 40)
    const at = zonedToUtc(far, 12 * 60)
    st.local.work = [{ id: 'w', title: 'Vertrauliche Arbeit', createdAt: now, earliestStart: at + 3600_000, deadline: at }]
    st.inbox = [{ id: 'idea', text: 'Vertraulicher Gedanke', createdAt: now, status: 'open', reviewAt: at, reviewNotify: true }]
    st.local.tomorrowSteps = [{ id: 'step', title: 'Privates Projekt', nextStep: 'Ein Schritt', createdAt: now, resumeAt: at, remind: true }]
    st.local.commitments = [{ id: 'visit', date: far, label: 'Ein Termin', start: 12 * 60, end: 13 * 60, travelMin: 20, locationKind: 'onsite', context: 'personal', commitment: 'hard' }]
    st.events = [{ id: 'calendar', title: 'Kalender', start: at + 3 * 3600_000, end: at + 4 * 3600_000 }]
    st.days[far] = { date: far, override: { wakeOverride: 7 * 60 }, steps: {} }
    st.settings.alarm.preWakeEnabled = true
    st.settings.alarm.preWakeLeadMinutes = 30
    st.settings.alarm.smartWake.enabled = true
    const before = structuredClone(st)
    const result = build(st)
    expect(result.entries.filter((entry) => entry.functionId === 'alarm.main' && entry.source.date !== far)).toHaveLength(14)
    expect(result.entries.filter((entry) => entry.functionId === 'alarm.main' && entry.source.date === far)).toHaveLength(1)
    expect(result.entries.find((entry) => entry.functionId === 'alarm.prewake' && entry.source.date === far))
      .toMatchObject({ at: zonedToUtc(far, 6 * 60 + 30), status: 'planned', effect: 'alarm' })
    expect(result.entries.find((entry) => entry.functionId === 'alarm.smart-window' && entry.source.date === far))
      .toMatchObject({ at: zonedToUtc(far, 7 * 60) - st.settings.alarm.smartWake.windowMinutes * 60_000, endAt: zonedToUtc(far, 7 * 60), status: 'conditional', effect: 'check' })
    expect(result.entries.some((entry) => entry.functionId === 'plan.morning' && entry.source.date === far)).toBe(false)
    for (const functionId of ['task.earliest', 'task.deadline', 'thought.review', 'tomorrow.resume', 'calendar.event', 'commitment.start', 'travel.departure']) {
      expect(result.entries.some((entry) => entry.functionId === functionId && entry.source.date === far), functionId).toBe(true)
    }
    expect(result.entries.some((entry) => entry.functionId === 'reminder.deadline-hour' && entry.at === at - 3600_000)).toBe(true)
    expect(result.suggestions).toContainEqual(expect.objectContaining({ kind: 'order', title: 'Start liegt nach der Frist', route: '/aufgabe/work/w' }))
    expect(result.entries.filter((entry) => entry.at !== undefined).map((entry) => entry.at)).toEqual(result.entries.filter((entry) => entry.at !== undefined).map((entry) => entry.at).sort((a, b) => a! - b!))
    expect(new Set(result.entries.map((entry) => entry.id)).size).toBe(result.entries.length)
    expect(st).toEqual(before)
  })

  it('erfindet keine Schlummer-/Check-/native Einschlafzeit und verwendet nur frische echte Momentaufnahmen', () => {
    const st = state()
    const empty = build(st)
    expect(empty.entries.find((entry) => entry.functionId === 'alarm.snooze')).toMatchObject({ status: 'conditional', evidence: 'calculated' })
    expect(empty.entries.find((entry) => entry.functionId === 'alarm.snooze')?.at).toBeUndefined()
    expect(empty.entries.find((entry) => entry.functionId === 'sleep.native-prompt')).toMatchObject({ status: 'conditional', source: { route: '/' } })
    expect(empty.entries.find((entry) => entry.functionId === 'sleep.native-prompt')?.at).toBeUndefined()
    const runtime: TimeCatalogRuntime = { alarm: { observedAt: now, state: { snoozeAt: now + 5 * 60_000, wakeCheckAt: now + 10 * 60_000 } },
      bedtimePrompt: { observedAt: now, state: { phase: 'waiting', dueAt: now + 20 * 60_000, sessionId: 'one-shot' } } }
    const fresh = build(st, now, runtime)
    expect(fresh.entries.find((entry) => entry.functionId === 'alarm.snooze' && entry.at)).toMatchObject({ at: now + 5 * 60_000, evidence: 'native-snapshot' })
    expect(fresh.entries.find((entry) => entry.functionId === 'sleep.native-prompt')).toMatchObject({ status: 'planned', evidence: 'native-snapshot', source: { refId: 'one-shot', route: '/' } })
    const stale = build(st, now + 2 * 60_000, runtime)
    expect(stale.entries.some((entry) => entry.evidence === 'native-snapshot')).toBe(false)
    expect(stale.entries.find((entry) => entry.functionId === 'sleep.native-prompt')).toMatchObject({ status: 'conditional' })
    expect(stale.entries.find((entry) => entry.functionId === 'sleep.native-prompt')?.at).toBeUndefined()
    const unconfirmed = build(st, now, { alarm: { observedAt: now, state: { scheduledAt: now + 20 * 60_000, mainConfirmed: false } } })
    expect(unconfirmed.entries.find((entry) => entry.functionId === 'alarm.main' && entry.source.kind === 'native')?.reason).toContain('ohne bestätigte Planung')
    expect(unconfirmed.suggestions).toContainEqual(expect.objectContaining({ title: 'Gerätestand und Berechnung weichen ab' }))
  })

  it('bewahrt einzelne datierte Abend-/Routinenentscheidungen und Weghinweise außerhalb des Horizonts', () => {
    const st = state()
    const far = addDays(date, 50)
    st.days[far] = { date: far, steps: {}, override: { lateUntil: 24 * 60 + 30, routineAt: { evening: 20 * 60 } } }
    st.local.commitments = [{ id: 'visit', date: far, label: 'Ein Termin', start: 14 * 60, end: 15 * 60, travelMin: 20, locationKind: 'onsite', placeLabel: 'Bewusster Ort', context: 'personal', commitment: 'hard' }]
    const result = build(st)
    for (const role of ['reminder.go', 'reminder.prep', 'reminder.pcstop', 'pc.stop-command', 'plan.bedtime', 'plan.evening-routine']) {
      expect(result.entries.some((entry) => entry.functionId === role && entry.source.date === far), role).toBe(true)
    }
    expect(result.entries.filter((entry) => entry.functionId === 'alarm.main')).toHaveLength(14)
    expect(result.entries.some((entry) => entry.functionId === 'reminder.wind-down' && entry.source.date === far)).toBe(false)
    const bedtime = result.entries.find((entry) => entry.functionId === 'plan.bedtime' && entry.source.date === far)!
    expect(bedtime.at).toBeGreaterThan(zonedToUtc(addDays(far, 1), 30))
  })

  it('führt einen beendeten Schlafhinweis mit alter Fälligkeit als Quelle ohne Termin', () => {
    for (const dueAt of [now - 86400_000, now + 20 * 60_000]) {
      const result = build(state(), now, { bedtimePrompt: { observedAt: now, state: { phase: 'idle', sessionId: 'stopped', dueAt } } })
      const entry = result.entries.find((item) => item.functionId === 'sleep.native-prompt')!
      expect(entry).toMatchObject({ status: 'inactive', evidence: 'native-snapshot', source: { refId: 'stopped', route: '/' } })
      expect(entry.at).toBeUndefined()
    }
  })

  it('projiziert Pausen ohne erfundene Endzeit und zeigt Aufräumen nur aus einem tatsächlichen lokalen Start', () => {
    const st = state()
    st.local.focus = { id: 'focus', target: { kind: 'work', id: 'w', partId: 'p' }, timer: pauseCountdown(createCountdown(600, now - 60_000), now) }
    const paused = build(st)
    expect(paused.entries.find((entry) => entry.functionId === 'focus.end')).toMatchObject({ status: 'paused', source: { route: '/aufgabe/work/w?teil=p' } })
    expect(paused.entries.find((entry) => entry.functionId === 'focus.end')?.at).toBeUndefined()
    expect(paused.entries.some((entry) => entry.functionId === 'focus.pulse')).toBe(false)
    expect(paused.entries.find((entry) => entry.functionId === 'tidy.end')).toMatchObject({ status: 'conditional' })
    expect(paused.entries.find((entry) => entry.functionId === 'tidy.end')?.at).toBeUndefined()
    st.local.focus.timer = createCountdown(600, now)
    const before = structuredClone(st)
    const running = build(st, now, { tidy: { date, startedAt: now - 60_000 } })
    expect(running.entries.find((entry) => entry.functionId === 'focus.end')).toMatchObject({ at: now + 600_000, effect: 'display' })
    expect(running.entries.find((entry) => entry.functionId === 'tidy.end')?.at).toBe(now + 9 * 60_000)
    expect(st).toEqual(before)
  })

  it('bewertet Cachealter, neue Quellen und native Evidenz getrennt ohne Selbstinvalidierung', () => {
    const st = state()
    const runtime: TimeCatalogRuntime = { alarm: { observedAt: now, state: { snoozeAt: now + 5 * 60_000 } } }
    const revision = timeCatalogSourceRevision(st, now)
    st.local.timeCatalog = build(st, now, runtime)
    expect(validTimeCatalog(st.local.timeCatalog)).toBe(true)
    expect(timeCatalogSourceRevision(st, now)).toBe(revision)
    expect(currentTimeCatalog(st, now)).toBe(st.local.timeCatalog)
    expect(currentTimeCatalog(st, now, runtime)).toBe(st.local.timeCatalog)
    expect(currentTimeCatalog(st, now, {})).toBeUndefined()
    expect(currentTimeCatalog(st, st.local.timeCatalog.validUntil)).toBeUndefined()
    st.settings.support.windDown.enabled = true
    expect(currentTimeCatalog(st, now)).toBeUndefined()
    expect(validTimeCatalog({ ...st.local.timeCatalog, entries: [{ ...st.local.timeCatalog.entries[0], source: { kind: 'native', route: '//outside.invalid' } }] })).toBe(false)
  })

  it('erhält erlaubte große Altbestände und Bruchteile von UTC-Millisekunden ohne selbst ungültigen Cache', () => {
    const st = state()
    st.local.work = Array.from({ length: 2001 }, (_, n) => ({ id: `w-${n}`, title: `Aufgabe ${n}`, createdAt: now, earliestStart: now + 7200_000.5, deadline: now + 3600_000.25 }))
    expect(validatedRecords([{ collection: 'meta', id: 'local', updated_at: now, deleted: false, data: st.local }])).toHaveLength(1)
    const result = build(st)
    expect(result.suggestions.filter((suggestion) => suggestion.title === 'Start liegt nach der Frist')).toHaveLength(2001)
    expect(result.entries.filter((entry) => entry.functionId === 'task.earliest')).toHaveLength(2001)
    expect(result.entries.find((entry) => entry.functionId === 'task.earliest')?.at).toBe(now + 7200_000.5)
    expect(validTimeCatalog(result)).toBe(true)
    st.local.timeCatalog = result
    expect(currentTimeCatalog(st, now)).toBe(result)
  })
})

import { describe, expect, it } from 'vitest'
import { alarmPlanningStatus, buildAlarmConfig, nextAlarmTimes } from './alarm'
import { applySchedule, defaultSettings, migrateSettings, resetToSuggested } from './defaults'
import { activePlanDate } from './now'
import { buildReminders } from './reminders/build'
import { buildDayPlan } from './planner'
import { todayBerlin, zonedToUtc } from './time'
import type { Settings } from './types'

const s = () => defaultSettings('2026-11-01')

describe('Ehrliche Weckerplanung (AL-07 / Q09)', () => {
  const state = { scheduledAt: 1000, mainConfirmed: true, exact: true }
  it('zeigt weder ungenaue Planung noch einen Fehler als Erfolg', () => {
    for (const patch of [{ exact: false }, { error: 'exact_denied' }, { error: 'ring_start_failed' }, { error: 'foreground_denied' }, { error: 'unknown' }]) {
      expect(alarmPlanningStatus({ ...state, ...patch }, true).ok).toBe(false)
    }
  })
  it('trennt hinterlegte Planung von tatsächlicher Zustellung und Hörbarkeit', () => {
    expect(alarmPlanningStatus(state, true)).toMatchObject({ ok: true, scheduledAt: 1000 })
    expect(alarmPlanningStatus(state, true).message).toMatch(/prüfst du mit einem Test/)
    for (const patch of [{ scheduledAt: 0 }, { scheduledAt: NaN }, { mainConfirmed: false }, { exact: undefined }]) {
      expect(alarmPlanningStatus({ ...state, ...patch }, true).ok).toBe(false)
    }
  })
  it('erzeugt für bewusst ausgeschalteten Hauptwecker keinen Alarmfehler', () => {
    expect(alarmPlanningStatus({ ...state, error: 'exact_denied' }, false)).toMatchObject({ ok: true, message: 'Der Hauptwecker ist ausgeschaltet.' })
  })
})

describe('native Wecker-Konfiguration', () => {
  it('aktiviert v7 nur nach eigener Wahl und bewahrt vorhandene Weckzeiten', () => {
    const base = s()
    base.alarm.preWakeEnabled = true
    base.alarm.preWakeLeadMinutes = 45
    base.guidance = { enabled: false, preWakeFadeIn: true, antiRelapse: true, antiRelapseMinutes: 7, zeroGapMorning: true }
    expect(buildAlarmConfig(base, {}, '2026-11-04')).toMatchObject({
      preWakeLeadMinutes: 45, preWakeFadeIn: false, antiRelapseEnabled: false, zeroGapEnabled: false,
    })
    base.guidance.enabled = true
    expect(buildAlarmConfig(base, {}, '2026-11-04')).toMatchObject({
      preWakeLeadMinutes: 45, preWakeFadeIn: true, antiRelapseEnabled: true, antiRelapseDelayMinutes: 7,
      zeroGapEnabled: true, wakeCheckEnabled: true,
    })
    base.guidance.enabled = false
    base.alarm.wakeCheckEnabled = true
    expect(buildAlarmConfig(base, {}, '2026-11-04').wakeCheckEnabled).toBe(true)
  })

  it('überspringt kranke Tage, nur ab heute und nur diese', () => {
    const c = buildAlarmConfig(
      s(),
      {
        '2026-11-03': { date: '2026-11-03', override: { dayType: 'sick' }, steps: {} },
        '2026-11-05': { date: '2026-11-05', override: { dayType: 'sick' }, steps: {} },
        '2026-11-06': { date: '2026-11-06', override: { dayType: 'vacation' }, steps: {} },
      },
      '2026-11-04',
    )
    expect(c.skipDates).toEqual(['2026-11-05'])
  })

  it('enthält weder QR-Code noch Einnahmedaten', () => {
    const text = JSON.stringify(buildAlarmConfig(s(), {}, '2026-11-04'))
    expect(text).not.toContain('ANKER-WACH')
    expect(text).not.toMatch(/medi|meds/i)
  })

  it('Kranktag wirkt nur einmal: danach klingelt es wieder', () => {
    const base = s()
    const c = buildAlarmConfig(base, { '2026-11-05': { date: '2026-11-05', override: { dayType: 'sick' }, steps: {} } }, '2026-11-04')
    expect(nextAlarmTimes(c, zonedToUtc('2026-11-04', 720)).mainAt).toBe(zonedToUtc('2026-11-06', base.anchor.wake))
  })

  it('Vorwecker aus: kein zweiter Zeitpunkt. Vorwecker an: Hauptwecker unverändert', () => {
    const base = s()
    const now = zonedToUtc('2026-11-04', 60)
    const off = nextAlarmTimes(buildAlarmConfig(base, {}, '2026-11-04'), now)
    expect(off.preWakeAt).toBe(0)
    base.alarm.preWakeEnabled = true
    base.alarm.preWakeLeadMinutes = 45
    const on = nextAlarmTimes(buildAlarmConfig(base, {}, '2026-11-04'), now)
    expect(on.mainAt).toBe(off.mainAt)
    expect(on.preWakeAt).toBe(off.mainAt - 45 * 60_000)
  })

  it('stimmt mit den Kotlin-Vektoren überein, auch über die Zeitumstellung', () => {
    const c = { ...buildAlarmConfig(s(), {}, '2026-03-28'), wakeMinutes: 370 }
    expect(nextAlarmTimes(c, zonedToUtc('2026-03-28', 720)).mainAt).toBe(Date.parse('2026-03-29T04:10:00Z'))
    expect(nextAlarmTimes(c, zonedToUtc('2026-10-24', 720)).mainAt).toBe(Date.parse('2026-10-25T05:10:00Z'))
    expect(zonedToUtc('2026-03-29', 150)).toBe(Date.parse('2026-03-29T01:30:00Z'))
  })

  it('04:00-Wechsel: nachts gilt noch der Vortag, der Wecker trotzdem am richtigen Morgen', () => {
    const night = zonedToUtc('2026-11-05', 120)
    expect(activePlanDate(night, todayBerlin)).toBe('2026-11-04')
    const c = buildAlarmConfig(s(), {}, '2026-11-04')
    expect(nextAlarmTimes(c, night).mainAt).toBe(zonedToUtc('2026-11-05', s().anchor.wake))
  })

  it('Wecker aus: keine Zeiten', () => {
    const base = s()
    base.alarm.enabled = false
    expect(nextAlarmTimes(buildAlarmConfig(base, {}, '2026-11-04'), 0)).toEqual({ mainAt: 0, preWakeAt: 0 })
  })
})

describe('Einnahmeprotokoll', () => {
  it('ist standardmäßig aus und erzeugt dann keine Erinnerung', () => {
    const base = s()
    expect(base.alarm.medicationEnabled).toBe(false)
    const plan = buildDayPlan({ date: '2026-11-04', settings: base })
    const r = buildReminders([plan], {}, base, zonedToUtc('2026-11-04', 60))
    expect(r.some((x) => x.key === 'meds')).toBe(false)
  })

  it('die Erinnerung nennt nichts Medizinisches und setzt nichts automatisch', () => {
    const base = s()
    base.alarm.medicationEnabled = true
    base.alarm.medicationReminderAt = 400
    const plan = buildDayPlan({ date: '2026-11-04', settings: base })
    const m = buildReminders([plan], {}, base, zonedToUtc('2026-11-04', 60)).find((x) => x.key === 'meds')!
    expect(`${m.title} ${m.body}`).not.toMatch(/medik|elvanse|tablette|dosis|einnehmen|nimm/i)
  })
})

describe('Migration aus 1.0.x', () => {
  function old(patch: (x: Record<string, unknown>) => void = () => {}): Settings {
    const d = s() as unknown as Record<string, unknown>
    const copy = structuredClone(d)
    delete copy.focus
    delete copy.support
    copy.version = 1
    copy.onboarded = true
    copy.alarm = { enabled: true, qrSecret: 'ANKER-WACH-ALT' }
    patch(copy)
    return copy as unknown as Settings
  }

  it('behält QR-Code, Routinen und Zeiten, ergänzt sichere Standardwerte', () => {
    const m = migrateSettings(old(), '2026-11-04')
    expect(m.alarm.qrSecret).toBe('ANKER-WACH-ALT')
    expect(m.alarm.preWakeEnabled).toBe(false)
    expect(m.alarm.medicationEnabled).toBe(false)
    expect(m.focus.pulse).toBe('off')
    expect(m.routines.morning.length).toBeGreaterThan(0)
    expect(m.version).toBe(2)
  })

  it('erkennt von Hand gesetzte Zeiten und überschreibt sie danach nicht', () => {
    const o = old((x) => {
      ;(x.anchor as { wake: number }).wake = 7 * 60
    })
    const m = migrateSettings(o, '2026-11-04')
    expect(m.anchor.manual?.wake).toBe(true)
    const after = applySchedule({ ...m, commute: { ...m.commute, minutes: 60 } })
    expect(after.anchor.wake).toBe(7 * 60)
    // Automatische Bettzeit richtet sich jetzt nach der eigenen Aufstehzeit: 8 h Schlaf + 15 min Einschlafen
    expect(after.bed).toBe(22 * 60 + 45)
    expect(after.pcStop).toBe(22 * 60 + 15)
  })

  it('Vorschlag übernehmen hebt den Schutz bewusst auf', () => {
    const base = s()
    const manual = { ...base, anchor: { ...base.anchor, wake: 7 * 60, manual: { wake: true } } }
    expect(applySchedule(manual).anchor.wake).toBe(7 * 60)
    expect(resetToSuggested(manual).anchor.wake).toBe(base.anchor.wake)
  })

  it('zweite Migration ändert nichts mehr', () => {
    const once = migrateSettings(old(), '2026-11-04')
    expect(migrateSettings(once, '2026-11-04')).toEqual(once)
  })
})

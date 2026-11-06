import { describe, expect, it } from 'vitest'
import { checkpointPulse, countdownText, createCountdown, elapsedMs, isFocusSession, isStuckSession, pauseCountdown, pulseMark, remainingMs, resumeCountdown, sameFocusTarget, validCountdown, validFocus, validStuck } from './focus'

const now = Date.parse('2026-11-06T10:00:00+01:00')
const config = { pulse: 'gentle' as const, everyMin: 2 as const, halfway: true, lastMinute: true }

describe('Persistente Fokuszeit', () => {
  it('berechnet nach Reload oder langer Hintergrundzeit aus derselben Deadline', () => {
    const timer = createCountdown(600, now)
    const restored = JSON.parse(JSON.stringify(timer))
    expect(validCountdown(restored)).toBe(true)
    expect(remainingMs(restored, now + 4 * 60_000)).toBe(6 * 60_000)
    expect(countdownText(restored, now + 4 * 60_000)).toBe('6:00')
    expect(remainingMs(restored, now + 3 * 86_400_000)).toBe(0)
    expect(restored.status).toBe('running') // Ablauf erzeugt keinen completed-Zustand.
  })
  it('bewahrt auch eine angebrochene Sekunde über explizite Pause und Neustart', () => {
    const running = createCountdown(120, now)
    const paused = pauseCountdown(running, now + 30_450)
    expect(paused).toMatchObject({ status: 'paused', remainingMs: 89_550 })
    expect(remainingMs(paused, now + 3 * 86_400_000)).toBe(89_550)
    const resumed = resumeCountdown(JSON.parse(JSON.stringify(paused)), now + 3 * 86_400_000)
    expect(remainingMs(resumed, now + 3 * 86_400_000 + 450)).toBe(89_100)
    expect(elapsedMs(resumed, now + 3 * 86_400_000 + 450)).toBe(30_900)
  })
  it('behandelt doppelte Pause und Weiter idempotent', () => {
    const running = createCountdown(120, now)
    expect(resumeCountdown(running, now + 5000)).toBe(running)
    const paused = pauseCountdown(running, now + 5000)
    expect(pauseCountdown(paused, now + 999_000)).toBe(paused)
  })
  it('startet abgelaufene Zeit nicht durch Pause/Weiter von vorn', () => {
    const paused = pauseCountdown(createCountdown(120, now), now + 180_000)
    expect(remainingMs(resumeCountdown(paused, now + 3600_000), now + 3600_000)).toBe(0)
  })
  it('begrenzt die Restzeit nach zurückgestellter Uhr auf das gewählte Zeitfenster', () => {
    const timer = createCountdown(120, now)
    expect(remainingMs(timer, now - 3_600_000)).toBe(120_000)
    expect(elapsedMs(timer, now - 3_600_000)).toBe(0)
    expect(countdownText(timer, now - 3_600_000)).toBe('2:00')
  })
  it('kann gültigen alten Start unverändert übernehmen und zeigt Überzug neutral', () => {
    const migrated = createCountdown(600, now - 7 * 60_000)
    expect(countdownText(migrated, now)).toBe('3:00')
    expect(elapsedMs(migrated, now + 5 * 60_000)).toBe(12 * 60_000)
  })
  it('verwirft beschädigte oder widersprüchliche neue Daten vor Import', () => {
    const timer = createCountdown(120, now)
    for (const bad of [null, {}, { ...timer, startedAt: NaN }, { ...timer, deadlineAt: Infinity }, { ...timer, pulseCheckpointMs: 120_001 }, { ...timer, durationMs: -1 }, { ...timer, status: 'completed' }, { ...pauseCountdown(timer, now), remainingMs: 120_001 }]) {
      expect(validCountdown(bad)).toBe(false)
    }
    expect(() => createCountdown(Infinity, now)).toThrow()
    expect(() => createCountdown(-1, now)).toThrow()
  })
})

describe('Fokus-Pulse ohne Doppel- und Nachholsignal', () => {
  it('dedupliziert gleichzeitige Perioden- und Halbzeitmarke', () => {
    const timer = createCountdown(240, now)
    const mark = pulseMark(timer, config, now + 120_000, 119_000)
    expect(mark).toBe(120_000)
    const persisted = checkpointPulse(timer, mark!)
    expect(pulseMark(persisted, config, now + 120_000, 119_000)).toBeUndefined()
  })
  it('bleibt aus, pausiert, blockiert und nach Ablauf still', () => {
    const timer = createCountdown(240, now)
    expect(pulseMark(timer, { ...config, pulse: 'off' }, now + 120_000, 0)).toBeUndefined()
    expect(pulseMark(pauseCountdown(timer, now + 120_000), config, now + 120_000, 0)).toBeUndefined()
    expect(pulseMark(timer, config, now + 120_000, 0, true)).toBeUndefined()
    expect(pulseMark(timer, config, now + 240_000, 120_000)).toBeUndefined()
    expect(pulseMark(timer, config, now + 2 * 86_400_000, 120_000)).toBeUndefined()
  })
  it('holt beim Wiederöffnen keine alten Marken nach, wenn die aktuelle Zeit als Ausgang gilt', () => {
    const timer = createCountdown(600, now)
    const elapsed = elapsedMs(timer, now + 250_000)
    expect(pulseMark(timer, config, now + 250_000, elapsed)).toBeUndefined()
    expect(pulseMark(timer, config, now + 300_000, 299_000)).toBe(300_000)
  })
  it('Checkpoint bleibt monoton und ignoriert beschädigte Marken', () => {
    const timer = checkpointPulse(createCountdown(600, now), 120_000)
    for (const mark of [0, -1, NaN, Infinity, 119_000, 600_001]) expect(checkpointPulse(timer, mark)).toBe(timer)
  })
})

describe('Eine Fokusreferenz und ein davon unabhängiger Hilfetimer', () => {
  it('akzeptiert alte Daten ohne die neuen Felder', () => {
    expect(validFocus(undefined)).toBe(true)
    expect(validStuck(undefined)).toBe(true)
  })
  it('bewahrt getrennte Kontexte, auch bevor der Hilfetimer bewusst gestartet wurde', () => {
    const focus = { id: 'session', target: { kind: 'work', id: 'bericht' }, timer: createCountdown(1500, now) }
    const stuck = { contextKey: 'work:bericht', level: 1 }
    expect(isFocusSession(focus)).toBe(true)
    expect(isStuckSession(stuck)).toBe(true)
    expect(isStuckSession({ ...stuck, timer: pauseCountdown(createCountdown(30, now), now + 10_000) })).toBe(true)
    expect(focus.timer.durationMs).toBe(1_500_000)
  })
  it('unterscheidet Instanz, Routine und kleine Version anhand stabiler Referenz', () => {
    const a = { kind: 'routine' as const, date: '2026-11-06', routine: 'morning' as const, stepId: 'teeth', minimal: false }
    expect(sameFocusTarget(a, { ...a })).toBe(true)
    expect(sameFocusTarget(a, { ...a, date: '2026-11-07' })).toBe(false)
    expect(sameFocusTarget(a, { ...a, minimal: true })).toBe(false)
    expect(sameFocusTarget({ kind: 'work', id: 'x' }, { kind: 'task', id: 'x' })).toBe(false)
  })
  it('weist defekte Referenzen und versteckten Autostart-Status zurück', () => {
    const timer = createCountdown(120, now)
    for (const target of [{ kind: 'work', id: '' }, { kind: 'routine', date: '2026-02-31', routine: 'morning', stepId: 'x', minimal: false }, { kind: 'routine', date: '2026-11-06', routine: 'nope', stepId: 'x', minimal: false }]) {
      expect(isFocusSession({ id: 'x', target, timer })).toBe(false)
    }
    expect(isStuckSession({ contextKey: '', level: 0 })).toBe(false)
    expect(isStuckSession({ contextKey: 'x', level: -1 })).toBe(false)
    expect(isStuckSession({ contextKey: 'x', level: 0, timer: { status: 'completed' } })).toBe(false)
  })
})

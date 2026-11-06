import type { RoutineId, Settings, TaskRef } from './types'

/** UTC-Deadline während des Laufens; eine Pause bewahrt die exakte verbleibende Dauer. */
export type CountdownState = {
  durationMs: number
  startedAt: number
  pulseCheckpointMs: number
} & (
  | { status: 'running'; deadlineAt: number }
  | { status: 'paused'; remainingMs: number; pausedAt: number }
)

export type FocusTarget =
  | { kind: 'routine'; date: string; routine: RoutineId; stepId: string; minimal: boolean }
  | TaskRef

export interface FocusSession {
  id: string
  target: FocusTarget
  timer: CountdownState
}

/** Der Hilfetimer ist unabhängig vom eigentlichen Fokus. Vor Starten fehlt timer. */
export interface StuckSession {
  contextKey: string
  level: number
  timer?: CountdownState
}

const MAX_DURATION_MS = 24 * 60 * 60_000
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 500
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && Number.isFinite(new Date(value).getTime())
const duration = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_DURATION_MS

export function validCountdown(value: unknown): value is CountdownState {
  if (!object(value) || !duration(value.durationMs) || !timestamp(value.startedAt)
    || !duration(value.pulseCheckpointMs) || value.pulseCheckpointMs > value.durationMs) return false
  if (value.status === 'running') return timestamp(value.deadlineAt)
  return value.status === 'paused' && timestamp(value.pausedAt) && duration(value.remainingMs) && value.remainingMs <= value.durationMs
}

export function validFocusTarget(value: unknown): value is FocusTarget {
  if (!object(value)) return false
  if (value.kind === 'task' || value.kind === 'work') return text(value.id)
  if (value.kind !== 'routine' || !text(value.stepId) || typeof value.minimal !== 'boolean'
    || !['morning', 'evening'].includes(String(value.routine)) || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return false
  const date = new Date(`${value.date}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.date
}

export function isFocusSession(value: unknown): value is FocusSession {
  return object(value) && text(value.id) && validFocusTarget(value.target) && validCountdown(value.timer)
}

export function validFocus(value: unknown): boolean {
  return value === undefined || isFocusSession(value)
}

export function isStuckSession(value: unknown): value is StuckSession {
  return object(value) && text(value.contextKey) && Number.isInteger(value.level)
    && Number(value.level) >= 0 && Number(value.level) <= 20
    && (value.timer === undefined || validCountdown(value.timer))
}

export function validStuck(value: unknown): boolean {
  return value === undefined || isStuckSession(value)
}

export function focusTargetKey(target: FocusTarget): string {
  return target.kind === 'routine'
    ? `routine:${target.date}:${target.routine}:${target.stepId}:${target.minimal ? 'minimal' : 'full'}`
    : `${target.kind}:${target.id}`
}

export function sameFocusTarget(a: FocusTarget, b: FocusTarget): boolean {
  return focusTargetKey(a) === focusTargetKey(b)
}

/** nowMs ist ausdrücklich Eingabe; der Core liest weder Uhr noch lokalen Speicher. */
export function createCountdown(seconds: number, nowMs: number): CountdownState {
  const durationMs = Math.round(seconds * 1000)
  if (!duration(durationMs) || !timestamp(nowMs) || !timestamp(nowMs + durationMs)) throw new Error('Das Zeitfenster ist ungültig.')
  return { durationMs, startedAt: nowMs, pulseCheckpointMs: 0, status: 'running', deadlineAt: nowMs + durationMs }
}

export function remainingMs(timer: CountdownState, nowMs: number): number {
  const raw = timer.status === 'paused' ? timer.remainingMs : timer.deadlineAt - nowMs
  return Number.isFinite(raw) ? Math.max(0, Math.min(timer.durationMs, raw)) : timer.durationMs
}

/** Überzug darf sichtbar bleiben; er ist weder ein Fehlschlag noch ein Erledigungsbeweis. */
export function elapsedMs(timer: CountdownState, nowMs: number): number {
  const rawRemaining = timer.status === 'paused' ? timer.remainingMs : timer.deadlineAt - nowMs
  return Number.isFinite(rawRemaining) ? Math.max(0, timer.durationMs - rawRemaining) : 0
}

export function pauseCountdown(timer: CountdownState, nowMs: number): CountdownState {
  if (timer.status === 'paused') return timer
  return { durationMs: timer.durationMs, startedAt: timer.startedAt, pulseCheckpointMs: timer.pulseCheckpointMs,
    status: 'paused', remainingMs: remainingMs(timer, nowMs), pausedAt: nowMs }
}

export function resumeCountdown(timer: CountdownState, nowMs: number): CountdownState {
  if (timer.status === 'running') return timer
  return { durationMs: timer.durationMs, startedAt: timer.startedAt, pulseCheckpointMs: timer.pulseCheckpointMs,
    status: 'running', deadlineAt: nowMs + timer.remainingMs }
}

/** Höchstens ein Hinweis für überschrittene Marken; kein Nachholen nach Pause/Ablauf. */
export function pulseMark(timer: CountdownState, config: Settings['focus'], nowMs: number, previousElapsedMs: number, blocked = false): number | undefined {
  if (timer.status !== 'running' || config.pulse === 'off' || blocked || remainingMs(timer, nowMs) === 0) return undefined
  const elapsed = elapsedMs(timer, nowMs)
  const previous = Math.max(previousElapsedMs, timer.pulseCheckpointMs)
  if (!Number.isFinite(elapsed) || !Number.isFinite(previous) || elapsed <= previous) return undefined
  const candidates: number[] = []
  const every = config.everyMin * 60_000
  if (every > 0 && Number.isFinite(every)) candidates.push(Math.floor(elapsed / every) * every)
  if (config.halfway) candidates.push(timer.durationMs / 2)
  if (config.lastMinute && timer.durationMs > 60_000) candidates.push(timer.durationMs - 60_000)
  const crossed = candidates.filter((mark) => mark > 0 && mark < timer.durationMs && previous < mark && elapsed >= mark)
  return crossed.length ? Math.max(...crossed) : undefined
}

export function checkpointPulse(timer: CountdownState, mark: number): CountdownState {
  return duration(mark) && mark <= timer.durationMs && mark > timer.pulseCheckpointMs ? { ...timer, pulseCheckpointMs: mark } : timer
}

export function countdownText(timer: CountdownState, nowMs: number): string {
  const seconds = Math.ceil(remainingMs(timer, nowMs) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

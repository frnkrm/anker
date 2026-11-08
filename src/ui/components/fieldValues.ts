/** Fields use a fixed display format even when Android or the browser uses English. */
export function clockMinutes(text: string): number | undefined {
  const value = text.trim()
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(value) ?? /^(\d{2})(\d{2})$/.exec(value)
  if (!match) return undefined
  const hour = Number(match[1]); const minute = Number(match[2])
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : undefined
}

export function germanDateValue(value: string, withTime = false): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value)
  if (!match) return ''
  const date = `${match[3]}.${match[2]}.${match[1]}`
  return withTime && match[4] && match[5] ? `${date} · ${match[4]}:${match[5]}` : date
}

export function countdownLabel(remainingSec: number): string {
  const seconds = Number.isFinite(remainingSec) ? Math.max(0, Math.ceil(remainingSec)) : 0
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function remainingFraction(remainingSec: number, totalSec: number): number {
  return Number.isFinite(remainingSec) && Number.isFinite(totalSec) && totalSec > 0 ? Math.min(1, Math.max(0, remainingSec / totalSec)) : 0
}

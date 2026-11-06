/** Gemeinsamer Datenvertrag für App und PC-Endpunkt. Enthält weder Orte noch Aufgaben. */
export interface PcStopCommand {
  version: 2
  date: string
  mode: 'scheduled' | 'paused'
  revision: string
  validUntil: string
  stopAt?: string
  localTime?: string
  extended?: boolean
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const stamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value

/** Auch auf einem anders eingestellten PC bleibt der Anker-Plantag Berlin, Wechsel04:00. */
export function pcPlanDate(now: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const part = (kind: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === kind)!.value
  const current = `${part('year')}-${part('month')}-${part('day')}`
  if (Number(part('hour')) >= 4) return current
  const previous = new Date(`${current}T12:00:00Z`)
  previous.setUTCDate(previous.getUTCDate() - 1)
  return previous.toISOString().slice(0, 10)
}

export function validPcStopCommand(value: unknown): value is PcStopCommand {
  if (!object(value) || value.version !== 2 || !date(value.date) || !stamp(value.validUntil)
    || typeof value.revision !== 'string' || !value.revision || value.revision.length > 100) return false
  if (value.mode === 'paused') return value.stopAt === undefined && value.localTime === undefined
  return value.mode === 'scheduled' && stamp(value.stopAt) && typeof value.localTime === 'string'
    && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.localTime)
    && (value.extended === undefined || typeof value.extended === 'boolean')
}

/** Nur heutige veröffentlichte Daten. Morgen ist kein Ersatz für einen fehlenden heutigen Auftrag. */
export function pickPcStopCommand(entries: readonly unknown[], now: number): PcStopCommand | undefined {
  const current = pcPlanDate(now)
  for (const entry of entries) {
    if (validPcStopCommand(entry) && entry.date === current && Date.parse(entry.validUntil) > now) return entry
  }
  // Ein vorhandenes altes Paket bleibt lesbar; eine neue Pause darf nicht durch einen alten Termin ersetzt werden.
  if (entries.some((entry) => object(entry) && entry.date === current && entry.version === 2)) return undefined
  const legacy = entries.find((entry) => object(entry) && entry.date === current && stamp(entry.stopAt)
    && Date.parse(entry.stopAt) + 6 * 3600_000 > now)
  if (!object(legacy) || !stamp(legacy.stopAt) || typeof legacy.localTime !== 'string') return undefined
  const until = new Date(now + 60 * 60_000).toISOString()
  const command = { version: 2 as const, date: current, mode: 'scheduled' as const, revision: `legacy:${legacy.stopAt}`, validUntil: until, stopAt: legacy.stopAt, localTime: legacy.localTime, extended: legacy.extended === true }
  return validPcStopCommand(command) ? command : undefined
}

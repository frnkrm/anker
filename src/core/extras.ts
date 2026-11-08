/** Freiwillige Zusatzfähigkeiten. Fehlende Felder aus Altständen bleiben ausgeschaltet. */
export interface ExtraSettings {
  dictation: boolean
  spokenCues: boolean
}

export interface CalendarStatus {
  state: 'disconnected' | 'loading' | 'ready' | 'stale' | 'error'
  fetchedAt?: number
  checkedAt: number
  issue?: 'auth' | 'network' | 'invalid-response' | 'permission'
  writtenAt?: number
}

export interface GeofenceChoice {
  radiusM: number
  dwellMs: number
  consentedAt: number
  /** Zustimmung gilt nur für diesen gewählten Zielort. Alte ungebundene Werte bleiben inaktiv. */
  placeId?: string
  latitude?: number
  longitude?: number
}

export interface ExtraLocal {
  /** Bewusst bestätigter Abschluss des PC-Assistenten, kein Download-/Verbindungsnachweis. */
  pcStopSetupDone?: boolean
  calendar?: CalendarStatus
  ownCalendar?: { id: string; accountId: string }
  geofences?: { enabled: boolean; visits: Record<string, GeofenceChoice> }
}

export const extraSettings = (value?: Partial<ExtraSettings>): ExtraSettings => ({
  dictation: value?.dictation === true,
  spokenCues: value?.spokenCues === true,
})

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isFinite(new Date(value).getTime())
export function validExtrasSettings(value: unknown): value is ExtraSettings | undefined {
  return value === undefined || (object(value) && typeof value.dictation === 'boolean' && typeof value.spokenCues === 'boolean')
}
export function validCalendarStatus(value: unknown): value is CalendarStatus {
  return object(value) && ['disconnected', 'loading', 'ready', 'stale', 'error'].includes(String(value.state)) && timestamp(value.checkedAt)
    && (value.fetchedAt === undefined || timestamp(value.fetchedAt)) && (value.writtenAt === undefined || timestamp(value.writtenAt))
    && (value.issue === undefined || ['auth', 'network', 'invalid-response', 'permission'].includes(String(value.issue)))
}
export function validExtrasLocal(value: unknown): value is ExtraLocal | undefined {
  if (value === undefined) return true
  if (!object(value) || (value.calendar !== undefined && !validCalendarStatus(value.calendar))
    || value.pcStopSetupDone !== undefined && typeof value.pcStopSetupDone !== 'boolean') return false
  if (value.ownCalendar !== undefined && (!object(value.ownCalendar) || typeof value.ownCalendar.id !== 'string' || !value.ownCalendar.id || typeof value.ownCalendar.accountId !== 'string' || !value.ownCalendar.accountId)) return false
  if (value.geofences === undefined) return true
  const geo = value.geofences
  return object(geo) && typeof geo.enabled === 'boolean' && object(geo.visits) && Object.entries(geo.visits).length <= 20
    && Object.entries(geo.visits).every(([id, choice]) => !!id && object(choice) && timestamp(choice.consentedAt)
      && typeof choice.radiusM === 'number' && choice.radiusM >= 100 && choice.radiusM <= 1000
      && typeof choice.dwellMs === 'number' && choice.dwellMs >= 60_000 && choice.dwellMs <= 900_000
      && (choice.placeId === undefined || typeof choice.placeId === 'string' && !!choice.placeId && choice.placeId.length <= 200)
      && (choice.latitude === undefined || typeof choice.latitude === 'number' && Number.isFinite(choice.latitude) && Math.abs(choice.latitude) <= 90)
      && (choice.longitude === undefined || typeof choice.longitude === 'number' && Number.isFinite(choice.longitude) && Math.abs(choice.longitude) <= 180))
}

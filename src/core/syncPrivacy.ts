import type { Rec } from '../data/types'
import { weatherRecordForSync } from './weatherProfile'

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

/** Nur vorhandene explizite Arbeitszuordnung; freie Texte werden nicht klassifiziert. */
export function localBusinessNote(value: unknown): boolean {
  return object(value) && (value.captureContext === 'Arbeit' || object(value.linkedTo) && value.linkedTo.kind === 'work')
}

/** Gemeinsame Datengrenze in beide Richtungen. Ein bewusstes lokales Backup verwendet sie nicht. */
export function recordForSync(record: Rec): Rec | undefined {
  if (record.collection === 'meta') return undefined
  // Auch ein gelöschter Record enthält lokal noch seinen alten Body. Der Server braucht nur die Kennung.
  if (record.deleted) return { ...record, data: null }
  if (record.collection === 'inbox' && localBusinessNote(record.data)) return undefined
  const projected = weatherRecordForSync(record)
  if (projected.collection !== 'settings' || !object(projected.data)) return projected
  // Freigaben gehören zum jeweiligen Gerät, nicht zum Settings-Abgleich eines anderen Geräts.
  const data = Object.fromEntries(Object.entries(projected.data).filter(([key]) => !['integrations', 'extras'].includes(key)))
  if (!object(data.alarm)) return { ...projected, data }
  const alarm = Object.fromEntries(Object.entries(data.alarm).filter(([key]) => !['qrSecret', 'medicationEnabled', 'medicationReminderAt'].includes(key)))
  return { ...projected, data: { ...data, alarm } }
}

import type { Collection, Rec } from '../../data/types'
import { COLLECTIONS } from '../../data/types'

export interface Backup {
  app: 'anker'
  version: 1
  exportedAt: string
  records: Rec[]
}

export function makeBackup(records: Rec[], now = new Date()): Backup {
  return { app: 'anker', version: 1, exportedAt: now.toISOString(), records: records.map(({ dirty: _d, ...r }) => r) }
}

/** Prüft eine Backup-Datei. Wirft einen verständlichen Fehler, wenn sie nicht passt. */
export function parseBackup(text: string): Rec[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.')
  }
  const b = data as Partial<Backup>
  if (!b || b.app !== 'anker' || !Array.isArray(b.records)) throw new Error('Das ist keine Anker-Sicherung.')
  if (b.version !== 1) throw new Error('Diese Sicherung stammt aus einer anderen App-Version.')
  return b.records.filter(
    (r): r is Rec =>
      !!r &&
      COLLECTIONS.includes(r.collection as Collection) &&
      typeof r.id === 'string' &&
      typeof r.updated_at === 'number' &&
      typeof r.deleted === 'boolean',
  )
}

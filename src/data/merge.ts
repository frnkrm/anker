import type { Rec } from './types'

/** Last-write-wins pro Datensatz. Bei Gleichstand gewinnt der vorhandene (keine unnötigen Schreibvorgänge). */
export function remoteWins(local: Rec | undefined, remote: Rec): boolean {
  if (!local) return true
  return remote.updated_at > local.updated_at
}

export function key(r: Pick<Rec, 'collection' | 'id'>): string {
  return `${r.collection}/${r.id}`
}

export type Collection = 'settings' | 'days' | 'inbox' | 'game' | 'reviews' | 'meta'
export const COLLECTIONS: Collection[] = ['settings', 'days', 'inbox', 'game', 'reviews', 'meta']

/** Ein gespeicherter Datensatz. `updated_at` (ms) entscheidet beim Sync (last-write-wins). */
export interface Rec<T = unknown> {
  collection: Collection
  id: string
  data: T
  updated_at: number
  deleted: boolean
  /** 1 = lokal geändert, noch nicht synchronisiert */
  dirty?: number
}

/** Lokaler Batch-Eintrag; ohne deleted bleibt das bisherige normale Speichern erhalten. */
export type RepositoryWrite = Pick<Rec, 'collection' | 'id' | 'data'> & Partial<Pick<Rec, 'deleted'>>

export interface Repository {
  init(): Promise<void>
  get<T>(c: Collection, id: string): Promise<T | undefined>
  list<T>(c: Collection): Promise<T[]>
  put<T>(c: Collection, id: string, data: T): Promise<void>
  /** One local transaction for related writes, including explicit deletion tombstones. */
  putMany(records: readonly RepositoryWrite[]): Promise<void>
  remove(c: Collection, id: string): Promise<void>
  all(): Promise<Rec[]>
  dirty(): Promise<Rec[]>
  /** Übernimmt neuere Datensätze. Importierte lokale Änderungen bleiben mit dirty für den Sync vorgemerkt. */
  merge(recs: Rec[], options?: { dirty?: boolean }): Promise<number>
  markClean(recs: Pick<Rec, 'collection' | 'id' | 'updated_at'>[]): Promise<void>
  clear(): Promise<void>
}

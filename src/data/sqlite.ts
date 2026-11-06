import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import { remoteWins } from './merge'
import type { Collection, Rec, Repository } from './types'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  dirty INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS records_dirty ON records(dirty);
`

interface Row {
  collection: Collection
  id: string
  data: string | null
  updated_at: number
  deleted: number
  dirty: number
}

function toRec(r: Row): Rec {
  return {
    collection: r.collection,
    id: r.id,
    data: r.data ? JSON.parse(r.data) : null,
    updated_at: r.updated_at,
    deleted: !!r.deleted,
    dirty: r.dirty,
  }
}

/** SQLite-Repository für Android (lokale Datei, offline). */
export class SqliteRepository implements Repository {
  private db!: SQLiteDBConnection

  async init() {
    const sqlite = new SQLiteConnection(CapacitorSQLite)
    const consistent = await sqlite.checkConnectionsConsistency().catch(() => ({ result: false }))
    const exists = (await sqlite.isConnection('anker', false)).result
    this.db =
      consistent.result && exists
        ? await sqlite.retrieveConnection('anker', false)
        : await sqlite.createConnection('anker', false, 'no-encryption', 1, false)
    await this.db.open()
    await this.db.execute(SCHEMA)
  }

  private async upsert(r: Rec) {
    await this.db.run(
      'INSERT OR REPLACE INTO records (collection, id, data, updated_at, deleted, dirty) VALUES (?, ?, ?, ?, ?, ?)',
      [r.collection, r.id, JSON.stringify(r.data ?? null), r.updated_at, r.deleted ? 1 : 0, r.dirty ?? 0],
      false,
    )
  }
  private async row(c: Collection, id: string): Promise<Rec | undefined> {
    const res = await this.db.query('SELECT * FROM records WHERE collection = ? AND id = ?', [c, id])
    const r = res.values?.[0] as Row | undefined
    return r ? toRec(r) : undefined
  }

  async get<T>(c: Collection, id: string) {
    const r = await this.row(c, id)
    return r && !r.deleted ? (r.data as T) : undefined
  }
  async list<T>(c: Collection) {
    const res = await this.db.query('SELECT * FROM records WHERE collection = ? AND deleted = 0', [c])
    return ((res.values ?? []) as Row[]).map((r) => toRec(r).data as T)
  }
  async put<T>(c: Collection, id: string, data: T) {
    await this.upsert({ collection: c, id, data, updated_at: Date.now(), deleted: false, dirty: 1 })
  }
  async putMany(records: readonly Pick<Rec, 'collection' | 'id' | 'data'>[]) {
    await this.db.executeSet(records.map((r) => ({
      statement: 'INSERT OR REPLACE INTO records (collection, id, data, updated_at, deleted, dirty) VALUES (?, ?, ?, ?, ?, ?)',
      values: [r.collection, r.id, JSON.stringify(r.data ?? null), Date.now(), 0, 1],
    })), true)
  }
  async remove(c: Collection, id: string) {
    const cur = await this.row(c, id)
    await this.upsert({ collection: c, id, data: cur?.data ?? null, updated_at: Date.now(), deleted: true, dirty: 1 })
  }
  async all() {
    const res = await this.db.query('SELECT * FROM records', [])
    return ((res.values ?? []) as Row[]).map(toRec)
  }
  async dirty() {
    const res = await this.db.query('SELECT * FROM records WHERE dirty = 1', [])
    return ((res.values ?? []) as Row[]).map(toRec)
  }
  async merge(recs: Rec[], { dirty = false }: { dirty?: boolean } = {}) {
    let n = 0
    for (const r of recs) {
      if (remoteWins(await this.row(r.collection, r.id), r)) {
        await this.upsert({ ...r, dirty: dirty ? 1 : 0 })
        n++
      }
    }
    return n
  }
  async markClean(recs: Pick<Rec, 'collection' | 'id' | 'updated_at'>[]) {
    for (const r of recs) {
      await this.db.run(
        'UPDATE records SET dirty = 0 WHERE collection = ? AND id = ? AND updated_at = ?',
        [r.collection, r.id, r.updated_at],
        false,
      )
    }
  }
  async clear() {
    await this.db.execute('DELETE FROM records;')
  }
}

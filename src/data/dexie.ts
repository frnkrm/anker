import Dexie, { type Table } from 'dexie'
import { remoteWins } from './merge'
import type { Collection, Rec, Repository } from './types'

class AnkerDb extends Dexie {
  records!: Table<Rec, [Collection, string]>
  constructor() {
    super('anker')
    this.version(1).stores({ records: '[collection+id], collection, dirty' })
  }
}

/** IndexedDB-Repository für die Web-Version. */
export class DexieRepository implements Repository {
  private db = new AnkerDb()

  async init() {
    await this.db.open()
  }
  async get<T>(c: Collection, id: string) {
    const r = await this.db.records.get([c, id])
    return r && !r.deleted ? (r.data as T) : undefined
  }
  async list<T>(c: Collection) {
    const rows = await this.db.records.where('collection').equals(c).toArray()
    return rows.filter((r) => !r.deleted).map((r) => r.data as T)
  }
  async put<T>(c: Collection, id: string, data: T) {
    await this.db.records.put({ collection: c, id, data, updated_at: Date.now(), deleted: false, dirty: 1 })
  }
  async remove(c: Collection, id: string) {
    const cur = await this.db.records.get([c, id])
    await this.db.records.put({ collection: c, id, data: cur?.data ?? null, updated_at: Date.now(), deleted: true, dirty: 1 })
  }
  async all() {
    return this.db.records.toArray()
  }
  async dirty() {
    return this.db.records.where('dirty').equals(1).toArray()
  }
  async merge(recs: Rec[], { dirty = false }: { dirty?: boolean } = {}) {
    let n = 0
    await this.db.transaction('rw', this.db.records, async () => {
      for (const r of recs) {
        const cur = await this.db.records.get([r.collection, r.id])
        if (remoteWins(cur, r)) {
          await this.db.records.put({ ...r, dirty: dirty ? 1 : 0 })
          n++
        }
      }
    })
    return n
  }
  async markClean(recs: Pick<Rec, 'collection' | 'id' | 'updated_at'>[]) {
    await this.db.transaction('rw', this.db.records, async () => {
      for (const r of recs) {
        const cur = await this.db.records.get([r.collection, r.id])
        if (cur && cur.updated_at === r.updated_at) await this.db.records.update([r.collection, r.id], { dirty: 0 })
      }
    })
  }
  async clear() {
    await this.db.records.clear()
  }
}

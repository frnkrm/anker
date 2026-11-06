import { key, remoteWins } from './merge'
import type { Collection, Rec, Repository } from './types'

/** In-Memory-Repository für Tests und als letzter Fallback. */
export class MemoryRepository implements Repository {
  private map = new Map<string, Rec>()
  constructor(private now: () => number = Date.now) {}

  async init() {}
  async get<T>(c: Collection, id: string) {
    const r = this.map.get(key({ collection: c, id }))
    return r && !r.deleted ? (r.data as T) : undefined
  }
  async list<T>(c: Collection) {
    return [...this.map.values()].filter((r) => r.collection === c && !r.deleted).map((r) => r.data as T)
  }
  async put<T>(c: Collection, id: string, data: T) {
    this.map.set(key({ collection: c, id }), { collection: c, id, data, updated_at: this.now(), deleted: false, dirty: 1 })
  }
  async putMany(records: readonly Pick<Rec, 'collection' | 'id' | 'data'>[]) {
    const next = new Map(this.map)
    for (const r of records) next.set(key(r), { ...r, updated_at: this.now(), deleted: false, dirty: 1 })
    this.map = next
  }
  async remove(c: Collection, id: string) {
    const k = key({ collection: c, id })
    const r = this.map.get(k)
    this.map.set(k, { collection: c, id, data: r?.data ?? null, updated_at: this.now(), deleted: true, dirty: 1 })
  }
  async all() {
    return [...this.map.values()]
  }
  async dirty() {
    return [...this.map.values()].filter((r) => r.dirty)
  }
  async merge(recs: Rec[], { dirty = false }: { dirty?: boolean } = {}) {
    let n = 0
    for (const r of recs) {
      const k = key(r)
      if (remoteWins(this.map.get(k), r)) {
        this.map.set(k, { ...r, dirty: dirty ? 1 : 0 })
        n++
      }
    }
    return n
  }
  async markClean(recs: Pick<Rec, 'collection' | 'id' | 'updated_at'>[]) {
    for (const r of recs) {
      const cur = this.map.get(key(r))
      if (cur && cur.updated_at === r.updated_at) cur.dirty = 0
    }
  }
  async clear() {
    this.map.clear()
  }
}

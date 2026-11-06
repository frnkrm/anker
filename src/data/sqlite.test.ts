import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SqliteRepository } from './sqlite'
import type { Collection, Rec } from './types'

interface MockRow {
  collection: Collection
  id: string
  data: string
  updated_at: number
  deleted: number
  dirty: number
}

const sqlite = vi.hoisted(() => {
  const rows = new Map<string, MockRow>()
  const failure = { enabled: false, writes: 0 }
  function write(target: Map<string, MockRow>, values: unknown[]) {
    if (failure.enabled && ++failure.writes === 2) throw new Error('second imported write failed')
    const [collection, id, data, updated_at, deleted, dirty] = values as [Collection, string, string, number, number, number]
    target.set(`${collection}/${id}`, { collection, id, data, updated_at, deleted, dirty })
  }
  return {
    rows, failure,
    open: vi.fn(async () => undefined),
    execute: vi.fn(async (_schema: string) => undefined),
    query: vi.fn(async (statement: string, values: unknown[] = []) => {
      const [collection, id] = values
      const selected = [...rows.values()].filter((row) => {
        if (statement.includes('id = ?')) return row.collection === collection && row.id === id
        if (statement.includes('deleted = 0')) return row.collection === collection && row.deleted === 0
        if (statement.includes('dirty = 1')) return row.dirty === 1
        return true
      })
      return { values: structuredClone(selected) }
    }),
    run: vi.fn(async (_statement: string, values: unknown[]) => { write(rows, values) }),
    executeSet: vi.fn(async (statements: { statement: string; values: unknown[] }[], transaction?: boolean) => {
      const target = transaction ? new Map(rows) : rows
      for (const statement of statements) write(target, statement.values)
      if (transaction) {
        rows.clear()
        for (const [key, value] of target) rows.set(key, value)
      }
    }),
  }
})

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {},
  SQLiteConnection: class {
    async checkConnectionsConsistency() { return { result: true } }
    async isConnection() { return { result: false } }
    async createConnection() { return sqlite }
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  sqlite.rows.clear()
  sqlite.failure.enabled = false
  sqlite.failure.writes = 0
  vi.spyOn(Date, 'now').mockReturnValue(123)
})

describe('SQLite-Import und Sync-Merge', () => {
  const record = (id: string, updated_at: number, data: unknown = { text: id }): Rec => ({ collection: 'inbox', id, data, updated_at, deleted: false })

  it('behält bei einem Fehler im zweiten Importdatensatz den gesamten alten Bestand', async () => {
    const repo = new SqliteRepository()
    await repo.init()
    await repo.put('inbox', 'existing', { text: 'Nicht überschreiben' })
    const before = await repo.all()
    sqlite.failure.enabled = true
    await expect(repo.merge([record('existing', 200), record('new', 201)], { dirty: true })).rejects.toThrow('second imported write failed')
    expect(await repo.all()).toEqual(before)
    expect(await repo.get('inbox', 'new')).toBeUndefined()
    expect(sqlite.executeSet.mock.calls.at(-1)?.[1]).toBe(true)
    sqlite.failure.enabled = false
    expect(await repo.merge([record('existing', 200), record('new', 201)], { dirty: true })).toBe(2)
    expect(await repo.get('inbox', 'existing')).toEqual({ text: 'existing' })
    expect(await repo.get('inbox', 'new')).toEqual({ text: 'new' })
  })

  it('übernimmt nur neuere Records, erhält Zeitstempel und markiert importierte Änderungen dirty', async () => {
    const repo = new SqliteRepository()
    await repo.init()
    await repo.put('inbox', 'unchanged', { text: 'Bestehend' })
    const changes = [record('unchanged', 123, { text: 'Gleichstand' }), record('unchanged', 100), record('new', 200), { ...record('deleted', 201, null), deleted: true }]
    expect(await repo.merge(changes, { dirty: true })).toBe(2)
    expect(await repo.get('inbox', 'unchanged')).toEqual({ text: 'Bestehend' })
    expect(await repo.get('inbox', 'new')).toEqual({ text: 'new' })
    expect(await repo.get('inbox', 'deleted')).toBeUndefined()
    expect((await repo.all()).find((row) => row.id === 'new')).toMatchObject({ updated_at: 200, dirty: 1 })
    expect((await repo.all()).find((row) => row.id === 'deleted')).toMatchObject({ updated_at: 201, dirty: 1, deleted: true, data: null })
    expect(sqlite.executeSet.mock.calls.at(-1)?.[0]).toHaveLength(2)
  })

  it('berücksichtigt mehrere Versionen derselben ID innerhalb eines Batches monoton', async () => {
    const repo = new SqliteRepository()
    await repo.init()
    expect(await repo.merge([record('same', 200, { text: 'Neu' }), record('same', 150, { text: 'Alt' }), record('same', 200, { text: 'Gleich' }), record('same', 250, { text: 'Neuest' })])).toBe(2)
    expect(await repo.get('inbox', 'same')).toEqual({ text: 'Neuest' })
    expect((await repo.all()).find((row) => row.id === 'same')).toMatchObject({ updated_at: 250, dirty: 0 })
    expect(sqlite.executeSet.mock.calls.at(-1)?.[1]).toBe(true)
  })

  it('schreibt bei leerem Batch oder ausschließlich alten Versionen nichts', async () => {
    const repo = new SqliteRepository()
    await repo.init()
    await repo.put('inbox', 'existing', { text: 'Bestehend' })
    expect(await repo.merge([])).toBe(0)
    expect(await repo.merge([record('existing', 122), record('existing', 123)])).toBe(0)
    expect(sqlite.executeSet).not.toHaveBeenCalled()
  })
})
afterEach(() => vi.restoreAllMocks())

describe('SQLite-Batchvertrag', () => {
  it('fordert für Arbeitsaufgabe und Inbox-Tombstone eine gemeinsame native Transaktion an', async () => {
    const r = new SqliteRepository()
    await r.init()
    await r.putMany([
      { collection: 'meta', id: 'local', data: { work: [{ id: 'arbeit', title: 'Vorgang prüfen' }] } },
      { collection: 'inbox', id: 'gedanke', data: null, deleted: true },
      { collection: 'inbox', id: 'notiz', data: { text: 'bleibt sichtbar' }, deleted: false },
    ])
    const statement = 'INSERT OR REPLACE INTO records (collection, id, data, updated_at, deleted, dirty) VALUES (?, ?, ?, ?, ?, ?)'
    expect(sqlite.executeSet).toHaveBeenCalledExactlyOnceWith([
      { statement, values: ['meta', 'local', JSON.stringify({ work: [{ id: 'arbeit', title: 'Vorgang prüfen' }] }), 123, 0, 1] },
      { statement, values: ['inbox', 'gedanke', 'null', 123, 1, 1] },
      { statement, values: ['inbox', 'notiz', JSON.stringify({ text: 'bleibt sichtbar' }), 123, 0, 1] },
    ], true)
  })

  it('reicht den Fehler der nativen Transaktion weiter und versucht keine einzelnen Ersatzschreibvorgänge', async () => {
    const r = new SqliteRepository()
    await r.init()
    const error = new Error('native transaction failed')
    sqlite.executeSet.mockRejectedValueOnce(error)
    await expect(r.putMany([
      { collection: 'meta', id: 'local', data: { work: [] } },
      { collection: 'inbox', id: 'gedanke', data: null, deleted: true },
    ])).rejects.toBe(error)
    expect(sqlite.executeSet).toHaveBeenCalledTimes(1)
    expect(sqlite.executeSet.mock.calls[0]?.[1]).toBe(true)
  })
})

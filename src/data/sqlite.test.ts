import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SqliteRepository } from './sqlite'

const sqlite = vi.hoisted(() => ({
  open: vi.fn(async () => undefined),
  execute: vi.fn(async (_schema: string) => undefined),
  executeSet: vi.fn(async (_statements: unknown, _transaction?: boolean) => undefined),
}))

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
  sqlite.executeSet.mockResolvedValue(undefined)
  vi.spyOn(Date, 'now').mockReturnValue(123)
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

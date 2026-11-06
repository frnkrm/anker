import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { MemoryRepository } from '../data/memory'
import type { Rec } from '../data/types'
import { pullRecords } from './syncPull'

type Row = Rec & { server_updated_at: string }
const BEFORE = '2026-11-04T12:00:00.000001+00:00'
const CURSOR = '2026-11-05T12:00:00.000001+00:00'
const AFTER = '2026-11-05T12:00:00.000002+00:00'

function row(id: string, at = CURSOR, collection: Rec['collection'] = 'inbox'): Row {
  return { collection, id, data: { title: id }, updated_at: 1, deleted: false, server_updated_at: at }
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Minimal query double that applies the requested order, lower bound and keyset filter. */
function server(rows: Row[]) {
  const calls: { order: string[]; lower?: string; filter?: string }[] = []
  let failAt = 0
  const client = {
    from(table: string) {
      expect(table).toBe('records')
      const request: (typeof calls)[number] = { order: [] }
      calls.push(request)
      const index = calls.length
      let size = Infinity
      const query = {
        select() { return query },
        order(field: string) { request.order.push(field); return query },
        limit(n: number) { size = n; return query },
        gte(field: string, value: string) {
          expect(field).toBe('server_updated_at')
          request.lower = value
          return query
        },
        or(filter: string) { request.filter = filter; return query },
        then(resolve: (value: { data: Row[] | null; error: Error | null }) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve().then(() => {
            if (index === failAt) return { data: null, error: new Error('connection lost') }
            let selected = rows.filter((r) => !request.lower || r.server_updated_at >= request.lower)
            if (request.filter) {
              const values = [...request.filter.matchAll(/\.(?:eq|gt)\.("(?:\\.|[^"\\])*")/g)]
                .map((match) => JSON.parse(match[1]!) as string)
              expect(values).toHaveLength(6)
              const at = values[0]!
              const collection = values[2]!
              const id = values[5]!
              expect(values[1]).toBe(at)
              expect(values[3]).toBe(at)
              expect(values[4]).toBe(collection)
              selected = selected.filter((r) => r.server_updated_at > at ||
                (r.server_updated_at === at && (r.collection > collection || (r.collection === collection && r.id > id))))
            }
            selected.sort((a, b) => {
              for (const field of request.order) {
                const result = compare(String(a[field as keyof Row]), String(b[field as keyof Row]))
                if (result) return result
              }
              return 0
            })
            return { data: selected.slice(0, size), error: null }
          }).then(resolve, reject)
        },
      }
      return query
    },
  } as unknown as SupabaseClient
  return { client, calls, failOn: (page: number) => { failAt = page } }
}

describe('Sync-Seiten', () => {
  it('holt mehr als 1000 Datensätze derselben Transaktion und alle Folgeseiten', async () => {
    const rows = [
      row('old', BEFORE),
      ...Array.from({ length: 800 }, (_, i) => row(String(i).padStart(4, '0'), CURSOR, 'days')),
      ...Array.from({ length: 1300 }, (_, i) => row(String(i).padStart(4, '0'))),
      row('later', AFTER),
    ].reverse()
    const remote = server(rows)
    const repo = new MemoryRepository()
    const result = await pullRecords(remote.client, repo, CURSOR)
    expect(result).toEqual({ cursor: AFTER, changed: 2101 })
    expect(await repo.all()).toHaveLength(2101)
    expect(await repo.get('inbox', 'old')).toBeUndefined()
    expect(await repo.get('inbox', '1299')).toEqual({ title: '1299' })
    expect(remote.calls).toHaveLength(3)
    for (const call of remote.calls) {
      expect(call.order).toEqual(['server_updated_at', 'collection', 'id'])
      expect(call.lower).toBe(CURSOR)
    }
  })

  it('liest den gespeicherten Zeitstempel erneut, ohne bereits geladene Daten doppelt zu übernehmen', async () => {
    const repo = new MemoryRepository()
    const remote = server([row('already-here'), row('was-skipped')])
    await repo.merge([row('already-here')])
    const result = await pullRecords(remote.client, repo, CURSOR)
    expect(result).toEqual({ cursor: CURSOR, changed: 1 })
    expect(await repo.all()).toHaveLength(2)
    expect(await pullRecords(remote.client, repo, CURSOR)).toEqual({ cursor: CURSOR, changed: 0 })
  })

  it('quotiert importierte IDs mit PostgREST-Sonderzeichen an der Seitengrenze', async () => {
    const id = 'x,or(id.gt.0),("quoted")\\path'
    const rows = [
      ...Array.from({ length: 999 }, (_, i) => row(String(i).padStart(4, '0'))),
      row(id), row('z'),
    ]
    const remote = server(rows)
    const repo = new MemoryRepository()
    await pullRecords(remote.client, repo)
    expect(await repo.all()).toHaveLength(1001)
    expect(await repo.get('inbox', 'z')).toEqual({ title: 'z' })
    expect(remote.calls[1]?.filter).toBe([
      `server_updated_at.gt.${JSON.stringify(CURSOR)}`,
      `and(server_updated_at.eq.${JSON.stringify(CURSOR)},collection.gt."inbox")`,
      `and(server_updated_at.eq.${JSON.stringify(CURSOR)},collection.eq."inbox",id.gt.${JSON.stringify(id)})`,
    ].join(','))
  })

  it('übernimmt bei Seitenfehlern keine Teilmenge; ein Retry übernimmt alle Daten', async () => {
    const remote = server(Array.from({ length: 1001 }, (_, i) => row(String(i).padStart(4, '0'))))
    const repo = new MemoryRepository()
    remote.failOn(2)
    await expect(pullRecords(remote.client, repo, BEFORE)).rejects.toThrow('connection lost')
    expect(await repo.all()).toHaveLength(0)
    remote.failOn(0)
    const retry = await pullRecords(remote.client, repo, BEFORE)
    expect(retry).toEqual({ cursor: CURSOR, changed: 1001 })
    expect(await repo.all()).toHaveLength(1001)
  })

  it('behält bei leerem Ergebnis den bisherigen Cursor', async () => {
    expect(await pullRecords(server([]).client, new MemoryRepository(), CURSOR)).toEqual({ cursor: CURSOR, changed: 0 })
  })
})

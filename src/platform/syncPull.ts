import type { SupabaseClient } from '@supabase/supabase-js'
import type { Rec, Repository } from '../data/types'

type RemoteRecord = Rec & { server_updated_at: string }

const PAGE_SIZE = 1000

/** PostgREST filter values must stay one quoted value, even for imported record IDs. */
function literal(value: string): string {
  return JSON.stringify(value)
}

/**
 * Read every page before merging records or advancing the persisted cursor. A transaction gives all its
 * rows the same server timestamp, so the timestamp alone cannot identify a page.
 * Re-read the saved timestamp inclusively to recover its remaining rows from older
 * clients too. Buffering avoids partially persisted pages becoming invisible to
 * the store after a retry (the repeated records would no longer count as changes).
 */
export async function pullRecords(
  client: SupabaseClient,
  repo: Pick<Repository, 'merge'>,
  cursor?: string,
  accepted: () => boolean = () => true,
): Promise<{ cursor?: string; changed: number }> {
  let after: RemoteRecord | undefined
  const records: Rec[] = []
  let nextCursor = cursor
  for (;;) {
    if (!accepted()) throw new Error('Sync wurde beendet.')
    let query = client.from('records')
      .select('collection,id,data,updated_at,deleted,server_updated_at')
      .order('server_updated_at')
      .order('collection')
      .order('id')
      .limit(PAGE_SIZE)
    if (cursor) query = query.gte('server_updated_at', cursor)
    if (after) {
      const at = literal(after.server_updated_at)
      const collection = literal(after.collection)
      const id = literal(after.id)
      query = query.or([
        `server_updated_at.gt.${at}`,
        `and(server_updated_at.eq.${at},collection.gt.${collection})`,
        `and(server_updated_at.eq.${at},collection.eq.${collection},id.gt.${id})`,
      ].join(','))
    }
    const { data, error } = await query
    if (!accepted()) throw new Error('Sync wurde beendet.')
    if (error) throw error
    const rows = (data ?? []) as RemoteRecord[]
    const last = rows.at(-1)
    if (after && last && last.server_updated_at === after.server_updated_at && last.collection === after.collection && last.id === after.id) {
      throw new Error('Sync-Seite hat den Cursor nicht weiterbewegt.')
    }
    if (rows.length) {
      records.push(...rows.map(({ server_updated_at: _s, ...record }) => ({
        ...record, updated_at: Number(record.updated_at),
      })))
      nextCursor = last!.server_updated_at
    }
    if (rows.length < PAGE_SIZE) {
      if (!accepted()) throw new Error('Sync wurde beendet.')
      const changed = records.length ? await repo.merge(records) : 0
      return { cursor: nextCursor, changed }
    }
    after = last
  }
}

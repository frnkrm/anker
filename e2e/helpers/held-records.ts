/// <reference lib="dom" />
import { expect, type Page } from '@playwright/test'

interface WriteProbe {
  collection: string
  id: string
  sync?: boolean
  committed: boolean
  aborted: boolean
}
interface HeldRecordsProbe {
  phase: 'opening' | 'held' | 'released' | 'complete' | 'failed'
  hold: boolean
  writes: WriteProbe[]
}

/** Nur eine Browserfixture: hält echte IndexedDB-Writes und beobachtet deren Transaktionsabschluss. */
export async function holdRecordsWrites(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const probe: HeldRecordsProbe = { phase: 'opening', hold: true, writes: [] }
    Object.assign(window, { __ankerHeldRecords: probe })
    const originalPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      const request = key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key)
      if (this.name === 'records' && this.transaction.db.name === 'anker' && value !== null && typeof value === 'object') {
        const row = value as { collection?: unknown; id?: unknown; data?: { integrations?: { sync?: unknown } } }
        if (typeof row.collection === 'string' && typeof row.id === 'string') {
          const entry: WriteProbe = { collection: row.collection, id: row.id, committed: false, aborted: false,
            ...(typeof row.data?.integrations?.sync === 'boolean' ? { sync: row.data.integrations.sync } : {}) }
          probe.writes.push(entry)
          this.transaction.addEventListener('complete', () => { entry.committed = true }, { once: true })
          this.transaction.addEventListener('abort', () => { entry.aborted = true }, { once: true })
        }
      }
      return request
    }
    const open = indexedDB.open('anker')
    open.onerror = () => { probe.phase = 'failed'; reject(new Error('Die IDB-Testbarriere konnte nicht geöffnet werden.')) }
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction('records', 'readwrite')
      const store = transaction.objectStore('records')
      transaction.oncomplete = () => { probe.phase = 'complete'; db.close() }
      transaction.onabort = () => { probe.phase = 'failed'; db.close(); reject(new Error('Die IDB-Testbarriere wurde abgebrochen.')) }
      const keep = () => {
        const request = store.get(['settings', 'main'])
        request.onsuccess = () => {
          if (probe.phase === 'opening') { probe.phase = 'held'; resolve() }
          if (probe.hold) keep()
        }
      }
      keep()
    }
  }))
}

export function heldRecordsProbe(page: Page): Promise<HeldRecordsProbe> {
  return page.evaluate(() => (window as unknown as { __ankerHeldRecords: HeldRecordsProbe }).__ankerHeldRecords)
}

export async function releaseRecordsWrites(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probe = (window as unknown as { __ankerHeldRecords: HeldRecordsProbe }).__ankerHeldRecords
    probe.hold = false
    if (probe.phase === 'opening' || probe.phase === 'held') probe.phase = 'released'
  })
  await expect.poll(async () => (await heldRecordsProbe(page)).phase).toBe('complete')
}

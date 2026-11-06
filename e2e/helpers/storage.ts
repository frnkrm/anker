/// <reference lib="dom" />
import type { Page } from '@playwright/test'
import type { Collection } from '../../src/data/types'

/** Liest den abgeschlossenen DB-Stand statt des bereits optimistisch sichtbaren UI-Zustands. */
export async function storedRecord<T>(page: Page, collection: Collection, id: string): Promise<T | undefined> {
  return page.evaluate(({ collection, id }) => new Promise<T | undefined>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('records', 'readonly')
      const read = transaction.objectStore('records').get([collection, id])
      let value: T | undefined
      read.onsuccess = () => {
        const record = read.result as { data: T; deleted: boolean } | undefined
        value = record && !record.deleted ? record.data : undefined
      }
      transaction.oncomplete = () => { db.close(); resolve(value) }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }), { collection, id })
}

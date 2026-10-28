import { Capacitor } from '@capacitor/core'
import { MemoryRepository } from './memory'
import type { Repository } from './types'

export * from './types'

let repo: Repository | undefined

/** Wählt das passende Repository: SQLite auf Android, IndexedDB im Web, Arbeitsspeicher als Notlösung. */
export async function getRepository(): Promise<Repository> {
  if (repo) return repo
  try {
    if (Capacitor.isNativePlatform()) {
      const { SqliteRepository } = await import('./sqlite')
      repo = new SqliteRepository()
    } else {
      const { DexieRepository } = await import('./dexie')
      repo = new DexieRepository()
    }
    await repo.init()
  } catch (e) {
    console.warn('Speicher nicht verfügbar, nutze Arbeitsspeicher', e)
    repo = new MemoryRepository()
    await repo.init()
  }
  return repo
}

import { Capacitor } from '@capacitor/core'
import type { Repository } from './types'

export * from './types'

let repo: Repository | undefined
let opening: Promise<Repository> | undefined

/** Erst nach erfolgreichem Öffnen veröffentlichen; ein Fehler darf keinen flüchtigen Speicher vortäuschen. */
export function getRepository(): Promise<Repository> {
  if (repo) return Promise.resolve(repo)
  opening ??= (async () => {
    const candidate = Capacitor.isNativePlatform()
      ? new (await import('./sqlite')).SqliteRepository()
      : new (await import('./dexie')).DexieRepository()
    await candidate.init()
    repo = candidate
    return candidate
  })().catch(() => {
    // Keine SQL-/Datei-/Nutzinhalte in Meldung oder Konsole übernehmen.
    throw new Error('Der lokale Speicher konnte nicht geöffnet werden. Bitte versuche es erneut.')
  }).finally(() => { opening = undefined })
  return opening
}

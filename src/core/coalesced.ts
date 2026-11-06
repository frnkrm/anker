/**
 * Serialisiert asynchrone Abgleiche. Änderungen während eines Laufs werden zu
 * einem weiteren Lauf mit dem dann aktuellen Zustand zusammengefasst.
 */
export function coalesceAsync(work: () => Promise<void>): () => Promise<void> {
  let active: Promise<void> | undefined
  let again = false
  return () => {
    again = true
    if (active) return active
    const task = (async () => {
      let failed = false
      let failure: unknown
      do {
        again = false
        try { await work() } catch (error) { failed = true; failure = error }
      } while (again)
      // Vor dem Auflösen freigeben: ein Request in der nächsten Microtask darf nicht verloren gehen.
      active = undefined
      if (failed) throw failure
    })().finally(() => { if (active === task) active = undefined })
    active = task
    return task
  }
}

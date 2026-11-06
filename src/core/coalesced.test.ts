import { describe, expect, it } from 'vitest'
import { coalesceAsync } from './coalesced'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

describe('Asynchrone Abgleiche', () => {
  it('verhindert Überholen und verarbeitet danach den letzten Änderungsstand', async () => {
    const entered = deferred(); const gate = deferred()
    const seen: number[] = []
    let revision = 1
    const run = coalesceAsync(async () => {
      seen.push(revision)
      if (seen.length === 1) { entered.resolve(); await gate.promise }
    })
    const first = run(); await entered.promise
    revision = 2; expect(run()).toBe(first)
    revision = 3; expect(run()).toBe(first)
    expect(seen).toEqual([1])
    gate.resolve(); await first
    expect(seen).toEqual([1, 3])
  })

  it('verliert auch bei Fehlern keine bereits angeforderte Änderung und bleibt erneut nutzbar', async () => {
    const entered = deferred(); const gate = deferred()
    let calls = 0
    const run = coalesceAsync(async () => {
      calls++
      if (calls === 1) { entered.resolve(); await gate.promise; throw new Error('failed') }
    })
    const first = run(); await entered.promise
    expect(run()).toBe(first)
    const rejected = expect(first).rejects.toThrow('failed')
    gate.resolve(); await rejected
    expect(calls).toBe(2)
    await run()
    expect(calls).toBe(3)
  })

  it('nimmt einen neuen Request unmittelbar nach Abschluss an', async () => {
    let calls = 0
    const run = coalesceAsync(async () => { calls++ })
    await run()
    await run()
    expect(calls).toBe(2)
  })
})

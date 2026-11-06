import { beforeEach, describe, expect, it, vi } from 'vitest'

const probe = vi.hoisted(() => ({ native: true, fail: false, hold: false, release: undefined as (() => void) | undefined, ready: false, inits: 0, memory: 0 }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => probe.native } }))
vi.mock('./sqlite', () => ({ SqliteRepository: class {
  async init() {
    probe.inits++
    if (probe.hold) await new Promise<void>((resolve) => { probe.release = resolve })
    if (probe.fail) throw new Error('private Daten dürfen nicht im Fehlertext erscheinen')
    probe.ready = true
  }
  async get() { if (!probe.ready) throw new Error('nicht initialisiert'); return 'vorhanden' }
} }))
vi.mock('./dexie', () => ({ DexieRepository: class {
  async init() { probe.inits++; if (probe.fail) throw new Error('Speicherfehler'); probe.ready = true }
  async get() { return 'vorhanden' }
} }))
vi.mock('./memory', () => ({ MemoryRepository: class { constructor() { probe.memory++ } async init() {} } }))

beforeEach(() => {
  vi.resetModules()
  Object.assign(probe, { native: true, fail: false, hold: false, release: undefined, ready: false, inits: 0, memory: 0 })
})

describe('Dauerhafter Speicher wird nicht durch einen stillen RAM-Erfolg ersetzt', () => {
  it('meldet einen nativen Öffnungsfehler statt ein leeres flüchtiges Repository zurückzugeben', async () => {
    probe.fail = true
    const { getRepository } = await import('./index')
    await expect(getRepository()).rejects.toThrow('lokale Speicher')
    expect(probe.memory).toBe(0)
    expect(probe.ready).toBe(false)
  })

  it('kann dieselben bestehenden Daten nach einem vorübergehenden Fehler erneut öffnen', async () => {
    probe.fail = true
    const { getRepository } = await import('./index')
    await expect(getRepository()).rejects.toThrow()
    probe.fail = false
    const repository = await getRepository()
    expect(await repository.get('inbox', 'bestehend')).toBe('vorhanden')
    expect(probe.inits).toBe(2)
    expect(probe.memory).toBe(0)
  })

  it('gibt auch bei gleichzeitigen Aufrufen nie eine noch ungeöffnete Verbindung heraus', async () => {
    probe.hold = true
    const { getRepository } = await import('./index')
    let settled = 0
    const first = getRepository().then((repository) => { settled++; return repository })
    await vi.waitFor(() => expect(probe.release).toBeTypeOf('function'))
    const second = getRepository().then((repository) => { settled++; return repository })
    await Promise.resolve(); await Promise.resolve()
    expect(settled).toBe(0)
    probe.release!()
    const [a, b] = await Promise.all([first, second])
    expect(a).toBe(b)
    expect(probe.inits).toBe(1)
    expect(await a.get('inbox', 'bestehend')).toBe('vorhanden')
  })

  it('verwendet im Web ebenfalls erst den erfolgreich geöffneten dauerhaften Speicher', async () => {
    probe.native = false
    const { getRepository } = await import('./index')
    const a = await getRepository(); const b = await getRepository()
    expect(a).toBe(b)
    expect(probe.inits).toBe(1)
    expect(probe.memory).toBe(0)
  })
})

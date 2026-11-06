import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { DexieRepository } from './dexie'
import { MemoryRepository } from './memory'
import type { Repository } from './types'

const impls: [string, () => Repository][] = [
  ['Memory', () => new MemoryRepository()],
  ['Dexie', () => new DexieRepository()],
]

for (const [name, make] of impls) {
  describe(`${name}Repository`, () => {
    async function fresh() {
      const r = make()
      await r.init()
      await r.clear()
      return r
    }

    it('speichert, listet und löscht weich', async () => {
      const r = await fresh()
      await r.put('inbox', 'a', { text: 'A' })
      await r.put('inbox', 'b', { text: 'B' })
      expect(await r.get('inbox', 'a')).toEqual({ text: 'A' })
      expect(await r.list('inbox')).toHaveLength(2)
      await r.remove('inbox', 'a')
      expect(await r.get('inbox', 'a')).toBeUndefined()
      expect(await r.list('inbox')).toHaveLength(1)
      expect((await r.all()).find((x) => x.id === 'a')!.deleted).toBe(true)
    })

    it('merge: last-write-wins pro Datensatz', async () => {
      const r = await fresh()
      await r.put('days', 'd1', { v: 'lokal' })
      const local = (await r.all())[0]!
      const older = { ...local, data: { v: 'alt' }, updated_at: local.updated_at - 1000 }
      const newer = { ...local, data: { v: 'neu' }, updated_at: local.updated_at + 1000 }
      expect(await r.merge([older])).toBe(0)
      expect(await r.get('days', 'd1')).toEqual({ v: 'lokal' })
      expect(await r.merge([newer])).toBe(1)
      expect(await r.get('days', 'd1')).toEqual({ v: 'neu' })
      expect(await r.dirty()).toHaveLength(0)
    })

    it('merkt neuere Sicherungsimporte für den Sync vor, ohne ältere lokale Daten zu überschreiben', async () => {
      const r = await fresh()
      await r.put('inbox', 'x', { text: 'lokal' })
      const local = (await r.all())[0]!
      await r.markClean([local])
      expect(await r.merge([{ ...local, data: { text: 'älter' }, updated_at: local.updated_at - 1 }], { dirty: true })).toBe(0)
      expect(await r.dirty()).toHaveLength(0)
      expect(await r.merge([{ ...local, data: { text: 'importiert' }, updated_at: local.updated_at + 1 }], { dirty: true })).toBe(1)
      const dirty = await r.dirty()
      expect(dirty).toHaveLength(1)
      expect(dirty[0]!.data).toEqual({ text: 'importiert' })
      await r.markClean(dirty)
      expect(await r.dirty()).toHaveLength(0)
    })

    it('markClean nur, wenn sich der Datensatz nicht inzwischen geändert hat', async () => {
      const r = await fresh()
      await r.put('days', 'x', 1)
      const [d] = await r.dirty()
      await r.markClean([{ ...d!, updated_at: d!.updated_at - 1 }])
      expect(await r.dirty()).toHaveLength(1)
      await r.markClean([d!])
      expect(await r.dirty()).toHaveLength(0)
    })

    it('speichert Wirkung und Receipt mit dem zugehörigen Spielstand zusammen', async () => {
      const r = await fresh()
      await r.putMany([
        { collection: 'days', id: 'd1', data: { bedAt: 1, reminderReceipts: ['action'] } },
        { collection: 'game', id: 'main', data: { xp: 10 } },
      ])
      expect(await r.get('days', 'd1')).toEqual({ bedAt: 1, reminderReceipts: ['action'] })
      expect(await r.get('game', 'main')).toEqual({ xp: 10 })
      expect(await r.dirty()).toHaveLength(2)
    })
  })
}

it('Dexie rollt die gesamte Erinnerungstransaktion bei einem ungültigen zweiten Datensatz zurück', async () => {
  const r = new DexieRepository()
  await r.init(); await r.clear()
  await expect(r.putMany([
    { collection: 'days', id: 'd1', data: { bedAt: 1, reminderReceipts: ['action'] } },
    { collection: 'game', id: 'main', data: () => 'not cloneable' },
  ])).rejects.toThrow()
  expect(await r.all()).toEqual([])
})

it('Memory lässt bei einem fehlgeschlagenen Batch keine teilweise gespeicherte Wirkung zurück', async () => {
  let calls = 0
  const r = new MemoryRepository(() => { if (++calls === 2) throw new Error('clock failed'); return calls })
  await expect(r.putMany([
    { collection: 'days', id: 'd1', data: { bedAt: 1 } },
    { collection: 'game', id: 'main', data: { xp: 10 } },
  ])).rejects.toThrow('clock failed')
  expect(await r.all()).toEqual([])
})

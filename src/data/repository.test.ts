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

    it('speichert lokale Arbeitsaufgabe und Inbox-Tombstone gemeinsam, ohne die Notiz weiter anzuzeigen', async () => {
      const r = await fresh()
      await r.put('inbox', 'gedanke', { text: 'Vorgang prüfen', status: 'open' })
      await r.markClean(await r.dirty())
      await r.putMany([
        { collection: 'meta', id: 'local', data: { work: [{ id: 'arbeit', title: 'Vorgang prüfen', createdAt: 1 }] } },
        { collection: 'inbox', id: 'gedanke', data: null, deleted: true },
      ])
      expect(await r.get('meta', 'local')).toEqual({ work: [{ id: 'arbeit', title: 'Vorgang prüfen', createdAt: 1 }] })
      expect(await r.get('inbox', 'gedanke')).toBeUndefined()
      expect(await r.list('inbox')).toEqual([])
      const pending = await r.dirty()
      expect(pending).toHaveLength(2)
      expect(pending.find((record) => record.collection === 'inbox')).toMatchObject({ id: 'gedanke', data: null, deleted: true, dirty: 1 })
      expect(pending.find((record) => record.collection === 'meta')).toMatchObject({ deleted: false, dirty: 1 })
      await r.markClean(pending)
      expect(await r.dirty()).toEqual([])
    })

    it('bewahrt Batch-Löschung gegen ältere Syncstände und erlaubt ausdrückliche Wiederherstellung', async () => {
      const r = await fresh()
      await r.putMany([{ collection: 'inbox', id: 'gedanke', data: null, deleted: true }])
      const tombstone = (await r.all())[0]!
      expect(await r.merge([{ ...tombstone, data: { text: 'alter Stand' }, deleted: false, updated_at: tombstone.updated_at - 1 }])).toBe(0)
      expect(await r.get('inbox', 'gedanke')).toBeUndefined()
      await r.putMany([{ collection: 'inbox', id: 'gedanke', data: { text: 'wiederhergestellt' }, deleted: false }])
      expect(await r.get('inbox', 'gedanke')).toEqual({ text: 'wiederhergestellt' })
      expect((await r.all())[0]!.deleted).toBe(false)
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

it('Dexie erhält die ursprüngliche Notiz und Arbeitsdaten, wenn der Batch nach dem Tombstone fehlschlägt', async () => {
  const r = new DexieRepository()
  await r.init(); await r.clear()
  await r.put('inbox', 'gedanke', { text: 'bleibt erhalten' })
  await r.put('meta', 'local', { work: [] })
  const before = await r.all()
  await expect(r.putMany([
    { collection: 'inbox', id: 'gedanke', data: null, deleted: true },
    { collection: 'meta', id: 'local', data: { work: [() => 'not cloneable'] } },
  ])).rejects.toThrow()
  expect(await r.all()).toEqual(before)
  expect(await r.get('inbox', 'gedanke')).toEqual({ text: 'bleibt erhalten' })
})

it('Memory veröffentlicht keinen Tombstone, wenn das zweite Batch-Schreiben fehlschlägt', async () => {
  let fail = false
  let batchWrites = 0
  const r = new MemoryRepository(() => {
    if (fail && ++batchWrites === 2) throw new Error('clock failed')
    return 1
  })
  await r.put('inbox', 'gedanke', { text: 'bleibt erhalten' })
  await r.put('meta', 'local', { work: [] })
  const before = await r.all()
  fail = true
  await expect(r.putMany([
    { collection: 'inbox', id: 'gedanke', data: null, deleted: true },
    { collection: 'meta', id: 'local', data: { work: [{ id: 'arbeit', title: 'Neuer Stand' }] } },
  ])).rejects.toThrow('clock failed')
  expect(await r.all()).toEqual(before)
  expect(await r.get('inbox', 'gedanke')).toEqual({ text: 'bleibt erhalten' })
})

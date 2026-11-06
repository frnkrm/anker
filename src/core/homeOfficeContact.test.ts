import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyLocal } from './defaults'
import { makeBackup, parseBackup } from './export/backup'
import { CONTACT_DELAY_MS, homeOfficeContactDue, validHomeOfficeContacts } from './homeOfficeContact'
import type { LocalData } from './types'
import type { Rec } from '../data/types'

const date = '2026-11-06'
const at = Date.parse(`${date}T09:00:00+01:00`)
describe('Bewusste lokale Homeoffice-Kontaktwahl', () => {
  it('ist bei Altständen nicht gewählt und fragt ausschließlich nach bewusstem Später frühestens30Minuten', () => {
    expect(validHomeOfficeContacts(undefined)).toBe(true)
    for (const entry of [undefined, { status: 'done' as const, at }, { status: 'not-needed' as const, at }, { status: 'later' as const, at }]) expect(homeOfficeContactDue(entry, at + CONTACT_DELAY_MS)).toBe(false)
    const later = { status: 'later' as const, at, remindAt: at + CONTACT_DELAY_MS }
    expect(homeOfficeContactDue(later, at + CONTACT_DELAY_MS - 1)).toBe(false)
    expect(homeOfficeContactDue(later, at + CONTACT_DELAY_MS)).toBe(true)
    expect(homeOfficeContactDue({ status: 'later', at }, at + CONTACT_DELAY_MS + 99_000)).toBe(false)
  })
  it('weist ungültige Daten und erneute automatische Rückfragen in erledigten oder nicht nötigen Zuständen zurück', () => {
    for (const value of [null, [], { '2026-02-30': { status: 'done', at } }, { '2026-99-99': { status: 'done', at } }, { [date]: { status: 'sent', at } }, { [date]: { status: 'done', at: Infinity } }, { [date]: { status: 'done', at, remindAt: at + CONTACT_DELAY_MS } }, { [date]: { status: 'later', at, remindAt: at + 1 } }]) expect(validHomeOfficeContacts(value)).toBe(false)
  })
  it('bewahrt Kontakte im vollständigen Backup und lässt sie beim bewussten Auslassen der Arbeitsdaten weg', () => {
    const local = { ...emptyLocal(), homeOfficeContact: { [date]: { status: 'later' as const, at, remindAt: at + CONTACT_DELAY_MS } } }
    const records: Rec[] = [{ collection: 'meta', id: 'local', data: local, updated_at: at, deleted: false }]
    expect((parseBackup(JSON.stringify(makeBackup(records)))[0]!.data as LocalData).homeOfficeContact).toEqual(local.homeOfficeContact)
    expect((makeBackup(records, new Date(at), { work: false }).records[0]!.data as LocalData).homeOfficeContact).toBeUndefined()
    expect(local.homeOfficeContact[date]).toHaveProperty('remindAt')
  })
  it('verhindert bei beschädigtem Kontaktstatus einen Teilimport und bewahrt kompatible alte Einstellungen', () => {
    const records: Rec[] = [{ collection: 'settings', id: 'main', data: defaultSettings(date), updated_at: at, deleted: false }, { collection: 'meta', id: 'local', data: { homeOfficeContact: { [date]: { status: 'done', at, remindAt: 0 } } }, updated_at: at, deleted: false }]
    expect(() => parseBackup(JSON.stringify(makeBackup(records)))).toThrow('Es wurde nichts importiert')
  })
})

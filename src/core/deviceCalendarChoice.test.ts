import { describe, expect, it } from 'vitest'
import { deviceCalendarSelectionId, validExtrasLocal } from './extras'

const key = (id: string, binding = 'a') => `${id}:${binding.repeat(64)}`

describe('Gerätelokale Kalenderwahl', () => {
  it('erhält Altstände und eine ausdrücklich inaktive Auswahl ohne Kalender', () => {
    expect(validExtrasLocal(undefined)).toBe(true)
    expect(validExtrasLocal({})).toBe(true)
    expect(validExtrasLocal({ deviceCalendar: { enabled: false, calendarIds: [], selectedAt: 0 } })).toBe(true)
    expect(validExtrasLocal({ deviceCalendar: { enabled: true, calendarIds: [key('1')], selectedAt: 1 } })).toBe(true)
  })
  it('verwirft ungebundene, mehrdeutige oder nicht native-kompatible Anbieterkennungen', () => {
    for (const id of ['0', '-1', '01', '1.0', '1 OR 1=1', '9223372036854775808']) expect(deviceCalendarSelectionId(key(id))).toBe(false)
    for (const id of ['1', '1:' + 'A'.repeat(64), key('1') + '\n', null, 1]) expect(deviceCalendarSelectionId(id)).toBe(false)
    expect(deviceCalendarSelectionId(key('9223372036854775807'))).toBe(true)
  })
  it('aktiviert weder leere noch zu breite oder doppelte Auswahlen', () => {
    for (const calendarIds of [[], [key('1'), key('1')], [key('1'), key('1', 'b')],
      Array.from({ length: 21 }, (_, index) => key(String(index + 1)))]) {
      expect(validExtrasLocal({ deviceCalendar: { enabled: true, calendarIds, selectedAt: 1 } })).toBe(false)
    }
  })
  it('weist beschädigte Freigaben ab statt sie beim Wiederherstellen zu aktivieren', () => {
    for (const enabled of [undefined, 1, 'true', null]) expect(validExtrasLocal({ deviceCalendar: { enabled, calendarIds: [key('1')], selectedAt: 1 } })).toBe(false)
    for (const selectedAt of [undefined, -1, NaN, Infinity]) expect(validExtrasLocal({ deviceCalendar: { enabled: true, calendarIds: [key('1')], selectedAt } })).toBe(false)
  })
})

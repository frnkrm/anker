import { describe, expect, it } from 'vitest'
import { eveningLocalFields, fromBerlinDateTimeInput, nextEveningTime, openThoughts, pendingTomorrowSteps, reviewDue, toBerlinDateTimeInput, validEveningLocal } from './evening'
import { tasksFor } from './support'
import { zonedToUtc } from './time'
import type { InboxItem, TomorrowStep } from './types'

const now = zonedToUtc('2026-11-02', 22 * 60)
const tomorrow = zonedToUtc('2026-11-03', 11 * 60)
const thought: InboxItem = { id: 'idea', text: 'Eine Idee', status: 'open', createdAt: now, reviewAt: tomorrow }
const step: TomorrowStep = { id: 'step', title: 'Modell', nextStep: 'Teile bereitlegen', createdAt: now, resumeAt: tomorrow, remind: false }

describe('Abendideen und nächste Schritte', () => {
  it('lässt geparkte Gedanken bis zur gewählten Zeit ruhen und macht daraus keine Aufgaben', () => {
    expect(openThoughts([thought], now)).toEqual([])
    expect(reviewDue(thought, now)).toBe(false)
    expect(openThoughts([thought], tomorrow)).toEqual([thought])
    expect(reviewDue(thought, tomorrow)).toBe(true)
    expect(tasksFor([thought], '2026-11-03')).toEqual([])
    expect(reviewDue({ ...thought, status: 'kept' }, tomorrow)).toBe(false)
    expect(openThoughts([{ ...thought, reviewAt: NaN }], now)).toHaveLength(1)
    expect(openThoughts([{ ...thought, reviewAt: 1e300 }], now)).toHaveLength(1)
  })

  it('lässt private nächste Schritte über mehrere Tage bestehen, bis sie bewusst erledigt sind', () => {
    expect(pendingTomorrowSteps([step], now)).toEqual([])
    expect(pendingTomorrowSteps([step], tomorrow + 7 * 86_400_000)).toEqual([step])
    expect(pendingTomorrowSteps([{ ...step, doneAt: tomorrow }], tomorrow + 1)).toEqual([])
  })

  it('rechnet Eingaben in Berlin und weist ungültige Tage oder Zeitumstellungslücken ab', () => {
    expect(fromBerlinDateTimeInput('2026-11-03T11:00')).toBe(tomorrow)
    expect(toBerlinDateTimeInput(tomorrow)).toBe('2026-11-03T11:00')
    expect(fromBerlinDateTimeInput('2026-10-25T02:30')).toBe(Date.UTC(2026, 9, 25, 1, 30))
    for (const value of ['2026-02-30T12:00', '2026-03-29T02:30', '2026-11-03T25:00', 'falsch']) {
      expect(fromBerlinDateTimeInput(value)).toBeNaN()
    }
  })

  it('schlägt vor 04:00 noch den kommenden Morgen desselben Kalendertags vor', () => {
    expect(nextEveningTime(now)).toBe(tomorrow)
    expect(nextEveningTime(zonedToUtc('2026-11-03', 60))).toBe(tomorrow)
    expect(nextEveningTime(zonedToUtc('2026-11-03', 240))).toBe(zonedToUtc('2026-11-04', 11 * 60))
  })

  it('ergänzt alte Daten und schützt neue Ansichten vor beschädigten Containern', () => {
    expect(eveningLocalFields(undefined)).toEqual({ tomorrowSteps: [], sleepDiary: {} })
    expect(eveningLocalFields({ tomorrowSteps: null, sleepDiary: null })).toEqual({ tomorrowSteps: [], sleepDiary: {} })
    expect(validEveningLocal({})).toBe(true)
    expect(validEveningLocal({ tomorrowSteps: [step], sleepDiary: {} }, now)).toBe(true)
    expect(validEveningLocal({ tomorrowSteps: [{}] })).toBe(false)
    expect(validEveningLocal({ sleepDiary: { '2026-11-02': { bedAt: 'falsch' } } })).toBe(false)
  })
})

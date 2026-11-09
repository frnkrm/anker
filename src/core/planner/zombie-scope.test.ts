import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../defaults'
import type { DayOverride } from '../types'
import { buildDayPlan } from './plan'

const date = '2026-11-12'
function settings() {
  const value = defaultSettings(date)
  value.sport.days = value.sport.days.map(() => false)
  value.routines.morning = [
    { id: 'morning-water', title: 'Wasser', minutes: 3, minimal: { title: 'Ein Schluck', minutes: 1 }, isEssentialForZombieMode: true },
    { id: 'morning-extra', title: 'Eigener Zusatz', minutes: 4, minimal: { title: 'Kurz beginnen', minutes: 1 } },
  ]
  value.routines.evening = [
    { id: 'evening-teeth', title: 'Zähne putzen', minutes: 10, minimal: { title: 'Kurz putzen', minutes: 2 }, tag: 'teeth', isEssentialForZombieMode: false },
    { id: 'evening-extra', title: 'Tasche vorbereiten', minutes: 12, minimal: { title: 'Schlüssel hinlegen', minutes: 1 }, tag: 'tidy', isEssentialForZombieMode: true },
  ]
  return value
}

describe('Zombie-Auswahl ist auf die Morgenroutine begrenzt', () => {
  it('erhält alle Abendschritte und ihre vollständigen Zeitbudgets trotz alter Abendmarkierungen', () => {
    const value = settings()
    const before = structuredClone(value)
    const baseline = buildDayPlan({ date, settings: value })
    const reduced = buildDayPlan({ date, settings: value, override: { zombie: true } })
    const evening = baseline.blocks.find(block => block.routine === 'evening')!
    expect(evening.steps!.map(step => step.id)).toEqual(['evening-teeth', 'evening-extra'])
    expect(evening.steps!.every(step => !step.useMinimal)).toBe(true)
    expect(reduced.blocks.find(block => block.routine === 'morning')!.steps!.map(step => step.id)).toEqual(['morning-water'])
    expect(reduced.blocks.find(block => block.routine === 'evening')).toEqual(evening)
    expect(value).toEqual(before)
  })

  it.each<DayOverride>([
    { light: true },
    { mode: 'wenig-energie' },
    { mode: 'ueberlastet' },
    { dayType: 'sick' },
  ])('ändert die bisherige Abendwahl für %j nicht', override => {
    const value = settings()
    const baseline = buildDayPlan({ date, settings: value, override })
    const reduced = buildDayPlan({ date, settings: value, override: { ...override, zombie: true } })
    const evening = baseline.blocks.find(block => block.routine === 'evening')!
    expect(evening.steps!.every(step => step.useMinimal)).toBe(true)
    expect(reduced.blocks.find(block => block.routine === 'evening')).toEqual(evening)
    if (override.mode === 'ueberlastet' || override.dayType === 'sick') expect(evening.steps!.map(step => step.id)).toEqual(['evening-teeth'])
  })
})

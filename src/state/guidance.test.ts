import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyLocal } from '../core/defaults'
import { deriveGuidance, genuineMorningCompleted, guidancePlanDate, guidancePreferences } from '../core/guidance'
import { makeBackup, parseBackup } from '../core/export/backup'
import { addDays, zonedToUtc } from '../core/time'
import type { LocalData } from '../core/types'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/types'
import { planFor, today, useApp } from './store'

const storage = vi.hoisted(() => ({ repo: undefined as Repository | undefined }))
vi.mock('../data', () => ({ getRepository: async () => storage.repo! }))
const date = '2026-11-12'
const at = (minutes: number, day = date) => zonedToUtc(day, minutes)
const handoff = () => ({ occurrenceId: 'native-main-1', targetDate: date, alarmAt: Date.now() - 60_000, confirmedAt: Date.now() })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at(420))
  storage.repo = new MemoryRepository()
  useApp.setState({ ready: false, settings: defaultSettings(date), local: emptyLocal(), workUndo: undefined })
  await useApp.getState().load()
  await useApp.getState().saveSettings(s => ({
    ...s, onboarded: true, sport: { ...s.sport, days: s.sport.days.map(() => false) },
    anchor: { ...s.anchor, wake: 420, manual: { wake: true, pcStop: true, bed: true } }, pcStop: 1350, bed: 1380,
    guidance: { ...guidancePreferences(), enabled: true, zeroGapMorning: true, bedtimeQr: true, pcLock: true, autoZombie: true },
  }))
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('Atomarer Einstieg nach dem Hauptwecker', () => {
  it('wertet einen Tipp vor dem tatsächlichen Weckerübergang nicht als anschließende Aktivierung', async () => {
    await useApp.getState().recordGuidanceInteraction(date)
    vi.setSystemTime(Date.now() + 10 * 60_000)
    const event = handoff()
    await useApp.getState().activateMorningFromAlarm(event)
    expect(useApp.getState().local.guidance?.days[date]?.firstInteractionAt).toBeUndefined()
    vi.setSystemTime(Date.now() + 61_000)
    const state = useApp.getState()
    expect(deriveGuidance({ plan: planFor(date), log: state.days[date], local: state.local, settings: state.settings, nowMs: Date.now() }).autoZombieDue).toBe(true)
    await state.recordGuidanceInteraction(date, event.confirmedAt - 1)
    expect(useApp.getState().local.guidance?.days[date]?.firstInteractionAt).toBeUndefined()
    await useApp.getState().recordGuidanceInteraction(date)
    const real = useApp.getState().local.guidance?.days[date]?.firstInteractionAt
    expect(real).toBe(Date.now())
    await useApp.getState().activateMorningFromAlarm(event)
    expect(useApp.getState().local.guidance?.days[date]?.firstInteractionAt).toBe(real)
  })
  it('ersetzt veraltete Interaktion, erhält aber echte Berührung nach einem verzögert zugestellten Override', async () => {
    await useApp.getState().saveLocal(local => ({ ...local, guidance: { receipts: [], days: { [date]: { morningActivatedAt: Date.now() - 30_000, firstInteractionAt: Date.now() - 60_000 } } } }))
    await useApp.getState().recordGuidanceInteraction(date)
    expect(useApp.getState().local.guidance?.days[date]?.firstInteractionAt).toBe(Date.now())
    const real = Date.now()
    await useApp.getState().activateMorningFromAlarm({ ...handoff(), confirmedAt: real - 1000 })
    expect(useApp.getState().local.guidance?.days[date]?.firstInteractionAt).toBe(real)
  })
  it('speichert Weckzeit, ersten Countdown und Receipt einmal gemeinsam und erhält sie nach Neustart', async () => {
    const event = handoff(); const game = structuredClone(useApp.getState().game)
    const write = vi.spyOn(storage.repo!, 'putMany')
    expect(await Promise.all([useApp.getState().activateMorningFromAlarm(event), useApp.getState().activateMorningFromAlarm(event)])).toEqual([true, true])
    expect(write).toHaveBeenCalledTimes(1)
    expect(write.mock.calls[0]![0].map(record => [record.collection, record.id])).toEqual([['days', date], ['meta', 'local']])
    const local = useApp.getState().local
    expect(local.focus?.target).toMatchObject({ kind: 'routine', date, routine: 'morning', stepId: 'water' })
    expect(local.focus?.timer.status).toBe('running')
    expect(local.guidance?.receipts).toEqual(['morning:native-main-1'])
    expect(useApp.getState().days[date]?.wakeAt).toBe(event.confirmedAt)
    expect(useApp.getState().days[date]?.steps).toEqual({})
    expect(useApp.getState().game).toEqual(game)
    await useApp.getState().load()
    expect(useApp.getState().local.focus).toEqual(local.focus)
    expect(await useApp.getState().activateMorningFromAlarm(event)).toBe(true)
    expect(useApp.getState().local.focus).toEqual(local.focus)
  })
  it('publiziert bei fehlgeschlagenem Commit weder falsches Wachsein noch Timer oder Receipt', async () => {
    const before = { local: structuredClone(useApp.getState().local), days: structuredClone(useApp.getState().days) }
    vi.spyOn(storage.repo!, 'putMany').mockRejectedValueOnce(new Error('disk'))
    await expect(useApp.getState().activateMorningFromAlarm(handoff())).rejects.toThrow('disk')
    expect(useApp.getState().local).toEqual(before.local)
    expect(useApp.getState().days).toEqual(before.days)
    expect(await storage.repo!.get('meta', 'local')).toBeUndefined()
    expect(await useApp.getState().activateMorningFromAlarm(handoff())).toBe(true)
  })
  it('behält einen eigenen Wach-Eintrag und akzeptiert ein frühes Aktivitätswecken vor dem festen Ziel', async () => {
    await useApp.getState().mark(date, 'wakeAt', Date.now() - 120_000)
    await useApp.getState().activateMorningFromAlarm({ ...handoff(), alarmAt: Date.now() + 45 * 60_000 })
    expect(useApp.getState().days[date]?.wakeAt).toBe(Date.now() - 120_000)
  })
  it('nimmt ohne Freigabe und bei einer veralteten oder fremden Datumsaussage nichts vor', async () => {
    await useApp.getState().saveSettings(s => ({ ...s, guidance: { ...s.guidance, zeroGapMorning: false } }))
    expect(await useApp.getState().activateMorningFromAlarm(handoff())).toBe(false)
    expect(useApp.getState().local.guidance).toBeUndefined()
    await useApp.getState().saveSettings(s => ({ ...s, guidance: { ...s.guidance, zeroGapMorning: true } }))
    await expect(useApp.getState().activateMorningFromAlarm({ ...handoff(), targetDate: '2020-01-01' })).rejects.toThrow(/nicht mehr aktuell/)
    await expect(useApp.getState().activateMorningFromAlarm({ ...handoff(), confirmedAt: Date.now() - 25 * 3600_000 })).rejects.toThrow(/nicht mehr aktuell/)
  })
  it('erhält nach einem echten 03:30-Wecker den nächsten Morgentag auch über Laden und Schrittwechsel', async () => {
    const next = addDays(date, 1)
    vi.setSystemTime(at(210, next))
    expect(today()).toBe(date)
    const event = { ...handoff(), targetDate: next }
    await useApp.getState().activateMorningFromAlarm(event)
    expect(guidancePlanDate(useApp.getState().local, today(), Date.now())).toBe(next)
    await useApp.getState().load()
    const first = useApp.getState().local.focus!
    expect(first.target).toMatchObject({ date: next, routine: 'morning', stepId: 'water' })
    await useApp.getState().setStep(next, 'morning', 'water', 'done')
    await useApp.getState().clearFocus(first.id)
    expect(guidancePlanDate(useApp.getState().local, today(), Date.now())).toBe(next)
    const step = planFor(next).blocks.find(block => block.routine === 'morning')!.steps!.find(item => item.id === 'move')!
    await useApp.getState().ensureFocus({ kind: 'routine', date: next, routine: 'morning', stepId: step.id, minimal: !!step.useMinimal }, step.minutes * 60)
    expect(useApp.getState().local.focus?.target).toMatchObject({ date: next, stepId: 'move' })
  })
})

describe('Kleine echte Handlungen statt künstlicher Erledigungen', () => {
  it.each(['manual', 'automatic'] as const)('erhält einen laufenden minimalen Abendfokus beim %s-Morgenwechsel', async source => {
    await useApp.getState().saveSettings(s => ({ ...s, routines: {
      morning: [
        { id: 'm-first', title: 'Wasser', minutes: 3, minimal: { title: 'Ein Schluck', minutes: 1 }, isEssentialForZombieMode: true },
        { id: 'm-second', title: 'Morgenzusatz', minutes: 4 },
      ],
      evening: [
        { id: 'e-first', title: 'Abendschritt', minutes: 10, minimal: { title: 'Kleine eigene Abendwahl', minutes: 2 }, isEssentialForZombieMode: false },
        { id: 'e-second', title: 'Abendzusatz', minutes: 12, minimal: { title: 'Ein kleiner Teil', minutes: 1 }, isEssentialForZombieMode: true },
      ],
    } }))
    await useApp.getState().activateMorningFromAlarm(handoff())
    await useApp.getState().setStep(date, 'evening', 'e-second', 'minimal')
    await useApp.getState().ensureFocus({ kind: 'routine', date, routine: 'evening', stepId: 'e-first', minimal: true }, 120)
    const before = structuredClone(useApp.getState().local.focus!)
    const evening = structuredClone(planFor(date).blocks.find(block => block.routine === 'evening'))
    const steps = structuredClone(useApp.getState().days[date]!.steps)
    const game = structuredClone(useApp.getState().game)
    const savedEvening = structuredClone(useApp.getState().settings.routines.evening)
    for (const enabled of [true, false]) {
      vi.setSystemTime(Date.now() + 15_000)
      await useApp.getState().setZombie(date, enabled, source)
      expect(useApp.getState().local.focus).toEqual(before)
      expect(planFor(date).blocks.find(block => block.routine === 'evening')).toEqual(evening)
      expect(useApp.getState().settings.routines.evening).toEqual(savedEvening)
      expect(useApp.getState().days[date]!.steps).toEqual(steps)
      expect(useApp.getState().game).toEqual(game)
      expect(genuineMorningCompleted(planFor(date), useApp.getState().days[date])).toBe(false)
      expect(useApp.getState().local.guidance?.days[date]?.morningCompletedAt).toBeUndefined()
      expect(planFor(date).blocks.find(block => block.routine === 'morning')!.steps!.map(step => step.id)).toEqual(enabled ? ['m-first'] : ['m-first', 'm-second'])
    }
  })
  it('reduziert auf eigene Kernschritte, erhält andere Modi und keine ausgelassenen Häkchen', async () => {
    await useApp.getState().saveSettings(s => ({ ...s, routines: { ...s.routines, morning: [
      { id: 'water', title: 'Wasser', minutes: 3, minimal: { title: 'Ein Schluck', minutes: 1 }, isEssentialForZombieMode: true },
      { id: 'extra', title: 'Eigener Zusatz', minutes: 1 },
    ] } }))
    await useApp.getState().activateMorningFromAlarm(handoff())
    await useApp.getState().updateDay(date, log => ({ ...log, override: { ...log.override, mode: 'auf-kurs' } }))
    const game = structuredClone(useApp.getState().game)
    const originalFocus = structuredClone(useApp.getState().local.focus!)
    vi.setSystemTime(Date.now() + 30_000)
    await useApp.getState().setZombie(date, true)
    expect(useApp.getState().days[date]?.override).toMatchObject({ zombie: true, mode: 'auf-kurs' })
    expect(planFor(date).blocks.find(block => block.routine === 'morning')?.steps?.map(step => step.id)).toEqual(['water'])
    expect(useApp.getState().days[date]?.steps).toEqual({})
    expect(useApp.getState().local.focus?.target).toMatchObject({ stepId: 'water', minimal: true })
    expect(useApp.getState().game).toEqual(game)
    vi.setSystemTime(Date.now() + 10_000)
    await useApp.getState().setZombie(date, false)
    expect(planFor(date).blocks.find(block => block.routine === 'morning')!.steps!.length).toBeGreaterThan(1)
    expect(useApp.getState().local.focus?.id).toBe(originalFocus.id)
    expect(useApp.getState().local.focus?.timer).toMatchObject({ status: 'running', deadlineAt: Date.now() + 150_000 })
  })
  it('beendet keine leere Routine durch Timerablauf und merkt erst echte Interaktion', async () => {
    await useApp.getState().activateMorningFromAlarm(handoff())
    vi.setSystemTime(Date.now() + 61_000)
    let st = useApp.getState()
    expect(deriveGuidance({ plan: planFor(date), log: st.days[date], settings: st.settings, local: st.local, nowMs: Date.now() }).autoZombieDue).toBe(true)
    expect(st.days[date]?.steps).toEqual({})
    await st.setZombie(date, true, 'automatic')
    expect(useApp.getState().local.guidance?.days[date]?.firstInteractionAt).toBeUndefined()
    expect(useApp.getState().days[date]?.steps).toEqual({})
    await st.recordGuidanceInteraction(date)
    st = useApp.getState()
    expect(deriveGuidance({ plan: planFor(date), log: st.days[date], settings: st.settings, local: st.local, nowMs: Date.now() }).autoZombieDue).toBe(false)
  })
})

describe('Bestätigte Nacht und hardwaregebundene Verlängerung', () => {
  it('speichert die Nachtbestätigung idempotent und behauptet kein Liegen im Bett', async () => {
    vi.setSystemTime(at(1380))
    const game = structuredClone(useApp.getState().game)
    await useApp.getState().verifyBedtime(date, 'qr-confirmation')
    await useApp.getState().verifyBedtime(date, 'qr-confirmation')
    expect(useApp.getState().local.guidance?.receipts).toEqual(['bed:qr-confirmation'])
    expect(useApp.getState().local.guidance?.days[date]).toMatchObject({ nightLockedAt: at(1380), bedVerifiedAt: at(1380) })
    expect(useApp.getState().days[date]?.bedAt).toBeUndefined()
    expect(useApp.getState().game).toEqual(game)
    await useApp.getState().load()
    const st = useApp.getState()
    expect(deriveGuidance({ plan: planFor(date), settings: st.settings, local: st.local, nowMs: Date.now() }).lockEnforced).toBe(true)
  })
  it('bindet die Verlängerung an die noch aktive Nacht und lässt einen alten Receipt nicht verlängern', async () => {
    vi.setSystemTime(at(1380)); await useApp.getState().verifyBedtime(date, 'night-1')
    const next = addDays(date, 1); vi.setSystemTime(at(240, next))
    await useApp.getState().extendGuidanceEmergency(next, 'hardware-1', Date.now() + 15 * 60_000)
    const until = useApp.getState().local.guidance!.days[date]!.emergencyUntil
    expect(until).toBe(Date.now() + 15 * 60_000)
    await useApp.getState().extendGuidanceEmergency(next, 'hardware-1', Date.now() + 45 * 60_000)
    expect(useApp.getState().local.guidance!.days[date]!.emergencyUntil).toBe(until)
    let st = useApp.getState()
    expect(deriveGuidance({ plan: planFor(next), settings: st.settings, local: st.local, nowMs: Date.now() }).lockEnforced).toBe(false)
    vi.setSystemTime(until! + 1); st = useApp.getState()
    expect(deriveGuidance({ plan: planFor(next), settings: st.settings, local: st.local, nowMs: Date.now() }).lockEnforced).toBe(true)
  })
  it('gibt den PC nur nach echten Kernschritten des nächsten Morgens frei', async () => {
    vi.setSystemTime(at(1380)); await useApp.getState().verifyBedtime(date, 'night-1')
    const next = addDays(date, 1); vi.setSystemTime(at(420, next))
    await useApp.getState().saveSettings(s => ({ ...s, routines: { ...s.routines, morning: [{ id: 'water', title: 'Wasser', minutes: 1, isEssentialForZombieMode: true }] } }))
    await useApp.getState().activateMorningFromAlarm({ ...handoff(), targetDate: next })
    await useApp.getState().setStep(next, 'morning', 'water', 'skipped')
    let st = useApp.getState()
    expect(deriveGuidance({ plan: planFor(next), log: st.days[next], settings: st.settings, local: st.local, nowMs: Date.now() })).toMatchObject({ morningCompleted: false, lockEnforced: true })
    await useApp.getState().setStep(next, 'morning', 'water', 'minimal')
    st = useApp.getState()
    expect(deriveGuidance({ plan: planFor(next), log: st.days[next], settings: st.settings, local: st.local, nowMs: Date.now() })).toMatchObject({ morningCompleted: true, lockEnforced: false })
    expect(st.local.guidance?.days[next]?.morningCompletedAt).toBe(Date.now())
  })
})

describe('Private Abendnotizen und optionale Lichtvorlage', () => {
  it('zeigt den Abendgedanken erst nach der echten Routine am nächsten Morgen, auch wenn sie später fertig wird', async () => {
    vi.setSystemTime(at(1370))
    const id = await useApp.getState().saveBrainDump(date, 'Morgen wiederfinden')
    let st = useApp.getState()
    expect(deriveGuidance({ plan: planFor(date), settings: st.settings, local: st.local, log: st.days[date], nowMs: Date.now() }).brainDumpIds).toEqual([])
    const next = addDays(date, 1); vi.setSystemTime(at(420, next))
    await useApp.getState().activateMorningFromAlarm({ ...handoff(), targetDate: next })
    st = useApp.getState()
    expect(deriveGuidance({ plan: planFor(next), settings: st.settings, local: st.local, log: st.days[next], nowMs: Date.now() }).brainDumpIds).toEqual([])
    vi.setSystemTime(at(900, next))
    for (const step of planFor(next).blocks.find(block => block.routine === 'morning')!.steps!) await useApp.getState().setStep(next, 'morning', step.id, 'minimal')
    st = useApp.getState()
    expect(deriveGuidance({ plan: planFor(next), settings: st.settings, local: st.local, log: st.days[next], nowMs: Date.now() })).toMatchObject({ phase: 'MORNING_COMPLETED', brainDumpIds: [id] })
    await st.markBrainDumpShown(date)
    st = useApp.getState()
    expect(deriveGuidance({ plan: planFor(next), settings: st.settings, local: st.local, log: st.days[next], nowMs: Date.now() }).brainDumpIds).toEqual([])
    expect(st.local.tomorrowSteps.find(step => step.id === id)?.doneAt).toBeUndefined()
  })
  it('speichert einen Brain-Dump atomar nur als privaten nächsten Schritt und bestätigt ihn beim Anzeigen nicht als erledigt', async () => {
    vi.setSystemTime(at(1370))
    const game = structuredClone(useApp.getState().game)
    const id = await useApp.getState().saveBrainDump(date, ' Den Gedanken behalten ')
    expect(useApp.getState().inbox).toEqual([])
    expect(useApp.getState().local.tomorrowSteps[0]).toMatchObject({ id, title: 'Für morgen', nextStep: 'Den Gedanken behalten', remind: false })
    expect(useApp.getState().local.guidance?.days[date]?.brainDumpIds).toEqual([id])
    await useApp.getState().markBrainDumpShown(date)
    expect(useApp.getState().local.tomorrowSteps[0]?.doneAt).toBeUndefined()
    await useApp.getState().saveBrainDump(date, 'Neuer Gedanke')
    expect(useApp.getState().local.guidance?.days[date]?.brainDumpShownAt).toBeUndefined()
    expect(useApp.getState().game).toEqual(game)
    await useApp.getState().load()
    expect(useApp.getState().local.tomorrowSteps).toHaveLength(2)
  })
  it('belässt einen fehlgeschlagenen Brain-Dump ohne halbe Referenz oder Erfolg', async () => {
    vi.spyOn(storage.repo!, 'put').mockRejectedValueOnce(new Error('disk'))
    await expect(useApp.getState().saveBrainDump(date, 'Nicht verlieren')).rejects.toThrow('disk')
    expect(useApp.getState().local.tomorrowSteps).toEqual([])
    expect(useApp.getState().local.guidance).toBeUndefined()
  })
  it('speichert eigene Wenn-dann-Felder privat und lässt ihre PC-Freigabe eigenständig', async () => {
    const plan = { wish: ' Früher gehen ', outcome: 'Ausgeschlafen', obstacle: 'Noch eine Runde', sentence: 'Bei der Karte speichere ich.', showOnPc: false }
    await useApp.getState().saveIfThenPlan(plan)
    await useApp.getState().load()
    expect(useApp.getState().local.guidance?.ifThen).toEqual({ ...plan, wish: 'Früher gehen' })
    const backup = parseBackup(JSON.stringify(makeBackup(await storage.repo!.all(), new Date(), { health: false })))
    expect((backup.find(record => record.collection === 'meta' && record.id === 'local')?.data as LocalData).guidance).toBeUndefined()
  })
  it('fügt Licht erst nach Zustimmung einmalig hinzu und verändert dabei keine Ankerzeit', async () => {
    const before = structuredClone(useApp.getState().settings)
    await useApp.getState().chooseMorningLight(false)
    expect(useApp.getState().settings.routines).toEqual(before.routines)
    await useApp.getState().load()
    expect(useApp.getState().local.guidance?.lightSuggestion).toBe('declined')
    await useApp.getState().chooseMorningLight(true)
    await useApp.getState().chooseMorningLight(true)
    expect(useApp.getState().settings.routines.morning.filter(step => step.id === 'light')).toHaveLength(1)
    expect(useApp.getState().settings.anchor).toEqual(before.anchor)
    expect(useApp.getState().settings.pcStop).toBe(before.pcStop)
    expect(useApp.getState().settings.bed).toBe(before.bed)
  })
})

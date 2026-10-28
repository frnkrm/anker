import { EVENING_LABELS } from '../defaults'
import { addDays, fmtTime, minutesOnPlanDay, weekday, type DateStr } from '../time'
import type {
  Block,
  CalendarEvent,
  DayOverride,
  DayPlan,
  DayType,
  EveningPlan,
  HardTime,
  PlannedStep,
  RoutineStep,
  Settings,
} from '../types'
import { allMinimal, busyMinutes, fitSteps, minimalMinutes, placeAfter, totalMinutes } from './fit'

export interface PlanInput {
  date: DateStr
  settings: Settings
  override?: DayOverride
  events?: CalendarEvent[]
}

const WEEKEND_EVENING_START = 18 * 60
const SICK_BASICS = new Set(['teeth', 'face'])

type Interval = [number, number]

interface PlacedEvent {
  ev: CalendarEvent
  start: number
  end: number
}

export function dayTypeFor(date: DateStr, s: Settings, o?: DayOverride): DayType {
  if (o?.dayType) return o.dayType
  return s.work[weekday(date)]?.isWorkDay ? 'work' : 'weekend'
}

export function isSportDay(date: DateStr, s: Settings): boolean {
  return !!s.sport.days[weekday(date)]
}

/** Abend-/Nachtzeit relativ zum Plantag: Werte vor dem Mittag gelten als „nach Mitternacht“. */
function asNight(m: number): number {
  return m < 12 * 60 ? m + 1440 : m
}

function sportStepFor(s: Settings, base?: RoutineStep): RoutineStep {
  const title = s.sport.kind === 'run' ? 'Laufen' : 'Training zu Hause'
  return {
    id: base?.id ?? 'move',
    tag: 'movement',
    title: `${title} (${s.sport.durationMin} min)`,
    minutes: s.sport.durationMin,
    minimal: base?.minimal ?? { title: '1 Liegestütz', minutes: 1 },
  }
}

function eventLabel(e: PlacedEvent): string {
  return `„${e.ev.title}“ (${fmtTime(e.start)})`
}

/**
 * Berechnet den Tagesplan. Reine Funktion: gleiche Eingabe → gleicher Plan.
 * Reihenfolge: Aufstehen → Morgenroutine (+ Sport) → Losgehen → Arbeit → Feierabend
 * → Abendplan → Abendroutine → Freizeit → PC-Stopp → Bett.
 */
export function buildDayPlan(input: PlanInput): DayPlan {
  const { date, settings: s } = input
  const o = input.override ?? {}
  const wd = weekday(date)
  const dayType = dayTypeFor(date, s, o)
  const notes: string[] = []
  const blocks: Block[] = []
  const id = (k: string) => `${date}:${k}`

  const wake = s.anchor.wake
  const bed = asNight(s.bed)
  const pcStop = Math.min(asNight(s.pcStop) + Math.min(15, o.pcStopExtendMin ?? 0), bed)

  // Kalendertermine in Plan-Minuten umrechnen
  const allDay = (input.events ?? []).filter((e) => e.allDay)
  const events: PlacedEvent[] = (input.events ?? [])
    .filter((e) => !e.allDay)
    .map((ev) => ({ ev, start: minutesOnPlanDay(date, ev.start), end: minutesOnPlanDay(date, ev.end) }))
    .filter((e) => e.end > 0 && e.start < bed + 120 && e.end > e.start)
    .sort((a, b) => a.start - b.start)
  for (const e of allDay) notes.push(`Heute: ${e.title}`)
  for (const e of events) {
    blocks.push({ id: `event:${e.ev.id}`, kind: 'event', title: e.ev.title, start: e.start, end: e.end })
  }
  const busy: Interval[] = events.map((e) => [e.start, e.end])

  // ---------- Krank-Modus ----------
  if (dayType === 'sick') {
    const basicsM = allMinimal(s.routines.morning.filter((x) => x.tag && SICK_BASICS.has(x.tag)))
    const basicsE = allMinimal(s.routines.evening.filter((x) => x.tag && SICK_BASICS.has(x.tag)))
    const mEnd = wake + 30 + totalMinutes(basicsM)
    blocks.push({ id: id('morning'), kind: 'morning', title: 'Nur das Nötigste', start: wake + 30, end: mEnd, routine: 'morning', steps: basicsM, minimal: true })
    const eStart = bed - 30
    blocks.push({ id: id('rest'), kind: 'rest', title: 'Erholen', start: mEnd, end: eStart })
    blocks.push({ id: id('evening-routine'), kind: 'evening-routine', title: 'Zähne & Gesicht', start: eStart, end: eStart + totalMinutes(basicsE), routine: 'evening', steps: basicsE, minimal: true })
    blocks.push({ id: id('bed'), kind: 'bed', title: 'Schlafen', start: bed, end: bed, hard: true })
    notes.push('Krank-Modus: nur das Nötigste. Kein Ziel, kein Druck. Gute Besserung!')
    return finish({ date, dayType, homeOffice: false, blocks, hardTimes: [{ key: 'bed', label: 'Bett', at: bed }], notes, pcStop: bed, bed, wake })
  }

  // ---------- Morgen ----------
  const isWork = dayType === 'work'
  const w = s.work[wd]!
  const homeOffice = isWork && (o.homeOffice ?? w.homeOffice)
  const workStart = w.start
  const leave = isWork ? (homeOffice ? workStart - 5 : workStart - s.commute.minutes - s.commute.bufferMin) : undefined

  let morningSteps = s.routines.morning.map((x) => ({ ...x }))
  const sportToday = isSportDay(date, s) && dayType !== 'vacation'
  const morningSport = sportToday && s.sport.time === 'morning'
  let gymBlock: Block | undefined

  let morningEnd = leave ?? wake + 180
  // Ein Termin vor dem Losgehen verkürzt das Morgenfenster
  const earlyEvent = events.find((e) => e.start > wake && e.start < morningEnd)
  if (earlyEvent) morningEnd = earlyEvent.start

  if (morningSport) {
    const moveIdx = morningSteps.findIndex((x) => x.tag === 'movement')
    if (s.sport.kind === 'gym') {
      const gymMin = s.sport.durationMin + 2 * s.sport.gymWayMin
      const needed = gymMin + minimalMinutes(morningSteps)
      if (wake + needed <= morningEnd) {
        gymBlock = { id: id('sport'), kind: 'sport', title: 'Fitnessstudio', start: wake + 5, end: wake + 5 + gymMin }
        if (moveIdx >= 0) morningSteps.splice(moveIdx, 1)
      } else {
        notes.push('Fitnessstudio passt heute morgens nicht – kurzes Training zu Hause, oder nach der Arbeit.')
        if (moveIdx >= 0) morningSteps[moveIdx] = sportStepFor({ ...s, sport: { ...s.sport, kind: 'home' } }, morningSteps[moveIdx])
      }
    } else if (moveIdx >= 0) {
      morningSteps[moveIdx] = sportStepFor(s, morningSteps[moveIdx])
    } else {
      morningSteps = [morningSteps[0]!, sportStepFor(s), ...morningSteps.slice(1)].filter(Boolean) as RoutineStep[]
    }
  }

  const routineStart = gymBlock ? gymBlock.end : wake
  const window = morningEnd - routineStart
  const fit = fitSteps(morningSteps, window)
  if (fit.minimal) {
    notes.push(
      fit.fits
        ? earlyEvent
          ? `Wegen ${eventLabel(earlyEvent)} passt die Morgenroutine heute nur teilweise in Minimal-Version.`
          : 'Morgenroutine passt heute nur teilweise in Minimal-Version.'
        : 'Morgenroutine passt heute nur in Minimal-Version – mach, was geht.',
    )
  }
  const mDur = totalMinutes(fit.steps)

  blocks.push({ id: id('wake'), kind: 'wake', title: 'Aufstehen', start: wake, end: wake, hard: true })
  if (gymBlock) blocks.push(gymBlock)
  blocks.push({
    id: id('morning'),
    kind: 'morning',
    title: 'Morgenroutine',
    start: routineStart,
    end: routineStart + mDur,
    routine: 'morning',
    steps: fit.steps,
    minimal: fit.minimal,
  })

  let home: number
  let workEnd: number | undefined
  if (isWork) {
    workEnd = o.workEnd ?? workStart + w.durationMin + w.pauseMin
    if (!homeOffice) {
      blocks.push({ id: id('commute'), kind: 'commute', title: 'Losgehen', start: leave!, end: workStart, hard: true })
    }
    blocks.push({ id: id('work'), kind: 'work', title: homeOffice ? 'Arbeit (Homeoffice)' : 'Arbeit', start: workStart, end: workEnd })
    home = workEnd
    if (!homeOffice) {
      blocks.push({ id: id('commute-home'), kind: 'commute', title: 'Heimweg', start: workEnd, end: workEnd + s.commute.minutes })
      home = workEnd + s.commute.minutes
    }
    if (o.workEnd !== undefined) notes.push(`Heute länger: Feierabend ${fmtTime(workEnd)}. PC-Stopp und Bett bleiben gleich.`)
  } else {
    home = Math.max(WEEKEND_EVENING_START, routineStart + mDur)
    blocks.push({
      id: id('day'),
      kind: 'day',
      title: dayType === 'vacation' ? 'Urlaub – genieß den Tag' : 'Freier Tag',
      start: routineStart + mDur,
      end: home,
    })
  }

  // ---------- Abend ----------
  let plan: EveningPlan = o.evening ?? s.evenings[wd] ?? 'free'
  if (!o.evening && sportToday && s.sport.time === 'afterWork') plan = 'sport'

  let planDur = s.eveningDurations[plan]
  if (plan === 'sport') planDur = s.sport.durationMin + (s.sport.kind === 'gym' ? 2 * s.sport.gymWayMin : 0)
  const eveningEvent = events.find((e) => e.end > home && e.start < pcStop)
  if (plan === 'appointment' && eveningEvent) planDur = 0 // Der Termin selbst ist der Abendplan

  let eveningSteps = s.routines.evening.map((x) => ({ ...x }))
  const tomorrow = addDays(date, 1)
  if (s.sport.kind === 'gym' && isSportDay(tomorrow, s) && dayTypeFor(tomorrow, s) !== 'vacation') {
    const at = Math.max(0, eveningSteps.findIndex((x) => x.tag === 'prep'))
    eveningSteps = [...eveningSteps.slice(0, at + 1), { id: 'gymbag', title: 'Sporttasche packen', minutes: 3, tag: 'gymbag' }, ...eveningSteps.slice(at + 1)]
  }

  const available = pcStop - home - busyMinutes(home, pcStop, busy)
  const routineFull = eveningSteps.reduce((sum, x) => sum + x.minutes, 0)
  const routineMin = minimalMinutes(eveningSteps)
  let routineWindow = routineFull
  if (planDur + routineFull > available) {
    if (planDur + routineMin <= available) {
      routineWindow = available - planDur
      notes.push(`Abendroutine heute in kurzer Version, damit ${EVENING_LABELS[plan]} Platz hat.`)
    } else {
      routineWindow = routineMin
      const shorter = Math.max(0, available - routineMin)
      if (planDur > 0) notes.push(`Wenig Zeit heute Abend: ${EVENING_LABELS[plan]} etwas kürzer, dann direkt die kurze Abendroutine.`)
      planDur = shorter
    }
  }

  const eFit = fitSteps(eveningSteps, routineWindow)
  let cursor = home
  if (plan === 'appointment' && eveningEvent) cursor = Math.max(cursor, eveningEvent.end)
  if (planDur > 0) {
    const pStart = placeAfter(cursor, planDur, busy)
    blocks.push({ id: id('evening-plan'), kind: 'evening-plan', title: eveningTitle(plan), start: pStart, end: pStart + planDur })
    cursor = pStart + planDur
  }
  const rDur = totalMinutes(eFit.steps)
  let rStart = placeAfter(cursor, rDur, busy)
  if (rStart + rDur > pcStop) {
    rStart = Math.max(cursor, pcStop - rDur)
    notes.push('Die Abendroutine rutscht heute nah an den PC-Stopp. Direkt danach Bildschirm aus.')
  }
  blocks.push({
    id: id('evening-routine'),
    kind: 'evening-routine',
    title: 'Abendroutine',
    start: rStart,
    end: rStart + rDur,
    routine: 'evening',
    steps: eFit.steps,
    minimal: eFit.minimal,
  })
  if (pcStop - (rStart + rDur) >= 5) {
    blocks.push({ id: id('free'), kind: 'free', title: 'Freizeit – zocken erlaubt', start: rStart + rDur, end: pcStop })
  }
  blocks.push({ id: id('pc-stop'), kind: 'pc-stop', title: 'PC aus, runterkommen', start: pcStop, end: bed, hard: true })
  blocks.push({ id: id('bed'), kind: 'bed', title: 'Ab ins Bett', start: bed, end: bed, hard: true })

  for (const e of events) {
    if (e.end > pcStop && e.start < bed + 120) notes.push(`Termin ${eventLabel(e)} geht über den PC-Stopp hinaus.`)
    else if (isWork && leave !== undefined && e.start < workStart && e.end > leave && !homeOffice)
      notes.push(`Termin ${eventLabel(e)} überschneidet den Arbeitsweg.`)
  }

  const hardTimes: HardTime[] = [{ key: 'wake', label: 'Aufstehen', at: wake }]
  if (isWork && !homeOffice && leave !== undefined) hardTimes.push({ key: 'leave', label: 'Losgehen', at: leave })
  hardTimes.push({ key: 'pc-stop', label: 'PC-Stopp', at: pcStop }, { key: 'bed', label: 'Bett', at: bed })

  return finish({ date, dayType, homeOffice, blocks, hardTimes, notes, workEnd, pcStop, bed, wake, leave })
}

function eveningTitle(p: EveningPlan): string {
  switch (p) {
    case 'friends':
      return 'Freunde treffen'
    case 'sport':
      return 'Sport'
    case 'cook':
      return 'Kochen & essen'
    case 'appointment':
      return 'Termin'
    default:
      return 'Essen & ankommen'
  }
}

function finish(p: DayPlan): DayPlan {
  p.blocks.sort((a, b) => a.start - b.start || order(a) - order(b))
  return p
}

function order(b: Block): number {
  return b.kind === 'wake' ? 0 : b.kind === 'bed' ? 2 : 1
}

// ---------- Abfragen auf einem Plan ----------

/** Der Block, der zum Zeitpunkt `m` läuft (Termine haben Vorrang). */
export function currentBlock(plan: DayPlan, m: number): Block | undefined {
  const running = plan.blocks.filter((b) => b.start <= m && m < b.end)
  return running.find((b) => b.kind === 'event') ?? running.find((b) => b.kind !== 'pc-stop') ?? running[0]
}

export function nextBlock(plan: DayPlan, m: number): Block | undefined {
  return plan.blocks.find((b) => b.start > m)
}

export function nextHardTime(plan: DayPlan, m: number): HardTime | undefined {
  return plan.hardTimes.find((h) => h.at > m)
}

export function previousHardTime(plan: DayPlan, m: number): number {
  const past = plan.hardTimes.filter((h) => h.at <= m)
  return past.length ? past[past.length - 1]!.at : plan.wake
}

export function routineBlock(plan: DayPlan, r: 'morning' | 'evening'): Block | undefined {
  return plan.blocks.find((b) => b.routine === r)
}

export type { PlannedStep }

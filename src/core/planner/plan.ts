import { EVENING_LABELS } from '../defaults'
import { addDays, fmtTime, minutesOnPlanDay, weekday, type DateStr } from '../time'
import { dayActual, forecastEnd, latestInfo, overLatest, workRule } from '../worktime'
import type {
  Block,
  CalendarEvent,
  Commitment,
  DayOverride,
  DayPlan,
  DayType,
  EveningPlan,
  HardTime,
  Place,
  PlannedStep,
  RoutineStep,
  Settings,
  WorkInfo,
  WorkSession,
} from '../types'
import { hardConflicts, legSpan, planLegs } from './adaptive'
import { allMinimal, busyMinutes, fitSteps, minimalMinutes, placeAfter, totalMinutes } from './fit'

export interface PlanInput {
  date: DateStr
  settings: Settings
  override?: DayOverride
  events?: CalendarEvent[]
  commitments?: Commitment[]
  places?: Place[]
  /** Vom Vortag über eine gesetzte Regel versorgte Schritte */
  covered?: string[]
  /** Erfasste Arbeitszeiten. Nur damit rechnet der Plan mit Ist-Werten. */
  sessions?: WorkSession[]
  /** Bis hierhin laufen offene Abschnitte. Nur nötig, wenn `sessions` etwas Offenes enthält. */
  nowMs?: number
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

  const wake = o.wakeOverride ?? s.anchor.wake
  let bed = asNight(s.bed)
  const legacyExtension = Number.isFinite(o.pcStopExtendMin) ? Math.max(0, o.pcStopExtendMin ?? 0) : 0
  let pcStop = asNight(s.pcStop) + legacyExtension
  if (pcStop > bed) bed = pcStop + Math.min(s.sleep.screenOffMin, 30)
  const quiet: [number, number][] = []
  // Länger wach ist eine freie Entscheidung: Die Grenzen rücken mit, ohne Warnung und ohne erfundenes Ende
  const openEnd = o.lateUntil === 'open'
  if (typeof o.lateUntil === 'number') {
    const late = asNight(o.lateUntil)
    if (late > pcStop) quiet.push([pcStop, late])
    pcStop = Math.max(pcStop, late)
    bed = Math.max(bed, late + Math.min(s.sleep.screenOffMin, 30))
  } else if (openEnd) {
    quiet.push([pcStop, 1440 + 4 * 60])
    pcStop = 1440 + 4 * 60 - 1
    bed = pcStop
  }

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
  const rule = workRule(date, s, o, isWork)
  const nowMs = input.nowMs ?? 0
  const actual = dayActual(input.sessions ?? [], date, nowMs)
  const nowM = minutesOnPlanDay(date, nowMs)
  let leaveOverride: number | undefined

  // Schon versorgte Schritte entfallen für heute. Sie gelten damit nicht als heute erledigt.
  const covered = new Set([...(input.covered ?? []), ...(o.coveredSteps ?? [])].filter((k) => !o.uncoveredSteps?.includes(k)))
  let morningSteps = s.routines.morning.filter((x) => !covered.has(`morning:${x.id}`)).map((x) => ({ ...x }))

  // Wege und Termine dieses Tages
  const officeOnsite = isWorkDayOnsite(dayType, o, w) && !(input.commitments ?? []).some((c) => c.replacesCommute && c.status !== 'cancelled')
  const workEndBase = o.workEnd ?? rule.plannedStart + rule.targetNetMin + rule.plannedBreakMin
  const legs = planLegs(input.commitments ?? [], { settings: s, places: input.places ?? [], office: officeOnsite ? { start: rule.plannedStart, end: workEndBase } : undefined })
  const morningLeg = legs.find((l) => l.leave !== undefined && l.commitment.commitment === 'hard' && l.commitment.start < 12 * 60 && (dayType !== 'work' || l.commitment.replacesCommute || homeOffice || l.commitment.start < rule.plannedStart))
  if (morningLeg) leaveOverride = morningLeg.leave
  // Bestätigter Kundentermin vor der eigenen Grenze: Die Arbeit beginnt dort, nicht zusätzlich woanders
  const firstCustomer = morningLeg && morningLeg.commitment.replacesCommute && ['customer', 'work'].includes(morningLeg.commitment.context) && morningLeg.commitment.start <= Math.max(rule.plannedStart, s.flex.latestStart ?? 0) ? morningLeg.commitment.start : undefined
  const plannedStart = firstCustomer ?? rule.plannedStart
  const firstRegular = actual.sessions.find((x) => x.kind === 'regular')
  const workStart = firstRegular ? minutesOnPlanDay(date, firstRegular.startAt) : plannedStart
  const officeLeave = isWork ? (homeOffice ? plannedStart - s.travel.homeOfficeStartupMin : plannedStart - s.commute.minutes - s.commute.bufferMin) : undefined
  const sportToday = isSportDay(date, s) && dayType !== 'vacation'
  const morningSport = sportToday && s.sport.time === 'morning'
  let gymBlock: Block | undefined

  const leave = leaveOverride ?? officeLeave
  let morningEnd = leave ?? wake + 180
  // Ein Termin vor dem Losgehen verkürzt das Morgenfenster
  const earlyEvent = morningLeg ? undefined : events.find((e) => e.start > wake && e.start < morningEnd)
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
  // Wenig Energie, überlastet oder „Tag neu sortieren“: sofort die kleinen Versionen, ohne weitere Frage
  const low = !!o.light || o.mode === 'wenig-energie' || o.mode === 'ueberlastet'
  const overloaded = o.mode === 'ueberlastet'
  if (overloaded) morningSteps = morningSteps.filter((x) => (x.tag && SICK_BASICS.has(x.tag)) || x.id === 'keys')
  const fit = low ? { steps: allMinimal(morningSteps), minimal: true, fits: true } : fitSteps(morningSteps, window)
  // Morgenroutine bewusst später: gleicher Inhalt, spätere Zeit
  const morningLater = typeof o.routineAt?.morning === 'number' ? o.routineAt.morning : undefined
  if (fit.minimal && !low) {
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
    start: morningLater ?? routineStart,
    end: (morningLater ?? routineStart) + mDur,
    routine: 'morning',
    steps: fit.steps,
    minimal: fit.minimal,
  })

  let home: number
  let workEnd: number | undefined
  let workInfo: WorkInfo | undefined
  if (isWork) {
    // Reales Ende vor gesetztem Ende vor Prognose. Eine laufende Arbeit endet nie in der Vergangenheit.
    const forecast = forecastEnd({ ...rule, plannedStart, date, actual, nowMs })
    workEnd = actual.closed ? forecast : (o.workEnd ?? forecast)
    if (actual.open) workEnd = Math.max(workEnd, nowM)
    const latest = latestInfo(s, homeOffice)
    workInfo = {
      ...rule,
      plannedStart,
      latestStart: latest?.latestStart,
      latestLeave: latest?.latestLeave,
      fixedMorning: !!morningLeg,
      started: !!firstRegular || !!actual.open,
      closed: actual.closed,
    }
    if (!morningLeg && overLatest(plannedStart, latest)) notes.push(`Heute beginnst du nach deiner Grenze ${fmtTime(latest!.latestStart)}. Prüf kurz, ob das so abgesprochen ist.`)
    const otherDays = s.work.filter((d, i) => i !== 4 && d.isWorkDay).map((d) => d.durationMin)
    if (wd === 4 && !actual.closed && otherDays.length && w.durationMin < Math.min(...otherDays)) notes.push(`Heute ist dein kürzerer Freitag. Geplanter Feierabend ${fmtTime(workEnd)}.`)
    if (!homeOffice && !morningLeg) {
      blocks.push({ id: id('commute'), kind: 'commute', title: 'Losgehen', start: leave!, end: plannedStart, hard: true })
    }
    if (morningLeg && officeOnsite && !morningLeg.commitment.replacesCommute) notes.push('Der Weg vom Termin ins Büro ist nicht eingeplant.')
    blocks.push({ id: id('work'), kind: 'work', title: homeOffice ? 'Arbeit (Homeoffice)' : 'Arbeit', start: workStart, end: workEnd })
    home = workEnd
    // Geht es vom Büro direkt zum nächsten Termin, gibt es keinen Umweg über die Wohnung
    const onwards = legs.some((l) => l.commitment.start >= workEnd! - 120 && l.toLabel)
    if (!homeOffice && officeOnsite && !onwards) {
      blocks.push({ id: id('commute-home'), kind: 'commute', title: 'Heimweg', start: workEnd, end: workEnd + s.commute.minutes })
      home = workEnd + s.commute.minutes
    }
    if (o.workEnd !== undefined && !actual.closed) {
      notes.push(o.workEnd >= plannedStart + rule.targetNetMin + rule.plannedBreakMin ? `Heute länger: Feierabend ${fmtTime(workEnd)}. PC-Stopp und Bett bleiben gleich.` : `Heute früher Schluss: Feierabend ${fmtTime(workEnd)}.`)
    }
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

  // Einsätze außerhalb der regulären Arbeit stehen als das im Tag, was sie waren. Der Tag bleibt, was er ist.
  for (const x of actual.sessions) {
    if (isWork && x.kind === 'regular') continue
    const start = minutesOnPlanDay(date, x.startAt)
    const end = x.endAt !== undefined ? minutesOnPlanDay(date, x.endAt) : Math.max(start + 1, nowM)
    blocks.push({ id: `session:${x.id}`, kind: 'session', title: 'Arbeitseinsatz', start, end })
  }

  // ---------- Abend ----------
  let plan: EveningPlan = o.evening ?? s.evenings[wd] ?? 'free'
  if (!o.evening && sportToday && s.sport.time === 'afterWork') plan = 'sport'

  let planDur = s.eveningDurations[plan]
  if (plan === 'sport') planDur = s.sport.durationMin + (s.sport.kind === 'gym' ? 2 * s.sport.gymWayMin : 0)
  // Ein Termin am Abend ist der Abendplan
  const eveningLegs = legs.filter((l) => l.commitment.workKind !== 'oncall' && l.commitment.start >= Math.min(home, 15 * 60))
  if (eveningLegs.length && !o.evening) planDur = 0
  for (const l of legs) {
    // Rufbereitschaft belegt die Zeit nicht: Der Tag bleibt frei, bis wirklich ein Einsatz läuft
    if (l.commitment.workKind === 'oncall') continue
    const span = legSpan(l)
    // „Bin wieder da“ beendet den Termin, auch wenn sein Ende vorher offen war
    const back = l.commitment.backAt !== undefined ? minutesOnPlanDay(date, l.commitment.backAt) : undefined
    busy.push([span.start, back ?? span.end ?? bed + 120])
    // Soziale Zeit und Freizeit: keine Haushalts-Erinnerungen
    if (l.commitment.context !== 'work' && l.commitment.context !== 'customer') quiet.push([span.start, back ?? span.end ?? 1440 + 4 * 60])
  }
  const eveningEvent = events.find((e) => e.end > home && e.start < pcStop)
  if (plan === 'appointment' && eveningEvent) planDur = 0 // Der Termin selbst ist der Abendplan

  let eveningSteps = s.routines.evening.map((x) => ({ ...x }))
  const tomorrow = addDays(date, 1)
  if (s.sport.kind === 'gym' && isSportDay(tomorrow, s) && dayTypeFor(tomorrow, s) !== 'vacation') {
    const at = Math.max(0, eveningSteps.findIndex((x) => x.tag === 'prep'))
    eveningSteps = [...eveningSteps.slice(0, at + 1), { id: 'gymbag', title: 'Sporttasche packen', minutes: 3, tag: 'gymbag' }, ...eveningSteps.slice(at + 1)]
  }

  if (overloaded) eveningSteps = eveningSteps.filter((x) => x.tag && SICK_BASICS.has(x.tag))

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

  // Zeitpunkt der Abendroutine: nach dem Termin, zur gewählten Uhrzeit oder bei Rückkehr
  const backAts = [...legs.map((l) => l.commitment.backAt), o.backAt].filter((x): x is number => x !== undefined).map((x) => minutesOnPlanDay(date, x))
  const backAt = backAts.length ? Math.max(...backAts) : undefined
  const lastLeg = eveningLegs[eveningLegs.length - 1]
  const lastSpan = lastLeg ? legSpan(lastLeg) : undefined
  const eveningAt = o.routineAt?.evening
  const waitsForReturn = backAt === undefined && (eveningAt === 'return' || (!!lastSpan && lastSpan.end === undefined))
  let afterReturn = backAt ?? (lastSpan?.end !== undefined ? lastSpan.end : undefined)
  if (typeof eveningAt === 'number') afterReturn = Math.max(afterReturn ?? 0, asNight(eveningAt))
  const lateReturn = afterReturn !== undefined && afterReturn + routineFull > asNight(s.bed)
  const eFit = low || lateReturn ? { steps: allMinimal(eveningSteps), minimal: true, fits: true } : fitSteps(eveningSteps, routineWindow)
  let cursor = home
  if (plan === 'appointment' && eveningEvent) cursor = Math.max(cursor, eveningEvent.end)
  if (planDur > 0) {
    const pStart = placeAfter(cursor, planDur, busy)
    blocks.push({ id: id('evening-plan'), kind: 'evening-plan', title: eveningTitle(plan), start: pStart, end: pStart + planDur })
    cursor = pStart + planDur
  }
  const rDur = totalMinutes(eFit.steps)
  if (afterReturn !== undefined) cursor = Math.max(cursor, afterReturn)
  let rStart = placeAfter(cursor, rDur, busy)
  if (afterReturn === undefined && rStart + rDur > pcStop) {
    rStart = Math.max(cursor, pcStop - rDur)
    notes.push('Die Abendroutine rutscht heute nah an den PC-Stopp. Direkt danach Bildschirm aus.')
  }
  if (waitsForReturn) {
    if (!o.routineAt?.evening && !lastSpan) notes.push('Abendroutine wartet, bis du zurück bist.')
  } else {
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
    // Spät zurück: Bett rückt nach hinten, statt Schritte in die Nacht zu stapeln
    if (rStart + rDur > bed) bed = rStart + rDur
    if (rStart + rDur > pcStop && afterReturn !== undefined) pcStop = Math.min(bed, rStart + rDur)
  }
  const freeFrom = waitsForReturn ? cursor : rStart + rDur
  if (!waitsForReturn && pcStop - freeFrom >= 5) {
    blocks.push({ id: id('free'), kind: 'free', title: 'Freizeit – zocken erlaubt', start: freeFrom, end: pcStop })
  }
  if (!openEnd) {
    blocks.push({ id: id('pc-stop'), kind: 'pc-stop', title: 'PC aus, runterkommen', start: pcStop, end: bed, hard: true })
    blocks.push({ id: id('bed'), kind: 'bed', title: 'Ab ins Bett', start: bed, end: bed, hard: true })
  }

  // Termine, Vorbereitung und Wege als eigene Blöcke
  for (const l of legs) {
    const c = l.commitment
    if (l.prepStart !== undefined) blocks.push({ id: `prep:${c.id}`, kind: 'prep', title: `Fertig machen: ${c.label}`, start: l.prepStart, end: l.leave ?? c.start })
    if (l.leave !== undefined) blocks.push({ id: `travel:${c.id}`, kind: 'travel', title: `Weg: ${l.fromLabel} → ${l.toLabel}`, start: l.leave, end: c.start, hard: c.commitment === 'hard' })
    // Früher zurück oder früher fertig: Der Block endet dort, statt den Rest des Fensters zu belegen
    const backM = c.backAt !== undefined ? minutesOnPlanDay(date, c.backAt) : undefined
    if (backM === undefined || backM > c.start) blocks.push({ id: `commitment:${c.id}`, kind: 'commitment', title: c.label, start: c.start, end: backM ?? c.end ?? c.start + 1, hard: c.commitment === 'hard' })
    if (l.travelOpen) notes.push(`Fahrzeit zu „${c.label}“ fehlt noch.`)
  }

  for (const e of events) {
    if (e.end > pcStop && e.start < bed + 120) notes.push(`Termin ${eventLabel(e)} geht über den PC-Stopp hinaus.`)
    else if (isWork && leave !== undefined && e.start < plannedStart && e.end > leave && !homeOffice)
      notes.push(`Termin ${eventLabel(e)} überschneidet den Arbeitsweg.`)
  }

  const hardTimes: HardTime[] = [{ key: 'wake', label: 'Aufstehen', at: wake }]
  if (morningLeg) hardTimes.push({ key: 'leave', label: `Los: ${morningLeg.commitment.label}`, at: morningLeg.leave! })
  else if (isWork && !homeOffice && leave !== undefined) hardTimes.push({ key: 'leave', label: 'Losgehen', at: leave })
  for (const l of legs) {
    if (l !== morningLeg && l.leave !== undefined && l.commitment.commitment === 'hard') hardTimes.push({ key: 'commitment', label: `Los: ${l.commitment.label}`, at: l.leave })
  }
  if (!openEnd) hardTimes.push({ key: 'pc-stop', label: 'PC-Stopp', at: pcStop }, { key: 'bed', label: 'Bett', at: bed })
  hardTimes.sort((a, b) => a.at - b.at)

  const conflicts = hardConflicts(legs)
  if (officeOnsite) {
    const clash = legs.find((l) => l.commitment.commitment === 'hard' && !l.commitment.replacesCommute && l.commitment.start < workEnd! && (l.commitment.end ?? l.commitment.start) > workStart && l !== morningLeg && l.commitment.context !== 'work')
    if (clash) conflicts.push(`„${clash.commitment.label}“ liegt in deiner Arbeitszeit.`)
  }
  // Rückt der Feierabend, rückt der Termin nicht. Ein fester wird benannt, ein flexibler nur erwähnt.
  if (workEnd !== undefined && !actual.closed) {
    for (const l of legs) {
      const c = l.commitment
      if (l === morningLeg || c.workKind === 'oncall' || l.leave === undefined || c.start < workEnd || l.leave >= workEnd) continue
      const text = `Dein Feierabend ${fmtTime(workEnd)} liegt hinter der Abfahrt zu „${c.label}“ (${fmtTime(l.leave)}).`
      if (c.commitment === 'hard') conflicts.push(`${text} Früher aufhören oder den Termin selbst absprechen?`)
      else notes.push(text)
    }
  }

  return finish({ date, dayType, homeOffice, blocks, hardTimes, notes, workEnd, pcStop, bed, wake, leave: homeOffice && !morningLeg ? undefined : leave, legs, workInfo, pendingEvening: waitsForReturn || undefined, quiet: quiet.length ? quiet : undefined, openEnd: openEnd || undefined, conflicts: conflicts.length ? conflicts : undefined })
}

function isWorkDayOnsite(dayType: DayType, o: DayOverride, w: Settings['work'][number]): boolean {
  return dayType === 'work' && !(o.homeOffice ?? w.homeOffice)
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
  return running.find((b) => b.kind === 'event' || b.kind === 'commitment' || b.kind === 'travel') ?? running.find((b) => b.kind !== 'pc-stop') ?? running[0]
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

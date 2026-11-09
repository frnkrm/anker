import { addDays, minutesOnPlanDay, todayBerlin, zonedToUtc, type DateStr } from '../time'
import { activePlanDate } from '../now'
import type { DayLog, DayPlan, InboxItem, LocalData, Settings } from '../types'
import { guidancePreferences } from '../guidance/settings'
import { defaultPcBridgeLocal, type PcBridgeLocal, type PcEventsPayload } from './types'
import { parsePcPayload, validPcBridgeLocal } from './validation'
import { canonicalJson } from './crypto'

export interface PcEventsResult {
  local: LocalData
  days: Record<DateStr, DayLog>
  inbox: InboxItem[]
  /** Safe to acknowledge after the repository transaction, including committed replays. */
  appliedIds: string[]
  cursor: number
}

/** Local transport state is a receipt journal, never a second planner or a work-time source. */
export function pcBridgeLocal(value?: PcBridgeLocal): PcBridgeLocal {
  const base = defaultPcBridgeLocal()
  if (value !== undefined && !validPcBridgeLocal(value)) throw new Error('PC_LINK_LOCAL_INVALID')
  return value ? { ...base, ...structuredClone(value), preferences: { ...base.preferences, ...value.preferences } } : base
}

/** Authentication happens in the native transport. This reducer validates the whole batch
 * before projecting any facts; caller must persist effects and cursor in one transaction. */
export function reducePcEvents(input: { payload: PcEventsPayload; local: LocalData; days: Record<DateStr, DayLog>; inbox: InboxItem[]; nowMs: number; settings?: Pick<Settings, 'guidance' | 'sleep'>; currentPlan?: Pick<DayPlan, 'date' | 'bed' | 'pcStop'> }): PcEventsResult {
  const parsed = parsePcPayload(input.payload)
  if (parsed.type !== 'events' || !Number.isSafeInteger(input.nowMs) || input.nowMs < 0) throw new Error('PC_LINK_INVALID')
  // The date is supplied by the PC's observed session; never guess work completion
  // from that date, nor turn a future observation into a present fact.
  if (parsed.items.some(event => Date.parse(event.at) > input.nowMs + 120_000 || activePlanDate(Date.parse(event.at), todayBerlin) !== event.date)) throw new Error('PC_LINK_EVENT_TIME_INVALID')
  const local = structuredClone(input.local)
  const days = structuredClone(input.days)
  const inbox = structuredClone(input.inbox)
  const pc = pcBridgeLocal(local.pcBridge)
  const receipts = new Set(pc.receipts)
  const appliedIds: string[] = []
  for (const event of parsed.items) {
    const known = pc.events.find(item => item.id === event.id || item.seq === event.seq)
    if (known && (known.id !== event.id || known.seq !== event.seq || canonicalJson(known) !== canonicalJson(event))) throw new Error('PC_LINK_EVENT_IDENTITY_CONFLICT')
    if (receipts.has(event.id) && event.seq > pc.cursor) throw new Error('PC_LINK_EVENT_IDENTITY_CONFLICT')
    if (event.seq <= pc.cursor || receipts.has(event.id)) {
      appliedIds.push(event.id)
      continue
    }
    if (pc.enabled && pc.automaticRestEvents && event.kind === 'pc-rest') {
      // A native request to lock/shutdown is not an event. The companion emits
      // pc-rest only after observing sustained rest; preserve a manual fact.
      const day = days[event.date] ?? { date: event.date, override: {}, steps: {} }
      if (day.pcOffAt === undefined) days[event.date] = { ...day, pcOffAt: Date.parse(event.at) }
    }
    if (event.kind === 'extended' && event.date === activePlanDate(input.nowMs, todayBerlin)) {
      const stopAt = Date.parse(event.newStopAt!)
      let minutes = minutesOnPlanDay(event.date, stopAt)
      const day = days[event.date] ?? { date: event.date, override: {}, steps: {} }
      if (event.anchor === 'bed') {
        const preferences = guidancePreferences(input.settings?.guidance)
        const current = input.currentPlan
        const screenOff = input.settings?.sleep.screenOffMin
        // The planner already adds this margin to lateUntil. An explicitly
        // extended bedtime must not receive that margin a second time.
        const usable = preferences.enabled && preferences.eveningEscalation && current?.date === event.date
          && Number.isFinite(current.bed) && typeof screenOff === 'number' && Number.isFinite(screenOff) && screenOff >= 0
          && stopAt > zonedToUtc(event.date, current.bed)
        minutes = usable ? minutes + (stopAt % 60_000 ? 1 : 0) - Math.min(screenOff!, 30) : Number.NaN
      }
      // A delayed previous-day event is only a log. Preserve open-end choices,
      // later phone extensions, and the separate immutable strict-night latch.
      if (stopAt > input.nowMs && stopAt < zonedToUtc(addDays(event.date, 1), 240)
        && Date.parse(event.at) >= input.nowMs - 5 * 60_000 && day.override.lateUntil !== 'open'
        && Number.isInteger(minutes) && minutes >= 0 && minutes > (day.override.lateUntil ?? 0)) days[event.date] = { ...day, override: { ...day.override, lateUntil: minutes, adjusted: true } }
    }
    if (event.kind === 'thought' || event.kind === 'save-point') {
      const id = `pc:${event.id}`
      if (!inbox.some(item => item.id === id)) inbox.push({
        id, text: event.text!.trim(), createdAt: Date.parse(event.at), status: 'open',
        source: { kind: 'capture' }, captureContext: 'PC',
        ...(event.nextStep?.trim() ? { nextStep: event.nextStep.trim() } : {}),
      })
    }
    pc.events.push(event)
    receipts.add(event.id)
    pc.cursor = event.seq
    appliedIds.push(event.id)
  }
  pc.events = pc.events.slice(-256)
  pc.receipts = [...receipts].slice(-512)
  local.pcBridge = pc
  return { local, days, inbox, appliedIds, cursor: pc.cursor }
}

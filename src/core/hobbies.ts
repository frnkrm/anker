import type { DateStr } from './time'
import type { LocalData } from './types'
import { currentSupportView, type NextInput } from './support'

export interface HobbyActivity {
  id: string
  title: string
  minutes?: number
  energy?: 'low' | 'medium' | 'high'
  context?: 'inside' | 'outside'
  things?: string[]
  paused?: boolean
}
export interface Hobby {
  id: string
  name: string
  paused?: boolean
  activities?: HobbyActivity[]
}
/** Private lokale Sammlung; keine automatische Cloudübertragung oder Erledigung. */
export interface HobbyPreferences {
  items: Hobby[]
  dismissedDate?: DateStr
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 160
const optional = (o: Record<string, unknown>, key: string, valid: (v: unknown) => boolean) => o[key] === undefined || valid(o[key])
const flag = (v: unknown) => typeof v === 'boolean'
function unique<T>(v: unknown, valid: (x: unknown) => x is T): v is T[] {
  return Array.isArray(v) && v.length <= 100 && v.every(valid)
    && new Set(v.map(x => (x as { id: string }).id)).size === v.length
}
function validActivity(v: unknown): v is HobbyActivity {
  return object(v) && text(v.id) && text(v.title)
    && optional(v, 'minutes', n => typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 480)
    && optional(v, 'energy', e => ['low', 'medium', 'high'].includes(String(e)))
    && optional(v, 'context', c => ['inside', 'outside'].includes(String(c)))
    && optional(v, 'things', t => Array.isArray(t) && t.length <= 30 && t.every(text))
    && optional(v, 'paused', flag)
}
function validHobby(v: unknown): v is Hobby {
  return object(v) && text(v.id) && text(v.name) && optional(v, 'paused', flag)
    && optional(v, 'activities', a => unique(a, validActivity))
}
export function validHobbies(v: unknown): v is HobbyPreferences | undefined {
  if (v === undefined) return true
  return object(v) && unique(v.items, validHobby) && optional(v, 'dismissedDate', d => typeof d === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(`${d}T12:00:00Z`))
    && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d)
}

export interface HobbySuggestion {
  hobbyId: string
  activityId?: string
  title: string
  minutes?: number
  /** Verfügbares Planfenster, keine Zusage über den Aufwand der Aktivität. */
  availableMin: number
  slotKey: string
}

/** Derselbe Plan und dieselbe Handlungsauswahl wie Jetzt; keine zweite Freizeitplanung. */
export function hobbyOpportunity(input: NextInput, local: LocalData, options: { alarmActive?: boolean } = {}): Pick<HobbySuggestion, 'availableMin' | 'slotKey'> | undefined {
  const prefs = local.hobbies
  if (!prefs || !validHobbies(prefs) || prefs.dismissedDate === input.plan.date || options.alarmActive
    || input.plan.openEnd || input.plan.pendingEvening || input.plan.conflicts?.length || local.focus || local.stuck
    || input.m < input.plan.wake || input.m >= input.plan.bed) return undefined
  if (currentSupportView(input, local).action.type !== 'free') return undefined
  // Ein offener auswärtiger Termin bleibt offen, selbst wenn seine Planzeit abgelaufen ist.
  if (input.plan.legs?.some(({ commitment: c }) => c.status !== 'cancelled' && c.backAt === undefined
    && c.locationKind !== 'home' && c.locationKind !== 'remote' && c.start <= input.m)) return undefined
  const block = input.plan.blocks.find(b => b.kind === 'free' && b.start <= input.m && input.m < b.end)
  if (!block) return undefined
  const end = Math.min(block.end, input.plan.pcStop, input.plan.bed,
    ...input.plan.blocks.filter(b => b.kind !== 'free' && b.start > input.m).map(b => b.start),
    ...(input.plan.legs ?? []).filter(l => l.commitment.status !== 'cancelled' && l.commitment.backAt === undefined)
      .flatMap(l => [l.prepStart ?? l.commitment.start]).filter(at => at > input.m))
  const availableMin = Math.floor(end - input.m)
  if (availableMin < 1) return undefined
  return { availableMin, slotKey: `${input.plan.date}:${block.id}` }
}

export function suggestHobby(input: NextInput, local: LocalData, options: {
  alarmActive?: boolean; rotation?: number; energy?: HobbyActivity['energy']; context?: HobbyActivity['context']
} = {}): HobbySuggestion | undefined {
  const opportunity = hobbyOpportunity(input, local, options)
  if (!opportunity) return undefined
  const { availableMin, slotKey } = opportunity
  const prefs = local.hobbies!
  const energies = { low: 0, medium: 1, high: 2 }
  const candidates = prefs.items.filter(h => !h.paused).flatMap(h => {
    if (!h.activities?.length) return [{ hobbyId: h.id, title: h.name }]
    return h.activities.filter(a => !a.paused && (a.minutes === undefined || a.minutes <= availableMin)
      && (!a.context || a.context === options.context)
      && (!a.energy || options.energy !== undefined && energies[a.energy] <= energies[options.energy]))
      .map(a => ({ hobbyId: h.id, activityId: a.id, title: a.title, minutes: a.minutes }))
  }).sort((a, b) => `${a.hobbyId}:${'activityId' in a ? a.activityId : ''}`.localeCompare(`${b.hobbyId}:${'activityId' in b ? b.activityId : ''}`))
  if (!candidates.length) return undefined
  const seed = [...slotKey].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0)
  const rotation = Number.isSafeInteger(options.rotation) && options.rotation! >= 0 ? options.rotation! : 0
  const candidate = candidates[(seed + rotation) % candidates.length]!
  return { ...candidate, availableMin, slotKey }
}

import { fmtTime, minutesOnPlanDay, utcToZoned, weekday, zonedToUtc } from '../time'
import type { DayLog, DayPlan, InboxItem, ReminderIntensity, Settings, TomorrowStep } from '../types'
import { minuteText } from '../uiText'

export type Channel = 'wecker' | 'uebergang' | 'sanft'

export interface ReminderPolicy {
  quietStart: number
  quietEnd: number
  ranges: { from: number; to: number }[]
}

export function reminderPolicy(plans: DayPlan[], s: Settings): ReminderPolicy {
  return {
    quietStart: s.reminders.quietStart,
    quietEnd: s.reminders.quietEnd,
    ranges: plans.flatMap((plan) => (plan.quiet ?? []).map(([from, to]) => ({ from: zonedToUtc(plan.date, from), to: zonedToUtc(plan.date, to) }))),
  }
}

export interface ReminderSpec {
  /** Stabiler Schlüssel innerhalb eines Tages, z. B. "leave" */
  key: string
  date: string
  id: number
  at: number // UTC ms
  channel: Channel
  title: string
  body: string
  /** 0 = erste Erinnerung, 1 = Wiederholung, 2 = mit Ton/Vibration bis bestätigt */
  escalation: number
  /** Zeigt „Erledigt / 5 Min später / Heute nicht“ */
  actions: boolean
  /** Sichtbarer Platz: 0 = Fokus, 1 = Harter Anker, 2 = Neueste */
  slot: 0 | 1 | 2
  /** Höher verdrängt niedriger, nie umgekehrt */
  rank: number
  /** Nur Zeitkritisches weckt exakt */
  exact: boolean
  /** Stable logical plan version; snooze and escalation keep this version. */
  revision: string
  /** Distinguishes this delivery from older buttons of the same logical reminder. */
  token: string
  /** Explicit time-critical anchors may interrupt focus and quiet hours. */
  critical: boolean
}

/** Harte Zeiten und Übergänge halten den zweiten Slot, laufende Aufgaben den ersten, der Rest den dritten. */
export function slotFor(key: string): { slot: 0 | 1 | 2; rank: number } {
  if (key === 'leave' || key === 'latest-leave' || key === 'pcstop' || key === 'bed' || key.startsWith('go:')) return { slot: 1, rank: 4 }
  if (key === 'leave-10' || key === 'latest-start' || key === 'pcstop-15' || key.startsWith('deadline')) return { slot: 1, rank: 3 }
  if (key === 'morning' || key === 'evening' || key === 'meds' || key.startsWith('prep:')) return { slot: 0, rank: 2 }
  return { slot: 2, rank: 1 }
}

/** Zusätzliche Erinnerungen, die nicht aus dem Tagesplan stammen. */
export interface ReminderExtras {
  /** Berufliche Deadlines (UTC ms). Der Text bleibt absichtlich allgemein, auch auf dem Sperrbildschirm. */
  deadlines?: { id: string; at: number; reminderRevision?: string }[]
  /** Nur offene, ausdrücklich zur Erinnerung ausgewählte Gedanken. Inhalte bleiben privat. */
  thoughtReviews?: InboxItem[]
  /** Lokale nächste Schritte; erledigte oder abgewählte Einträge werden entfernt. */
  tomorrowSteps?: TomorrowStep[]
  /** Optional current focus session. Native receives the same limit for closed-app delivery. */
  focusUntil?: number
}

interface PrivateReminder {
  key: string
  date: string
  at: number
  title: string
  body: string
}

/** Dieselben offenen Einträge gelten auch nach ihrer Uhrzeit weiter, ohne erneut zu erinnern. */
function privateReminders(extras: ReminderExtras): PrivateReminder[] {
  const out: PrivateReminder[] = []
  for (const item of extras.thoughtReviews ?? []) {
    if (item.status !== 'open' || item.done || item.doneAt !== undefined || !item.reviewNotify || !Number.isFinite(item.reviewAt) || !Number.isFinite(new Date(item.reviewAt!).getTime())) continue
    const at = item.reviewAt!
    out.push({ key: `thought-review:${item.id}`, date: utcToZoned(at).date, at, title: 'Ein Gedanke liegt für dich bereit', body: 'Wenn es passt, kannst du ihn in Anker wieder ansehen.' })
  }
  for (const step of extras.tomorrowSteps ?? []) {
    if (step.doneAt !== undefined || !step.remind || !Number.isFinite(step.resumeAt) || !Number.isFinite(new Date(step.resumeAt).getTime())) continue
    const at = step.resumeAt
    out.push({ key: `tomorrow-step:${step.id}`, date: utcToZoned(at).date, at, title: 'Dein nächster Schritt liegt bereit', body: 'Öffne Anker, wenn du damit weitermachen möchtest.' })
  }
  return out
}

interface Base {
  key: string
  at: number // Plan-Minuten
  channel: Channel
  title: string
  body: string
  escalate: boolean
  hard?: boolean
}

/** Opaque deterministic version; no private text crosses the native boundary through it. */
export function reminderRevision(value: unknown): string {
  const text = JSON.stringify(value)
  let a = 2166136261
  let b = 3339675911
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619)
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519)
  }
  return `r2-${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`
}

export function reminderDeliveryToken(revision: string, at: number, escalation = 0): string {
  return `${revision}:${at}:${escalation}`
}

export const MAX_SNOOZE = 2
const LOOKAHEAD_MS = 48 * 3600_000

/** Stabile positive 31-Bit-ID aus einem String (für Android-Notification-IDs). */
export function reminderId(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 1) || 1
}

function joinSteps(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? ''
  return `${titles.slice(0, -1).join(', ')} und ${titles[titles.length - 1]}`
}

const TAG_WORDS: Partial<Record<string, string>> = { tidy: 'Aufräumen', face: 'Gesicht', teeth: 'Zähne' }

function baseReminders(plan: DayPlan, log: DayLog | undefined, s: Settings): Base[] {
  const out: Base[] = []
  const t = fmtTime
  const sick = plan.dayType === 'sick'
  const morning = plan.blocks.find((b) => b.routine === 'morning')
  const evening = plan.blocks.find((b) => b.routine === 'evening')
  // Optional v7 preferences may be absent in an existing local settings record.
  const guidance = (s as Settings & { guidance?: { enabled?: boolean; eveningEscalation?: boolean } }).guidance
  const guidanceEveningEnabled = guidance?.enabled === true && guidance.eveningEscalation === true
  const guidanceEveningOpen = guidanceEveningEnabled && !sick && !plan.openEnd
    && log?.bedAt === undefined && log?.eveningRoutineDoneAt === undefined && !log?.dismissed?.includes('evening')

  if (!sick && morning?.steps?.length && !Object.keys(log?.steps ?? {}).some((k) => k.startsWith('morning:'))) {
    out.push({ key: 'morning', at: morning.start + 3, channel: 'sanft', title: `${t(morning.start)} – Morgenroutine`, body: 'Dein nächster Schritt steht in Anker bereit.', escalate: false })
  }
  const wi = plan.workInfo
  if (plan.leave !== undefined && !log?.leftAt && !wi?.started) {
    out.push({ key: 'leave-10', at: plan.leave - 10, channel: 'uebergang', title: `Noch 10 Minuten bis Losgehen`, body: `Um ${t(plan.leave)} geht's los. Schuhe, Schlüssel, Handy.`, escalate: false })
    out.push({ key: 'leave', at: plan.leave, channel: 'uebergang', title: `${t(plan.leave)} – Losgehen!`, body: 'Jetzt los, dann bist du entspannt pünktlich.', escalate: true, hard: true })
  }
  // Die eigene Grenze meldet sich je einmal, ohne Wiederholung und ohne Vorwurf
  if (wi && !wi.started && !wi.fixedMorning && wi.latestStart !== undefined && wi.plannedStart <= wi.latestStart) {
    if (wi.latestLeave !== undefined) {
      if (!log?.leftAt && wi.latestLeave > (plan.leave ?? -1)) out.push({ key: 'latest-leave', at: wi.latestLeave, channel: 'uebergang', title: `${t(wi.latestLeave)} – Spätestens jetzt los`, body: `Dann schaffst du es bis ${t(wi.latestStart)}.`, escalate: false, hard: true })
    } else {
      out.push({ key: 'latest-start', at: wi.latestStart - 10, channel: 'sanft', title: `Um ${t(wi.latestStart)} ist deine Grenze`, body: 'Noch 10 Minuten bis dahin.', escalate: false, hard: true })
    }
  }
  const gymbag = evening?.steps?.some((x) => x.tag === 'gymbag')
  if (!sick && gymbag && evening) {
    out.push({ key: 'gymbag', at: Math.max(evening.start - 30, 17 * 60), channel: 'sanft', title: 'Sporttasche für morgen packen', body: 'Dann musst du morgen früh nur noch los.', escalate: false })
  }
  if (!sick && weekday(plan.date) === s.prepDay) {
    const ep = plan.blocks.find((b) => b.kind === 'evening-plan')
    out.push({ key: 'prepcook', at: (ep?.start ?? 18 * 60) + 10, channel: 'sanft', title: 'Heute ist Vorkoch-Tag', body: 'Einmal kochen, dreimal essen. Ein Gericht aus deiner Liste?', escalate: false })
  }
  if (evening && !log?.eveningRoutineDoneAt) {
    const words = (evening.steps ?? []).map((x) => (x.tag ? TAG_WORDS[x.tag] : undefined)).filter((x): x is string => !!x)
    const what = words.length ? joinSteps(words) : 'Abendroutine'
    out.push({
      key: 'evening',
      at: evening.start,
      channel: 'uebergang',
      title: sick ? `${t(evening.start)} – Zähne und Gesicht` : `${t(evening.start)} – ${what}`,
      body: sick ? 'Nur das Nötigste, dann ausruhen.' : `Dauert etwa ${minuteText(evening.end - evening.start)}.`,
      escalate: true,
    })
  }
  if (s.support.windDown.enabled && !guidanceEveningEnabled && !log?.bedAt) {
    // Eine Uhrzeit nach Mitternacht gehört noch zum Abend dieses Plantags.
    const at = s.support.windDown.at < 4 * 60 ? s.support.windDown.at + 1440 : s.support.windDown.at
    out.push({ key: 'wind-down', at, channel: 'sanft', title: 'Zeit für deinen Abendübergang', body: 'Wenn es für dich passt, öffne Anker für deine gewählte ruhige Aktivität.', escalate: false })
  }
  if (!s.support.windDown.enabled && !guidanceEveningEnabled && !sick && !log?.pcOffAt && !plan.openEnd) {
    out.push({ key: 'pcstop-15', at: plan.pcStop - 15, channel: 'sanft', title: 'In 15 Minuten PC-Stopp', body: `Um ${t(plan.pcStop)} ist Schluss. Runde in Ruhe beenden.`, escalate: false })
    out.push({ key: 'pcstop', at: plan.pcStop, channel: 'uebergang', title: `${t(plan.pcStop)} – PC aus`, body: 'Eine Pause vom Scrollen schafft Zeit zum Runterkommen. Zum Beispiel kurz lesen oder ruhige Musik hören.', escalate: true, hard: true })
  }
  if (guidanceEveningOpen) {
    // The same canonical plan owns both the UI phases and closed-app delivery.
    // These replace the old transition series; no second PC/bed schedule is created.
    out.push({ key: 'guidance-wind-down', at: plan.bed - 30, channel: 'sanft', title: 'Noch 30 Minuten bis zu deinem Abendanker', body: 'Du kannst langsam aussteigen. Dein nächster Abendschritt steht in Anker bereit.', escalate: false })
    out.push({ key: 'guidance-brain-dump', at: plan.bed - 10, channel: 'sanft', title: 'Noch 10 Minuten bis zu deinem Abendanker', body: 'Ein Gedanke ist noch offen? Du kannst ihn in Anker für morgen parken.', escalate: false })
    out.push({ key: 'bed', at: plan.bed, channel: 'uebergang', title: 'Dein Abendanker ist da', body: 'Öffne Anker für deinen nächsten Abendschritt. Dein Plan bleibt anpassbar.', escalate: false, hard: true })
  } else if (!guidanceEveningEnabled && !s.support.windDown.enabled && !log?.bedAt && !plan.openEnd) {
    out.push({ key: 'bed', at: plan.bed, channel: 'uebergang', title: `${t(plan.bed)} – Ab ins Bett`, body: 'Handy weg, Licht aus. Morgen früh klingelt der Anker.', escalate: true, hard: true })
  }
  if (weekday(plan.date) === 6 && !sick) {
    out.push({ key: 'review', at: 19 * 60, channel: 'sanft', title: 'Wochenrückblick', body: '3 kurze Fragen, ohne Bewertung. 2 Minuten.', escalate: false })
  }
  // Wege zu Terminen. Texte allgemein, denn Ort und Anlass bleiben auf dem Gerät.
  for (const l of plan.legs ?? []) {
    const c = l.commitment
    if (c.leftAt || c.arrivedAt || c.backAt) continue
    if (l.prepStart !== undefined) out.push({ key: `prep:${c.id}`, at: l.prepStart, channel: 'sanft', title: 'Bald fertig machen', body: 'Dein Termin rückt näher.', escalate: false, hard: true })
    if (l.leave !== undefined) out.push({ key: `go:${c.id}`, at: l.leave, channel: 'uebergang', title: `${t(l.leave)} – Losgehen`, body: `Dann bist du um ${t(c.start)} da.`, escalate: c.commitment === 'hard', hard: true })
  }
  if (s.alarm.medicationEnabled && s.alarm.medicationReminderAt !== null) {
    // Bewusst neutral: Sperrbildschirme sind öffentlich, und Anker ordnet nichts an
    out.push({ key: 'meds', at: s.alarm.medicationReminderAt, channel: 'sanft', title: 'Deine private Erinnerung', body: 'Eintragen, wenn du magst.', escalate: false, hard: true })
  }
  return out
}

/** Evaluate each actual delivery, including repetitions, against the current context. */
export function reminderAllowed(plan: DayPlan | undefined, log: DayLog | undefined, s: Settings, at: number, critical: boolean, key: string, extras: ReminderExtras = {}, policy?: ReminderPolicy): boolean {
  const local = utcToZoned(at)
  const m = plan ? minutesOnPlanDay(plan.date, at) : local.minutes
  // Leisure/film windows still keep explicitly selected routes and private reminders, never household nudges.
  const selected = key.startsWith('go:') || key.startsWith('prep:')
  const inPlanQuiet = policy ? policy.ranges.some((r) => at >= r.from && at < r.to) : plan && (plan.quiet ?? []).some(([a, e]) => m >= a && m < e)
  if (!selected && inPlanQuiet) return false
  if (!critical && (inQuiet(local.minutes, s) || (extras.focusUntil ?? 0) > at)) return false
  if (!critical && (log?.override.mode === 'auf-kurs' || log?.override.mode === 'ueberlastet') && key !== 'wind-down') return false
  // No routine household hints while a known journey is in progress.
  if (!critical && plan?.blocks.some((b) => ['travel', 'commute'].includes(b.kind) && m >= b.start && m < b.end)) return false
  return true
}

function baseRevision(plan: DayPlan, log: DayLog | undefined, s: Settings, b: Base): string {
  return reminderRevision([plan.date, b, plan.quiet, log?.override.mode, s.reminders, s.routines, s.alarm.medicationReminderAt])
}

/** Authoritative logical versions, including already delivered reminders and snoozed entries. */
export function reminderRevisions(plans: DayPlan[], logs: Record<string, DayLog | undefined>, s: Settings, extras: ReminderExtras = {}): Record<string, string> {
  const out: Record<string, string> = {}
  const policy = reminderPolicy(plans, s)
  for (const plan of plans) {
    const log = logs[plan.date]
    for (const b of baseReminders(plan, log, s)) {
      const levels = b.escalate ? escalationSteps(s.reminders.intensity) : 0
      const allowed = Array.from({ length: levels + 1 }, (_, e) => zonedToUtc(plan.date, b.at + e * s.reminders.repeatAfterMin)).some((at) => reminderAllowed(plan, log, s, at, !!b.hard, b.key, extras, policy))
      if (log?.dismissed?.includes(b.key) || !allowed) continue
      out[`${plan.date}|${b.key}`] = baseRevision(plan, log, s, b)
    }
  }
  for (const reminder of privateReminders(extras)) {
    if (!logs[reminder.date]?.dismissed?.includes(reminder.key) && reminderAllowed(undefined, logs[reminder.date], s, reminder.at, false, reminder.key, extras, policy)) out[`${reminder.date}|${reminder.key}`] = reminderRevision(reminder)
  }
  for (const deadline of extras.deadlines ?? []) {
    const date = utcToZoned(deadline.at).date
    for (const [suffix, lead] of [['day', 24 * 3600_000], ['hour', 3600_000]] as const) {
      const key = `deadline-${suffix}:${deadline.id}`
      if (!logs[date]?.dismissed?.includes(key) && reminderAllowed(undefined, logs[date], s, deadline.at - lead, true, key, extras, policy)) {
        // Ein geänderter/offener Aufgabenstand darf keine alte native Erledigung übernehmen.
        // Ohne Zusatzfeld behalten Legacy-Aufgaben exakt ihre bisherigen Revisionswerte.
        out[`${date}|${key}`] = reminderRevision([date, key, deadline.at, ...(deadline.reminderRevision === undefined ? [] : [deadline.reminderRevision])])
      }
    }
  }
  return out
}

/** Alle Erinnerungs-Schlüssel, die für diese Tage noch gelten. Was fehlt, wird aus der Leiste geräumt. */
export function relevantReminderKeys(plans: DayPlan[], logs: Record<string, DayLog | undefined>, s: Settings, extras: ReminderExtras = {}): string[] {
  return Object.keys(reminderRevisions(plans, logs, s, extras))
}

/** Hinweis kurz vor Ende der Vorausplanung, statt still zu verstummen. */
export function reopenHint(horizonEnd: number, date: string): ReminderSpec {
  const revision = reminderRevision([date, 'open-app', horizonEnd])
  return {
    key: 'open-app',
    date,
    id: reminderId(`${date}|open-app`),
    at: horizonEnd,
    channel: 'sanft',
    title: 'Anker einmal kurz öffnen',
    body: 'Deine wichtigen Basiszeiten laufen weiter. Öffne Anker für neue Tagesänderungen.',
    escalation: 0,
    actions: false,
    exact: false,
    revision,
    token: reminderDeliveryToken(revision, horizonEnd),
    critical: false,
    ...slotFor('open-app'),
  }
}

function inQuiet(m: number, s: Settings): boolean {
  const x = ((m % 1440) + 1440) % 1440
  const { quietStart: a, quietEnd: b } = s.reminders
  return a <= b ? x >= a && x < b : x >= a || x < b
}

function escalationSteps(intensity: ReminderIntensity): number {
  return intensity === 'gentle' ? 0 : intensity === 'normal' ? 1 : 2
}

/** Alle Erinnerungen des Zeitfensters (Standard 48 h) für die gegebenen Pläne. Reine Funktion. */
export function buildReminders(
  plans: DayPlan[],
  logs: Record<string, DayLog | undefined>,
  s: Settings,
  nowMs: number,
  lookaheadMs = LOOKAHEAD_MS,
  extras: ReminderExtras = {},
): ReminderSpec[] {
  const out: ReminderSpec[] = []
  const revisions = reminderRevisions(plans, logs, s, extras)
  const policy = reminderPolicy(plans, s)
  for (const d of extras.deadlines ?? []) {
    // Früh und ruhig: am Vortag und eine Stunde vorher
    for (const [suffix, lead, title] of [
      ['day', 24 * 3600_000, 'Morgen steht eine Deadline an'],
      ['hour', 3600_000, 'In einer Stunde ist eine Deadline'],
    ] as const) {
      const at = d.at - lead
      if (at <= nowMs || at > nowMs + lookaheadMs) continue
      const key = `deadline-${suffix}:${d.id}`
      const date = utcToZoned(d.at).date
      if (logs[date]?.dismissed?.includes(key)) continue
      if (!reminderAllowed(undefined, logs[date], s, at, true, key, extras, policy)) continue
      const revision = revisions[`${date}|${key}`]!
      out.push({ key, date, id: reminderId(`${d.id}|${suffix}`), at, channel: 'uebergang', title, body: 'Öffne Anker, dort steht dein nächster Schritt.', escalation: 0, actions: true, exact: true, revision, token: reminderDeliveryToken(revision, at), critical: true, ...slotFor(key) })
    }
  }
  for (const reminder of privateReminders(extras)) {
    if (reminder.at <= nowMs || reminder.at > nowMs + lookaheadMs || !reminderAllowed(undefined, logs[reminder.date], s, reminder.at, false, reminder.key, extras, policy)) continue
    if (logs[reminder.date]?.dismissed?.includes(reminder.key)) continue
    const revision = revisions[`${reminder.date}|${reminder.key}`]!
    out.push({ ...reminder, id: reminderId(`${reminder.date}|${reminder.key}|0`), channel: 'sanft', escalation: 0, actions: false, exact: false, revision, token: reminderDeliveryToken(revision, reminder.at), critical: false, ...slotFor(reminder.key) })
  }
  const steps = escalationSteps(s.reminders.intensity)
  const gap = s.reminders.repeatAfterMin
  for (const plan of plans) {
    const log = logs[plan.date]
    const dismissed = new Set(log?.dismissed ?? [])
    for (const b of baseReminders(plan, log, s)) {
      if (dismissed.has(b.key)) continue
      const levels = b.escalate ? steps : 0
      for (let e = 0; e <= levels; e++) {
        const m = b.at + e * gap
        const at = zonedToUtc(plan.date, m)
        if (at <= nowMs || at > nowMs + lookaheadMs) continue
        if (!reminderAllowed(plan, log, s, at, !!b.hard, b.key, extras, policy)) continue
        const revision = baseRevision(plan, log, s, b)
        const channel: Channel = e === 2 ? 'wecker' : e === 1 && b.channel === 'sanft' ? 'uebergang' : b.channel
        out.push({
          ...slotFor(b.key),
          exact: channel !== 'sanft',
          key: b.key,
          date: plan.date,
          id: reminderId(`${plan.date}|${b.key}|${e}`),
          at,
          channel,
          title: e === 0 ? b.title : `Noch offen: ${b.title.replace(/^\d\d:\d\d – /, '')}`,
          body: b.body,
          escalation: e,
          actions: b.escalate || b.key === 'leave-10' || b.key === 'pcstop-15',
          revision,
          token: reminderDeliveryToken(revision, at, e),
          critical: !!b.hard,
        })
      }
    }
  }
  return out.sort((a, b) => a.at - b.at)
}

/** IDs aller Eskalationsstufen eines Erinnerungs-Schlüssels (zum Abbrechen nach „Erledigt“). */
export function idsForKey(date: string, key: string): number[] {
  return [0, 1, 2].map((e) => reminderId(`${date}|${key}|${e}`))
}

export function snoozeId(date: string, key: string, n: number): number {
  return reminderId(`${date}|${key}|snooze${n}`)
}

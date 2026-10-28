import { fmtTime, weekday, zonedToUtc } from '../time'
import type { DayLog, DayPlan, ReminderIntensity, Settings } from '../types'

export type Channel = 'wecker' | 'uebergang' | 'sanft'

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

  if (!sick && morning?.steps?.length && !Object.keys(log?.steps ?? {}).some((k) => k.startsWith('morning:'))) {
    const first = morning.steps[0]!
    out.push({ key: 'morning', at: morning.start + 3, channel: 'sanft', title: `${t(morning.start)} – Morgenroutine`, body: `Erster Schritt: ${first.useMinimal && first.minimal ? first.minimal.title : first.title}`, escalate: false })
  }
  if (plan.leave !== undefined && !log?.leftAt) {
    out.push({ key: 'leave-10', at: plan.leave - 10, channel: 'uebergang', title: `Noch 10 Minuten bis Losgehen`, body: `Um ${t(plan.leave)} geht's los. Schuhe, Schlüssel, Handy.`, escalate: false })
    out.push({ key: 'leave', at: plan.leave, channel: 'uebergang', title: `${t(plan.leave)} – Losgehen!`, body: 'Jetzt los, dann bist du entspannt pünktlich.', escalate: true, hard: true })
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
      title: sick ? `${t(evening.start)} – Zähne und Gesicht` : `${t(evening.start)} – ${what}, dann darfst du zocken`,
      body: sick ? 'Nur das Nötigste, dann ausruhen.' : `Dauert etwa ${evening.end - evening.start} Minuten.`,
      escalate: true,
    })
  }
  if (!sick && !log?.pcOffAt) {
    out.push({ key: 'pcstop-15', at: plan.pcStop - 15, channel: 'sanft', title: 'In 15 Minuten PC-Stopp', body: `Um ${t(plan.pcStop)} ist Schluss. Runde in Ruhe beenden.`, escalate: false })
    out.push({ key: 'pcstop', at: plan.pcStop, channel: 'uebergang', title: `${t(plan.pcStop)} – PC aus`, body: 'Bildschirm aus, runterkommen. Gut gemacht heute.', escalate: true, hard: true })
  }
  if (!log?.bedAt) {
    out.push({ key: 'bed', at: plan.bed, channel: 'uebergang', title: `${t(plan.bed)} – Ab ins Bett`, body: 'Handy weg, Licht aus. Morgen früh klingelt der Anker.', escalate: true, hard: true })
  }
  if (weekday(plan.date) === 6 && !sick) {
    out.push({ key: 'review', at: 19 * 60, channel: 'sanft', title: 'Wochenrückblick', body: '3 kurze Fragen, ohne Bewertung. 2 Minuten.', escalate: false })
  }
  return out
}

function inQuiet(m: number, s: Settings): boolean {
  const x = ((m % 1440) + 1440) % 1440
  const { quietStart: a, quietEnd: b } = s.reminders
  return a <= b ? x >= a && x < b : x >= a || x < b
}

function escalationSteps(intensity: ReminderIntensity): number {
  return intensity === 'gentle' ? 0 : intensity === 'normal' ? 1 : 2
}

/** Alle Erinnerungen der nächsten 48 h für die gegebenen Pläne. Reine Funktion. */
export function buildReminders(plans: DayPlan[], logs: Record<string, DayLog | undefined>, s: Settings, nowMs: number): ReminderSpec[] {
  const out: ReminderSpec[] = []
  const steps = escalationSteps(s.reminders.intensity)
  const gap = s.reminders.repeatAfterMin
  for (const plan of plans) {
    const log = logs[plan.date]
    const dismissed = new Set(log?.dismissed ?? [])
    for (const b of baseReminders(plan, log, s)) {
      if (dismissed.has(b.key)) continue
      if (!b.hard && inQuiet(b.at, s)) continue
      const levels = b.escalate ? steps : 0
      for (let e = 0; e <= levels; e++) {
        const m = b.at + e * gap
        const at = zonedToUtc(plan.date, m)
        if (at <= nowMs || at > nowMs + LOOKAHEAD_MS) continue
        out.push({
          key: b.key,
          date: plan.date,
          id: reminderId(`${plan.date}|${b.key}|${e}`),
          at,
          channel: e === 2 ? 'wecker' : e === 1 && b.channel === 'sanft' ? 'uebergang' : b.channel,
          title: e === 0 ? b.title : `Noch offen: ${b.title.replace(/^\d\d:\d\d – /, '')}`,
          body: b.body,
          escalation: e,
          actions: b.escalate || b.key === 'leave-10' || b.key === 'pcstop-15',
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

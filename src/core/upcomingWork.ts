import { taskIsOpen } from './tasks'
import type { WorkTask } from './types'

/** Reine Ansicht auf die vorhandene Arbeitsaufgabe; kein zusätzlicher Aufgabenstand. */
export interface UpcomingWorkTask {
  task: WorkTask
  kind: 'start' | 'deadline'
  at: number
}

const MINUTE_MS = 60_000
const validTimestamp = (value: number | undefined): value is number => value !== undefined
  && Number.isFinite(value) && value >= 0 && Number.isFinite(new Date(value).getTime())

/**
 * Bis zu drei nächste Zeitpunkte innerhalb einer Stunde, je Aufgabe genau einer.
 * Die aktuelle Minute bleibt vollständig sichtbar. Eine Startzeit ist keine Frist;
 * der Hinweis startet nichts und bewertet auch eine gerade fällige Frist nicht als überfällig.
 * Bewusst verschobene/aktive Aufgaben bleiben offen; ihre Zeitangabe ist keine Startfreigabe.
 */
export function upcomingWorkTasks(work: readonly WorkTask[], nowMs: number): UpcomingWorkTask[] {
  if (!validTimestamp(nowMs)) return []
  const minuteStart = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS
  const windowEnd = nowMs + 60 * MINUTE_MS
  const inWindow = (at: number | undefined): at is number => validTimestamp(at) && at >= minuteStart && at <= windowEnd
  const upcoming: UpcomingWorkTask[] = []

  for (const task of work) {
    if (!taskIsOpen(task) || !task.id.trim()) continue
    const start = inWindow(task.earliestStart) ? task.earliestStart : undefined
    const deadline = inWindow(task.deadline) ? task.deadline : undefined
    // Bei gleichem Zeitpunkt nennt der eine Hinweis die verbindlichere Frist.
    if (deadline !== undefined && (start === undefined || deadline <= start)) upcoming.push({ task, kind: 'deadline', at: deadline })
    else if (start !== undefined) upcoming.push({ task, kind: 'start', at: start })
  }

  return upcoming.sort((a, b) => a.at - b.at
    || Number(a.kind === 'start') - Number(b.kind === 'start')
    || (a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0)).slice(0, 3)
}

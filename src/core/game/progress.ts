import { addDays, daysBetween, type DateStr } from '../time'
import type { DayLog, GameState, Settings } from '../types'
import { chapterLength, evaluateChapter } from './chapter'
import type { DayStatus, Goal } from './evaluate'
import type { Theme } from './themes'
import { levelFor, XP } from './xp'

export function initialGame(today: DateStr): GameState {
  return {
    xp: 0,
    spent: 0,
    chapter: { index: 0, startDate: today, jokerUsed: false, attempt: 1 },
    chaptersDone: [],
    badges: [],
    achievements: {},
    redeemed: [],
  }
}

export function balance(g: GameState): number {
  return g.xp - g.spent
}

export interface ProgressContext {
  today: DateStr
  settings: Settings
  theme: Theme
  statusOf: (d: DateStr) => DayStatus
  goalsOf: (d: DateStr) => Goal[]
  logs: DayLog[]
  reviewCount: number
}

export interface Achievement {
  id: string
  title: string
  description: string
  check: (c: ProgressContext, g: GameState) => boolean
}

function streak(c: ProgressContext, key: Goal['key'], n: number): boolean {
  let run = 0
  const dates = c.logs.map((l) => l.date).sort()
  for (const d of dates) {
    const g = c.goalsOf(d).find((x) => x.key === key)
    if (!g) continue
    run = g.met ? run + 1 : 0
    if (run >= n) return true
  }
  return false
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-step', title: 'Erster Schritt', description: 'Den ersten Routine-Schritt erledigt.', check: (c) => c.logs.some((l) => Object.values(l.steps).some((v) => v === 'done' || v === 'minimal')) },
  { id: 'wake-5', title: 'Frühaufsteher', description: '5× in Folge pünktlich aufgestanden.', check: (c) => streak(c, 'wake', 5) },
  { id: 'punctual-5', title: 'Pünktlich wie die Bahn (fast)', description: '5× in Folge pünktlich losgegangen.', check: (c) => streak(c, 'leave', 5) },
  { id: 'pcstop-7', title: 'Feierabend für den PC', description: '7× in Folge den PC-Stopp eingehalten.', check: (c) => streak(c, 'pcstop', 7) },
  {
    id: 'gym-morning',
    title: 'Eisen vor der Arbeit',
    description: 'Zum ersten Mal vor der Arbeit im Fitnessstudio.',
    check: (c) => c.settings.sport.kind === 'gym' && c.settings.sport.time === 'morning' && c.logs.some((l) => !!l.sport),
  },
  { id: 'minimal-10', title: 'Hauptsache gemacht', description: '10× die Minimal-Version gewählt statt ausgelassen.', check: (c) => c.logs.reduce((n, l) => n + Object.values(l.steps).filter((v) => v === 'minimal').length, 0) >= 10 },
  {
    id: 'comeback',
    title: 'Nie zweimal',
    description: 'Nach einem verpassten Tag direkt wieder geschafft.',
    check: (c) => c.logs.some((l) => c.statusOf(l.date) === 'success' && c.statusOf(addDays(l.date, -1)) === 'missed'),
  },
  { id: 'prepcook', title: 'Meal-Prep-Profi', description: 'Zum ersten Mal vorgekocht.', check: (c) => c.logs.some((l) => l.prepCooked) },
  { id: 'chapter-1', title: 'Erstes Kapitel', description: 'Das erste Kapitel abgeschlossen.', check: (_, g) => g.chaptersDone.length >= 1 },
  { id: 'chapter-66', title: 'Neue Gewohnheit', description: '66 Tage – das ist jetzt deins.', check: (_, g) => g.chaptersDone.some((x) => x.length >= 66) },
  { id: 'shop', title: 'Gönn dir', description: 'Die erste Belohnung eingelöst.', check: (_, g) => g.redeemed.length > 0 },
  { id: 'review', title: 'Kurz innegehalten', description: 'Den ersten Wochenrückblick gemacht.', check: (c) => c.reviewCount > 0 },
  { id: 'level-5', title: 'Halbzeit', description: 'Level 5 erreicht.', check: (c, g) => levelFor(g.xp, c.theme).level >= 5 },
]

export interface ProgressEvent {
  type: 'chapter-completed' | 'chapter-restarted' | 'stage-offer' | 'achievement' | 'level-up'
  text: string
}

/**
 * Wertet Kapitel, Stufen-Angebot und Erfolge aus. Reine Funktion: gibt neuen GameState
 * und Ereignisse für die Oberfläche zurück. Bewertet nur abgeschlossene Tage + heute, falls geschafft.
 */
export function advanceGame(g0: GameState, c: ProgressContext): { game: GameState; events: ProgressEvent[] } {
  const g: GameState = structuredClone(g0)
  const events: ProgressEvent[] = []
  const levelBefore = levelFor(g.xp, c.theme).level

  // Mehrere Kapitel können theoretisch nacheinander abgeschlossen werden (z. B. nach Import)
  for (let guard = 0; guard < 10; guard++) {
    const len = chapterLength(g.chapter.index)
    const r = evaluateChapter(g.chapter.startDate, len, c.today, c.statusOf, g.chapter.jokerUsed)
    if (r.completed && r.completedOn) {
      g.chaptersDone.push({ length: len, endDate: r.completedOn })
      const badge = c.theme.badges[len]
      if (badge && !g.badges.includes(badge)) g.badges.push(badge)
      g.xp += XP.chapterPerWeek * Math.ceil(len / 7)
      g.chapter = { index: g.chapter.index + 1, startDate: addDays(r.completedOn, 1), jokerUsed: false, attempt: 1 }
      g.pendingChapter = len
      events.push({ type: 'chapter-completed', text: c.theme.chapterDone(len) })
      const stage = c.settings.game.stage
      const weeks = daysBetween(c.settings.game.startDate, r.completedOn) / 7
      if (stage < 3) {
        const next = (stage + 1) as 2 | 3
        if ((next === 2 && weeks >= 2) || (next === 3 && weeks >= 4) || len >= 30) {
          g.stageOffer = next
          events.push({ type: 'stage-offer', text: `Bereit für ${c.theme.stageNames[next - 1]}?` })
        }
      }
      continue
    }
    if (r.ended && r.endedOn) {
      g.chapter = { index: g.chapter.index, startDate: addDays(r.endedOn, 1), jokerUsed: false, attempt: g.chapter.attempt + 1 }
      events.push({ type: 'chapter-restarted', text: `Neuer Anlauf für ${c.theme.chapterWord} ${g.chapter.index + 1}. Alles, was du gesammelt hast, bleibt.` })
      continue
    }
    g.chapter.jokerUsed = r.jokerUsed
    break
  }

  for (const a of ACHIEVEMENTS) {
    if (g.achievements[a.id]) continue
    if (a.check(c, g)) {
      g.achievements[a.id] = c.today
      g.xp += XP.achievement
      events.push({ type: 'achievement', text: a.title })
    }
  }

  const levelAfter = levelFor(g.xp, c.theme).level
  if (levelAfter > levelBefore) {
    g.pendingLevelUp = levelAfter
    events.push({ type: 'level-up', text: c.theme.levelUp(levelFor(g.xp, c.theme).name) })
  }
  g.lastEvaluated = c.today
  return { game: g, events }
}

/** Aktueller Kapitel-Stand für die Anzeige. */
export function chapterStatus(g: GameState, today: DateStr, statusOf: (d: DateStr) => DayStatus) {
  const len = chapterLength(g.chapter.index)
  return evaluateChapter(g.chapter.startDate, len, today, statusOf, g.chapter.jokerUsed)
}

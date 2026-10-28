import type { ThemeId } from '../types'

export interface Theme {
  id: ThemeId
  name: string
  emoji: string
  tagline: string
  /** Level-Namen, Index 0 = Level 1 */
  levels: string[]
  chapterWord: string
  xpWord: string
  stageNames: [string, string, string]
  /** Abzeichen-Namen je Kapitel-Länge */
  badges: Record<number, string>
  levelUp: (name: string) => string
  chapterDone: (days: number) => string
}

// Eigene Texte, nur von bekannten Welten inspiriert – keine Original-Namen, Logos oder Grafiken.
export const THEMES: Record<ThemeId, Theme> = {
  seefahrt: {
    id: 'seefahrt',
    name: 'Seefahrt',
    emoji: '⚓',
    tagline: 'Ruhig Kurs halten, Tag für Tag.',
    levels: ['Landratte', 'Schiffsjunge', 'Matrose', 'Bootsmann', 'Steuermann', 'Navigator', 'Erster Offizier', 'Kapitän', 'Kommodore', 'Admiral'],
    chapterWord: 'Etappe',
    xpWord: 'Seemeilen',
    stageNames: ['Ablegen', 'Offene See', 'Hochsee'],
    badges: { 7: 'Kompass', 14: 'Fernrohr', 30: 'Steuerrad', 66: 'Goldener Anker' },
    levelUp: (n) => `Beförderung! Du bist jetzt ${n}.`,
    chapterDone: (d) => `${d} Tage auf Kurs. Land in Sicht!`,
  },
  piraten: {
    id: 'piraten',
    name: 'Piraten-Abenteuer',
    emoji: '🏴‍☠️',
    tagline: 'Deine Crew, dein Kopfgeld, deine Reise.',
    levels: ['Blinder Passagier', 'Deckschrubber', 'Crewmitglied', 'Kanonier', 'Rookie-Kapitän', 'Supernova', 'Gefürchteter Kapitän', 'Legende der Meere', 'Herrscher der Meere', 'König der Piraten'],
    chapterWord: 'Arc',
    xpWord: 'Kopfgeld',
    stageNames: ['Heimatinsel', 'Große Route', 'Neue Welt'],
    badges: { 7: 'Strohhut', 14: 'Schatzkarte', 30: 'Teufelsfrucht', 66: 'Der große Schatz' },
    levelUp: (n) => `Dein Kopfgeld steigt! Neuer Titel: ${n}.`,
    chapterDone: (d) => `${d} Tage – Arc abgeschlossen. Die Crew feiert!`,
  },
  weltraum: {
    id: 'weltraum',
    name: 'Weltraum-Saga',
    emoji: '🌌',
    tagline: 'Die Disziplin ist mit dir.',
    levels: ['Feuchtfarmer', 'Jüngling', 'Schüler', 'Wächter', 'Ritter', 'Kommandant', 'Ratsmitglied', 'Meister', 'Großmeister', 'Legende der Galaxis'],
    chapterWord: 'Episode',
    xpWord: 'Credits',
    stageNames: ['Ausbildung', 'Prüfungen', 'Ritterschaft'],
    badges: { 7: 'Kyber-Kristall', 14: 'Lichtschwert', 30: 'Holocron', 66: 'Sternenkarte' },
    levelUp: (n) => `Der Rat erkennt deinen Fortschritt an: ${n}.`,
    chapterDone: (d) => `Episode abgeschlossen: ${d} Tage im Gleichgewicht.`,
  },
  kampfkunst: {
    id: 'kampfkunst',
    name: 'Kampfkunst-Saga',
    emoji: '🐉',
    tagline: 'Jeden Tag ein bisschen stärker.',
    levels: ['Anfänger', 'Schüler', 'Kämpfer', 'Krieger', 'Elitekämpfer', 'Turniersieger', 'Supermodus', 'Supermodus 2', 'Supermodus 3', 'Über 9000'],
    chapterWord: 'Saga',
    xpWord: 'Kraft',
    stageNames: ['Grundtraining', 'Schwerkraft-Training', 'Zeitkammer'],
    badges: { 7: '1-Sterne-Kugel', 14: '3-Sterne-Kugel', 30: '5-Sterne-Kugel', 66: '7-Sterne-Kugel' },
    levelUp: (n) => `Deine Kraft explodiert! Neue Form: ${n}.`,
    chapterDone: (d) => `Saga beendet: ${d} Tage Training. Wünsch dir was!`,
  },
  schlicht: {
    id: 'schlicht',
    name: 'Schlicht',
    emoji: '◯',
    tagline: 'Ohne Thema, nur Fortschritt.',
    levels: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7', 'Level 8', 'Level 9', 'Level 10'],
    chapterWord: 'Kapitel',
    xpWord: 'XP',
    stageNames: ['Stufe 1', 'Stufe 2', 'Stufe 3'],
    badges: { 7: '7 Tage', 14: '14 Tage', 30: '30 Tage', 66: '66 Tage' },
    levelUp: (n) => `Aufgestiegen: ${n}.`,
    chapterDone: (d) => `Kapitel geschafft: ${d} Tage.`,
  },
}

export const THEME_LIST = Object.values(THEMES)

export function theme(id: ThemeId | undefined): Theme {
  return THEMES[id ?? 'seefahrt'] ?? THEMES.seefahrt
}

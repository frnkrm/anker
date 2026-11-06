/** Native sieht nur die vorhandene neutrale Projektion, nie Aufgaben-/Adressinhalte. */
export interface WidgetEntry { at: number; action: string; sub: string; hardLabel: string; hardTime: string }
export interface WidgetSnapshot { entries: WidgetEntry[]; generatedAt: number; expiresAt: number }
export function widgetSnapshot(entries: WidgetEntry[], now: number): WidgetSnapshot {
  const last = entries.reduce((at, entry) => Math.max(at, entry.at), now)
  return { entries, generatedAt: now, expiresAt: Math.max(now + 60_000, Math.min(now + 48 * 3600_000, last)) }
}

/** Reines Zeitfenster, keine Behauptung über Schlafphasen oder tatsächliche Wachheit. */
export function smartWakeWindow(targetAt: number, minutes: number): { from: number; to: number } | undefined {
  if (!Number.isFinite(new Date(targetAt).getTime()) || targetAt <= 0 || !Number.isInteger(minutes) || minutes < 5 || minutes > 90) return undefined
  return { from: targetAt - minutes * 60_000, to: targetAt }
}

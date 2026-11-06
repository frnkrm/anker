/** Verschiebt ausschließlich die aktuelle Zeile; zwischenzeitliche Änderungen bleiben erhalten. */
export function moveById<T extends { id: string }>(items: T[], sourceId: string, targetId: string): T[] {
  const from = items.findIndex((item) => item.id === sourceId)
  const to = items.findIndex((item) => item.id === targetId)
  if (from < 0 || to < 0 || from === to) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

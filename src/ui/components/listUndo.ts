/** Reinsert removed text entries without discarding additions made after removal. */
export function restoreTextEntries(current: string[], original: string[], value: string): string[] {
  const next = [...current]
  let missing = Math.max(0, original.filter((item) => item === value).length - next.filter((item) => item === value).length)
  for (const [index, item] of original.entries()) {
    if (item !== value || missing === 0) continue
    next.splice(Math.min(index, next.length), 0, value)
    missing--
  }
  return next
}

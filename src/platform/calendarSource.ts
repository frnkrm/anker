/** Shared request epoch only; calendar data stays in the existing Store snapshot. */
let revision = 0
export const calendarSourceRevision = (): number => revision
export const invalidateCalendarSource = (): number => ++revision

import { expect, it, vi } from 'vitest'
import { safe } from './native'

it('protokolliert bei optionalen Fehlern keine Inhalte aus Standort, Sprache oder Geheimnissen', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    expect(await safe(async () => { throw new Error('synthetic-secret synthetic-location synthetic-transcript') }, false)).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/synthetic|secret|location|transcript/)
  } finally { warn.mockRestore() }
})

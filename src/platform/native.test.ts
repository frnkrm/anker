import { afterEach, expect, it, vi } from 'vitest'
import { safe } from './native'

afterEach(() => vi.restoreAllMocks())

it('protokolliert bei optionalen Fehlern keine privaten Rohinhalte und erhält den Rückfall', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  expect(await safe(async () => { throw new Error('NUR-LOKAL-Kundenadresse-Medikationsnotiz') }, 'Rückfall')).toBe('Rückfall')
  expect(warn).toHaveBeenCalledOnce()
  expect(warn.mock.calls.flat().map(String).join(' ')).not.toContain('NUR-LOKAL')
})

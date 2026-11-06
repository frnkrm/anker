import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickTextFile } from './files'

vi.mock('./native', () => ({ isNative: () => false }))
afterEach(() => vi.unstubAllGlobals())

function picker() {
  const callbacks = new Map<string, () => void>()
  const input = {
    type: '', accept: '', style: {}, files: [] as { text: () => Promise<string> }[],
    onchange: undefined as (() => Promise<void>) | undefined,
    click: vi.fn(), remove: vi.fn(),
    addEventListener: (event: string, callback: () => void) => callbacks.set(event, callback),
  }
  vi.stubGlobal('document', { createElement: () => input, body: { appendChild: vi.fn() } })
  return { input, cancel: () => callbacks.get('cancel')!() }
}

describe('Sicherungsdatei bewusst auswählen', () => {
  it('beendet den Dateidialog-Abbruch ohne hängenden Import oder angeblichen Erfolg', async () => {
    const { input, cancel } = picker()
    const result = pickTextFile()
    cancel()
    expect(await result).toBeNull()
    expect(input.remove).toHaveBeenCalledOnce()
  })
  it('liefert nur vollständig gelesenen Inhalt und entfernt das temporäre Eingabefeld', async () => {
    const { input } = picker()
    const result = pickTextFile()
    input.files = [{ text: async () => '{"app":"anker"}' }]
    await input.onchange!()
    expect(await result).toBe('{"app":"anker"}')
    expect(input.remove).toHaveBeenCalledOnce()
  })
  it('meldet Lesefehler neutral und kann danach neu gewählt werden', async () => {
    const { input } = picker()
    const result = pickTextFile()
    const rejected = expect(result).rejects.toThrow('Es wurde nichts importiert')
    input.files = [{ text: async () => { throw new Error('privater Dateiname') } }]
    await input.onchange!()
    await rejected
    expect(input.remove).toHaveBeenCalledOnce()
  })
})

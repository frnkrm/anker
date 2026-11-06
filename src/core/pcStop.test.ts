import { describe, expect, it } from 'vitest'
import { buildPcStopCommands, pcPlanDate, pickPcStopCommand, validPcStopCommand } from './pcStop'
import { zonedToUtc } from './time'

describe('E04 PC-Aufträge und datumsgebundene Pausen', () => {
  const date = '2026-11-06'
  it('spiegelt ein offenes Ende als Pause ohne erfundenen03:59-Termin', () => {
    const command = buildPcStopCommands([{ date, pcStop: 1679, openEnd: true }])[0]!
    expect(command).toMatchObject({ date, mode: 'paused', version: 2 })
    expect(command.stopAt).toBeUndefined()
    expect(command.localTime).toBeUndefined()
    expect(validPcStopCommand(command)).toBe(true)
  })
  it('gibt nur den heutigen Plantag zurück und bewahrt die Pause nach Mitternacht', () => {
    const commands = buildPcStopCommands([{ date, pcStop: 1679, openEnd: true }, { date: '2026-11-07', pcStop: 1300 }])
    expect(pickPcStopCommand(commands, zonedToUtc(date, 1450))?.mode).toBe('paused')
    expect(pickPcStopCommand(commands, zonedToUtc(date, 1680))?.date).toBe('2026-11-07')
    expect(pickPcStopCommand(commands.slice(1), zonedToUtc(date, 1300))).toBeUndefined()
  })
  it('behält Revisionen bei erneutem Abgleich und ändert sie bei bewusster Verlängerung', () => {
    const a = { date, pcStop: 1300 }
    const command = buildPcStopCommands([a])[0]!
    expect(buildPcStopCommands([a])[0]!.revision).toBe(command.revision)
    expect(buildPcStopCommands([{ ...a, pcStop: 1450 }])[0]!.revision).not.toBe(command.revision)
    expect(buildPcStopCommands([{ ...a, openEnd: true }])[0]!.revision).not.toBe(command.revision)
    expect(command.stopAt).toBe(new Date(zonedToUtc(date, 1300)).toISOString())
  })
  it('interpretiert den Plantag auch während Berliner Sommerzeitwechseln', () => {
    expect(pcPlanDate(Date.parse('2026-10-25T01:30:00Z'))).toBe('2026-10-24')
    expect(pcPlanDate(Date.parse('2026-10-25T03:00:00Z'))).toBe('2026-10-25')
    expect(pcPlanDate(Date.parse('2026-03-29T01:30:00Z'))).toBe('2026-03-28')
  })
  it('liest gültige Altaufträge, führt aber beschädigte neue Pausen nicht als alten Termin aus', () => {
    const legacy = { date, stopAt: new Date(zonedToUtc(date, 1300)).toISOString(), localTime: '21:40', extended: false }
    expect(pickPcStopCommand([legacy], zonedToUtc(date, 1200))?.stopAt).toBe(legacy.stopAt)
    expect(pickPcStopCommand([{ date, version: 2, mode: 'paused' }, legacy], zonedToUtc(date, 1200))).toBeUndefined()
    expect(validPcStopCommand({ ...buildPcStopCommands([{ date, pcStop: 1200 }])[0], stopAt: 'invalid' })).toBe(false)
  })
})

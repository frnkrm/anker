import { describe, expect, it } from 'vitest'
import { favoriteFunctions, FUNCTION_CATALOG, normaliseFunctionFavorites, normaliseSearch, searchFunctions } from './functionSearch'

describe('Lokale Funktionssuche', () => {
  it('findet verständliche Vorhaben und behält bewusst gewählte Favoriten in ihrer Reihenfolge', () => {
    expect(searchFunctions('ich möchte morgen länger schlafen')[0]?.id).toBe('wake')
    expect(searchFunctions('PC bleibt an')[0]?.id).toBe('pc')
    expect(normaliseFunctionFavorites(['pc', 'wake', 'pc', 'javascript:evil', 7])).toEqual(['pc', 'wake'])
    expect(normaliseFunctionFavorites(null)).toEqual([])
    expect(favoriteFunctions(['smartwake', 'pc']).map(value => value.id)).toEqual(['smartwake', 'pc'])
    expect(favoriteFunctions(['smartwake'])[0]?.unavailableReason).toBeTruthy()
  })
  it.each([['fotografie', 'hobbies'], ['bin wieder da', 'return'], ['schriftgroße', 'look'], ['qr code', 'alarm'], ['mikrofon', 'smartwake'], ['wlan', 'pc'], ['kostenlos verkehr', 'traffic'], ['aufgabe zerlegen', 'ai']])('findet %s über passende Schlagwörter', (q, id) => {
    expect(searchFunctions(q).some(e => e.id === id)).toBe(true)
  })
  it('ordnet präzise Namen vor allgemeinen Stichworttreffern', () => {
    expect(searchFunctions('Erinnerungen und Ruhezeiten')[0]?.id).toBe('reminders')
    expect(searchFunctions('Fokus starten')[0]?.id).toBe('focus')
  })
  it('behandelt Umlaute, Großschreibung und einen Tippfehler', () => {
    expect(normaliseSearch('GRÖẞER!')).toBe('grosser')
    expect(searchFunctions('Benachrichtigng').some(e => e.id === 'reminders')).toBe(true)
  })
  it('benötigt alle Suchwörter und zeigt leere oder fremde Inhalte nicht als Treffer', () => {
    expect(searchFunctions('')).toEqual([])
    expect(searchFunctions('wie kann ich')).toEqual([])
    expect(searchFunctions('fotografieren überstunden')).toEqual([])
    expect(searchFunctions('mein-geheimer-termin-xyz')).toEqual([])
  })
  it('führt zu festen Einstellungszielen, ohne Funktion oder Berechtigung auszulösen', () => {
    const result = searchFunctions('nacht mikrofon')[0]!
    expect(result.target).toBe('/wecker#nachtmessung')
    expect(result.unavailableReason).toBeTruthy()
    expect(searchFunctions('nacht mikrofon', { native: true })[0]?.unavailableReason).toBeUndefined()
    expect(new Set(FUNCTION_CATALOG.map(e => e.id)).size).toBe(FUNCTION_CATALOG.length)
    expect(FUNCTION_CATALOG.every(e => e.route.startsWith('/') && !e.route.includes('?'))).toBe(true)
  })
})

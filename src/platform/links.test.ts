import { describe, expect, it } from 'vitest'
import { APP_ID } from '../../app.config'
import { nativeDestination } from './links'

describe('Native App-Einstiege', () => {
  it('führt neue und bestehende Einstiege nur auf bekannte App-Seiten', () => {
    expect(nativeDestination(`${APP_ID}://evening`)).toBe('/abend')
    expect(nativeDestination(`${APP_ID}://thoughts`)).toBe('/inbox')
    expect(nativeDestination(`${APP_ID}://inbox`)).toBe('/gedanke')
    expect(nativeDestination(`${APP_ID}://recover`)).toBe('/wiedereinstieg')
    expect(nativeDestination(`${APP_ID}://focus`)).toBe('/fokus-start')
    expect(nativeDestination(`${APP_ID}://alarm`)).toBe('/wecker/klingelt')
    expect(nativeDestination(`${APP_ID}://now/`)).toBe('/')
    expect(nativeDestination(`${APP_ID}://smartwake`)).toBe('/wecker')
  })

  it('ignoriert unbekannte Hosts, fremde Schemes und eingeschleuste Pfade', () => {
    for (const url of ['kein Link', 'https://evening', `${APP_ID}://evening-evil`, `${APP_ID}://login?code=x`, `${APP_ID}://evening/arbeit`, `${APP_ID}://constructor`, `${APP_ID}://__proto__`, `${APP_ID}://toString`]) {
      expect(nativeDestination(url)).toBeUndefined()
    }
  })
})

/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { emptyLocal } from '../src/core/defaults'
import type { GeofenceSnapshot } from '../src/core/geofences'
import type { LocalData } from '../src/core/types'
import { storedRecord } from './helpers/storage'

interface Probe { fine: boolean; background: boolean; emit: boolean; removalError: boolean; permissions: string[]; snapshots: GeofenceSnapshot[] }
const START = new Date('2026-11-06T08:00:00+01:00').getTime()
const visit = { id: 'geo-visit', label: 'Kundenbesuch', date: '2026-11-06', start: 9 * 60, end: 11 * 60, context: 'customer' as const, commitment: 'hard' as const, placeId: 'geo-place', placeLabel: 'Besuchsort', locationKind: 'onsite' as const, travelMin: 20, travelHomeMin: 20 }
const local = (page: Page) => storedRecord<LocalData>(page, 'meta', 'local')
const probe = (page: Page) => page.evaluate(() => (window as unknown as { __geo: Probe }).__geo)

/** Browser simulation of the native contract; no Android permission, location or GMS proof. */
async function prepare(page: Page) {
  await page.clock.setFixedTime(new Date(START))
  await page.addInitScript(({ start }) => {
    const state: Probe = { fine: false, background: false, emit: false, removalError: false, permissions: [], snapshots: [] }
    let snapshot: GeofenceSnapshot = { enabled: false, visits: [] }
    const methods = ['syncGeofences', 'getGeofenceState', 'ackGeofenceSuggestions', 'requestGeofencePermission', 'getAlarmState', 'syncAlarmConfig', 'syncReminders', 'setReminderFocus', 'drainReminderActions', 'ackReminderActions', 'getSmartWakeState', 'updateWidget']
    const status = () => ({ registered: snapshot.enabled && state.fine && state.background ? snapshot.visits.length : 0,
      fineGranted: state.fine, backgroundGranted: state.background,
      suggestions: state.emit && snapshot.enabled && state.fine && state.background ? snapshot.visits.map((item) => ({ id: `suggest:${item.id}`, visitId: item.id, revision: item.revision, at: start })) : [],
      ...(state.removalError && !snapshot.visits.length ? { error: 'removal-unconfirmed' } : {}) })
    Object.assign(window, { __geo: state, CapacitorCustomPlatform: { name: 'web' }, Capacitor: {
      PluginHeaders: [{ name: 'AnkerNative', methods: methods.map((name) => ({ name, rtype: 'promise' })) }],
      async nativePromise(_plugin: string, method: string, options: unknown) {
        if (method === 'syncGeofences') { snapshot = options as GeofenceSnapshot; state.snapshots.push(snapshot); return status() }
        if (method === 'getGeofenceState') return status()
        if (method === 'requestGeofencePermission') { const kind = (options as { kind: string }).kind; state.permissions.push(kind); if (kind === 'foreground') state.fine = true; else state.background = true; return status() }
        if (method === 'getAlarmState' || method === 'syncAlarmConfig') return { ringing: false, snoozed: 0, exact: true, mainConfirmed: true, scheduledAt: start + 86_400_000 }
        if (method === 'drainReminderActions') return { actions: [] }
        if (method === 'getSmartWakeState') return { active: false, phase: 'idle', message: '', targetAt: 0, windowAt: 0, hasMotion: true, microphoneGranted: true }
        return {}
      },
    } })
  }, { start: START })
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await page.evaluate((data) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('records', 'readwrite')
      tx.objectStore('records').put({ collection: 'meta', id: 'local', data, updated_at: Date.now(), deleted: false, dirty: 1 })
      tx.oncomplete = () => { db.close(); resolve() }; tx.onabort = () => { db.close(); reject(tx.error) }
    }
  }), { ...emptyLocal(), commitments: [visit], places: [{ id: 'geo-place', label: 'Besuchsort', latitude: 52, longitude: 13 }] })
  await page.goto('/tag')
  await expect(page.getByText('Optionaler Standorthinweis', { exact: true })).toBeVisible()
}
async function android(page: Page) {
  await page.evaluate(() => { (window as unknown as { CapacitorCustomPlatform: { name: string } }).CapacitorCustomPlatform.name = 'android' })
  await page.getByRole('link', { name: 'Jetzt', exact: true }).click()
  await page.getByRole('link', { name: 'Tag', exact: true }).click()
  await page.getByText('Optionaler Standorthinweis', { exact: true }).click()
}
async function select(page: Page) {
  await page.getByRole('checkbox', { name: /Ich möchte für diesen Besuch/ }).check()
  await page.getByRole('button', { name: 'Für diesen Besuch auswählen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.extras?.geofences?.enabled).toBe(true)
}

test('Standorthinweis bleibt freiwillig, fragt Rechte einzeln und speichert Ankunft erst nach Ja', async ({ page }) => {
  await prepare(page)
  await page.getByText('Optionaler Standorthinweis', { exact: true }).click()
  await expect(page.getByText(/nur in der Android-App/)).toBeVisible()
  expect((await probe(page)).permissions).toEqual([])
  await android(page)
  await expect(page.getByText(/Android und Google Play Dienste verarbeiten/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Für diesen Besuch auswählen', exact: true })).toBeDisabled()
  await page.getByRole('spinbutton', { name: 'Umkreis Kundenbesuch', exact: true }).fill('220')
  await page.getByRole('checkbox', { name: /Ich möchte für diesen Besuch/ }).check()
  await page.getByRole('button', { name: 'Für diesen Besuch auswählen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.extras?.geofences?.visits['geo-visit']?.radiusM).toBe(220)
  expect((await probe(page)).permissions).toEqual([])
  expect(JSON.stringify((await probe(page)).snapshots)).not.toContain('Kundenbesuch')
  await page.getByRole('button', { name: 'Genauen Standort freigeben', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Hintergrundstandort separat freigeben', exact: true })).toBeVisible()
  expect((await probe(page)).permissions).toEqual(['foreground'])
  await page.evaluate(() => { (window as unknown as { __geo: Probe }).__geo.emit = true })
  await page.getByRole('button', { name: 'Hintergrundstandort separat freigeben', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ja, angekommen', exact: true })).toBeVisible()
  expect((await local(page))?.commitments[0]?.arrivedAt).toBeUndefined()
  expect((await local(page))?.workSessions).toEqual([])
  expect((await probe(page)).permissions).toEqual(['foreground', 'background'])
  await page.getByRole('button', { name: 'Ja, angekommen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.commitments[0]?.arrivedAt).toBe(START)
  expect((await local(page))?.workSessions).toEqual([])
  expect((await local(page))?.extras?.geofences).toEqual({ enabled: false, visits: {} })
})

test('Ausschalten bewahrt den Termin und zeigt unbestätigte Android-Entfernung ehrlich', async ({ page }) => {
  await prepare(page); await android(page); await select(page)
  await page.evaluate(() => { (window as unknown as { __geo: Probe }).__geo.removalError = true })
  await page.getByRole('button', { name: 'Standorthinweis entfernen', exact: true }).click()
  await expect.poll(async () => (await local(page))?.extras?.geofences).toEqual({ enabled: false, visits: {} })
  await expect(page.getByText(/Android hat das Entfernen noch nicht bestätigt/)).toBeVisible()
  expect((await local(page))?.commitments).toEqual([visit])
  expect((await probe(page)).snapshots.at(-1)).toEqual({ enabled: false, visits: [] })
  expect((await probe(page)).permissions).toEqual([])
})

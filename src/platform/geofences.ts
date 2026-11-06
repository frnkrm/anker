import { App } from '@capacitor/app'
import { coalesceAsync } from '../core/coalesced'
import { currentGeofenceSuggestion, geofenceSnapshot, geofenceSuggestions, removeGeofenceChoice, type GeofenceSnapshot, type GeofenceStatus, type GeofenceSuggestion } from '../core/geofences'
import { onPlanChange, useApp } from '../state/store'
import { AnkerNative, isNative } from './native'

// TS und Kotlin verwenden den gemeinsamen, bereits validierten nativen Wirevertrag.
const bridge = AnkerNative
export interface GeofenceViewState extends GeofenceStatus { suggestions: GeofenceSuggestion[] }
const INITIAL: GeofenceViewState = { registered: 0, fineGranted: false, backgroundGranted: false, suggestions: [], available: false }
let status: GeofenceViewState = INITIAL
let appliedKey: string | undefined
const listeners = new Set<() => void>()
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const current = () => geofenceSnapshot(useApp.getState().local, Date.now())
const key = (snapshot: GeofenceSnapshot) => JSON.stringify(snapshot)

function publish(next: GeofenceViewState) {
  if (JSON.stringify(next) === JSON.stringify(status)) return
  status = next
  listeners.forEach((listener) => listener())
}

function view(value: unknown, snapshot: GeofenceSnapshot): GeofenceViewState {
  if (!object(value) || !Number.isInteger(value.registered) || Number(value.registered) < 0 || Number(value.registered) > 20
    || typeof value.fineGranted !== 'boolean' || typeof value.backgroundGranted !== 'boolean') return { ...INITIAL, error: 'native-unavailable' }
  const safeErrors = ['invalid-snapshot', 'foreground-permission-required', 'background-permission-required', 'permission-required', 'location-service-unavailable', 'location-disabled', 'storage-unavailable', 'removal-unconfirmed', 'registration-unconfirmed', 'unlock-required']
  return {
    registered: value.updating === true ? 0 : Number(value.registered), fineGranted: value.fineGranted, backgroundGranted: value.backgroundGranted,
    available: value.available !== false, enabled: snapshot.enabled, updating: value.updating === true,
    suggestions: geofenceSuggestions(Array.isArray(value.suggestions) ? value.suggestions : [], snapshot, Date.now()),
    ...(typeof value.error === 'string' ? { error: safeErrors.includes(value.error) ? value.error : 'native-unavailable' } : {}),
  }
}

/** Ein gemeinsamer serialisierter Abgleich, auch für direkte UI-Aufrufe. Keine Berechtigungsanfrage darin. */
const reconcile = coalesceAsync(async () => {
  if (!isNative()) { publish(INITIAL); return }
  for (;;) {
    const snapshot = current()
    const sent = key(snapshot)
    try {
      await bridge.syncGeofences(snapshot)
      if (key(current()) !== sent) continue
      const result = await bridge.getGeofenceState()
      if (key(current()) !== sent) continue
      publish(view(result, snapshot))
      appliedKey = sent
      return
    } catch {
      if (key(current()) !== sent) continue
      publish({ ...INITIAL, enabled: snapshot.enabled, error: 'native-unavailable' })
      appliedKey = sent
      return
    }
  }
})

export function geofenceViewState(): GeofenceViewState { return status }
export function subscribeGeofences(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener) } }
export function refreshGeofences(force = true): Promise<void> {
  publish({ ...status, suggestions: geofenceSuggestions(status.suggestions, current(), Date.now()) })
  if (!force && appliedKey === key(current())) return Promise.resolve()
  return reconcile()
}

/** Nur dieser bewusst angetippte Weg darf einen Android-Dialog bzw. die Systemeinstellung öffnen. */
export async function requestGeofencePermission(kind: 'foreground' | 'background'): Promise<void> {
  if (!isNative()) return
  try { await bridge.requestGeofencePermission({ kind }); await refreshGeofences() }
  catch { publish({ ...status, error: 'native-unavailable' }) }
}

/** Globale App-Lifecyclebindung; native Expiration wirkt auch bei geschlossener WebView. */
export function listenGeofences(): () => void {
  if (!isNative()) return () => {}
  let disposed = false
  let foreground = typeof document === 'undefined' || document.visibilityState !== 'hidden'
  let timer: ReturnType<typeof setTimeout> | undefined
  let nativeRemove: (() => Promise<void>) | undefined
  const update = async (force: boolean) => {
    if (disposed) return
    await refreshGeofences(force)
    if (disposed) return
    clearTimeout(timer)
    if (!foreground) return
    const now = Date.now()
    const boundary = current().visits.flatMap((visit) => [visit.startsAt, visit.expiresAt]).filter((at) => at > now).sort((a, b) => a - b)[0]
    // Nur gespeicherte Android-Hinweise lesen, keine Standortabfrage. Hintergrund bleibt ohne Timer.
    const readIn = current().visits.length ? 60_000 : undefined
    const wait = Math.min(boundary === undefined ? Infinity : Math.max(500, boundary - now + 100), readIn ?? Infinity)
    if (Number.isFinite(wait)) timer = setTimeout(() => { void update(true) }, Math.min(2_147_483_647, wait))
  }
  const unsubscribe = onPlanChange(() => { void update(false) })
  void App.addListener('appStateChange', ({ isActive }) => {
    foreground = isActive
    if (isActive) void update(true)
    else clearTimeout(timer)
  }).then((handle) => {
    if (disposed) void handle.remove()
    else nativeRemove = () => handle.remove()
  }).catch(() => {})
  void update(true)
  return () => { disposed = true; clearTimeout(timer); unsubscribe(); void nativeRemove?.() }
}

/** Wiederholte Revisionprüfung erfolgt IN der atomaren SaveLocal-Aktion gegen den jüngsten Record. */
export async function answerGeofenceSuggestion(suggestion: GeofenceSuggestion, arrived: boolean): Promise<boolean> {
  let accepted = false
  await useApp.getState().saveLocal((local) => {
    const now = Date.now()
    if (!currentGeofenceSuggestion(suggestion, geofenceSnapshot(local, now), now)) return local
    const next = removeGeofenceChoice(local, suggestion.visitId)
    if (arrived) next.commitments = next.commitments.map((commitment) => commitment.id === suggestion.visitId
      ? { ...commitment, arrivedAt: now } : commitment)
    accepted = true
    return next
  })
  if (!accepted) return false
  if (isNative()) {
    try { await bridge.ackGeofenceSuggestions({ ids: [suggestion.id] }) } catch { /* echte Nutzereingabe niemals zurückrollen */ }
    await refreshGeofences()
  }
  return true
}


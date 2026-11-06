import { useEffect, useSyncExternalStore } from 'react'
import { geofenceViewState, listenGeofences, subscribeGeofences } from '../platform/geofences'

/** Einmal nach dem erfolgreichen Storeload mounten, nicht auf jeder Unterseite neue Abgleiche starten. */
export function useGeofenceLifecycle() { useEffect(() => listenGeofences(), []) }
export function useGeofenceState() { return useSyncExternalStore(subscribeGeofences, geofenceViewState, geofenceViewState) }

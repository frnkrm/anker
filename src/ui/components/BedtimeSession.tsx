import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { App } from '@capacitor/app'
import { BedtimeNative, bedtimePromptSupported, type BedtimePromptState } from '../../platform/bedtimePrompt'

/** One read-only native observer and action barrier for all pieces of Now. */
function useNativeSession() {
  const supported = bedtimePromptSupported()
  const [state, setState] = useState<BedtimePromptState>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false), foreground = useRef(true), epoch = useRef(0), alive = useRef(true)
  const latest = useRef<BedtimePromptState | undefined>(undefined)
  const refresh = useRef<((force?: boolean) => Promise<void>) | undefined>(undefined)
  const flush = useRef<(() => void) | undefined>(undefined)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (!supported) return
    let active = true, reading: number | undefined, queued = false
    const flushQueued = () => { if (queued && active && !pending.current && reading === undefined) { queued = false; void read() } }
    const read = async (force = false, queueOnBusy = true) => {
      if ((pending.current || reading !== undefined) && !force) { if (queueOnBusy) queued = true; return }
      const request = ++epoch.current
      reading = request; queued = false
      try {
        const value = await BedtimeNative.getBedtimePromptState()
        if (active && request === epoch.current && !queued) { latest.current = value; setState(value); setError('') }
      } catch {
        if (active && request === epoch.current && !queued) setError('Der Schlafhinweis-Status konnte nicht gelesen werden. Prüfe die installierte App-Version oder versuche es erneut.')
      } finally { if (reading === request) { reading = undefined; flushQueued() } }
    }
    refresh.current = read; flush.current = flushQueued
    void read()
    const visible = () => { if (document.visibilityState === 'visible' && foreground.current) void read() }
    document.addEventListener('visibilitychange', visible); window.addEventListener('focus', visible)
    // Display refresh only. All deadlines, notifications and sleep boundaries are native.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && foreground.current && ['waiting', 'quiet'].includes(latest.current?.phase ?? '')) void read(false, false)
    }, 2000)
    const appListener = App.addListener('appStateChange', ({ isActive }) => { foreground.current = isActive; if (isActive) visible() })
    const listener = BedtimeNative.addListener('bedtimePromptChanged', visible)
    void appListener.catch(() => undefined); void listener.catch(() => undefined)
    return () => {
      active = false; refresh.current = undefined; flush.current = undefined
      clearInterval(interval); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', visible)
      void listener.then(handle => handle.remove(), () => undefined); void appListener.then(handle => handle.remove(), () => undefined)
    }
  }, [supported])
  const run = async (action: () => Promise<void>, options: { allowWeb?: boolean; failure?: string; refresh?: boolean } = {}) => {
    if (pending.current || !supported && !options.allowWeb) return
    pending.current = true; ++epoch.current; setBusy(true); setError('')
    try { await action(); if (options.refresh !== false) await refresh.current?.(true) }
    catch { if (alive.current) setError(options.failure ?? 'Der Schlafhinweis konnte nicht sicher aktualisiert werden. Bitte versuche es erneut.') }
    finally { pending.current = false; if (alive.current) setBusy(false); flush.current?.() }
  }
  return { supported, state, busy, error, setError, pending, foreground, run, refresh }
}
const Context = createContext<ReturnType<typeof useNativeSession> | null>(null)
export function BedtimeSessionProvider({ children }: { children: ReactNode }) {
  const session = useNativeSession()
  return <Context value={session}>{children}</Context>
}
export function useBedtimeSession() {
  const session = useContext(Context)
  if (!session) throw new Error('Die Schlafhinweisansicht benötigt ihren gemeinsamen Status.')
  return session
}

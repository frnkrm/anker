import { App as CapApp } from '@capacitor/app'
import { lazy, Suspense, useEffect, useEffectEvent, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { startEffects } from './platform/effects'
import { refreshCalendar, writeAnkerBlocks } from './platform/google'
import { AnkerNative, isNative, safe } from './platform/native'
import { nativeDestination } from './platform/links'
import { hasHandledMorningHandoff, resumeGuidanceHandoff } from './platform/guidance'
import { listenForAuthLinks, syncNow } from './platform/supabase'
import { useApp } from './state/store'
import { useGeofenceLifecycle } from './state/useGeofences'
import { InboxSheet, Shell } from './ui/components/Shell'
import { Button } from './ui/components/ui'
import { GuidanceRuntime } from './ui/components/GuidanceRuntime'
import Now from './ui/pages/Now'

const Onboarding = lazy(() => import('./ui/pages/Onboarding'))
const Focus = lazy(() => import('./ui/pages/Focus'))
const TaskFocus = lazy(() => import('./ui/pages/TaskFocus'))
const QuickRecovery = lazy(() => import('./ui/pages/QuickEntries').then((module) => ({ default: module.QuickRecovery })))
const QuickFocus = lazy(() => import('./ui/pages/QuickEntries').then((module) => ({ default: module.QuickFocus })))
const Day = lazy(() => import('./ui/pages/Day'))
const WorkHub = lazy(() => import('./ui/pages/Hubs').then((module) => ({ default: module.WorkHub })))
const EveningHub = lazy(() => import('./ui/pages/Hubs').then((module) => ({ default: module.EveningHub })))
const GameHub = lazy(() => import('./ui/pages/Hubs').then((module) => ({ default: module.GameHub })))
const ReviewHub = lazy(() => import('./ui/pages/Hubs').then((module) => ({ default: module.ReviewHub })))
const AlarmHub = lazy(() => import('./ui/pages/Hubs').then((module) => ({ default: module.AlarmHub })))
const Inbox = lazy(() => import('./ui/pages/Inbox'))
const More = lazy(() => import('./ui/pages/More'))
const NfcAnchors = lazy(() => import('./ui/pages/NfcAnchors'))
const RhythmWeek = lazy(() => import('./ui/pages/RhythmWeek'))
const WindDown = lazy(() => import('./ui/pages/WindDown'))
const Settings = lazy(() => import('./ui/pages/Settings'))
const AssistanceSettings = lazy(() => import('./ui/pages/AssistanceSettings'))
const Places = lazy(() => import('./ui/pages/Places'))
const Check = lazy(() => import('./ui/pages/Check'))
const TimeOverview = lazy(() => import('./ui/pages/TimeOverview'))
const DeviceTests = lazy(() => import('./ui/pages/DeviceTests'))
const Diagnostics = lazy(() => import('./ui/pages/Diagnostics'))
const PcStop = lazy(() => import('./ui/pages/PcStop'))
const Connections = lazy(() => import('./ui/pages/Connections'))
const Food = lazy(() => import('./ui/pages/Daily').then((m) => ({ default: m.Food })))
const Tidy = lazy(() => import('./ui/pages/Daily').then((m) => ({ default: m.Tidy })))
const Prep = lazy(() => import('./ui/pages/Daily').then((m) => ({ default: m.Prep })))
const AlarmRinging = lazy(() => import('./ui/pages/Alarm').then((m) => ({ default: m.AlarmRinging })))
const Help = lazy(() => import('./ui/pages/Static').then((m) => ({ default: m.Help })))
const Backup = lazy(() => import('./ui/pages/Static').then((m) => ({ default: m.Backup })))
const Print = lazy(() => import('./ui/pages/Static').then((m) => ({ default: m.Print })))

// Netz-Extras gedrosselt: Sync höchstens jede Minute, Kalender alle 15 Minuten
let lastSync = 0
let lastCalendar = 0

function useAppearance() {
  const { dark, fontScale } = useApp((s) => s.settings.appearance)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.setProperty('--font-scale', String(fontScale))
    if (!document.documentElement.dataset.guidanceTheme) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1115' : '#f6f5f1')
  }, [dark, fontScale])
}

/** Native Einstiege: Wecker klingelt, Widget-Knopf „Gedanke“. */
function NativeBridge() {
  const nav = useNavigate()
  const location = useLocation()
  const openDestination = useEffectEvent((destination: string) => nav(destination))
  const currentRouteKey = useEffectEvent(() => location.key)
  useEffect(() => {
    if (!isNative()) return
    let active = true
    let entryVersion = 0
    let startupNavigated = false
    const startupVersion = entryVersion
    const startupRoute = currentRouteKey()
    // Start before awaiting the launch link: Android may return that old link much later.
    const initialHandoff = resumeGuidanceHandoff().catch(() => false)
    const openStartup = async (url?: string) => {
      const recovered = await initialHandoff
      const ringing = await safe(async () => (await AnkerNative.getAlarmState()).ringing, undefined)
      if (!active || startupVersion !== entryVersion) return
      if (ringing) openDestination('/wecker/klingelt')
      else if (startupNavigated || currentRouteKey() !== startupRoute) return
      else if (recovered) {
        startupNavigated = true
        openDestination('/fokus/morning')
      } else if (!hasHandledMorningHandoff() && url) {
        const destination = nativeDestination(url)
        if (destination) openDestination(destination)
      }
    }
    const openExplicit = async (url: string) => {
      const version = ++entryVersion
      const ringing = await safe(async () => (await AnkerNative.getAlarmState()).ringing, undefined)
      if (!active || version !== entryVersion) return
      if (ringing) openDestination('/wecker/klingelt')
      else {
        const destination = nativeDestination(url)
        if (destination) openDestination(destination)
      }
    }
    const recoverVisible = async () => {
      if (document.visibilityState !== 'visible') return
      const version = ++entryVersion
      const route = currentRouteKey()
      const recovered = await resumeGuidanceHandoff().catch(() => false)
      const ringing = await safe(async () => (await AnkerNative.getAlarmState()).ringing, undefined)
      if (!active || version !== entryVersion) return
      if (ringing) openDestination('/wecker/klingelt')
      else if (recovered && currentRouteKey() === route) openDestination('/fokus/morning')
    }
    void openStartup()
    void safe(async () => {
      const launch = await safe(() => CapApp.getLaunchUrl(), undefined)
      if (launch?.url) await openStartup(launch.url)
    }, undefined)
    const subs = [
      AnkerNative.addListener('alarmRinging', () => {
        if (!active) return
        entryVersion++
        openDestination('/wecker/klingelt')
      }),
      CapApp.addListener('appUrlOpen', ({ url }) => void openExplicit(url)),
    ]
    document.addEventListener('visibilitychange', recoverVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', recoverVisible)
      subs.forEach((p) => void p.then((h) => h.remove()))
    }
    // Nur dieser Einstieg entscheidet über Navigation. Spätere echte Klicks und Alarme
    // überholen alte Antworten; gewöhnliche Seitenwechsel lesen keinen Startlink neu.
  }, [])
  return null
}

function QuickThought() {
  const nav = useNavigate()
  return <InboxSheet open onClose={() => nav('/', { replace: true })} />
}

function GeofenceLifecycle() {
  useGeofenceLifecycle()
  return null
}

function Home() {
  const onboarded = useApp((s) => s.settings.onboarded)
  return onboarded ? <Now /> : <Navigate to="/start" replace />
}

/** Der Datenbestand wird bei einem Ladefehler nicht durch einen leeren RAM-Erfolg ersetzt. */
function StorageRecovery({ onRetry }: { onRetry: () => void }) {
  const [ringing, setRinging] = useState<boolean>()
  const [stopping, setStopping] = useState(false)
  const [stopError, setStopError] = useState(false)
  useEffect(() => {
    if (!isNative()) return
    let active = true
    void AnkerNative.getAlarmState().then((state) => { if (active) setRinging(typeof state.ringing === 'boolean' ? state.ringing : undefined) }).catch(() => undefined)
    const listener = AnkerNative.addListener('alarmRinging', () => { if (active) setRinging(true) })
    return () => { active = false; void listener.then((handle) => handle.remove()).catch(() => undefined) }
  }, [])
  return <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-5 py-8 safe-top">
    <h1 className="text-2xl font-semibold">Daten gerade nicht erreichbar</h1>
    <p role="alert">Anker konnte deine gespeicherten Daten noch nicht sicher laden. Es wurde nichts zurückgesetzt.</p>
    <p className="text-muted">Versuche es erneut. Deine bisherigen Angaben bleiben erhalten.</p>
    <Button variant="primary" size="lg" onClick={onRetry}>Erneut versuchen</Button>
    {isNative() && ringing !== false && <div className="space-y-3 rounded-2xl border border-line p-4">
      <p role="status">{ringing ? 'Dein Wecker klingelt. Du kannst ihn hier im Notfall beenden.' : 'Der Weckerstatus ist gerade nicht abrufbar. Der Notfallstopp bleibt erreichbar.'}</p>
      <Button variant="warm" className="w-full" disabled={stopping} onClick={async () => {
        setStopping(true); setStopError(false)
        try { const state = await AnkerNative.stopAlarm({ method: 'emergency' }); setRinging(typeof state.ringing === 'boolean' ? state.ringing : undefined) }
        catch { setStopError(true) }
        finally { setStopping(false) }
      }}>Wecker im Notfall beenden</Button>
      {stopError && <p role="alert">Der Wecker konnte noch nicht beendet werden. Du kannst es erneut versuchen.</p>}
    </div>}
  </main>
}

export default function App() {
  const ready = useApp((s) => s.ready)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useAppearance()

  useEffect(() => {
    let active = true
    void useApp
      .getState()
      .load()
      .then(() => {
        if (!active) return
        setLoading(false)
        listenForAuthLinks()
        startEffects({
          sync: async () => {
            const now = Date.now()
            if (useApp.getState().settings.integrations.sync && now - lastSync > 60_000) {
              lastSync = now
              await syncNow()
            }
            if (now - lastCalendar > 15 * 60_000) {
              lastCalendar = now
              await refreshCalendar()
              await writeAnkerBlocks()
            }
          },
        })
      })
      .catch(() => { if (active) { setLoading(false); setLoadError(true) } })
    return () => { active = false }
  }, [attempt])

  if (loadError) return <StorageRecovery onRetry={() => { setLoadError(false); setLoading(true); setAttempt((current) => current + 1) }} />
  if (loading || !ready) return <div className="min-h-dvh bg-bg" aria-busy="true" aria-label="Gespeicherte Daten laden" />

  return (
    <BrowserRouter>
      <NativeBridge />
      <GeofenceLifecycle />
      <GuidanceRuntime />
      <Shell>
        <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/start" element={<Onboarding />} />
            <Route path="/fokus/:routine" element={<Focus />} />
            <Route path="/aufgabe/:kind/:id" element={<TaskFocus />} />
            <Route path="/tag" element={<Day />} />
            <Route path="/arbeit" element={<WorkHub />} />
            <Route path="/arbeitszeit" element={<WorkHub />} />
            <Route path="/orte" element={<Places />} />
            <Route path="/spiel" element={<GameHub />} />
            <Route path="/spiel/shop" element={<GameHub />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/gedanke" element={<QuickThought />} />
            <Route path="/wiedereinstieg" element={<QuickRecovery />} />
            <Route path="/fokus-start" element={<QuickFocus />} />
            <Route path="/mehr" element={<More />} />
            <Route path="/anker" element={<NfcAnchors />} />
            <Route path="/abend" element={<EveningHub />} />
            <Route path="/rhythmus" element={<RhythmWeek />} />
            <Route path="/schlaf" element={<AlarmHub />} />
            <Route path="/einstellungen/abenduebergang" element={<WindDown />} />
            <Route path="/einstellungen/assistenz" element={<AssistanceSettings />} />
            <Route path="/einstellungen" element={<Settings />} />
            <Route path="/einstellungen/:section" element={<Settings />} />
            <Route path="/essen" element={<Food />} />
            <Route path="/aufraeumen" element={<Tidy />} />
            <Route path="/vorbereitung" element={<Prep />} />
            <Route path="/rueckblick" element={<ReviewHub />} />
            <Route path="/check" element={<Check />} />
            <Route path="/zeiten" element={<TimeOverview />} />
            <Route path="/geraetetest" element={<DeviceTests />} />
            <Route path="/diagnose" element={<Diagnostics />} />
            <Route path="/wecker" element={<AlarmHub />} />
            <Route path="/wecker/klingelt" element={<AlarmRinging />} />
            <Route path="/pc-stopp" element={<PcStop />} />
            <Route path="/verbindungen" element={<Connections />} />
            <Route path="/druck" element={<Print />} />
            <Route path="/hilfe" element={<Help />} />
            <Route path="/backup" element={<Backup />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Shell>
    </BrowserRouter>
  )
}

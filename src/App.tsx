import { App as CapApp } from '@capacitor/app'
import { lazy, Suspense, useEffect, useEffectEvent, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router'
import { startEffects } from './platform/effects'
import { refreshCalendar, writeAnkerBlocks } from './platform/google'
import { AnkerNative, isNative, safe } from './platform/native'
import { nativeDestination } from './platform/links'
import { listenForAuthLinks, syncNow } from './platform/supabase'
import { useApp } from './state/store'
import { useGeofenceLifecycle } from './state/useGeofences'
import { InboxSheet, Shell } from './ui/components/Shell'
import { Button } from './ui/components/ui'
import Now from './ui/pages/Now'

const Onboarding = lazy(() => import('./ui/pages/Onboarding'))
const Focus = lazy(() => import('./ui/pages/Focus'))
const TaskFocus = lazy(() => import('./ui/pages/TaskFocus'))
const QuickRecovery = lazy(() => import('./ui/pages/QuickEntries').then((module) => ({ default: module.QuickRecovery })))
const QuickFocus = lazy(() => import('./ui/pages/QuickEntries').then((module) => ({ default: module.QuickFocus })))
const Day = lazy(() => import('./ui/pages/Day'))
const Game = lazy(() => import('./ui/pages/Game'))
const Shop = lazy(() => import('./ui/pages/Shop'))
const Inbox = lazy(() => import('./ui/pages/Inbox'))
const More = lazy(() => import('./ui/pages/More'))
const Evening = lazy(() => import('./ui/pages/Evening'))
const SleepDiary = lazy(() => import('./ui/pages/SleepDiary'))
const WindDown = lazy(() => import('./ui/pages/WindDown'))
const Settings = lazy(() => import('./ui/pages/Settings'))
const AssistanceSettings = lazy(() => import('./ui/pages/AssistanceSettings'))
const Work = lazy(() => import('./ui/pages/Work'))
const WorkTime = lazy(() => import('./ui/pages/WorkTime'))
const Places = lazy(() => import('./ui/pages/Places'))
const Check = lazy(() => import('./ui/pages/Check'))
const TimeOverview = lazy(() => import('./ui/pages/TimeOverview'))
const DeviceTests = lazy(() => import('./ui/pages/DeviceTests'))
const PcStop = lazy(() => import('./ui/pages/PcStop'))
const Connections = lazy(() => import('./ui/pages/Connections'))
const Food = lazy(() => import('./ui/pages/Daily').then((m) => ({ default: m.Food })))
const Tidy = lazy(() => import('./ui/pages/Daily').then((m) => ({ default: m.Tidy })))
const Prep = lazy(() => import('./ui/pages/Daily').then((m) => ({ default: m.Prep })))
const Review = lazy(() => import('./ui/pages/Daily').then((m) => ({ default: m.Review })))
const AlarmSetup = lazy(() => import('./ui/pages/Alarm').then((m) => ({ default: m.AlarmSetup })))
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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1115' : '#f6f5f1')
  }, [dark, fontScale])
}

/** Native Einstiege: Wecker klingelt, Widget-Knopf „Gedanke“. */
function NativeBridge() {
  const nav = useNavigate()
  const openDestination = useEffectEvent((destination: string) => nav(destination))
  useEffect(() => {
    if (!isNative()) return
    let active = true
    let alarmVersion = 0
    const open = async (url?: string) => {
      const version = alarmVersion
      const ringing = await safe(async () => (await AnkerNative.getAlarmState()).ringing, undefined)
      if (!active || version !== alarmVersion) return
      if (ringing) openDestination('/wecker/klingelt')
      else if (url) {
        const destination = nativeDestination(url)
        if (destination) openDestination(destination)
      }
    }
    void open()
    void safe(async () => {
      const launch = await safe(() => CapApp.getLaunchUrl(), undefined)
      if (launch?.url) await open(launch.url)
    }, undefined)
    const subs = [
      AnkerNative.addListener('alarmRinging', () => {
        if (!active) return
        alarmVersion++
        openDestination('/wecker/klingelt')
      }),
      CapApp.addListener('appUrlOpen', ({ url }) => void open(url)),
    ]
    return () => {
      active = false
      subs.forEach((p) => void p.then((h) => h.remove()))
    }
    // Android behält den Startlink. Seitenwechsel dürfen ihn nicht erneut öffnen;
    // das Effect Event verwendet trotzdem die aktuelle Router-Navigation.
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
      <Shell>
        <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/start" element={<Onboarding />} />
            <Route path="/fokus/:routine" element={<Focus />} />
            <Route path="/aufgabe/:kind/:id" element={<TaskFocus />} />
            <Route path="/tag" element={<Day />} />
            <Route path="/arbeit" element={<Work />} />
            <Route path="/arbeitszeit" element={<WorkTime />} />
            <Route path="/orte" element={<Places />} />
            <Route path="/spiel" element={<Game />} />
            <Route path="/spiel/shop" element={<Shop />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/gedanke" element={<QuickThought />} />
            <Route path="/wiedereinstieg" element={<QuickRecovery />} />
            <Route path="/fokus-start" element={<QuickFocus />} />
            <Route path="/mehr" element={<More />} />
            <Route path="/abend" element={<Evening />} />
            <Route path="/schlaf" element={<SleepDiary />} />
            <Route path="/einstellungen/abenduebergang" element={<WindDown />} />
            <Route path="/einstellungen/assistenz" element={<AssistanceSettings />} />
            <Route path="/einstellungen" element={<Settings />} />
            <Route path="/einstellungen/:section" element={<Settings />} />
            <Route path="/essen" element={<Food />} />
            <Route path="/aufraeumen" element={<Tidy />} />
            <Route path="/vorbereitung" element={<Prep />} />
            <Route path="/rueckblick" element={<Review />} />
            <Route path="/check" element={<Check />} />
            <Route path="/zeiten" element={<TimeOverview />} />
            <Route path="/geraetetest" element={<DeviceTests />} />
            <Route path="/wecker" element={<AlarmSetup />} />
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

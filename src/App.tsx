import { App as CapApp } from '@capacitor/app'
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router'
import { APP_ID } from '../app.config'
import { startEffects } from './platform/effects'
import { refreshCalendar, writeAnkerBlocks } from './platform/google'
import { AnkerNative, isNative, safe } from './platform/native'
import { listenForAuthLinks, syncNow } from './platform/supabase'
import { useApp } from './state/store'
import { InboxSheet, Shell } from './ui/components/Shell'
import Now from './ui/pages/Now'

const Onboarding = lazy(() => import('./ui/pages/Onboarding'))
const Focus = lazy(() => import('./ui/pages/Focus'))
const Day = lazy(() => import('./ui/pages/Day'))
const Game = lazy(() => import('./ui/pages/Game'))
const Shop = lazy(() => import('./ui/pages/Shop'))
const Inbox = lazy(() => import('./ui/pages/Inbox'))
const More = lazy(() => import('./ui/pages/More'))
const Settings = lazy(() => import('./ui/pages/Settings'))
const Check = lazy(() => import('./ui/pages/Check'))
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
  useEffect(() => {
    if (!isNative()) return
    void safe(async () => {
      if ((await AnkerNative.getAlarmState()).ringing) nav('/wecker/klingelt')
    }, undefined)
    const subs = [
      AnkerNative.addListener('alarmRinging', () => nav('/wecker/klingelt')),
      CapApp.addListener('appUrlOpen', ({ url }) => {
        if (url.startsWith(`${APP_ID}://inbox`)) nav('/gedanke')
        else if (url.startsWith(`${APP_ID}://alarm`)) nav('/wecker/klingelt')
        else if (url.startsWith(`${APP_ID}://now`)) nav('/')
      }),
    ]
    return () => subs.forEach((p) => void p.then((h) => h.remove()))
  }, [nav])
  return null
}

function QuickThought() {
  const nav = useNavigate()
  return <InboxSheet open onClose={() => nav('/', { replace: true })} />
}

function Home() {
  const onboarded = useApp((s) => s.settings.onboarded)
  return onboarded ? <Now /> : <Navigate to="/start" replace />
}

export default function App() {
  const ready = useApp((s) => s.ready)
  useAppearance()

  useEffect(() => {
    void useApp
      .getState()
      .load()
      .then(() => {
        listenForAuthLinks()
        startEffects({
          sync: async () => {
            const now = Date.now()
            if (now - lastSync > 60_000) {
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
  }, [])

  if (!ready) return <div className="min-h-dvh bg-bg" aria-busy="true" />

  return (
    <BrowserRouter>
      <NativeBridge />
      <Shell>
        <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/start" element={<Onboarding />} />
            <Route path="/fokus/:routine" element={<Focus />} />
            <Route path="/tag" element={<Day />} />
            <Route path="/spiel" element={<Game />} />
            <Route path="/spiel/shop" element={<Shop />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/gedanke" element={<QuickThought />} />
            <Route path="/mehr" element={<More />} />
            <Route path="/einstellungen" element={<Settings />} />
            <Route path="/einstellungen/:section" element={<Settings />} />
            <Route path="/essen" element={<Food />} />
            <Route path="/aufraeumen" element={<Tidy />} />
            <Route path="/vorbereitung" element={<Prep />} />
            <Route path="/rueckblick" element={<Review />} />
            <Route path="/check" element={<Check />} />
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

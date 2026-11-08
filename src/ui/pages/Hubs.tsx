import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { balance, levelFor, theme } from '../../core/game'
import { fmtDuration, fmtTime, utcToZoned } from '../../core/time'
import { dayActual, needsWorkConfirmation } from '../../core/worktime'
import { useNow, useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { Button, Card, Page, Progress, Segmented } from '../components/ui'
import Work from './Work'
import WorkTime from './WorkTime'
import Evening from './Evening'
import { Prep, Review } from './Daily'
import Game from './Game'
import Shop from './Shop'
import SleepDiary from './SleepDiary'
import TimeOverview from './TimeOverview'
import { AlarmSetup } from './Alarm'

/** Uses the same persisted sessions and actions as the detailed work page. */
function WorkTracker() {
  const st = useApp()
  const { date } = useToday()
  const now = useNow(30_000)
  const session = st.local.workSessions.find((item) => item.endAt === undefined)
  const current = dayActual(st.local.workSessions, session?.date ?? date, now)
  const old = session && needsWorkConfirmation(session, now)
  const paused = session?.breaks.some((item) => item.endAt === undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError('')
    try { await action() } catch { setError('Die Arbeitszeit konnte noch nicht gespeichert werden. Bitte versuche es erneut.') }
    finally { setBusy(false) }
  }
  return <aside aria-label="Arbeitszeit im Überblick" className="sticky top-0 z-20 rounded-2xl border border-line bg-bg p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0"><p className="font-medium">{old ? 'Offenen Abschnitt prüfen' : session ? paused ? 'Arbeitspause' : `Arbeit seit ${fmtTime(utcToZoned(session.startAt).minutes)}` : 'Arbeit noch nicht gestartet'}</p><p className="text-sm text-muted">{current.unconfirmed ? 'Zeiten noch unbestätigt' : `${fmtDuration(current.netMin)} erfasst`}</p></div>
      {old ? <Link className="flex min-h-11 items-center text-accent" to="/arbeitszeit">Prüfen</Link> : <div className="flex flex-wrap gap-2">
        {!session && <Button disabled={busy} size="sm" onClick={() => void run(() => st.workStart())}>Arbeit starten</Button>}
        {session && <Button disabled={busy} size="sm" onClick={() => void run(paused ? st.workBreakEnd : st.workBreakStart)}>{paused ? 'Pause beenden' : 'Pause starten'}</Button>}
        {session && <Button disabled={busy} size="sm" onClick={() => void run(st.workStop)}>{session.kind === 'regular' ? 'Feierabend' : 'Einsatz beenden'}</Button>}
      </div>}
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-warm">{error}</p>}
  </aside>
}

export function WorkHub() {
  const location = useLocation()
  const nav = useNavigate()
  const time = location.pathname === '/arbeitszeit'
  return <Page title="Arbeit" back="/mehr">
    <WorkTracker />
    <Segmented label="Arbeitsbereich" value={time ? 'time' : 'tasks'} onChange={(value) => nav(value === 'time' ? '/arbeitszeit' : '/arbeit')} options={[{ value: 'tasks', label: 'Aufgaben' }, { value: 'time', label: 'Zeit' }]} />
    {time ? <WorkTime embedded /> : <Work embedded />}
  </Page>
}

export function EveningHub() {
  const [params, setParams] = useSearchParams()
  const [initial] = useState(() => utcToZoned(Date.now()).minutes < 14 * 60 ? 'morning' : 'evening')
  const [prepOpen, setPrepOpen] = useState(false)
  const tab = params.get('ansicht') === 'morning' ? 'morning' : params.get('ansicht') === 'evening' ? 'evening' : initial
  return <Page title="Abend & Alltag" back="/mehr">
    <Segmented label="Routinebereich" value={tab} onChange={(value) => setParams({ ansicht: value })} options={[{ value: 'morning', label: 'Morgen' }, { value: 'evening', label: 'Abend & Vorbereitung' }]} />
    <div className="grid grid-cols-2 gap-2" aria-label="Alltag öffnen">
      {[['/essen', 'Essen'], ['/aufraeumen', 'Aufräumen'], ['/vorbereitung', 'Vorbereitung'], ['/pc-stopp', 'PC-Stopp']].map(([to, label]) => <Link key={to} to={to!} className="flex min-h-12 items-center justify-center rounded-xl bg-surface-2 px-2 py-2 text-center text-sm [overflow-wrap:anywhere]">{label}</Link>)}
    </div>
    {tab === 'morning' ? <Card className="space-y-3"><h2 className="text-xl font-semibold">Dein Morgen</h2><p className="text-muted">Ein Schritt nach dem anderen. Die kleine Version zählt auch.</p><Link to="/fokus/morning" className="flex min-h-16 items-center justify-center rounded-2xl bg-accent px-4 text-lg font-semibold text-accent-ink">Morgenroutine öffnen</Link><Link to="/einstellungen/morgenroutine" className="flex min-h-11 items-center text-muted underline">Routine anpassen</Link></Card> : <>
      <Card className="space-y-3"><h2 className="text-xl font-semibold">Dein Abend</h2><Link to="/fokus/evening" className="flex min-h-16 items-center justify-center rounded-2xl bg-accent px-4 text-lg font-semibold text-accent-ink">Abendroutine öffnen</Link><Link to="/einstellungen/abend" className="flex min-h-11 items-center text-muted underline">Abend anpassen</Link></Card>
      <details open={prepOpen} onToggle={(event) => setPrepOpen(event.currentTarget.open)} className="rounded-2xl border border-line p-3"><summary className="min-h-11 py-2 font-medium">Für morgen vorbereiten</summary>{prepOpen && <div className="pt-3"><Prep embedded /></div>}</details>
    </>}
    <Evening embedded />
  </Page>
}

export function GameHub() {
  const st = useApp()
  const location = useLocation()
  const nav = useNavigate()
  const rewards = location.pathname === '/spiel/shop'
  const t = theme(st.settings.themeId)
  const level = levelFor(st.game.xp, t)
  return <Page title={`${t.emoji} Spiel & Belohnungen`} back="/mehr">
    <Card className="space-y-2"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold">Level {level.level} · {level.name}</p><p className="tabular-nums">{balance(st.game)} {t.xpWord}</p></div><Progress label="Fortschritt zum nächsten Level" value={level.progress} /></Card>
    <Segmented label="Spielbereich" value={rewards ? 'rewards' : 'game'} onChange={(value) => nav(value === 'rewards' ? '/spiel/shop' : '/spiel')} options={[{ value: 'game', label: 'Spiel & Fortschritt' }, { value: 'rewards', label: 'Belohnungen' }]} />
    {rewards ? <Shop embedded /> : <Game embedded />}
  </Page>
}

export function ReviewHub() {
  const tools = useApp((state) => state.settings.appearance.developerTools === true)
  const [params, setParams] = useSearchParams()
  const chosen = params.get('ansicht')
  const tab = chosen === 'schlaf' ? 'schlaf' : tools && chosen === 'zeiten' ? 'zeiten' : 'woche'
  return <Page title="Rückblick" back="/mehr">
    <Segmented label="Rückblickbereich" value={tab} onChange={(value) => setParams({ ansicht: value })} options={[{ value: 'woche', label: 'Woche' }, { value: 'schlaf', label: 'Schlaf' }, ...(tools ? [{ value: 'zeiten', label: 'Zeitübersicht' }] : [])]} />
    {tab === 'woche' ? <Review embedded /> : tab === 'schlaf' ? <SleepDiary embedded /> : <TimeOverview embedded />}
  </Page>
}

export function AlarmHub() {
  const location = useLocation()
  const nav = useNavigate()
  const sleep = location.pathname === '/schlaf'
  return <Page className="settings-page" title="Schlaf & Wecker" back="/mehr">
    <Segmented label="Schlafbereich" value={sleep ? 'sleep' : 'alarm'} onChange={(value) => nav(value === 'sleep' ? '/schlaf' : '/wecker')} options={[{ value: 'alarm', label: 'Wecker' }, { value: 'sleep', label: 'Schlafüberblick' }]} />
    {sleep ? <SleepDiary embedded /> : <AlarmSetup embedded />}
  </Page>
}

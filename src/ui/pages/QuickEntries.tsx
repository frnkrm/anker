import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { resumeRoute } from '../../core/recovery'
import type { ResumePoint } from '../../core/types'
import { nextNow, useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { InboxSheet } from '../components/Shell'
import { StuckSheet } from '../components/Stuck'
import { TodayDifferent } from '../components/TodayDifferent'
import { Card, Page } from '../components/ui'
import { RecoverySheet } from './Now'

/** Launcher und Widget öffnen dieselbe Recovery wie Jetzt, keine zweite Empfehlung. */
export function QuickRecovery() {
  const nav = useNavigate()
  const onboarded = useApp((state) => state.settings.onboarded)
  const { date, m } = useToday()
  const action = nextNow().action
  const [mode, setMode] = useState<'recover' | 'small' | 'capture' | 'different'>('recover')
  const [context, setContext] = useState<ResumePoint>()
  if (!onboarded) return <Navigate to="/start" replace />
  const close = () => nav('/', { replace: true })
  return <>
    <RecoverySheet open={mode === 'recover'} onClose={close} onSmall={() => setMode('small')} onDifferent={() => setMode('different')} onCapture={(point) => { setContext(point); setMode('capture') }} />
    <StuckSheet open={mode === 'small'} onClose={close} action={action} />
    <InboxSheet open={mode === 'capture'} onClose={close} context={context} />
    <TodayDifferent open={mode === 'different'} onClose={close} date={date} m={m} action={action} />
  </>
}

/** Der bewusste Shortcut-Start verwendet die aktuelle gemeinsame Handlung, nie eine alte Widget-ID. */
export function QuickFocus() {
  const nav = useNavigate()
  const [action] = useState(() => nextNow().action)
  const [choice, setChoice] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const open = async () => {
      const state = useApp.getState()
      if (!state.settings.onboarded) { nav('/start', { replace: true }); return }
      if (action.type === 'step') { nav(`/fokus/${action.routine}`, { replace: true }); return }
      const ref = action.type === 'worktask' ? { kind: 'work' as const, id: action.task.id }
        : action.type === 'task' ? { kind: 'task' as const, id: action.task.id }
          : action.type === 'resume' && (action.resume.kind === 'work' || action.resume.kind === 'task') && action.resume.refId ? { kind: action.resume.kind, id: action.resume.refId } : undefined
      if (ref) {
        await state.startTaskFocus(ref)
        if (active) nav(`/aufgabe/${ref.kind}/${encodeURIComponent(ref.id)}`, { replace: true })
      } else if (action.type === 'resume' && resumeRoute(action.resume)) nav(resumeRoute(action.resume)!, { replace: true })
      else if (active) setChoice(true)
    }
    void open().catch(() => { if (active) setError('Der Fokus konnte nicht sicher gestartet werden. Deine Aufgabe bleibt erhalten.') })
    return () => { active = false }
  }, [nav, action])
  return <Page title="Fokus starten" back="/">
    {error && <p role="alert" className="text-warm">{error}</p>}
    {choice ? <Card className="space-y-3"><p>Wähle eine Aufgabe, mit der du anfangen möchtest. Eine Pause ist genauso möglich.</p><Link className="flex min-h-12 items-center text-accent" to="/arbeit">Arbeitsaufgaben öffnen</Link><Link className="flex min-h-12 items-center text-accent" to="/inbox">Gedanken und eigene Aufgaben öffnen</Link><Link className="flex min-h-12 items-center text-accent" to="/">Zurück zu Jetzt</Link></Card> : !error && <p role="status">Aktuellen Fokus öffnen …</p>}
  </Page>
}

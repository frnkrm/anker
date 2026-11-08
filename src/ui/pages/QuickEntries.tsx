import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { resumeRoute } from '../../core/recovery'
import { taskIsActionable, taskNextStep, taskPriority, taskTitle } from '../../core/tasks'
import { workTasksQuiet } from '../../core/support'
import type { TaskRef } from '../../core/types'
import type { ResumePoint } from '../../core/types'
import { nextNow, useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { InboxSheet } from '../components/Shell'
import { StuckSheet } from '../components/Stuck'
import { TodayDifferent } from '../components/TodayDifferent'
import { Button, Card, Page } from '../components/ui'
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
  const st = useApp()
  const { date, plan, m, now } = useToday()
  const [action] = useState(() => nextNow().action)
  const [choice, setChoice] = useState(false)
  const [error, setError] = useState('')
  const quietWork = workTasksQuiet({ settings: st.settings, plan, m, nowMs: now, sessions: st.local.workSessions })
  const choices = [
    ...st.inbox.filter((task) => task.status === 'task' && (task.taskDate ?? date) <= date && taskIsActionable(task, now)).map((task) => ({ task, ref: { kind: 'task' as const, id: task.id } })),
    ...(!quietWork ? st.local.work.filter((task) => taskIsActionable(task, now)).map((task) => ({ task, ref: { kind: 'work' as const, id: task.id } })) : []),
  ].sort((a, b) => taskPriority(b.task) - taskPriority(a.task) || (a.task.deadline ?? Infinity) - (b.task.deadline ?? Infinity)).slice(0, 3)
  const start = async (ref: TaskRef) => {
    try { await st.startTaskFocus(ref); nav(`/aufgabe/${ref.kind}/${encodeURIComponent(ref.id)}`) }
    catch { setError('Der Fokus konnte nicht sicher gestartet werden. Deine Aufgabe bleibt erhalten.') }
  }
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
        const focusTarget = state.local.focus?.target
        const saved = state.local.resume
        const partId = action.type === 'resume' ? action.resume.partId
          : focusTarget?.kind === ref.kind && focusTarget.id === ref.id ? focusTarget.partId
            : saved?.kind === ref.kind && saved.refId === ref.id ? saved.partId : undefined
        await state.startTaskFocus(ref, undefined, partId)
        if (active) nav(`/aufgabe/${ref.kind}/${encodeURIComponent(ref.id)}${partId ? `?teil=${encodeURIComponent(partId)}` : ''}`, { replace: true })
      } else if (action.type === 'resume' && resumeRoute(action.resume)) nav(resumeRoute(action.resume)!, { replace: true })
      else if (active) setChoice(true)
    }
    void open().catch(() => { if (active) setError('Der Fokus konnte nicht sicher gestartet werden. Deine Aufgabe bleibt erhalten.') })
    return () => { active = false }
  }, [nav, action])
  return <Page title="Fokus starten" back="/">
    {error && <p role="alert" className="text-warm">{error}</p>}
    {choice ? <div className="space-y-3"><p className="text-muted">Womit möchtest du anfangen? Eine Pause ist genauso möglich.</p>{choices.map(({ task, ref }) => <Card key={`${ref.kind}:${ref.id}`} className="space-y-2"><h2 className="break-words font-semibold">{taskTitle(task)}</h2><p className="break-words text-sm text-muted">{taskNextStep(task, taskTitle(task))}</p><Button className="w-full" onClick={() => void start(ref)}>Diese Aufgabe wählen</Button></Card>)}{choices.length === 0 && <p className="text-sm text-muted">Gerade ist keine offene Aufgabe für jetzt vorgesehen. Du entscheidest, ob du eine auswählen möchtest.</p>}<details><summary className="min-h-12 content-center text-muted">Alle Aufgaben ansehen</summary><Link className="flex min-h-12 items-center text-accent" to="/arbeit">Arbeitsaufgaben öffnen</Link><Link className="flex min-h-12 items-center text-accent" to="/inbox">Private Aufgaben öffnen</Link></details><Link className="flex min-h-12 items-center text-muted" to="/">Zurück zu Jetzt</Link></div> : !error && <p role="status">Aktuellen Fokus öffnen …</p>}
  </Page>
}

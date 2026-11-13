import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EVENING_LABELS } from '../../core/defaults'
import { pendingTomorrowSteps, reviewDue } from '../../core/evening'
import { resumeRoute, usableResume } from '../../core/recovery'
import { resolveTask, taskIsOpen, taskNextStep, taskTitle } from '../../core/tasks'
import { sportDone, sportInRoutine, theme } from '../../core/game'
import { currentMode, isBehind, MODE_HINT, MODE_LABEL, nextAction, rescueItems, suggestedMode, workTasksQuiet, type NextAction } from '../../core/support'
import { addDays, fmtDuration, fmtTime, utcToZoned, weekday } from '../../core/time'
import { upcomingWorkTasks } from '../../core/upcomingWork'
import { plural } from '../../core/uiText'
import { nowConflictNotice } from '../../core/planConflicts'
import { guidancePreferences } from '../../core/guidance'
import { useGuidanceView } from '../../state/useGuidanceView'
import { GuidanceHomeExtras, GuidanceNightPage } from '../components/GuidanceControls'
import { GuidanceTimeArc } from '../components/GuidanceTimeArc'
import { nowActionTitle } from '../components/nowTitle'
import type { DayType, EveningPlan, PlannedStep, ResumePoint, SupportMode } from '../../core/types'
import { useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { SportToggle } from '../components/SportToggle'
import { StuckSheet } from '../components/Stuck'
import { LateForm, openRoute, TodayDifferent } from '../components/TodayDifferent'
import { Button, Card, Choice, Progress, Segmented, Sheet, TextInput, TimeStepper } from '../components/ui'
import { WorkChip } from '../components/WorkControls'
import { GeofenceSuggestions } from '../components/GeofenceVisit'
import { HomeOfficeContact } from '../components/HomeOfficeContact'
import { InboxSheet } from '../components/Shell'
import { BedtimePrompt } from '../components/BedtimePrompt'
import { BedtimeSessionProvider } from '../components/BedtimeSession'
import { BedtimeFollowUpCard } from '../components/BedtimeFollowUpCard'
import { DepartureReadiness } from '../components/DepartureReadiness'
import './now.css'

const DAY_LABEL: Record<DayType, string> = { work: 'Arbeitstag', weekend: 'Frei', vacation: 'Urlaub', sick: 'Krank' }

/** Eine Handlung im Vordergrund. Die vorhandenen Planaktionen bleiben im gemeinsamen Sheet. */
export default function Now() { return <BedtimeSessionProvider><NowContent /></BedtimeSessionProvider> }

function NowContent() {
  const { date, plan, log, m, now } = useToday()
  const st = useApp()
  const guidance = useGuidanceView()
  const guidanceOptions = guidancePreferences(st.settings.guidance)
  const [adjust, setAdjust] = useState(false)
  const [stuck, setStuck] = useState(false)
  const [dayOpen, setDayOpen] = useState(false)
  const [longer, setLonger] = useState(false)
  const [late, setLate] = useState(false)
  const [interrupted, setInterrupted] = useState(false)
  const [rescue, setRescue] = useState(false)
  const [different, setDifferent] = useState(false)
  const [differentView, setDifferentView] = useState<'menu' | 'event' | 'work' | 'later' | 'not-needed' | 'late' | 'covered' | 'covered-today'>('menu')
  const [drifted, setDrifted] = useState(false)
  const [capture, setCapture] = useState(false)
  const [captureContext, setCaptureContext] = useState<ResumePoint>()
  const input = { plan, log, m, nowMs: now, settings: st.settings, inbox: st.inbox, work: st.local.work, resume: st.local.resume, sessions: st.local.workSessions, context: st.local.taskContext }
  const v = nextAction(input)
  const a = v.action
  const mode = currentMode(log)
  const suggestion = suggestedMode(st.settings, log, m)
  const behind = isBehind(plan, log, m)
  const upcoming = workTasksQuiet(input) ? [] : upcomingWorkTasks(st.local.work, now)
  const readyToReview = st.inbox.filter((item) => reviewDue(item, now)).length + pendingTomorrowSteps(st.local.tomorrowSteps, now).length
  const bedtime = !plan.openEnd && m >= plan.bed && ['bed', 'night', 'sleep'].includes(a.type)
  const near = !!v.hard && v.hard.at - m >= 0 && v.hard.at - m < 120
  const conflict = nowConflictNotice(plan, m, st.local.acknowledgedPlanConflicts?.[date] ?? [])
  const next = upcoming.find((entry) => !((a.type === 'worktask') && entry.task.id === a.task.id))
  const after = next ? `${next.kind === 'start' ? 'Ab' : 'Frist'} ${utcToZoned(next.at).date !== utcToZoned(now).date ? 'morgen ' : ''}${fmtTime(utcToZoned(next.at).minutes)} · ${taskTitle(next.task)}`
    : plan.blocks.find((block) => block.start > m && block.title !== a.title)?.title
  const task = a.type === 'worktask' || a.type === 'task' ? a.task : undefined
  const deadline = task?.deadline !== undefined ? utcToZoned(task.deadline) : undefined
  const reason = deadline ? `${task!.deadline! <= now ? 'Frist war' : 'Frist'} ${deadline.date !== utcToZoned(now).date ? new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }).format(task!.deadline!) + ' ' : ''}${fmtTime(deadline.minutes)}${task!.deadline! <= now ? ' · ein kleiner Anfang reicht' : ''}`
    : a.type === 'step' && a.step.useMinimal ? 'Die kleine Version zählt auch.'
      : a.type === 'arrival' && a.meal && a.index === 1 ? `Idee: ${a.meal}` : undefined
  const openPanel = (show: () => void) => { setAdjust(false); show() }
  const openDifferent = (view: typeof differentView = 'menu') => { setDifferentView(view); setDifferent(true); setAdjust(false) }
  const primaryLabelMinutes = v.estimatedMin
  const timeArc = guidanceOptions.enabled && guidanceOptions.timeArc && !!v.hard && ['pc-stop', 'bed', 'leave'].includes(v.hard.key) && v.hard.at - m > 0 && v.hard.at - m <= 60
  if (guidanceOptions.enabled && (guidance.phase === 'NIGHT_LOCK' && (guidanceOptions.bedtimeQr || guidanceOptions.pcLock)
    || guidance.phase === 'BEDTIME_HARD_CUT' && (guidanceOptions.eveningEscalation || guidanceOptions.bedtimeQr || guidanceOptions.pcLock))) return <GuidanceNightPage view={guidance} />

  return <div className="now-page" data-testid="now-page">
    {!bedtime && <>
      <header className={`now-header${timeArc ? ' now-header-with-arc' : ''}`}>
        {timeArc && v.hard && <GuidanceTimeArc date={date} hard={v.hard} now={now} />}
        <div className="now-anchor">{v.hard ? <>{v.hard.key === 'commitment' ? v.hard.label.startsWith('Los') ? 'Los' : 'Termin' : v.hard.label} {fmtTime(v.hard.at)}{near && <span className="block">noch {fmtDuration(v.hard.at - m)}</span>}</> : fmtTime(m)}</div>
        <button type="button" onClick={() => setAdjust(true)} className="now-day-chip" aria-label="Heute anpassen: Tagesart und Modus">{plan.homeOffice ? 'Homeoffice' : DAY_LABEL[plan.dayType]} · {MODE_LABEL[mode]} ▾</button>
      </header>
      {near && !timeArc && <Progress label="Zeit bis zum nächsten festen Punkt" value={v.elapsed} className="!h-1" />}
      <WorkChip date={date} plan={plan} log={log} m={m} now={now} />
    </>}
    {st.alarmStatus && !st.alarmStatus.ok && <Link to="/wecker" className="rounded-xl border border-warm px-3 py-2 text-sm text-warm">Wecker prüfen: {st.alarmStatus.message}</Link>}

    <section aria-live="polite" className="now-action">
      {!bedtime && a.sub && (a.type === 'step' ? <Link to={`/fokus/${a.routine}`} className="now-context flex min-h-11 items-center underline" aria-label="Routine im Fokus öffnen">{a.sub} ›</Link> : <p className="now-context">{a.sub}</p>)}
      <h1 className="now-title">{nowActionTitle(a, plan, m)}</h1>
      {!bedtime && reason && <p className="now-reason">{reason}</p>}
      <div className="now-buttons">
        {bedtime && !adjust ? <BedtimePrompt available delayMinutes={st.settings.sleep.fallAsleepMin} nowMs={now} integrated enabled={st.settings.sleep.bedtimePromptEnabled ?? false} followUpsEnabled={st.settings.sleep.bedtimeFollowUpsEnabled ?? false} onBed={() => st.mark(date, 'bedAt')} />
          : bedtime ? null : <ActionButtons action={a} date={date} m={m} mode={mode} estimatedMin={primaryLabelMinutes} onLate={() => setLate(true)} onLonger={() => setLonger(true)} onStuck={() => setStuck(true)} onInterrupted={() => setInterrupted(true)} />}
      </div>
      {!bedtime && after && <p className="now-after" aria-label="Danach">Danach: {after}</p>}
    </section>

    {!bedtime && <DepartureReadiness plan={plan} log={log} now={now} />}

    {!bedtime && readyToReview > 0 && m >= 14 * 60 && <Link to="/abend" className="flex min-h-11 items-center text-sm text-muted">Geparkt · {readyToReview} zum Ansehen ›</Link>}
    {!bedtime && conflict.active.slice(0, 1).map((item) => <aside key={item.id} className="now-conflict" aria-label="Überschneidung prüfen"><p>{item.summary}</p><div className="now-conflict-actions"><Link to="/tag" className="underline">Ansehen</Link><button type="button" onClick={() => void st.acknowledgePlanConflict(date, item.id).catch(() => st.showToast('Der Hinweis konnte noch nicht bestätigt werden. Versuche es erneut.'))}>Passt so</button></div></aside>)}
    {!bedtime && !conflict.active.length && conflict.upcomingCount > 0 && <Link to="/tag" className="flex min-h-11 items-center text-sm text-muted">{plural(conflict.upcomingCount, 'Hinweis', 'Hinweise')} für heute ›</Link>}
    {!adjust && !dayOpen && !stuck && !longer && !late && !interrupted && !rescue && !different && !drifted && !capture && <HomeOfficeContact date={date} reminderOnly />}
    <GuidanceHomeExtras />
    <BedtimeFollowUpCard />
    <button type="button" className="now-adjust" onClick={() => setAdjust(true)}>Heute anpassen</button>

    <Sheet open={adjust} onClose={() => setAdjust(false)} title="Heute anpassen">
      <div className="space-y-3">
        <Choice label="Unterstützung" value={mode} options={MODES.map((value) => ({ value, label: MODE_LABEL[value] }))} onChange={(value) => void st.setOverride(date, { mode: value })} />
        <Choice<DayType> label="Tagesart" value={plan.dayType} options={[{ value: 'work', label: 'Arbeit' }, { value: 'weekend', label: 'Frei' }, { value: 'vacation', label: 'Urlaub' }, { value: 'sick', label: 'Krank' }]} onChange={(value) => void st.setOverride(date, { dayType: value })} />
        <div className="now-options-menu">
          <Button className="w-full !justify-start" onClick={() => openPanel(() => setCapture(true))}>Gedanke festhalten</Button>
          <Button className="w-full !justify-start" onClick={() => openPanel(() => setDrifted(true))}>Ich bin abgedriftet</Button>
          <Link to="/tag">Ganzen Tag ansehen ›</Link>
        </div>
        <details className="rounded-xl border border-line px-3">
          <summary className="min-h-12 content-center text-muted">Weitere Möglichkeiten</summary>
          <div className="now-options-menu pb-3">
            <Button onClick={() => openDifferent('event')}>Termin planen</Button>
            <Button onClick={() => openDifferent()}>Heute anders</Button>
            <Button onClick={() => openDifferent('work')}>Arbeit heute anders</Button>
            <Button onClick={() => openDifferent('later')}>Diese Routine später</Button>
            <Button onClick={() => openDifferent('not-needed')}>Heute nicht nötig</Button>
            <Button onClick={() => openDifferent('late')}>Länger wach bleiben</Button>
            <Button onClick={() => openDifferent('covered')}>Für morgen schon versorgt</Button>
            <Button onClick={() => openDifferent('covered-today')}>Morgenroutine heute prüfen</Button>
            {a.type === 'step' && <><Link to={`/fokus/${a.routine}`}>Fokus öffnen</Link><Button onClick={() => void st.setStep(date, a.routine, a.step.id, 'skipped')}>Diesen Schritt überspringen</Button>{stepLink(a.step) && <Link to={stepLink(a.step)!.to}>{stepLink(a.step)!.label}</Link>}</>}
            {a.type === 'task' && <Button onClick={() => void st.updateTask({ kind: 'task', id: a.task.id }, { taskDate: addDays(date, 1), state: 'deferred' })}>Aufgabe auf morgen verschieben</Button>}
            <Button onClick={() => openPanel(() => setDayOpen(true))}>Homeoffice und Abendplan</Button>
            <Link to="/arbeit">Arbeit öffnen</Link><Link to="/abend">Abend & morgen</Link>
            <Button onClick={() => openPanel(() => setLonger(true))}>Heute länger arbeiten</Button>
            <Button onClick={() => openPanel(() => setLate(true))}>Abendzeit ändern</Button>
            {suggestion && <Button onClick={() => void st.setOverride(date, { mode: suggestion })}>{MODE_LABEL[suggestion]} für heute Abend einschalten</Button>}
            <Segmented label="Mein Aufgabenkontext" value={st.local.taskContext ?? 'any'} onChange={(context) => void st.saveLocal((local) => ({ ...local, taskContext: context }))} options={[{ value: 'any' as const, label: 'Offen' }, { value: 'home' as const, label: 'Zuhause' }, { value: 'work' as const, label: 'Arbeit' }, { value: 'errand' as const, label: 'Unterwegs' }]} />
            {behind && <Button onClick={() => openPanel(() => setRescue(true))}>Tag neu sortieren</Button>}
            {!sportInRoutine(st.settings) && !sportDone(plan, log, st.settings) && <SportToggle plan={plan} />}
            <GeofenceSuggestions />
            {adjust && <BedtimePrompt available delayMinutes={st.settings.sleep.fallAsleepMin} nowMs={now} enabled={st.settings.sleep.bedtimePromptEnabled ?? false} followUpsEnabled={st.settings.sleep.bedtimeFollowUpsEnabled ?? false} settingsOnly />}
            {v.reason && <p className="text-sm text-muted">{v.reason}</p>}
            {plan.notes.map((note) => <p key={note} className="text-sm text-muted">{note}</p>)}
            <Extras date={date} />
          </div>
        </details>
      </div>
    </Sheet>
    <StuckSheet open={stuck} onClose={() => setStuck(false)} action={a} />
    <RecoverySheet open={drifted} onClose={() => setDrifted(false)} onSmall={() => { setDrifted(false); setStuck(true) }} onCapture={(context) => { setCaptureContext(context); setDrifted(false); setCapture(true) }} onDifferent={() => { setDrifted(false); openDifferent() }} />
    <InboxSheet open={capture} onClose={() => setCapture(false)} context={captureContext} />
    <TodayDifferent key={differentView} initialView={differentView} open={different} onClose={() => setDifferent(false)} date={date} m={m} action={a} />
    <Sheet open={late} onClose={() => setLate(false)} title="Dein Abend"><LateForm date={date} m={m} onDone={(text) => { setLate(false); st.showToast(text) }} /></Sheet>
    <DaySheet open={dayOpen} onClose={() => setDayOpen(false)} date={date} />
    <InterruptSheet open={interrupted} onClose={() => setInterrupted(false)} action={a} />
    <Sheet open={rescue} onClose={() => setRescue(false)} title="Ab jetzt zählt nur das">
      <ol className="mb-4 space-y-3">{rescueItems(input).map((item) => <li key={item.title} className="flex items-baseline justify-between gap-3"><span>{item.title}</span>{item.when && <span className="text-sm text-muted">{item.when}</span>}</li>)}</ol>
      <p className="mb-4 text-muted">Der Rest läuft in kleinen Versionen. Nichts davon musst du nachholen.</p>
      <Button variant="primary" size="lg" className="w-full" onClick={async () => { await st.setOverride(date, { light: true }); setRescue(false) }}>So machen wir es</Button>
    </Sheet>
    <LongerSheet open={longer} onClose={() => setLonger(false)} current={plan.workEnd ?? 17 * 60} onSave={async (end) => { await st.setOverride(date, { workEnd: end }); setLonger(false); st.showToast(`Feierabend ${fmtTime(end)}. Der Abend ist neu geplant.`) }} />
  </div>
}

function stepLink(step: PlannedStep): { to: string; label: string } | undefined {
  if (step.tag === 'inbox') return { to: '/inbox', label: 'Gedanken öffnen' }
  if (step.tag === 'tidy') return { to: '/aufraeumen', label: 'Timer starten' }
  if (step.tag === 'prep' || step.tag === 'gymbag') return { to: '/vorbereitung', label: 'Checkliste' }
  if (step.tag === 'breakfast') return { to: '/essen', label: 'Ideen' }
  return undefined
}

export function RecoverySheet({ open, onClose, onSmall, onCapture, onDifferent }: { open: boolean; onClose: () => void; onSmall: () => void; onCapture: (context?: ResumePoint) => void; onDifferent: () => void }) {
  const st = useApp()
  const nav = useNavigate()
  const { plan, m } = useToday()
  let point: ResumePoint | undefined = usableResume(st.local.resume, st.inbox, st.local.work)
  const focus = st.local.focus
  if (focus?.target.kind === 'routine') {
    const target = focus.target
    const step = st.settings.routines[target.routine].find((item) => item.id === target.stepId)
    if (step && !st.days[target.date]?.steps[`${target.routine}:${target.stepId}`]) point = { kind: 'step', title: step.title, refId: step.id, route: `/fokus/${target.routine}`, at: focus.timer.startedAt }
  } else if (focus) {
    const target = focus.target
    const task = resolveTask(target, st.inbox, st.local.work)
    const part = target.partId ? task?.subtasks?.find((item) => item.id === target.partId && item.doneAt === undefined) : undefined
    if (task && taskIsOpen(task) && (!target.partId || part)) point = { kind: target.kind, refId: target.id, ...(part ? { partId: part.id } : {}), title: taskTitle(task), nextStep: part?.title ?? taskNextStep(task, taskTitle(task)), at: focus.timer.startedAt, note: task.resumeNote ?? (point?.kind === target.kind && point.refId === target.id ? point.note : undefined) }
  }
  if (point?.kind === 'work' && st.settings.support.workAfterHoursQuiet && !st.local.workSessions.some((session) => session.endAt === undefined)
    && (plan.workEnd === undefined || m >= plan.workEnd || plan.workInfo?.closed)) point = undefined
  const current = point
  return <Sheet open={open} onClose={onClose} title={current ? 'Hier warst du' : 'Ab hier geht es weiter'}>
    <p className="mb-3 text-xl font-semibold">{current?.nextStep || current?.title || 'Ein kleiner Einstieg reicht.'}</p>
    {current?.note && <p className="mb-3 whitespace-pre-wrap text-muted">{current.note}</p>}
    <div className="space-y-2">
      <Button variant="primary" size="lg" className="w-full" onClick={async () => {
        try {
          if (!current) { onSmall(); return }
          if ((current.kind === 'task' || current.kind === 'work') && current.refId) await st.startTaskFocus({ kind: current.kind, id: current.refId }, undefined, current.partId)
          const route = resumeRoute(current)
          onClose()
          if (route) nav(route)
          else onSmall()
        } catch { st.showToast('Der Wiedereinstieg konnte noch nicht gespeichert werden. Bitte versuche es erneut.') }
      }}>{current ? 'Dort weitermachen' : 'Kleinen Schritt wählen'}</Button>
      <Button className="w-full" onClick={() => onCapture(current)}>Gedanke festhalten</Button>
      <Button variant="ghost" className="w-full" onClick={onDifferent}>Heute anders</Button>
    </div>
  </Sheet>
}

function ActionButtons({ action: a, date, m, mode, estimatedMin, onLate, onLonger, onStuck, onInterrupted }: { action: NextAction; date: string; m: number; mode: SupportMode; estimatedMin?: number; onLate: () => void; onLonger: () => void; onStuck: () => void; onInterrupted: () => void }) {
  const st = useApp()
  const nav = useNavigate()
  const partFor = (kind: 'task' | 'work', id: string) => {
    const target = st.local.focus?.target
    const resume = st.local.resume
    return target?.kind === kind && target.id === id ? target.partId : resume?.kind === kind && resume.refId === id ? resume.partId : undefined
  }
  const StuckButton = (
    <Button variant="ghost" size="lg" className="flex-1" onClick={onStuck}>
      Ich hänge fest
    </Button>
  )
  switch (a.type) {
    case 'wake':
      return (
        <>
          <Button
            variant="primary"
            size="xl"
            className="w-full"
            onClick={async () => {
              await st.mark(date, 'wakeAt')
              nav('/fokus/morning')
            }}
          >
            Ich bin wach
          </Button>
          <div className="flex gap-2">{StuckButton}</div>
        </>
      )
    case 'step':
      return (
        <>
          {mode === 'startschwierigkeit' ? (
            <Button variant="primary" size="xl" className="w-full" onClick={onStuck}>
              2 Minuten anfangen
            </Button>
          ) : (
            <Button variant="primary" size="xl" className="w-full" onClick={() => st.setStep(date, a.routine, a.step.id, a.step.useMinimal ? 'minimal' : 'done')}>
              Erledigt
            </Button>
          )}
          <div className="flex gap-2">
            {mode === 'startschwierigkeit' ? (
              <Button size="lg" className="flex-1" onClick={() => st.setStep(date, a.routine, a.step.id, a.step.useMinimal ? 'minimal' : 'done')}>
                Erledigt
              </Button>
            ) : a.step.minimal && !a.step.useMinimal ? (
              <Button size="lg" className="flex-1" onClick={() => st.setStep(date, a.routine, a.step.id, 'minimal')}>
                Nur: {a.step.minimal.title}
              </Button>
            ) : null}
            {mode !== 'startschwierigkeit' && StuckButton}
          </div>
        </>
      )
    case 'worktask':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={async () => { const partId = partFor('work', a.task.id); await st.startTaskFocus({ kind: 'work', id: a.task.id }, partId ? undefined : a.focusMinutes ?? 25, partId); nav(`/aufgabe/work/${encodeURIComponent(a.task.id)}${partId ? `?teil=${encodeURIComponent(partId)}` : ''}`) }}>
            {a.task.state === 'active' ? 'Weitermachen' : 'Starten'} · {estimatedMin ?? a.focusMinutes ?? 25} min
          </Button>
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => st.completeTask({ kind: 'work', id: a.task.id }, true)}>
              Erledigt
            </Button>
            {StuckButton}
          </div>
        </>
      )
    case 'task':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={async () => { const partId = partFor('task', a.task.id); await st.startTaskFocus({ kind: 'task', id: a.task.id }, partId ? undefined : a.focusMinutes ?? 25, partId); nav(`/aufgabe/task/${encodeURIComponent(a.task.id)}${partId ? `?teil=${encodeURIComponent(partId)}` : ''}`) }}>
            {a.task.state === 'active' ? 'Weitermachen' : 'Starten'} · {estimatedMin ?? a.focusMinutes ?? 25} min
          </Button>
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => st.setInboxDone(a.task.id, true)}>
              Erledigt
            </Button>
            {StuckButton}
          </div>
        </>
      )
    case 'resume':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={async () => {
            if ((a.resume.kind === 'work' || a.resume.kind === 'task') && a.resume.refId) await st.startTaskFocus({ kind: a.resume.kind, id: a.resume.refId }, undefined, a.resume.partId)
            const route = resumeRoute(a.resume)
            if (route) nav(route)
            else onStuck()
          }}>
            Dort weitermachen
          </Button>
          <div className="flex gap-2">{StuckButton}</div>
        </>
      )
    case 'arrival':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.updateDay(date, (l) => ({ ...l, arrival: [...(l.arrival ?? []), a.index] }))}>
            Erledigt
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="lg" className="flex-1" onClick={() => st.updateDay(date, (l) => ({ ...l, arrival: Array.from({ length: a.total }, (_, n) => n) }))}>
              Überspringen
            </Button>
            {StuckButton}
          </div>
        </>
      )
    case 'prep':
    case 'go':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.markCommitment(a.leg.commitment.id, 'leftAt')}>
            Bin los
          </Button>
          <div className="flex gap-2">
            {a.leg.commitment.address && (
              <Button size="lg" className="flex-1" onClick={() => openRoute(a.leg.commitment.address!, a.leg.commitment.routeMode)}>
                Route öffnen
              </Button>
            )}
            {StuckButton}
          </div>
        </>
      )
    case 'underway':
      return (
        <Button variant="primary" size="xl" className="w-full" onClick={() => st.markCommitment(a.leg.commitment.id, 'arrivedAt')}>
          Ich bin angekommen
        </Button>
      )
    case 'away':
      return (
        <Button size="lg" className="w-full" onClick={() => st.markCommitment(a.leg.commitment.id, 'backAt')}>
          Bin wieder da
        </Button>
      )
    case 'work-break':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.workBreakEnd()}>
            Pause beenden
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={() => st.workStop()}>
            {a.session.kind === 'regular' ? 'Feierabend' : 'Einsatz beenden'}
          </Button>
        </>
      )
    case 'work-stale':
      return (
        <Link to="/arbeitszeit" className="flex min-h-20 items-center justify-center rounded-3xl bg-accent px-6 text-center text-2xl font-semibold text-accent-ink">
          Ende eintragen
        </Link>
      )
    case 'einsatz-start': {
      const c = a.leg.commitment
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.workStart({ kind: c.workKind === 'oncall' || !c.workKind ? 'incident' : c.workKind, label: c.label, commitmentId: c.id })}>
            Einsatz starten
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="lg" className="flex-1" onClick={() => st.adjustCommitment({ ...c, status: 'cancelled' }, 'Einsatz entfällt')}>
              Entfällt
            </Button>
            {StuckButton}
          </div>
        </>
      )
    }
    case 'einsatz-running':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={async () => {
            await st.workStop()
            st.showToast('Gesichert. Der Rest des Tages gehört wieder dir.')
          }}>
            Einsatz beenden
          </Button>
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => st.workBreakStart()}>
              Pause
            </Button>
            <Button size="lg" className="flex-1" onClick={onInterrupted}>
              Ich wurde unterbrochen
            </Button>
          </div>
        </>
      )
    case 'return-later':
      return <Button variant="primary" size="xl" className="w-full" onClick={() => st.updateDay(date, (log) => ({ ...log, override: { ...log.override, backAt: Date.now() } }))}>Ich bin zurück</Button>
    case 'return-check':
      return (
        <>
          <Button
            variant="primary"
            size="xl"
            className="w-full"
            onClick={() => st.updateDay(date, (l) => ({ ...l, override: { ...l.override, backAt: Date.now() } }))}
          >
            Ja, bin zurück
          </Button>
          <Button size="lg" className="w-full" onClick={() => st.adjustDay(date, 'Rückfrage später', (log) => ({ ...log, override: { ...log.override, returnCheckAfter: m + 60 } }))}>Später</Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={() =>
              st.adjustDay(date, 'Abendroutine: heute nicht nötig', (l) => ({
                ...l,
                override: { ...l.override, backAt: Date.now() },
                steps: { ...l.steps, ...Object.fromEntries(st.settings.routines.evening.filter((x) => !l.steps[`evening:${x.id}`]).map((x) => [`evening:${x.id}`, 'not-needed' as const])) },
              }))
            }
          >
            Heute nicht mehr
          </Button>
        </>
      )
    case 'leave':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.mark(date, 'leftAt')}>
            Bin los
          </Button>
          <div className="flex gap-2">{StuckButton}</div>
        </>
      )
    case 'work':
      if (st.local.workSessions.some((session) => session.kind === 'regular' && session.endAt === undefined)) return <>
        <Button variant="primary" size="xl" className="w-full" onClick={() => st.workStop()}>Feierabend</Button>
        <div className="flex gap-2"><Button size="lg" className="flex-1" onClick={() => st.workBreakStart()}>Pause starten</Button>{StuckButton}</div>
      </>
      return (
        <>
          <Link to="/arbeit" className="flex min-h-20 items-center justify-center rounded-3xl bg-accent px-6 text-center text-2xl font-semibold text-accent-ink">
            Wichtigste Aufgabe festlegen
          </Link>
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={onLonger}>
              Heute länger
            </Button>
            {StuckButton}
          </div>
        </>
      )
    case 'free':
      return <Button size="lg" className="w-full" onClick={onLate}>Abendzeit ändern</Button>
    case 'pcoff':
      return (
        <Button variant="primary" size="xl" className="w-full" onClick={() => st.mark(date, 'pcOffAt')}>
          PC ist aus
        </Button>
      )
    case 'bed':
      return (
        <Button variant="primary" size="xl" className="w-full" onClick={() => st.mark(date, 'bedAt')}>
          Ich liege im Bett
        </Button>
      )
    case 'info':
      if (a.block?.kind === 'evening-plan' && /Kochen|Essen/.test(a.block.title)) {
        return (
          <Link to="/essen" className="flex min-h-14 items-center justify-center rounded-2xl border border-line text-lg">
            Was koche ich?
          </Link>
        )
      }
      return <div className="flex gap-2">{StuckButton}</div>
    default:
      return null
  }
}

/** „Ich wurde unterbrochen“: letzten Schritt festhalten, später mit einem Tipp zurück. */
function InterruptSheet({ open, onClose, action: a }: { open: boolean; onClose: () => void; action: NextAction }) {
  const st = useApp()
  const [next, setNext] = useState('')
  const task = a.type === 'worktask' ? a.task : undefined
  const einsatz = a.type === 'einsatz-running' ? a.title : undefined
  return (
    <Sheet open={open} onClose={onClose} title="Wo machst du weiter?">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const step = next.trim()
          if (task) {
            await st.pauseTaskFocus({ kind: 'work', id: task.id }, step || task.nextStep)
          }
          if (einsatz) await st.setResume({ kind: 'work', title: einsatz, nextStep: step || undefined, at: Date.now() })
          setNext('')
          onClose()
          st.showToast('Gemerkt. Du findest gleich hierher zurück.')
        }}
      >
        <TextInput autoFocus aria-label="Nächster Schritt" placeholder={task?.nextStep ?? 'Nächster Schritt'} value={next} onChange={(e) => setNext(e.target.value)} />
        <Button type="submit" variant="primary" size="lg" className="w-full">
          Merken
        </Button>
      </form>
    </Sheet>
  )
}

const MODES: SupportMode[] = ['normal', 'startschwierigkeit', 'wenig-energie', 'ueberlastet', 'auf-kurs']

function DaySheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const st = useApp()
  const log = st.days[date]
  const o = log?.override ?? {}
  const isWorkDay = st.settings.work[weekday(date)]?.isWorkDay
  const type: DayType = o.dayType ?? (isWorkDay ? 'work' : 'weekend')
  const evening: EveningPlan = o.evening ?? st.settings.evenings[weekday(date)] ?? 'free'
  const mode = currentMode(log)
  return (
    <Sheet open={open} onClose={onClose} title="Heute">
      <div className="max-h-[75dvh] space-y-5 overflow-y-auto">
        <div className="space-y-2">
          <p className="text-muted">Was hilft dir gerade?</p>
          <Segmented<SupportMode> label="Unterstützung" value={mode} options={MODES.map((k) => ({ value: k, label: MODE_LABEL[k] }))} onChange={(v) => st.setOverride(date, { mode: v })} />
          <p className="text-sm text-muted">{MODE_HINT[mode]}</p>
        </div>
        <div className="space-y-2">
          <p className="text-muted">Was für ein Tag ist heute?</p>
          <Segmented
            label="Tagesart"
            value={type}
            options={[
              { value: 'work', label: 'Arbeit' },
              { value: 'weekend', label: 'Frei' },
              { value: 'vacation', label: 'Urlaub' },
              { value: 'sick', label: 'Krank' },
            ]}
            onChange={(v) => st.setOverride(date, { dayType: v })}
          />
          {type === 'sick' && <p className="text-sm text-muted">Krank-Modus: nur das Nötigste, kein Ziel, nichts geht verloren. Der Wecker pausiert an diesem Tag und klingelt danach wieder.</p>}
        </div>
        {type === 'work' && (o.homeOffice ?? st.settings.work[weekday(date)]?.homeOffice) && <HomeOfficeContact date={date} />}
        {type === 'work' && (
          <div className="flex items-center justify-between">
            <span>Homeoffice heute</span>
            <Segmented
              label="Homeoffice"
              value={o.homeOffice ?? st.settings.work[weekday(date)]?.homeOffice ? 'ja' : 'nein'}
              options={[
                { value: 'nein', label: 'Nein' },
                { value: 'ja', label: 'Ja' },
              ]}
              onChange={(v) => st.setOverride(date, { homeOffice: v === 'ja' })}
            />
          </div>
        )}
        <div className="space-y-2">
          <p className="text-muted">Heute Abend</p>
          <Segmented label="Abendplan" value={evening} options={(Object.keys(EVENING_LABELS) as EveningPlan[]).map((k) => ({ value: k, label: EVENING_LABELS[k] }))} onChange={(v) => st.setOverride(date, { evening: v })} />
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={onClose}>
          Fertig
        </Button>
      </div>
    </Sheet>
  )
}

function LongerSheet({ open, onClose, current, onSave }: { open: boolean; onClose: () => void; current: number; onSave: (end: number) => void }) {
  const [end, setEnd] = useState(current + 60)
  return (
    <Sheet open={open} onClose={onClose} title="Heute länger arbeiten">
      <p className="mb-4 text-muted">Neuer Feierabend. PC-Stopp und Bettzeit bleiben gleich, der Abend wird neu geplant.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {[30, 60, 90, 120].map((x) => (
          <Button key={x} onClick={() => setEnd(current + x)}>
            +{x} min
          </Button>
        ))}
      </div>
      <div className="mb-5 flex justify-center">
        <TimeStepper label="Feierabend" night value={end} onChange={setEnd} />
      </div>
      <Button variant="primary" size="lg" className="w-full" onClick={() => onSave(end)}>
        Übernehmen
      </Button>
    </Sheet>
  )
}

/** Dezente Hinweise: Stufen-Angebot, Wochenrückblick. Nie als Hürde, und nur unter „Mehr“. */
function Extras({ date }: { date: string }) {
  const st = useApp()
  const t = theme(st.settings.themeId)
  const sunday = weekday(date) === 6
  const reviewed = st.reviews.some((r) => r.id === date)
  const gameOn = st.settings.support.gameVisible && st.days[date]?.override.mode !== 'ueberlastet'
  return (
    <div className="space-y-2">
      {gameOn && st.game.stageOffer && (
        <Card className="flex items-center gap-3">
          <span className="flex-1">
            Bereit für <strong>{t.stageNames[st.game.stageOffer - 1]}</strong>? Neue Ziele, mehr {t.xpWord}.
          </span>
          <Link to="/spiel" className="min-h-11 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-ink">
            Ansehen
          </Link>
        </Card>
      )}
      {sunday && !reviewed && (
        <Link to="/rueckblick" className="flex min-h-14 items-center rounded-2xl bg-surface px-4">
          <span className="flex-1">Wochenrückblick, 3 kurze Fragen</span> ›
        </Link>
      )}
    </div>
  )
}

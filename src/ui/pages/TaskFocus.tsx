import { useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { elapsedMs, remainingMs, sameFocusTarget } from '../../core/focus'
import { resolveTask, taskIsActionable, taskIsOpen, taskNextStep, taskStateLabel, taskTitle } from '../../core/tasks'
import type { FocusPulseMode, InboxItem, ResumePoint, TaskRef, WorkTask } from '../../core/types'
import { useFocusClock, useFocusPulse } from '../../state/useFocusClock'
import { useApp } from '../../state/store'
import { FocusFrame } from '../components/FocusFrame'
import { TaskPurpose } from '../components/TaskPurpose'
import { Button, Checkbox, Choice, DurationPicker, RingTimer, Section, Sheet, TextInput } from '../components/ui'

const clockTime = (at: number) => new Date(at).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })

/** Die Route verweist auf vorhandene Aufgaben. Ihr Öffnen startet keine Zeit und bestätigt nichts. */
export default function TaskFocus() {
  const { kind, id } = useParams<{ kind: string; id: string }>()
  const st = useApp()
  const reference: TaskRef | undefined = id && (kind === 'task' || kind === 'work') ? { kind, id } : undefined
  const task = reference ? resolveTask(reference, st.inbox, st.local.work) : undefined
  if (!reference || !task) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-5 pb-8 safe-top">
        <h1 className="text-2xl font-semibold">Aufgabe nicht verfügbar</h1>
        <p className="text-muted">Du kannst in der Liste eine andere Aufgabe wählen.</p>
        <Link to={kind === 'work' ? '/arbeit' : '/inbox'} className="flex min-h-12 items-center text-accent">Zur Aufgabenliste</Link>
      </div>
    )
  }
  return <TaskFocusBody key={`${reference.kind}:${reference.id}`} reference={reference} task={task} />
}

function TaskFocusBody({ reference, task }: { reference: TaskRef; task: InboxItem | WorkTask }) {
  const st = useApp()
  const [search, setSearch] = useSearchParams()
  const open = taskIsOpen(task)
  const currentTarget = st.local.focus?.target
  const currentPartId = currentTarget && currentTarget.kind === reference.kind && currentTarget.id === reference.id ? currentTarget.partId : undefined
  const partId = search.has('teil') ? search.get('teil') || undefined : currentPartId
  const part = partId ? task.subtasks?.find((item) => item.id === partId) : undefined
  const unavailablePart = partId !== undefined && (!part || part.doneAt !== undefined)
  const target = { ...reference, ...(partId ? { partId } : {}) }
  const activeFocus = open && !unavailablePart && st.local.focus && sameFocusTarget(st.local.focus.target, target) ? st.local.focus : undefined
  const focus = activeFocus ?? (open && !unavailablePart ? st.local.focusHistory?.find((saved) => sameFocusTarget(saved.target, target)) : undefined)
  const now = useFocusClock(focus?.timer)
  useFocusPulse(activeFocus, now)
  const title = taskTitle(task)
  const nextStep = part?.title ?? taskNextStep(task, title)
  const route = `/aufgabe/${reference.kind}/${encodeURIComponent(reference.id)}${partId ? `?teil=${encodeURIComponent(partId)}` : ''}`
  const back = reference.kind === 'work' ? '/arbeit' : '/inbox'
  const savedResume = st.local.resume
  const resumeNote = task.resumeNote ?? (savedResume?.kind === reference.kind && savedResume.refId === reference.id ? savedResume.note : undefined)
  const context = useMemo<ResumePoint>(() => ({ kind: reference.kind, title, nextStep, refId: reference.id, ...(partId ? { partId } : {}), route, at: Date.now(), ...(resumeNote ? { note: resumeNote } : {}) }), [reference.kind, reference.id, partId, title, nextStep, route, resumeNote])
  const [minutes, setMinutes] = useState(() => focus ? focus.timer.durationMs / 60_000 : 25)
  const [partMinutes, setPartMinutes] = useState(() => new Map<string, number>())
  const duration = partId ? partMinutes.get(partId) ?? part?.timerMin ?? part?.estimateMin ?? 5 : minutes
  const [interrupting, setInterrupting] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)
  const [resumeStep, setResumeStep] = useState(nextStep)
  const [note, setNote] = useState('')
  const [confirmDuration, setConfirmDuration] = useState(false)
  const [confirmedMinutes, setConfirmedMinutes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const timer = focus?.timer
  const left = timer ? remainingMs(timer, now) : undefined
  const expired = left === 0
  const paused = timer?.status === 'paused'

  const run = async (action: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Die Änderung konnte nicht sicher gespeichert werden. Bitte versuche es erneut.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  // Start, neues Zeitfenster und Weiter werden mit Taskzustand/Resume atomar gespeichert.
  const start = () => run(async () => {
    const selectedMinutes = Number(duration)
    if (!Number.isFinite(selectedMinutes) || selectedMinutes <= 0 || selectedMinutes > 1440) throw new Error('Wähle eine Dauer über 0 bis 1440 Minuten.')
    await st.startTaskFocus(reference, selectedMinutes, partId)
    if (partId) setSearch({ teil: partId }, { replace: true })
  })
  const continueFocus = () => run(() => st.startTaskFocus(reference, undefined, partId))
  const completePart = () => run(() => st.setTaskPartDone(reference, partId!, true))
  const complete = (minimal = false) => run(async () => {
    const learned = st.local.taskLearning?.enabled && confirmDuration ? Number(confirmedMinutes) : undefined
    if (learned !== undefined && (!Number.isFinite(learned) || learned < 1 || learned > 480)) {
      throw new Error('Trage deine bestätigte Dauer zwischen 1 und 480 Minuten ein oder lasse sie offen.')
    }
    await st.completeTask(reference, true, minimal, learned)
    st.showToast(minimal ? 'Kleine Version als erledigt gespeichert.' : 'Als erledigt gespeichert.')
  })
  const beginInterruption = () => {
    if (!interrupting) {
      setResumeStep(nextStep)
      const saved = st.local.resume
      setNote(task.resumeNote ?? (saved?.kind === reference.kind && saved.refId === reference.id ? saved.note ?? '' : ''))
    }
    setInterrupting(!interrupting)
  }

  const choices = [{ value: '', label: 'Gesamte Aufgabe' }, ...(unavailablePart ? [{ value: partId!, label: 'Teilschritt nicht verfügbar' }] : []), ...(task.subtasks?.filter(item => item.doneAt === undefined).map(item => ({ value: item.id, label: item.title })) ?? [])]
  const targetChoice = <Choice label="Fokus für" disabled={busy} value={partId ?? ''} options={choices} onChange={value => { setSearch({ teil: value }); setInterrupting(false); setStopOpen(false) }} />
  const finish = () => partId ? completePart() : complete()
  return <>
    <FocusFrame back={back} context={<>{reference.kind === 'work' ? 'Arbeitsaufgabe' : 'Deine Aufgabe'} · {taskStateLabel(task)}</>} capture={open && !unavailablePart ? context : undefined}
      footer={open && !unavailablePart ? <>
        {(!timer || expired) ? <Button disabled={busy} variant="primary" size="xl" className="w-full" onClick={() => void start()}>{expired ? 'Neues Zeitfenster starten' : 'Fokus starten'} · {String(duration).replace('.', ',')} min</Button>
          : <Button disabled={busy} variant="primary" size="xl" className="w-full" onClick={() => void (paused ? continueFocus() : run(() => st.pauseTaskFocus(reference, undefined, undefined, partId)))}>{paused ? 'Weiter' : 'Pause'}</Button>}
        <div className={`grid min-w-0 gap-2 ${timer ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Button disabled={busy} size="lg" className="min-w-0" onClick={() => void finish()}>{partId ? 'Teilschritt erledigt' : 'Erledigt'}</Button>
          {timer && <Button disabled={busy} variant="ghost" size="lg" onClick={() => { setInterrupting(false); setStopOpen(true) }}>Stopp</Button>}
        </div>
      </> : undefined}
      details={open && !unavailablePart ? <details className="min-w-0 space-y-3"><summary className="min-h-11 py-2 text-muted">Details & Abschluss</summary>
        <TaskPurpose taskRef={reference} task={task} />
        <Choice<FocusPulseMode> label="Fokus-Puls" value={st.settings.focus.pulse} options={[{ value: 'off', label: 'Aus' }, { value: 'gentle', label: 'Sanft' }, { value: 'strong', label: 'Deutlich' }]} onChange={pulse => void run(() => st.saveSettings(settings => ({ ...settings, focus: { ...settings.focus, pulse } })))} />
        {task.description && <p className="whitespace-pre-wrap break-words text-muted">{task.description}</p>}
        {!!task.subtasks?.length && <Section title="Kleine Schritte">{task.subtasks.map(part => <Checkbox key={part.id} disabled={busy} checked={part.doneAt !== undefined} aria-label={`Schritt erledigt: ${part.title}`} onChange={done => void run(() => st.setTaskPartDone(reference, part.id, done))}>{part.title}</Checkbox>)}</Section>}
        {st.local.taskLearning?.enabled && <div className="space-y-3 rounded-2xl border border-line p-3"><Checkbox checked={confirmDuration} onChange={setConfirmDuration}>Meine tatsächliche Dauer für Schätzvorschläge bestätigen</Checkbox>
          {confirmDuration && <label className="block space-y-1"><span>Tatsächliche Dauer in Minuten</span><TextInput aria-label="Bestätigte tatsächliche Dauer" type="number" min="1" max="480" step="1" inputMode="decimal" value={confirmedMinutes} onChange={event => setConfirmedMinutes(event.target.value)} placeholder="Zum Beispiel 18" /></label>}
          <p className="text-sm text-muted">Nur deine bestätigte Dauer fließt in lokale Vorschläge ein.</p>
        </div>}
        <Button disabled={busy} variant="ghost" className="w-full" onClick={() => void complete(true)}>{partId ? 'Gesamte Aufgabe klein erledigt' : 'Kleine Version erledigt'}</Button>
        {partId && <Button disabled={busy} className="w-full" onClick={() => void complete()}>Gesamte Aufgabe erledigt</Button>}
        <p className="text-sm text-muted">Fokuszeit ist keine Arbeitszeitbuchung. Ein abgelaufenes Zeitfenster bestätigt keine Erledigung.</p>
      </details> : undefined}>
      {error && <p role="alert" className="rounded-2xl border border-warm p-3 text-warm">{error}</p>}
      {open && !unavailablePart && !timer && (!!task.subtasks?.length || partId) && targetChoice}
      {nextStep !== title && <p className="break-words text-muted">{title}</p>}
      {part && !unavailablePart && <p className="text-sm text-muted">Teilschritt</p>}
      <h1 className="break-words text-3xl font-semibold leading-tight sm:text-4xl">{unavailablePart && open ? 'Teilschritt nicht verfügbar' : open ? nextStep : title}</h1>
      {open && resumeNote && <p className="whitespace-pre-wrap break-words text-sm text-muted">Für den Wiedereinstieg: {resumeNote}</p>}
      {!open ? <div className="space-y-3"><p className="text-xl text-accent">{taskStateLabel(task)}</p>
        <Button disabled={busy} variant="primary" onClick={() => void run(() => task.done ? st.completeTask(reference, false) : st.setTaskState(reference, 'pending'))}>{task.done ? 'Erledigung zurücknehmen' : 'Aufgabe wieder öffnen'}</Button>
        <Link to={back} className="flex min-h-12 items-center justify-center text-accent">Zur Aufgabenliste</Link>
      </div> : unavailablePart ? <div className="space-y-3"><p className="text-muted">{part?.doneAt !== undefined ? 'Dieser Teilschritt ist bereits erledigt.' : 'Dieser Teilschritt ist nicht mehr in der Aufgabe.'} Wähle einen offenen Schritt oder die gesamte Aufgabe.</p>{targetChoice}<p className="text-sm text-muted">Hier startet kein Timer von selbst.</p></div> : <>
        {timer && <>
          <RingTimer remainingSec={Math.ceil((left ?? 0) / 1000)} totalSec={timer.durationMs / 1000} paused={paused} pulse={st.settings.focus.pulse} label="Restzeit im Fokus" />
          <p className="text-sm text-muted">{paused ? 'Pausiert' : `Bis ${clockTime(timer.deadlineAt)}`} · {Math.floor(elapsedMs(timer, now) / 60_000)} min vergangen</p>
          {expired && <p className="text-sm text-muted">Zeitfenster zu Ende. Du entscheidest, wie du weitermachst.</p>}
        </>}
        {(!timer || expired) && <div className="min-w-0 space-y-3">
          {!taskIsActionable(task, now) && <p className="text-sm text-muted">Für später vorgesehen. Du entscheidest, ob du jetzt anfangen möchtest.</p>}
          <DurationPicker label={partId ? 'Teilschritt-Timer Minuten' : 'Fokuszeit'} value={duration} options={partId ? [2, 5, 10, 15] : [15, 25, 40, 50]} onChange={value => partId ? setPartMinutes(current => new Map(current).set(partId, value)) : setMinutes(value)} />
          {st.local.focus && !activeFocus && st.local.focus.timer.status === 'running' && <p className="text-sm text-muted">Der andere Timer läuft weiter, bis du diesen Fokus startest.</p>}
        </div>}
      </>}
    </FocusFrame>
    <Sheet open={stopOpen} onClose={() => { setStopOpen(false); setInterrupting(false) }} title={interrupting ? 'Wiedereinstieg merken' : 'Fokus stoppen'}>
      {interrupting ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run(async () => { await st.pauseTaskFocus(reference, partId ? undefined : resumeStep.trim() || undefined, note.trim(), partId); setInterrupting(false); setStopOpen(false); st.showToast('Dein nächster Schritt bleibt erhalten.') }) }}>
        {!partId && <label className="block space-y-1"><span>Nächster kleiner Schritt</span><TextInput aria-label="Nächster kleiner Schritt" value={resumeStep} onChange={event => setResumeStep(event.target.value)} /></label>}
        <label className="block space-y-1"><span>Wenn ich zurückkomme …</span><textarea aria-label="Wenn ich zurückkomme" value={note} onChange={event => setNote(event.target.value)} rows={2} className="w-full rounded-xl bg-surface-2 p-3" /></label>
        <Button disabled={busy} type="submit" variant="primary" className="w-full">Pause und Wiedereinstieg merken</Button>
      </form> : <div className="space-y-3">
        {activeFocus && <Button variant="primary" className="w-full" onClick={beginInterruption}>Unterbrochen – Wiedereinstieg merken</Button>}
        {focus && <Button className="w-full" onClick={() => void run(async () => { await st.clearFocus(focus.id); setStopOpen(false) })}>Einfach beenden</Button>}
        {!!task.subtasks?.length && <details className="space-y-3"><summary className="min-h-11 py-2 text-muted">Anderen Schritt wählen</summary>{targetChoice}<p className="text-sm text-muted">Der bisherige Timer bleibt erhalten, bis du einen anderen startest.</p></details>}
        <p className="text-sm text-muted">Beenden erledigt keine Aufgabe.</p>
      </div>}
    </Sheet>
  </>
}

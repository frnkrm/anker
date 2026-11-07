import { useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { countdownText, elapsedMs, remainingMs, sameFocusTarget } from '../../core/focus'
import { resolveTask, taskIsActionable, taskIsOpen, taskNextStep, taskStateLabel, taskTitle } from '../../core/tasks'
import type { InboxItem, ResumePoint, TaskRef, WorkTask } from '../../core/types'
import { useFocusClock, useFocusPulse } from '../../state/useFocusClock'
import { useApp } from '../../state/store'
import { InboxButton } from '../components/Shell'
import { TaskPurpose } from '../components/TaskPurpose'
import { Button, Card, Progress, Section, Segmented, TextInput } from '../components/ui'

const WINDOWS = [15, 25, 40, 50] as const
type FocusMinutes = typeof WINDOWS[number]
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
  const [minutes, setMinutes] = useState<FocusMinutes>(() => {
    const saved = focus ? focus.timer.durationMs / 60_000 : 25
    return WINDOWS.find((value) => value === saved) ?? 25
  })
  const [partMinutes, setPartMinutes] = useState(() => new Map<string, string>())
  const duration = partId ? partMinutes.get(partId) ?? String(part?.timerMin ?? part?.estimateMin ?? 25) : String(minutes)
  const [interrupting, setInterrupting] = useState(false)
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-5 pb-8 safe-top">
      <header className="flex min-h-12 items-center justify-between gap-2">
        <Link to={back} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl text-muted" aria-label="Aufgabenfokus verlassen">‹</Link>
        <p className="min-w-0 flex-1 break-words text-center text-sm text-muted">{reference.kind === 'work' ? 'Arbeitsaufgabe' : 'Deine Aufgabe'} · {taskStateLabel(task)}</p>
        {open && !unavailablePart && <div className="flex w-12 shrink-0"><InboxButton context={context} /></div>}
      </header>

      {error && <p role="alert" className="rounded-2xl border border-warm p-3 text-warm">{error}</p>}

      <section className="flex flex-1 flex-col justify-center py-4">
        {open && (!!task.subtasks?.length || partId) && <label className="mb-5 block min-w-0 space-y-1"><span className="text-sm text-muted">Fokus für</span><select aria-label="Fokus für" disabled={busy} className="min-h-12 w-full min-w-0 rounded-xl bg-surface-2 px-3" value={partId ?? ''} onChange={(event) => { setSearch({ teil: event.target.value }); setInterrupting(false) }}><option value="">Gesamte Aufgabe</option>{unavailablePart && <option value={partId}>Teilschritt nicht verfügbar</option>}{task.subtasks?.filter((item) => item.doneAt === undefined).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
        {nextStep !== title && <p className="mb-2 break-words text-muted">{title}</p>}
        {part && !unavailablePart && <p className="mb-2 text-sm text-accent">Teilschritt</p>}
        <h1 className="break-words text-3xl font-semibold leading-tight">{unavailablePart && open ? 'Teilschritt nicht verfügbar' : open ? nextStep : title}</h1>
        {open && resumeNote && <p className="mt-3 whitespace-pre-wrap break-words text-muted">Für den Wiedereinstieg: {resumeNote}</p>}
        {!open ? (
          <div className="mt-6 space-y-3">
            <p className="text-xl text-accent">{taskStateLabel(task)}</p>
            <Button disabled={busy} variant="ghost" onClick={() => void run(() => task.done ? st.completeTask(reference, false) : st.setTaskState(reference, 'pending'))}>
              {task.done ? 'Erledigung zurücknehmen' : 'Aufgabe wieder öffnen'}
            </Button>
            <Link to={back} className="flex min-h-12 items-center text-accent">Zur Aufgabenliste</Link>
          </div>
        ) : unavailablePart ? <div className="mt-6 space-y-3"><p className="text-muted">{part?.doneAt !== undefined ? 'Dieser Teilschritt ist bereits erledigt.' : 'Dieser Teilschritt ist nicht mehr in der Aufgabe.'} Wähle oben einen offenen Schritt oder die gesamte Aufgabe.</p><p className="text-sm text-muted">Hier startet kein Timer von selbst.</p></div> : (
          <>
            {timer && (
              <div className="mt-7 space-y-3 text-center">
                <div role="timer" aria-live="off" aria-label={`Restzeit ${countdownText(timer, now)}`} className={`${countdownText(timer, now).length > 5 ? 'text-3xl sm:text-5xl' : 'text-5xl sm:text-6xl'} font-light tabular-nums`}>{countdownText(timer, now)}</div>
                <Progress label="Abgelaufene Fokuszeit" value={timer.durationMs ? Math.min(1, elapsedMs(timer, now) / timer.durationMs) : 0} />
                <p className="text-sm text-muted">{paused ? 'Pausiert' : `Zeitfenster bis ${clockTime(timer.deadlineAt)}`} · verstrichen: {Math.floor(elapsedMs(timer, now) / 60_000)} min</p>
                {expired && <p className="text-muted">Zeitfenster zu Ende. Du entscheidest, ob du weiterarbeitest, abschließt oder pausierst.</p>}
              </div>
            )}
            {(!timer || expired) && (
              <div className="mt-6 space-y-3">
                {!taskIsActionable(task, now) && <p className="text-sm text-muted">Für später vorgesehen. Du entscheidest, ob du jetzt damit anfangen möchtest.</p>}
                {partId ? <label className="block space-y-1"><span>Dauer in Minuten</span><TextInput aria-label="Teilschritt-Timer Minuten" type="number" min="0.01" max="1440" step="any" inputMode="decimal" value={duration} onChange={(event) => setPartMinutes((current) => new Map(current).set(partId, event.target.value))} /></label> : <Segmented<FocusMinutes> label="Fokuszeit" value={minutes} onChange={setMinutes} options={WINDOWS.map((value) => ({ value, label: `${value} min` }))} />}
                {st.local.focus && !activeFocus && st.local.focus.timer.status === 'running' && <p className="text-sm text-muted">Der andere Timer läuft weiter, bis du diesen Fokus startest.</p>}
                <Button disabled={busy} variant="primary" size="xl" className="w-full" onClick={() => void start()}>{expired ? 'Neues Zeitfenster starten' : 'Fokus starten'}</Button>
              </div>
            )}
            {timer && !expired && (
              <div className="mt-6 grid gap-3">
                <Button disabled={busy} variant="primary" size="xl" className="w-full" onClick={() => void (paused ? continueFocus() : partId ? completePart() : complete())}>{paused ? 'Weiter' : partId ? 'Teilschritt erledigt' : 'Erledigt'}</Button>
                {!paused && <Button disabled={busy} size="lg" className="w-full" onClick={() => void run(() => st.pauseTaskFocus(reference, undefined, undefined, partId))}>Pause</Button>}
              </div>
            )}
            {(!timer || paused || expired) && <Button disabled={busy} size="lg" className="mt-3 w-full" onClick={() => void (partId ? completePart() : complete())}>{partId ? 'Teilschritt erledigt' : 'Erledigt'}</Button>}
            {timer && <Button disabled={busy} variant="ghost" size="lg" className="mt-3 w-full" onClick={() => void run(() => st.clearFocus(focus!.id))}>Timer beenden</Button>}
            {(!partId || activeFocus) && <Button disabled={busy} variant="ghost" size="lg" className="mt-3 w-full" aria-expanded={interrupting} onClick={beginInterruption}>Ich wurde unterbrochen</Button>}
          </>
        )}
      </section>

      {open && !unavailablePart && interrupting && (
        <Card>
          <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              await st.pauseTaskFocus(reference, partId ? undefined : resumeStep.trim() || undefined, note.trim(), partId)
              setInterrupting(false)
              st.showToast('Gesichert. Dein nächster Schritt bleibt erhalten.')
            })
          }}>
            {!partId && <label className="block space-y-1"><span>Nächster kleiner Schritt</span><TextInput aria-label="Nächster kleiner Schritt" value={resumeStep} onChange={(event) => setResumeStep(event.target.value)} /></label>}
            <label className="block space-y-1"><span>Wenn ich zurückkomme … (freiwillig)</span><textarea aria-label="Wenn ich zurückkomme" value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="w-full rounded-xl bg-surface-2 p-3" /></label>
            <Button disabled={busy} type="submit" variant="primary" className="w-full">Pause und Wiedereinstieg merken</Button>
          </form>
        </Card>
      )}

      {open && !unavailablePart && (
        <details className="space-y-3">
          <summary className="min-h-11 py-2 text-muted">Details & Abschluss</summary>
          <TaskPurpose taskRef={reference} task={task} />
          {task.description && <p className="whitespace-pre-wrap break-words text-muted">{task.description}</p>}
          {!!task.subtasks?.length && (
            <Section title="Kleine Schritte">
              {task.subtasks.map((part) => (
                <label key={part.id} className="flex min-h-12 items-center gap-3 rounded-xl bg-surface px-3 py-2">
                  <input type="checkbox" disabled={busy} checked={part.doneAt !== undefined} aria-label={`Schritt erledigt: ${part.title}`} className="h-5 w-5 shrink-0 accent-[var(--accent)]" onChange={(event) => {
                    const done = event.target.checked
                    void run(() => st.setTaskPartDone(reference, part.id, done))
                  }} />
                  <span className="min-w-0 break-words">{part.title}</span>
                </label>
              ))}
            </Section>
          )}
          {st.local.taskLearning?.enabled && (
            <div className="space-y-3 rounded-2xl border border-line p-3">
              <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={confirmDuration} onChange={(event) => setConfirmDuration(event.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--accent)]" /><span>Meine tatsächliche Dauer für Schätzvorschläge bestätigen</span></label>
              {confirmDuration && <label className="block space-y-1"><span>Tatsächliche Dauer in Minuten</span><TextInput aria-label="Bestätigte tatsächliche Dauer" type="number" min="1" max="480" step="1" inputMode="decimal" value={confirmedMinutes} onChange={(event) => setConfirmedMinutes(event.target.value)} placeholder="Zum Beispiel 18" /></label>}
              <p className="text-sm text-muted">Freiwillig. Nur deine bestätigte Dauer fließt in lokale Vorschläge ein.</p>
            </div>
          )}
          <Button disabled={busy} variant="ghost" className="w-full" onClick={() => void complete(true)}>{partId ? 'Gesamte Aufgabe klein erledigt' : 'Kleine Version erledigt'}</Button>
          {partId && <Button disabled={busy} className="w-full" onClick={() => void complete()}>Gesamte Aufgabe erledigt</Button>}
          <p className="text-sm text-muted">Fokuszeit ist keine Arbeitszeitbuchung. Ein abgelaufenes Zeitfenster bestätigt keine Erledigung.</p>
        </details>
      )}
    </div>
  )
}

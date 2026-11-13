import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { randomId } from '../../core/defaults'
import { fromBerlinDateTimeInput, toBerlinDateTimeInput } from '../../core/evening'
import { deadlineRisk } from '../../core/support'
import { decomposeTask, taskDurationEvidence, taskIsOpen, taskNextStep, taskStateLabel, resolveTask, taskTitle, type TaskDetailDepth } from '../../core/tasks'
import { germanDateTime, minuteText, plural } from '../../core/uiText'
import { addDays, zonedToUtc } from '../../core/time'
import type { InboxItem, TaskFields, TaskPart, TaskRef, WorkTask } from '../../core/types'
import { today, useApp } from '../../state/store'
import { SortableList } from './Sortable'
import { TaskAssistance } from './TaskAssistance'
import { Button, Card, Checkbox, Choice, DateField, DurationPicker, Segmented, Stepper, TextInput, Toggle } from './ui'

const FIELD = 'min-h-12 min-w-0 w-full max-w-full rounded-xl bg-surface-2 px-3'

export function useTaskAction() {
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const run = async (action: () => Promise<unknown>, success = '', throwOnError = false) => {
    if (pending.current) {
      if (throwOnError) throw new Error('Eine Änderung wird noch gespeichert.')
      return
    }
    pending.current = true
    setBusy(true); setError(''); setMessage('')
    try { await action(); setMessage(success) } catch (cause) {
      // SortableList bestätigt selbst erst nach erfolgreicher Speicherung.
      if (throwOnError) throw cause
      setError(cause instanceof Error ? cause.message : 'Die Änderung konnte nicht sicher gespeichert werden. Bitte versuche es erneut.')
    } finally { pending.current = false; setBusy(false) }
  }
  return { busy, error, message, run }
}

export function TaskCard({ taskRef, task, first = false, children, moveToTop }: { taskRef: TaskRef; task: InboxItem | WorkTask; first?: boolean; children?: ReactNode; moveToTop?: () => Promise<void> }) {
  const st = useApp()
  const nav = useNavigate()
  const [details, setDetails] = useState(false)
  const [minutes, setMinutes] = useState(25)
  const [interrupt, setInterrupt] = useState(false)
  const { busy, error, message, run } = useTaskAction()
  const title = taskTitle(task)
  const risk = 'title' in task ? deadlineRisk(task, Date.now()) : 'none'
  const riskText = { none: undefined, today: 'Frist ist heute', soon: 'Frist rückt näher', past: 'Frist erreicht' }[risk]
  const inProgress = task.state === 'active' || task.state === 'paused'
  const focused = st.local.focus?.target
  const resume = st.local.resume
  const partId = inProgress ? focused?.kind === taskRef.kind && focused.id === taskRef.id ? focused.partId
    : resume?.kind === taskRef.kind && resume.refId === taskRef.id ? resume.partId : undefined : undefined
  const next = task.subtasks?.find((part) => part.id === partId && part.doneAt === undefined)?.title ?? taskNextStep(task, title)
  const start = () => run(async () => {
    await st.startTaskFocus(taskRef, partId ? undefined : minutes, partId)
    nav(`/aufgabe/${taskRef.kind}/${encodeURIComponent(taskRef.id)}${partId ? `?teil=${encodeURIComponent(partId)}` : ''}`)
  })
  const later = () => {
    const date = addDays(today(), 1)
    return run(() => st.updateTask(taskRef, { taskDate: date, state: 'deferred', deferredUntil: zonedToUtc(date, 240) }), 'Für morgen eingeplant.')
  }
  const timing = task.deadline !== undefined ? `Frist ${germanDateTime(task.deadline, true)}`
    : task.earliestStart !== undefined && task.earliestStart > Date.now() ? `Ab ${germanDateTime(task.earliestStart, true)}` : undefined
  const meta = [task.state && task.state !== 'pending' ? taskStateLabel(task) : undefined, timing, riskText].filter(Boolean).join(' · ')
  return <Card className="min-w-0 space-y-3">
    {first && <p className="text-sm text-accent">Zuerst</p>}
    <h3 className="break-words text-lg font-semibold">{title}</h3>
    {next !== title && <p className="break-words text-muted">Nächster Schritt: {next}</p>}
    {meta && <p className="break-words text-sm text-muted">{meta}</p>}
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_44px] gap-1">
      <Button size="sm" variant={first ? 'primary' : 'secondary'} className="min-w-0 !px-2" disabled={busy} onClick={start}><span className="min-w-0"><span className="block">{inProgress ? 'Weiter' : 'Starten'}</span>{!partId && <span className="block text-xs">{minutes} min</span>}</span></Button>
      <Button size="sm" className="min-w-0 !px-2" disabled={busy} onClick={() => run(() => st.completeTask(taskRef, true))}>Erledigt</Button>
      <Button size="sm" variant="ghost" className="!w-11 !min-w-11 !px-0" aria-label="Details" title="Details" onClick={() => setDetails(!details)} aria-expanded={details}>⋯</Button>
    </div>
    {task.state === 'active' && <Button size="sm" disabled={busy} onClick={() => setInterrupt(!interrupt)} aria-expanded={interrupt}>Ich wurde unterbrochen</Button>}
    {interrupt && <form className="space-y-2" onSubmit={(event) => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      const nextStep = String(form.get('next') ?? '').trim()
      const note = String(form.get('note') ?? '').trim()
      void run(async () => { await st.pauseTaskFocus(taskRef, nextStep || undefined, note, partId); setInterrupt(false) }, 'Gemerkt. Dein nächster Schritt bleibt erhalten.')
    }}>
      <TextInput name="next" aria-label="Wo machst du weiter?" defaultValue={next !== title ? next : ''} placeholder="Zum Beispiel: Tabelle öffnen" />
      <TextInput name="note" aria-label="Wenn ich zurückkomme" defaultValue={task.resumeNote ?? ''} placeholder="Wenn ich zurückkomme …" />
      <Button type="submit" size="sm" disabled={busy}>Merken</Button>
    </form>}
    {children}
    {details && <>
      <DurationPicker label="Fokusblock" value={minutes} options={[15, 25, 40, 50]} onChange={setMinutes} />
      <p className="text-xs text-muted">Der Fokusblock ist eine Zeit zum Arbeiten. Sein Ende erledigt keine Aufgabe und bucht keine Arbeitszeit.</p>
      <TaskDetails taskRef={taskRef} task={task} />
      <div className="flex flex-wrap gap-2">
                {moveToTop && <Button size="sm" disabled={busy} onClick={() => run(moveToTop)}>Nach vorn</Button>}
        {taskRef.kind === 'task' && <Button size="sm" disabled={busy} onClick={later}>Morgen weiter</Button>}
        <Button size="sm" disabled={busy} onClick={() => run(() => st.completeTask(taskRef, true, true))}>Kleine Version erledigt</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => st.setTaskState(taskRef, 'not-needed'))}>Nicht nötig</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => st.setTaskState(taskRef, 'cancelled'))}>Absagen</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => st.removeTask(taskRef))}>Entfernen</Button>
      </div>
    </>}
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </Card>
}

function TaskDetails({ taskRef, task }: { taskRef: TaskRef; task: InboxItem | WorkTask }) {
  const st = useApp()
  const nav = useNavigate()
  const title = taskTitle(task)
  const [draft, setDraft] = useState({
    title, description: task.description ?? '', why: task.why ?? '', nextStep: task.nextStep ?? '', estimate: task.estimateMin?.toString() ?? '',
    priority: task.priority ?? 'normal', context: task.context ?? 'any', energy: (task.energy ?? '') as NonNullable<TaskFields['energy']> | '',
    deadline: task.deadline === undefined ? '' : toBerlinDateTimeInput(task.deadline),
    earliest: task.earliestStart === undefined ? '' : toBerlinDateTimeInput(task.earliestStart),
    date: 'taskDate' in task ? task.taskDate ?? today() : today(),
    repeat: !!task.recurrence, everyDays: task.recurrence?.everyDays ?? 7,
  })
  const [depth, setDepth] = useState<TaskDetailDepth>('three')
  const [preview, setPreview] = useState<TaskPart[]>()
  const [partTitle, setPartTitle] = useState('')
  const { busy, error, message, run } = useTaskAction()
  const parts = task.subtasks ?? []
  const learning = st.local.taskLearning
  const evidence = taskDurationEvidence(taskRef, task, learning?.samples ?? [], st.inbox, st.local.work)
  const suggestion = learning?.enabled ? evidence.suggestion : undefined
  const updateDraft = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const save = () => run(async () => {
    if (!draft.title.trim()) throw new Error('Ein Titel genügt; er darf nicht leer sein.')
    if (taskRef.kind === 'task' && !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) throw new Error('Wähle einen Tag für deine Aufgabe.')
    const deadline = draft.deadline ? fromBerlinDateTimeInput(draft.deadline) : undefined
    const earliestStart = draft.earliest ? fromBerlinDateTimeInput(draft.earliest) : undefined
    if ((deadline !== undefined && !Number.isFinite(deadline)) || (earliestStart !== undefined && !Number.isFinite(earliestStart))) throw new Error('Prüfe Datum und Uhrzeit. Diese Berliner Uhrzeit ist so nicht gültig.')
    const estimateMin = draft.estimate.trim() ? Number(draft.estimate) : undefined
    if (estimateMin !== undefined && (!Number.isFinite(estimateMin) || estimateMin <= 0 || estimateMin > 1440)) throw new Error('Wähle eine grobe Schätzung zwischen 1 und 1440 Minuten oder lasse sie offen.')
    const patch: TaskFields & { text?: string; title?: string; taskDate?: string } = {
      ...(taskRef.kind === 'task' ? { text: draft.title.trim(), taskDate: draft.date } : { title: draft.title.trim() }),
      description: draft.description.trim() || undefined, why: draft.why.trim() || undefined, nextStep: draft.nextStep.trim() || undefined,
      estimateMin, deadline, earliestStart, priority: draft.priority, context: draft.context,
      energy: draft.energy || undefined,
      recurrence: draft.repeat ? { seriesId: task.recurrence?.seriesId ?? task.id, everyDays: draft.everyDays, occurrenceDate: task.recurrence?.occurrenceDate ?? draft.date } : undefined,
    }
    if (taskRef.kind === 'task' && draft.date > today()) { patch.state = 'deferred'; patch.deferredUntil = zonedToUtc(draft.date, 240) }
    if (taskRef.kind === 'task' && draft.date <= today() && task.state === 'deferred') { patch.state = 'pending'; patch.deferredUntil = undefined }
    await st.updateTask(taskRef, patch)
  }, 'Details gespeichert.')
  const updatePart = (id: string, patch: Partial<TaskPart>) => run(async () => {
    const state = useApp.getState()
    const current = resolveTask(taskRef, state.inbox, state.local.work)
    if (!current?.subtasks?.some(part => part.id === id)) return
    await st.replaceTaskParts(taskRef, current.subtasks.map(part => part.id === id ? { ...part, ...patch } : part))
  }, 'Teilschritt gespeichert.')
  return <div className="min-w-0 space-y-4 border-t border-line pt-3">
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); void save() }}>
      <fieldset disabled={busy} className="min-w-0 space-y-3">
        <label className="block space-y-1"><span className="text-sm text-muted">Titel *</span><TextInput aria-label="Titel" value={draft.title} onChange={event => updateDraft('title', event.target.value)} /></label>
        <label className="block space-y-1"><span className="text-sm text-muted">Nächster Schritt</span><TextInput aria-label="Nächster Schritt" value={draft.nextStep} onChange={event => updateDraft('nextStep', event.target.value)} /></label>
        <DateField label="Frist" type="datetime-local" value={draft.deadline} onChange={value => updateDraft('deadline', value)} />
        <details className="space-y-3"><summary className="min-h-11 py-2 text-muted">Weitere Angaben</summary>
          <label className="block space-y-1"><span className="text-sm text-muted">Wofür ist dir das wichtig?</span><TextInput aria-label="Mein Grund für die Aufgabe" value={draft.why} onChange={event => updateDraft('why', event.target.value)} placeholder="Ein eigener Grund, wenn er dir hilft" /></label>
          <label className="block space-y-1"><span className="text-sm text-muted">Beschreibung</span><textarea aria-label="Beschreibung" className={FIELD + ' py-3'} rows={3} value={draft.description} onChange={event => updateDraft('description', event.target.value)} /></label>
          <label className="block space-y-1"><span className="text-sm text-muted">Grob geschätzt, Minuten</span><input type="number" aria-label="Schätzung Minuten" className={FIELD} min={1} max={1440} value={draft.estimate} onChange={event => updateDraft('estimate', event.target.value)} placeholder="Offen" /></label>
          {taskRef.kind === 'task' && <DateField label="Aufgabentag" value={draft.date} onChange={value => updateDraft('date', value)} />}
          <DateField label="Frühestens ab" type="datetime-local" value={draft.earliest} onChange={value => updateDraft('earliest', value)} />
          <Choice<NonNullable<TaskFields['priority']>> label="Priorität" value={draft.priority} onChange={value => updateDraft('priority', value)} options={[{ value: 'low', label: 'Kann warten' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'Wichtig' }]} />
          <Choice<NonNullable<TaskFields['context']>> label="Aufgabenkontext" value={draft.context} onChange={value => updateDraft('context', value)} options={[{ value: 'any', label: 'Überall' }, { value: 'home', label: 'Zuhause' }, { value: 'work', label: 'Arbeit' }, { value: 'errand', label: 'Unterwegs' }]} />
          <Choice<typeof draft.energy> label="Benötigte Energie" value={draft.energy} onChange={value => updateDraft('energy', value)} options={[{ value: '', label: 'Offen' }, { value: 'low', label: 'Wenig' }, { value: 'medium', label: 'Mittel' }, { value: 'high', label: 'Viel' }]} />
          <Checkbox checked={draft.repeat} onChange={value => updateDraft('repeat', value)}>Aufgabe wiederholen</Checkbox>
          {draft.repeat && <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><span>Abstand in Tagen</span><Stepper label="Wiederholungsabstand" value={draft.everyDays} min={1} max={366} onChange={value => updateDraft('everyDays', value)} /></div><p className="text-xs text-muted">Jede Ausführung bleibt getrennt. Nach einer Pause erscheint nur die nächste künftige Wiederholung.</p></div>}
        </details>
        <Button type="submit" disabled={busy} className="w-full">Übernehmen</Button>
      </fieldset>
    </form>
    {learning?.enabled && <div className="space-y-2 rounded-xl bg-surface-2 p-3">
      {suggestion === undefined ? <p className="text-sm text-muted">{plural(evidence.count, 'brauchbare zuordenbare Bestätigung', 'brauchbare zuordenbare Bestätigungen')}. Ein Vorschlag erscheint ab drei. Alte Werte ohne zuordenbare Herkunft zählen nicht mit.</p>
        : <><p className="text-sm">Aus {plural(evidence.count, 'bestätigten lokalen Zeit', 'bestätigten lokalen Zeiten')}: Vorschlag etwa {minuteText(suggestion)}.</p>
          <p className="text-xs text-muted">Vorsichtiger Richtwert für ähnlich benannte Aufgaben oder dieselbe Serie im gleichen Kontext. Wenige Angaben sind keine sichere Vorhersage.</p>
          <Button size="sm" disabled={busy} onClick={() => run(async () => { await st.updateTask(taskRef, { estimateMin: suggestion }); updateDraft('estimate', String(suggestion)) }, 'Schätzung übernommen.')}>Schätzung übernehmen</Button></>}
    </div>}
    <div className="space-y-3">
      <h4 className="font-semibold">Kleine Schritte</h4>
      <Segmented<TaskDetailDepth> label="Detailtiefe" value={depth} onChange={setDepth} options={[{ value: 'three', label: '3 Schritte' }, { value: 'normal', label: 'Normal' }, { value: 'tiny', label: 'Sehr klein' }]} />
      <Button size="sm" onClick={() => setPreview(decomposeTask(title, depth, parts))}>In kleine Schritte zerlegen</Button>
      <TaskAssistance taskRef={taskRef} task={task} depth={depth} />
      {preview && <div className="space-y-2 rounded-xl bg-surface-2 p-3"><p className="text-sm text-muted">Lokaler Vorschlag aus Vorlagen. Du kannst die offenen Schritte danach bearbeiten; erledigte Teile bleiben erhalten.</p><ol className="list-decimal space-y-1 pl-5">{preview.map((part) => <li key={part.id} className="break-words">{part.doneAt !== undefined ? '✓ ' : ''}{part.title}</li>)}</ol><div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => run(async () => { await st.replaceTaskParts(taskRef, preview); setPreview(undefined) }, 'Schritte gespeichert.')}>Vorschlag übernehmen</Button><Button size="sm" variant="ghost" onClick={() => setPreview(undefined)}>Verwerfen</Button></div></div>}
      <fieldset disabled={busy} className="min-w-0">
        <SortableList items={parts} onChange={(next) => run(() => st.replaceTaskParts(taskRef, next), '', true)} render={(part, index) => <div className="space-y-2">
          <Checkbox checked={part.doneAt !== undefined} aria-label={`Teilschritt ${part.title} erledigt`} onChange={done => void run(() => st.setTaskPartDone(taskRef, part.id, done))}>{part.title}</Checkbox>
          {part.doneAt === undefined && <TextInput name="title" aria-label={`Text Teilschritt ${index + 1}`} defaultValue={part.title} key={part.id + part.title} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }} onBlur={event => { const next = event.target.value.trim(); if (!next) { event.target.value = part.title; void run(async () => { throw new Error('Der kleine Schritt braucht einen Text. Dein bisheriger Text bleibt erhalten.') }); return } if (next !== part.title) void updatePart(part.id, { title: next }) }} />}
          <div className="flex flex-wrap gap-2"><Stepper label={`Minuten Teilschritt ${index + 1}`} value={part.estimateMin ?? 2} min={1} max={480} onChange={(value) => void run(() => st.replaceTaskParts(taskRef, parts.map((old) => old.id === part.id ? { ...old, estimateMin: value } : old)))} />{part.doneAt === undefined && <Button size="sm" variant="ghost" onClick={() => run(() => st.replaceTaskParts(taskRef, parts.filter((old) => old.id !== part.id)))}>Teilschritt entfernen</Button>}</div>
          {part.doneAt === undefined && taskIsOpen(task) && <Button size="sm" className="min-h-11" disabled={busy} onClick={() => nav(`/aufgabe/${taskRef.kind}/${encodeURIComponent(taskRef.id)}?teil=${encodeURIComponent(part.id)}`)} aria-label={`Timer wählen: ${part.title}`}>Timer wählen</Button>}
        </div>} />
      </fieldset>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void run(async () => { if (!partTitle.trim()) throw new Error('Trage einen kleinen Schritt ein.'); const state = useApp.getState(); const latest = resolveTask(taskRef, state.inbox, state.local.work); if (!latest) return; await st.replaceTaskParts(taskRef, [...(latest.subtasks ?? []), { id: randomId(), title: partTitle.trim() }]); setPartTitle('') }, 'Teilschritt ergänzt.') }}><TextInput aria-label="Eigener Teilschritt" placeholder="Eigener kleiner Schritt" value={partTitle} onChange={(event) => setPartTitle(event.target.value)} /><Button type="submit" size="sm" disabled={busy}>Teilschritt ergänzen</Button></form>
    </div>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </div>
}

/** Die Rohwerte sind sichtbar; Ein/Aus und Reset sind unabhängige bewusste Entscheidungen. */
export function TaskLearning() {
  const st = useApp()
  const learning = st.local.taskLearning
  const { busy, error, run } = useTaskAction()
  return <details className="min-w-0 px-1"><summary className="min-h-11 py-2 text-muted">Eigene Zeitschätzungen</summary><div className="space-y-3 pt-2">
    <div className="flex items-center justify-between gap-3"><span className="text-sm">Lokal aus bestätigten Zeiten lernen</span><Toggle label="Lokal aus bestätigten Zeiten lernen" checked={learning?.enabled ?? false} onChange={(enabled) => { if (!busy) void run(() => st.setTaskLearning(enabled)) }} /></div>
    <p className="text-xs text-muted">Nur von dir bestätigte aktive Minuten auf diesem Gerät. Vorschläge ändern deine Schätzungen erst, wenn du sie übernimmst. Du kannst die gespeicherten Zeiten hier zurücksetzen.</p>
    {(learning?.samples.length ?? 0) > 0 ? <><p className="text-sm">{plural(learning!.samples.length, 'bestätigte Zeit', 'bestätigte Zeiten')} gespeichert.</p><ul className="max-h-56 space-y-2 overflow-y-auto text-sm text-muted">{learning!.samples.map((sample) => <li key={sample.id} className="break-words">{sample.label}: {sample.minutes} min · {new Date(sample.at).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}</li>)}</ul><Button size="sm" disabled={busy} onClick={() => run(() => st.clearTaskLearning())}>Gelernte Zeiten zurücksetzen</Button></> : <p className="text-sm text-muted">Noch keine bestätigten Zeiten gespeichert.</p>}
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
  </div></details>
}

export function RestingTasks({ tasks, kind }: { tasks: (InboxItem | WorkTask)[]; kind: TaskRef['kind'] }) {
  const st = useApp()
  const { busy, error, run } = useTaskAction()
  const resting = tasks.filter((task) => !taskIsOpen(task) && !task.done)
  if (!resting.length) return null
  return <details className="px-1"><summary className="min-h-11 py-2 text-muted">Zur Seite gelegt ({resting.length})</summary><div className="space-y-2">{resting.map((task) => <Card key={task.id} className="space-y-2"><p className="break-words">{taskTitle(task)}</p><p className="text-sm text-muted">{taskStateLabel(task)}</p><Button size="sm" disabled={busy} onClick={() => run(() => st.setTaskState({ kind, id: task.id }, 'pending'))}>Wieder öffnen</Button></Card>)}</div>{error && <p role="alert" className="text-sm text-warm">{error}</p>}</details>
}

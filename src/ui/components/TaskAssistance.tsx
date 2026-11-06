import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { assistanceAllowed, assistanceRevision, taskAssistanceRevision, type StepsRequest } from '../../core/assistance'
import { randomId } from '../../core/defaults'
import { resolveTask, taskIsOpen, taskTitle, type TaskDetailDepth } from '../../core/tasks'
import type { InboxItem, TaskPart, TaskRef, WorkTask } from '../../core/types'
import { AssistanceError, requestAssistance } from '../../platform/assistance'
import { useApp } from '../../state/store'
import { Button, Segmented, TextInput } from './ui'

interface Preview { parts: TaskPart[]; snapshot: string }

/** Bewusst gewählte Inhalte werden erst nach Freigabe gesendet. Übernahme ist eine eigene lokale Aktion. */
export function TaskAssistance({ taskRef, task, depth }: { taskRef: TaskRef; task: InboxItem | WorkTask; depth: TaskDetailDepth }) {
  const st = useApp()
  const path = useLocation().pathname
  const enabled = assistanceAllowed(st.local.assistance, 'ai')
  const snapshot = taskAssistanceRevision(taskRef, task)
  const [title, setTitle] = useState(taskTitle(task))
  const [description, setDescription] = useState(task.description ?? '')
  const [nextStep, setNextStep] = useState(task.nextStep ?? '')
  const [sendDescription, setSendDescription] = useState(false)
  const [sendNextStep, setSendNextStep] = useState(false)
  const [detailDepth, setDetailDepth] = useState<TaskDetailDepth>(depth)
  const [consent, setConsent] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [preview, setPreview] = useState<Preview>()
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const controller = useRef<AbortController | undefined>(undefined)
  const generation = useRef(0)
  const active = useRef(false)
  const lastSnapshot = useRef(snapshot)
  const savingNow = useRef(false)
  const requestingNow = useRef(false)

  useEffect(() => {
    active.current = true
    return () => { active.current = false; generation.current++; controller.current?.abort() }
  }, [])
  useEffect(() => {
    if (!enabled) {
      generation.current++; controller.current?.abort(); requestingNow.current = false; setBusy(false); setConsent(false); setReviewed(false)
    }
  }, [enabled])
  useEffect(() => {
    if (lastSnapshot.current !== snapshot) {
      lastSnapshot.current = snapshot
      generation.current++; controller.current?.abort(); requestingNow.current = false; setBusy(false); setConsent(false); setReviewed(false)
      setTitle(taskTitle(task)); setDescription(task.description ?? ''); setNextStep(task.nextStep ?? '')
      setSendDescription(false); setSendNextStep(false)
      setMessage('Die Aufgabe hat sich geändert. Prüfe den Inhalt vor einer neuen Anfrage. Ein vorhandener Vorschlag bleibt zum Lesen erhalten.')
    }
  }, [snapshot, task])

  const current = () => resolveTask(taskRef, useApp.getState().inbox, useApp.getState().local.work)
  const stillHere = () => active.current && window.location.pathname === path
  const edit = (action: () => void) => { action(); setConsent(false); setError(''); setMessage('') }
  const changePart = (id: string, patch: Partial<TaskPart>) => {
    setPreview((value) => value && ({ ...value, parts: value.parts.map((part) => part.id === id ? { ...part, ...patch } : part) }))
    setReviewed(false)
  }
  const cancel = () => {
    generation.current++; controller.current?.abort(); requestingNow.current = false; setBusy(false)
    setMessage('Anfrage beendet. Deine Aufgabe bleibt unverändert.')
  }
  const submit = async () => {
    if (!consent || requestingNow.current || savingNow.current) return
    const taskNow = current()
    if (!taskNow || !taskIsOpen(taskNow) || taskAssistanceRevision(taskRef, taskNow) !== snapshot) {
      setError('Die Aufgabe hat sich geändert. Prüfe den Inhalt erneut.'); setConsent(false); return
    }
    const request: StepsRequest = {
      kind: 'steps', revision: assistanceRevision([snapshot, randomId()]), title: title.trim(), depth: detailDepth,
      ...(sendDescription && description.trim() ? { description: description.trim() } : {}),
      ...(sendNextStep && nextStep.trim() ? { nextStep: nextStep.trim() } : {}),
    }
    if (!request.title || request.title.length > 300 || (request.description?.length ?? 0) > 2000 || (request.nextStep?.length ?? 0) > 300) {
      setError('Ein kurzer Titel genügt. Verwende höchstens 300 Zeichen für Titel/Schritt und 2000 für die Beschreibung.'); return
    }
    const token = ++generation.current
    requestingNow.current = true
    controller.current?.abort(); controller.current = new AbortController()
    setBusy(true); setConsent(false); setError(''); setMessage(''); setReviewed(false)
    try {
      const result = await requestAssistance(request, controller.current.signal)
      if (!stillHere() || token !== generation.current) return
      const latest = current()
      if (!latest || !taskIsOpen(latest) || taskAssistanceRevision(taskRef, latest) !== snapshot) {
        setError('Die Aufgabe hat sich inzwischen geändert. Es wurde nichts übernommen.'); return
      }
      if (result.kind !== 'steps') throw new AssistanceError('invalid-response')
      setPreview({ snapshot, parts: result.steps.map((step, index) => ({ id: `ai:${request.revision}:${index}`, ...step })) })
      setMessage('Vorschlag eingetroffen. Du kannst jeden offenen Schritt bearbeiten, bevor du ihn übernimmst.')
    } catch (reason) {
      if (stillHere() && token === generation.current) setError(reason instanceof AssistanceError ? reason.message : 'Der Vorschlag ist gerade nicht verfügbar. Deine Aufgabe bleibt unverändert.')
    } finally { if (token === generation.current) { requestingNow.current = false; if (stillHere()) setBusy(false) } }
  }
  const apply = async () => {
    if (!preview || !reviewed || savingNow.current) return
    savingNow.current = true; setSaving(true); setError(''); setMessage('')
    try {
      if (!stillHere() || !assistanceAllowed(useApp.getState().local.assistance, 'ai')) throw new Error('Die KI-Freigabe ist ausgeschaltet. Es wurde nichts übernommen.')
      const parts = preview.parts.map((part) => ({ ...part, title: part.title.trim() }))
      if (!parts.length || parts.some((part) => !part.title || part.title.length > 300)) throw new Error('Prüfe die Texte deiner Vorschlagsschritte.')
      if (parts.some((part) => part.estimateMin !== undefined && (!Number.isInteger(part.estimateMin) || part.estimateMin < 1 || part.estimateMin > 480))) throw new Error('Minuten bleiben leer oder sind ganze Zahlen zwischen 1 und 480.')
      await st.replaceTaskParts(taskRef, parts, { revision: preview.snapshot, purpose: 'ai' })
      const saved = current()
      if (saved) lastSnapshot.current = taskAssistanceRevision(taskRef, saved)
      if (stillHere()) { setPreview(undefined); setReviewed(false); setMessage('Geprüfte Schritte gespeichert. Erledigte Teile bleiben erhalten.') }
    } catch (reason) {
      if (stillHere()) setError(reason instanceof Error ? reason.message : 'Die Schritte konnten nicht gespeichert werden. Dein Vorschlag bleibt erhalten.')
    } finally { savingNow.current = false; if (stillHere()) setSaving(false) }
  }
  const stale = !!preview && preview.snapshot !== snapshot
  const completed = task.subtasks?.filter((part) => part.doneAt !== undefined) ?? []

  return <details className="min-w-0 rounded-xl border border-line p-3">
    <summary className="min-h-11 py-2 text-muted">KI-Vorschlag (freiwillig)</summary>
    <div className="min-w-0 space-y-3 pt-2">
      {!enabled ? <>
        <p className="text-sm text-muted">KI-Vorschläge sind ausgeschaltet. Lokale Vorlagen stehen oben zur Verfügung.</p>
        <Link className="flex min-h-11 items-center text-accent" to="/einstellungen/assistenz">Optionale Vorschläge einrichten</Link>
      </> : <>
        <p className="text-sm text-muted">Dieser Inhalt geht über deinen eingerichteten Server an OpenAI. Es können Anbieterkosten entstehen. {taskRef.kind === 'work' ? 'Bei dieser Arbeitsaufgabe können berufliche Angaben enthalten sein.' : 'Prüfe auch private Angaben vor dem Senden.'} Die Antwort ist ein Vorschlag.</p>
        <form className="min-w-0 space-y-3" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <fieldset className="min-w-0 space-y-3" disabled={busy || saving}>
            <label className="block space-y-1"><span>Text für den KI-Vorschlag</span><TextInput aria-label="Text für den KI-Vorschlag" maxLength={300} required value={title} onChange={(event) => edit(() => setTitle(event.target.value))} /></label>
            <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={sendDescription} onChange={(event) => edit(() => setSendDescription(event.target.checked))} /><span>Beschreibung mitsenden</span></label>
            {sendDescription && <label className="block space-y-1"><span>Beschreibung für diese Anfrage</span><textarea aria-label="Beschreibung für die KI-Anfrage" maxLength={2000} rows={3} value={description} onChange={(event) => edit(() => setDescription(event.target.value))} className="w-full min-w-0 rounded-xl bg-surface-2 p-3" /></label>}
            <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={sendNextStep} onChange={(event) => edit(() => setSendNextStep(event.target.checked))} /><span>Nächsten Schritt mitsenden</span></label>
            {sendNextStep && <label className="block space-y-1"><span>Nächster Schritt für diese Anfrage</span><TextInput aria-label="Nächster Schritt für die KI-Anfrage" maxLength={300} value={nextStep} onChange={(event) => edit(() => setNextStep(event.target.value))} /></label>}
            <Segmented<TaskDetailDepth> label="KI-Detailtiefe" value={detailDepth} options={[{ value: 'three', label: '3 Schritte' }, { value: 'normal', label: 'Normal' }, { value: 'tiny', label: 'Sehr klein' }]} onChange={(value) => edit(() => setDetailDepth(value))} />
            <p className="text-xs text-muted">Übertragen werden der sichtbare Text, die gewählte Detailtiefe und nur die zusätzlich angehakten Felder. Zielgrund, Arbeitszeit, Einnahmen, Adressen und übrige Aufgaben werden nicht automatisch angehängt.</p>
            <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Diesen Inhalt für diese Anfrage an OpenAI freigeben</span></label>
            <Button type="submit" size="sm" disabled={!consent || !title.trim()}>{busy ? 'Vorschlag wird angefragt …' : 'KI-Vorschlag anfordern'}</Button>
          </fieldset>
        </form>
        {busy && <Button size="sm" variant="ghost" onClick={cancel}>KI-Anfrage abbrechen</Button>}
        {preview && <section aria-label="KI-Vorschlag prüfen" className="min-w-0 space-y-3 rounded-xl bg-surface-2 p-3">
          <h5 className="font-semibold">KI-Vorschlag prüfen</h5>
          <p className="text-sm text-muted">Die offenen Teilschritte werden bei Übernahme ersetzt. {completed.length} bereits erledigte Teile bleiben erhalten. Minuten sind grobe Vorschläge.</p>
          {completed.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{completed.map((part) => <li key={part.id} className="break-words">Erledigt und bleibt erhalten: {part.title}</li>)}</ul>}
          <fieldset disabled={saving} className="min-w-0 space-y-3">
            {preview.parts.map((part, index) => <div key={part.id} className="min-w-0 space-y-2 border-t border-line pt-3">
              <label className="block space-y-1"><span>Schritt {index + 1}</span><TextInput aria-label={`KI-Schritt ${index + 1}`} maxLength={300} value={part.title} onChange={(event) => changePart(part.id, { title: event.target.value })} /></label>
              <label className="block space-y-1"><span>Grobe Minuten, freiwillig</span><TextInput type="number" aria-label={`KI-Minuten ${index + 1}`} min={1} max={480} step={1} value={part.estimateMin ?? ''} onChange={(event) => changePart(part.id, { estimateMin: event.target.value.trim() ? Number(event.target.value) : undefined })} /></label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={index === 0} aria-label={`KI-Schritt ${index + 1} nach oben`} onClick={() => { setPreview((value) => { if (!value) return value; const parts = [...value.parts]; [parts[index - 1], parts[index]] = [parts[index]!, parts[index - 1]!]; return { ...value, parts } }); setReviewed(false) }}>↑</Button>
                <Button size="sm" disabled={index === preview.parts.length - 1} aria-label={`KI-Schritt ${index + 1} nach unten`} onClick={() => { setPreview((value) => { if (!value) return value; const parts = [...value.parts]; [parts[index], parts[index + 1]] = [parts[index + 1]!, parts[index]!]; return { ...value, parts } }); setReviewed(false) }}>↓</Button>
                <Button size="sm" variant="ghost" onClick={() => { setPreview((value) => value && ({ ...value, parts: value.parts.filter((item) => item.id !== part.id) })); setReviewed(false) }}>Vorschlagsschritt entfernen</Button>
              </div>
            </div>)}
            {preview.parts.length < 12 && <Button size="sm" onClick={() => { setPreview((value) => value && ({ ...value, parts: [...value.parts, { id: `ai:manual:${randomId()}`, title: '' }] })); setReviewed(false) }}>Vorschlagsschritt ergänzen</Button>}
            {stale && <p role="status" className="text-sm text-warm">Die Aufgabe hat sich seit dieser Anfrage geändert. Frage mit dem aktuellen Stand neu an oder übernimm einzelne Texte manuell.</p>}
            <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1" disabled={stale} checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span>Geprüfte offene Schritte durch diesen Vorschlag ersetzen</span></label>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="primary" disabled={!reviewed || stale || !preview.parts.length} onClick={() => void apply()}>Geprüfte KI-Schritte übernehmen</Button><Button size="sm" variant="ghost" onClick={() => { setPreview(undefined); setReviewed(false); setError(''); setMessage('Vorschlag verworfen. Deine Aufgabe bleibt unverändert.') }}>KI-Vorschlag verwerfen</Button></div>
          </fieldset>
        </section>}
      </>}
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      {message && <p role="status" className="text-sm text-muted">{message}</p>}
    </div>
  </details>
}

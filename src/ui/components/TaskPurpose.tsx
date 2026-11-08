import { useState } from 'react'
import { taskNextStep, taskTitle } from '../../core/tasks'
import type { InboxItem, TaskRef, WorkTask } from '../../core/types'
import { useApp } from '../../state/store'
import { Button, Sheet, TextInput } from './ui'

/** Ein eigener Grund bleibt Teil derselben Aufgabe; keine zusätzliche Ziel- oder Punktedatenbank. */
export function TaskPurpose({ taskRef, task }: { taskRef: TaskRef; task: InboxItem | WorkTask }) {
  const st = useApp()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <>
    <Button variant="ghost" onClick={() => { setReason(task.why ?? ''); setError(''); setOpen(true) }}>Warum mache ich das?</Button>
    <Sheet open={open} onClose={() => setOpen(false)} title="Dein Grund">
      <p className="mb-3 break-words text-lg">{taskTitle(task)}</p>
      <label className="block space-y-2"><span>Wofür ist dir das wichtig?</span><TextInput aria-label="Mein Grund für die Aufgabe" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <p className="my-4 break-words text-muted">Nächster kleiner Schritt: {taskNextStep(task, taskTitle(task))}</p>
      {error && <p role="alert" className="mb-3 text-warm">{error}</p>}
      <Button disabled={busy} variant="primary" className="w-full" onClick={async () => {
        if (busy) return
        setBusy(true)
        try { await st.updateTask(taskRef, { why: reason.trim() || undefined }); setOpen(false) }
        catch { setError('Dein Grund konnte nicht gespeichert werden. Versuche es noch einmal.') }
        finally { setBusy(false) }
      }}>Merken</Button>
    </Sheet>
  </>
}

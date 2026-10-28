import { useEffect, useState } from 'react'
import { addDays } from '../../core/time'
import { routineBlock } from '../../core/planner'
import { planFor, today, useApp } from '../../state/store'
import { InboxSheet } from '../components/Shell'
import { Button, Card, Page, Section } from '../components/ui'

/** Gedanken-Inbox mit 2-Minuten-Durchsicht: behalten, einplanen, löschen. */
export default function Inbox() {
  const st = useApp()
  const d = today()
  const open = st.inbox.filter((x) => x.status === 'open').sort((a, b) => a.createdAt - b.createdAt)
  const tasks = st.inbox.filter((x) => x.status === 'task' && !x.done && (x.taskDate ?? d) <= addDays(d, 1))
  const kept = st.inbox.filter((x) => x.status === 'kept')
  const [left, setLeft] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (left === null || left <= 0) return
    const id = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(id)
  }, [left])

  // Durchsicht fertig → Abendroutine-Schritt abhaken
  useEffect(() => {
    if (left === null || open.length > 0) return
    const step = routineBlock(planFor(d), 'evening')?.steps?.find((x) => x.tag === 'inbox')
    if (step && !st.days[d]?.steps[`evening:${step.id}`]) void st.setStep(d, 'evening', step.id, 'done')
    setLeft(null)
  }, [left, open.length, d, st])

  return (
    <Page title="Gedanken" actions={<Button size="sm" onClick={() => setAdding(true)}>+ Neu</Button>}>
      {open.length > 0 && (
        <Card className="flex items-center gap-3">
          <div className="flex-1">
            <p className="font-semibold">{open.length} offene Gedanken</p>
            <p className="text-sm text-muted">{left === null ? '2 Minuten Durchsicht, ohne Bewertung.' : `Noch ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</p>
          </div>
          {left === null && (
            <Button variant="primary" onClick={() => setLeft(120)}>
              Durchsehen
            </Button>
          )}
        </Card>
      )}
      {open.length === 0 && <p className="px-1 text-lg text-muted">Kopf ist leer. Alles festgehalten. 🙌</p>}

      <Section>
        {open.map((x) => (
          <Card key={x.id}>
            <p className="mb-3 text-lg">{x.text}</p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => st.updateInbox(x.id, { status: 'kept' })}>
                Behalten
              </Button>
              <Button size="sm" className="flex-1" onClick={() => st.updateInbox(x.id, { status: 'task', taskDate: addDays(d, 1) })}>
                Morgen erledigen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => st.removeInbox(x.id)} aria-label="Löschen">
                Löschen
              </Button>
            </div>
          </Card>
        ))}
      </Section>

      {tasks.length > 0 && (
        <Section title="Eingeplant">
          {tasks.map((x) => (
            <label key={x.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4">
              <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" checked={!!x.done} onChange={() => st.updateInbox(x.id, { done: true })} />
              <span className="flex-1">{x.text}</span>
              <span className="text-sm text-muted">{x.taskDate === d ? 'heute' : 'morgen'}</span>
            </label>
          ))}
        </Section>
      )}

      {kept.length > 0 && (
        <Section title="Behalten">
          {kept.map((x) => (
            <div key={x.id} className="flex min-h-12 items-center gap-3 rounded-2xl bg-surface px-4">
              <span className="flex-1">{x.text}</span>
              <button type="button" className="h-10 w-10 text-muted" aria-label="Löschen" onClick={() => st.removeInbox(x.id)}>
                ✕
              </button>
            </div>
          ))}
        </Section>
      )}
      <InboxSheet open={adding} onClose={() => setAdding(false)} />
    </Page>
  )
}

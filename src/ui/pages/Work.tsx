import { useState } from 'react'
import { randomId } from '../../core/defaults'
import { deadlineRisk, MAX_WORK_VISIBLE, openWork, workStepText } from '../../core/support'
import { addDays } from '../../core/time'
import type { WorkTask } from '../../core/types'
import { safe } from '../../platform/native'
import { useNow, useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { Button, Card, Page, Section, Stepper, TextInput } from '../components/ui'

function toLocalInput(ms: number | undefined): string {
  if (!ms) return ''
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}

const RISK_TEXT = { none: undefined, today: 'Frist ist heute', soon: 'Frist rückt näher', past: 'Frist erreicht' } as const

/** Arbeit: Top-1 und höchstens zwei weitere. Nur der Titel ist nötig. Bleibt auf diesem Gerät. */
export default function Work() {
  const st = useApp()
  const { date, m, plan } = useToday()
  const now = useNow(60_000)
  const work = st.local.work
  const open = openWork(work)
  const [title, setTitle] = useState('')
  const [editing, setEditing] = useState<string>()
  const [showAll, setShowAll] = useState(false)
  const [interrupt, setInterrupt] = useState<string>()
  const yesterday = st.local.handover[addDays(date, -1)]
  const handover = st.local.handover[date] ?? { open: '', next: '' }
  const afterWork = plan.workEnd !== undefined && m >= plan.workEnd - 30

  const update = (id: string, patch: Partial<WorkTask>) => st.saveLocal((l) => ({ ...l, work: l.work.map((w) => (w.id === id ? { ...w, ...patch } : w)) }))
  const remove = (id: string) => st.saveLocal((l) => ({ ...l, work: l.work.filter((w) => w.id !== id) }))
  const moveToTop = (id: string) =>
    st.saveLocal((l) => {
      const item = l.work.find((w) => w.id === id)
      return item ? { ...l, work: [item, ...l.work.filter((w) => w.id !== id)] } : l
    })

  const add = async () => {
    const t = title.trim()
    if (!t) return
    await st.saveLocal((l) => ({ ...l, work: [...l.work, { id: randomId(), title: t, createdAt: Date.now() }] }))
    setTitle('')
  }

  const visible = showAll ? open : open.slice(0, MAX_WORK_VISIBLE)
  return (
    <Page title="Arbeit" back="/mehr">
      {yesterday?.next && (
        <Card>
          <p className="text-sm text-muted">Gestern notiert</p>
          <p className="text-lg">{yesterday.next}</p>
        </Card>
      )}

      <Section title="Heute am wichtigsten">
        {visible.map((w, i) => {
          const risk = deadlineRisk(w, now)
          const isEditing = editing === w.id
          return (
            <Card key={w.id} className="space-y-3">
              <div>
                {i === 0 && <p className="text-sm text-accent">Zuerst</p>}
                <p className={i === 0 ? 'text-xl font-semibold' : 'text-lg'}>{w.title}</p>
                {w.nextStep && <p className="text-muted">Nächster Schritt: {w.nextStep}</p>}
                {RISK_TEXT[risk] && <p className="text-warm">{RISK_TEXT[risk]}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={i === 0 ? 'primary' : 'secondary'} onClick={() => update(w.id, { done: true, doneAt: Date.now() })}>
                  Erledigt
                </Button>
                <Button size="sm" onClick={() => setInterrupt(interrupt === w.id ? undefined : w.id)} aria-expanded={interrupt === w.id}>
                  Ich wurde unterbrochen
                </Button>
                {i > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => moveToTop(w.id)}>
                    Nach vorn
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditing(isEditing ? undefined : w.id)} aria-expanded={isEditing}>
                  Details
                </Button>
              </div>
              {interrupt === w.id && (
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const next = new FormData(e.currentTarget).get('next')?.toString().trim() ?? ''
                    if (next) await update(w.id, { nextStep: next })
                    await st.setResume({ kind: 'work', title: w.title, nextStep: next || w.nextStep, refId: w.id, at: Date.now() })
                    setInterrupt(undefined)
                    st.showToast('Gemerkt. Anker bringt dich hierher zurück.')
                  }}
                >
                  <TextInput name="next" aria-label="Wo machst du weiter?" placeholder="Wo machst du weiter? (freiwillig)" defaultValue={w.nextStep ?? ''} autoFocus />
                  <Button type="submit" variant="primary" className="w-full">
                    Merken
                  </Button>
                </form>
              )}
              {isEditing && (
                <div className="space-y-3">
                  <TextInput aria-label="Titel" value={w.title} onChange={(e) => update(w.id, { title: e.target.value })} />
                  <TextInput aria-label="Nächster Schritt" placeholder="Nächster Schritt, z. B. Tabelle öffnen" value={w.nextStep ?? ''} onChange={(e) => update(w.id, { nextStep: e.target.value })} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Geschätzt</span>
                    <Stepper label="Schätzung" value={w.estimateMin ?? 30} step={5} min={5} max={480} onChange={(v) => update(w.id, { estimateMin: v })} />
                  </div>
                  <label className="flex items-center justify-between gap-2">
                    <span>Frist</span>
                    <input type="datetime-local" className="min-h-12 rounded-xl bg-surface-2 px-3" value={toLocalInput(w.deadline)} onChange={(e) => update(w.id, { deadline: e.target.value ? new Date(e.target.value).getTime() : undefined })} />
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => remove(w.id)}>
                    Entfernen
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
        {open.length === 0 && <p className="px-1 text-muted">Noch nichts eingetragen. Ein Titel genügt.</p>}
        {open.length > MAX_WORK_VISIBLE && (
          <button type="button" className="min-h-11 px-1 text-sm text-muted underline" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Weniger zeigen' : `${open.length - MAX_WORK_VISIBLE} weitere`}
          </button>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <TextInput aria-label="Neue Aufgabe" placeholder="Neue Aufgabe" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button type="submit" disabled={!title.trim()}>
            Hinzufügen
          </Button>
        </form>
      </Section>

      {(afterWork || handover.open || handover.next) && (
        <Section title="Feierabend-Übergabe" hint="Eine Minute, nur für dich. Wird nicht an jemanden gesendet.">
          <Card className="space-y-3">
            <TextInput aria-label="Was ist offen?" placeholder="Was ist offen?" value={handover.open} onChange={(e) => st.saveLocal((l) => ({ ...l, handover: { ...l.handover, [date]: { ...handover, open: e.target.value } } }))} />
            <TextInput aria-label="Wo mache ich morgen weiter?" placeholder="Wo mache ich morgen weiter?" value={handover.next} onChange={(e) => st.saveLocal((l) => ({ ...l, handover: { ...l.handover, [date]: { ...handover, next: e.target.value } } }))} />
          </Card>
        </Section>
      )}

      <details className="px-1">
        <summary className="min-h-11 py-2 text-muted">Vorlagen zum Kopieren</summary>
        <div className="space-y-2 pt-2">
          {TEMPLATES.map((t) => (
            <Card key={t.title} className="space-y-2">
              <p className="font-medium">{t.title}</p>
              <p className="text-muted">{t.text}</p>
              <Button size="sm" onClick={() => void safe(() => navigator.clipboard.writeText(t.text), undefined).then(() => st.showToast('Kopiert. Senden entscheidest du.'))}>
                Kopieren
              </Button>
            </Card>
          ))}
        </div>
      </details>

      {open[0] && <p className="px-1 text-sm text-muted">Als Nächstes: {workStepText(open[0])}</p>}
      <p className="px-1 text-sm text-muted">Arbeitsaufgaben bleiben auf diesem Gerät und werden nicht synchronisiert. In Erinnerungen erscheinen ihre Inhalte nicht.</p>
    </Page>
  )
}

const TEMPLATES = [
  { title: 'Aufgabe schriftlich bestätigen', text: 'Kurz zur Sicherheit, ob ich es richtig verstanden habe: Ich soll … bis … erledigen. Passt das so?' },
  { title: 'Kurzer Check-in', text: 'Ich arbeite gerade an … und sage dir in 30 Minuten kurz Bescheid, wie weit ich bin. Passt das für dich?' },
  { title: 'Notiz im Meeting', text: 'Besprochen: …\nMeine Aufgabe: …\nBis wann: …\nNächster Schritt: …' },
]

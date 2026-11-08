import { useRef, useState } from 'react'
import { plural } from '../../core/uiText'
import { randomId } from '../../core/defaults'
import { changePrepared, packItems, packingTemplates, preparedItems } from '../../core/packing'
import type { Commitment, PackTemplate } from '../../core/types'
import { usePlan } from '../../state/hooks'
import { useApp } from '../../state/store'
import { Button, Card, Checkbox, Choice, Section, TextInput } from './ui'

const FIELD = 'min-h-12 w-full rounded-xl bg-surface-2 p-3'
const CONTEXTS = { customer: 'Kundenbesuch', sport: 'Sport', 'going-out': 'Ausgehen' } as const
function useSaving() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const pending = useRef(false)
  const run = async (work: () => Promise<void>, success = 'Gespeichert.') => {
    if (pending.current) return
    pending.current = true; setBusy(true); setMessage('')
    try { await work(); setMessage(success) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Konnte nicht gespeichert werden. Bitte versuche es erneut.') }
    finally { pending.current = false; setBusy(false) }
  }
  return { busy, message, run }
}

/** Ein lokaler Termin bleibt die Quelle seiner Gegenstände und bewusst bestätigten Vorbereitung. */
export function PackingList({ commitment, items: supplied }: { commitment: Commitment; items?: string[] }) {
  const st = useApp()
  const items = packItems(supplied ?? commitment.items ?? [])
  const checked = new Set(preparedItems(commitment, items))
  const templates = packingTemplates(st.local)
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(items.join('\n'))
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const { busy, message, run } = useSaving()
  const edit = (fn: (current: Commitment) => Commitment) => st.saveLocal((local) => ({ ...local,
    commitments: local.commitments.map((current) => current.id === commitment.id && current.date === commitment.date ? fn(current) : current),
  }))
  const beginEditing = () => { if (!editing) setDraft(items.join('\n')); setEditing(!editing) }
  return <div className="min-w-0 space-y-2 border-t border-line pt-3">
    {items.length > 0 && <>
      <p className="text-sm font-medium">Packliste · {checked.size} von {items.length} vorbereitet</p>
      {(expanded ? items : items.slice(0, 3)).map((item) => <Checkbox key={item} disabled={busy} checked={checked.has(item)} aria-label={`${item} für ${commitment.label} vorbereitet`} onChange={(done) => {
        void run(() => edit((current) => changePrepared(current, item, done)), done ? 'Als vorbereitet gemerkt.' : 'Vorbereitung zurückgenommen.')
      }}>{item}</Checkbox>)}
      {items.length > 3 && <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>{expanded ? 'Weniger Dinge zeigen' : plural(items.length - 3, 'weiteres Ding', 'weitere Dinge')}</Button>}
    </>}
    <Button size="sm" variant="ghost" disabled={busy} aria-expanded={editing} onClick={beginEditing}>{editing ? 'Bearbeitung schließen' : items.length ? 'Packliste bearbeiten' : 'Packliste vorbereiten'}</Button>
    {editing && <div className="space-y-3 rounded-2xl bg-surface-2 p-3">
      <p className="text-sm text-muted">Freiwillig. Vorbereiten bestätigt nur diese Gegenstände; es beendet weder Aufgabe noch Routine oder Arbeitszeit.</p>
      <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault()
        const next = packItems(draft.split('\n'))
        void run(async () => {
          if (next.length > 100 || next.some((item) => item.length > 300)) throw new Error('Bis zu 100 kurze Gegenstände passen in eine Packliste.')
          await edit((current) => ({ ...current, items: next }))
          setEditing(false)
        }, 'Packliste gespeichert. Vorbereitetes bleibt erhalten.')
      }}>
        <label className="block space-y-1"><span>Ein Gegenstand pro Zeile</span><textarea aria-label={`Packliste ${commitment.label}`} className={FIELD} rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
        <Button type="submit" size="sm" disabled={busy}>Packliste speichern</Button>
      </form>
      {templates.length > 0 && <div className="space-y-2">
        <Choice label={`Packvorlage ${commitment.label}`} value={templateId} onChange={setTemplateId} options={templates.map((template) => ({ value: template.id, label: template.label }))} />
        <p className="break-words text-sm text-muted">{templates.find((template) => template.id === templateId)?.items.join(', ')}</p>
        <Button size="sm" disabled={busy} onClick={() => void run(async () => {
          const template = packingTemplates(useApp.getState().local).find((item) => item.id === templateId)
          if (!template) throw new Error('Wähle eine vorhandene Packvorlage.')
          const combined = packItems([...items, ...template.items])
          await edit((current) => ({ ...current, items: packItems([...(current.items ?? items), ...template.items]) }))
          setDraft(combined.join('\n'))
        }, 'Vorlage ergänzt. Eigene Dinge und Vorbereitungen bleiben erhalten.')}>Vorlage ergänzen</Button>
      </div>}
    </div>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </div>
}

function TemplateEditor({ template }: { template: PackTemplate }) {
  const st = useApp()
  const [label, setLabel] = useState(template.label)
  const [items, setItems] = useState(template.items.join('\n'))
  const { busy, message, run } = useSaving()
  return <Card className="space-y-2">
    <p className="break-words font-medium">{template.label} · {CONTEXTS[template.context]}</p>
    <form className="space-y-2" onSubmit={(event) => {
      event.preventDefault()
      void run(async () => {
        const clean = packItems(items.split('\n'))
        if (!label.trim()) throw new Error('Gib der Vorlage einen kurzen Namen.')
        if (clean.length > 100 || clean.some((item) => item.length > 300)) throw new Error('Bis zu 100 kurze Gegenstände passen in eine Vorlage.')
        await st.saveLocal((local) => ({ ...local, packTemplates: packingTemplates(local).map((current) => current.id === template.id ? { ...current, label: label.trim(), items: clean } : current) }))
      }, 'Packvorlage auf diesem Gerät gespeichert.')
    }}>
      <TextInput aria-label={`Name der Packvorlage ${template.label}`} value={label} onChange={(event) => setLabel(event.target.value)} />
      <textarea aria-label={`Gegenstände der Packvorlage ${template.label}`} className={FIELD} rows={3} value={items} onChange={(event) => setItems(event.target.value)} />
      <Button size="sm" type="submit" disabled={busy}>Vorlage speichern</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => st.saveLocal((local) => ({ ...local, packTemplates: packingTemplates(local).filter((current) => current.id !== template.id) })))}>Vorlage entfernen</Button>
    </form>
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </Card>
}

export function PackingTemplates() {
  const st = useApp()
  const templates = packingTemplates(st.local)
  const [name, setName] = useState('')
  const [context, setContext] = useState<PackTemplate['context']>('customer')
  const { busy, message, run } = useSaving()
  return <details className="space-y-3">
    <summary className="min-h-11 py-2 text-muted">Packvorlagen anpassen</summary>
    <p className="text-sm text-muted">Auf diesem Gerät. Eine Vorlage ändert vorhandene Terminlisten erst, wenn du sie ausdrücklich ergänzt.</p>
    {templates.map((template) => <TemplateEditor key={template.id} template={template} />)}
    <form className="space-y-2" onSubmit={(event) => {
      event.preventDefault()
      void run(async () => {
        if (!name.trim()) throw new Error('Ein kurzer Vorlagenname genügt.')
        const id = randomId()
        await st.saveLocal((local) => ({ ...local, packTemplates: [...packingTemplates(local), { id, label: name.trim(), context, items: [] }] }))
        setName('')
      }, 'Neue Vorlage angelegt. Du kannst jetzt Gegenstände eintragen.')
    }}>
      <TextInput aria-label="Neue Packvorlage" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name deiner Vorlage" />
      <Choice label="Art der Packvorlage" value={context} onChange={(value) => setContext(value as PackTemplate['context'])} options={Object.entries(CONTEXTS).map(([value, label]) => ({ value, label }))} />
      <Button size="sm" type="submit" disabled={busy}>Packvorlage anlegen</Button>
    </form>
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </details>
}

export function PackingForDay({ date }: { date: string }) {
  const plan = usePlan(date)
  const legs = plan.legs ?? []
  return <Section title="Für deine Termine vorbereiten">
    {legs.map((leg) => <Card key={leg.commitment.id} className="space-y-2"><p className="break-words font-medium">{leg.commitment.label}</p><PackingList commitment={leg.commitment} items={leg.items} /></Card>)}
    <PackingTemplates />
  </Section>
}

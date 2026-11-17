import { useState } from 'react'
import { randomId } from '../../core/defaults'
import type { HobbyActivity, HobbyPreferences } from '../../core/hobbies'
import { useApp } from '../../state/store'
import { Button, Card, Choice, Info, Page, Sheet, TextInput, Toggle } from '../components/ui'

export default function Hobbies() {
  const st = useApp(), prefs = st.local.hobbies ?? { items: [] }
  const [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [renameId, setRenameId] = useState<string>(), [renameValue, setRenameValue] = useState('')
  const [selected, setSelected] = useState<string>(), [editing, setEditing] = useState<string>()
  const [title, setTitle] = useState(''), [minutes, setMinutes] = useState(''), [things, setThings] = useState('')
  const [energy, setEnergy] = useState<'' | NonNullable<HobbyActivity['energy']>>('')
  const [context, setContext] = useState<'' | NonNullable<HobbyActivity['context']>>('')
  const save = async (fn: (h: HobbyPreferences) => HobbyPreferences) => {
    if (busy) return false
    setBusy(true); setError('')
    try { await st.saveHobbies(fn); return true } catch { setError('Die Änderung konnte nicht gespeichert werden. Prüfe Namen und optionale Angaben.'); return false }
    finally { setBusy(false) }
  }
  const edit = (hobbyId: string, activity?: HobbyActivity) => {
    setSelected(hobbyId); setEditing(activity?.id); setTitle(activity?.title ?? ''); setMinutes(activity?.minutes?.toString() ?? '')
    setEnergy(activity?.energy ?? ''); setContext(activity?.context ?? ''); setThings(activity?.things?.join(', ') ?? '')
  }
  return <Page title="Hobbys" back="/einstellungen">
    <div className="flex items-center justify-between gap-2"><p className="text-muted">Eigene Ideen für freie Zeit.</p><Info title="Hobby-Vorschläge"><p>Ein Name genügt. Kleine Aktivitäten mit optionaler Dauer, Energie und Kontext helfen bei der Auswahl. Die Dauer umfasst deine Vorbereitung; Wege werden nicht erfunden.</p><p>„Jetzt“ bietet höchstens eine freiwillige Idee, wenn dein vorhandener Plan freie Zeit zeigt. Pause ist gleichwertig. Keine Pflichten, Punkte oder automatischen Erledigungen. Die Sammlung bleibt lokal und ist nur in deiner bewusst erstellten Sicherung enthalten.</p></Info></div>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); const value = name.trim(); if (value) void save(h => ({ ...h, items: [...h.items, { id: randomId(), name: value }] })).then(ok => { if (ok) setName('') }) }}>
      <TextInput aria-label="Hobbyname" placeholder="Zum Beispiel Fotografieren" value={name} maxLength={160} onChange={event => setName(event.target.value)} />
      <Button type="submit" disabled={busy || !name.trim()}>Hinzufügen</Button>
    </form>
    {!prefs.items.length && <p className="text-sm text-muted">Noch keine Hobbys eingerichtet. Du kannst mit einem Namen anfangen.</p>}
    {prefs.items.map(hobby => <Card key={hobby.id} className="space-y-3">
      <div className="flex items-center justify-between gap-3"><h2 className="min-w-0 break-words text-xl font-semibold">{hobby.name}</h2><Toggle label={`${hobby.name} vorschlagen`} checked={!hobby.paused} onChange={enabled => void save(h => ({ ...h, items: h.items.map(x => x.id === hobby.id ? { ...x, paused: !enabled } : x) }))} /></div>
      {hobby.activities?.map(activity => <div key={activity.id} className="rounded-xl border border-line p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words font-medium">{activity.title}</p><p className="text-sm text-muted">{[activity.minutes ? `${activity.minutes} min inkl. Vorbereitung` : 'Dauer offen', activity.context === 'outside' ? 'draußen' : activity.context === 'inside' ? 'drinnen' : '', activity.paused ? 'pausiert' : ''].filter(Boolean).join(' · ')}</p></div><Button size="sm" onClick={() => edit(hobby.id, activity)}>Bearbeiten</Button></div></div>)}
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => edit(hobby.id)}>Aktivität ergänzen</Button>
        <Button disabled={busy} variant="ghost" onClick={() => { setRenameId(hobby.id); setRenameValue(hobby.name) }}>Umbenennen</Button>
        {hobby.name.toLocaleLowerCase('de').includes('fotograf') && !hobby.activities?.length && <Button disabled={busy} onClick={() => void save(h => ({ ...h, items: h.items.map(x => x.id === hobby.id ? { ...x, activities: [{ id: randomId(), title: 'Ein Motiv mit dem Handy fotografieren', minutes: 5 }, { id: randomId(), title: 'Licht und Schatten ausprobieren', minutes: 15 }, { id: randomId(), title: 'Eine kleine Fotorunde', minutes: 30, context: 'outside' }] } : x) }))}>Foto-Ideen als Vorlage</Button>}
      </div>
    </Card>)}
    {error && <p role="alert" className="text-warm">{error}</p>}
    <Sheet open={renameId !== undefined} onClose={() => setRenameId(undefined)} title="Hobby umbenennen"><form className="space-y-3" onSubmit={event => { event.preventDefault(); void save(h => ({ ...h, items: h.items.map(x => x.id === renameId ? { ...x, name: renameValue.trim() } : x) })).then(ok => { if (ok) setRenameId(undefined) }) }}><TextInput aria-label="Neuer Hobbyname" value={renameValue} maxLength={160} onChange={event => setRenameValue(event.target.value)} /><Button variant="primary" type="submit" disabled={busy || !renameValue.trim()}>Speichern</Button></form></Sheet>
    <Sheet open={selected !== undefined} onClose={() => setSelected(undefined)} title={editing ? 'Aktivität bearbeiten' : 'Kleine Aktivität'}><form className="space-y-4" onSubmit={event => {
      event.preventDefault()
      const previous = prefs.items.find(h => h.id === selected)?.activities?.find(a => a.id === editing)
      const activity: HobbyActivity = { id: editing ?? randomId(), title: title.trim(), ...(previous?.paused !== undefined ? { paused: previous.paused } : {}), ...(minutes.trim() ? { minutes: Number(minutes) } : {}), ...(energy ? { energy } : {}), ...(context ? { context } : {}), ...(things.trim() ? { things: things.split(',').map(x => x.trim()).filter(Boolean) } : {}) }
      void save(h => ({ ...h, items: h.items.map(x => x.id === selected ? { ...x, activities: [...(x.activities ?? []).filter(a => a.id !== activity.id), activity] } : x) })).then(ok => { if (ok) setSelected(undefined) })
    }}>
      <label className="block space-y-1"><span>Was möchtest du machen?</span><TextInput value={title} maxLength={160} onChange={event => setTitle(event.target.value)} /></label>
      <label className="block space-y-1"><span>Gesamtdauer in Minuten · freiwillig</span><TextInput type="number" min={1} max={480} value={minutes} onChange={event => setMinutes(event.target.value)} /></label>
      <Choice label="Energie · freiwillig" value={energy} onChange={setEnergy} options={[{ value: '', label: 'Offen' }, { value: 'low', label: 'Wenig' }, { value: 'medium', label: 'Mittel' }, { value: 'high', label: 'Viel' }]} />
      <Choice label="Kontext · freiwillig" value={context} onChange={setContext} options={[{ value: '', label: 'Offen' }, { value: 'inside', label: 'Drinnen' }, { value: 'outside', label: 'Draußen' }]} />
      <label className="block space-y-1"><span>Benötigte Dinge · durch Komma trennen</span><TextInput value={things} onChange={event => setThings(event.target.value)} /></label>
      {error && <p role="alert" className="text-warm">{error}</p>}
      <Button type="submit" variant="primary" disabled={busy || !title.trim()} className="w-full">Speichern</Button>
      {editing && <Button disabled={busy} className="w-full" onClick={() => void save(h => ({ ...h, items: h.items.map(x => x.id === selected ? { ...x, activities: x.activities?.map(a => a.id === editing ? { ...a, paused: !a.paused } : a) } : x) })).then(ok => { if (ok) setSelected(undefined) })}>Aktivität pausieren / fortsetzen</Button>}
    </form></Sheet>
  </Page>
}

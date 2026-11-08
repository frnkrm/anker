import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { randomId } from '../../core/defaults'
import { routineBlock } from '../../core/planner'
import { addDays, daysBetween, weekday, WEEKDAYS_LONG } from '../../core/time'
import { remainingSec } from '../../core/support'
import { useNow } from '../../state/hooks'
import { planFor, today, useApp } from '../../state/store'
import { WeatherCard } from '../components/WeatherCard'
import { PackingForDay } from '../components/Packing'
import { TrialCard } from '../components/DayTasks'
import { HubContent } from '../components/HubContent'
import { restoreTextEntries } from '../components/listUndo'
import { Button, Card, Checkbox, Choice, MoreInfo, Page, RingTimer, Section, Stepper, TextInput, notifySaved } from '../components/ui'

/** Essen: gleiche Gerichte und Vorkoch-Entscheidungen, Bearbeiten nur bei Bedarf. */
export function Food() {
  const st = useApp()
  const d = today()
  const [pick, setPick] = useState<string>()
  const [title, setTitle] = useState('')
  const [min, setMin] = useState(20)
  const [error, setError] = useState('')
  const meals = st.settings.meals
  const isPrepDay = weekday(d) === st.settings.prepDay
  const remove = async (id: string) => {
    const index = meals.findIndex((item) => item.id === id)
    const removed = meals[index]
    if (!removed) return
    try {
      await st.saveSettings((settings) => ({ ...settings, meals: settings.meals.filter((item) => item.id !== id) }))
      st.showToast('Gericht entfernt.', { label: 'Rückgängig', run: () => st.saveSettings((settings) => ({ ...settings, meals: settings.meals.some((item) => item.id === id) ? settings.meals : [...settings.meals.slice(0, index), removed, ...settings.meals.slice(index)] })) })
    } catch { setError('Das Gericht konnte noch nicht entfernt werden.') }
  }
  return <Page title="Essen" back="/abend">
    <Card className="space-y-3 text-center">
      <p className="text-muted">Keine Lust zu entscheiden?</p>
      {pick && <p className="text-2xl font-semibold">{pick}</p>}
      <Button variant="primary" size="lg" className="w-full" onClick={() => {
        if (!meals.length) { setError('Trage zuerst ein Gericht unter „Gerichte anpassen“ ein.'); return }
        setPick(meals[Math.floor(Math.random() * meals.length)]?.title)
      }}>🎲 Gericht vorschlagen</Button>
    </Card>
    <Card><p>Vorkoch-Tag: <strong>{WEEKDAYS_LONG[st.settings.prepDay]}</strong></p>
      {isPrepDay && <Button className="mt-3 w-full" onClick={() => st.updateDay(d, (log) => ({ ...log, prepCooked: !log.prepCooked }))}>{st.days[d]?.prepCooked ? '✓ Heute vorgekocht' : 'Heute vorgekocht'}</Button>}
    </Card>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    <Section title="Schnelle Gerichte">{meals.map((meal) => <div key={meal.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4 py-2"><span className="min-w-0 flex-1 break-words">{meal.title}</span><span className="shrink-0 text-sm text-muted">{meal.minutes} min</span></div>)}</Section>
    <details className="space-y-3 rounded-2xl border border-line p-3"><summary className="min-h-11 py-2 font-medium">Gerichte anpassen</summary>
      {meals.map((meal) => <div key={meal.id} className="flex min-h-12 items-center gap-2"><span className="min-w-0 flex-1 break-words">{meal.title}</span><Button size="sm" variant="ghost" aria-label={`${meal.title} entfernen`} onClick={() => void remove(meal.id)}>×</Button></div>)}
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault()
        if (!title.trim()) { setError('Gib dem Gericht einen Namen.'); return }
        try { await st.saveSettings((settings) => ({ ...settings, meals: [...settings.meals, { id: randomId(), title: title.trim(), minutes: min }] })); setTitle(''); setError(''); notifySaved() }
        catch { setError('Das Gericht konnte noch nicht gespeichert werden.') }
      }}><TextInput aria-label="Neues Gericht" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Neues Gericht" /><Stepper label="Kochzeit" value={min} min={5} max={120} onChange={setMin} /><Button type="submit" className="w-full">Hinzufügen</Button></form>
      <Choice label="Vorkoch-Tag" value={st.settings.prepDay} options={WEEKDAYS_LONG.map((label, value) => ({ label, value }))} onChange={(value) => { void st.saveSettings((settings) => ({ ...settings, prepDay: value })).then(notifySaved).catch(() => setError('Der Tag konnte noch nicht gespeichert werden.')) }} />
    </details>
  </Page>
}

function readTidyStart(date: string): number | null {
  try { const raw = localStorage.getItem(`anker.tidy.${date}`); const at = raw === null ? NaN : Number(raw); return Number.isFinite(at) && at > 0 ? at : null }
  catch { return null }
}

/** Der bestehende Aufräumtimer läuft weiter, bis die Person selbst abschließt. */
export function Tidy() {
  const st = useApp()
  const nav = useNavigate()
  const now = useNow(1000)
  const d = today()
  const zones = st.settings.tidyZones
  const zone = zones.length ? zones[Math.abs(daysBetween(st.settings.game.startDate, d)) % zones.length] : 'Wohnung'
  const [timer, setTimer] = useState(() => ({ date: d, at: readTidyStart(d) }))
  const [newZone, setNewZone] = useState('')
  const [error, setError] = useState('')
  const total = 600
  const startedAt = timer.date === d ? timer.at : null
  const left = startedAt === null ? null : Math.min(total, remainingSec(startedAt, total, now))
  useEffect(() => { setTimer({ date: d, at: readTidyStart(d) }) }, [d])
  const start = () => {
    const at = Date.now()
    try { for (const key of Object.keys(localStorage)) if (key.startsWith('anker.tidy.')) localStorage.removeItem(key); localStorage.setItem(`anker.tidy.${d}`, String(at)) }
    catch { /* Der sichtbare Timer bleibt auch ohne lokalen Speicher bedienbar. */ }
    setTimer({ date: d, at })
  }
  const finish = async () => {
    try {
      await st.updateDay(d, (log) => ({ ...log, tidyDone: true }))
      const step = routineBlock(planFor(d), 'evening')?.steps?.find((item) => item.tag === 'tidy')
      const remaining = startedAt === null ? total : remainingSec(startedAt, total, Date.now())
      if (step) await st.setStep(d, 'evening', step.id, remaining > 0 ? 'minimal' : 'done')
      try { localStorage.removeItem(`anker.tidy.${d}`) } catch { /* Optionaler Speicher. */ }
      st.showToast('Aufgeräumt. Sieht gut aus!'); nav(-1)
    } catch { setError('Dein Abschluss konnte noch nicht gespeichert werden. Bitte versuche es erneut.') }
  }
  const remove = async (value: string) => {
    try {
      await st.saveSettings((settings) => ({ ...settings, tidyZones: settings.tidyZones.filter((item) => item !== value) }))
      st.showToast('Zone entfernt.', { label: 'Rückgängig', run: () => st.saveSettings((settings) => ({ ...settings, tidyZones: restoreTextEntries(settings.tidyZones, zones, value) })) })
    } catch { setError('Die Zone konnte noch nicht entfernt werden.') }
  }
  return <Page title="Aufräumen" back="/abend">
    <Card className="space-y-4 text-center"><p className="text-muted">Heute dran</p><h2 className="text-3xl font-semibold">{zone}</h2>
      <RingTimer remainingSec={left ?? total} totalSec={total} pulse={st.settings.focus.pulse} label="Aufräumzeit" />
      <Button variant="primary" size="xl" className="w-full" onClick={left === null ? start : () => void finish()}>{left === null ? '10 Minuten starten' : left > 0 ? 'Fertig' : 'Geschafft!'}</Button>
    </Card>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    <details className="space-y-3 rounded-2xl border border-line p-3"><summary className="min-h-11 py-2 font-medium">Zonen anpassen</summary>
      <p className="text-sm text-muted">Die Zonen wechseln täglich.</p>
      {zones.map((value, index) => <div key={`${index}:${value}`} className="flex min-h-12 items-center gap-2"><span className="min-w-0 flex-1 break-words">{value}</span><Button size="sm" variant="ghost" aria-label={`${value} entfernen`} onClick={() => void remove(value)}>×</Button></div>)}
      <form className="flex gap-2" onSubmit={async (event) => {
        event.preventDefault()
        if (!newZone.trim()) { setError('Gib der neuen Zone einen Namen.'); return }
        try { await st.saveSettings((settings) => ({ ...settings, tidyZones: [...settings.tidyZones, newZone.trim()] })); setNewZone(''); setError(''); notifySaved() }
        catch { setError('Die Zone konnte noch nicht gespeichert werden.') }
      }}><TextInput aria-label="Neue Zone" value={newZone} onChange={(event) => setNewZone(event.target.value)} placeholder="Neue Zone" /><Button type="submit" aria-label="Zone hinzufügen">+</Button></form>
    </details>
  </Page>
}

/** Abhakliste und Bearbeiten sind bewusst getrennt, die gespeicherte Liste bleibt dieselbe. */
export function Prep({ embedded = false }: { embedded?: boolean } = {}) {
  const st = useApp()
  const d = today()
  const plan = planFor(d)
  const items = [...st.settings.eveningPrep, ...(routineBlock(plan, 'evening')?.steps?.some((item) => item.tag === 'gymbag') ? ['Sporttasche gepackt'] : [])]
  const checked = new Set(st.days[d]?.prepChecklist ?? [])
  const [newItem, setNewItem] = useState('')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const toggle = async (item: string) => {
    const next = new Set(checked)
    if (next.has(item)) next.delete(item); else next.add(item)
    try {
      await st.updateDay(d, (log) => ({ ...log, prepChecklist: [...next] }))
      if (items.every((value) => next.has(value))) {
        for (const step of routineBlock(plan, 'evening')?.steps ?? []) if ((step.tag === 'prep' || step.tag === 'gymbag') && !st.days[d]?.steps[`evening:${step.id}`]) await st.setStep(d, 'evening', step.id, 'done')
        st.showToast('Morgen-Ich sagt danke.')
      }
    } catch { setError('Deine Auswahl konnte noch nicht gespeichert werden.') }
  }
  const remove = async (value: string) => {
    const original = st.settings.eveningPrep
    try {
      await st.saveSettings((settings) => ({ ...settings, eveningPrep: settings.eveningPrep.filter((item) => item !== value) }))
      st.showToast('Vorbereitung entfernt.', { label: 'Rückgängig', run: () => st.saveSettings((settings) => ({ ...settings, eveningPrep: restoreTextEntries(settings.eveningPrep, original, value) })) })
    } catch { setError('Der Eintrag konnte noch nicht entfernt werden.') }
  }
  return <HubContent title="Für morgen vorbereiten" back="/abend" embedded={embedded}>
    {!editing && <><WeatherCard /><PackingForDay date={addDays(d, 1)} /><Section>{items.map((value, index) => <Checkbox key={`${index}:${value}`} checked={checked.has(value)} onChange={() => void toggle(value)} className="rounded-2xl bg-surface px-4 py-2 text-lg"><span className={checked.has(value) ? 'text-muted line-through' : ''}>{value}</span></Checkbox>)}</Section></>}
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    {!editing ? <Button className="w-full" onClick={() => setEditing(true)}>Liste bearbeiten</Button> : <Section title="Liste anpassen">
      {st.settings.eveningPrep.map((value, index) => <div key={`${index}:${value}`} className="flex min-h-12 items-center gap-2 rounded-2xl bg-surface px-3"><span className="min-w-0 flex-1 break-words">{value}</span><Button size="sm" variant="ghost" aria-label={`${value} entfernen`} onClick={() => void remove(value)}>×</Button></div>)}
      <form className="flex gap-2" onSubmit={async (event) => {
        event.preventDefault()
        if (!newItem.trim()) { setError('Was möchtest du für morgen bereitlegen?'); return }
        try { await st.saveSettings((settings) => ({ ...settings, eveningPrep: [...settings.eveningPrep, newItem.trim()] })); setNewItem(''); setError(''); notifySaved() }
        catch { setError('Der Eintrag konnte noch nicht gespeichert werden.') }
      }}><TextInput aria-label="Neue Vorbereitung" value={newItem} onChange={(event) => setNewItem(event.target.value)} placeholder="z. B. Brotdose gepackt" /><Button type="submit" aria-label="Vorbereitung hinzufügen">+</Button></form>
      <Button variant="primary" className="w-full" onClick={() => setEditing(false)}>Fertig</Button>
    </Section>}
  </HubContent>
}

/** Drei unveränderte Rückblickfragen und die bisherige freiwillige Nutzungsprobe. */
export function Review({ embedded = false }: { embedded?: boolean } = {}) {
  const st = useApp()
  const nav = useNavigate()
  const d = today()
  const existing = st.reviews.find((review) => review.id === d)
  const [good, setGood] = useState(existing?.good ?? '')
  const [hard, setHard] = useState(existing?.hard ?? '')
  const [change, setChange] = useState(existing?.change ?? '')
  const [error, setError] = useState('')
  const area = 'min-h-24 w-full rounded-2xl bg-surface p-4 text-lg placeholder:text-muted'
  return <HubContent title="Wochenrückblick" back="/mehr" embedded={embedded}>
    <p className="px-1 text-muted">Drei Fragen, keine Bewertung. Stichworte reichen.</p>
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault()
      try { await st.saveReview({ id: d, good, hard, change }); st.showToast('Danke dir. Gute neue Woche!'); nav('/') }
      catch { setError('Dein Rückblick konnte noch nicht gespeichert werden. Die Eingaben bleiben hier.') }
    }}>
      <label className="block space-y-2"><span className="px-1 font-medium">Was hat geklappt?</span><textarea aria-label="Was hat geklappt?" className={area} value={good} onChange={(event) => setGood(event.target.value)} /></label>
      <label className="block space-y-2"><span className="px-1 font-medium">Was war schwer?</span><textarea aria-label="Was war schwer?" className={area} value={hard} onChange={(event) => setHard(event.target.value)} /></label>
      <label className="block space-y-2"><span className="px-1 font-medium">Eine kleine Änderung für nächste Woche?</span><textarea aria-label="Eine kleine Änderung für nächste Woche?" className={area} value={change} onChange={(event) => setChange(event.target.value)} placeholder="z. B. Handy abends ins Wohnzimmer" /><span className="px-1 text-sm text-muted">Landet als Vorschlag in den Einstellungen.</span></label>
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      <Button type="submit" variant="primary" size="lg" className="w-full">Speichern</Button>
    </form>
    <MoreInfo summary="Hilft mir Anker?"><TrialCard date={d} /></MoreInfo>
  </HubContent>
}

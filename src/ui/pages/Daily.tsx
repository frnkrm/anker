import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { randomId } from '../../core/defaults'
import { routineBlock } from '../../core/planner'
import { daysBetween, weekday, WEEKDAYS_LONG } from '../../core/time'
import { planFor, today, useApp } from '../../state/store'
import { WeatherCard } from '../components/WeatherCard'
import { Button, Card, Page, Progress, Section, Stepper, TextInput } from '../components/ui'

/** Essen: schnelle Gerichte, Würfeln, Vorkoch-Tag. */
export function Food() {
  const st = useApp()
  const d = today()
  const [pick, setPick] = useState<string>()
  const [title, setTitle] = useState('')
  const [min, setMin] = useState(20)
  const meals = st.settings.meals
  const isPrepDay = weekday(d) === st.settings.prepDay

  return (
    <Page title="Essen" back>
      <Card className="text-center">
        <p className="mb-3 text-muted">Keine Lust zu entscheiden?</p>
        {pick && <p className="mb-3 text-2xl font-semibold animate-pop">{pick}</p>}
        <Button variant="primary" size="lg" className="w-full" disabled={!meals.length} onClick={() => setPick(meals[Math.floor(Math.random() * meals.length)]?.title)}>
          🎲 Gericht vorschlagen
        </Button>
      </Card>
      <Card>
        <p>
          Vorkoch-Tag: <strong>{WEEKDAYS_LONG[st.settings.prepDay]}</strong>
        </p>
        {isPrepDay && (
          <Button variant={st.days[d]?.prepCooked ? 'secondary' : 'warm'} className="mt-3 w-full" onClick={() => st.updateDay(d, (l) => ({ ...l, prepCooked: !l.prepCooked }))}>
            {st.days[d]?.prepCooked ? '✓ Heute vorgekocht' : 'Heute vorgekocht'}
          </Button>
        )}
      </Card>
      <Section title="Schnelle Gerichte">
        {meals.map((m) => (
          <div key={m.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4">
            <span className="flex-1">{m.title}</span>
            <span className="text-sm text-muted">{m.minutes} min</span>
            <button type="button" aria-label={`${m.title} entfernen`} className="h-10 w-10 text-muted" onClick={() => st.saveSettings((s) => ({ ...s, meals: s.meals.filter((x) => x.id !== m.id) }))}>
              ✕
            </button>
          </div>
        ))}
        <Card className="space-y-3">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neues Gericht" />
          <div className="flex items-center justify-between">
            <Stepper label="Kochzeit" value={min} min={5} max={120} onChange={setMin} />
            <Button
              variant="primary"
              disabled={!title.trim()}
              onClick={async () => {
                await st.saveSettings((s) => ({ ...s, meals: [...s.meals, { id: randomId(), title: title.trim(), minutes: min }] }))
                setTitle('')
              }}
            >
              Hinzufügen
            </Button>
          </div>
        </Card>
      </Section>
    </Page>
  )
}

/** Aufräumen: 10-Minuten-Timer mit rotierenden Zonen. */
export function Tidy() {
  const st = useApp()
  const nav = useNavigate()
  const d = today()
  const zones = st.settings.tidyZones
  const zone = zones.length ? zones[Math.abs(daysBetween(st.settings.game.startDate, d)) % zones.length] : 'Wohnung'
  const [left, setLeft] = useState<number | null>(null)
  const [newZone, setNewZone] = useState('')
  const total = 600

  useEffect(() => {
    if (left === null || left <= 0) return
    const id = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(id)
  }, [left])

  const finish = async () => {
    await st.updateDay(d, (l) => ({ ...l, tidyDone: true }))
    const step = routineBlock(planFor(d), 'evening')?.steps?.find((x) => x.tag === 'tidy')
    if (step) await st.setStep(d, 'evening', step.id, left && left > 0 ? 'minimal' : 'done')
    st.showToast('Aufgeräumt. Sieht gut aus!')
    nav(-1)
  }

  return (
    <Page title="Aufräumen" back>
      <Card className="text-center">
        <p className="text-muted">Heute dran</p>
        <p className="text-3xl font-semibold">{zone}</p>
        <div className="my-6 text-6xl font-light tabular-nums">
          {Math.floor((left ?? total) / 60)}:{String((left ?? total) % 60).padStart(2, '0')}
        </div>
        <Progress value={left === null ? 0 : 1 - left / total} />
        <div className="mt-5 space-y-2">
          {left === null ? (
            <Button variant="primary" size="xl" className="w-full" onClick={() => setLeft(total)}>
              10 Minuten starten
            </Button>
          ) : (
            <Button variant="primary" size="xl" className="w-full" onClick={finish}>
              {left > 0 ? 'Fertig' : 'Geschafft!'}
            </Button>
          )}
        </div>
      </Card>
      <Section title="Zonen (wechseln täglich)">
        {zones.map((z) => (
          <div key={z} className="flex min-h-12 items-center gap-3 rounded-2xl bg-surface px-4">
            <span className="flex-1">{z}</span>
            <button type="button" aria-label={`${z} entfernen`} className="h-10 w-10 text-muted" onClick={() => st.saveSettings((s) => ({ ...s, tidyZones: s.tidyZones.filter((x) => x !== z) }))}>
              ✕
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <TextInput value={newZone} onChange={(e) => setNewZone(e.target.value)} placeholder="Neue Zone" />
          <Button
            disabled={!newZone.trim()}
            onClick={async () => {
              await st.saveSettings((s) => ({ ...s, tidyZones: [...s.tidyZones, newZone.trim()] }))
              setNewZone('')
            }}
          >
            +
          </Button>
        </div>
      </Section>
    </Page>
  )
}

/** Abend-Vorbereitung als Checkliste. */
export function Prep() {
  const st = useApp()
  const d = today()
  const plan = planFor(d)
  const items = [...st.settings.eveningPrep, ...(routineBlock(plan, 'evening')?.steps?.some((x) => x.tag === 'gymbag') ? ['Sporttasche gepackt'] : [])]
  const checked = new Set(st.days[d]?.prepChecklist ?? [])
  const [newItem, setNewItem] = useState('')

  const toggle = async (item: string) => {
    const next = new Set(checked)
    if (next.has(item)) next.delete(item)
    else next.add(item)
    await st.updateDay(d, (l) => ({ ...l, prepChecklist: [...next] }))
    if (items.every((x) => next.has(x))) {
      for (const step of routineBlock(plan, 'evening')?.steps ?? []) {
        if ((step.tag === 'prep' || step.tag === 'gymbag') && !st.days[d]?.steps[`evening:${step.id}`]) await st.setStep(d, 'evening', step.id, 'done')
      }
      st.showToast('Morgen-Ich sagt danke.')
    }
  }

  return (
    <Page title="Für morgen vorbereiten" back>
      <WeatherCard />
      <Section>
        {items.map((x) => (
          <label key={x} className="flex min-h-16 items-center gap-4 rounded-2xl bg-surface px-4 text-lg">
            <input type="checkbox" className="h-7 w-7 accent-[var(--accent)]" checked={checked.has(x)} onChange={() => toggle(x)} />
            <span className={checked.has(x) ? 'text-muted line-through' : ''}>{x}</span>
          </label>
        ))}
      </Section>
      <Section title="Liste anpassen">
        {st.settings.eveningPrep.map((x) => (
          <div key={x} className="flex min-h-12 items-center gap-3 rounded-2xl bg-surface px-4">
            <span className="flex-1">{x}</span>
            <button type="button" aria-label={`${x} entfernen`} className="h-10 w-10 text-muted" onClick={() => st.saveSettings((s) => ({ ...s, eveningPrep: s.eveningPrep.filter((y) => y !== x) }))}>
              ✕
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <TextInput value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="z. B. Brotdose gepackt" />
          <Button
            disabled={!newItem.trim()}
            onClick={async () => {
              await st.saveSettings((s) => ({ ...s, eveningPrep: [...s.eveningPrep, newItem.trim()] }))
              setNewItem('')
            }}
          >
            +
          </Button>
        </div>
      </Section>
    </Page>
  )
}

/** Wochenrückblick: drei Fragen, ohne Bewertung. */
export function Review() {
  const st = useApp()
  const nav = useNavigate()
  const d = today()
  const existing = st.reviews.find((r) => r.id === d)
  const [good, setGood] = useState(existing?.good ?? '')
  const [hard, setHard] = useState(existing?.hard ?? '')
  const [change, setChange] = useState(existing?.change ?? '')
  const area = 'min-h-24 w-full rounded-2xl bg-surface p-4 text-lg placeholder:text-muted'
  return (
    <Page title="Wochenrückblick" back>
      <p className="px-1 text-muted">Drei Fragen, keine Bewertung. Stichworte reichen.</p>
      <label className="block space-y-2">
        <span className="px-1 font-medium">Was hat geklappt?</span>
        <textarea className={area} value={good} onChange={(e) => setGood(e.target.value)} />
      </label>
      <label className="block space-y-2">
        <span className="px-1 font-medium">Was war schwer?</span>
        <textarea className={area} value={hard} onChange={(e) => setHard(e.target.value)} />
      </label>
      <label className="block space-y-2">
        <span className="px-1 font-medium">Eine kleine Änderung für nächste Woche?</span>
        <textarea className={area} value={change} onChange={(e) => setChange(e.target.value)} placeholder="z. B. Handy abends ins Wohnzimmer" />
        <span className="px-1 text-sm text-muted">Landet als Vorschlag in den Einstellungen.</span>
      </label>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={async () => {
          await st.saveReview({ id: d, good, hard, change })
          st.showToast('Danke dir. Gute neue Woche!')
          nav('/')
        }}
      >
        Speichern
      </Button>
    </Page>
  )
}

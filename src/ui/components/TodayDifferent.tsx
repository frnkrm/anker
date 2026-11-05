import { useState } from 'react'
import { randomId } from '../../core/defaults'
import { mapsUrl, parseQuickTime } from '../../core/planner'
import { sleepOutlook, wakeProposal } from '../../core/sleep'
import type { NextAction } from '../../core/support'
import { addDays, fmtTime } from '../../core/time'
import type { Commitment, CommitmentKind, DayLog, EventContext, RoutineId } from '../../core/types'
import { Browser } from '@capacitor/browser'
import { isNative, safe } from '../../platform/native'
import { pushPcStop } from '../../platform/supabase'
import { planFor, useApp } from '../../state/store'
import { Button, Card, Segmented, Sheet, TextInput, TimeField } from './ui'
import { WorkDayForm } from './WorkControls'

type View = 'menu' | 'event' | 'later' | 'not-needed' | 'late' | 'covered' | 'work'

const REASONS = ['Termin', 'Freunde', 'Zu müde', 'Später', 'Nicht nötig']

const KINDS: { value: EventContext; label: string; hard: CommitmentKind }[] = [
  { value: 'social', label: 'Freunde', hard: 'soft' },
  { value: 'personal', label: 'Termin', hard: 'hard' },
  { value: 'customer', label: 'Kunde', hard: 'hard' },
  { value: 'other', label: 'Unterwegs', hard: 'soft' },
]

export function openRoute(destination: string, mode?: Commitment['routeMode']) {
  const url = mapsUrl(destination, mode)
  if (isNative()) void safe(() => Browser.open({ url }), undefined)
  else window.open(url, '_blank', 'noreferrer')
}

/** Optionale Rückfrage. Nie Pflicht, abschaltbar, ohne Nachhaken. */
function ReasonChips({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const ask = useApp((s) => s.settings.askReason)
  if (!ask) return null
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted">Was ist stattdessen los? (freiwillig)</p>
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button key={r} type="button" aria-pressed={value === r} onClick={() => onChange(value === r ? undefined : r)} className={`min-h-10 rounded-xl px-3 text-sm ${value === r ? 'bg-accent font-semibold text-accent-ink' : 'bg-surface-2'}`}>
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * „Heute anders“: wenige klare Wege, mitten in einer Routine erreichbar.
 * Ein Plan ist ein Angebot: Nichts davon gilt als erledigt oder als verfehlt, und alles lässt sich zurücknehmen.
 */
export function TodayDifferent({ open, onClose, date, m, action, isTomorrow = false }: { open: boolean; onClose: () => void; date: string; m: number; action?: NextAction; isTomorrow?: boolean }) {
  const st = useApp()
  const [view, setView] = useState<View>('menu')
  const [reason, setReason] = useState<string>()
  const log: DayLog | undefined = st.days[date]
  const changes = log?.changes ?? []
  const routine: RoutineId | undefined = action?.type === 'step' ? action.routine : undefined

  const close = () => {
    setView('menu')
    setReason(undefined)
    onClose()
  }
  const finish = (toast: string) => {
    close()
    st.showToast(toast)
  }
  const planEvening = routine ?? 'evening'
  const plan = planFor(date)
  const routineName = planEvening === 'morning' ? 'Morgenroutine' : 'Abendroutine'
  const withReason = (o: DayLog['override']) => (reason ? { ...o, reason } : o)

  const menu = (
    <div className="space-y-2">
      <Button size="lg" className="w-full !justify-start" onClick={() => setView('event')}>
        {isTomorrow ? 'Ich habe morgen einen Termin' : 'Ich habe heute etwas anderes vor'}
      </Button>
      <Button size="lg" className="w-full !justify-start" onClick={() => setView('work')}>
        {isTomorrow ? 'Arbeit an diesem Tag anders' : 'Arbeit heute anders'}
      </Button>
      {!isTomorrow && (
        <>
          <Button size="lg" className="w-full !justify-start" onClick={() => setView('later')}>
            Diese Routine später
          </Button>
          <Button size="lg" className="w-full !justify-start" onClick={() => setView('not-needed')}>
            Heute nicht nötig
          </Button>
          <Button size="lg" className="w-full !justify-start" onClick={() => setView('late')}>
            Länger wach bleiben
          </Button>
          <Button
            size="lg"
            className="w-full !justify-start"
            onClick={async () => {
              await st.adjustDay(date, 'Rest des Tages in kleinen Versionen', (l) => ({ ...l, override: { ...l.override, light: true } }))
              finish('Okay, heute läuft es anders. Ich passe den Rest an.')
            }}
          >
            Plan ab jetzt neu machen
          </Button>
        </>
      )}
      <Button size="lg" variant="ghost" className="w-full !justify-start" onClick={() => setView('covered')}>
        {isTomorrow ? 'Morgen ist etwas schon versorgt' : 'Für morgen schon erledigt'}
      </Button>
      {changes.length > 0 && (
        <Card className="space-y-2">
          <p className="text-sm text-muted">Heute geändert</p>
          <ul className="space-y-1">
            {changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          <Button
            size="sm"
            onClick={async () => {
              await st.restoreDay(date)
              void pushPcStop()
              finish('Zurück beim ursprünglichen Plan.')
            }}
          >
            Zurück zum ursprünglichen Plan
          </Button>
        </Card>
      )}
    </div>
  )

  const later = (
    <div className="space-y-3">
      <p className="text-muted">{routineName} bleibt offen und meldet sich zur neuen Zeit.</p>
      <ReasonChips value={reason} onChange={setReason} />
      <Button
        size="lg"
        className="w-full"
        onClick={async () => {
          const at = m + 60
          await st.adjustDay(date, `${routineName} um ${fmtTime(at)}`, (l) => ({ ...l, override: withReason({ ...l.override, routineAt: { ...l.override.routineAt, [planEvening]: at } }) }))
          finish(`Okay. ${routineName} um ${fmtTime(at)}.`)
        }}
      >
        In einer Stunde
      </Button>
      {planEvening === 'evening' && (
        <Button
          size="lg"
          className="w-full"
          onClick={async () => {
            await st.adjustDay(date, 'Abendroutine nach Rückkehr', (l) => ({ ...l, override: withReason({ ...l.override, routineAt: { ...l.override.routineAt, evening: 'return' } }) }))
            finish('Okay. Sag einfach Bescheid, wenn du zurück bist.')
          }}
        >
          Wenn ich zurück bin
        </Button>
      )}
      <PickTime
        label="Um"
        initial={m + 120}
        onPick={async (at) => {
          await st.adjustDay(date, `${routineName} um ${fmtTime(at)}`, (l) => ({ ...l, override: withReason({ ...l.override, routineAt: { ...l.override.routineAt, [planEvening]: at } }) }))
          finish(`Okay. ${routineName} um ${fmtTime(at)}.`)
        }}
      />
    </div>
  )

  const openHere = (plan.blocks.find((b) => b.routine === planEvening)?.steps ?? []).filter((s) => !log?.steps[`${planEvening}:${s.id}`])
  const notNeeded = (
    <div className="space-y-3">
      <p className="text-muted">Das gilt nicht als erledigt und nicht als verfehlt. Nur für heute, dein Standard bleibt.</p>
      <ReasonChips value={reason} onChange={setReason} />
      {action?.type === 'step' && (
        <Button
          size="lg"
          className="w-full"
          onClick={async () => {
            await st.adjustDay(date, `${action.title}: heute nicht nötig`, (l) => ({ ...l, override: withReason(l.override), steps: { ...l.steps, [`${action.routine}:${action.step.id}`]: 'not-needed' } }))
            finish('Okay, für heute gestrichen.')
          }}
        >
          Nur dieser Schritt
        </Button>
      )}
      {openHere.length > 0 && (
        <Button
          size="lg"
          className="w-full"
          onClick={async () => {
            await st.adjustDay(date, `${routineName}: heute nicht nötig`, (l) => ({ ...l, override: withReason(l.override), steps: { ...l.steps, ...Object.fromEntries(openHere.map((s) => [`${planEvening}:${s.id}`, 'not-needed' as const])) } }))
            finish(`Okay, ${routineName} entfällt heute.`)
          }}
        >
          Ganze {routineName}
        </Button>
      )}
      {openHere.length === 0 && action?.type !== 'step' && <p>Gerade ist nichts offen.</p>}
    </div>
  )

  return (
    <Sheet open={open} onClose={close} title={view === 'menu' ? (isTomorrow ? 'Morgen anders' : 'Heute anders') : undefined}>
      <div className="max-h-[80dvh] overflow-y-auto">
        {view !== 'menu' && (
          <button type="button" className="mb-2 min-h-10 text-muted" onClick={() => setView('menu')}>
            ‹ Zurück
          </button>
        )}
        {view === 'menu' && menu}
        {view === 'work' && <WorkDayForm date={date} m={m} isTomorrow={isTomorrow} onDone={finish} />}
        {view === 'event' && <EventForm date={date} isTomorrow={isTomorrow} reason={reason} onDone={finish} />}
        {view === 'later' && later}
        {view === 'not-needed' && notNeeded}
        {view === 'late' && <LateForm date={date} m={m} onDone={finish} />}
        {view === 'covered' && <CoveredForm date={isTomorrow ? date : addDays(date, 1)} onDone={finish} />}
      </div>
    </Sheet>
  )
}

function PickTime({ label, initial, onPick }: { label: string; initial: number; onPick: (m: number) => void }) {
  const [t, setT] = useState(initial)
  return (
    <div className="flex items-center gap-2">
      <span>{label}</span>
      <TimeField label={label} value={t} onChange={setT} />
      <Button className="flex-1" onClick={() => onPick(t)}>
        Übernehmen
      </Button>
    </div>
  )
}

/** Wenige Felder. Der Text bleibt Notiz, bis du die Vorschau bestätigst. Nichts wird erfunden. */
function EventForm({ date, isTomorrow, reason, onDone }: { date: string; isTomorrow: boolean; reason?: string; onDone: (t: string) => void }) {
  const st = useApp()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<EventContext>('social')
  const [start, setStart] = useState<number>()
  const [end, setEnd] = useState<number>()
  const [place, setPlace] = useState('')
  const [travel, setTravel] = useState<number>()
  const [replaces, setReplaces] = useState(false)
  const label = text.trim() || (KINDS.find((k) => k.value === kind)?.label ?? 'Termin')
  const time = start ?? parseQuickTime(text)
  const day = isTomorrow ? 'Morgen' : 'Heute'
  const preview = time === undefined ? undefined : `${day} ${fmtTime(time)}, ${label}${place.trim() ? `, ${place.trim()}` : ''}, ${!place.trim() ? 'ohne Fahrt' : travel !== undefined ? `Fahrt ${travel} min` : 'Anfahrt unklar'}, ${end !== undefined ? `bis ${fmtTime(end)}` : 'Ende offen'}.`
  const custom = KINDS.find((k) => k.value === kind)!

  const save = async () => {
    if (time === undefined) return
    const c: Commitment = {
      id: randomId(),
      date,
      label,
      context: kind,
      commitment: custom.hard,
      start: time,
      status: 'planned',
      ...(end !== undefined ? { end } : {}),
      ...(place.trim() ? { placeLabel: place.trim(), address: place.trim() } : { routeMode: 'none' as const }),
      ...(travel !== undefined ? { travelMin: travel } : {}),
      ...(replaces ? { replacesCommute: true } : {}),
    }
    await st.saveCommitment(c)
    await st.adjustDay(date, `Termin um ${fmtTime(time)}`, (l) => ({ ...l, override: reason ? { ...l.override, reason } : l.override }))
    onDone('Okay, heute läuft es anders. Ich passe den Rest an.')
  }

  return (
    <div className="space-y-3">
      <TextInput autoFocus aria-label="Was hast du vor?" placeholder="Z. B. Film bei einer Freundin ab 17 Uhr" value={text} onChange={(e) => setText(e.target.value)} />
      <Segmented<EventContext> label="Art" value={kind} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} onChange={setKind} />
      <div className="flex items-center justify-between gap-2">
        <span>Beginn</span>
        <TimeField label="Beginn" value={time ?? 17 * 60} onChange={setStart} />
      </div>
      {time === undefined && (
        <Button size="sm" onClick={() => setStart(17 * 60)}>
          17:00 übernehmen
        </Button>
      )}
      <div className="flex items-center justify-between gap-2">
        <span>Ende</span>
        {end === undefined ? (
          <div className="flex items-center gap-2">
            <span className="text-muted">Noch offen</span>
            <Button size="sm" onClick={() => setEnd((time ?? 17 * 60) + 120)}>
              Eintragen
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <TimeField label="Ende" value={end} onChange={setEnd} />
            <Button size="sm" variant="ghost" onClick={() => setEnd(undefined)}>
              Offen
            </Button>
          </div>
        )}
      </div>
      <TextInput aria-label="Ort" placeholder="Ort oder Adresse (freiwillig)" value={place} onChange={(e) => setPlace(e.target.value)} />
      {place.trim() && (
        <div className="flex items-center justify-between gap-2">
          <span>Fahrt in Minuten</span>
          <input type="number" inputMode="numeric" min={0} max={600} aria-label="Fahrzeit in Minuten" className="min-h-12 w-24 rounded-xl bg-surface-2 px-3 text-center" value={travel ?? ''} placeholder="offen" onChange={(e) => setTravel(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))} />
        </div>
      )}
      {(kind === 'customer' || kind === 'personal') && place.trim() && (
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" checked={replaces} onChange={(e) => setReplaces(e.target.checked)} />
          Statt ins Büro, nur an diesem Tag
        </label>
      )}
      {preview ? (
        <>
          <p className="rounded-xl bg-surface-2 p-3">{preview}</p>
          <Button variant="primary" size="lg" className="w-full" onClick={save}>
            So übernehmen
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted">Mit einer Uhrzeit kann ich den Rest des Tages anpassen.</p>
      )}
      <p className="text-sm text-muted">Termine und Orte bleiben auf diesem Gerät.</p>
    </div>
  )
}

/** Länger wach: eine freie Entscheidung. Die Folgen stehen sachlich da, entscheiden tust du. */
function LateForm({ date, m, onDone }: { date: string; m: number; onDone: (t: string) => void }) {
  const st = useApp()
  const plan = planFor(date)
  const tomorrowDate = addDays(date, 1)
  const tomorrow = planFor(tomorrowDate)
  const [until, setUntil] = useState<number | 'open'>(plan.pcStop + 60)
  const bed = until === 'open' ? undefined : until
  const outlook = bed === undefined ? undefined : sleepOutlook(bed + Math.min(st.settings.sleep.screenOffMin, 30), tomorrow.wake, st.settings)
  const proposal = wakeProposal(tomorrow, st.settings)
  const [useProposal, setUseProposal] = useState(false)
  const apply = async () => {
    const label = until === 'open' ? 'Heute ohne festes Ende' : `Wach bis ${fmtTime(until)}`
    await st.adjustDay(date, label, (l) => ({ ...l, override: { ...l.override, lateUntil: until === 'open' ? 'open' : until } }))
    if (useProposal && proposal) {
      await st.adjustDay(tomorrowDate, `Wecker morgen ${fmtTime(proposal.wake)} statt ${fmtTime(tomorrow.wake)}`, (l) => ({ ...l, override: { ...l.override, wakeOverride: proposal.wake } }))
    }
    void pushPcStop()
    onDone('Viel Spaß. Der Abend gehört dir.')
  }
  const base = Math.max(m, plan.pcStop)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button aria-pressed={until === base + 30} onClick={() => setUntil(base + 30)}>
          +30 Minuten
        </Button>
        <Button aria-pressed={until === base + 60} onClick={() => setUntil(base + 60)}>
          +1 Stunde
        </Button>
        <Button aria-pressed={until === 'open'} onClick={() => setUntil('open')}>
          Weiß ich noch nicht
        </Button>
      </div>
      {until !== 'open' && (
        <div className="flex items-center justify-between">
          <span>Bis</span>
          <TimeField label="Wach bis" value={until} onChange={(v) => setUntil(v < 720 ? v + 1440 : v)} />
        </div>
      )}
      {outlook ? <p>{outlook.text}</p> : <p>Kein festes Ende. Anker bleibt still, der Wecker morgen um {fmtTime(tomorrow.wake)} bleibt gestellt.</p>}
      {outlook?.short && <p className="text-sm text-muted">Nur zur Info. Du entscheidest. Morgen reicht auch die kleine Version der Routine.</p>}
      {proposal?.later && (
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" checked={useProposal} onChange={(e) => setUseProposal(e.target.checked)} />
          <span>{proposal.text} Nur morgen so wecken.</span>
        </label>
      )}
      <Button variant="primary" size="lg" className="w-full" onClick={apply}>
        Übernehmen
      </Button>
    </div>
  )
}

/** „Abends geduscht“: Der Morgenschritt entfällt, gilt am Morgen aber nicht als erledigt. */
function CoveredForm({ date, onDone }: { date: string; onDone: (t: string) => void }) {
  const st = useApp()
  const covered = st.days[date]?.override.coveredSteps ?? []
  const steps = st.settings.routines.morning
  return (
    <div className="space-y-2">
      <p className="text-muted">Das entfällt am nächsten Morgen. Es zählt dort nicht als erledigt, und der Standard bleibt.</p>
      {steps.map((x) => {
        const key = `morning:${x.id}`
        const on = covered.includes(key)
        return (
          <label key={x.id} className="flex min-h-12 items-center gap-3 rounded-2xl bg-surface-2 px-3">
            <input
              type="checkbox"
              className="h-6 w-6 accent-[var(--accent)]"
              checked={on}
              onChange={() =>
                st.adjustDay(date, on ? `${x.title} morgens wieder nötig` : `${x.title} morgens nicht nötig`, (l) => ({
                  ...l,
                  override: { ...l.override, coveredSteps: on ? covered.filter((k) => k !== key) : [...covered, key] },
                }))
              }
            />
            {x.title}
          </label>
        )
      })}
      <Button variant="primary" className="mt-2 w-full" onClick={() => onDone('Okay, ist notiert.')}>
        Fertig
      </Button>
    </div>
  )
}

/** Einmalige Weckzeit nach Bestätigung. Solange der Wecker am Gerät ungeprüft ist, steht das auch da. */
export function WakeSuggestion({ date }: { date: string }) {
  const st = useApp()
  const plan = planFor(date)
  const p = wakeProposal(plan, st.settings)
  const override = st.days[date]?.override.wakeOverride
  if (override !== undefined) {
    return (
      <Card className="space-y-2">
        <p>
          Wecker an diesem Tag einmalig um <strong>{fmtTime(override)}</strong>. Danach gilt wieder {fmtTime(st.settings.anchor.wake)}.
        </p>
        <Button size="sm" onClick={() => st.updateDay(date, (l) => {
          const o = { ...l.override }
          delete o.wakeOverride
          return { ...l, override: o }
        })}>
          Zurück zu {fmtTime(st.settings.anchor.wake)}
        </Button>
      </Card>
    )
  }
  if (!p) return null
  return (
    <Card className="space-y-2">
      <p>{p.text}</p>
      <p className="text-sm text-muted">Gilt nur für diesen Tag. Lass bis zur Prüfung am Handy den Android-Wecker zusätzlich gestellt.</p>
      <Button size="sm" onClick={() => st.adjustDay(date, `Wecker ${fmtTime(p.wake)} statt ${fmtTime(plan.wake)}`, (l) => ({ ...l, override: { ...l.override, wakeOverride: p.wake } }))}>
        Einmalig um {fmtTime(p.wake)} wecken
      </Button>
    </Card>
  )
}

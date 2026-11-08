import { useRef, useState } from 'react'
import { routineCoverage } from '../../core/flexible'
import { mapsUrl } from '../../core/planner'
import { sleepOutlook, wakeProposal } from '../../core/sleep'
import type { NextAction } from '../../core/support'
import { germanDayDate } from '../../core/uiText'
import { addDays, fmtTime } from '../../core/time'
import type { Commitment, DayLog, RoutineId } from '../../core/types'
import { Browser } from '@capacitor/browser'
import { isNative, safe } from '../../platform/native'
import { pushPcStop } from '../../platform/supabase'
import { applyWakeChange } from '../../platform/wakeChange'
import { planFor, useApp } from '../../state/store'
import { BackButton, Button, Card, Checkbox, Sheet, TimeField } from './ui'
import { WorkDayForm } from './WorkControls'
import { CommitmentForm } from './CommitmentForm'

type View = 'menu' | 'event' | 'later' | 'not-needed' | 'late' | 'covered' | 'covered-today' | 'work'

const REASONS = ['Termin', 'Freunde', 'Zu müde', 'Später', 'Nicht nötig']


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
      <p className="text-sm text-muted">Was ist stattdessen los?</p>
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button key={r} type="button" aria-pressed={value === r} onClick={() => onChange(value === r ? undefined : r)} className={`min-h-11 rounded-xl px-3 text-sm ${value === r ? 'bg-accent font-semibold text-accent-ink' : 'bg-surface-2'}`}>
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
function usePlanAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await action() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Die Änderung konnte nicht sicher gespeichert werden.') }
    finally { pending.current = false; setBusy(false) }
  }
  return { busy, error, run }
}

export function TodayDifferent({ open, onClose, onApplied, date, m, action, isTomorrow = false, initialView = 'menu' }: { open: boolean; onClose: () => void; onApplied?: () => void; date: string; m: number; action?: NextAction; isTomorrow?: boolean; initialView?: View }) {
  const st = useApp()
  const [view, setView] = useState<View>(initialView)
  const [reason, setReason] = useState<string>()
  const { busy, error, run } = usePlanAction()
  const log: DayLog | undefined = st.days[date]
  const changes = log?.changes ?? []
  const routine: RoutineId | undefined = action?.type === 'step' ? action.routine : undefined
  const planEvening = routine ?? 'evening'
  const plan = planFor(date)
  const routineName = planEvening === 'morning' ? 'Morgenroutine' : 'Abendroutine'
  const withReason = (override: DayLog['override']) => reason ? { ...override, reason } : override
  const close = () => { setView('menu'); setReason(undefined); onClose() }
  const finish = (toast: string) => { close(); st.showToast(toast); onApplied?.() }
  const change = (label: string, edit: (log: DayLog) => DayLog, toast: string) => run(async () => { await st.adjustDay(date, label, edit); finish(toast) })
  const later = (at: number | 'return') => change(
    at === 'return' ? 'Abendroutine nach Rückkehr' : `${routineName} um ${fmtTime(at)}`,
    (log) => ({ ...log, override: withReason({ ...log.override, routineAt: { ...log.override.routineAt, [planEvening]: at } }) }),
    at === 'return' ? 'Okay. Sag einfach Bescheid, wenn du zurück bist.' : `Okay. ${routineName} um ${fmtTime(at)}.`,
  )
  const openHere = (plan.blocks.find((block) => block.routine === planEvening)?.steps ?? []).filter((step) => !log?.steps[`${planEvening}:${step.id}`])

  return <Sheet open={open} onClose={close} title={view === 'menu' ? (isTomorrow ? 'Morgen anders' : 'Heute anders') : undefined}>
    <fieldset disabled={busy} className="min-w-0 space-y-3">
      {error && <p role="alert" className="text-warm">{error}</p>}
      {view !== 'menu' && <BackButton onClick={() => setView('menu')} />}
      {view === 'menu' && <div className="space-y-2">
        <Button size="lg" className="w-full !justify-start" onClick={() => setView('event')}>{isTomorrow ? 'Ich habe morgen einen Termin' : 'Ich habe heute etwas anderes vor'}</Button>
        <Button size="lg" className="w-full !justify-start" onClick={() => setView('work')}>{isTomorrow ? 'Arbeit an diesem Tag anders' : 'Arbeit heute anders'}</Button>
        {!isTomorrow && <Button size="lg" className="w-full !justify-start" onClick={() => setView('later')}>Diese Routine später</Button>}
        <details className="rounded-2xl border border-line px-3">
          <summary className="min-h-12 py-3 text-muted">Weitere Möglichkeiten</summary>
          <div className="space-y-2 pb-3">
            {!isTomorrow && <>
              <Button size="lg" className="w-full !justify-start" onClick={() => setView('not-needed')}>Heute nicht nötig</Button>
              <Button size="lg" className="w-full !justify-start" onClick={() => setView('late')}>Länger wach bleiben</Button>
              <Button size="lg" className="w-full !justify-start" onClick={() => change('Rest des Tages in kleinen Versionen', (log) => ({ ...log, override: { ...log.override, light: true } }), 'Okay, heute läuft es anders. Ich passe den Rest an.')}>Plan ab jetzt neu machen</Button>
            </>}
            <Button size="lg" variant="ghost" className="w-full !justify-start" onClick={() => setView('covered')}>{isTomorrow ? 'Morgen ist etwas schon versorgt' : 'Für morgen schon versorgt'}</Button>
            {!isTomorrow && <Button size="lg" variant="ghost" className="w-full !justify-start" onClick={() => setView('covered-today')}>Morgenroutine heute prüfen</Button>}
            {changes.length > 0 && <Card className="space-y-2">
              <p className="text-sm text-muted">Heute geändert</p>
              <ul className="space-y-1">{changes.map((text, index) => <li key={index}>{text}</li>)}</ul>
              <Button size="sm" onClick={() => run(async () => { await st.restoreDay(date); void pushPcStop(); finish('Zurück beim ursprünglichen Plan. Wirklich Gemachtes bleibt erhalten.') })}>Zurück zum ursprünglichen Plan</Button>
            </Card>}
          </div>
        </details>
      </div>}
      {view === 'work' && <WorkDayForm date={date} m={m} isTomorrow={isTomorrow} onDone={finish} />}
      {view === 'event' && <EventForm date={date} isTomorrow={isTomorrow} reason={reason} onDone={finish} />}
      {view === 'later' && <div className="space-y-3">
        <p className="text-muted">{routineName} bleibt offen und meldet sich zur neuen Zeit.</p>
        <ReasonChips value={reason} onChange={setReason} />
        <Button size="lg" className="w-full" onClick={() => later(m + 60)}>In einer Stunde</Button>
        {planEvening === 'evening' && <Button size="lg" className="w-full" onClick={() => later('return')}>Wenn ich zurück bin</Button>}
        <PickTime label="Um" initial={m + 120} onPick={later} />
      </div>}
      {view === 'not-needed' && <div className="space-y-3">
        <p className="text-muted">Das gilt nicht als erledigt und nicht als verfehlt. Nur für heute, dein Standard bleibt.</p>
        <ReasonChips value={reason} onChange={setReason} />
        {action?.type === 'step' && <Button size="lg" className="w-full" onClick={() => change(`${action.title}: heute nicht nötig`, (log) => ({ ...log, override: withReason(log.override), steps: { ...log.steps, [`${action.routine}:${action.step.id}`]: 'not-needed' } }), 'Okay, für heute nicht nötig.')}>Nur dieser Schritt</Button>}
        {openHere.length > 0 && <Button size="lg" className="w-full" onClick={() => change(`${routineName}: heute nicht nötig`, (log) => ({ ...log, override: withReason(log.override), steps: { ...log.steps, ...Object.fromEntries(openHere.map((step) => [`${planEvening}:${step.id}`, 'not-needed' as const])) } }), `Okay, ${routineName} entfällt heute.`)}>Ganze {routineName}</Button>}
        {openHere.length === 0 && action?.type !== 'step' && <p>Gerade ist nichts offen.</p>}
      </div>}
      {view === 'late' && <LateForm date={date} m={m} onDone={finish} />}
      {(view === 'covered' || view === 'covered-today') && <CoveredForm date={view === 'covered-today' || isTomorrow ? date : addDays(date, 1)} onDone={finish} />}
    </fieldset>
  </Sheet>
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
function EventForm({ date, reason, onDone }: { date: string; isTomorrow: boolean; reason?: string; onDone: (message: string) => void }) {
  return <CommitmentForm date={date} reason={reason} onDone={onDone} />
}

/** Länger wach: eine freie Entscheidung. Die Folgen stehen sachlich da, entscheiden tust du. */
export function LateForm({ date, m, onDone }: { date: string; m: number; onDone: (t: string) => void }) {
  const st = useApp()
  const { busy, error, run } = usePlanAction()
  const plan = planFor(date)
  const tomorrowDate = addDays(date, 1)
  const tomorrow = planFor(tomorrowDate)
  const [until, setUntil] = useState<number | 'open'>(plan.pcStop + 60)
  const oldLog = st.days[date] ?? { date, override: {}, steps: {} }
  const preview = planFor(date, { ...st, days: { ...st.days, [date]: { ...oldLog, override: { ...oldLog.override, lateUntil: until } } } })
  const outlook = until === 'open' ? undefined : sleepOutlook(preview.bed, tomorrow.wake, st.settings, date)
  const proposal = wakeProposal(tomorrow, st.settings)
  const [useProposal, setUseProposal] = useState(false)
  const [wakeMessage, setWakeMessage] = useState('')
  const apply = () => run(async () => {
    setWakeMessage('')
    const label = until === 'open' ? 'Heute ohne festes Ende' : `Wach bis ${fmtTime(until)}`
    await st.adjustDay(date, label, (l) => ({ ...l, override: { ...l.override, lateUntil: until === 'open' ? 'open' : until } }))
    if (useProposal && proposal) {
      try {
        const result = await applyWakeChange(tomorrowDate, proposal.wake)
        setWakeMessage(result.message)
      } catch (reason) {
        throw new Error(`Deine Abendentscheidung ist gespeichert. ${reason instanceof Error ? reason.message : 'Die Weckänderung wurde nicht bestätigt. Prüfe den Weckerstatus.'}`)
      }
    }
    void pushPcStop()
    if (!useProposal || !proposal) onDone('Viel Spaß. Der Abend gehört dir. Ob dein PC die Änderung übernommen hat, ist nicht bestätigt.')
  })
  const base = Math.max(m, plan.pcStop)
  return (
    <div className="space-y-3">
    <fieldset disabled={busy || !!wakeMessage} className="min-w-0 space-y-3">
      {error && <p role="alert" className="text-warm">{error}</p>}
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
      {outlook ? <><p>{outlook.text}</p><p className="text-sm text-muted">PC-Stopp {fmtTime(preview.pcStop)}, Bett im Plan {fmtTime(preview.bed)}.</p></> : <p>Kein festes Ende. Anker bleibt still. Die geplante Weckzeit morgen um {fmtTime(tomorrow.wake)} bleibt unverändert.</p>}
      {!st.settings.alarm.enabled && <p className="text-sm text-muted">Der Hauptwecker ist ausgeschaltet.</p>}
      {outlook?.short && <p className="text-sm text-muted">Nur zur Info. Du entscheidest. Morgen reicht auch die kleine Version der Routine.</p>}
      {proposal?.later && (
        <Checkbox checked={useProposal} onChange={setUseProposal} label={<span>{proposal.text} Nur morgen so wecken.</span>} />
      )}
    </fieldset>
      {wakeMessage && <p role="status" className="text-sm text-muted">{wakeMessage}</p>}
      {wakeMessage ? <Button variant="primary" size="lg" className="w-full" onClick={() => onDone('Abendentscheidung gespeichert. Prüfe bei Bedarf den aktuellen Weckerstatus.')}>Fertig</Button> : <Button variant="primary" size="lg" className="w-full" onClick={apply}>Übernehmen</Button>}
    </div>
  )
}

/** „Abends geduscht“: Der Morgenschritt entfällt, gilt am Morgen aber nicht als erledigt. */
function CoveredForm({ date, onDone }: { date: string; onDone: (t: string) => void }) {
  const st = useApp()
  const { busy, error, run } = usePlanAction()
  const rows = routineCoverage(date, st.settings, st.days)
  return (
    <fieldset disabled={busy} className="min-w-0 space-y-2">
      {error && <p role="alert" className="text-warm">{error}</p>}
      <p className="text-muted">Versorgte Schritte entfallen an diesem Morgen. Sie gelten dort nicht als erledigt. Dein Standard bleibt.</p>
      <p className="text-sm text-muted">Vorbereitung ist keine Einnahme; das private Einnahmeprotokoll bleibt unverändert.</p>
      {rows.map((row) => <div key={row.key} className="rounded-2xl bg-surface-2 px-3 py-2">
        <Checkbox aria-label={`${row.step.title} morgens versorgt`} checked={row.covered} onChange={() => void run(() => st.adjustDay(date, row.covered ? `${row.step.title} morgens wieder nötig` : `${row.step.title} morgens versorgt`, (log) => ({
          ...log,
          override: {
            ...log.override,
            coveredSteps: row.covered ? (log.override.coveredSteps ?? []).filter((key) => key !== row.key) : [...new Set([...(log.override.coveredSteps ?? []), row.key])],
            uncoveredSteps: row.covered ? [...new Set([...(log.override.uncoveredSteps ?? []), row.key])] : (log.override.uncoveredSteps ?? []).filter((key) => key !== row.key),
          },
        })))}>
        <span className="min-w-0"><span className="block">{row.step.title}</span>
          {row.source?.kind === 'previous-evening' && <span className="block text-sm text-muted">{germanDayDate(row.source.date)}: {row.source.title}{row.source.result === 'minimal' ? ' (kleine Version)' : ''}. {row.overridden ? 'An diesem Morgen trotzdem nötig.' : 'Durch deine Regel versorgt.'}</span>}
          {row.source?.kind === 'day-choice' && <span className="block text-sm text-muted">Nur für diesen Morgen ausgewählt.</span>}
        </span></Checkbox>
      </div>)}
      <Button variant="primary" className="mt-2 w-full" onClick={() => onDone('Okay, ist notiert.')}>
        Fertig
      </Button>
    </fieldset>
  )
}

export { WakeSuggestion } from './WakeSuggestion'

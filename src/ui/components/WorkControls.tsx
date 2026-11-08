import { useState } from 'react'
import { Link } from 'react-router'
import { randomId } from '../../core/defaults'
import { addDays, fmtDuration, fmtTime, minutesOnPlanDay, weekday, zonedToUtc } from '../../core/time'
import type { Commitment, DayLog, DayPlan, PlannedWorkKind } from '../../core/types'
import { currentWorkActual, dayActual, dayBalance, latestInfo, nextObligation, overLatest, startRisk, SUNDAY_HINT, withUsualBreak, workHints } from '../../core/worktime'
import { planFor, useApp } from '../../state/store'
import { Button, Choice, DateField, Segmented, Sheet, Stepper, TextInput, TimeField } from './ui'
import { useTaskAction } from './TaskDetails'
import { TravelFields, travelDraftOf, travelFields } from './CommitmentForm'

export function useCopy() {
  const toast = useApp((s) => s.showToast)
  return async (text: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(text)
      toast('Kopiert. Gesendet ist damit noch nichts.')
      return true
    } catch {
      toast('Kopieren ist gerade nicht möglich. Du kannst die Vorlage selbst auswählen; gesendet wurde nichts.')
      return false
    }
  }
}

/** Hinweise zu Pause, Ruhezeit und Sonntag. Sachlich, abschaltbar, keine Rechtsauskunft. */
export function WorkHints({ date, now }: { date: string; now: number }) {
  const st = useApp()
  const hints = workHints({ settings: st.settings, actual: dayActual(st.local.workSessions, date, now), next: nextObligation(planFor(addDays(date, 1)), addDays(date, 1)) })
  if (!hints.length) return null
  return (
    <div className="space-y-1 text-sm text-muted">
      {hints.map((h) => (
        <p key={h}>{h}</p>
      ))}
    </div>
  )
}

/** Ein Einstieg statt einer zweiten Aktionskarte auf Jetzt; Ist-Zeiten bleiben unverändert. */
export function WorkChip({ date, plan, log, m, now }: { date: string; plan: DayPlan; log: DayLog; m: number; now: number }) {
  const st = useApp()
  const [open, setOpen] = useState(false)
  const actual = currentWorkActual(st.local.workSessions, date, now)
  const working = plan.blocks.some((block) => block.kind === 'work' && m >= block.start && m < block.end)
  if (!st.settings.flex.tracking || !working) return null
  return <>
    <button type="button" className="min-h-11 rounded-xl bg-surface px-3 py-2 text-left text-sm text-muted" onClick={() => setOpen(true)} data-testid="work-time-chip">
      {actual.open ? `Arbeit läuft seit ${fmtTime(minutesOnPlanDay(actual.open.date, actual.open.startAt))}` : actual.sessions.length ? 'Arbeitszeit ansehen' : 'Arbeit nicht gestartet · Starten'}
    </button>
    <Sheet open={open} onClose={() => setOpen(false)} title="Arbeitszeit">
      <WorkBar date={date} plan={plan} log={log} m={m} now={now} />
      <Link to="/arbeitszeit" className="flex min-h-12 items-center text-accent">Schon angefangen? Zeit nachtragen ›</Link>
      <Link to="/arbeitszeit" className="flex min-h-12 items-center text-muted">Alle Arbeitszeiten ansehen ›</Link>
    </Sheet>
  </>
}

/**
 * Kompakter Arbeitsbereich auf der Startseite. Erscheint nur zu passenden Zeiten, ist nie Pflicht
 * und ersetzt nicht die eine Hauptaktion.
 */
export function WorkBar({ date, plan, log, m, now }: { date: string; plan: DayPlan; log: DayLog; m: number; now: number }) {
  const st = useApp()
  const copy = useCopy()
  if (!st.settings.flex.tracking) return null
  const actual = currentWorkActual(st.local.workSessions, date, now)
  const wi = plan.workInfo
  const box = 'mb-3 space-y-2 rounded-2xl border border-line px-4 py-3'

  // Pause und Einsätze sind gerade die Hauptaktion
  if (actual.open && (actual.openBreak || actual.open.kind !== 'regular')) return null
  if (actual.unconfirmed) return <div className={box} data-testid="workbar"><p>Einige Arbeitszeiten sind noch unbestätigt.</p><Link to="/arbeitszeit" className="flex min-h-11 items-center text-accent">Arbeitszeiten prüfen</Link></div>

  if (actual.open) {
    const over = wi === undefined ? undefined : actual.netMin - wi.targetNetMin
    return (
      <div className={box} data-testid="workbar">
        <p>{actual.open.date !== date || over === undefined ? `Arbeit läuft seit ${fmtTime(minutesOnPlanDay(actual.open.date, actual.open.startAt))}.` : over >= 0 ? `Dein Ziel ist erreicht${over > 0 ? `, ${fmtDuration(over)} zusätzlich` : ''}.` : `Feierabend ${wi?.forecastLowerBound ? 'frühestens' : 'etwa'} ${fmtTime(wi?.forecastEnd ?? plan.workEnd ?? m)}`}</p>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => st.workBreakStart()}>
            Pause starten
          </Button>
          <Button className="flex-1" onClick={() => st.workStop()}>
            Feierabend
          </Button>
        </div>
      </div>
    )
  }

  const fresh = actual.lastEnd !== undefined && now - actual.lastEnd < 3 * 3600_000
  if (fresh && actual.lastEnd !== undefined) {
    const last = actual.sessions[actual.sessions.length - 1]!
    return (
      <div className={box} data-testid="workbar">
        <p>
          Heute {fmtDuration(actual.netMin)} gearbeitet.{wi ? ` ${dayBalance(actual, wi.targetNetMin).text}.` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {actual.breakCount === 0 && !!wi?.plannedBreakMin && (
            <Button size="sm" onClick={() => st.editWork((list) => list.map((x) => (x.id === last.id ? { ...withUsualBreak(x, wi.plannedBreakMin, randomId()), manual: true } : x)))}>
              Pause {fmtDuration(wi.plannedBreakMin)} nachtragen
            </Button>
          )}
          <Link to="/arbeitszeit" className="min-h-11 px-1 py-2 text-sm text-muted underline">
            Korrigieren
          </Link>
        </div>
        <WorkHints date={date} now={now} />
      </div>
    )
  }

  if (wi && !wi.started && !wi.closed) {
    const from = (plan.leave ?? wi.plannedStart - 30) - 15
    if (m < from || m >= (plan.workEnd ?? 0)) return null
    const latest = wi.latestStart !== undefined ? { latestStart: wi.latestStart, latestLeave: wi.latestLeave } : undefined
    const risk = startRisk({ plannedStart: wi.plannedStart, latest, fixedMorning: wi.fixedMorning, started: false, leftAt: log.leftAt, m })
    return (
      <div className={box} data-testid="workbar">
        {risk && <p>{risk.text}</p>}
        {risk?.level === 'tight' && wi.latestLeave !== undefined && (
          <div className="flex flex-wrap gap-2">
            <p className="w-full select-text whitespace-pre-wrap text-sm text-muted">{st.settings.flex.lateMessage}</p>
            {!log.override.light && (
              <Button size="sm" onClick={() => st.adjustDay(date, 'Morgen in kleinen Versionen', (l) => ({ ...l, override: { ...l.override, light: true } }))}>
                Schnellste Morgenroutine
              </Button>
            )}
            <Button size="sm" onClick={() => copy(st.settings.flex.lateMessage)}>
              Nachricht kopieren
            </Button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button className="flex-1" onClick={() => st.workStart()}>
            Arbeit starten
          </Button>
          <Link to="/arbeitszeit" className="min-h-11 py-2 text-sm text-muted underline">
            Schon angefangen?
          </Link>
        </div>
      </div>
    )
  }

  const onCall = plan.legs?.find((l) => l.commitment.workKind === 'oncall' && m >= l.commitment.start && (l.commitment.end === undefined || m < l.commitment.end))
  if (onCall) {
    return (
      <div className={box} data-testid="workbar">
        <p>Rufbereitschaft{onCall.commitment.end !== undefined ? ` bis ${fmtTime(onCall.commitment.end)}` : ''}. Zählt hier nicht als Arbeitszeit.</p>
        <Button className="w-full" onClick={() => st.workStart({ kind: 'incident' })}>
          Einsatz starten
        </Button>
      </div>
    )
  }
  return null
}

/** „Heute anders“, Bereich Arbeit: nur dieser Tag, der Wochenstandard bleibt, alles lässt sich zurücknehmen. */
export function WorkDayForm({ date, m, isTomorrow, onDone }: { date: string; m: number; isTomorrow: boolean; onDone: (t: string) => void }) {
  const st = useApp()
  const copy = useCopy()
  const plan = planFor(date)
  const wi = plan.workInfo
  const actual = dayActual(st.local.workSessions, date, Date.now())
  const tracked = actual.sessions.length > 0
  const [start, setStart] = useState(wi?.plannedStart ?? 9 * 60)
  const [endWish, setEndWish] = useState(wi?.endPreference ?? plan.workEnd ?? m)
  const latest = latestInfo(st.settings, plan.homeOffice, date, st.days[date]?.override)
  const adjust = (label: string, patch: DayLog['override']) => st.adjustDay(date, label, (l) => ({ ...l, override: { ...l.override, ...patch } }))

  const emergency = !isTomorrow && (
    <Button
      size="lg"
      className="w-full !justify-start"
      onClick={async () => {
        await st.workStart({ kind: 'incident' })
        onDone('Läuft. Nur das Wichtigste, der Rest kann warten.')
      }}
    >
      Kundenproblem jetzt bearbeiten
    </Button>
  )
  const planLink = (
    <Link to="/arbeitszeit#einsatz" className="flex min-h-12 items-center rounded-2xl border border-line px-4">
      Einsatz planen
    </Link>
  )

  if (!wi) {
    return (
      <div className="space-y-3">
        <p className="text-muted">Heute ist kein Arbeitstag, und das bleibt auch so. Ein Einsatz ändert daran nichts.</p>
        {emergency}
        {planLink}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {!wi.started && (
        <div className="space-y-2">
          <p className="font-medium">{isTomorrow ? 'Morgen anderer Beginn' : 'Ich fange heute später an'}</p>
          <div className="flex items-center gap-2">
            <TimeField label="Arbeitsbeginn heute" value={start} onChange={setStart} />
            <Button className="flex-1" onClick={async () => {
              await adjust(`Arbeitsbeginn ${fmtTime(start)}`, { workStart: start })
              onDone(`Okay. Arbeitsbeginn ${fmtTime(start)}, der Rest rückt mit.`)
            }}>
              Übernehmen
            </Button>
          </div>
          {overLatest(start, latest) && (
            <div className="space-y-2 rounded-xl bg-surface-2 p-3">
              <p>Das liegt nach deiner Grenze {fmtTime(latest!.latestStart)}. Musst du jemandem Bescheid geben? Das machst du selbst.</p>
              <p className="select-text whitespace-pre-wrap text-sm text-muted">{st.settings.flex.lateMessage}</p>
              <Button size="sm" onClick={() => copy(st.settings.flex.lateMessage)}>
                Nachricht kopieren
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="font-medium">Pause heute</p>
        {tracked && actual.breakCount > 0 ? (
          <Link to="/arbeitszeit" className="text-muted underline">
            Erfasste Pause korrigieren
          </Link>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[30, 45, 60, 90, 120].map((p) => (
              <Button key={p} aria-pressed={wi.plannedBreakMin === p} onClick={async () => {
                await adjust(`Pause ${fmtDuration(p)}`, { pauseMin: p })
                onDone('Okay, dein Feierabend rückt mit.')
              }}>
                {p} min
              </Button>
            ))}
          </div>
        )}
      </div>

      {!isTomorrow && !wi.closed && (
        <div className="space-y-2">
          <p className="font-medium">Feierabend</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={async () => {
              if (actual.open) await st.workStop()
              else await adjust(`Früher Schluss ${fmtTime(m)}`, { workEnd: m })
              onDone('Okay, Feierabend. Der Rest des Tages gehört dir.')
            }}>
              Heute früher Schluss
            </Button>
            {[30, 60].map((x) => (
              <Button key={x} onClick={async () => {
                const end = (plan.workEnd ?? m) + x
                await adjust(`Feierabend ${fmtTime(end)}`, { workEnd: end })
                onDone(`Feierabend ${fmtTime(end)}. Der Abend ist neu geplant.`)
              }}>
                +{x} min
              </Button>
            ))}
          </div>
        </div>
      )}
      {!isTomorrow && wi.closed && (
        <Button size="lg" className="w-full !justify-start" onClick={async () => {
          await st.workStart()
          onDone('Läuft. Die Zeit wird dazugezählt.')
        }}>
          Noch etwas arbeiten
        </Button>
      )}

      <details className="space-y-3">
        <summary className="min-h-11 py-2 text-muted">Weitere Arbeitszeiten nur für diesen Tag</summary>
        <div className="flex flex-wrap items-center justify-between gap-2"><span>Feierabendwunsch</span><TimeField label="Feierabendwunsch heute" value={endWish} onChange={setEndWish} /><Button size="sm" onClick={async () => { await adjust(`Feierabendwunsch ${fmtTime(endWish)}`, { workEnd: endWish }); onDone('Dein Tageswunsch ist gespeichert. Er bucht keine Arbeitszeit.') }}>Endwunsch übernehmen</Button></div>
        <Choice label="Startgrenze heute" value={st.days[date]?.override.latestStart === undefined ? 'inherit' : st.days[date]?.override.latestStart === null ? 'off' : 'custom'} onChange={(value) => void adjust('Startgrenze für diesen Tag', { latestStart: value === 'inherit' ? undefined : value === 'off' ? null : latest?.latestStart ?? 9 * 60 })} options={[{ value: 'inherit', label: 'Wochenprofil verwenden' }, { value: 'off', label: 'Heute keine Grenze' }, { value: 'custom', label: 'Heute eigene Grenze' }]} />
        {typeof st.days[date]?.override.latestStart === 'number' && <TimeField label="Eigene Startgrenze heute" value={st.days[date]!.override.latestStart!} onChange={(value) => adjust('Startgrenze für diesen Tag', { latestStart: value })} />}
      </details>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>Ziel netto</span>
        <Stepper label="Netto-Ziel heute" value={wi.targetNetMin / 60} step={0.25} min={0} max={14} unit="h" onChange={(v) => adjust(`Ziel ${v} h`, { targetNetMin: Math.round(v * 60) })} />
      </div>

      {emergency}
      {planLink}
      <p className="text-sm text-muted">Gilt nur für {isTomorrow ? 'diesen Tag' : 'heute'}. Deine Wochenwerte bleiben, wie sie sind.</p>
    </div>
  )
}

const PLAN_KINDS: { value: PlannedWorkKind; label: string; title: string }[] = [
  { value: 'maintenance', label: 'Wartung', title: 'Wartung' },
  { value: 'onsite', label: 'Vor Ort', title: 'Kundentermin' },
  { value: 'oncall', label: 'Rufbereit', title: 'Rufbereitschaft' },
  { value: 'other', label: 'Andere', title: 'Arbeit' },
]

/** Einmaliger Einsatz. Macht den Tag nicht zum Arbeitstag und bleibt auf diesem Gerät. */
export function PlanWorkForm({ today, onDone }: { today: string; onDone: (t: string) => void }) {
  const st = useApp()
  const [kind, setKind] = useState<PlannedWorkKind>('maintenance')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [start, setStart] = useState(10 * 60)
  const [minutes, setMinutes] = useState(90)
  const [travelDraft, setTravelDraft] = useState(() => ({ ...travelDraftOf(), locationKind: 'onsite' as const }))
  const { busy, error, run } = useTaskAction()
  const k = PLAN_KINDS.find((x) => x.value === kind)!
  const onsite = kind === 'onsite'
  const save = () => run(async () => {
    const label = title.trim() || k.title
    const c: Commitment = {
      id: randomId(),
      date,
      label,
      context: 'customer',
      commitment: kind === 'oncall' ? 'soft' : 'hard',
      start,
      end: start + minutes,
      status: 'planned',
      workKind: kind,
      ...travelFields({ ...travelDraft, locationKind: onsite ? 'onsite' : 'remote', prepMin: travelDraft.prepMin || String(kind === 'oncall' ? 0 : 15) }),
    }
    await st.adjustCommitment(c, `Einsatz um ${fmtTime(start)}`)
    setTitle('')
    onDone('Eingeplant. Der Rest des Tages bleibt, wie er ist.')
  })
  return (
    <fieldset disabled={busy} className="min-w-0 space-y-3">
      <Segmented<PlannedWorkKind> label="Art des Einsatzes" value={kind} options={PLAN_KINDS.map((x) => ({ value: x.value, label: x.label }))} onChange={setKind} />
      <TextInput aria-label="Worum geht es?" placeholder={`${k.title} (Titel optional)`} value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="flex items-center justify-between gap-2">
        <span>Tag</span>
        <DateField label="Tag des Einsatzes" value={date} min={today} onChange={(value) => { if (value) setDate(value) }} />
      </label>
      <div className="flex items-center justify-between gap-2">
        <span>Beginn</span>
        <TimeField label="Beginn des Einsatzes" value={start} onChange={setStart} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>Voraussichtlich</span>
        <Stepper label="Dauer des Einsatzes" value={minutes} step={15} min={15} max={720} onChange={setMinutes} />
      </div>
      <details className="rounded-xl border border-line p-3">
        <summary className="min-h-11 cursor-pointer">Weg & Vorbereitung</summary>
        <TravelFields draft={{ ...travelDraft, locationKind: onsite ? 'onsite' : 'remote' }} onChange={(next) => setTravelDraft({ ...next, locationKind: 'onsite' })} places={st.local.places} showLocation={false} />
      </details>
      {kind === 'oncall' && <p className="text-sm text-muted">Rufbereitschaft zählt hier nicht als gearbeitete Zeit. Wie sie rechtlich gilt, entscheidet Anker nicht. Läuft ein Einsatz, startest du ihn selbst.</p>}
      {st.settings.flex.legalHints && weekday(date) === 6 && <p className="text-sm text-muted">{SUNDAY_HINT}</p>}
      <Button disabled={busy} variant="primary" size="lg" className="w-full" onClick={save}>
        Einplanen
      </Button>
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    </fieldset>
  )
}

/** Plan-Minuten aus einem Zeitfeld: Vor 04:00 gehört die Uhrzeit noch zum Plantag, also nach Mitternacht. */
export function fieldToMs(date: string, m: number): number {
  return zonedToUtc(date, m < 240 ? m + 1440 : m)
}

export function msToField(date: string, ms: number): number {
  return minutesOnPlanDay(date, ms)
}

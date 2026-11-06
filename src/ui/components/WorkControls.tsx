import { useState } from 'react'
import { Link } from 'react-router'
import { randomId } from '../../core/defaults'
import { addDays, fmtDuration, fmtTime, minutesOnPlanDay, weekday, zonedToUtc } from '../../core/time'
import type { Commitment, DayLog, DayPlan, PlannedWorkKind } from '../../core/types'
import { dayActual, dayBalance, latestInfo, nextObligation, overLatest, startRisk, SUNDAY_HINT, withUsualBreak, workHints } from '../../core/worktime'
import { safe } from '../../platform/native'
import { planFor, useApp } from '../../state/store'
import { Button, Segmented, Stepper, TextInput, TimeField } from './ui'
import { useTaskAction } from './TaskDetails'

export function useCopy() {
  const toast = useApp((s) => s.showToast)
  return async (text: string) => {
    await safe(() => navigator.clipboard.writeText(text), undefined)
    toast('Kopiert. Gesendet ist damit noch nichts.')
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

/**
 * Kompakter Arbeitsbereich auf der Startseite. Erscheint nur zu passenden Zeiten, ist nie Pflicht
 * und ersetzt nicht die eine Hauptaktion.
 */
export function WorkBar({ date, plan, log, m, now }: { date: string; plan: DayPlan; log: DayLog; m: number; now: number }) {
  const st = useApp()
  const copy = useCopy()
  if (!st.settings.flex.tracking) return null
  const actual = dayActual(st.local.workSessions, date, now)
  const wi = plan.workInfo
  const box = 'mb-3 space-y-2 rounded-2xl border border-line px-4 py-3'

  // Pause und Einsätze sind gerade die Hauptaktion
  if (actual.open && (actual.openBreak || actual.open.kind !== 'regular')) return null
  // Eine offene Sitzung von früher klärt die Hauptaktion zuerst
  if (st.local.workSessions.some((x) => x.endAt === undefined && x.date !== date)) return null

  if (actual.unconfirmed) return <div className={box} data-testid="workbar"><p>Einige Arbeitszeiten sind noch unbestätigt.</p><Link to="/arbeitszeit" className="flex min-h-11 items-center text-accent">Arbeitszeiten prüfen</Link></div>

  if (actual.open) {
    const over = actual.netMin - (wi?.targetNetMin ?? 0)
    return (
      <div className={box} data-testid="workbar">
        <p>{over >= 0 ? `Dein Ziel ist erreicht${over > 0 ? `, ${fmtDuration(over)} zusätzlich` : ''}.` : `Feierabend ${wi?.forecastLowerBound ? 'frühestens' : 'etwa'} ${fmtTime(wi?.forecastEnd ?? plan.workEnd ?? m)}`}</p>
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
    const target = wi?.targetNetMin ?? 0
    return (
      <div className={box} data-testid="workbar">
        <p>
          Heute {fmtDuration(actual.netMin)} gearbeitet. {dayBalance(actual, target).text}.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {actual.breakCount === 0 && !!wi?.plannedBreakMin && (
            <Button size="sm" onClick={() => st.editWork((list) => list.map((x) => (x.id === last.id ? { ...withUsualBreak(x, wi.plannedBreakMin, randomId()), manual: true } : x)))}>
              Pause {fmtDuration(wi.plannedBreakMin)} nachtragen
            </Button>
          )}
          <Link to="/arbeitszeit" className="min-h-10 px-1 py-2 text-sm text-muted underline">
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
          <Link to="/arbeitszeit" className="min-h-10 py-2 text-sm text-muted underline">
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
        <label className="block space-y-1"><span>Spätester Beginn heute</span><select aria-label="Startgrenze heute" value={st.days[date]?.override.latestStart === undefined ? 'inherit' : st.days[date]?.override.latestStart === null ? 'off' : 'custom'} onChange={(event) => adjust('Startgrenze für diesen Tag', { latestStart: event.target.value === 'inherit' ? undefined : event.target.value === 'off' ? null : latest?.latestStart ?? 9 * 60 })} className="min-h-12 w-full rounded-xl bg-surface-2 px-3"><option value="inherit">Wochenprofil verwenden</option><option value="off">Heute keine Grenze</option><option value="custom">Heute eigene Grenze</option></select></label>
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
  const [place, setPlace] = useState('')
  const [travel, setTravel] = useState<number>()
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
      ...(onsite ? { ...(place.trim() ? { placeLabel: place.trim(), address: place.trim() } : {}), ...(travel !== undefined ? { travelMin: travel } : {}) } : { routeMode: 'none' as const, prepMin: kind === 'oncall' ? 0 : 15 }),
    }
    await st.saveCommitment(c)
    await st.adjustDay(date, `Einsatz um ${fmtTime(start)}`, (l) => l)
    setTitle('')
    onDone('Eingeplant. Der Rest des Tages bleibt, wie er ist.')
  })
  return (
    <fieldset disabled={busy} className="min-w-0 space-y-3">
      <Segmented<PlannedWorkKind> label="Art des Einsatzes" value={kind} options={PLAN_KINDS.map((x) => ({ value: x.value, label: x.label }))} onChange={setKind} />
      <TextInput aria-label="Worum geht es?" placeholder={`${k.title} (Titel freiwillig)`} value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="flex items-center justify-between gap-2">
        <span>Tag</span>
        <input type="date" aria-label="Tag des Einsatzes" className="min-h-12 rounded-xl bg-surface-2 px-3" value={date} min={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      <div className="flex items-center justify-between gap-2">
        <span>Beginn</span>
        <TimeField label="Beginn des Einsatzes" value={start} onChange={setStart} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>Voraussichtlich</span>
        <Stepper label="Dauer des Einsatzes" value={minutes} step={15} min={15} max={720} onChange={setMinutes} />
      </div>
      {onsite && (
        <>
          <TextInput aria-label="Ort des Einsatzes" placeholder="Ort oder Adresse (freiwillig)" value={place} onChange={(e) => setPlace(e.target.value)} />
          {place.trim() && (
            <div className="flex items-center justify-between gap-2">
              <span>Fahrt in Minuten</span>
              <input type="number" inputMode="numeric" min={0} max={600} aria-label="Fahrzeit zum Einsatz" className="min-h-12 w-24 rounded-xl bg-surface-2 px-3 text-center" value={travel ?? ''} placeholder="offen" onChange={(e) => setTravel(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))} />
            </div>
          )}
        </>
      )}
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

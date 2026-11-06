import { useState } from 'react'
import { fromBerlinDateTimeInput, toBerlinDateTimeInput } from '../../core/evening'
import { randomId } from '../../core/defaults'
import { SESSION_LABEL } from '../../core/support'
import { addDays, daysBetween, fmtDuration, fmtTime, weekday, WEEKDAYS, zonedToUtc } from '../../core/time'
import type { WorkBreak, WorkSession, WorkSessionKind } from '../../core/types'
import { balanceText, dayActual, dayBalance, manualSession, staleSession, weekSummary, workRule } from '../../core/worktime'
import { useNow, useToday } from '../../state/hooks'
import { planFor, today as currentDay, useApp } from '../../state/store'
import { Button, Card, Page, Section, Segmented, TextInput, TimeField } from '../components/ui'
import { msToField, PlanWorkForm, WorkHints } from '../components/WorkControls'
import { useTaskAction } from '../components/TaskDetails'

/** Arbeitszeit: freiwillig, lokal, für dich. Keine offizielle Zeiterfassung, nichts geht an Dritte. */
export default function WorkTime() {
  const st = useApp()
  const { date: today, plan } = useToday()
  const now = useNow(30_000)
  const [offset, setOffset] = useState(0)
  const action = useTaskAction()
  const date = addDays(today, offset)
  const dayPlan = offset === 0 ? plan : planFor(date)
  const actual = dayActual(st.local.workSessions, date, now)
  const target = dayPlan.workInfo?.targetNetMin ?? 0
  const openHere = st.local.workSessions.find((x) => x.endAt === undefined)
  const staleOpen = !!openHere && !!staleSession([openHere], today, now)
  const planned = st.local.commitments.filter((c) => c.workKind && c.status !== 'cancelled' && c.date >= today && !st.local.workSessions.some((x) => x.commitmentId === c.id)).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)

  return (
    <Page title="Arbeitszeit" back="/mehr">
      <Segmented
        label="Tag"
        value={offset}
        options={[
          { value: 0, label: 'Heute' },
          { value: -1, label: 'Gestern' },
          { value: -2, label: WEEKDAYS[weekday(addDays(today, -2))]! },
        ]}
        onChange={setOffset}
      />
      <label className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span>Anderen Arbeitstag ansehen</span>
        <input type="date" aria-label="Arbeitstag auswählen" value={date} max={today} className="min-h-12 min-w-0 max-w-full rounded-xl bg-surface-2 px-3" onChange={(event) => {
          const chosen = event.target.value
          if (chosen && chosen <= today) setOffset(daysBetween(today, chosen))
        }} />
      </label>

      <Card className="space-y-2">
        {actual.sessions.length === 0 ? (
          <p className="text-muted">Nichts erfasst. Das ist in Ordnung{dayPlan.workInfo ? `, der Plan rechnet mit Feierabend ${fmtTime(dayPlan.workEnd ?? 0)}` : ''}.</p>
        ) : actual.unconfirmed ? (
          <p role="status" className="text-muted">Diese Zeiten sind noch unbestätigt. Bitte prüfe die offenen oder widersprüchlichen Einträge unten. Sie zählen nicht als bestätigter Wochensaldo.</p>
        ) : (
          <>
            <Line label="Gearbeitet" value={fmtDuration(actual.netMin)} />
            <Line label="Pausen" value={fmtDuration(actual.breakMin)} />
            {actual.open && dayPlan.workInfo?.forecastEnd !== undefined && <Line label={dayPlan.workInfo.forecastLowerBound ? 'Feierabend frühestens' : 'Feierabend etwa'} value={fmtTime(dayPlan.workInfo.forecastEnd)} />}
            {dayPlan.workInfo?.forecastLowerBound && <p className="text-sm text-muted">Vorläufig: Das Ende deiner Pause ist noch offen. Eine Endschätzung kannst du unten bei der Pause eintragen.</p>}
            {dayPlan.workInfo?.endPreference !== undefined && <Line label="Dein Feierabendwunsch" value={fmtTime(dayPlan.workInfo.endPreference)} />}
            {!actual.open && <p className="pt-1">{dayBalance(actual, target).text}.</p>}
          </>
        )}
        {offset === 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {staleOpen && <p className="text-sm text-muted">Bestätige zuerst unten das tatsächliche Ende des älteren Abschnitts.</p>}
            {!openHere && (
              <Button variant="primary" disabled={action.busy} onClick={() => action.run(() => st.workStart())}>
                Arbeit starten
              </Button>
            )}
            {openHere && !staleOpen && !openHere.breaks.some((b) => b.endAt === undefined) && <Button disabled={action.busy} onClick={() => action.run(() => st.workBreakStart())}>Pause starten</Button>}
            {!staleOpen && openHere?.breaks.some((b) => b.endAt === undefined) && (
              <Button variant="primary" disabled={action.busy} onClick={() => action.run(() => st.workBreakEnd())}>
                Pause beenden
              </Button>
            )}
            {openHere && !staleOpen && <Button disabled={action.busy} onClick={() => action.run(() => st.workStop())}>{openHere.kind === 'regular' ? 'Feierabend' : 'Einsatz beenden'}</Button>}
          </div>
        )}
      </Card>
      {action.error && <p role="alert" className="text-warm">{action.error}</p>}
      {actual.issues.map((issue) => <p role="status" key={issue.key} className="text-sm text-warm">{issue.text}</p>)}
      <WorkHints date={date} now={now} />

      {st.workUndo && (
        <Button disabled={action.busy} onClick={() => action.run(() => st.undoWork())}>Letzte Korrektur rückgängig</Button>
      )}

      {actual.sessions.length > 0 && (
        <Section title="Erfasste Zeiten">
          {actual.sessions.map((x) => (
            <SessionCard key={x.id} session={x} date={date} />
          ))}
        </Section>
      )}
      {st.local.workSessions
        .filter((x) => x.endAt === undefined && x.date !== date)
        .map((x) => (
          <Section key={x.id} title={`Noch offen, vom ${x.date}`}>
            <SessionCard session={x} date={x.date} />
          </Section>
        ))}

      <Section title="Nachtragen" hint="Auch ohne Timer. Eine Endzeit vor dem Beginn liegt nach Mitternacht.">
        <ManualForm key={date} date={date} />
      </Section>

      <Section title="Einsatz">
        <div id="einsatz" />
        {!openHere && offset === 0 && <EmergencyForm />}
        {planned.map((c) => (
          <Card key={c.id} className="flex items-center gap-3">
            <span className="flex-1">
              {c.date} {fmtTime(c.start)} · {c.label}
            </span>
            {c.date === today && !openHere && (
              <Button size="sm" disabled={action.busy} onClick={() => action.run(() => st.workStart({ kind: c.workKind === 'oncall' || !c.workKind ? 'incident' : c.workKind, label: c.label, commitmentId: c.workKind === 'oncall' ? undefined : c.id }))}>
                Starten
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={action.busy} onClick={() => action.run(() => st.saveCommitment({ ...c, status: 'cancelled' }))}>
              Entfällt
            </Button>
          </Card>
        ))}
        <Card>
          <PlanWorkForm today={today} onDone={st.showToast} />
        </Card>
      </Section>

      <details className="px-1">
        <summary className="min-h-11 py-2 text-muted">Diese Woche ansehen</summary>
        <Week today={today} now={now} />
      </details>

      <p className="px-1 text-sm text-muted">Deine persönliche Planungshilfe, keine offizielle Zeiterfassung und keine Lohnabrechnung. Die Zeiten bleiben auf diesem Gerät und sind in deiner Sicherung enthalten. Ob Mehrarbeit bezahlt oder ausgeglichen wird, regelt dein Arbeitgeber.</p>
    </Page>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-lg tabular-nums">{value}</span>
    </div>
  )
}

function EmergencyForm() {
  const st = useApp()
  const [label, setLabel] = useState('')
  const { busy, error, run } = useTaskAction()
  return <Card className="space-y-2">
    <TextInput disabled={busy} aria-label="Was ist los?" placeholder="Kurzer Titel (freiwillig)" value={label} onChange={(event) => setLabel(event.target.value)} />
    <Button disabled={busy} size="lg" className="w-full" onClick={() => run(async () => {
      await st.workStart({ kind: 'incident', label: label.trim() || undefined })
      setLabel('')
    })}>Kundenproblem jetzt bearbeiten</Button>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
  </Card>
}

/** Bei Korrektur eines vorhandenen Nachtintervalls bleibt dessen tatsächlicher Kalendertag erhalten. */
function correctedTime(date: string, originalAt: number, clockMinute: number): number {
  const day = Math.floor(msToField(date, originalAt) / 1440)
  return zonedToUtc(date, day * 1440 + clockMinute)
}

function SessionCard({ session: x, date }: { session: WorkSession; date: string }) {
  const st = useApp()
  const { busy, error, message, run } = useTaskAction()
  const stale = !!staleSession([x], currentDay(), Date.now())
  const [confirmedEnd, setConfirmedEnd] = useState('')
  const patch = (fn: (session: WorkSession) => WorkSession) => run(() => st.editWork((list) => list.map((session) => session.id === x.id ? { ...fn(session), manual: true } : session)), 'Korrektur gespeichert.')
  return <Card className="space-y-2">
    <fieldset disabled={busy} className="min-w-0 space-y-2">
      <p className="font-medium">{x.label?.trim() || SESSION_LABEL[x.kind]}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>Beginn</span>
        <TimeField label="Beginn" value={msToField(date, x.startAt)} onChange={(minute) => patch((session) => ({ ...session, startAt: correctedTime(date, session.startAt, minute) }))} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>Ende</span>
        {x.endAt !== undefined ? <TimeField label="Ende" value={msToField(date, x.endAt)} onChange={(minute) => patch((session) => ({ ...session, endAt: correctedTime(date, session.endAt!, minute) }))} />
          : !stale && <Button size="sm" onClick={() => patch((session) => ({ ...session, endAt: Date.now(), breaks: session.breaks.map((pause) => pause.endAt === undefined ? { ...pause, endAt: Date.now() } : pause) }))}>Läuft noch, jetzt beenden</Button>}
      </div>
      {stale && <div className="space-y-2 rounded-xl bg-surface-2 p-3">
        <p className="text-sm text-muted">Dieser Abschnitt ist ungewöhnlich lange offen. Bestätige dein tatsächliches Ende; die ganze Zwischenzeit gilt noch nicht als geprüft.</p>
        <label className="block space-y-1"><span>Tatsächliches Ende (Berliner Zeit)</span><input type="datetime-local" aria-label="Tatsächliches Ende bestätigen" value={confirmedEnd} onChange={(event) => setConfirmedEnd(event.target.value)} className="min-h-12 min-w-0 w-full rounded-xl bg-surface px-3" /></label>
        <Button size="sm" onClick={() => patch((session) => {
          const endAt = fromBerlinDateTimeInput(confirmedEnd)
          if (!Number.isFinite(endAt)) throw new Error('Wähle dein tatsächliches Enddatum und die Uhrzeit.')
          return { ...session, endAt, breaks: session.breaks.map((pause) => pause.endAt === undefined ? { ...pause, endAt } : pause) }
        })}>Endzeit speichern</Button>
      </div>}
      {x.breaks.map((pause) => <div key={pause.id} className="space-y-2 rounded-xl border border-line p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Pause</span>
          <TimeField label="Pause von" value={msToField(date, pause.startAt)} onChange={(minute) => patch((session) => ({ ...session, breaks: session.breaks.map((part) => part.id === pause.id ? { ...part, startAt: correctedTime(date, part.startAt, minute) } : part) }))} />
          {pause.endAt !== undefined && <TimeField label="Pause bis" value={msToField(date, pause.endAt)} onChange={(minute) => patch((session) => ({ ...session, breaks: session.breaks.map((part) => part.id === pause.id ? { ...part, endAt: correctedTime(date, part.endAt!, minute) } : part) }))} />}
          <Button size="sm" variant="ghost" onClick={() => patch((session) => ({ ...session, breaks: session.breaks.filter((part) => part.id !== pause.id) }))}>Entfernen</Button>
        </div>
        {pause.endAt === undefined && <PauseEstimate session={x} pause={pause} />}
      </div>)}
      <div className="flex flex-wrap gap-2">
        {x.endAt !== undefined && <Button size="sm" onClick={() => patch((session) => ({ ...session, breaks: [...session.breaks, { id: randomId(), startAt: session.startAt, endAt: Math.min(session.endAt!, session.startAt + 30 * 60_000) }] }))}>Pause hinzufügen</Button>}
        <Button size="sm" variant="ghost" onClick={() => run(() => st.editWork((list) => list.filter((session) => session.id !== x.id)))}>Eintrag löschen</Button>
      </div>
    </fieldset>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </Card>
}

function PauseEstimate({ session, pause }: { session: WorkSession; pause: WorkBreak }) {
  const st = useApp()
  const { busy, error, run } = useTaskAction()
  const [estimate, setEstimate] = useState(pause.expectedEndAt === undefined ? '' : toBerlinDateTimeInput(pause.expectedEndAt))
  const save = (clear = false) => run(async () => {
    const expectedEndAt = clear || !estimate ? undefined : fromBerlinDateTimeInput(estimate)
    if (expectedEndAt !== undefined && (!Number.isFinite(expectedEndAt) || expectedEndAt <= Date.now())) throw new Error('Wähle eine künftige Endschätzung oder lasse sie offen.')
    await st.editWork((list) => list.map((item) => item.id === session.id ? { ...item, breaks: item.breaks.map((part) => part.id === pause.id ? { ...part, expectedEndAt } : part) } : item))
    if (clear) setEstimate('')
  })
  return <div className="space-y-2">
    <label className="block space-y-1"><span className="text-sm text-muted">Voraussichtlich zurück (freiwillig)</span><input type="datetime-local" aria-label="Pause voraussichtlich bis" value={estimate} onChange={(event) => setEstimate(event.target.value)} className="min-h-12 min-w-0 w-full rounded-xl bg-surface-2 px-2" /></label>
    <div className="flex flex-wrap gap-2"><Button disabled={busy} size="sm" onClick={() => save()}>Endschätzung merken</Button>{pause.expectedEndAt !== undefined && <Button disabled={busy} size="sm" variant="ghost" onClick={() => save(true)}>Ende offen lassen</Button>}</div>
    <p className="text-xs text-muted">Nur für die Prognose. Die Pause endet erst, wenn du sie selbst beendest.</p>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
  </div>
}

const MANUAL_KINDS: { value: WorkSessionKind; label: string }[] = [
  { value: 'regular', label: 'Arbeit' },
  { value: 'maintenance', label: 'Wartung' },
  { value: 'incident', label: 'Störung' },
  { value: 'other', label: 'Andere' },
]

function ManualForm({ date }: { date: string }) {
  const st = useApp()
  const rule = workRule(date, st.settings, st.days[date]?.override)
  const [kind, setKind] = useState<WorkSessionKind>('regular')
  const [start, setStart] = useState(rule.plannedStart)
  const [end, setEnd] = useState(rule.plannedStart + 240)
  const [withBreak, setWithBreak] = useState(false)
  const [from, setFrom] = useState(12 * 60)
  const [to, setTo] = useState(13 * 60)
  const { busy, error, run } = useTaskAction()
  return (
    <Card className="space-y-3">
      <fieldset disabled={busy} className="min-w-0 space-y-3">
      <Segmented<WorkSessionKind> label="Art" value={kind} options={MANUAL_KINDS} onChange={setKind} />
      <div className="flex items-center justify-between gap-2">
        <span>Von</span>
        <TimeField label="Nachtragen von" value={start} onChange={setStart} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>Bis</span>
        <TimeField label="Nachtragen bis" value={end} onChange={setEnd} />
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" checked={withBreak} onChange={(e) => setWithBreak(e.target.checked)} />
        Mit Pause
      </label>
      {withBreak && (
        <div className="flex items-center justify-between gap-2">
          <TimeField label="Pause von (Nachtrag)" value={from} onChange={setFrom} />
          <TimeField label="Pause bis (Nachtrag)" value={to} onChange={setTo} />
        </div>
      )}
      <Button
        className="w-full"
        disabled={busy}
        onClick={() => run(async () => {
          if (start === end) throw new Error('Beginn und Ende sind gleich. Prüfe die tatsächlichen Zeiten.')
          await st.editWork((list) => [...list, manualSession(randomId(), date, start, end, withBreak ? [{ start: from, end: to }] : [], kind)])
          st.showToast('Nachgetragen.')
        })}
      >
        Eintragen
      </Button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    </Card>
  )
}

/** Nur auf Wunsch, ohne Bewertung. Tage ohne Erfassung zählen nicht in die Differenz. */
function Week({ today, now }: { today: string; now: number }) {
  const st = useApp()
  const monday = addDays(today, -weekday(today))
  const rows = Array.from({ length: 7 }, (_, n) => {
    const date = addDays(monday, n)
    const a = dayActual(st.local.workSessions, date, now)
    return { date, targetMin: date <= today ? (planFor(date).workInfo?.targetNetMin ?? 0) : 0, netMin: a.sessions.length && !a.unconfirmed ? a.netMin : undefined, unconfirmed: a.unconfirmed }
  })
  const w = weekSummary(rows)
  return (
    <Card className="space-y-1">
      {rows.map((r, n) => (
        <div key={r.date} className="flex justify-between tabular-nums">
          <span className="text-muted">{WEEKDAYS[n]}</span>
          <span>
            {r.unconfirmed ? 'unbestätigt' : r.netMin !== undefined ? fmtDuration(r.netMin) : '–'} {r.targetMin ? `von ${fmtDuration(r.targetMin)}` : ''}
          </span>
        </div>
      ))}
      <p className="pt-2">{w.trackedDays ? `An ${w.trackedDays} erfassten ${w.trackedDays === 1 ? 'Tag' : 'Tagen'}: ${balanceText(w.diffMin)}.` : 'Diese Woche ist nichts erfasst.'}</p>
    </Card>
  )
}

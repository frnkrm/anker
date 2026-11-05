import { useState } from 'react'
import { randomId } from '../../core/defaults'
import { SESSION_LABEL } from '../../core/support'
import { addDays, fmtDuration, fmtTime, weekday, WEEKDAYS } from '../../core/time'
import type { WorkSession, WorkSessionKind } from '../../core/types'
import { balanceText, dayActual, dayBalance, manualSession, weekSummary, workRule } from '../../core/worktime'
import { useNow, useToday } from '../../state/hooks'
import { planFor, useApp } from '../../state/store'
import { Button, Card, Page, Section, Segmented, TextInput, TimeField } from '../components/ui'
import { fieldToMs, msToField, PlanWorkForm, WorkHints } from '../components/WorkControls'

/** Arbeitszeit: freiwillig, lokal, für dich. Keine offizielle Zeiterfassung, nichts geht an Dritte. */
export default function WorkTime() {
  const st = useApp()
  const { date: today, plan } = useToday()
  const now = useNow(30_000)
  const [offset, setOffset] = useState(0)
  const date = addDays(today, offset)
  const dayPlan = offset === 0 ? plan : planFor(date)
  const actual = dayActual(st.local.workSessions, date, now)
  const target = dayPlan.workInfo?.targetNetMin ?? 0
  const openHere = st.local.workSessions.find((x) => x.endAt === undefined)
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

      <Card className="space-y-2">
        {actual.sessions.length === 0 ? (
          <p className="text-muted">Nichts erfasst. Das ist in Ordnung{dayPlan.workInfo ? `, der Plan rechnet mit Feierabend ${fmtTime(dayPlan.workEnd ?? 0)}` : ''}.</p>
        ) : (
          <>
            <Line label="Gearbeitet" value={fmtDuration(actual.netMin)} />
            <Line label="Pausen" value={fmtDuration(actual.breakMin)} />
            {actual.open && dayPlan.workEnd !== undefined && <Line label="Feierabend etwa" value={fmtTime(dayPlan.workEnd)} />}
            {!actual.open && <p className="pt-1">{dayBalance(actual, target).text}.</p>}
          </>
        )}
        {offset === 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {!openHere && (
              <Button variant="primary" onClick={() => st.workStart()}>
                Arbeit starten
              </Button>
            )}
            {openHere && !openHere.breaks.some((b) => b.endAt === undefined) && <Button onClick={() => st.workBreakStart()}>Pause starten</Button>}
            {openHere?.breaks.some((b) => b.endAt === undefined) && (
              <Button variant="primary" onClick={() => st.workBreakEnd()}>
                Pause beenden
              </Button>
            )}
            {openHere && <Button onClick={() => st.workStop()}>{openHere.kind === 'regular' ? 'Feierabend' : 'Einsatz beenden'}</Button>}
          </div>
        )}
      </Card>
      <WorkHints date={date} now={now} />

      {st.workUndo && (
        <Button onClick={() => st.undoWork()}>Letzte Korrektur rückgängig</Button>
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
        <ManualForm date={date} />
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
              <Button size="sm" onClick={() => st.workStart({ kind: c.workKind === 'oncall' || !c.workKind ? 'incident' : c.workKind, label: c.label, commitmentId: c.workKind === 'oncall' ? undefined : c.id })}>
                Starten
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => st.saveCommitment({ ...c, status: 'cancelled' })}>
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
  return (
    <Card className="space-y-2">
      <TextInput aria-label="Was ist los?" placeholder="Kurzer Titel (freiwillig)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <Button
        size="lg"
        className="w-full"
        onClick={async () => {
          await st.workStart({ kind: 'incident', label: label.trim() || undefined })
          setLabel('')
        }}
      >
        Kundenproblem jetzt bearbeiten
      </Button>
    </Card>
  )
}

function SessionCard({ session: x, date }: { session: WorkSession; date: string }) {
  const st = useApp()
  const patch = (fn: (s: WorkSession) => WorkSession) => st.editWork((list) => list.map((y) => (y.id === x.id ? { ...fn(y), manual: true } : y)))
  return (
    <Card className="space-y-2">
      <p className="font-medium">{x.label?.trim() || SESSION_LABEL[x.kind]}</p>
      <div className="flex items-center justify-between gap-2">
        <span>Beginn</span>
        <TimeField label="Beginn" value={msToField(date, x.startAt)} onChange={(m) => patch((s) => ({ ...s, startAt: fieldToMs(date, m) }))} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>Ende</span>
        {x.endAt !== undefined ? (
          <TimeField label="Ende" value={msToField(date, x.endAt)} onChange={(m) => patch((s) => ({ ...s, endAt: Math.max(s.startAt, fieldToMs(date, m)) }))} />
        ) : (
          <Button size="sm" onClick={() => patch((s) => ({ ...s, endAt: Math.max(s.startAt, Date.now()), breaks: s.breaks.map((b) => (b.endAt === undefined ? { ...b, endAt: Date.now() } : b)) }))}>
            Läuft noch, jetzt beenden
          </Button>
        )}
      </div>
      {x.breaks.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center justify-between gap-2">
          <span>Pause</span>
          <TimeField label="Pause von" value={msToField(date, b.startAt)} onChange={(m) => patch((s) => ({ ...s, breaks: s.breaks.map((y) => (y.id === b.id ? { ...y, startAt: fieldToMs(date, m) } : y)) }))} />
          {b.endAt !== undefined && <TimeField label="Pause bis" value={msToField(date, b.endAt)} onChange={(m) => patch((s) => ({ ...s, breaks: s.breaks.map((y) => (y.id === b.id ? { ...y, endAt: Math.max(y.startAt, fieldToMs(date, m)) } : y)) }))} />}
          <Button size="sm" variant="ghost" onClick={() => patch((s) => ({ ...s, breaks: s.breaks.filter((y) => y.id !== b.id) }))}>
            Entfernen
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {x.endAt !== undefined && (
          <Button size="sm" onClick={() => patch((s) => ({ ...s, breaks: [...s.breaks, { id: randomId(), startAt: s.startAt, endAt: Math.min(s.endAt!, s.startAt + 30 * 60_000) }] }))}>
            Pause hinzufügen
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => st.editWork((list) => list.filter((y) => y.id !== x.id))}>
          Eintrag löschen
        </Button>
      </div>
    </Card>
  )
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
  return (
    <Card className="space-y-3">
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
        onClick={async () => {
          await st.editWork((list) => [...list, manualSession(randomId(), date, start, end, withBreak ? [{ start: from, end: to }] : [], kind)])
          st.showToast('Nachgetragen.')
        }}
      >
        Eintragen
      </Button>
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
    return { date, targetMin: date <= today ? (planFor(date).workInfo?.targetNetMin ?? 0) : 0, netMin: a.sessions.length ? a.netMin : undefined }
  })
  const w = weekSummary(rows)
  return (
    <Card className="space-y-1">
      {rows.map((r, n) => (
        <div key={r.date} className="flex justify-between tabular-nums">
          <span className="text-muted">{WEEKDAYS[n]}</span>
          <span>
            {r.netMin !== undefined ? fmtDuration(r.netMin) : '–'} {r.targetMin ? `von ${fmtDuration(r.targetMin)}` : ''}
          </span>
        </div>
      ))}
      <p className="pt-2">{w.trackedDays ? `An ${w.trackedDays} erfassten ${w.trackedDays === 1 ? 'Tag' : 'Tagen'}: ${balanceText(w.diffMin)}.` : 'Diese Woche ist nichts erfasst.'}</p>
    </Card>
  )
}

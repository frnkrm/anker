import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EVENING_LABELS } from '../../core/defaults'
import { pendingTomorrowSteps, reviewDue } from '../../core/evening'
import { sportDone, sportInRoutine, theme } from '../../core/game'
import { currentMode, isBehind, MODE_HINT, MODE_LABEL, nextAction, rescueItems, suggestedMode, type NextAction } from '../../core/support'
import { addDays, fmtDuration, fmtTime, weekday } from '../../core/time'
import type { DayType, EveningPlan, PlannedStep, SupportMode } from '../../core/types'
import { pushPcStop } from '../../platform/supabase'
import { useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { SportToggle } from '../components/SportToggle'
import { StuckSheet } from '../components/Stuck'
import { openRoute, TodayDifferent } from '../components/TodayDifferent'
import { Timeline } from '../components/Timeline'
import { Button, Card, Progress, Segmented, Sheet, TextInput, TimeStepper } from '../components/ui'
import { WorkBar } from '../components/WorkControls'

const DAY_LABEL: Record<DayType, string> = { work: 'Arbeitstag', weekend: 'Frei', vacation: 'Urlaub', sick: 'Krank' }

/**
 * Die Startseite beantwortet nur eine Frage: Was mache ich jetzt?
 * Eine Hauptaktion und höchstens zwei weitere sind sichtbar, alles andere liegt hinter „Mehr“.
 */
export default function Now() {
  const { date, plan, log, m, now } = useToday()
  const st = useApp()
  const [stuck, setStuck] = useState(false)
  const [dayOpen, setDayOpen] = useState(false)
  const [longer, setLonger] = useState(false)
  const [interrupted, setInterrupted] = useState(false)
  const [rescue, setRescue] = useState(false)
  const [different, setDifferent] = useState(false)
  const [more, setMore] = useState(false)
  const input = { plan, log, m, nowMs: now, settings: st.settings, inbox: st.inbox, work: st.local.work, resume: st.local.resume, sessions: st.local.workSessions }
  const v = nextAction(input)
  const a = v.action
  const mode = currentMode(log)
  const suggestion = suggestedMode(st.settings, log, m)
  const behind = isBehind(plan, log, m)
  const readyToReview = st.inbox.filter((item) => reviewDue(item, now)).length + pendingTomorrowSteps(st.local.tomorrowSteps, now).length

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-32 safe-top">
      <header className="flex items-center justify-between gap-2 py-2">
        <div className="min-w-0 text-sm text-muted">{v.hard ? `${v.hard.label} ${fmtTime(v.hard.at)} · noch ${fmtDuration(v.hard.at - m)}` : fmtTime(m)}</div>
        <button type="button" onClick={() => setDayOpen(true)} className="min-h-10 shrink-0 rounded-full border border-line px-3 text-sm">
          {mode !== 'normal' ? MODE_LABEL[mode] : plan.homeOffice ? 'Homeoffice' : DAY_LABEL[plan.dayType]} ▾
        </button>
      </header>
      {v.hard && <Progress value={v.elapsed} className="!h-1" />}

      {st.alarmStatus && !st.alarmStatus.ok && (
        <Link to="/wecker" className="mt-3 block rounded-2xl border border-warm px-4 py-3 text-warm">
          Wecker prüfen: {st.alarmStatus.message}
        </Link>
      )}

      <section aria-live="polite" className="flex flex-1 flex-col justify-center py-6">
        {a.sub && <p className="mb-2 text-muted">{a.sub}</p>}
        <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">{a.title}</h1>
        {a.type === 'step' && a.step.useMinimal && <p className="mt-3 text-muted">Kleine Version. Zählt genauso.</p>}
        {a.type === 'arrival' && a.meal && a.index === 1 && <p className="mt-3 text-muted">Idee aus deinen Gerichten: {a.meal}</p>}
        {v.reason && <p className="mt-3 text-muted">{v.reason}</p>}
        <div className="mt-8 space-y-3">
          <ActionButtons action={a} date={date} mode={mode} onLonger={() => setLonger(true)} onStuck={() => setStuck(true)} onInterrupted={() => setInterrupted(true)} />
        </div>
        {suggestion && (
          <button type="button" className="mt-4 min-h-11 rounded-xl border border-line px-3 text-sm text-muted" onClick={() => st.setOverride(date, { mode: suggestion })}>
            {MODE_LABEL[suggestion]} für heute Abend einschalten
          </button>
        )}
      </section>

      <WorkBar date={date} plan={plan} log={log} m={m} now={now} />
      {readyToReview > 0 && !['sleep', 'night', 'bed', 'wake'].includes(a.type) && (
        <Link to="/abend" className="mb-3 block rounded-2xl border border-line px-4 py-3 text-muted">
          Für später gemerkt · {readyToReview} zum Ansehen
        </Link>
      )}
      {plan.conflicts?.map((x) => (
        <Link key={x} to="/tag" className="mb-2 block rounded-2xl border border-warm px-4 py-3 text-warm">
          {x} Ansehen
        </Link>
      ))}
      <div className="flex gap-2">
        <button type="button" className="min-h-11 flex-1 rounded-2xl border border-line" onClick={() => setDifferent(true)}>
          Heute anders
        </button>
        <button type="button" className="min-h-11 flex-1 text-muted" aria-expanded={more} onClick={() => setMore(!more)}>
          Plan & Optionen {more ? '▴' : '▾'}
        </button>
      </div>

      {more && (
        <div className="mt-2 space-y-3">
          <Link to="/abend" className="flex min-h-12 items-center justify-center rounded-2xl border border-line">
            Abend & morgen
          </Link>
          {plan.notes.length > 0 && (
            <div className="space-y-1 px-1 text-sm text-muted">
              {plan.notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </div>
          )}
          {a.type === 'step' && (
            <div className="flex gap-2">
              <Link to={`/fokus/${a.routine}`} className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-line">
                Fokus-Modus
              </Link>
              <Button variant="ghost" className="flex-1" onClick={() => st.setStep(date, a.routine, a.step.id, 'skipped')}>
                Überspringen
              </Button>
            </div>
          )}
          {a.type === 'step' && stepLink(a.step) && (
            <Link to={stepLink(a.step)!.to} className="flex min-h-12 items-center justify-center rounded-2xl border border-line">
              {stepLink(a.step)!.label}
            </Link>
          )}
          {(a.type === 'work' || a.type === 'worktask') && (
            <div className="flex gap-2">
              <Link to="/arbeit" className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-line">
                Arbeit öffnen
              </Link>
              <Button variant="ghost" className="flex-1" onClick={() => setLonger(true)}>
                Heute länger
              </Button>
            </div>
          )}
          {behind && (
            <Button className="w-full" onClick={() => setRescue(true)}>
              Tag neu sortieren
            </Button>
          )}
          <Card>
            <Timeline plan={plan} log={log} m={m} compact />
          </Card>
          {!sportInRoutine(st.settings) && !sportDone(plan, log, st.settings) && <SportToggle plan={plan} />}
          <Extras date={date} />
        </div>
      )}

      <StuckSheet open={stuck} onClose={() => setStuck(false)} action={a} />
      <TodayDifferent open={different} onClose={() => setDifferent(false)} date={date} m={m} action={a} />
      <DaySheet open={dayOpen} onClose={() => setDayOpen(false)} date={date} />
      <InterruptSheet open={interrupted} onClose={() => setInterrupted(false)} action={a} />
      <Sheet open={rescue} onClose={() => setRescue(false)} title="Ab jetzt zählt nur das">
        <ol className="mb-5 space-y-3">
          {rescueItems(input).map((x) => (
            <li key={x.title} className="flex items-baseline justify-between gap-3 text-xl">
              <span>{x.title}</span>
              {x.when && <span className="text-base text-muted tabular-nums">{x.when}</span>}
            </li>
          ))}
        </ol>
        <p className="mb-4 text-muted">Der Rest des Tages läuft in kleinen Versionen. Nichts davon musst du nachholen.</p>
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={async () => {
            await st.setOverride(date, { light: true })
            setRescue(false)
          }}
        >
          So machen wir es
        </Button>
      </Sheet>
      <LongerSheet
        open={longer}
        onClose={() => setLonger(false)}
        current={plan.workEnd ?? 17 * 60}
        onSave={async (end) => {
          await st.setOverride(date, { workEnd: end })
          setLonger(false)
          st.showToast(`Feierabend ${fmtTime(end)}. Der Abend ist neu geplant.`)
        }}
      />
    </div>
  )
}

function stepLink(step: PlannedStep): { to: string; label: string } | undefined {
  if (step.tag === 'inbox') return { to: '/inbox', label: 'Gedanken öffnen' }
  if (step.tag === 'tidy') return { to: '/aufraeumen', label: 'Timer starten' }
  if (step.tag === 'prep' || step.tag === 'gymbag') return { to: '/vorbereitung', label: 'Checkliste' }
  if (step.tag === 'breakfast') return { to: '/essen', label: 'Ideen' }
  return undefined
}

function ActionButtons({ action: a, date, mode, onLonger, onStuck, onInterrupted }: { action: NextAction; date: string; mode: SupportMode; onLonger: () => void; onStuck: () => void; onInterrupted: () => void }) {
  const st = useApp()
  const nav = useNavigate()
  const StuckButton = (
    <Button variant="ghost" size="lg" className="flex-1" onClick={onStuck}>
      Ich hänge fest
    </Button>
  )
  switch (a.type) {
    case 'wake':
      return (
        <>
          <Button
            variant="primary"
            size="xl"
            className="w-full"
            onClick={async () => {
              await st.mark(date, 'wakeAt')
              nav('/fokus/morning')
            }}
          >
            Ich bin wach
          </Button>
          <div className="flex gap-2">{StuckButton}</div>
        </>
      )
    case 'step':
      return (
        <>
          {mode === 'startschwierigkeit' ? (
            <Button variant="primary" size="xl" className="w-full" onClick={onStuck}>
              2 Minuten anfangen
            </Button>
          ) : (
            <Button variant="primary" size="xl" className="w-full" onClick={() => st.setStep(date, a.routine, a.step.id, a.step.useMinimal ? 'minimal' : 'done')}>
              Erledigt
            </Button>
          )}
          <div className="flex gap-2">
            {mode === 'startschwierigkeit' ? (
              <Button size="lg" className="flex-1" onClick={() => st.setStep(date, a.routine, a.step.id, a.step.useMinimal ? 'minimal' : 'done')}>
                Erledigt
              </Button>
            ) : a.step.minimal && !a.step.useMinimal ? (
              <Button size="lg" className="flex-1" onClick={() => st.setStep(date, a.routine, a.step.id, 'minimal')}>
                Nur: {a.step.minimal.title}
              </Button>
            ) : null}
            {mode !== 'startschwierigkeit' && StuckButton}
          </div>
        </>
      )
    case 'worktask':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.saveLocal((l) => ({ ...l, work: l.work.map((w) => (w.id === a.task.id ? { ...w, done: true, doneAt: Date.now() } : w)) }))}>
            Erledigt
          </Button>
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={onInterrupted}>
              Ich wurde unterbrochen
            </Button>
            {StuckButton}
          </div>
        </>
      )
    case 'task':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.setInboxDone(a.task.id, true)}>
            Erledigt
          </Button>
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => st.updateInbox(a.task.id, { taskDate: addDays(date, 1) })}>
              Später
            </Button>
            {StuckButton}
          </div>
        </>
      )
    case 'resume':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.setResume(undefined)}>
            Weiter
          </Button>
          <div className="flex gap-2">{StuckButton}</div>
        </>
      )
    case 'arrival':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.updateDay(date, (l) => ({ ...l, arrival: [...(l.arrival ?? []), a.index] }))}>
            Erledigt
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="lg" className="flex-1" onClick={() => st.updateDay(date, (l) => ({ ...l, arrival: Array.from({ length: a.total }, (_, n) => n) }))}>
              Überspringen
            </Button>
            {StuckButton}
          </div>
        </>
      )
    case 'prep':
    case 'go':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.saveCommitment({ ...a.leg.commitment, leftAt: Date.now() })}>
            Bin los
          </Button>
          <div className="flex gap-2">
            {a.leg.commitment.address && (
              <Button size="lg" className="flex-1" onClick={() => openRoute(a.leg.commitment.address!, a.leg.commitment.routeMode)}>
                Route öffnen
              </Button>
            )}
            {StuckButton}
          </div>
        </>
      )
    case 'underway':
      return (
        <Button variant="primary" size="xl" className="w-full" onClick={() => st.saveCommitment({ ...a.leg.commitment, arrivedAt: Date.now() })}>
          Ich bin angekommen
        </Button>
      )
    case 'away':
      return (
        <Button size="lg" className="w-full" onClick={() => st.saveCommitment({ ...a.leg.commitment, backAt: Date.now() })}>
          Bin wieder da
        </Button>
      )
    case 'work-break':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.workBreakEnd()}>
            Pause beenden
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={() => st.workStop()}>
            {a.session.kind === 'regular' ? 'Feierabend' : 'Einsatz beenden'}
          </Button>
        </>
      )
    case 'work-stale':
      return (
        <Link to="/arbeitszeit" className="flex min-h-20 items-center justify-center rounded-3xl bg-accent px-6 text-center text-2xl font-semibold text-accent-ink">
          Ende eintragen
        </Link>
      )
    case 'einsatz-start': {
      const c = a.leg.commitment
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.workStart({ kind: c.workKind === 'oncall' || !c.workKind ? 'incident' : c.workKind, label: c.label, commitmentId: c.id })}>
            Einsatz starten
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="lg" className="flex-1" onClick={() => st.saveCommitment({ ...c, status: 'cancelled' })}>
              Entfällt
            </Button>
            {StuckButton}
          </div>
        </>
      )
    }
    case 'einsatz-running':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={async () => {
            await st.workStop()
            st.showToast('Gesichert. Der Rest des Tages gehört wieder dir.')
          }}>
            Einsatz beenden
          </Button>
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => st.workBreakStart()}>
              Pause
            </Button>
            <Button size="lg" className="flex-1" onClick={onInterrupted}>
              Ich wurde unterbrochen
            </Button>
          </div>
        </>
      )
    case 'return-check':
      return (
        <>
          <Button
            variant="primary"
            size="xl"
            className="w-full"
            onClick={() => st.updateDay(date, (l) => ({ ...l, override: { ...l.override, backAt: Date.now() } }))}
          >
            Ja, bin zurück
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={() =>
              st.adjustDay(date, 'Abendroutine: heute nicht nötig', (l) => ({
                ...l,
                override: { ...l.override, backAt: Date.now() },
                steps: { ...l.steps, ...Object.fromEntries(st.settings.routines.evening.filter((x) => !l.steps[`evening:${x.id}`]).map((x) => [`evening:${x.id}`, 'not-needed' as const])) },
              }))
            }
          >
            Heute nicht mehr
          </Button>
        </>
      )
    case 'leave':
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.mark(date, 'leftAt')}>
            Bin los
          </Button>
          <div className="flex gap-2">{StuckButton}</div>
        </>
      )
    case 'work':
      return (
        <>
          <Link to="/arbeit" className="flex min-h-20 items-center justify-center rounded-3xl bg-accent px-6 text-center text-2xl font-semibold text-accent-ink">
            Wichtigste Aufgabe festlegen
          </Link>
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={onLonger}>
              Heute länger
            </Button>
            {StuckButton}
          </div>
        </>
      )
    case 'free':
      return a.canExtend ? (
        <Button
          size="lg"
          className="w-full"
          onClick={async () => {
            await st.setOverride(date, { pcStopExtendMin: 15 })
            void pushPcStop()
            st.showToast('15 Minuten mehr. Einmal pro Abend.')
          }}
        >
          PC-Stopp +15 Minuten
        </Button>
      ) : null
    case 'pcoff':
      return (
        <Button variant="primary" size="xl" className="w-full" onClick={() => st.mark(date, 'pcOffAt')}>
          PC ist aus
        </Button>
      )
    case 'bed':
      return (
        <Button variant="primary" size="xl" className="w-full" onClick={() => st.mark(date, 'bedAt')}>
          Ich liege im Bett
        </Button>
      )
    case 'info':
      if (a.block?.kind === 'evening-plan' && /Kochen|Essen/.test(a.block.title)) {
        return (
          <Link to="/essen" className="flex min-h-14 items-center justify-center rounded-2xl border border-line text-lg">
            Was koche ich?
          </Link>
        )
      }
      return <div className="flex gap-2">{StuckButton}</div>
    default:
      return null
  }
}

/** „Ich wurde unterbrochen“: letzten Schritt festhalten, später mit einem Tipp zurück. */
function InterruptSheet({ open, onClose, action: a }: { open: boolean; onClose: () => void; action: NextAction }) {
  const st = useApp()
  const [next, setNext] = useState('')
  const task = a.type === 'worktask' ? a.task : undefined
  const einsatz = a.type === 'einsatz-running' ? a.title : undefined
  return (
    <Sheet open={open} onClose={onClose} title="Wo machst du weiter?">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const step = next.trim()
          if (task) {
            if (step) await st.saveLocal((l) => ({ ...l, work: l.work.map((w) => (w.id === task.id ? { ...w, nextStep: step } : w)) }))
            await st.setResume({ kind: 'work', title: task.title, nextStep: step || task.nextStep, refId: task.id, at: Date.now() })
          }
          if (einsatz) await st.setResume({ kind: 'work', title: einsatz, nextStep: step || undefined, at: Date.now() })
          setNext('')
          onClose()
          st.showToast('Gemerkt. Du findest gleich hierher zurück.')
        }}
      >
        <TextInput autoFocus aria-label="Nächster Schritt" placeholder={task?.nextStep ?? 'Nächster Schritt (freiwillig)'} value={next} onChange={(e) => setNext(e.target.value)} />
        <Button type="submit" variant="primary" size="lg" className="w-full">
          Merken
        </Button>
      </form>
    </Sheet>
  )
}

const MODES: SupportMode[] = ['normal', 'startschwierigkeit', 'wenig-energie', 'ueberlastet', 'auf-kurs']

function DaySheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const st = useApp()
  const log = st.days[date]
  const o = log?.override ?? {}
  const isWorkDay = st.settings.work[weekday(date)]?.isWorkDay
  const type: DayType = o.dayType ?? (isWorkDay ? 'work' : 'weekend')
  const evening: EveningPlan = o.evening ?? st.settings.evenings[weekday(date)] ?? 'free'
  const mode = currentMode(log)
  return (
    <Sheet open={open} onClose={onClose} title="Heute">
      <div className="max-h-[75dvh] space-y-5 overflow-y-auto">
        <div className="space-y-2">
          <p className="text-muted">Was hilft dir gerade?</p>
          <Segmented<SupportMode> label="Unterstützung" value={mode} options={MODES.map((k) => ({ value: k, label: MODE_LABEL[k] }))} onChange={(v) => st.setOverride(date, { mode: v })} />
          <p className="text-sm text-muted">{MODE_HINT[mode]}</p>
        </div>
        <div className="space-y-2">
          <p className="text-muted">Was für ein Tag ist heute?</p>
          <Segmented
            label="Tagesart"
            value={type}
            options={[
              { value: 'work', label: 'Arbeit' },
              { value: 'weekend', label: 'Frei' },
              { value: 'vacation', label: 'Urlaub' },
              { value: 'sick', label: 'Krank' },
            ]}
            onChange={(v) => st.setOverride(date, { dayType: v })}
          />
          {type === 'sick' && <p className="text-sm text-muted">Krank-Modus: nur das Nötigste, kein Ziel, nichts geht verloren. Der Wecker pausiert an diesem Tag und klingelt danach wieder.</p>}
        </div>
        {type === 'work' && (o.homeOffice ?? st.settings.work[weekday(date)]?.homeOffice) && <HomeOfficeInfo />}
        {type === 'work' && (
          <div className="flex items-center justify-between">
            <span>Homeoffice heute</span>
            <Segmented
              label="Homeoffice"
              value={o.homeOffice ?? st.settings.work[weekday(date)]?.homeOffice ? 'ja' : 'nein'}
              options={[
                { value: 'nein', label: 'Nein' },
                { value: 'ja', label: 'Ja' },
              ]}
              onChange={(v) => st.setOverride(date, { homeOffice: v === 'ja' })}
            />
          </div>
        )}
        <div className="space-y-2">
          <p className="text-muted">Heute Abend</p>
          <Segmented label="Abendplan" value={evening} options={(Object.keys(EVENING_LABELS) as EveningPlan[]).map((k) => ({ value: k, label: EVENING_LABELS[k] }))} onChange={(v) => st.setOverride(date, { evening: v })} />
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={onClose}>
          Fertig
        </Button>
      </div>
    </Sheet>
  )
}

/** Nur eine Hilfe zum Kopieren: Anker sendet nichts und weiß nicht, ob du Homeoffice machen darfst. */
function HomeOfficeInfo() {
  const st = useApp()
  const text = st.settings.homeOfficeMessage
  return (
    <div className="space-y-2 rounded-xl bg-surface-2 p-3">
      <p className="text-sm text-muted">Musst du jemandem Bescheid geben? Das machst du selbst.</p>
      <p>„{text}“</p>
      <Button
        size="sm"
        onClick={async () => {
          await navigator.clipboard?.writeText(text).catch(() => undefined)
          st.showToast('Kopiert. Gesendet ist damit noch nichts.')
        }}
      >
        Text kopieren
      </Button>
    </div>
  )
}

function LongerSheet({ open, onClose, current, onSave }: { open: boolean; onClose: () => void; current: number; onSave: (end: number) => void }) {
  const [end, setEnd] = useState(current + 60)
  return (
    <Sheet open={open} onClose={onClose} title="Heute länger arbeiten">
      <p className="mb-4 text-muted">Neuer Feierabend. PC-Stopp und Bettzeit bleiben gleich, der Abend wird neu geplant.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {[30, 60, 90, 120].map((x) => (
          <Button key={x} onClick={() => setEnd(current + x)}>
            +{x} min
          </Button>
        ))}
      </div>
      <div className="mb-5 flex justify-center">
        <TimeStepper label="Feierabend" night value={end} onChange={setEnd} />
      </div>
      <Button variant="primary" size="lg" className="w-full" onClick={() => onSave(end)}>
        Übernehmen
      </Button>
    </Sheet>
  )
}

/** Dezente Hinweise: Stufen-Angebot, Wochenrückblick. Nie als Hürde, und nur unter „Mehr“. */
function Extras({ date }: { date: string }) {
  const st = useApp()
  const t = theme(st.settings.themeId)
  const sunday = weekday(date) === 6
  const reviewed = st.reviews.some((r) => r.id === date)
  const gameOn = st.settings.support.gameVisible && st.days[date]?.override.mode !== 'ueberlastet'
  return (
    <div className="space-y-2">
      {gameOn && st.game.stageOffer && (
        <Card className="flex items-center gap-3">
          <span className="flex-1">
            Bereit für <strong>{t.stageNames[st.game.stageOffer - 1]}</strong>? Neue Ziele, mehr {t.xpWord}.
          </span>
          <Link to="/spiel" className="min-h-11 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-ink">
            Ansehen
          </Link>
        </Card>
      )}
      {sunday && !reviewed && (
        <Link to="/rueckblick" className="flex min-h-14 items-center rounded-2xl bg-surface px-4">
          <span className="flex-1">Wochenrückblick, 3 kurze Fragen</span> ›
        </Link>
      )}
    </div>
  )
}

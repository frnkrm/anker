import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EVENING_LABELS } from '../../core/defaults'
import { sportDone, sportInRoutine, theme } from '../../core/game'
import { nowView, type NowAction } from '../../core/now'
import { fmtDuration, fmtTime, weekday, WEEKDAYS_LONG } from '../../core/time'
import type { DayType, EveningPlan, PlannedStep } from '../../core/types'
import { pushPcStop } from '../../platform/supabase'
import { useToday } from '../../state/hooks'
import { useApp } from '../../state/store'
import { SportToggle } from '../components/SportToggle'
import { StuckSheet } from '../components/Stuck'
import { Timeline } from '../components/Timeline'
import { Button, Card, Progress, Segmented, Sheet, TimeStepper } from '../components/ui'

const DAY_LABEL: Record<DayType, string> = { work: 'Arbeitstag', weekend: 'Frei', vacation: 'Urlaub', sick: 'Krank' }

export default function Now() {
  const { date, plan, log, m } = useToday()
  const st = useApp()
  const [stuck, setStuck] = useState(false)
  const [dayOpen, setDayOpen] = useState(false)
  const [longer, setLonger] = useState(false)
  const [showLine, setShowLine] = useState(() => localStorage.getItem('anker.line') === '1')
  const v = nowView(plan, log, m)
  const a = v.action

  const toggleLine = () => {
    setShowLine(!showLine)
    try {
      localStorage.setItem('anker.line', showLine ? '0' : '1')
    } catch {
      /* egal */
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-32 safe-top">
      <header className="flex items-center justify-between py-2">
        <div className="text-muted">
          {WEEKDAYS_LONG[weekday(date)]} · {fmtTime(m)}
        </div>
        <button type="button" onClick={() => setDayOpen(true)} className="min-h-10 rounded-full bg-surface px-4 text-sm">
          {plan.homeOffice ? 'Homeoffice' : DAY_LABEL[plan.dayType]} ▾
        </button>
      </header>

      {plan.notes.length > 0 && (
        <div className="mb-3 space-y-1 rounded-2xl bg-warm-soft px-4 py-3 text-warm">
          {plan.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}

      <section aria-live="polite" className="flex flex-1 flex-col justify-center py-4">
        <p className="mb-2 text-muted">{a.type === 'step' ? a.sub : 'Jetzt'}</p>
        <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">{a.title}</h1>
        {a.type !== 'step' && a.sub && <p className="mt-3 text-xl text-muted">{a.sub}</p>}
        {a.type === 'step' && a.step.useMinimal && <p className="mt-3 text-muted">Heute in kurzer Version.</p>}
        <div className="mt-8 space-y-3">
          <ActionButtons action={a} date={date} onLonger={() => setLonger(true)} />
        </div>
      </section>

      {v.hard && (
        <Card className="mb-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-lg">
              Noch <strong className="tabular-nums">{fmtDuration(v.hard.at - m)}</strong> bis {v.hard.label}
            </span>
            <span className="tabular-nums text-muted">{fmtTime(v.hard.at)}</span>
          </div>
          <Progress value={v.elapsed} />
        </Card>
      )}

      <div className="flex gap-2">
        {a.type !== 'sleep' && a.type !== 'night' && (
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => setStuck(true)}>
            Ich hänge fest
          </Button>
        )}
        <Button variant="ghost" size="lg" className="flex-1" onClick={toggleLine} aria-expanded={showLine}>
          Tageslinie {showLine ? '▴' : '▾'}
        </Button>
      </div>

      {showLine && (
        <Card className="mt-3">
          <Timeline plan={plan} log={log} m={m} compact />
        </Card>
      )}

      {/* Training in der Morgenroutine ist schon ein eigener Schritt, alles andere braucht hier den Knopf */}
      {!sportInRoutine(st.settings) && !sportDone(plan, log, st.settings) && (
        <div className="mt-4">
          <SportToggle plan={plan} />
        </div>
      )}

      <Extras date={date} />

      <StuckSheet open={stuck} onClose={() => setStuck(false)} action={a} />
      <DaySheet open={dayOpen} onClose={() => setDayOpen(false)} date={date} />
      <LongerSheet
        open={longer}
        onClose={() => setLonger(false)}
        current={plan.workEnd ?? 17 * 60}
        onSave={async (end) => {
          await st.setOverride(date, { workEnd: end })
          setLonger(false)
          st.showToast(`Feierabend ${fmtTime(end)} – Abend ist neu geplant.`)
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

function ActionButtons({ action: a, date, onLonger }: { action: NowAction; date: string; onLonger: () => void }) {
  const st = useApp()
  const nav = useNavigate()
  switch (a.type) {
    case 'wake':
      return (
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
      )
    case 'step': {
      const link = stepLink(a.step)
      return (
        <>
          <Button variant="primary" size="xl" className="w-full" onClick={() => st.setStep(date, a.routine, a.step.id, a.step.useMinimal ? 'minimal' : 'done')}>
            Erledigt
          </Button>
          <div className="flex gap-2">
            {a.step.minimal && !a.step.useMinimal && (
              <Button size="lg" className="flex-1" onClick={() => st.setStep(date, a.routine, a.step.id, 'minimal')}>
                Nur: {a.step.minimal.title}
              </Button>
            )}
            <Button variant="ghost" size="lg" className="flex-1" onClick={() => st.setStep(date, a.routine, a.step.id, 'skipped')}>
              Überspringen
            </Button>
          </div>
          <div className="flex gap-2">
            <Link to={`/fokus/${a.routine}`} className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-surface text-accent">
              Fokus-Modus
            </Link>
            {link && (
              <Link to={link.to} className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-surface text-accent">
                {link.label}
              </Link>
            )}
          </div>
        </>
      )
    }
    case 'leave':
      return (
        <Button variant="primary" size="xl" className="w-full" onClick={() => st.mark(date, 'leftAt')}>
          Bin los
        </Button>
      )
    case 'work':
      return (
        <Button size="lg" className="w-full" onClick={onLonger}>
          Ich mache heute länger
        </Button>
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
      ) : (
        <p className="text-muted">Verlängerung für heute schon genutzt.</p>
      )
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
          <Link to="/essen" className="flex min-h-14 items-center justify-center rounded-2xl bg-surface-2 text-lg">
            Was koche ich?
          </Link>
        )
      }
      return null
    default:
      return null
  }
}

function DaySheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const st = useApp()
  const log = st.days[date]
  const o = log?.override ?? {}
  const isWorkDay = st.settings.work[weekday(date)]?.isWorkDay
  const type: DayType = o.dayType ?? (isWorkDay ? 'work' : 'weekend')
  const evening: EveningPlan = o.evening ?? st.settings.evenings[weekday(date)] ?? 'free'
  return (
    <Sheet open={open} onClose={onClose} title="Heute">
      <div className="space-y-5">
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
          {type === 'sick' && <p className="text-sm text-muted">Krank-Modus: nur das Nötigste, kein Ziel, nichts geht verloren.</p>}
        </div>
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
        <TimeStepper label="Feierabend" value={end} onChange={setEnd} />
      </div>
      <Button variant="primary" size="lg" className="w-full" onClick={() => onSave(end)}>
        Übernehmen
      </Button>
    </Sheet>
  )
}

/** Dezente Hinweise: Stufen-Angebot, Wochenrückblick, Einrichtung. Nie als Hürde. */
function Extras({ date }: { date: string }) {
  const st = useApp()
  const t = theme(st.settings.themeId)
  const sunday = weekday(date) === 6
  const reviewed = st.reviews.some((r) => r.id === date)
  return (
    <div className="mt-4 space-y-2">
      {st.game.stageOffer && (
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
          🗓️ <span className="ml-3 flex-1">Wochenrückblick – 3 kurze Fragen</span> ›
        </Link>
      )}
    </div>
  )
}

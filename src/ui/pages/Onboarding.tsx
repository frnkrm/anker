import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { applySchedule, deriveSchedule } from '../../core/defaults'
import { THEME_LIST } from '../../core/game'
import { fmtTime, WEEKDAYS } from '../../core/time'
import type { CommuteMode, MainGoal, Settings, ThemeId } from '../../core/types'
import { isNative } from '../../platform/native'
import { exactAlarmStatus, openExactAlarmSettings, requestNotificationPermission } from '../../platform/notifications'
import { today, useApp } from '../../state/store'
import { Button, Card, Segmented, Stepper, TimeStepper } from '../components/ui'

const GOALS: { value: MainGoal; label: string }[] = [
  { value: 'on-time-rested', label: 'Pünktlich und ausgeschlafen' },
  { value: 'more-energy', label: 'Mehr Energie am Tag' },
  { value: 'routine', label: 'Feste Routinen' },
]

export default function Onboarding() {
  const st = useApp()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [s, setS] = useState<Settings>(() => applySchedule(st.settings))
  const workStart = s.work.find((w) => w.isWorkDay)?.start ?? 8 * 60
  const sug = deriveSchedule(s)

  const patch = (fn: (x: Settings) => Settings, recompute = true) => setS((prev) => (recompute ? applySchedule(fn(prev)) : fn(prev)))

  const finish = async () => {
    await st.saveSettings(() => ({ ...s, onboarded: true, game: { ...s.game, startDate: today() } }))
    if (isNative()) setStep(2)
    else nav('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-8 safe-top">
      <div className="mb-6 flex gap-2 pt-2" aria-hidden="true">
        {[0, 1, ...(isNative() ? [2] : [])].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-surface-2'}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-1 flex-col gap-5">
          <div>
            <h1 className="text-3xl font-semibold">Hallo! ⚓</h1>
            <p className="mt-1 text-lg text-muted">Drei Angaben, dann plant Anker deinen Tag.</p>
          </div>
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-lg">Arbeitsbeginn</span>
              <TimeStepper label="Arbeitsbeginn" value={workStart} onChange={(v) => patch((x) => ({ ...x, work: x.work.map((w) => ({ ...w, start: v })) }))} />
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Arbeitstage">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={s.work[i]!.isWorkDay}
                  onClick={() => patch((x) => ({ ...x, work: x.work.map((w, j) => (j === i ? { ...w, isWorkDay: !w.isWorkDay } : w)) }))}
                  className={`h-11 w-11 rounded-xl ${s.work[i]!.isWorkDay ? 'bg-accent font-semibold text-accent-ink' : 'bg-surface-2'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Card>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-lg">Fahrzeit</span>
              <Stepper label="Fahrzeit" value={s.commute.minutes} min={0} max={180} onChange={(v) => patch((x) => ({ ...x, commute: { ...x.commute, minutes: v } }))} />
            </div>
            <Segmented<CommuteMode>
              label="Verkehrsmittel"
              value={s.commute.mode}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'oepnv', label: 'Bus & Bahn' },
                { value: 'rad', label: 'Rad' },
                { value: 'fuss', label: 'Zu Fuß' },
              ]}
              onChange={(v) => patch((x) => ({ ...x, commute: { ...x.commute, mode: v, bufferMin: v === 'oepnv' ? 15 : 10 } }))}
            />
          </Card>
          <Card className="space-y-3">
            <span className="text-lg">Hauptziel</span>
            <div className="flex flex-col gap-2">
              {GOALS.map((g) => (
                <button key={g.value} type="button" aria-pressed={s.goal === g.value} onClick={() => patch((x) => ({ ...x, goal: g.value }), false)} className={`min-h-12 rounded-xl px-4 text-left ${s.goal === g.value ? 'bg-accent font-semibold text-accent-ink' : 'bg-surface-2'}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </Card>
          <div className="flex-1" />
          <Button variant="primary" size="xl" className="w-full" onClick={() => setStep(1)}>
            Weiter
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-1 flex-col gap-5">
          <div>
            <h1 className="text-3xl font-semibold">Dein Anker</h1>
            <p className="mt-1 text-lg text-muted">Rückwärts gerechnet ab {fmtTime(workStart)}. Passt das?</p>
          </div>
          <Card className="space-y-4">
            <Line label="Aufstehen (jeden Tag)" value={s.anchor.wake} onChange={(v) => patch((x) => ({ ...x, anchor: { ...x.anchor, wake: v, manual: { ...x.anchor.manual, wake: true } } }), false)} />
            <p className="-mt-2 text-sm text-muted">Losgehen um {fmtTime(sug.leave)}</p>
            <Line label="PC-Stopp" night value={s.pcStop} onChange={(v) => patch((x) => ({ ...x, pcStop: v, anchor: { ...x.anchor, manual: { ...x.anchor.manual, pcStop: true } } }), false)} />
            <Line label="Bett" night value={s.bed} onChange={(v) => patch((x) => ({ ...x, bed: v, anchor: { ...x.anchor, manual: { ...x.anchor.manual, bed: true } } }), false)} />
            <p className="text-sm text-muted">Für 8 Stunden Schlaf. Du kannst später in kleinen Schritten anpassen.</p>
          </Card>
          <div>
            <h2 className="mb-2 text-lg font-semibold">Wähle dein Thema</h2>
            <div className="grid grid-cols-2 gap-2">
              {THEME_LIST.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={s.themeId === t.id}
                  onClick={() => patch((x) => ({ ...x, themeId: t.id as ThemeId }), false)}
                  className={`min-h-24 rounded-2xl p-3 text-left ${s.themeId === t.id ? 'bg-accent text-accent-ink' : 'bg-surface'}`}
                >
                  <div className="text-2xl" aria-hidden="true">
                    {t.emoji}
                  </div>
                  <div className="font-semibold">{t.name}</div>
                  <div className={`text-xs ${s.themeId === t.id ? '' : 'text-muted'}`}>{t.levels[0]} → {t.levels[9]}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="xl" onClick={() => setStep(0)} aria-label="Zurück">
              ‹
            </Button>
            <Button variant="primary" size="xl" className="flex-1" onClick={finish}>
              Passt, los geht’s
            </Button>
          </div>
        </div>
      )}

      {step === 2 && <Permissions onDone={() => nav('/', { replace: true })} />}
    </div>
  )
}

function Line({ label, value, onChange, night = false }: { label: string; value: number; onChange: (v: number) => void; night?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-lg">{label}</span>
      <TimeStepper label={label} value={value} onChange={onChange} night={night} />
    </div>
  )
}

/** Nur die zwei Pflicht-Berechtigungen, je ein Tipp. Alles andere später im Einrichtungs-Check. */
function Permissions({ onDone }: { onDone: () => void }) {
  const [notif, setNotif] = useState(false)
  const [exact, setExact] = useState(false)
  useEffect(() => {
    const check = () => void exactAlarmStatus().then((x) => setExact(x === 'granted'))
    check()
    const id = setInterval(check, 1500)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold">Fast fertig</h1>
        <p className="mt-1 text-lg text-muted">Damit Anker dich pünktlich erinnern kann.</p>
      </div>
      <Button variant={notif ? 'secondary' : 'primary'} size="xl" className="w-full" onClick={async () => setNotif(await requestNotificationPermission())}>
        {notif ? '✓ Benachrichtigungen an' : 'Benachrichtigungen erlauben'}
      </Button>
      <Button variant={exact ? 'secondary' : 'primary'} size="xl" className="w-full" onClick={openExactAlarmSettings}>
        {exact ? '✓ Pünktliche Wecker an' : 'Pünktliche Wecker erlauben'}
      </Button>
      <div className="flex-1" />
      <Button variant={notif && exact ? 'primary' : 'ghost'} size="xl" className="w-full" onClick={onDone}>
        {notif && exact ? 'Los geht’s' : 'Später'}
      </Button>
    </div>
  )
}

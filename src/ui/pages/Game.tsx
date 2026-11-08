import { Link } from 'react-router'
import { ACHIEVEMENTS, balance, chapterStatus, dayGoals, levelFor, theme } from '../../core/game'
import { addDays, weekday } from '../../core/time'
import { planFor, statusOf, today, useApp } from '../../state/store'
import { Button, Card, Progress, Section } from '../components/ui'
import { HubContent } from '../components/HubContent'

const STAGE_GOALS = [
  ['Aufstehzeit', 'Pünktlich los', 'Abendroutine vor dem Zocken', 'PC-Stopp'],
  ['+ 10 Minuten Bewegung morgens'],
  ['+ Fitnessstudio an Sporttagen', '+ 1× pro Woche vorkochen', '+ 10 Minuten Aufräumen am Abend'],
]

export default function Game({ embedded = false }: { embedded?: boolean } = {}) {
  const st = useApp()
  const t = theme(st.settings.themeId)
  const lvl = levelFor(st.game.xp, t)
  const d = today()
  const ch = chapterStatus(st.game, d, (x) => statusOf(x))
  const stage = st.settings.game.stage

  const setStage = (s: 1 | 2 | 3) => {
    void st.saveSettings((x) => ({ ...x, game: { ...x.game, stage: s } })).then(() => st.setGame((g) => ({ ...g, stageOffer: undefined }))).catch(() => st.showToast('Die Stufe konnte noch nicht gespeichert werden.'))
  }

  const logs = Object.values(st.days).sort((a, b) => a.date.localeCompare(b.date))
  const progressFor = (id: string): [number, number] => {
    const streakGoal = id === 'wake-5' ? 'wake' : id === 'punctual-5' ? 'leave' : id === 'pcstop-7' ? 'pcstop' : undefined
    if (streakGoal) {
      let run = 0, best = 0
      for (const log of logs) {
        const goal = dayGoals(planFor(log.date), log, st.settings).find((item) => item.key === streakGoal)
        if (!goal) continue
        run = goal.met ? run + 1 : 0
        best = Math.max(best, run)
      }
      return [Math.min(best, id === 'pcstop-7' ? 7 : 5), id === 'pcstop-7' ? 7 : 5]
    }
    if (id === 'minimal-10') return [Math.min(10, logs.reduce((n, log) => n + Object.values(log.steps).filter((value) => value === 'minimal').length, 0)), 10]
    if (id === 'level-5') return [Math.min(5, lvl.level), 5]
    if (id === 'chapter-66') return [Math.min(66, Math.max(0, ...st.game.chaptersDone.map((item) => item.length), ch.progress)), 66]
    if (id === 'chapter-1') return [Math.min(1, st.game.chaptersDone.length), 1]
    if (id === 'first-step') return [logs.some((log) => Object.values(log.steps).some((value) => value === 'done' || value === 'minimal')) ? 1 : 0, 1]
    if (id === 'shop') return [st.game.redeemed.length ? 1 : 0, 1]
    if (id === 'review') return [st.reviews.length ? 1 : 0, 1]
    if (id === 'prepcook') return [logs.some((log) => log.prepCooked) ? 1 : 0, 1]
    return [st.game.achievements[id] ? 1 : 0, 1]
  }
  const upcoming = ACHIEVEMENTS.filter((item) => !st.game.achievements[item.id]).map((item) => ({ item, progress: progressFor(item.id) })).sort((a, b) => b.progress[0] / b.progress[1] - a.progress[0] / a.progress[1]).slice(0, 3)
  const achievement = (item: (typeof ACHIEVEMENTS)[number]) => {
    const got = st.game.achievements[item.id]
    const [value, total] = progressFor(item.id)
    return <div key={item.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4 py-3"><span aria-hidden="true">{got ? '✨' : '○'}</span><div className="min-w-0 flex-1"><p className="break-words font-medium">{item.title}</p><p className="text-sm text-muted">{item.id === 'comeback' ? 'Nach einer Pause wieder angefangen.' : item.description}</p></div><span className="shrink-0 text-sm tabular-nums text-muted">{got ? '✓' : `${value}/${total}`}</span></div>
  }
  return (
    <HubContent title={`${t.emoji} ${t.name}`} embedded={embedded}>
      {!embedded && <Card>
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-sm text-muted">Level {lvl.level}</p>
            <p className="text-2xl font-semibold">{lvl.name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">{balance(st.game)}</p>
            <p className="text-sm text-muted">{t.xpWord}</p>
          </div>
        </div>
        <Progress label="Fortschritt zum nächsten Level" value={lvl.progress} className="mt-3" />
        <p className="mt-1 text-sm text-muted">
          Noch {lvl.next - st.game.xp} bis {t.levels[lvl.level] ?? 'zum nächsten Stern'}
        </p>
      </Card>}

      <Card>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">
            {t.chapterWord} {st.game.chapter.index + 1}
          </h2>
          <span className="tabular-nums text-muted">
            {ch.progress} / {ch.length} Tage
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label={`${ch.progress} von ${ch.length} Tagen geschafft`}>
          {Array.from({ length: ch.length }, (_, i) => (
            <span key={i} className={`h-4 w-4 rounded-full ${i < ch.progress ? 'bg-accent' : 'bg-surface-2'}`} />
          ))}
        </div>
        <p className="mt-3 text-muted">
          Geschaffte Tage bleiben erhalten. Pausen nehmen dir nichts weg.
        </p>
        {st.game.chapter.attempt > 1 && <p className="mt-1 text-sm text-muted">Anlauf {st.game.chapter.attempt}. Alles Gesammelte bleibt.</p>}
      </Card>

      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="min-h-11 py-2 text-lg font-semibold">Stufe {stage}: {t.stageNames[stage - 1]}</summary>
        <ul className="mb-3 space-y-0.5 text-muted">
          {STAGE_GOALS.slice(0, stage)
            .flat()
            .map((g) => (
              <li key={g}>{g}</li>
            ))}
        </ul>
        {st.game.stageOffer && st.game.stageOffer > stage && (
          <div className="mb-3 rounded-2xl bg-accent-soft p-3">
            <p className="mb-2">
              Du hast ein {t.chapterWord} geschafft. Bereit für <strong>{t.stageNames[st.game.stageOffer - 1]}</strong>?
            </p>
            <p className="mb-3 text-sm text-muted">{STAGE_GOALS[st.game.stageOffer - 1]!.join(' · ')}</p>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => setStage(st.game.stageOffer!)}>
                Ja, weiter
              </Button>
              <Button variant="ghost" onClick={() => void st.setGame((g) => ({ ...g, stageOffer: undefined }))}>
                Noch nicht
              </Button>
            </div>
          </div>
        )}
        <div className="flex gap-2" role="radiogroup" aria-label="Stufe manuell ändern">
          {([1, 2, 3] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={stage === s} onClick={() => setStage(s)} className={`min-h-11 flex-1 rounded-xl text-sm ${stage === s ? 'bg-accent font-semibold text-accent-ink' : 'bg-surface-2'}`}>
              Stufe {s}
            </button>
          ))}
        </div>
      </details>

      <Link to="/spiel/shop" className="flex min-h-16 items-center gap-3 rounded-2xl bg-surface-2 px-4 text-text">
        <span className="text-2xl" aria-hidden="true">
          🎁
        </span>
        <span className="flex-1 text-lg font-semibold">Belohnungen einlösen</span>›
      </Link>

      <details className="rounded-2xl border border-line p-3"><summary className="min-h-11 py-2 font-medium">Geschaffte Tage</summary><Heatmap /></details>

      {st.game.badges.length > 0 && (
        <Section title="Abzeichen">
          <div className="flex flex-wrap gap-2">
            {st.game.badges.map((b) => (
              <span key={b} className="rounded-full bg-surface px-4 py-2">
                🏅 {b}
              </span>
            ))}
          </div>
        </Section>
      )}

      {upcoming.length > 0 && <Section title="Nächste Erfolge">{upcoming.map(({ item }) => achievement(item))}</Section>}
      <details className="space-y-2 rounded-2xl border border-line p-3"><summary className="min-h-11 py-2 font-medium">Alle Erfolge</summary>{ACHIEVEMENTS.map(achievement)}</details>
    </HubContent>
  )
}

/** Kalender-Heatmap der letzten 12 Wochen. Nur geschaffte Tage leuchten, nichts wird rot. */
function Heatmap() {
  const d = today()
  const start = addDays(d, -weekday(d) - 7 * 11)
  const days = Array.from({ length: 84 }, (_, i) => addDays(start, i))
  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-1" role="img" aria-label="Geschaffte Tage der letzten 12 Wochen">
        {days.map((x) => {
          const s = x > d ? 'future' : statusOf(x)
          const cls = s === 'success' ? 'bg-accent' : s === 'neutral' ? 'bg-warm-soft' : s === 'future' ? 'bg-transparent' : 'bg-surface-2'
          return <span key={x} title={x} className={`aspect-square rounded-sm ${cls} ${x === d ? 'ring-2 ring-accent' : ''}`} />
        })}
      </div>
      <p className="mt-2 text-sm text-muted">Jedes leuchtende Feld ist ein geschaffter Tag.</p>
    </div>
  )
}

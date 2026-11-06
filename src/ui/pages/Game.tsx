import { Link } from 'react-router'
import { ACHIEVEMENTS, balance, chapterStatus, levelFor, theme } from '../../core/game'
import { addDays, weekday } from '../../core/time'
import { statusOf, today, useApp } from '../../state/store'
import { Button, Card, Page, Progress, Section } from '../components/ui'

const STAGE_GOALS = [
  ['Aufstehzeit', 'Pünktlich los', 'Abendroutine vor dem Zocken', 'PC-Stopp'],
  ['+ 10 Minuten Bewegung morgens'],
  ['+ Fitnessstudio an Sporttagen', '+ 1× pro Woche vorkochen', '+ 10 Minuten Aufräumen am Abend'],
]

export default function Game() {
  const st = useApp()
  const t = theme(st.settings.themeId)
  const lvl = levelFor(st.game.xp, t)
  const d = today()
  const ch = chapterStatus(st.game, d, (x) => statusOf(x))
  const stage = st.settings.game.stage

  const setStage = (s: 1 | 2 | 3) => {
    void st.saveSettings((x) => ({ ...x, game: { ...x.game, stage: s } }))
    void st.setGame((g) => ({ ...g, stageOffer: undefined }))
  }

  return (
    <Page title={`${t.emoji} ${t.name}`}>
      <Card>
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
      </Card>

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

      <Card>
        <h2 className="mb-1 text-xl font-semibold">
          Stufe {stage}: {t.stageNames[stage - 1]}
        </h2>
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
      </Card>

      <Link to="/spiel/shop" className="flex min-h-16 items-center gap-3 rounded-3xl bg-warm-soft px-4 text-warm">
        <span className="text-2xl" aria-hidden="true">
          🎁
        </span>
        <span className="flex-1 text-lg font-semibold">Belohnungen einlösen</span>›
      </Link>

      <Section title="Geschaffte Tage">
        <Card>
          <Heatmap />
        </Card>
      </Section>

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

      <Section title="Erfolge">
        {ACHIEVEMENTS.map((a) => {
          const got = st.game.achievements[a.id]
          return (
            <div key={a.id} className={`flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4 py-2 ${got ? '' : 'opacity-50'}`}>
              <span aria-hidden="true">{got ? '✨' : '○'}</span>
              <div className="flex-1">
                <div className="font-medium">{a.title}</div>
                <div className="text-sm text-muted">{a.description}</div>
              </div>
            </div>
          )
        })}
      </Section>
    </Page>
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

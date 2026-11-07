import { useParams } from 'react-router'
import { useState } from 'react'
import { applySchedule, deriveSchedule, EVENING_LABELS, randomId, resetToSuggested, sumMinutes } from '../../core/defaults'
import { THEME_LIST } from '../../core/game'
import { fmtDuration, fmtTime, WEEKDAYS, WEEKDAYS_LONG } from '../../core/time'
import { moveById } from '../../core/sortable'
import type { CommuteMode, EveningPlan, ReminderIntensity, RoutineId, RoutineStep, Settings as S, SportKind, ThemeId } from '../../core/types'
import { WeatherSettings } from '../components/WeatherSettings'
import { useApp } from '../../state/store'
import { SortableList, type MoveResult } from '../components/Sortable'
import { ExtraControls } from '../components/ExtraControls'
import { Button, Card, Page, Row, Section, SettingRow, Segmented, Stepper, TextInput, TimeField, TimeStepper, Toggle } from '../components/ui'

type Save = (fn: (s: S) => S) => void

export default function Settings() {
  const { section } = useParams()
  const st = useApp()
  const s = st.settings
  const save: Save = (fn) => void st.saveSettings(fn)

  switch (section) {
    case 'arbeit':
      return <Work s={s} save={save} />
    case 'weg':
      return <Commute s={s} save={save} />
    case 'schlaf':
      return <Sleep s={s} save={save} />
    case 'sport':
      return <Sport s={s} save={save} />
    case 'abende':
      return <Evenings s={s} save={save} />
    case 'abendmodus':
      return <EveningMode s={s} save={save} />
    case 'morgenroutine':
      return <RoutineEditor s={s} save={st.saveSettings} r="morning" />
    case 'abendroutine':
      return <RoutineEditor s={s} save={st.saveSettings} r="evening" />
    case 'erinnerungen':
      return <Reminders s={s} save={save} />
    case 'darstellung':
      return <Look s={s} save={save} />
    case 'hilfen':
      return <Supports s={s} save={save} />
  }

  const sug = deriveSchedule(s)
  return (
    <Page className="settings-page" title="Einstellungen" back="/mehr">
      {s.suggestions.length > 0 && (
        <Section title="Vorschläge aus dem Wochenrückblick">
          {s.suggestions.map((x) => (
            <Card key={x.id} className="flex items-center gap-3">
              <span className="flex-1">{x.text}</span>
              <Button size="sm" onClick={() => save((y) => ({ ...y, suggestions: y.suggestions.filter((z) => z.id !== x.id) }))}>
                Erledigt
              </Button>
            </Card>
          ))}
        </Section>
      )}
      <Section title="Dein Tag">
        <Row label="Zeitübersicht" sub="Geplante Zeiten und mögliche Doppelungen" to="/zeiten" />
        <Row label="Arbeit" sub={`${s.work.filter((w) => w.isWorkDay).length} Tage · ab ${fmtTime(s.work.find((w) => w.isWorkDay)?.start ?? 480)}${s.flex.latestStart !== null ? ` · spätestens ${fmtTime(s.flex.latestStart)}` : ''}`} to="/einstellungen/arbeit" />
        <Row label="Arbeitsweg" sub={`${s.commute.minutes} min + ${s.commute.bufferMin} min Puffer`} to="/einstellungen/weg" />
        <Row label="Sport" sub={`${s.sport.days.filter(Boolean).length}× pro Woche`} to="/einstellungen/sport" />
      </Section>
      <Section title="Abend & Schlaf">
        <Row label="Sanfter Abendübergang" sub="Eigene ruhige Tätigkeit und ein freiwilliger Hinweis" to="/einstellungen/abenduebergang" />
        <Row label="Schlafüberblick" sub="Freiwillige Einträge, nur auf diesem Gerät" to="/schlaf" />
        <Row label="Schlaf & Anker" sub={`Aufstehen ${fmtTime(s.anchor.wake)} · PC-Stopp ${fmtTime(s.pcStop)} · Bett ${fmtTime(s.bed)}`} to="/einstellungen/schlaf" />
        <Row label="Abendpläne" to="/einstellungen/abende" />
        <Row label="Abendroutine" sub={`${s.routines.evening.length} Schritte · ${fmtDuration(sumMinutes(s.routines.evening))}`} to="/einstellungen/abendroutine" />
        <Row label="Abendmodus" sub="Freiwilliger Vorschlag auf der Startseite" to="/einstellungen/abendmodus" />
      </Section>
      {sug.wake !== s.anchor.wake && <p className="px-1 text-sm text-muted">Hinweis: Rechnerisch wäre {fmtTime(sug.wake)} die passende Aufstehzeit.</p>}
      <Section title="Routinen">
        <Row label="Morgenroutine" sub={`${s.routines.morning.length} Schritte · ${fmtDuration(sumMinutes(s.routines.morning))}`} to="/einstellungen/morgenroutine" />
      </Section>
      <Section title="App">
        <Row label="Optionale Vorschläge" sub="KI und Verkehr bewusst freigeben" to="/einstellungen/assistenz" />
        <Row label="Erinnerungen" sub={{ gentle: 'Sanft', normal: 'Normal', persistent: 'Hartnäckig' }[s.reminders.intensity]} to="/einstellungen/erinnerungen" />
        <Row label="Alltagshilfen" sub="Fokus-Puls, Ankommen, Spiel" to="/einstellungen/hilfen" />
        <Row label="Darstellung & Thema" to="/einstellungen/darstellung" />
        <Row label="Belohnungen" to="/spiel/shop" />
        <Row label="Gerichte" to="/essen" />
        <Row label="Aufräum-Zonen" to="/aufraeumen" />
      </Section>
    </Page>
  )
}

function Work({ s, save }: { s: S; save: Save }) {
  const upd = (i: number, patch: Partial<S['work'][number]>) => save((x) => applySchedule({ ...x, work: x.work.map((w, j) => (j === i ? { ...w, ...patch } : w)) }))
  const flex = (patch: Partial<S['flex']>) => save((x) => ({ ...x, flex: { ...x.flex, ...patch } }))
  const others = s.work.filter((w, i) => i !== 4 && w.isWorkDay).map((w) => w.durationMin)
  const friday = s.work[4]!
  return (
    <Page className="settings-page" title="Arbeit & Gleitzeit" back="/einstellungen">
      <Section title="Gleitzeit">
        <Card className="space-y-4">
          <SettingRow label="Spätester Beginn">
            {s.flex.latestStart !== null ? (
              <>
                <TimeField label="Spätester Arbeitsbeginn" value={s.flex.latestStart} onChange={(v) => flex({ latestStart: v })} />
                <Button size="sm" variant="ghost" onClick={() => flex({ latestStart: null })}>
                  Aus
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => flex({ latestStart: 9 * 60 })}>
                Festlegen
              </Button>
            )}
          </SettingRow>
          <p className="text-sm text-muted">Eine Grenze, kein Ziel. Ein Kundentermin kann früher liegen. Sie zählt für den Beginn am Arbeitsort oder im Homeoffice.</p>
          <SettingRow label={<span>Arbeit, Pause und Feierabend auf der Startseite</span>}>
            <Toggle label="Zeiten erfassen anbieten" checked={s.flex.tracking} onChange={(v) => flex({ tracking: v })} />
          </SettingRow>
          <SettingRow label={<span>Hinweise zu Pausen, Ruhezeit und Sonntag</span>}>
            <Toggle label="Hinweise zu Pausen und Ruhezeit" checked={s.flex.legalHints} onChange={(v) => flex({ legalHints: v })} />
          </SettingRow>
          <label className="block space-y-1">
            <span>Nachricht, wenn es später wird</span>
            <TextInput aria-label="Nachricht, wenn es später wird" value={s.flex.lateMessage} onChange={(e) => flex({ lateMessage: e.target.value })} />
          </label>
          <p className="text-sm text-muted">Die Nachricht kopierst du nur, Anker sendet nichts. Anker ist eine Planungshilfe, keine offizielle Zeiterfassung. Bezahlung und Ausgleich regelt dein Arbeitgeber.</p>
          <p className="text-sm text-muted">Pausen- und Ruhehinweise sind allgemeine Orientierung. Betriebliche Ausnahmen und die aktuelle Rechtslage musst du selbst prüfen; ein Hinweis erteilt keine Freigabe für Arbeit.</p>
        </Card>
      </Section>
      <Section title="Nach Feierabend">
        <Card className="space-y-3">
          <SettingRow label={<span>Arbeitsaufgaben nach Feierabend ruhigstellen</span>}>
            <Toggle label="Arbeitsaufgaben nach Feierabend ruhigstellen" checked={s.support.workAfterHoursQuiet} onChange={(v) => save((x) => ({ ...x, support: { ...x.support, workAfterHoursQuiet: v } }))} />
          </SettingRow>
          <p className="text-sm text-muted">Auf der Startseite haben Abend und Erholung Vorrang. Arbeitsaufgaben bleiben unter Arbeit erreichbar; Fristmeldungen bleiben unverändert. Laufende Arbeit wird dadurch nicht beendet.</p>
        </Card>
      </Section>
      {friday.isWorkDay && others.length > 0 && friday.durationMin >= Math.min(...others) && <p className="px-1 text-muted">Ist dein Freitag kürzer? Trag unten dein echtes Soll ein. Anker rät keinen Wert.</p>}
      <p className="px-1 text-muted">Die Aufstehzeit richtet sich nach dem frühesten Wunsch-Beginn.</p>
      {s.work.map((w, i) => (
        <Card key={i} className="space-y-3">
          <SettingRow label={<span className="text-lg font-medium">{WEEKDAYS_LONG[i]}</span>}>
            <Toggle label={`${WEEKDAYS_LONG[i]} Arbeitstag`} checked={w.isWorkDay} onChange={(v) => upd(i, { isWorkDay: v })} />
          </SettingRow>
          {w.isWorkDay && (
            <>
              <SettingRow label={<span>Wunsch-Beginn</span>}>
                <TimeField label="Arbeitsbeginn" value={w.start} onChange={(v) => upd(i, { start: v })} />
              </SettingRow>
              <SettingRow label={<span>Soll netto, ohne Pause</span>}>
                <Stepper label="Arbeitsdauer" value={w.durationMin / 60} step={0.25} min={0.25} max={12} unit="h" onChange={(v) => upd(i, { durationMin: Math.round(v * 60) })} />
              </SettingRow>
              <SettingRow label={<span>Übliche Pause</span>}>
                <Stepper label="Pause" value={w.pauseMin} step={5} min={0} max={180} onChange={(v) => upd(i, { pauseMin: v })} />
              </SettingRow>
              <p className="text-sm text-muted">Feierabend etwa {fmtTime(w.start + w.durationMin + w.pauseMin)}</p>
              <SettingRow label={<span>Homeoffice</span>}>
                <Toggle label="Homeoffice" checked={w.homeOffice} onChange={(v) => upd(i, { homeOffice: v })} />
              </SettingRow>
              <details className="space-y-3">
                <summary className="min-h-11 py-2 text-muted">Weitere Wochenwerte</summary>
                <label className="block space-y-1"><span>Spätester Beginn an diesem Wochentag</span><select aria-label={`${WEEKDAYS_LONG[i]} Startgrenze`} value={w.latestStart === undefined ? 'inherit' : w.latestStart === null ? 'off' : 'custom'} onChange={(event) => upd(i, { latestStart: event.target.value === 'inherit' ? undefined : event.target.value === 'off' ? null : s.flex.latestStart ?? w.start })} className="min-h-12 w-full rounded-xl bg-surface-2 px-3"><option value="inherit">Global</option><option value="off">Keine</option><option value="custom">Eigene</option></select></label>
                <p className="text-sm text-muted">Global übernimmt deine allgemeine Grenze. Keine lässt diesen Tag ohne Startgrenze; Eigene verwendet die Uhrzeit unten.</p>
                {typeof w.latestStart === 'number' && <SettingRow label="Eigene Startgrenze"><TimeField label={`${WEEKDAYS_LONG[i]} spätester Beginn`} value={w.latestStart} onChange={(value) => upd(i, { latestStart: value })} /></SettingRow>}
                <SettingRow label={<span>Freiwilliger Feierabendwunsch</span>}>
                  <Toggle label={`${WEEKDAYS_LONG[i]} Feierabendwunsch`} checked={w.endPreference !== undefined} onChange={(enabled) => upd(i, { endPreference: enabled ? w.start + w.durationMin + w.pauseMin : undefined })} />
                </SettingRow>
                {w.endPreference !== undefined && <SettingRow label="Gewünschter Feierabend"><TimeField label={`${WEEKDAYS_LONG[i]} Feierabendwunsch Uhrzeit`} value={w.endPreference} onChange={(value) => upd(i, { endPreference: value })} /></SettingRow>}
                <p className="text-sm text-muted">Der Endwunsch ist vom Nettoziel getrennt. Tatsächlich gearbeitete Zeit entsteht nur durch deine Erfassung; Tagesänderungen überschreiben nicht diese Wochenwerte.</p>
              </details>
            </>
          )}
        </Card>
      ))}
    </Page>
  )
}

function Commute({ s, save }: { s: S; save: Save }) {
  const c = s.commute
  const set = (patch: Partial<S['commute']>) => save((x) => applySchedule({ ...x, commute: { ...x.commute, ...patch } }))
  return (
    <Page className="settings-page" title="Arbeitsweg" back="/einstellungen">
      <Card className="space-y-4">
        <SettingRow label={<span>Dauer</span>}>
          <Stepper label="Fahrzeit" value={c.minutes} max={180} onChange={(v) => set({ minutes: v })} />
        </SettingRow>
        <SettingRow label={<span>Puffer</span>}>
          <Stepper label="Puffer" value={c.bufferMin} max={60} onChange={(v) => set({ bufferMin: v })} />
        </SettingRow>
        <Segmented<CommuteMode>
          label="Verkehrsmittel"
          value={c.mode}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'oepnv', label: 'Bus & Bahn' },
            { value: 'rad', label: 'Rad' },
            { value: 'fuss', label: 'Zu Fuß' },
          ]}
          onChange={(v) => set({ mode: v })}
        />
      </Card>
      <p className="px-1 text-muted">Homeoffice spontan? Auf der Startseite oben „Arbeitstag ▾“ tippen.</p>
    </Page>
  )
}

function Sleep({ s, save }: { s: S; save: Save }) {
  const sug = deriveSchedule(s)
  const manual = s.anchor.manual ?? {}
  const setSleep =(patch: Partial<S['sleep']>) => save((x) => applySchedule({ ...x, sleep: { ...x.sleep, ...patch } }))
  return (
    <Page className="settings-page" title="Schlaf & Anker" back="/einstellungen">
      <p className="px-1 text-sm text-muted">Tippe eine Uhrzeit oder Zahl direkt an, um sie einzugeben. Plus und Minus ändern sie in kleinen Schritten. Dauern werden beim Verlassen des Feldes übernommen.</p>
      <Card className="space-y-4">
        <SettingRow label={<span>Schlafbedarf</span>}>
          <Stepper label="Schlafbedarf" value={s.sleep.needMin / 60} step={0.5} min={5} max={10} unit="h" onChange={(v) => setSleep({ needMin: Math.round(v * 60) })} />
        </SettingRow>
        <SettingRow label={<span>Einschlafzeit</span>}>
          <Stepper label="Einschlafzeit" value={s.sleep.fallAsleepMin} max={60} onChange={(v) => setSleep({ fallAsleepMin: v })} />
        </SettingRow>
        <p className="text-sm text-muted">Deine geschätzte Einschlafzeit fließt in den Bettzeit-Vorschlag ein. Der stumme Schlafhinweis nutzt diese Dauer erst, wenn du ihn selbst startest.</p>
        <SettingRow label={<span>Bildschirm aus vor dem Bett</span>}>
          <Stepper label="Bildschirm aus" value={s.sleep.screenOffMin} max={120} onChange={(v) => setSleep({ screenOffMin: v })} />
        </SettingRow>
        <p className="text-sm text-muted">Vorschlag: PC-Stopp so viele Minuten vor dem Bett. {manual.pcStop ? 'Dein von Hand gesetzter PC-Stopp bleibt dabei erhalten.' : 'Dein automatisch berechneter PC-Stopp passt sich an.'} Anker schaltet damit weder den Handybildschirm noch den PC automatisch aus.</p>
        <p className="text-sm text-muted">Geplante Ruhe vor dem Bett: {s.support.windDown.enabled ? `zum Beispiel deine gewählte Tätigkeit „${s.support.windDown.activity}“.` : 'zum Beispiel ein ruhiges Hörbuch oder Lesen.'}</p>
        {s.support.windDown.enabled && <p className="text-sm text-muted">Dein Abendübergang um {fmtTime(s.support.windDown.at)} ersetzt die PC-Stopp- und Bett-Erinnerungen durch einen Hinweis. Deine geplanten Zeiten bleiben bestehen; der Sperrbildschirm zeigt nur einen allgemeinen Text.</p>}
        <Row label="Sanften Abendübergang einstellen" sub="Eigene ruhige Tätigkeit und Hinweiszeit" to="/einstellungen/abenduebergang" />
      </Card>
      <Card className="space-y-4">
        <SettingRow label={<span className="font-medium">Aufstehen (jeden Tag)</span>}>
          <TimeStepper label="Aufstehzeit" value={s.anchor.wake} onChange={(v) => save((x) => ({ ...x, anchor: { ...x.anchor, wake: v, manual: { ...x.anchor.manual, wake: true } } }))} />
        </SettingRow>
        <p className="-mt-2 text-sm text-muted">{manual.wake ? 'Von dir gesetzt, bleibt so.' : 'Automatisch berechnet.'}</p>
        <SettingRow label={<span>PC-Stopp</span>}>
          <TimeStepper label="PC-Stopp" night value={s.pcStop} onChange={(v) => save((x) => ({ ...x, pcStop: v, anchor: { ...x.anchor, manual: { ...x.anchor.manual, pcStop: true } } }))} />
        </SettingRow>
        <p className="-mt-2 text-sm text-muted">{manual.pcStop ? 'Von dir gesetzt, bleibt so.' : 'Automatisch berechnet.'}</p>
        <SettingRow label={<span>Bett</span>}>
          <TimeStepper label="Bettzeit" night value={s.bed} onChange={(v) => save((x) => ({ ...x, bed: v, anchor: { ...x.anchor, manual: { ...x.anchor.manual, bed: true } } }))} />
        </SettingRow>
        <p className="-mt-2 text-sm text-muted">{manual.bed ? 'Von dir gesetzt, bleibt so.' : 'Automatisch berechnet.'}</p>
        <Button size="sm" onClick={() => save((x) => resetToSuggested(x))}>
          Vorschlag übernehmen ({fmtTime(sug.wake)} / {fmtTime(sug.pcStop)} / {fmtTime(sug.bed)})
        </Button>
      </Card>
      <Card className="space-y-4">
        <SettingRow label={<span>Toleranz Aufstehen</span>}>
          <Stepper label="Toleranz Aufstehen" value={s.anchor.wakeToleranceMin} max={60} onChange={(v) => save((x) => ({ ...x, anchor: { ...x.anchor, wakeToleranceMin: v } }))} />
        </SettingRow>
        <SettingRow label={<span>Toleranz Wochenende</span>}>
          <Stepper label="Toleranz Wochenende" value={s.anchor.weekendToleranceMin} step={15} max={180} onChange={(v) => save((x) => ({ ...x, anchor: { ...x.anchor, weekendToleranceMin: v } }))} />
        </SettingRow>
        <SettingRow label={<span>Bonus „früh im Bett“ bis</span>}>
          <TimeField label="Bonus bis" value={s.bedBonusLatest} onChange={(v) => save((x) => ({ ...x, bedBonusLatest: v < 720 ? v + 1440 : v }))} />
        </SettingRow>
      </Card>
    </Page>
  )
}

function Sport({ s, save }: { s: S; save: Save }) {
  const set = (patch: Partial<S['sport']>) => save((x) => applySchedule({ ...x, sport: { ...x.sport, ...patch } }))
  return (
    <Page className="settings-page" title="Sport" back="/einstellungen">
      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2" aria-label="Sporttage">
          {WEEKDAYS.map((d, i) => (
            <button key={d} type="button" aria-pressed={s.sport.days[i]} onClick={() => set({ days: s.sport.days.map((x, j) => (j === i ? !x : x)) })} className={`h-11 w-11 rounded-xl ${s.sport.days[i] ? 'bg-accent font-semibold text-accent-ink' : 'bg-surface-2'}`}>
              {d}
            </button>
          ))}
        </div>
        <Segmented<SportKind>
          label="Art"
          value={s.sport.kind}
          options={[
            { value: 'home', label: 'Zu Hause' },
            { value: 'gym', label: 'Fitnessstudio' },
            { value: 'run', label: 'Laufen' },
          ]}
          onChange={(v) => set({ kind: v })}
        />
        <Segmented<'morning' | 'afterWork'>
          label="Zeitpunkt"
          value={s.sport.time}
          options={[
            { value: 'morning', label: 'Morgens' },
            { value: 'afterWork', label: 'Nach der Arbeit' },
          ]}
          onChange={(v) => set({ time: v })}
        />
        <SettingRow label={<span>Dauer</span>}>
          <Stepper label="Dauer" value={s.sport.durationMin} min={5} max={180} onChange={(v) => set({ durationMin: v })} />
        </SettingRow>
        {s.sport.kind === 'gym' && (
          <SettingRow label={<span>Weg zum Studio</span>}>
            <Stepper label="Weg zum Studio" value={s.sport.gymWayMin} max={60} onChange={(v) => set({ gymWayMin: v })} />
          </SettingRow>
        )}
      </Card>
      <p className="px-1 text-muted">Tipp: Anfangs kurz zu Hause, später Fitnessstudio. Mit Health Connect wird Training automatisch abgehakt (Einrichtungs-Check).</p>
    </Page>
  )
}

function Evenings({ s, save }: { s: S; save: Save }) {
  const keys = Object.keys(EVENING_LABELS) as EveningPlan[]
  return (
    <Page className="settings-page" title="Abendpläne" back="/einstellungen">
      <p className="px-1 text-muted">Standard pro Tag. Für heute spontan änderbar auf der Startseite.</p>
      {s.evenings.map((e, i) => (
        <Card key={i} className="space-y-2">
          <span className="font-medium">{WEEKDAYS_LONG[i]}</span>
          <Segmented label={`Abend ${WEEKDAYS_LONG[i]}`} value={e} options={keys.map((k) => ({ value: k, label: EVENING_LABELS[k] }))} onChange={(v) => save((x) => ({ ...x, evenings: x.evenings.map((y, j) => (j === i ? v : y)) }))} />
        </Card>
      ))}
      <Section title="Dauer">
        <Card className="space-y-3">
          {keys.map((k) => (
            <SettingRow key={k} label={<span>{EVENING_LABELS[k]}</span>}>
              <Stepper label={`Dauer ${EVENING_LABELS[k]}`} value={s.eveningDurations[k]} step={15} min={15} max={360} onChange={(v) => save((x) => ({ ...x, eveningDurations: { ...x.eveningDurations, [k]: v } }))} />
            </SettingRow>
          ))}
        </Card>
      </Section>
      <Section title="Vorkoch-Tag">
        <Segmented label="Vorkoch-Tag" value={s.prepDay} options={WEEKDAYS.map((d, i) => ({ value: i, label: d }))} onChange={(v) => save((x) => ({ ...x, prepDay: v }))} />
      </Section>
    </Page>
  )
}

function RoutineEditor({ s, save, r }: { s: S; save: (fn: (s: S) => S) => Promise<void>; r: RoutineId }) {
  const steps = s.routines[r]
  const [error, setError] = useState('')
  // Erst in der bestehenden Schreibwarteschlange auf den aktuellen Schritten arbeiten.
  // Ein Drag-Schnappschuss darf keine neueren Texte/Zeilen zurücksetzen.
  const set = (update: (current: RoutineStep[]) => RoutineStep[]) => save((x) => {
    const next = { ...x, routines: { ...x.routines, [r]: update(x.routines[r]) } }
    return r === 'morning' ? applySchedule(next) : next
  })
  const edit = (update: (current: RoutineStep[]) => RoutineStep[]) => {
    setError('')
    void set(update).catch(() => setError('Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.'))
  }
  const upd = (id: string, patch: Partial<RoutineStep>) => edit((current) => current.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const move = async (sourceId: string, targetId: string): Promise<MoveResult> => {
    let result: MoveResult = null
    await set((current) => {
      const next = moveById(current, sourceId, targetId)
      if (next !== current) result = { from: current.findIndex((step) => step.id === sourceId), to: current.findIndex((step) => step.id === targetId) }
      return next
    })
    return result
  }
  return (
    <Page className="settings-page" title={r === 'morning' ? 'Morgenroutine' : 'Abendroutine'} back="/einstellungen">
      <p className="px-1 text-muted">
        {fmtDuration(sumMinutes(steps))} · Am Griff ⋮⋮ halten und ziehen oder mit ▲/▼ sortieren. Die Minimal-Version zählt genauso.
      </p>
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      <div className="settings-routine-list"><SortableList
        items={steps}
        onMove={move}
        render={(x) => (
          <div className="space-y-2 py-1">
            <TextInput aria-label="Schritt" value={x.title} onChange={(e) => upd(x.id, { title: e.target.value })} />
            <SettingRow label="Dauer">
              <Stepper label="Dauer" value={x.minutes} step={1} min={1} max={120} onChange={(v) => upd(x.id, { minutes: v })} />
            </SettingRow>
            <div className="flex justify-end">
              <button type="button" className="min-h-10 px-2 text-sm text-muted" onClick={() => edit((current) => current.filter((y) => y.id !== x.id))}>
                Entfernen
              </button>
            </div>
            <TextInput aria-label="Minimal-Version" placeholder="Minimal-Version, z. B. 1 Liegestütz" value={x.minimal?.title ?? ''} onChange={(e) => {
              const title = e.target.value
              edit((current) => current.map((step) => step.id === x.id ? { ...step, minimal: title ? { title, minutes: step.minimal?.minutes ?? 1 } : undefined } : step))
            }} />
          </div>
        )}
      /></div>
      <Button className="w-full" onClick={() => {
        const step = { id: randomId(8), title: 'Neuer Schritt', minutes: 5 }
        edit((current) => [...current, step])
      }}>
        + Schritt hinzufügen
      </Button>
    </Page>
  )
}

function Reminders({ s, save }: { s: S; save: Save }) {
  const r = s.reminders
  const set = (patch: Partial<S['reminders']>) => save((x) => ({ ...x, reminders: { ...x.reminders, ...patch } }))
  return (
    <Page className="settings-page" title="Erinnerungen" back="/einstellungen">
      <Card className="space-y-3">
        <Segmented<ReminderIntensity>
          label="Intensität"
          value={r.intensity}
          options={[
            { value: 'gentle', label: 'Sanft' },
            { value: 'normal', label: 'Normal' },
            { value: 'persistent', label: 'Hartnäckig' },
          ]}
          onChange={(v) => set({ intensity: v })}
        />
        <p className="text-sm text-muted">
          {r.intensity === 'gentle' && 'Eine Erinnerung, ganz leise.'}
          {r.intensity === 'normal' && 'Erinnerung, nach ein paar Minuten noch einmal.'}
          {r.intensity === 'persistent' && 'Erinnerung, Wiederholung, dann mit Ton und Vibration, bis du bestätigst.'}
        </p>
        <SettingRow label={<span>Wiederholen nach</span>}>
          <Stepper label="Wiederholen nach" value={r.repeatAfterMin} step={1} min={2} max={30} onChange={(v) => set({ repeatAfterMin: v })} />
        </SettingRow>
      </Card>
      <Card className="space-y-3">
        <p className="font-medium">Ruhezeiten</p>
        <SettingRow label={<span>Von</span>}>
          <TimeField label="Ruhezeit von" value={r.quietStart} onChange={(v) => set({ quietStart: v })} />
        </SettingRow>
        <SettingRow label={<span>Bis</span>}>
          <TimeField label="Ruhezeit bis" value={r.quietEnd} onChange={(v) => set({ quietEnd: v })} />
        </SettingRow>
        <p className="text-sm text-muted">Harte Zeiten (Losgehen, PC-Stopp, Bett) kommen trotzdem.</p>
      </Card>
    </Page>
  )
}

function EveningMode({ s, save }: { s: S; save: Save }) {
  const preset = s.support.eveningPreset
  const setPreset = (patch: Partial<typeof preset>) => save((x) => ({ ...x, support: { ...x.support, eveningPreset: { ...x.support.eveningPreset, ...patch } } }))
  return (
    <Page className="settings-page" title="Abendmodus" back="/einstellungen">
      <Section hint="Nur ein Vorschlag auf der Startseite. Du entscheidest mit einem Tipp.">
        <Card className="space-y-3">
          <SettingRow label={<span>Abends vorschlagen</span>}>
            <Toggle label="Abendmodus vorschlagen" checked={preset.enabled} onChange={(v) => setPreset({ enabled: v })} />
          </SettingRow>
          {preset.enabled && (
            <SettingRow label={<span>Ab</span>}>
              <TimeField label="Abendmodus ab" value={preset.from} onChange={(v) => setPreset({ from: v })} />
            </SettingRow>
          )}
        </Card>
      </Section>
    </Page>
  )
}

/** Alles hier ist freiwillig und aus, bis du es einschaltest (außer dem Spiel, das schon da war). */
function Supports({ s, save }: { s: S; save: Save }) {
  const f = s.focus
  const setFocus = (patch: Partial<S['focus']>) => save((x) => ({ ...x, focus: { ...x.focus, ...patch } }))
  const sup = s.support
  const setSup = (patch: Partial<S['support']>) => save((x) => ({ ...x, support: { ...x.support, ...patch } }))
  const [eveningChoice, setEveningChoice] = useState('')
  const [morningChoice, setMorningChoice] = useState('')
  const eveningStep = s.routines.evening.find((step) => step.id === eveningChoice) ?? s.routines.evening[0]
  const morningStep = s.routines.morning.find((step) => step.id === morningChoice) ?? s.routines.morning[0]
  return (
    <Page className="settings-page" title="Alltagshilfen" back="/einstellungen">
      <ExtraControls />
      <Section title="Fokus-Puls" hint="Läuft nur, solange der Fokus-Modus offen ist, und nie in den Ruhezeiten.">
        <Card className="space-y-3">
          <Segmented<S['focus']['pulse']>
            label="Fokus-Puls"
            value={f.pulse}
            options={[
              { value: 'off', label: 'Aus' },
              { value: 'gentle', label: 'Sanft' },
              { value: 'strong', label: 'Deutlich' },
            ]}
            onChange={(v) => setFocus({ pulse: v })}
          />
          {(f.pulse !== 'off' || s.extras?.spokenCues) && (
            <>
              <Segmented<number>
                label="Abstand"
                value={f.everyMin}
                options={[
                  { value: 2, label: 'Alle 2 Minuten' },
                  { value: 5, label: 'Alle 5 Minuten' },
                ]}
                onChange={(v) => setFocus({ everyMin: v as 2 | 5 })}
              />
              <SettingRow label={<span>Zur Hälfte des Schritts</span>}>
                <Toggle label="Zur Hälfte" checked={f.halfway} onChange={(v) => setFocus({ halfway: v })} />
              </SettingRow>
              <SettingRow label={<span>Eine Minute vor Ende</span>}>
                <Toggle label="Eine Minute vor Ende" checked={f.lastMinute} onChange={(v) => setFocus({ lastMinute: v })} />
              </SettingRow>
            </>
          )}
        </Card>
      </Section>
      <Section title="Ankommen nach der Arbeit" hint="Zwei bis drei kurze Schritte, bevor der Abend beginnt.">
        <Card className="space-y-3">
          <SettingRow label={<span>Einschalten</span>}>
            <Toggle label="Ankommen" checked={sup.arrival.enabled} onChange={(v) => setSup({ arrival: { ...sup.arrival, enabled: v } })} />
          </SettingRow>
          {sup.arrival.enabled &&
            sup.arrival.steps.map((step, i) => (
              <TextInput key={i} aria-label={`Schritt ${i + 1}`} value={step} onChange={(e) => setSup({ arrival: { ...sup.arrival, steps: sup.arrival.steps.map((x, j) => (j === i ? e.target.value : x)) } })} />
            ))}
        </Card>
      </Section>
      <Section title="Wege und Übergänge" hint="Das sind echte Minuten: Parkplatz, Schuhe, Laptop-Start.">
        <Card className="space-y-3">
          <SettingRow label={<span>Ankunftspuffer</span>}>
            <Stepper label="Ankunftspuffer" value={s.travel.arrivalBufferMin} max={60} onChange={(v) => save((x) => ({ ...x, travel: { ...x.travel, arrivalBufferMin: v } }))} />
          </SettingRow>
          <SettingRow label={<span>Fertig machen vor Terminen</span>}>
            <Stepper label="Fertig machen" value={s.travel.prepMin} max={120} onChange={(v) => save((x) => ({ ...x, travel: { ...x.travel, prepMin: v } }))} />
          </SettingRow>
          <SettingRow label={<span>Rechnerstart im Homeoffice</span>}>
            <Stepper label="Rechnerstart" value={s.travel.homeOfficeStartupMin} max={60} onChange={(v) => save((x) => ({ ...x, travel: { ...x.travel, homeOfficeStartupMin: v } }))} />
          </SettingRow>
          <SettingRow label={<span>Wach werden</span>}>
            <Stepper label="Wach werden" value={s.travel.activationMin} max={60} onChange={(v) => save((x) => ({ ...x, travel: { ...x.travel, activationMin: v } }))} />
          </SettingRow>
        </Card>
      </Section>
      <Section title="Abends schon erledigt" hint="Nur was du hier setzt, gilt. Der Morgenschritt entfällt dann, zählt dort aber nicht als erledigt.">
        <Card className="space-y-2">
          {s.routineLinks.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1">
                {s.routines.evening.find((x) => x.id === l.eveningStepId)?.title ?? l.eveningStepId} → {s.routines.morning.find((x) => x.id === l.morningStepId)?.title ?? l.morningStepId}
              </span>
              <Button size="sm" variant="ghost" onClick={() => save((x) => ({ ...x, routineLinks: x.routineLinks.filter((_, j) => j !== i) }))}>
                Entfernen
              </Button>
            </div>
          ))}
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              const eveningStepId = String(f.get('evening'))
              const morningStepId = String(f.get('morning'))
              if (eveningStepId && morningStepId) save((x) => ({ ...x, routineLinks: [...x.routineLinks, { eveningStepId, morningStepId }] }))
            }}
          >
            <select name="evening" aria-label="Abendschritt" value={eveningStep?.id ?? ''} onChange={(event) => setEveningChoice(event.target.value)} className="min-h-12 w-full rounded-xl bg-surface-2 px-3">
              {s.routines.evening.map((x, index) => (
                <option key={x.id} value={x.id}>
                  {index + 1}. Schritt
                </option>
              ))}
            </select>
            <p className="text-sm text-muted">Abends: {eveningStep?.title ?? 'Kein Schritt vorhanden'}</p>
            <select name="morning" aria-label="Morgenschritt" value={morningStep?.id ?? ''} onChange={(event) => setMorningChoice(event.target.value)} className="min-h-12 w-full rounded-xl bg-surface-2 px-3">
              {s.routines.morning.map((x, index) => (
                <option key={x.id} value={x.id}>
                  {index + 1}. Schritt
                </option>
              ))}
            </select>
            <p className="text-sm text-muted">Morgens nicht nötig: {morningStep?.title ?? 'Kein Schritt vorhanden'}</p>
            <Button type="submit" size="sm">
              Regel hinzufügen
            </Button>
          </form>
        </Card>
      </Section>
      <Section title="Wetter" hint="Freiwillig, mit lokalem Wetterort und eigenen Kleidungsvorlieben.">
        <WeatherSettings s={s} save={save} />
      </Section>
      <Section title="Rückfrage und Homeoffice">
        <Card className="space-y-3">
          <SettingRow label={<span>Beim Verschieben nach dem Grund fragen</span>}>
            <Toggle label="Nach dem Grund fragen" checked={s.askReason} onChange={(v) => save((x) => ({ ...x, askReason: v }))} />
          </SettingRow>
          <TextInput aria-label="Homeoffice-Vorlage" value={s.homeOfficeMessage} onChange={(e) => save((x) => ({ ...x, homeOfficeMessage: e.target.value }))} />
        </Card>
      </Section>
      <Section title="Spiel" hint="XP zählen im Hintergrund weiter und sind beim Einschalten wieder da.">
        <Card className="flex items-center justify-between">
          <span>Spiel und Level anzeigen</span>
          <Toggle label="Spiel anzeigen" checked={sup.gameVisible} onChange={(v) => setSup({ gameVisible: v })} />
        </Card>
      </Section>
    </Page>
  )
}

function Look({ s, save }: { s: S; save: Save }) {
  return (
    <Page className="settings-page" title="Darstellung" back="/einstellungen">
      <Card className="space-y-4">
        <SettingRow label={<span>Dunkles Design</span>}>
          <Toggle label="Dunkles Design" checked={s.appearance.dark} onChange={(v) => save((x) => ({ ...x, appearance: { ...x.appearance, dark: v } }))} />
        </SettingRow>
        <SettingRow label={<span>Schriftgröße</span>}>
          <Stepper label="Schriftgröße" value={Math.round(s.appearance.fontScale * 100)} step={10} min={80} max={160} unit="%" onChange={(v) => save((x) => ({ ...x, appearance: { ...x.appearance, fontScale: v / 100 } }))} />
        </SettingRow>
      </Card>
      <Section title="Thema">
        <div className="grid grid-cols-2 gap-2">
          {THEME_LIST.map((t) => (
            <button key={t.id} type="button" aria-pressed={s.themeId === t.id} onClick={() => save((x) => ({ ...x, themeId: t.id as ThemeId }))} className={`min-h-20 rounded-2xl p-3 text-left ${s.themeId === t.id ? 'bg-accent text-accent-ink' : 'bg-surface'}`}>
              <div className="text-xl">{t.emoji}</div>
              <div className="font-semibold">{t.name}</div>
            </button>
          ))}
        </div>
      </Section>
    </Page>
  )
}

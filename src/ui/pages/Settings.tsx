import { Navigate, useLocation, useParams } from 'react-router'
import { useEffect, useState } from 'react'
import { applySchedule, deriveSchedule, EVENING_LABELS, randomId, resetToSuggested, sumMinutes } from '../../core/defaults'
import { THEME_LIST } from '../../core/game'
import { fmtTime, WEEKDAYS, WEEKDAYS_LONG } from '../../core/time'
import { plural } from '../../core/uiText'
import { moveById } from '../../core/sortable'
import type { CommuteMode, EveningPlan, ReminderIntensity, RoutineId, RoutineStep, Settings as S, SportKind, ThemeId } from '../../core/types'
import { WeatherSettings } from '../components/WeatherSettings'
import { useApp } from '../../state/store'
import { SortableList, type MoveResult } from '../components/Sortable'
import { WindDownFields } from './WindDown'
import GuidanceSettings, { MorningLightSuggestion } from './GuidanceSettings'
import { guidancePreferences } from '../../core/guidance'
import { ExtraControls } from '../components/ExtraControls'
import { HealthSleepSettings } from '../components/HealthSleepSettings'
import { Button, Card, Checkbox, Choice, MoreInfo, notifySaved, Page, Row, Section, SettingRow, Segmented, Stepper, TextInput, TimeField, TimeStepper, Toggle } from '../components/ui'

type Save = (fn: (s: S) => S) => void

export default function Settings() {
  const { section } = useParams()
  const st = useApp()
  const s = st.settings
  const save: Save = (fn) => { void st.saveSettings(fn).then(notifySaved).catch(() => st.showToast('Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.')) }

  switch (section) {
    case 'begleitung': return <GuidanceSettings />
    case 'arbeit':
      return <Work s={s} save={save} />
    case 'weg':
      return <Commute s={s} save={save} />
    case 'schlaf':
      return <Sleep s={s} save={save} />
    case 'sport':
      return <Sport s={s} save={save} />
    case 'abende': return <Navigate to="/einstellungen/abend#plaene" replace />
    case 'abendmodus': return <Navigate to="/einstellungen/abend#modus" replace />
    case 'abend': return <EveningSettings s={s} save={save} />
    case 'morgenroutine': return <Navigate to="/einstellungen/routinen#morning" replace />
    case 'abendroutine': return <Navigate to="/einstellungen/routinen#evening" replace />
    case 'routinen': return <Routines s={s} />
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

      <Section title="Planung">
        <Row label="Arbeit & Gleitzeit" sub={`${plural(s.work.filter((w) => w.isWorkDay).length, 'Tag', 'Tage')} · ab ${fmtTime(s.work.find((w) => w.isWorkDay)?.start ?? 480)}`} to="/einstellungen/arbeit" />
        <Row label="Arbeitsweg" sub={`${s.commute.minutes} min + ${s.commute.bufferMin} min Puffer`} to="/einstellungen/weg" />
        <Row label="Abend & Morgen begleiten" sub="Zeitfarben, kleine Morgenroutine und bewusster Abendabschluss" to="/einstellungen/begleitung" />
        <Row label="Schlaf & Anker" sub={`Aufstehen ${fmtTime(s.anchor.wake)} · Bett ${fmtTime(s.bed)}`} to="/einstellungen/schlaf" />
        <Row label="Abend" sub="Abendpläne, ruhiger Übergang und Abendmodus" to="/einstellungen/abend" />
        <Row label="Routinen" sub="Morgen- und Abendroutine bearbeiten" to="/einstellungen/routinen" />
        <Row label="Sport" to="/einstellungen/sport" />
      </Section>
      {sug.wake !== s.anchor.wake && <p className="px-1 text-sm text-muted">Rechnerischer Vorschlag zum Aufstehen: {fmtTime(sug.wake)}.</p>}
      <Section title="App">
        <Row label="Erinnerungen" to="/einstellungen/erinnerungen" />
        <Row label="Alltagshilfen" sub="Fokus-Puls, Ankommen und lokale Sprache" to="/einstellungen/hilfen" />
        <Row label="Darstellung & Thema" to="/einstellungen/darstellung" />
        <Row label="Optionale Vorschläge" sub="KI und Verkehr bewusst freigeben" to="/einstellungen/assistenz" />
      </Section>
      <Section title="Einrichtung & Daten">
        <Row label="Einrichtungs-Check" to="/check" />
        <Row label="Sicherung" to="/backup" />
        <Row label="Weckerverlauf & Diagnose" sub="Log ansehen und ausgewählte Angaben exportieren" to="/diagnose" />
        <Row label="Kalender & Sync" to="/verbindungen" />
        <Row label="Druckansicht" to="/druck" />
        <Row label="Hilfe & Anlaufstellen" to="/hilfe" />
      </Section>
      <Section title="Zusätzliche Werkzeuge">
        <SettingRow label="Test- und Entwicklerwerkzeuge anzeigen"><Toggle label="Test- und Entwicklerwerkzeuge anzeigen" checked={!!s.appearance.developerTools} onChange={(value) => save((current) => ({ ...current, appearance: { ...current.appearance, developerTools: value } }))} /></SettingRow>
        {s.appearance.developerTools && <><Row label="Gemeinsam testen" to="/geraetetest" /><Row label="Zeitübersicht" to="/zeiten" /></>}
      </Section>
    </Page>
  )
}

function Work({ s, save }: { s: S; save: Save }) {
  const first = s.work[0]!
  const [sameWeekdays, setSameWeekdays] = useState(() => s.work.slice(0, 5).every((day) => JSON.stringify(day) === JSON.stringify(first)))
  const upd = (i: number, patch: Partial<S['work'][number]>) => save((current) => applySchedule({ ...current, work: current.work.map((day, index) => (index === i || sameWeekdays && i === 0 && index < 5 ? { ...day, ...patch } : day)) }))
  const flex = (patch: Partial<S['flex']>) => save((current) => ({ ...current, flex: { ...current.flex, ...patch } }))
  const dayCard = (i: number, title: string = WEEKDAYS_LONG[i]!) => {
    const day = s.work[i]!
    return <Card key={i} className="space-y-3">
      <SettingRow label={<span className="font-medium">{title}</span>}><Toggle label={`${title} Arbeitstag`} checked={day.isWorkDay} onChange={(value) => upd(i, { isWorkDay: value })} /></SettingRow>
      {day.isWorkDay && <>
        <SettingRow label="Arbeitsbeginn"><TimeField label={`${title} Arbeitsbeginn`} value={day.start} onChange={(value) => upd(i, { start: value })} /></SettingRow>
        <SettingRow label="Soll ohne Pause"><Stepper label={`${title} Arbeitsdauer`} value={day.durationMin / 60} step={0.25} min={0.25} max={12} unit="h" onChange={(value) => upd(i, { durationMin: Math.round(value * 60) })} /></SettingRow>
        <SettingRow label="Übliche Pause"><Stepper label={`${title} Pause`} value={day.pauseMin} step={5} min={0} max={180} onChange={(value) => upd(i, { pauseMin: value })} /></SettingRow>
        <p className="text-sm text-muted">Feierabend etwa {fmtTime(day.start + day.durationMin + day.pauseMin)}</p>
        <SettingRow label="Homeoffice"><Toggle label={`${title} Homeoffice`} checked={day.homeOffice} onChange={(value) => upd(i, { homeOffice: value })} /></SettingRow>
        <MoreInfo summary="Weitere Wochenwerte">
          <Choice label={`${title} Startgrenze`} value={day.latestStart === undefined ? 'inherit' : day.latestStart === null ? 'off' : 'custom'} options={[{ value: 'inherit', label: 'Globale Grenze' }, { value: 'off', label: 'Keine Grenze' }, { value: 'custom', label: 'Eigene Uhrzeit' }]} onChange={(value) => upd(i, { latestStart: value === 'inherit' ? undefined : value === 'off' ? null : s.flex.latestStart ?? day.start })} />
          {typeof day.latestStart === 'number' && <SettingRow label="Eigene Startgrenze"><TimeField label={`${title} spätester Beginn`} value={day.latestStart} onChange={(value) => upd(i, { latestStart: value })} /></SettingRow>}
          <SettingRow label="Gewünschter Feierabend"><Toggle label={`${title} Feierabendwunsch`} checked={day.endPreference !== undefined} onChange={(value) => upd(i, { endPreference: value ? day.start + day.durationMin + day.pauseMin : undefined })} /></SettingRow>
          {day.endPreference !== undefined && <SettingRow label="Uhrzeit"><TimeField label={`${title} Feierabendwunsch Uhrzeit`} value={day.endPreference} onChange={(value) => upd(i, { endPreference: value })} /></SettingRow>}
          <p className="text-sm text-muted">Ein Wunsch verändert weder deine tatsächliche Arbeitszeit noch einzelne Tagesänderungen.</p>
        </MoreInfo>
      </>}
    </Card>
  }
  return <Page className="settings-page" title="Arbeit & Gleitzeit" back="/einstellungen">

    <SettingRow label="Alle Werktage gleich"><Toggle label="Alle Werktage gleich" checked={sameWeekdays} onChange={(value) => {
      if (!value) { setSameWeekdays(false); return }
      void useApp.getState().saveSettings((current) => applySchedule({ ...current, work: current.work.map((day, i) => i < 5 ? { ...current.work[0]! } : day) }))
        .then(() => { setSameWeekdays(true); notifySaved() })
        .catch(() => useApp.getState().showToast('Die Werktage konnten nicht gemeinsam gespeichert werden. Deine bisherigen Werte bleiben erhalten.'))
    }} /></SettingRow>
    <p className="text-sm text-muted">Gemeinsam bedeutet Montag bis Freitag. Beim Einschalten übernimmst du dafür die Werte vom Montag.</p>
    {sameWeekdays ? <>{dayCard(0, 'Montag bis Freitag')}<MoreInfo summary="Wochenende bearbeiten">{dayCard(5)}{dayCard(6)}</MoreInfo></> : s.work.map((_, i) => dayCard(i))}
    <Section title="Gleitzeit">
      <Card className="space-y-3">
        <SettingRow label="Spätester Beginn">{s.flex.latestStart !== null ? <><TimeField label="Spätester Arbeitsbeginn" value={s.flex.latestStart} onChange={(value) => flex({ latestStart: value })} /><Button size="sm" variant="ghost" onClick={() => flex({ latestStart: null })}>Aus</Button></> : <Button size="sm" onClick={() => flex({ latestStart: 540 })}>Festlegen</Button>}</SettingRow>
        <p className="text-sm text-muted">Eine Grenze, kein Ziel. Termine können früher beginnen.</p>
        <MoreInfo>
          <SettingRow label="Zeiterfassung auf Jetzt"><Toggle label="Zeiten erfassen anbieten" checked={s.flex.tracking} onChange={(value) => flex({ tracking: value })} /></SettingRow>
          <SettingRow label="Pausen- und Ruhehinweise"><Toggle label="Hinweise zu Pausen und Ruhezeit" checked={s.flex.legalHints} onChange={(value) => flex({ legalHints: value })} /></SettingRow>
          <label className="block space-y-1"><span>Nachricht, wenn es später wird</span><TextInput aria-label="Nachricht, wenn es später wird" value={s.flex.lateMessage} onChange={(event) => flex({ lateMessage: event.target.value })} /></label>
          <p className="text-sm text-muted">Du kopierst die Nachricht selbst; Anker sendet nichts. Anker ist eine Planungshilfe, keine offizielle Zeiterfassung. Bezahlung und Ausgleich regelt dein Arbeitgeber.</p>
          <p className="text-sm text-muted">Pausen- und Ruhehinweise sind allgemeine Orientierung. Betriebliche Ausnahmen und die aktuelle Rechtslage prüfst du selbst; ein Hinweis erteilt keine Freigabe für Arbeit.</p>
        </MoreInfo>
      </Card>
    </Section>
    <Section title="Nach Feierabend"><Card className="space-y-3">
      <SettingRow label="Arbeitsaufgaben nach Feierabend ruhigstellen"><Toggle label="Arbeitsaufgaben nach Feierabend ruhigstellen" checked={s.support.workAfterHoursQuiet} onChange={(value) => save((current) => ({ ...current, support: { ...current.support, workAfterHoursQuiet: value } }))} /></SettingRow>
      <p className="text-sm text-muted">Abend und Erholung haben auf Jetzt Vorrang. Aufgaben bleiben unter Arbeit erreichbar; laufende Arbeit endet dadurch nicht.</p>
    </Card></Section>
  </Page>
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
      <p className="px-1 text-muted">Homeoffice spontan? Auf Jetzt unter „Heute anpassen“ wählen.</p>
    </Page>
  )
}

function Sleep({ s, save }: { s: S; save: Save }) {
  const sug = deriveSchedule(s)
  const manual = s.anchor.manual ?? {}
  const setSleep =(patch: Partial<S['sleep']>) => save((x) => applySchedule({ ...x, sleep: { ...x.sleep, ...patch } }))
  return (
    <Page className="settings-page" title="Schlaf & Anker" back="/einstellungen">
      <p className="px-1 text-sm text-muted">Deine Zeiten bleiben anpassbar. Zahlen und Uhrzeiten kannst du direkt eingeben.</p>

      <SettingRow label="Stummen Einschlafhinweis beim Zubettgehen starten"><Toggle label="Stummen Einschlafhinweis beim Zubettgehen starten" checked={!!s.sleep.bedtimePromptEnabled} onChange={(value) => setSleep({ bedtimePromptEnabled: value })} /></SettingRow>
      <p className="text-sm text-muted">Einmaliger Hinweis nach „Ich liege im Bett“ über anderen Apps. Dafür gibst du das Einblenden in Android gesondert frei. Die Freigabe allein startet nichts.</p>
      <SettingRow label="Leise Schlafenszeit-Folgehinweise"><Toggle label="Leise Schlafenszeit-Folgehinweise" checked={s.sleep.bedtimeFollowUpsEnabled === true} onChange={(value) => setSleep({ bedtimeFollowUpsEnabled: value })} /></SettingRow>
      <p className="text-sm text-muted">Eigene Wahl: Zur festen Bettzeit oder nach deiner Bettbestätigung kann Anker nach der geschätzten Einschlafdauer still weiter erinnern. Ohne Ton, Vibration, Bildschirmwecken oder automatischen Appwechsel. Auf Jetzt kannst du „5 Min später“ oder „Heute Ruhe“ wählen.</p>
      <p className="text-sm text-muted">Keine Schlaferkennung: Ein eingeschalteter Bildschirm beweist nicht, dass du wach bist. Ausgeschalteter oder gesperrter Bildschirm wird für Folgehinweise nicht geweckt. Offene Abende bleiben ohne festen Bettzeit-Start.</p>
      <HealthSleepSettings />
      <Card className="space-y-4">
        <SettingRow label={<span>Schlafbedarf</span>}>
          <Stepper label="Schlafbedarf" value={s.sleep.needMin / 60} step={0.5} min={5} max={10} unit="h" onChange={(v) => setSleep({ needMin: Math.round(v * 60) })} />
        </SettingRow>
        <SettingRow label={<span>Einschlafzeit</span>}>
          <Stepper label="Einschlafzeit" value={s.sleep.fallAsleepMin} max={60} onChange={(v) => setSleep({ fallAsleepMin: v })} />
        </SettingRow>
        <SettingRow label={<span>Bildschirm aus vor dem Bett</span>}>
          <Stepper label="Bildschirm aus" value={s.sleep.screenOffMin} max={120} onChange={(v) => setSleep({ screenOffMin: v })} />
        </SettingRow>
        <MoreInfo summary="Wie diese Zeiten zusammenhängen">
        <p className="text-sm text-muted">Deine geschätzte Einschlafzeit fließt in den Bettzeit-Vorschlag ein. Der stumme Schlafhinweis nutzt diese Dauer erst, wenn du ihn selbst startest.</p>
        <p className="text-sm text-muted">Vorschlag: PC-Stopp so viele Minuten vor dem Bett. {manual.pcStop ? 'Dein von Hand gesetzter PC-Stopp bleibt dabei erhalten.' : 'Dein automatisch berechneter PC-Stopp passt sich an.'} Anker schaltet damit weder den Handybildschirm noch den PC automatisch aus.</p>
        <p className="text-sm text-muted">Die Pause soll dir Abstand vom Scrollen und Zeit zum Runterkommen geben. Geplante Ruhe vor dem Bett: {s.support.windDown.enabled ? `zum Beispiel deine gewählte Tätigkeit „${s.support.windDown.activity}“.` : 'zum Beispiel ein ruhiges Hörbuch oder Lesen.'}</p>
        {s.support.windDown.enabled && <p className="text-sm text-muted">Dein Abendübergang um {fmtTime(s.support.windDown.at)} ersetzt die PC-Stopp- und Bett-Erinnerungen durch einen Hinweis. Deine geplanten Zeiten bleiben bestehen; der Sperrbildschirm zeigt nur einen allgemeinen Text.</p>}
        <Row label="Sanften Abendübergang einstellen" sub="Eigene ruhige Tätigkeit und Hinweiszeit" to="/einstellungen/abenduebergang" />
        </MoreInfo>
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
      <MoreInfo summary="Toleranzen und Spielbonus">
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
      </MoreInfo>
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

function EveningPlans({ s, save }: { s: S; save: Save }) {
  const keys = Object.keys(EVENING_LABELS) as EveningPlan[]
  return (
    <div className="space-y-3">
      <p className="px-1 text-muted">Standard pro Tag. Für heute spontan änderbar auf der Startseite.</p>
      {s.evenings.map((e, i) => (
        <div key={i} className="grid min-w-0 grid-cols-[minmax(3rem,1fr)_minmax(0,2fr)] items-start gap-3 rounded-xl bg-surface p-3">
          <span className="py-3 font-medium">{WEEKDAYS[i]}</span>
          <Choice label={`Abend ${WEEKDAYS_LONG[i]}`} value={e} options={keys.map((key) => ({ value: key, label: EVENING_LABELS[key] }))} onChange={(value) => save((current) => ({ ...current, evenings: current.evenings.map((plan, j) => i === j ? value : plan) }))} />
        </div>
      ))}
      <MoreInfo summary="Dauer der Abendpläne">
        <Card className="space-y-3">
          {keys.map((k) => (
            <SettingRow key={k} label={<span>{EVENING_LABELS[k]}</span>}>
              <Stepper label={`Dauer ${EVENING_LABELS[k]}`} value={s.eveningDurations[k]} step={15} min={15} max={360} onChange={(v) => save((x) => ({ ...x, eveningDurations: { ...x.eveningDurations, [k]: v } }))} />
            </SettingRow>
          ))}
        </Card>
      </MoreInfo>

    </div>
  )
}

function EveningSettings({ s, save }: { s: S; save: Save }) {
  const { hash } = useLocation()
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }) }, [hash])
  return <Page className="settings-page" title="Abend" back="/einstellungen">
    <div id="uebergang"><Section title="Sanfter Abendübergang"><WindDownFields /></Section></div>
    <details id="plaene" open={hash === '#plaene'} className="space-y-3"><summary className="min-h-11 cursor-pointer py-3 font-medium">Abendpläne für die Woche</summary><EveningPlans s={s} save={save} /></details>
    <details id="modus" open={hash === '#modus'} className="space-y-3"><summary className="min-h-11 cursor-pointer py-3 font-medium">Abendmodus vorschlagen</summary><EveningMode s={s} save={save} /></details>
  </Page>
}

function Routines({ s }: { s: S }) {
  const { hash } = useLocation()
  const [routine, setRoutine] = useState<RoutineId>(hash === '#evening' ? 'evening' : 'morning')
  useEffect(() => { if (hash === '#morning' || hash === '#evening') setRoutine(hash.slice(1) as RoutineId) }, [hash])
  return <Page className="settings-page" title="Routinen" back="/einstellungen">
    <Segmented label="Routine bearbeiten" value={routine} options={[{ value: 'morning', label: 'Morgen' }, { value: 'evening', label: 'Abend' }]} onChange={setRoutine} />
    <RoutineEditor key={routine} s={s} save={useApp.getState().saveSettings} r={routine} />
  </Page>
}

function RoutineEditor({ s, save, r }: { s: S; save: (fn: (s: S) => S) => Promise<void>; r: RoutineId }) {
  const st = useApp()
  const steps = s.routines[r]
  const [error, setError] = useState('')
  const set = (update: (current: RoutineStep[]) => RoutineStep[]) => save((current) => {
    const next = { ...current, routines: { ...current.routines, [r]: update(current.routines[r]) } }
    return r === 'morning' ? applySchedule(next) : next
  }).then(notifySaved)
  const edit = (update: (current: RoutineStep[]) => RoutineStep[]) => {
    setError(''); void set(update).catch(() => setError('Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.'))
  }
  const upd = (id: string, patch: Partial<RoutineStep>) => edit((current) => current.map((step) => step.id === id ? { ...step, ...patch } : step))
  const move = async (sourceId: string, targetId: string): Promise<MoveResult> => {
    let result: MoveResult = null
    await set((current) => { const next = moveById(current, sourceId, targetId); if (next !== current) result = { from: current.findIndex((step) => step.id === sourceId), to: current.findIndex((step) => step.id === targetId) }; return next })
    return result
  }
  const remove = async (step: RoutineStep) => {
    let removed: RoutineStep | undefined
    let index = 0
    try {
      await set((current) => { index = current.findIndex((item) => item.id === step.id); removed = current[index]; return current.filter((item) => item.id !== step.id) })
      if (!removed) return
      const restore = removed
      st.showToast('Schritt entfernt.', { label: 'Rückgängig', run: () => set((current) => current.some((item) => item.id === restore.id) ? current : [...current.slice(0, index), restore, ...current.slice(index)]) })
    } catch { setError('Der Schritt konnte nicht entfernt werden.') }
  }
  const start = r === 'morning' ? s.anchor.wake : s.pcStop
  const workDays = s.work.filter((day) => day.isWorkDay)
  const end = r === 'morning' ? workDays.length ? Math.min(...workDays.map((day) => day.start)) - s.commute.minutes - s.commute.bufferMin : undefined : s.bed
  const budget = end === undefined ? undefined : Math.max(0, end - start)
  const minutes = sumMinutes(steps)
  return <div className="space-y-3">
    {r === 'morning' && guidancePreferences(s.guidance).enabled && <MorningLightSuggestion />}
    <h2 className="text-xl font-semibold">{r === 'morning' ? 'Morgenroutine' : 'Abendroutine'}</h2>
    <p className="text-sm text-muted">{minutes} min Routine{budget !== undefined && end !== undefined ? ` · ${budget} min Zeit (${fmtTime(start)}–${fmtTime(end)})` : ' · kein fester Endpunkt'}</p>
    {budget !== undefined && minutes > budget && <MoreInfo summary="Wenn die Zeit knapp ist"><p className="text-sm text-muted">Die Routine ist länger als dieses Zeitfenster. Du kannst einzelne Dauern anpassen oder die kleinen Versionen nutzen. Anker ändert nichts von selbst.</p></MoreInfo>}
    <p className="text-sm text-muted">Am linken Griff ziehen. Tippe einen Schritt an für Dauer, kleine Version und Sortierpfeile.</p>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    <div className="settings-routine-list settings-routine-compact"><SortableList items={steps} onMove={move}
      render={(step) => <details className="routine-detail min-w-0">
        <summary className="routine-summary flex min-h-11 cursor-pointer items-center justify-between gap-3"><span className="min-w-0 break-words font-medium">{step.title}</span><span className="shrink-0 text-sm text-muted">{step.minutes} min</span></summary>
        <div className="routine-fields space-y-2 pt-2">
          <TextInput aria-label="Schritt" value={step.title} onChange={(event) => upd(step.id, { title: event.target.value })} />
          <SettingRow label="Dauer"><Stepper label="Dauer" value={step.minutes} step={1} min={1} max={120} onChange={(value) => upd(step.id, { minutes: value })} /></SettingRow>
          <TextInput aria-label="Minimal-Version" placeholder="Eine kleine Version" value={step.minimal?.title ?? ''} onChange={(event) => { const title = event.target.value; edit((current) => current.map((item) => item.id === step.id ? { ...item, minimal: title ? { title, minutes: item.minimal?.minutes ?? 1 } : undefined } : item)) }} />
          {step.minimal && <SettingRow label="Kleine Version"><Stepper label="Dauer kleine Version" value={step.minimal.minutes} min={1} max={120} onChange={(value) => upd(step.id, { minimal: { ...step.minimal!, minutes: value } })} /></SettingRow>}
          {r === 'morning' && <Checkbox checked={step.isEssentialForZombieMode ?? false} onChange={isEssentialForZombieMode => upd(step.id, { isEssentialForZombieMode })}>Kernschritt im Zombie-Modus</Checkbox>}
          <Button size="sm" variant="ghost" className="justify-self-end" onClick={() => void remove(step)}>Entfernen</Button>
        </div>
      </details>}
    /></div>
    <Button className="w-full" onClick={() => edit((current) => [...current, { id: randomId(8), title: 'Neuer Schritt', minutes: 5 }])}>+ Schritt hinzufügen</Button>
    <Row label="Routine drucken" to={`/druck?typ=${r}`} />
  </div>
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
    <div className="space-y-3">
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
    </div>
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
      <MoreInfo summary="Fokus-Puls"><p className="text-sm text-muted">Läuft nur, solange der Fokus-Modus offen ist, und nie in den Ruhezeiten.</p>
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
      </MoreInfo>
      <MoreInfo summary="Ankommen nach der Arbeit"><p className="text-sm text-muted">Zwei bis drei kurze Schritte, bevor der Abend beginnt.</p>
        <Card className="space-y-3">
          <SettingRow label={<span>Einschalten</span>}>
            <Toggle label="Ankommen" checked={sup.arrival.enabled} onChange={(v) => setSup({ arrival: { ...sup.arrival, enabled: v } })} />
          </SettingRow>
          {sup.arrival.enabled &&
            sup.arrival.steps.map((step, i) => (
              <TextInput key={i} aria-label={`Schritt ${i + 1}`} value={step} onChange={(e) => setSup({ arrival: { ...sup.arrival, steps: sup.arrival.steps.map((x, j) => (j === i ? e.target.value : x)) } })} />
            ))}
        </Card>
      </MoreInfo>
      <MoreInfo summary="Wege und Übergänge"><p className="text-sm text-muted">Das sind echte Minuten: Parkplatz, Schuhe, Laptop-Start.</p>
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
      </MoreInfo>
      <MoreInfo summary="Abends schon erledigt"><p className="text-sm text-muted">Nur was du hier setzt, gilt. Der Morgenschritt entfällt dann, zählt dort aber nicht als erledigt.</p>
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
              const eveningStepId = eveningStep?.id ?? ''
              const morningStepId = morningStep?.id ?? ''
              if (eveningStepId && morningStepId) save((x) => ({ ...x, routineLinks: [...x.routineLinks, { eveningStepId, morningStepId }] }))
            }}
          >
            <Choice label="Abendschritt" value={eveningStep?.id ?? ''} onChange={setEveningChoice} options={s.routines.evening.map((step, i) => ({ value: step.id, label: `${i + 1}. ${step.title}` }))} />
            <p className="text-sm text-muted">Abends: {eveningStep?.title ?? 'Kein Schritt vorhanden'}</p>
            <Choice label="Morgenschritt" value={morningStep?.id ?? ''} onChange={setMorningChoice} options={s.routines.morning.map((step, i) => ({ value: step.id, label: `${i + 1}. ${step.title}` }))} />
            <p className="text-sm text-muted">Morgens nicht nötig: {morningStep?.title ?? 'Kein Schritt vorhanden'}</p>
            <Button type="submit" size="sm">
              Regel hinzufügen
            </Button>
          </form>
        </Card>
      </MoreInfo>
      <MoreInfo summary="Wetter"><p className="text-sm text-muted">Freiwillig, mit lokalem Wetterort und eigenen Kleidungsvorlieben.</p>
        <WeatherSettings s={s} save={save} />
      </MoreInfo>
      <MoreInfo summary="Rückfrage und Homeoffice">
        <Card className="space-y-3">
          <SettingRow label={<span>Beim Verschieben nach dem Grund fragen</span>}>
            <Toggle label="Nach dem Grund fragen" checked={s.askReason} onChange={(v) => save((x) => ({ ...x, askReason: v }))} />
          </SettingRow>
          <TextInput aria-label="Homeoffice-Vorlage" value={s.homeOfficeMessage} onChange={(e) => save((x) => ({ ...x, homeOfficeMessage: e.target.value }))} />
        </Card>
      </MoreInfo>
      <MoreInfo summary="Spiel"><p className="text-sm text-muted">XP zählen im Hintergrund weiter und sind beim Einschalten wieder da.</p>
        <Card className="flex items-center justify-between">
          <span>Spiel und Level anzeigen</span>
          <Toggle label="Spiel anzeigen" checked={sup.gameVisible} onChange={(v) => setSup({ gameVisible: v })} />
        </Card>
      </MoreInfo>
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
      <Card className="space-y-4">
        <SettingRow label="Zeitbogen auf Jetzt"><Toggle label="Zeitbogen auf Jetzt" checked={guidancePreferences(s.guidance).timeArc} onChange={timeArc => save(current => ({ ...current, guidance: { ...guidancePreferences(current.guidance), timeArc } }))} /></SettingRow>
        <Row label="Abend- und Morgenfarben einstellen" to="/einstellungen/begleitung" />
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

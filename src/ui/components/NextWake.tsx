import { buildAlarmConfig, nextWakeDetails } from '../../core/alarm'
import { fmtTime } from '../../core/time'
import { useNow } from '../../state/hooks'
import { today, useApp } from '../../state/store'
import { Card } from './ui'
import { WakeSuggestion } from './WakeSuggestion'

/** Gleicher Weckerbesitzer, sichtbarer Vorrang der bewussten Tagesausnahme. */
export function NextWake() {
  const st = useApp()
  const now = useNow()
  const next = nextWakeDetails(buildAlarmConfig(st.settings, st.days, today()), now)
  return <>
    <Card className="space-y-2">
      <h3 className="font-semibold">Nächste wirksame Weckzeit</h3>
      {next ? <>
        <p><strong>{fmtTime(next.minutes)}</strong> · {new Date(next.mainAt).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' })}</p>
        <p className="text-sm text-muted">{next.overridden
          ? `Die Tagesüberschreibung hat Vorrang vor dem Standard ${fmtTime(st.settings.anchor.wake)}. Eine Standardänderung entfernt sie nicht.`
          : `Es gilt dein Standard ${fmtTime(st.settings.anchor.wake)}.`}</p>
        <p className="text-sm text-muted">Geplante Zeit; die tatsächliche Zustellung und Hörbarkeit bleiben am Handy zu prüfen.</p>
      </> : <p className="text-sm text-muted">Der Hauptwecker ist ausgeschaltet oder es ist kein nächster Termin planbar.</p>}
    </Card>
    {next?.overridden && <WakeSuggestion key={next.date} date={next.date} />}
  </>
}

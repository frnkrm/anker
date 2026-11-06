import { Browser } from '@capacitor/browser'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { googleConfigured, googleConnected } from '../../platform/google'
import { healthAuthorized, requestHealth } from '../../platform/health'
import { AnkerNative, isNative, safe } from '../../platform/native'
import { exactAlarmStatus, notificationPermission, openExactAlarmSettings, requestNotificationPermission } from '../../platform/notifications'
import { installScanner, scannerReady } from '../../platform/qr'
import { currentUser, supabaseConfigured } from '../../platform/supabase'
import { useApp } from '../../state/store'
import { Ampel, Button, Card, Page, Row, Section } from '../components/ui'
import { AlarmDiagnosis } from './Alarm'

type State = 'ok' | 'warn' | 'off'
interface Item {
  key: string
  label: string
  hint: string
  state: State
  required?: boolean
  action?: { label: string; run: () => void | Promise<unknown> }
}

/** Ampeln für alle Berechtigungen und Extras. Nur 2 sind Pflicht, der Rest ist Empfehlung. */
export default function Check() {
  const st = useApp()
  const [items, setItems] = useState<Item[]>([])

  const load = useCallback(async () => {
    const native = isNative()
    const notif = await notificationPermission()
    const exact = await exactAlarmStatus()
    const full = await safe(async () => (await AnkerNative.canUseFullScreenIntent()).granted, false)
    const battery = await safe(async () => (await AnkerNative.isIgnoringBatteryOptimizations()).granted, false)
    const dnd = await safe(async () => (await AnkerNative.hasDndAccess()).granted, false)
    const scanner = await scannerReady()
    const health = await healthAuthorized()
    const widget = await safe(async () => (await AnkerNative.isWidgetPlaced()).placed, false)
    const user = await currentUser()
    const list: Item[] = [
      { key: 'notif', label: 'Benachrichtigungen', hint: 'Für alle Erinnerungen.', required: true, state: notif === 'granted' ? 'ok' : 'warn', action: { label: 'Erlauben', run: requestNotificationPermission } },
    ]
    if (native) {
      list.push(
        { key: 'exact', label: 'Exakte Alarme', hint: 'Damit Erinnerungen auf die Minute kommen.', required: true, state: exact === 'granted' ? 'ok' : 'warn', action: { label: 'Erlauben', run: openExactAlarmSettings } },
        { key: 'full', label: 'Vollbild-Wecker', hint: 'Wecker erscheint über dem Sperrbildschirm.', state: full ? 'ok' : 'warn', action: { label: 'Erlauben', run: () => AnkerNative.openFullScreenIntentSettings() } },
        {
          key: 'battery',
          label: 'Akku-Optimierung aus',
          hint: 'Samsung beendet Apps gern im Hintergrund. Zusätzlich: Einstellungen > Akku > Hintergrund-Nutzungslimits > „Nie schlafende Apps“ > Anker hinzufügen.',
          state: battery ? 'ok' : 'warn',
          action: { label: 'Öffnen', run: () => AnkerNative.openBatteryOptimizationSettings() },
        },
        { key: 'dnd', label: 'Nicht-Stören-Ausnahme', hint: 'Damit der Wecker auch bei „Nicht stören“ klingelt.', state: dnd ? 'ok' : 'warn', action: { label: 'Öffnen', run: () => AnkerNative.openDndSettings() } },
        { key: 'scanner', label: 'QR-Scanner', hint: 'Wird einmalig von Google Play nachgeladen.', state: scanner ? 'ok' : 'warn', action: { label: 'Laden', run: installScanner } },
        {
          key: 'health',
          label: 'Health Connect',
          hint: 'Hakt Training automatisch ab (nur lesen).',
          state: st.settings.integrations.healthConnect && health ? 'ok' : 'off',
          action: {
            label: 'Verbinden',
            run: async () => {
              const ok = await requestHealth()
              await st.saveSettings((s) => ({ ...s, integrations: { ...s.integrations, healthConnect: ok } }))
            },
          },
        },
        { key: 'widget', label: 'Widget', hint: 'Homescreen lange drücken > Widgets > Anker.', state: widget ? 'ok' : 'off' },
      )
    }
    list.push(
      { key: 'google', label: 'Google Kalender', hint: googleConfigured ? 'Termine fließen in den Tagesplan.' : 'Nicht konfiguriert (siehe README).', state: st.settings.integrations.googleCalendar && googleConnected() ? 'ok' : 'off' },
      { key: 'sync', label: 'Sync', hint: supabaseConfigured ? 'Daten zwischen Handy und PC abgleichen.' : 'Nicht konfiguriert (siehe README).', state: user ? 'ok' : 'off' },
    )
    setItems(list)
  }, [st])

  useEffect(() => {
    void load()
    const onVis = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  const required = items.filter((i) => i.required)
  const rest = items.filter((i) => !i.required)
  const render = (i: Item) => (
    <Card key={i.key} className="flex items-start gap-3">
      <span className="mt-1.5">
        <Ampel state={i.state} />
      </span>
      <div className="flex-1">
        <p className="font-medium">{i.label}</p>
        <p className="text-sm text-muted">{i.hint}</p>
      </div>
      {i.state !== 'ok' && i.action && (
        <Button size="sm" variant={i.required ? 'primary' : 'secondary'} onClick={async () => {
          await i.action!.run()
          setTimeout(() => void load(), 800)
        }}>
          {i.action.label}
        </Button>
      )}
      {(i.key === 'google' || i.key === 'sync') && i.state !== 'ok' && (
        <Link to="/verbindungen" className="min-h-10 rounded-xl bg-surface-2 px-3 py-2 text-sm">
          Öffnen
        </Link>
      )}
    </Card>
  )

  return (
    <Page title="Einrichtungs-Check" back="/mehr">
      <Row label="Gemeinsam testen" sub="Schritt für Schritt ausprobieren und selbst abhaken" to="/geraetetest" />
      <AlarmDiagnosis />
      <Section title="Wichtig">{required.map(render)}</Section>
      <Section title="Empfohlen & optional" hint="Alles hier ist freiwillig. Anker funktioniert auch ohne.">
        {rest.map(render)}
      </Section>
      {isNative() && (
        <button type="button" className="px-1 text-left text-sm text-accent underline" onClick={() => void Browser.open({ url: 'https://dontkillmyapp.com/samsung' })}>
          Mehr zu Samsung und Hintergrund-Apps: dontkillmyapp.com
        </button>
      )}
    </Page>
  )
}

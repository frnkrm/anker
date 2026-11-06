import { Share } from '@capacitor/share'
import { useEffect, useRef, useState } from 'react'
import { CONTACT_DELAY_MS, homeOfficeContactDue, validHomeOfficeContacts, type HomeOfficeContact as Contact } from '../../core/homeOfficeContact'
import { inQuietHours } from '../../core/support'
import { minutesOnPlanDay } from '../../core/time'
import { AnkerNative, isNative } from '../../platform/native'
import { nextNow, useNow } from '../../state/hooks'
import { planFor, today, useApp } from '../../state/store'
import { Button } from './ui'

function quietMoment(date: string): boolean {
  const state = useApp.getState()
  if (date !== today() || window.location.pathname !== '/' || document.visibilityState !== 'visible' || document.querySelector('[role="dialog"]')) return false
  const plan = planFor(date, state)
  const m = minutesOnPlanDay(date, Date.now())
  if (plan.dayType !== 'work' || !plan.homeOffice || inQuietHours(m, state.settings)
    || plan.quiet?.some(([start, end]) => m >= start && m < end) || state.local.focus?.timer.status === 'running') return false
  const action = nextNow().action.type
  // Auch Pause, Ankommen und Freizeit sind Ruhe: die Rückfrage wartet auf Arbeitskontext.
  return action === 'work' || action === 'worktask'
}

/** Eine lokale Tageswahl; Kopieren/Teilen ist niemals ein Versand- oder Erledigungsbeweis. */
export function HomeOfficeContact({ date, reminderOnly = false }: { date: string; reminderOnly?: boolean }) {
  const state = useApp()
  const now = useNow()
  const entries = validHomeOfficeContacts(state.local.homeOfficeContact) ? state.local.homeOfficeContact : undefined
  const entry = entries?.[date]
  const [shown, show] = useState<{ date: string; at: number }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [ringing, setRinging] = useState(false)
  const mounted = useRef(false)
  const pending = useRef(false)
  const attempted = useRef('')
  const ringingNow = useRef(false)
  const text = state.settings.homeOfficeMessage

  useEffect(() => {
    mounted.current = true
    const listener = reminderOnly && isNative() ? AnkerNative.addListener('alarmRinging', () => {
      if (!mounted.current) return
      ringingNow.current = true; setRinging(true); show(undefined)
    }).catch(() => { ringingNow.current = true }) : undefined
    return () => { mounted.current = false; void listener?.then((handle) => handle?.remove()) }
  }, [reminderOnly])

  useEffect(() => {
    if (!reminderOnly || !homeOfficeContactDue(entry, now) || ringingNow.current || !quietMoment(date)) return
    const key = `${date}:${entry!.at}:${entry!.remindAt}`
    if (attempted.current === key) return
    attempted.current = key
    const check = async () => {
      if (isNative()) {
        try { if ((await AnkerNative.getAlarmState()).ringing) return } catch { return }
      }
      let consumed = false
      const at = entry!.at
      // Persistenz vor Anzeige: Reload oder ein zweiter Mount wiederholt dieselbe Rückfrage nicht.
      await useApp.getState().saveLocal((local) => {
        const latest = local.homeOfficeContact?.[date]
        if (!mounted.current || ringingNow.current || !quietMoment(date) || latest?.at !== at || !homeOfficeContactDue(latest, Date.now())) return local
        consumed = true
        return { ...local, homeOfficeContact: { ...local.homeOfficeContact, [date]: { status: 'later', at } } }
      })
      if (consumed && mounted.current && !ringingNow.current && quietMoment(date)) show({ date, at })
    }
    void check().catch(() => { /* Ohne bestätigte Speicherung erscheint keine Rückfrage. */ })
  }, [date, entry, now, reminderOnly])

  const run = async (action: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setMessage('')
    try { await action() } catch { if (mounted.current) setError('Die Auswahl konnte nicht gespeichert werden. Bitte versuche es erneut.') }
    finally { pending.current = false; if (mounted.current) setBusy(false) }
  }
  const choose = (status: Contact['status']) => run(async () => {
    const at = Date.now()
    await state.saveLocal((local) => ({ ...local, homeOfficeContact: { ...local.homeOfficeContact,
      [date]: { status, at, ...(status === 'later' ? { remindAt: at + CONTACT_DELAY_MS } : {}) },
    } }))
    if (mounted.current) { show(undefined); setMessage(status === 'done' ? 'Für heute als erledigt bestätigt.' : status === 'not-needed' ? 'Für heute nicht nötig.' : 'Für später gemerkt. Frühestens in 30 Minuten gibt es bei passendem ruhigem Moment eine Rückfrage in Anker.') }
  })
  const copy = async () => {
    setError(''); setMessage('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unavailable')
      await navigator.clipboard.writeText(text)
      if (mounted.current) setMessage('Text kopiert. Gesendet und erledigt ist damit noch nichts.')
    } catch { if (mounted.current) setError('Kopieren ist gerade nicht möglich. Du kannst den Text oben selbst auswählen.') }
  }
  const share = async () => {
    setError(''); setMessage('')
    try {
      if (isNative()) await Share.share({ title: 'Homeoffice', text })
      else await navigator.share({ title: 'Homeoffice', text })
      if (mounted.current) setMessage('Teilen beendet. Anker bestätigt keinen Versand; deinen Status wählst du selbst.')
    } catch { if (mounted.current) setMessage('Teilen abgebrochen oder gerade nicht verfügbar. Dein Kontaktstatus bleibt unverändert.') }
  }
  if (reminderOnly && (!shown || shown.date !== date || shown.at !== entry?.at || entry.status !== 'later' || ringing || !quietMoment(date))) return null
  return <section aria-label={reminderOnly ? 'Einmalige Homeoffice-Rückfrage' : 'Homeoffice-Kontakt'} className="min-w-0 space-y-3 rounded-xl border border-line bg-surface p-3 [overflow-wrap:anywhere]">
    <p className="font-medium">{reminderOnly ? 'Du wolltest später entscheiden: Brauchst du noch eine Info zum Homeoffice?' : 'Musst du jemandem zum Homeoffice Bescheid geben?'}</p>
    <p className="text-sm text-muted">Du entscheidest selbst. Anker kennt keine betriebliche Erlaubnis und sendet nichts automatisch.</p>
    {!reminderOnly && entry && <p role="status" className="text-sm text-muted">{entry.status === 'done' ? 'Für heute von dir als erledigt bestätigt.' : entry.status === 'not-needed' ? 'Für heute von dir als nicht nötig gewählt.' : entry.remindAt !== undefined ? 'Für später gewählt; höchstens eine ruhige Rückfrage in der App ist vorgemerkt.' : 'Für später gewählt. Es ist keine weitere Rückfrage vorgemerkt.'}</p>}
    <p className="whitespace-pre-wrap">„{text}“</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy || !text.trim()} onClick={() => void copy()}>Homeoffice-Text kopieren</Button>
      {(isNative() || typeof navigator.share === 'function') && <Button size="sm" disabled={busy || !text.trim()} onClick={() => void share()}>Homeoffice-Text teilen</Button>}
    </div>
    <fieldset disabled={busy} className="flex min-w-0 flex-wrap gap-2" aria-label="Meine Homeoffice-Kontaktwahl">
      <Button size="sm" onClick={() => void choose('done')}>Schon erledigt</Button>
      <Button size="sm" onClick={() => void choose('not-needed')}>Nein, nicht nötig</Button>
      {!reminderOnly && <Button size="sm" variant="ghost" onClick={() => void choose('later')}>Später</Button>}
      {reminderOnly && <Button size="sm" variant="ghost" onClick={() => show(undefined)}>Für heute schließen</Button>}
    </fieldset>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </section>
}

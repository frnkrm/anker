import { useState } from 'react'
import { Link } from 'react-router'
import { energyNightFor } from '../../core/sleepInsights'
import { sleepNightFor } from '../../core/sleepDiary'
import { fmtTime, utcToZoned } from '../../core/time'
import type { SleepDiaryEntry } from '../../core/types'
import { useApp } from '../../state/store'
import { Button, Card, Info } from './ui'

export function SleepReflections({ now, minute, wake }: { now: number; minute: number; wake: number }) {
  const st = useApp(), [busy, setBusy] = useState(false), [error, setError] = useState('')
  if (!st.settings.alarm.smartWake.enabled) return null
  const date = sleepNightFor('wakeAt', now), entry = st.local.sleepDiary[date]
  const morning = minute >= wake - 30 && minute < 14 * 60
  const energyDate = energyNightFor(now), energy = st.local.sleepDiary[energyDate]
  const showWake = morning && entry && (entry.alarmAt !== undefined || entry.qrAt !== undefined) && !entry.wakeFeedback && !entry.wakeFeedbackSkippedAt
  const showOnset = morning && entry?.onset?.status === 'estimated'
  const showEnergy = minute >= 18 * 60 && minute < 28 * 60 && !energy?.dayEnergy && !energy?.energySkippedAt
  if (!showWake && !showOnset && !showEnergy) return null
  const save = async (night: string, fn: (e: SleepDiaryEntry) => SleepDiaryEntry) => {
    if (busy) return
    setBusy(true); setError('')
    try { await st.updateSleepEntry(night, fn) } catch { setError('Die Rückmeldung konnte noch nicht gespeichert werden. Du kannst sie später nachtragen.') }
    finally { setBusy(false) }
  }
  return <div className="space-y-3">
    {showWake && <Card className="space-y-3"><h2 className="font-medium">Wie passte die Weckzeit für dich?</h2><p className="text-sm text-muted">{entry.alarmAt ? `Wecker um ${fmtTime(utcToZoned(entry.alarmAt).minutes)}.` : 'Nach deiner Weckinteraktion.'}</p><div className="flex flex-wrap gap-2">{([['too-early', 'Zu früh'], ['right', 'Passend'], ['too-late', 'Zu spät']] as const).map(([value, label]) => <Button key={value} disabled={busy} onClick={() => void save(date, e => ({ ...e, wakeFeedback: { at: now, value } }))}>{label}</Button>)}</div><Button variant="ghost" disabled={busy} onClick={() => void save(date, e => ({ ...e, wakeFeedbackSkippedAt: now }))}>Heute überspringen</Button></Card>}
    {showOnset && <Card className="space-y-3"><h2 className="font-medium">Einschlafschätzung prüfen</h2><p>Unbestätigt: etwa {fmtTime(utcToZoned(entry!.onset!.at).minutes)}.</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void save(date, e => ({ ...e, onset: { ...e.onset!, status: 'confirmed' } }))}>Passt ungefähr</Button><Link className="flex min-h-11 items-center px-2 text-accent" to={`/schlaf?nacht=${date}&bearbeiten=1#schlafprotokoll`}>Korrigieren</Link><Button disabled={busy} variant="ghost" onClick={() => void save(date, e => ({ ...e, onset: { ...e.onset!, status: 'discarded' } }))}>Verwerfen</Button></div></Card>}
    {showEnergy && <Card className="space-y-3"><div className="flex items-center justify-between gap-2"><h2 className="font-medium">Wie viel Energie hattest du heute?</h2><Info title="Freiwillige Energierückmeldung"><p>1 bedeutet sehr wenig, 5 sehr viel. Die Angabe gehört zum Tag nach der vorangegangenen Nacht. Ausgelassene Antworten werden nicht bewertet. Die Auswertung macht später nur Vorschläge.</p></Info></div><div className="grid grid-cols-5 gap-2">{([1, 2, 3, 4, 5] as const).map(value => <Button key={value} disabled={busy} aria-label={`Energie ${value} von 5`} onClick={() => void save(energyDate, e => ({ ...e, dayEnergy: { at: now, value } }))}>{value}</Button>)}</div><Button disabled={busy} variant="ghost" onClick={() => void save(energyDate, e => ({ ...e, energySkippedAt: now }))}>Heute überspringen</Button></Card>}
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
  </div>
}

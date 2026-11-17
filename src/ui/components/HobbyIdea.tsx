import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { hobbyOpportunity, suggestHobby, type HobbyActivity } from '../../core/hobbies'
import type { NextInput } from '../../core/support'
import { useApp } from '../../state/store'
import { AnkerNative, isNative } from '../../platform/native'
import { Button, Card, Choice, Info, MoreInfo } from './ui'

export function HobbyIdea({ input, alarmActive }: { input: NextInput; alarmActive: boolean }) {
  const st = useApp(), [rotation, setRotation] = useState(0)
  const [energy, setEnergy] = useState<'' | NonNullable<HobbyActivity['energy']>>('')
  const [context, setContext] = useState<'' | NonNullable<HobbyActivity['context']>>('')
  const [ringing, setRinging] = useState(isNative())
  const opportunity = hobbyOpportunity(input, st.local, { alarmActive })
  const slotKey = opportunity?.slotKey
  useEffect(() => {
    if (!isNative() || !slotKey) return
    let active = true
    const refresh = () => { void AnkerNative.getAlarmState().then(s => { if (active) setRinging(s.ringing) }, () => { if (active) setRinging(true) }) }
    refresh(); document.addEventListener('visibilitychange', refresh)
    const listener = AnkerNative.addListener('alarmRinging', () => setRinging(true))
    return () => { active = false; document.removeEventListener('visibilitychange', refresh); void listener.then(h => h.remove()).catch(() => undefined) }
  }, [slotKey])
  if (!st.local.hobbies?.items.some(h => !h.paused) || !opportunity || ringing) return null
  const idea = suggestHobby(input, st.local, { alarmActive, rotation, energy: energy || undefined, context: context || undefined })
  const hobby = st.local.hobbies.items.find(h => h.id === idea?.hobbyId), activity = hobby?.activities?.find(a => a.id === idea?.activityId)
  return <Card className="space-y-2">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium text-muted">Eine freiwillige Idee</h2><Info title="Freie Zeit mit Hobbys"><p>Ein Vorschlag aus deinem vorhandenen Plan, keine zusätzliche Aufgabe. Du kannst genauso gut Pause machen. Starten oder Zeitablauf vergibt keine Punkte und erledigt nichts.</p></Info></div>
    <p className="break-words font-medium">{idea?.title ?? 'Mit deinen Angaben passt gerade keine hinterlegte Aktivität.'}</p>
    {idea?.minutes && <p className="text-sm text-muted">Etwa {idea.minutes} Minuten inklusive Vorbereitung</p>}
    {activity?.things?.length ? <p className="text-sm text-muted">Dafür brauchst du: {activity.things.join(', ')}</p> : null}
    <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setRotation(r => r + 1)}>Andere Idee</Button><Button size="sm" variant="ghost" onClick={() => void st.saveHobbies(h => ({ ...h, dismissedDate: input.plan.date })).catch(() => st.showToast('Die Auswahl konnte noch nicht gespeichert werden.'))}>Heute lieber Pause</Button></div>
    <MoreInfo summary="Zeit, Kontext & Energie"><Choice label="Energie für diese Idee" value={energy} onChange={setEnergy} options={[{ value: '', label: 'Offen' }, { value: 'low', label: 'Wenig' }, { value: 'medium', label: 'Mittel' }, { value: 'high', label: 'Viel' }]} /><Choice label="Wo passt es gerade?" value={context} onChange={setContext} options={[{ value: '', label: 'Offen' }, { value: 'inside', label: 'Drinnen' }, { value: 'outside', label: 'Draußen' }]} /><Link to="/einstellungen/hobbys" className="flex min-h-11 items-center text-accent">Hobbys bearbeiten</Link></MoreInfo>
  </Card>
}

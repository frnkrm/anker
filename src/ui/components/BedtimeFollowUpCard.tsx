import { BedtimeNative } from '../../platform/bedtimePrompt'
import { useBedtimeSession } from './BedtimeSession'
import { Button, Card } from './ui'

const time = (at: number) => new Date(at).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })
/** Native session status only; never writes a bedtime, completion or game state. */
export function BedtimeFollowUpCard() {
  const { supported, state, busy, run, error } = useBedtimeSession()
  if (!supported || state?.phase !== 'quiet' || typeof state.sessionId !== 'string' || !state.sessionId) return null
  const ready = state.quietReady === true
  const due = typeof state.quietDueAt === 'number' && Number.isFinite(state.quietDueAt) ? state.quietDueAt : undefined
  const until = typeof state.quietUntilAt === 'number' && Number.isFinite(state.quietUntilAt) ? state.quietUntilAt : undefined
  return <Card className="min-w-0 space-y-3 !bg-black !text-white" >
    <section aria-label="Leise Schlafenszeit-Folgehinweise" className="min-w-0 space-y-3">
      <h2 className="break-words font-semibold">Deine gewählte Schlafenszeit</h2>
      {ready ? <p className="break-words text-sm text-muted">Wenn du noch am Handy bist: Möchtest du es für heute weglegen? Du entscheidest.</p>
        : <p role="status" className="break-words text-sm text-muted">Die leise Abendrunde ruht.{due !== undefined ? ` Frühestens wieder ab ${time(due)}; eine Anzeige wird nicht zugesagt.` : ' Sie wartet auf den erlaubten nativen Gerätezustand.'}</p>}
      <p className="break-words text-sm text-muted">Bleibt stumm, auch in Ruhezeiten: ohne Ton, Vibration, Bildschirmwecken oder Appwechsel. Anker erkennt nicht, ob du schläfst. „Heute Ruhe“ beendet diese Nacht.{until ? ` Diese Abendrunde endet spätestens um ${time(until)}.` : ''}</p>
      <div className="grid min-w-0 gap-2">
        {ready && <Button disabled={busy} className="w-full" onClick={() => void run(() => BedtimeNative.ackBedtimePrompt({ sessionId: state.sessionId! }))}>5 Min später</Button>}
        <Button disabled={busy} variant="ghost" className="w-full" onClick={() => void run(() => BedtimeNative.stopBedtimePrompt({ sessionId: state.sessionId }))}>Heute Ruhe</Button>
      </div>
      {error && <p role="alert" className="break-words text-sm text-muted">{error}</p>}
    </section>
  </Card>
}

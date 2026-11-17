import { useEffect, useRef, useState } from 'react'
import { AnkerNative, isNative } from '../../platform/native'
import { BedtimeNative } from '../../platform/bedtimePrompt'
import { useApp } from '../../state/store'
import { useBedtimeSession } from './BedtimeSession'
import { Button, Sheet } from './ui'

/** Nur ein tatsächlich gezeichneter, sichtbarer Dialog liefert den nativen Beobachtungstakt. */
export function SleepQuestion() {
  const enabled = useApp(s => s.settings.sleep.onsetEstimationEnabled === true)
  const { state, busy, run, foreground } = useBedtimeSession()
  const [active, setActive] = useState<{ id?: string; enabled: boolean }>({ enabled: false })
  const panel = useRef<HTMLDivElement>(null), sessionId = state?.sessionId
  const shown = enabled && state?.phase === 'shown' && isNative()
  useEffect(() => {
    let mounted = true
    if (shown) void AnkerNative.getSmartWakeState().then(s => { if (mounted) setActive({ id: sessionId, enabled: s.onsetEstimationActive === true }) }, () => { if (mounted) setActive({ id: sessionId, enabled: false }) })
    return () => { mounted = false }
  }, [shown, sessionId])
  const open = shown && active.id === sessionId && active.enabled
  useEffect(() => {
    if (!open || !sessionId) return
    const report = () => {
      const visible = document.visibilityState === 'visible' && foreground.current && !!panel.current && panel.current.getClientRects().length > 0
      void AnkerNative.reportSleepPromptVisibility({ sessionId, visible: !!visible }).catch(() => undefined)
    }
    const first = requestAnimationFrame(report), interval = setInterval(report, 500)
    document.addEventListener('visibilitychange', report)
    return () => { cancelAnimationFrame(first); clearInterval(interval); document.removeEventListener('visibilitychange', report); void AnkerNative.reportSleepPromptVisibility({ sessionId, visible: false }).catch(() => undefined) }
  }, [open, sessionId, foreground])
  const awake = () => { if (sessionId) void run(() => BedtimeNative.ackBedtimePrompt({ sessionId })) }
  return <Sheet open={open} onClose={awake} title="Schläfst du schon?" fullscreen><div ref={panel} className="flex min-h-[70dvh] flex-col justify-center gap-5">
    <p className="text-2xl">Wenn du noch wach bist, tippe hier.</p>
    <p className="text-sm text-muted">Ohne Antwort wird nur eine unsichere Einschlafschätzung vorgemerkt. Du kannst sie morgens korrigieren oder verwerfen.</p>
    <Button disabled={busy} variant="primary" size="xl" onClick={awake}>Ich bin noch wach</Button>
    <Button disabled={busy} variant="ghost" onClick={() => { if (sessionId) void run(() => BedtimeNative.stopBedtimePrompt({ sessionId })) }}>Für heute keine Fragen mehr</Button>
  </div></Sheet>
}

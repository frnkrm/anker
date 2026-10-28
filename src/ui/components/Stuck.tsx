import { useEffect, useState } from 'react'
import type { NowAction } from '../../core/now'
import { Button, Sheet } from './ui'

const GENERIC: Record<string, string> = {
  wake: 'Setz dich auf und stell beide Füße auf den Boden.',
  leave: 'Zieh nur die Schuhe an.',
  work: 'Öffne nur die eine Datei, um die es geht.',
  free: 'Steh kurz auf und trink ein Glas Wasser.',
  pcoff: 'Speichern. Nur speichern.',
  bed: 'Geh ins Schlafzimmer. Mehr nicht.',
  info: 'Steh auf und trink ein Glas Wasser.',
}

/** Kleinstmöglicher nächster Schritt für die aktuelle Aktion. */
export function smallestStep(a: NowAction): string {
  if (a.type === 'step') {
    if (a.step.minimal) return a.step.minimal.title
    return `Nur anfangen: ${a.title}. 2 Minuten reichen.`
  }
  return GENERIC[a.type] ?? GENERIC.info!
}

export function StuckSheet({ open, onClose, action }: { open: boolean; onClose: () => void; action: NowAction }) {
  const [left, setLeft] = useState(120)
  useEffect(() => {
    if (!open) return
    setLeft(120)
    const id = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000)
    return () => clearInterval(id)
  }, [open])
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')
  return (
    <Sheet open={open} onClose={onClose} title="Ganz klein anfangen">
      <p className="text-2xl font-semibold leading-snug">{smallestStep(action)}</p>
      <div className="my-6 text-center">
        <div className="text-6xl font-semibold tabular-nums" aria-live="off">
          {mm}:{ss}
        </div>
        <p className="mt-2 text-muted">{left > 0 ? 'Nur 2 Minuten. Danach darfst du aufhören.' : 'Geschafft. Willst du weitermachen?'}</p>
      </div>
      <Button variant="primary" size="lg" className="w-full" onClick={onClose}>
        {left > 0 ? 'Mach ich' : 'Weiter'}
      </Button>
    </Sheet>
  )
}

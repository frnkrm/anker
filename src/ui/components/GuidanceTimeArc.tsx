import { useEffect, useState } from 'react'
import { fmtTime, zonedToUtc } from '../../core/time'
import { plural } from '../../core/uiText'
import type { HardTime } from '../../core/types'
import { RingTimer } from './ui'

/** Same absolute target and RingTimer as focus; reduced motion updates only by full minutes. */
export function GuidanceTimeArc({ date, hard, now }: { date: string; hard: HardTime; now: number }) {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  const remaining = Math.max(0, Math.ceil((zonedToUtc(date, hard.at) - now) / 1000))
  const displayed = reduced ? Math.ceil(remaining / 60) * 60 : remaining
  return <RingTimer className="guidance-time-arc" remainingSec={displayed} totalSec={3600} label={`Noch ${plural(Math.ceil(remaining / 60), 'Minute', 'Minuten')} bis ${hard.label} um ${fmtTime(hard.at)}`} />
}

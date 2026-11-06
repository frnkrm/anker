import { fmtTime } from '../../core/time'
import type { Block, DayLog, DayPlan } from '../../core/types'

const KIND_ICON: Partial<Record<Block['kind'], string>> = {
  wake: '☀️',
  morning: '🪥',
  sport: '🏋️',
  commute: '🚗',
  work: '💼',
  'evening-plan': '🍳',
  'evening-routine': '🌙',
  free: '🎮',
  'pc-stop': '🔌',
  bed: '🛏️',
  event: '📅',
  commitment: '📍',
  prep: '🎒',
  travel: '🧭',
  rest: '🛋️',
  day: '🌤️',
}

function blockDone(b: Block, log: DayLog | undefined): boolean {
  if (!log) return false
  // Nur echte Handlungen bekommen einen Haken, bewusst Entfallenes nicht
  if (b.steps?.length) {
    const results = b.steps.map((s) => log.steps[`${b.routine}:${s.id}`])
    return results.every(Boolean) && results.some((v) => v === 'done' || v === 'minimal')
  }
  if (b.kind === 'wake') return !!log.wakeAt
  if (b.kind === 'commute' && b.title === 'Losgehen') return !!log.leftAt
  if (b.kind === 'pc-stop') return !!log.pcOffAt
  if (b.kind === 'bed') return !!log.bedAt
  return false
}

export function Timeline({ plan, log, m, compact = false }: { plan: DayPlan; log?: DayLog; m: number; compact?: boolean }) {
  const blocks = compact ? plan.blocks.filter((b) => b.kind !== 'event' || b.end > m) : plan.blocks
  return (
    <ol className="relative space-y-1" aria-label="Tageslinie">
      {blocks.map((b) => {
        const current = b.start <= m && m < Math.max(b.end, b.start + 1)
        const past = Math.max(b.end, b.start) <= m && !current
        const done = blockDone(b, log)
        return (
          <li
            key={b.id}
            aria-current={current ? 'step' : undefined}
            className={`flex items-center gap-3 rounded-2xl px-3 ${compact ? 'min-h-11' : 'min-h-14'} ${current ? 'bg-accent-soft' : ''} ${past && !current ? 'opacity-55' : ''}`}
          >
            <span className="w-12 shrink-0 text-sm tabular-nums text-muted">{fmtTime(b.start)}</span>
            <span aria-hidden="true" className="w-6 text-center">
              {KIND_ICON[b.kind] ?? '•'}
            </span>
            <span className={`flex-1 ${b.hard ? 'font-semibold' : ''}`}>
              {b.title}
              {b.minimal && <span className="ml-2 text-xs text-muted">kurz</span>}
            </span>
            {done && <span aria-label="erledigt" className="text-accent">✓</span>}
            {!compact && b.end > b.start && <span className="text-xs text-muted tabular-nums">{plan.openEnd && b.kind === 'free' ? 'Ende offen' : `bis ${fmtTime(b.end)}`}</span>}
          </li>
        )
      })}
    </ol>
  )
}

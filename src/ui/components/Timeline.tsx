import { fmtTime } from '../../core/time'
import { conflictsForBlock } from '../../core/planConflicts'
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

export function Timeline({ plan, log, m, compact = false, collapseCompleted = false }: { plan: DayPlan; log?: DayLog; m: number; compact?: boolean; collapseCompleted?: boolean }) {
  const blocks = compact ? plan.blocks.filter((b) => b.kind !== 'event' || b.end > m) : plan.blocks
  const completed = collapseCompleted ? blocks.filter((block) => blockDone(block, log)) : []
  const remaining = collapseCompleted ? blocks.filter((block) => !blockDone(block, log)) : blocks
  const render = (items: Block[], label: string) => <ol className="relative space-y-1" aria-label={label}>
      {items.map((b) => {
        const current = b.start <= m && m < Math.max(b.end, b.start + 1)
        const past = Math.max(b.end, b.start) <= m && !current
        const done = blockDone(b, log)
        const conflict = conflictsForBlock(plan, b.id)[0]
        return (
          <li
            key={b.id}
            aria-current={current ? 'step' : undefined}
            className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 rounded-2xl px-3 py-2 ${compact ? 'min-h-11' : 'min-h-14'} ${current ? 'bg-accent-soft' : ''} ${past && !current ? 'opacity-55' : ''} ${conflict ? 'border-l-2 border-warm' : ''}`}
          >
            <span className="w-12 shrink-0 text-sm tabular-nums text-muted">{fmtTime(b.start)}</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">
              <span aria-hidden="true" className="mr-2">{KIND_ICON[b.kind] ?? '•'}</span>
              <span className={b.hard ? 'font-semibold' : undefined}>{b.title}</span>
              {b.minimal && <span className="ml-2 inline-block text-xs text-muted">kurz</span>}
              {done && <span aria-label="erledigt" className="ml-2 inline-block text-accent">✓</span>}
              {!compact && b.end > b.start && <span className="block text-xs text-muted tabular-nums">{plan.openEnd && b.kind === 'free' ? 'Ende offen' : `bis ${fmtTime(b.end)}`}</span>}
              {conflict && <span className="block text-xs text-warm">{conflict.blockLabels[b.id] ?? conflict.shortLabel}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  return <>
    {render(remaining, 'Tageslinie')}
    {completed.length > 0 && <details className="mt-3 rounded-xl border border-line px-3"><summary className="min-h-12 content-center text-sm text-muted">Erledigt ({completed.length})</summary>{render(completed, 'Erledigte Tagesabschnitte')}</details>}
  </>
}

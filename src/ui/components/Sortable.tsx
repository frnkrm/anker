import { useEffect, useRef, useState, type ReactNode } from 'react'
import { moveById } from '../../core/sortable'

type Drag = {
  id: string
  targetId: string
  pointerId: number
  startY: number
  center: number
  rows: { id: string; center: number }[]
  dy: number
}

export type MoveResult = { from: number; to: number } | null

type Sorting<T> =
  | { onMove: (sourceId: string, targetId: string) => Promise<MoveResult>; onChange?: never }
  | { onChange: (items: T[]) => void | Promise<void>; onMove?: never }

function position(drag: Drag, clientY: number): Drag {
  const dy = clientY + window.scrollY - drag.startY
  // Die unveränderten Mittelpunkte und der ursprüngliche Griffabstand bleiben gültig,
  // auch wenn die Quellzeile bereits per transform dem Finger folgt.
  const center = drag.center + dy
  const target = drag.rows.reduce((nearest, row) => Math.abs(row.center - center) < Math.abs(nearest.center - center) ? row : nearest)
  return { ...drag, targetId: target.id, dy }
}

/**
 * Einfache Drag-&-Drop-Liste ohne Zusatzbibliothek: am Griff ziehen (Maus oder Finger).
 * Zusätzlich Hoch/Runter-Knöpfe für Tastatur und Screenreader.
 */
export function SortableList<T extends { id: string }>({ items, onMove, onChange, render }: { items: T[]; render: (item: T, index: number) => ReactNode } & Sorting<T>) {
  const listRef = useRef<HTMLOListElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const handleRef = useRef<HTMLButtonElement | null>(null)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const current = dragRef.current
    if (!current || (current.rows.length === items.length && current.rows.every((row, index) => row.id === items[index]?.id))) return
    // Ein entferntes Capture-Ziel erhält lostpointercapture nicht zuverlässig.
    // Nach einer strukturellen Änderung verwerfen wir auch die alte Geometrie.
    dragRef.current = null
    setDrag(null)
    const handle = handleRef.current
    handleRef.current = null
    if (handle?.hasPointerCapture(current.pointerId)) handle.releasePointerCapture(current.pointerId)
  }, [items])

  const move = async (sourceId: string, targetId: string) => {
    const from = items.findIndex((item) => item.id === sourceId)
    const to = items.findIndex((item) => item.id === targetId)
    if (pending.current || from < 0 || to < 0 || from === to) return
    pending.current = true
    setBusy(true); setError(''); setAnnouncement('')
    try {
      let result: MoveResult = { from, to }
      if (onMove) result = await onMove(sourceId, targetId)
      else await onChange(moveById(items, sourceId, targetId))
      setAnnouncement(result ? `Eintrag von Position ${result.from + 1} auf ${result.to + 1} verschoben.` : 'Die Liste hat sich inzwischen geändert. Bitte wähle den Eintrag erneut.')
    } catch {
      setError('Die Reihenfolge konnte nicht gespeichert werden. Bitte versuche es erneut.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const cancel = (handle: HTMLButtonElement, pointerId: number) => {
    if (dragRef.current?.pointerId !== pointerId) return
    dragRef.current = null
    handleRef.current = null
    setDrag(null)
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId)
  }

  return (
    <div>
      <p role="status" className="sr-only">{announcement}</p>
      {error && <p role="alert" className="text-sm text-warm">{error}</p>}
      <ol ref={listRef} className="space-y-2">
      {items.map((item, i) => {
        const dragging = drag?.id === item.id
        return (
          <li
            key={item.id}
            style={dragging ? { transform: `translateY(${drag.dy}px)`, zIndex: 10, position: 'relative' } : undefined}
            className={`flex items-stretch gap-2 rounded-2xl bg-surface p-2 ${dragging ? 'shadow-xl ring-2 ring-accent' : ''} ${drag?.targetId === item.id && !dragging ? 'ring-2 ring-accent/40' : ''}`}
          >
            <div className="flex flex-col items-center justify-center gap-1">
              <button
                type="button"
                aria-label={`Eintrag ${i + 1} zum Verschieben ziehen`}
                aria-disabled={busy}
                className={`grid h-12 w-11 place-items-center rounded-xl text-xl text-muted active:bg-surface-2 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                // Inline gewinnt gegen die globale, ungeschichtete button-Touch-Regel.
                // Nur der Griff sperrt Panning; der übrige Inhalt bleibt scrollbar.
                style={{ touchAction: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  if (!e.isPrimary || e.button !== 0 || dragRef.current || pending.current) return
                  const rows = Array.from(listRef.current?.children ?? []).map((row, index) => {
                    const rect = row.getBoundingClientRect()
                    return { id: items[index]!.id, center: rect.top + window.scrollY + rect.height / 2 }
                  })
                  const source = rows[i]
                  if (!source) return
                  const next: Drag = { id: item.id, targetId: item.id, pointerId: e.pointerId, startY: e.clientY + window.scrollY, center: source.center, rows, dy: 0 }
                  e.currentTarget.setPointerCapture(e.pointerId)
                  handleRef.current = e.currentTarget
                  dragRef.current = next
                  setDrag(next)
                }}
                onPointerMove={(e) => {
                  const current = dragRef.current
                  if (current?.pointerId !== e.pointerId) return
                  const next = position(current, e.clientY)
                  dragRef.current = next
                  setDrag(next)
                }}
                onPointerUp={(e) => {
                  const current = dragRef.current
                  if (current?.pointerId !== e.pointerId) return
                  const next = position(current, e.clientY)
                  cancel(e.currentTarget, e.pointerId)
                  void move(next.id, next.targetId)
                }}
                onPointerCancel={(e) => cancel(e.currentTarget, e.pointerId)}
                onLostPointerCapture={(e) => cancel(e.currentTarget, e.pointerId)}
              >
                ⋮⋮
              </button>
              <div className="flex flex-col">
                <button type="button" aria-label={`Eintrag ${i + 1} nach oben`} className="h-11 w-11 text-muted disabled:opacity-30" disabled={i === 0} aria-disabled={busy || i === 0} onClick={() => { if (items[i - 1]) void move(item.id, items[i - 1]!.id) }}>
                  ▲
                </button>
                <button type="button" aria-label={`Eintrag ${i + 1} nach unten`} className="h-11 w-11 text-muted disabled:opacity-30" disabled={i === items.length - 1} aria-disabled={busy || i === items.length - 1} onClick={() => { if (items[i + 1]) void move(item.id, items[i + 1]!.id) }}>
                  ▼
                </button>
              </div>
            </div>
            <div className="min-w-0 flex-1">{render(item, i)}</div>
          </li>
        )
      })}
      </ol>
    </div>
  )
}

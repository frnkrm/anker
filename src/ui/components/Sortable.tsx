import { useRef, useState, type ReactNode } from 'react'

/**
 * Einfache Drag-&-Drop-Liste ohne Zusatzbibliothek: am Griff ziehen (Maus oder Finger).
 * Zusätzlich Hoch/Runter-Knöpfe für Tastatur und Screenreader.
 */
export function SortableList<T extends { id: string }>({ items, onChange, render }: { items: T[]; onChange: (items: T[]) => void; render: (item: T, index: number) => ReactNode }) {
  const listRef = useRef<HTMLOListElement>(null)
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; startY: number } | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x!)
    onChange(next)
    setAnnouncement(`Eintrag von Position ${from + 1} auf ${to + 1} verschoben.`)
  }

  const targetIndex = (clientY: number): number => {
    const children = Array.from(listRef.current?.children ?? []) as HTMLElement[]
    for (let i = 0; i < children.length; i++) {
      const r = children[i]!.getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return i
    }
    return children.length - 1
  }

  return (
    <div>
      <p role="status" className="sr-only">{announcement}</p>
      <ol ref={listRef} className="space-y-2">
      {items.map((item, i) => {
        const dragging = drag?.from === i
        return (
          <li
            key={item.id}
            style={dragging ? { transform: `translateY(${drag.dy}px)`, zIndex: 10, position: 'relative' } : undefined}
            className={`flex items-stretch gap-2 rounded-2xl bg-surface p-2 ${dragging ? 'shadow-xl ring-2 ring-accent' : ''} ${drag && drag.to === i && !dragging ? 'ring-2 ring-accent/40' : ''}`}
          >
            <div className="flex flex-col items-center justify-center gap-1">
              <button
                type="button"
                aria-label={`Eintrag ${i + 1} zum Verschieben ziehen`}
                className="grid h-12 w-11 cursor-grab touch-none place-items-center rounded-xl text-xl text-muted active:bg-surface-2"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  setDrag({ from: i, to: i, dy: 0, startY: e.clientY })
                }}
                onPointerMove={(e) => {
                  if (!drag || drag.from !== i) return
                  setDrag({ ...drag, dy: e.clientY - drag.startY, to: targetIndex(e.clientY) })
                }}
                onPointerUp={() => {
                  if (drag) move(drag.from, drag.to)
                  setDrag(null)
                }}
                onPointerCancel={() => setDrag(null)}
              >
                ⋮⋮
              </button>
              <div className="flex flex-col">
                <button type="button" aria-label={`Eintrag ${i + 1} nach oben`} className="h-11 w-11 text-muted disabled:opacity-30" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  ▲
                </button>
                <button type="button" aria-label={`Eintrag ${i + 1} nach unten`} className="h-11 w-11 text-muted disabled:opacity-30" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
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

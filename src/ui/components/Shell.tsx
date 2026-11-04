import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { theme as getTheme } from '../../core/game'
import { addDays } from '../../core/time'
import { nextNow } from '../../state/hooks'
import { today, useApp } from '../../state/store'
import { Button, Sheet } from './ui'

const TABS = [
  { to: '/', label: 'Jetzt', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2' },
  { to: '/tag', label: 'Tag', icon: 'M4 6h16M4 12h10M4 18h7' },
  { to: '/spiel', label: 'Spiel', icon: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9L12 3Z' },
  { to: '/mehr', label: 'Mehr', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
]

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const FULLSCREEN = ['/fokus', '/wecker/klingelt', '/start', '/druck']

export function Shell({ children }: { children: ReactNode }) {
  const loc = useLocation()
  const full = FULLSCREEN.some((p) => loc.pathname.startsWith(p))
  // Spiel ausblenden, wenn abgeschaltet oder überlastet. Es läuft im Hintergrund unverändert weiter.
  const gameVisible = useApp((s) => s.settings.support.gameVisible && s.days[today()]?.override.mode !== 'ueberlastet')
  const right = TABS.slice(2).filter((t) => gameVisible || t.to !== '/spiel')
  return (
    <>
      <main>{children}</main>
      {!full && (
        <nav aria-label="Hauptnavigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur safe-bottom no-print">
          <div className="mx-auto flex max-w-xl items-center">
            {TABS.slice(0, 2).map((t) => (
              <Tab key={t.to} {...t} />
            ))}
            <InboxButton />
            {right.map((t) => (
              <Tab key={t.to} {...t} />
            ))}
          </div>
        </nav>
      )}
      <Celebrations />
      <Toast />
    </>
  )
}

function Tab({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs ${isActive ? 'text-accent' : 'text-muted'}`}>
      <Icon d={icon} />
      {label}
    </NavLink>
  )
}

/** Gedanken-Inbox: von überall in einer Zeile festhalten, ohne die aktuelle Aufgabe zu verlassen. */
export function InboxButton() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-1 justify-center">
      <button type="button" aria-label="Gedanken festhalten" onClick={() => setOpen(true)} className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-xl ring-1 ring-line active:scale-95">
        💭
      </button>
      <InboxSheet open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

export function InboxSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useApp((s) => s.addInbox)
  const update = useApp((s) => s.updateInbox)
  const [text, setText] = useState('')
  const [saved, setSaved] = useState<{ id: string; was: string; planned?: boolean }>()
  const submit = async () => {
    if (!text.trim()) return
    const a = nextNow().action
    const was = a.title
    // Gedanken werden synchronisiert, Arbeitsinhalte nicht: Der Hinweis erscheint, wird aber nicht gespeichert
    const isWork = a.type === 'worktask' || (a.type === 'resume' && a.resume.kind === 'work')
    const id = await add(text, isWork ? undefined : was)
    setText('')
    if (id) setSaved({ id, was })
  }
  const close = () => {
    setSaved(undefined)
    onClose()
  }
  if (saved) {
    // Kein weiteres Entscheiden nötig: gespeichert, und zurück dorthin, wo du warst
    return (
      <Sheet open={open} onClose={close} title="Gespeichert">
        <p className="text-muted">Du warst bei:</p>
        <p className="mb-5 text-2xl font-semibold leading-snug">{saved.was}</p>
        <Button variant="primary" size="xl" className="w-full" onClick={close}>
          Weiter
        </Button>
        <button
          type="button"
          disabled={saved.planned}
          className="mt-2 min-h-11 w-full text-sm text-muted"
          onClick={async () => {
            await update(saved.id, { status: 'task', taskDate: addDays(today(), 1), estimateMin: 5 })
            setSaved({ ...saved, planned: true })
          }}
        >
          {saved.planned ? 'Für morgen eingeplant' : 'Lieber für morgen einplanen'}
        </button>
      </Sheet>
    )
  }
  return (
    <Sheet open={open} onClose={close} title="Gedanke festhalten">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-3"
      >
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Was ist dir gerade eingefallen?"
          enterKeyHint="done"
          className="min-h-14 w-full rounded-2xl bg-surface-2 px-4 text-lg placeholder:text-muted"
        />
        <Button type="submit" variant="primary" size="lg" className="w-full">
          Merken
        </Button>
        <p className="text-center text-sm text-muted">Bleibt erst mal geparkt. Abends schaust du kurz drüber.</p>
      </form>
    </Sheet>
  )
}

function Celebrations() {
  const list = useApp((s) => s.celebrations)
  const pop = useApp((s) => s.popCelebration)
  const themeId = useApp((s) => s.settings.themeId)
  const c = list[0]
  if (!c) return null
  if (c.kind === 'xp') return <XpChip key={list.length + c.title} text={c.title} onDone={pop} />
  const emoji = c.kind === 'chapter' ? '🏅' : c.kind === 'level' ? getTheme(themeId).emoji : c.kind === 'restart' ? '🌱' : c.kind === 'stage' ? '🧭' : '✨'
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label={c.title}>
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 text-center animate-pop">
        <div className="mb-3 text-6xl" aria-hidden="true">
          {emoji}
        </div>
        <h2 className="text-2xl font-semibold">{c.title}</h2>
        {c.text && <p className="mt-2 text-lg text-muted">{c.text}</p>}
        <Button variant="primary" size="lg" className="mt-6 w-full" onClick={pop}>
          {c.kind === 'restart' ? 'Weiter' : 'Stark!'}
        </Button>
      </div>
    </div>
  )
}

function XpChip({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 1400)
    return () => clearTimeout(id)
  }, [onDone])
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center" aria-live="polite">
      <span className="animate-rise rounded-full bg-accent px-4 py-2 font-semibold text-accent-ink shadow-lg">{text}</span>
    </div>
  )
}

function Toast() {
  const t = useApp((s) => s.toast)
  if (!t) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4" aria-live="polite">
      <span className="rounded-2xl bg-text px-4 py-3 text-bg shadow-lg">{t}</span>
    </div>
  )
}

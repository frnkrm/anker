import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { addDays } from '../../core/time'
import type { ResumePoint } from '../../core/types'
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

const FULLSCREEN = ['/fokus', '/aufgabe', '/wecker/klingelt', '/start', '/druck']

export function Shell({ children }: { children: ReactNode }) {
  const loc = useLocation()
  const full = FULLSCREEN.some((p) => loc.pathname.startsWith(p))
  const activeTest = useApp((s) => s.local.deviceTests?.activeId)
  const quietPage = activeTest !== undefined || ['/abend', '/schlaf', '/einstellungen/abenduebergang', '/geraetetest'].includes(loc.pathname)
  // Spiel ausblenden, wenn abgeschaltet oder überlastet. Es läuft im Hintergrund unverändert weiter.
  const gameVisible = useApp((s) => s.settings.support.gameVisible && s.days[today()]?.override.mode !== 'ueberlastet')
  const right = TABS.slice(2).filter((t) => gameVisible || t.to !== '/spiel')
  return (
    <>
      {activeTest !== undefined && !['/geraetetest', '/wecker/klingelt', '/druck', '/start'].includes(loc.pathname) && (
        <aside aria-label="Testbegleitung" className="no-print mx-auto flex max-w-xl flex-wrap items-center gap-2 px-4 pt-2">
          <Link to={`/geraetetest?fall=${activeTest}`} className="flex min-h-11 items-center rounded-xl bg-surface-2 px-3 text-accent">Zurück zu Test {activeTest}</Link>
          <Button size="sm" variant="ghost" onClick={() => void useApp.getState().saveDeviceTests((p) => ({ ...p, activeId: undefined })).catch(() => useApp.getState().showToast('Die Testpause konnte nicht gespeichert werden.'))}>Testbegleitung pausieren</Button>
        </aside>
      )}
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
      {!quietPage && <Celebrations />}
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
export function InboxButton({ context }: { context?: ResumePoint } = {}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-1 justify-center">
      <button type="button" aria-label="Gedanken festhalten" onClick={() => setOpen(true)} className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-xl ring-1 ring-line active:scale-95">
        💭
      </button>
      <InboxSheet open={open} onClose={() => setOpen(false)} context={context} />
    </div>
  )
}

export function InboxSheet({ open, onClose, context }: { open: boolean; onClose: () => void; context?: ResumePoint }) {
  const add = useApp((s) => s.addInbox)
  const update = useApp((s) => s.updateInbox)
  const saveDraft = useApp((s) => s.saveCaptureDraft)
  const [text, setText] = useState('')
  const [saved, setSaved] = useState<{ id: string; was: string; planned?: boolean }>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const was = useRef<ResumePoint | undefined>(undefined)
  useEffect(() => {
    if (!open) return
    const draft = useApp.getState().local.captureDraft
    const action = nextNow().action
    const work = action.type === 'worktask' || (action.type === 'resume' && action.resume.kind === 'work') || ['work', 'einsatz-start', 'einsatz-running', 'prep', 'go', 'underway', 'away'].includes(action.type)
    was.current = draft?.context ?? context ?? { kind: work ? 'work' : 'free', title: action.title, at: Date.now() }
    setText(draft?.text ?? '')
    setSaved(undefined); setError('')
    // Der tatsächliche Fokuskontext bleibt während dieser Erfassung stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const submit = async () => {
    if (!text.trim() || submitting.current) return
    submitting.current = true; setPending(true); setError('')
    try {
      const current = was.current
      await saveDraft(text, current)
      const id = await add(text, current?.kind === 'work' ? undefined : current?.title)
      setText('')
      if (id) setSaved({ id, was: current?.title ?? 'Deinem nächsten Schritt' })
    } catch { setError('Der Gedanke konnte nicht sicher gespeichert werden. Dein Text bleibt hier.') }
    finally { submitting.current = false; setPending(false) }
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
          onChange={(e) => {
            const value = e.target.value
            setText(value)
            void saveDraft(value, was.current).catch(() => setError('Der Entwurf konnte nicht gespeichert werden. Bitte behalte deinen Text bis zum Speichern hier.'))
          }}
          aria-label="Gedanke"
          placeholder="Was ist dir gerade eingefallen?"
          enterKeyHint="done"
          className="min-h-14 w-full rounded-2xl bg-surface-2 px-4 text-lg placeholder:text-muted"
        />
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending || !text.trim()}>
          {pending ? 'Wird gespeichert …' : 'Merken'}
        </Button>
        {error && <p role="alert" className="text-warm">{error}</p>}
        <p className="text-center text-sm text-muted">Bleibt erst mal geparkt. Abends schaust du kurz drüber.</p>
      </form>
    </Sheet>
  )
}

function Celebrations() {
  const list = useApp((state) => state.celebrations)
  const pop = useApp((state) => state.popCelebration)
  const visible = useApp((state) => state.settings.support.gameVisible && state.days[today()]?.override.mode !== 'ueberlastet')
  const celebration = list[0]
  if (!visible || !celebration) return null
  const text = celebration.kind === 'xp' ? celebration.title : `${celebration.title}${celebration.text ? ` ${celebration.text}` : ''} Mehr unter Spiel.`
  return <XpChip key={`${list.length}:${celebration.kind}:${celebration.title}`} text={text} onDone={pop} duration={celebration.kind === 'xp' ? 1400 : 5000} />
}

function XpChip({ text, onDone, duration }: { text: string; onDone: () => void; duration: number }) {
  useEffect(() => {
    const id = setTimeout(onDone, duration)
    return () => clearTimeout(id)
  }, [onDone, duration])
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center" aria-live="polite">
      <span className="mx-4 max-w-lg rounded-2xl bg-accent px-4 py-2 text-center font-semibold text-accent-ink shadow-lg">{text}</span>
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

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { isNative } from '../../platform/native'
import { exactAlarmStatus, notificationPermission } from '../../platform/notifications'
import { today, useApp } from '../../state/store'
import { Button, Page } from '../components/ui'

function SetupHint() {
  const [needed, setNeeded] = useState(false)
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('anker.setup-hint.dismissed') === '1' } catch { return false }
  })
  useEffect(() => {
    if (!isNative()) return
    let active = true
    const check = () => void Promise.all([notificationPermission(), exactAlarmStatus()])
      .then(([notifications, exact]) => { if (active) setNeeded(notifications !== 'granted' || exact !== 'granted') })
      .catch(() => undefined)
    check()
    document.addEventListener('visibilitychange', check)
    return () => { active = false; document.removeEventListener('visibilitychange', check) }
  }, [])
  if (!needed || hidden) return null
  return <aside role="status" className="flex items-start gap-2 rounded-2xl border border-line p-3 text-sm text-muted">
    <p className="min-w-0 flex-1">Für Erinnerungen oder Wecker ist die Einrichtung noch offen. Du findest sie unter Einstellungen.</p>
    <Button size="sm" variant="ghost" aria-label="Einrichtungshinweis ausblenden" onClick={() => {
      setHidden(true)
      try { localStorage.setItem('anker.setup-hint.dismissed', '1') } catch { /* Auch ohne Speicher ausblendbar. */ }
    }}>×</Button>
  </aside>
}

export default function More() {
  const gameVisible = useApp((state) => state.settings.support.gameVisible && state.days[today()]?.override.mode !== 'ueberlastet')
  const groups = [
    { title: 'Fokus & Arbeit', links: [{ title: 'Arbeit', icon: '💼', to: '/arbeit', sub: 'Aufgaben & Zeit' }, { title: 'Gedanken', icon: '💭', to: '/inbox', sub: 'Notieren & Aufgaben' }] },
    { title: 'Alltag', links: [{ title: 'Abend & Alltag', icon: '🌙', to: '/abend', sub: 'Routinen & Haushalt' }, { title: 'Orte & Wege', icon: '📍', to: '/orte', sub: 'Deine Ziele' }] },
    { title: 'Rückblick & Schlaf', links: [{ title: 'Rückblick', icon: '🗓️', to: '/rueckblick', sub: 'Woche & Schlaf' }, { title: 'Schlaf & Wecker', icon: '⏰', to: '/wecker', sub: 'Wecken & Überblick' }] },
    { title: 'Motivation & Einrichtung', links: [...(gameVisible ? [{ title: 'Spiel & Belohnungen', icon: '⭐', to: '/spiel', sub: 'Dein Fortschritt' }] : [{ title: 'Hilfe', icon: '🤝', to: '/hilfe', sub: 'Anlaufstellen' }]), { title: 'Einstellungen', icon: '⚙️', to: '/einstellungen', sub: 'Alles nach deiner Wahl' }] },
  ]
  return <Page title="Mehr">
    <SetupHint />
    <div className="space-y-3" data-more-hub>
      {groups.map((group) => <section key={group.title} className="space-y-2">
        <h2 className="px-1 text-sm text-muted">{group.title}</h2>
        <div className="grid grid-cols-2 gap-2">
          {group.links.map((item) => <Link key={item.to} to={item.to} className="flex min-h-24 min-w-0 flex-col justify-center gap-1 rounded-2xl border border-line bg-surface px-3 py-3 active:bg-surface-2">
            <span aria-hidden="true" className="text-xl">{item.icon}</span>
            <span className="break-words font-semibold">{item.title}</span>
            <span className="break-words text-xs text-muted">{item.sub}</span>
          </Link>)}
        </div>
      </section>)}
    </div>
  </Page>
}

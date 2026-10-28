import { useState } from 'react'
import { randomId } from '../../core/defaults'
import { balance, theme } from '../../core/game'
import { useApp } from '../../state/store'
import { Button, Card, Page, Section, Stepper, TextInput } from '../components/ui'

export default function Shop() {
  const st = useApp()
  const t = theme(st.settings.themeId)
  const have = balance(st.game)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState(500)

  return (
    <Page title="Belohnungen" back="/spiel">
      <Card className="text-center">
        <p className="text-4xl font-semibold tabular-nums">{have}</p>
        <p className="text-muted">{t.xpWord} verfügbar</p>
      </Card>
      <Section title="Einlösen">
        {st.settings.rewards.map((r) => (
          <div key={r.id} className="flex min-h-16 items-center gap-3 rounded-2xl bg-surface px-4 py-2">
            <div className="flex-1">
              <div className="font-medium">{r.title}</div>
              <div className="text-sm text-muted tabular-nums">
                {r.price} {t.xpWord}
              </div>
            </div>
            <Button variant={have >= r.price ? 'warm' : 'secondary'} disabled={have < r.price} onClick={() => st.redeem(r.id)}>
              {have >= r.price ? 'Einlösen' : `noch ${r.price - have}`}
            </Button>
            <button type="button" aria-label={`${r.title} entfernen`} className="h-10 w-10 rounded-xl text-muted" onClick={() => st.saveSettings((s) => ({ ...s, rewards: s.rewards.filter((x) => x.id !== r.id) }))}>
              ✕
            </button>
          </div>
        ))}
      </Section>
      <Section title="Eigene Belohnung">
        <Card className="space-y-3">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Neues Spiel kaufen" />
          <div className="flex items-center justify-between">
            <span>Preis</span>
            <Stepper label="Preis" value={price} step={100} min={100} max={20000} unit={t.xpWord} onChange={setPrice} />
          </div>
          <Button
            variant="primary"
            className="w-full"
            disabled={!title.trim()}
            onClick={async () => {
              await st.saveSettings((s) => ({ ...s, rewards: [...s.rewards, { id: randomId(), title: title.trim(), price }] }))
              setTitle('')
            }}
          >
            Hinzufügen
          </Button>
        </Card>
      </Section>
      {st.game.redeemed.length > 0 && (
        <Section title="Schon gegönnt">
          {[...st.game.redeemed].reverse().slice(0, 10).map((r) => (
            <p key={r.at} className="px-1 text-muted">
              {new Date(r.at).toLocaleDateString('de-DE')} · {r.title}
            </p>
          ))}
        </Section>
      )}
    </Page>
  )
}

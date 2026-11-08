import { useState } from 'react'
import { randomId } from '../../core/defaults'
import { balance, theme } from '../../core/game'
import { useApp } from '../../state/store'
import { HubContent } from '../components/HubContent'
import { Button, Card, MoreInfo, Section, Stepper, TextInput, notifySaved } from '../components/ui'

export default function Shop({ embedded = false }: { embedded?: boolean } = {}) {
  const st = useApp()
  const t = theme(st.settings.themeId)
  const have = balance(st.game)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState(500)
  const [error, setError] = useState('')
  const rewards = [...st.settings.rewards].sort((a, b) => Math.max(0, a.price - have) - Math.max(0, b.price - have) || a.price - b.price)
  const remove = async (id: string) => {
    const index = st.settings.rewards.findIndex((reward) => reward.id === id)
    const reward = st.settings.rewards[index]
    if (!reward) return
    try {
      await st.saveSettings((settings) => ({ ...settings, rewards: settings.rewards.filter((item) => item.id !== id) }))
      st.showToast('Belohnung entfernt.', { label: 'Rückgängig', run: () => st.saveSettings((settings) => ({ ...settings, rewards: settings.rewards.some((item) => item.id === id) ? settings.rewards : [...settings.rewards.slice(0, index), reward, ...settings.rewards.slice(index)] })) })
    } catch { setError('Die Belohnung konnte noch nicht entfernt werden.') }
  }
  return <HubContent title="Belohnungen" back="/spiel" embedded={embedded}>
    {!embedded && <Card className="text-center"><p className="text-4xl font-semibold tabular-nums">{have}</p><p className="text-muted">{t.xpWord} verfügbar</p></Card>}
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    <Section title="Einlösen">{rewards.map((reward) => <div key={reward.id} className="flex min-h-16 items-center gap-3 rounded-2xl bg-surface px-4 py-3">
      <div className="min-w-0 flex-1"><p className="break-words font-medium">{reward.title}</p><p className="text-sm tabular-nums text-muted">{reward.price} {t.xpWord}</p></div>
      <Button onClick={() => {
        if (have < reward.price) { st.showToast(`Für diese Belohnung fehlen noch ${reward.price - have} ${t.xpWord}. Alles bisher Gesammelte bleibt.`); return }
        void st.redeem(reward.id).catch(() => setError('Das Einlösen konnte noch nicht gespeichert werden.'))
      }}>{have >= reward.price ? 'Einlösen' : `noch ${reward.price - have}`}</Button>
    </div>)}</Section>
    <details className="space-y-3 rounded-2xl border border-line p-3"><summary className="min-h-11 py-2 font-medium">Belohnungen anpassen</summary>
      {st.settings.rewards.map((reward) => <div key={reward.id} className="flex min-h-12 items-center gap-2"><span className="min-w-0 flex-1 break-words">{reward.title}</span><Button size="sm" variant="ghost" aria-label={`${reward.title} entfernen`} onClick={() => void remove(reward.id)}>×</Button></div>)}
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault()
        if (!title.trim()) { setError('Gib deiner Belohnung einen Namen.'); return }
        try { await st.saveSettings((settings) => ({ ...settings, rewards: [...settings.rewards, { id: randomId(), title: title.trim(), price }] })); setTitle(''); setError(''); notifySaved() }
        catch { setError('Die Belohnung konnte noch nicht gespeichert werden.') }
      }}><TextInput aria-label="Eigene Belohnung" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="z. B. Neues Spiel kaufen" /><Stepper label="Preis" value={price} step={100} min={100} max={20000} unit={t.xpWord} onChange={setPrice} /><Button type="submit" variant="primary" className="w-full">Hinzufügen</Button></form>
    </details>
    {st.game.redeemed.length > 0 && <MoreInfo summary="Schon gegönnt">{[...st.game.redeemed].reverse().slice(0, 10).map((reward) => <p key={`${reward.at}:${reward.title}`} className="text-muted">{new Date(reward.at).toLocaleDateString('de-DE')} · {reward.title}</p>)}</MoreInfo>}
  </HubContent>
}

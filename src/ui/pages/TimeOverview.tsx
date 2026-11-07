import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { TIME_CATEGORIES, TIME_EFFECT_LABELS, TIME_STATUS_LABELS, currentTimeCatalog, type TimeCatalogEntry, type TimeCatalogRuntime, type TimeCategory } from '../../core/timeCatalog'
import { todayBerlin } from '../../core/time'
import { BedtimeNative } from '../../platform/bedtimePrompt'
import { AnkerNative, isNative } from '../../platform/native'
import { useNow } from '../../state/hooks'
import { today, useApp } from '../../state/store'
import { Button, Card, Page, Section, Segmented } from '../components/ui'

const dateLabel = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' })
const timeLabel = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })
const sources: Record<TimeCatalogEntry['source']['kind'], string> = { alarm: 'Weckerregel', reminder: 'Erinnerungsregel', plan: 'Tagesplan', task: 'Aufgabe', timer: 'Bewusst gestarteter Timer', optional: 'Optionale Hilfe', native: 'Android-Status' }
const PAGE_SIZE = 40

function Entry({ entry }: { entry: TimeCatalogEntry }) {
  return <li className="min-w-0 border-b border-line last:border-0">
    <details className="min-w-0 py-2">
      <summary className="min-h-12 cursor-pointer space-y-1 py-2">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="shrink-0 font-medium tabular-nums">{entry.at === undefined ? 'Ohne feste Uhrzeit' : <><time dateTime={new Date(entry.at).toISOString()}>{timeLabel.format(entry.at)}</time>{entry.endAt !== undefined && entry.endAt > entry.at && <> – <time dateTime={new Date(entry.endAt).toISOString()}>{timeLabel.format(entry.endAt)}</time></>}</>}</span>
          <span className="min-w-0 flex-1 break-words font-medium">{entry.label}</span>
        </span>
        <span className="block break-words text-sm text-muted">{TIME_CATEGORIES[entry.category]} · {TIME_STATUS_LABELS[entry.status]} · {entry.evidence === 'native-snapshot' ? 'Nativer Status ausgelesen' : 'Berechnet'}</span>
      </summary>
      <div className="space-y-2 pb-3 text-sm">
        <dl className="space-y-1 text-muted">
          <div><dt className="inline font-medium">Quelle: </dt><dd className="inline">{sources[entry.source.kind]}</dd></div>
          <div><dt className="inline font-medium">Wirkung: </dt><dd className="inline">{TIME_EFFECT_LABELS[entry.effect]}</dd></div>
          {entry.source.date && <div><dt className="inline font-medium">Plantag: </dt><dd className="inline">{entry.source.date}</dd></div>}
          {entry.observedAt !== undefined && <div><dt className="inline font-medium">Nativer Stand gelesen: </dt><dd className="inline">{dateLabel.format(entry.observedAt)}, {timeLabel.format(entry.observedAt)}</dd></div>}
        </dl>
        {entry.reason && <p className="break-words text-muted">{entry.reason}</p>}
        <Link className="inline-flex min-h-11 items-center py-2 text-accent underline" to={entry.source.route} aria-label={`Quelle öffnen: ${entry.label}`}>Quelle öffnen</Link>
      </div>
    </details>
  </li>
}

/** Eine lokale, abgeleitete Übersicht. Lesen startet keine Hilfe und verändert keine Quelle. */
export default function TimeOverview() {
  const st = useApp()
  useNow(30_000) // Anzeige anstoßen; die Cacheprüfung braucht den aktuellen Zeitpunkt dieses Renders.
  const now = Date.now()
  const snapshot = currentTimeCatalog(st, now)
  const [range, setRange] = useState<'today' | 'next'>('today')
  const [category, setCategory] = useState<TimeCategory | 'all'>('all')
  const [status, setStatus] = useState<TimeCatalogEntry['status'] | 'all'>('all')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [ruleLimit, setRuleLimit] = useState(PAGE_SIZE)
  const [suggestionLimit, setSuggestionLimit] = useState(5)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [nativeNote, setNativeNote] = useState('')
  const pending = useRef(false)
  const refreshCatalog = st.refreshTimeCatalog
  const refresh = useCallback(async () => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setNativeNote('')
    try {
      const runtime: TimeCatalogRuntime = {}
      try {
        const date = today()
        const raw = localStorage.getItem(`anker.tidy.${date}`)
        const startedAt = raw === null ? NaN : Number(raw)
        if (Number.isFinite(startedAt) && startedAt > 0) runtime.tidy = { date, startedAt }
      } catch { /* Ein fehlender optionaler Aufräumtimer erzeugt keine erfundene Zeit. */ }
      if (isNative()) {
        const [alarm, bedtime] = await Promise.allSettled([
          AnkerNative.getAlarmState().then((state) => ({ observedAt: Date.now(), state })),
          BedtimeNative.getBedtimePromptState().then((state) => ({ observedAt: Date.now(), state })),
        ] as const)
        if (alarm.status === 'fulfilled') runtime.alarm = alarm.value
        if (bedtime.status === 'fulfilled') runtime.bedtimePrompt = bedtime.value
        if (alarm.status === 'rejected' || bedtime.status === 'rejected') setNativeNote('Der Android-Status war nicht vollständig lesbar. Berechnete Zeiten bleiben als solche gekennzeichnet.')
      }
      await refreshCatalog(runtime)
    } catch { setError('Die Zeitübersicht konnte nicht sicher aktualisiert werden. Deine Einstellungen und Aufgaben bleiben erhalten.') }
    finally { pending.current = false; setBusy(false) }
  }, [refreshCatalog])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { if (!snapshot && !busy && !error) void refresh() }, [snapshot, busy, error, refresh])

  const filtered = useMemo(() => (snapshot?.entries ?? []).filter((entry) => (category === 'all' || entry.category === category) && (status === 'all' || entry.status === status)), [snapshot, category, status])
  const calendarDate = todayBerlin(now)
  const timed = filtered.filter((entry) => entry.at !== undefined && (range === 'today' ? todayBerlin(entry.at) === calendarDate : entry.at >= now)).sort((a, b) => a.at! - b.at!)
  const visible = timed.slice(0, limit)
  const dates = [...new Set(visible.map((entry) => todayBerlin(entry.at!)))]
  const rules = filtered.filter((entry) => entry.at === undefined)
  const selectedIds = new Set([...timed, ...rules].map((entry) => entry.id))
  const suggestions = snapshot?.suggestions.filter((suggestion) => suggestion.entryIds.some((id) => selectedIds.has(id)) || (!suggestion.entryIds.length && category === 'all' && status === 'all')) ?? []
  const resetLimits = () => { setLimit(PAGE_SIZE); setRuleLimit(PAGE_SIZE); setSuggestionLimit(5) }

  return <Page title="Zeitübersicht" back="/mehr">
    <p className="text-muted">Welche Zeiten zusammenwirken – aus deinen vorhandenen Einstellungen, Plänen und gestarteten Timern.</p>
    <details className="min-w-0 space-y-2">
      <summary className="min-h-11 cursor-pointer py-2 text-muted">Was die Übersicht zeigt</summary>
      <p className="text-sm text-muted">Alle Uhrzeiten sind Berliner Ortszeit. Berechnet, nativ geplant und tatsächlich zugestellt sind unterschiedliche Dinge. Ein ausgelesener Android-Status belegt keine hörbare oder sichtbare Zustellung. Auch vergangene Zeiten bestätigen keine Erledigung.</p>
      <p className="text-sm text-muted">Die Übersicht bleibt lokal. Öffnen oder Aktualisieren ändert keine Aufgabe, Arbeitszeit, XP, Weckzeit oder Freigabe. Bedingte Hilfen erhalten keine erfundene Uhrzeit.</p>
    </details>

    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted">{snapshot ? `Berechnet: ${dateLabel.format(snapshot.generatedAt)}, ${timeLabel.format(snapshot.generatedAt)}` : busy ? 'Übersicht wird berechnet …' : 'Noch keine aktuelle Übersicht'}</p>
      <Button size="sm" className="min-h-11" disabled={busy} onClick={() => void refresh()}>Ansicht aktualisieren</Button>
    </div>
    {error && <p role="alert" className="text-sm text-warm">{error}</p>}
    {nativeNote && <p role="status" className="text-sm text-muted">{nativeNote}</p>}

    <Segmented<'today' | 'next'> label="Zeitraum" value={range} options={[{ value: 'today', label: 'Heute' }, { value: 'next', label: 'Demnächst' }]} onChange={(value) => { setRange(value); resetLimits() }} />
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="min-w-0 space-y-1"><span className="text-sm text-muted">Kategorie</span><select aria-label="Kategorie" value={category} onChange={(event) => { setCategory(event.target.value as TimeCategory | 'all'); resetLimits() }} className="min-h-12 w-full min-w-0 rounded-xl bg-surface-2 px-3"><option value="all">Alle Kategorien</option>{Object.entries(TIME_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="min-w-0 space-y-1"><span className="text-sm text-muted">Status</span><select aria-label="Status" value={status} onChange={(event) => { setStatus(event.target.value as TimeCatalogEntry['status'] | 'all'); resetLimits() }} className="min-h-12 w-full min-w-0 rounded-xl bg-surface-2 px-3"><option value="all">Alle Zustände</option>{Object.entries(TIME_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>

    {!!suggestions.length && <Section title="Zusammenhänge prüfen">
      {suggestions.slice(0, suggestionLimit).map((suggestion) => <Card key={suggestion.id} className="min-w-0 space-y-2"><h3 className="break-words font-medium">{suggestion.title}</h3><p className="break-words text-sm text-muted">{suggestion.detail}</p><Link className="inline-flex min-h-11 items-center text-accent underline" to={suggestion.route}>Einstellung prüfen</Link></Card>)}
      {suggestions.length > suggestionLimit && <Button onClick={() => setSuggestionLimit((current) => current + 5)}>Weitere Prüfpunkte anzeigen ({suggestions.length - suggestionLimit})</Button>}
      <p className="text-sm text-muted">Das sind Hinweise zum Prüfen. Anker schaltet dadurch keine Hilfe aus und verschiebt keine Zeit. Änderungen bestätigst du in der jeweiligen Einstellung.</p>
    </Section>}

    <div aria-busy={busy} className="space-y-4">
      {snapshot && !timed.length && <p role="status" className="text-muted">Für diese Auswahl gibt es {range === 'today' ? 'heute' : 'demnächst'} keine festen Zeiten.</p>}
      {dates.map((date) => <Section key={date} title={dateLabel.format(new Date(`${date}T12:00:00Z`))}><ol aria-label={`Zeiten am ${date}`} className="min-w-0 rounded-2xl border border-line bg-surface px-3">{visible.filter((entry) => todayBerlin(entry.at!) === date).map((entry) => <Entry key={entry.id} entry={entry} />)}</ol></Section>)}
      {timed.length > limit && <Button className="w-full" onClick={() => setLimit((current) => current + PAGE_SIZE)}>Weitere Zeiten anzeigen ({timed.length - limit})</Button>}
    </div>

    {!!rules.length && <details open={rulesOpen} onToggle={(event) => setRulesOpen(event.currentTarget.open)} className="min-w-0 space-y-3"><summary className="min-h-12 cursor-pointer py-3 font-medium">Ohne feste Uhrzeit & abgestimmte Hilfen ({rules.length})</summary><p className="text-sm text-muted">Diese Quellen sind bedingt, pausiert oder nicht aktiv. Ihre Bedeutung steht bei der jeweiligen Quelle.</p><ul className="min-w-0 rounded-2xl border border-line bg-surface px-3">{rules.slice(0, ruleLimit).map((entry) => <Entry key={entry.id} entry={entry} />)}</ul>{rules.length > ruleLimit && <Button onClick={() => setRuleLimit((current) => current + PAGE_SIZE)}>Weitere Quellen anzeigen ({rules.length - ruleLimit})</Button>}</details>}
  </Page>
}

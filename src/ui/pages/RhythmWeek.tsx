import { useState } from 'react'
import { addDays, fmtTime, utcToZoned, zonedToUtc } from '../../core/time'
import { planFor, today, useApp } from '../../state/store'
import { Button, Card, Page, Segmented } from '../components/ui'

const stamp = (at?: number) => at === undefined ? 'ohne Eintrag' : fmtTime(utcToZoned(at).minutes)
const dayLabel = (date: string) => new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }).format(zonedToUtc(date, 12 * 60))

/** A read-only projection of existing plans, confirmations and the private sleep diary. */
export default function RhythmWeek() {
  const st = useApp()
  const [count, setCount] = useState<7 | 14>(7)
  const [table, setTable] = useState(false)
  const dates = Array.from({ length: count }, (_, index) => addDays(today(), index - count + 1))
  const rows = dates.map(date => {
    const next = addDays(date, 1)
    const plan = planFor(date, st)
    const morning = planFor(next, st)
    const log = st.days[date]
    const diary = st.local.sleepDiary[date]
    const plannedWake = zonedToUtc(next, morning.wake)
    const wake = st.days[next]?.wakeAt ?? diary?.wakeAt
    const tolerance = morning.dayType === 'work' ? st.settings.anchor.wakeToleranceMin : st.settings.anchor.weekendToleranceMin
    return { date, plannedPc: plan.openEnd ? undefined : zonedToUtc(date, plan.pcStop), pc: log?.pcOffAt,
      plannedBed: plan.openEnd ? undefined : zonedToUtc(date, plan.bed), bed: log?.bedAt ?? diary?.bedAt,
      plannedWake, wake, tolerance, within: wake === undefined ? undefined : Math.abs(wake - plannedWake) <= tolerance * 60_000,
      start: zonedToUtc(date, 20 * 60), end: zonedToUtc(next, 9 * 60) }
  })
  const known = rows.filter(row => row.wake !== undefined)
  const within = known.filter(row => row.within).length
  return <Page title="Deine Rhythmus-Woche" back="/abend">
    <p className="text-muted">Plan und tatsächliche Einträge nebeneinander. Die Planmarken folgen deinen aktuellen Einstellungen; frühere Wochenregeln werden nicht erfunden.</p>
    <Segmented label="Zeitraum der Rhythmusansicht" value={count} onChange={setCount} options={[{ value: 7, label: '7 Tage' }, { value: 14, label: '14 Tage' }]} />
    <Button className="w-full" aria-pressed={table} onClick={() => setTable(value => !value)}>{table ? 'Als Zeitachse anzeigen' : 'Als Tabelle anzeigen'}</Button>
    {table ? <div className="min-w-0"><table className="w-full table-fixed border-collapse text-left text-sm" aria-label="Geplant und tatsächlich">
      <caption className="mb-3 text-left text-muted">Zeiten in Berlin. „Offen“ bedeutet, dass kein fester Abendabschluss geplant ist.</caption>
      {rows.map(row => <tbody key={row.date} className="border-b border-line">
        <tr><th colSpan={2} className="break-words pt-4 pb-2 text-base font-semibold">Nacht ab {dayLabel(row.date)}</th></tr>
        {[
          ['PC-Stopp', row.plannedPc, row.pc], ['Bett', row.plannedBed, row.bed], ['Aufstehen', row.plannedWake, row.wake],
        ].map(([label, planned, actual]) => <tr key={String(label)}><th scope="row" className="w-1/3 break-words py-2 pr-2 align-top font-medium">{label}</th><td className="break-words py-2 align-top">Plan {planned === undefined ? 'offen' : stamp(Number(planned))}<br />Tatsächlich {actual === undefined ? 'ohne Eintrag' : stamp(Number(actual))}</td></tr>)}
        <tr><th scope="row" className="break-words py-2 pr-2 align-top font-medium">Eigener Rahmen</th><td className="break-words py-2">Aufstehen ±{row.tolerance} min</td></tr>
      </tbody>)}
    </table></div> : <>
      <p className="text-sm text-muted">Feine Markierung = Plan · Punkt = tatsächlicher Eintrag. PC in Grün, Bett in Bernstein, Aufstehen in Blau. Das eigene Aufstehfenster ist als Band hinterlegt.</p>
      <ol className="space-y-3" aria-label="Nächte im Überblick">{rows.map(row => {
        const x = (at: number) => Math.max(8, Math.min(592, 8 + (at - row.start) / (row.end - row.start) * 584))
        const outside = [row.pc, row.bed, row.wake].some(at => at !== undefined && (at < row.start || at > row.end))
        const points = [{ label: 'PC', planned: row.plannedPc, actual: row.pc, color: 'var(--accent)' }, { label: 'Bett', planned: row.plannedBed, actual: row.bed, color: 'var(--warm)' }, { label: 'Aufstehen', planned: row.plannedWake, actual: row.wake, color: 'var(--rhythm-wake)' }]
        const bandFrom = x(row.plannedWake - row.tolerance * 60_000)
        const bandTo = x(row.plannedWake + row.tolerance * 60_000)
        return <li key={row.date}><Card className="min-w-0 space-y-2">
          <h2 className="font-semibold">Nacht ab {dayLabel(row.date)}</h2>
          <div className="flex justify-between text-xs text-muted" aria-hidden="true"><span>20 Uhr</span><span>0 Uhr</span><span>4 Uhr</span><span>9 Uhr</span></div>
          <svg className="h-14 w-full overflow-visible" viewBox="0 0 600 56" role="img" aria-label={`PC ${stamp(row.pc)}, Bett ${stamp(row.bed)}, Aufstehen ${stamp(row.wake)}; geplanter Weckanker ${stamp(row.plannedWake)} mit ${row.tolerance} Minuten eigenem Rahmen`}>
            <line x1="8" x2="592" y1="28" y2="28" stroke="var(--line)" strokeWidth="2" />
            <rect x={bandFrom} y="8" width={Math.max(2, bandTo - bandFrom)} height="40" rx="5" fill="var(--accent-soft)" />
            {points.map((point, index) => <g key={point.label}>{point.planned !== undefined && <line x1={x(point.planned)} x2={x(point.planned)} y1={5 + index * 3} y2={47 - index * 3} stroke={point.color} strokeWidth="2" strokeDasharray="3 3" />}{point.actual !== undefined && <circle cx={x(point.actual)} cy={18 + index * 10} r="6" fill={point.color}><title>{point.label}: {stamp(point.actual)}</title></circle>}</g>)}
          </svg>
          <p className="break-words text-sm text-muted">PC {stamp(row.pc)} · Bett {stamp(row.bed)} · Aufstehen {stamp(row.wake)}</p>
          {outside && <p className="text-xs text-muted">Ein Eintrag liegt außerhalb der Achse. Den genauen Wert zeigt die Tabelle.</p>}
        </Card></li>
      })}</ol>
    </>}
    <div className="space-y-2 rounded-2xl bg-surface p-4 text-sm text-muted" aria-label="Einordnung deiner Einträge">
      <p>{known.length ? `Aufstehen lag an ${within} von ${known.length} Tagen mit Eintrag in deinem eigenen Rahmen.` : 'Für diese Nächte gibt es noch keine Aufsteh-Einträge.'}</p>
      {known.length < count && <p>{count - known.length} {count - known.length === 1 ? 'Tag ohne Aufsteh-Eintrag' : 'Tage ohne Aufsteh-Eintrag'}.</p>}
    </div>
  </Page>
}

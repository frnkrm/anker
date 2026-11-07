/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { defaultSettings, emptyLocal } from '../src/core/defaults'
import { DEVICE_TEST_SUITE } from '../src/core/deviceTests'
import { makeBackup } from '../src/core/export/backup'
import { initialGame } from '../src/core/game'
import type { GameState, LocalData, Settings } from '../src/core/types'
import type { Rec } from '../src/data/types'
import { storedRecord } from './helpers/storage'

const old = Date.parse('2026-11-02T10:00:00+01:00')
const now = old + 86_400_000
const record = (collection: Rec['collection'], data: unknown): Rec => ({ collection, id: collection === 'meta' ? 'local' : 'main', data, updated_at: old, deleted: false })
async function choose(page: Page, records: Rec[]) {
  const picker = page.waitForEvent('filechooser')
  await page.getByRole('button', { name:'Sicherung importieren',exact:true }).click()
  await (await picker).setFiles({ name:'eigene-sicherung.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(makeBackup(records))) })
  await expect(page.getByRole('heading',{name:'Vor dem Import prüfen',exact:true})).toBeVisible()
}
const settings = () => ({ ...defaultSettings('2026-11-02'),onboarded:true,bed:1470,themeId:'piraten' as const })

test('Vorhandene Sicherung ist vor Ersteinrichtung erreichbar; Daten und alte Berichte kommen erst nach bewusster Wiederherstellung',async ({page}) => {
  await page.clock.setFixedTime(new Date(now))
  await page.setViewportSize({ width:320,height:844 })
  await page.goto('/start')
  await expect(page.getByRole('heading',{name:'Hallo! ⚓',exact:true})).toBeVisible()
  await page.evaluate(() => document.documentElement.style.fontSize='160%')
  expect(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
  expect((await page.getByLabel('Arbeitsbeginn',{exact:true}).boundingBox())!.width).toBeCloseTo(160,0)
  await page.getByRole('link',{name:'Vorhandene Sicherung übernehmen',exact:true}).click()
  await expect(page).toHaveURL(/\/backup\?wiederherstellen=1$/)
  await expect(page.getByRole('checkbox',{name:'Werte aus dieser Sicherung wiederherstellen',exact:true})).toBeChecked()
  const oldReport = { result:'passed',at:old,note:'Damals gehört',platform:'android',device:'Mein Handy',os:'API36',appVersion:'alt',build:'9',suiteVersion:DEVICE_TEST_SUITE,buildFingerprint:'originaler-alter-code' }
  const incoming = [record('settings',settings()),record('game',{...initialGame('2026-11-02'),xp:37}),record('meta',{...emptyLocal(),work:[{id:'task',title:'Mein ursprünglicher Auftrag',createdAt:old}],deviceTests:{reports:{1:oldReport}}})]
  await choose(page,incoming)
  expect(await storedRecord(page,'settings','main')).toBeUndefined()
  expect((await storedRecord<LocalData>(page,'meta','local'))?.work ?? []).toEqual([])
  await page.getByRole('button',{name:'Sicherung jetzt wiederherstellen',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('3 Einträge aus der Sicherung wiederhergestellt')
  const restored = await storedRecord<Settings>(page,'settings','main')
  expect(restored?.themeId).toBe('piraten')
  expect(restored?.bed).toBe(1470)
  expect((await storedRecord<GameState>(page,'game','main'))?.xp).toBe(37)
  const local = await storedRecord<LocalData>(page,'meta','local')
  expect(local?.work[0]?.title).toBe('Mein ursprünglicher Auftrag')
  expect(local?.workSessions).toEqual([])
  expect(local?.deviceTests?.reports[1]).toBeUndefined()
  expect(local?.deviceTests?.history?.[1]).toContainEqual(oldReport)
  expect(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
  await page.reload()
  expect((await storedRecord<Settings>(page,'settings','main'))?.bed).toBe(1470)
  expect((await storedRecord<GameState>(page,'game','main'))?.xp).toBe(37)
})

test('Normaler Import überspringt alte Werte; die zusätzliche Wiederherstellungswahl zeigt neue Vorschau und bleibt abbrechbar',async ({page}) => {
  await page.clock.setFixedTime(new Date(now))
  await page.goto('/start')
  await page.getByRole('button',{name:'Weiter',exact:true}).click()
  await page.getByRole('button',{name:/Passt, los/}).click()
  await expect(page).toHaveURL(/\/$/)
  const before = await storedRecord<Settings>(page,'settings','main')
  await page.goto('/backup')
  const checkbox = page.getByRole('checkbox',{name:'Werte aus dieser Sicherung wiederherstellen',exact:true})
  await expect(checkbox).not.toBeChecked()
  const incoming = [record('settings',settings())]
  await choose(page,incoming)
  await expect(page.getByRole('button',{name:'Jetzt importieren',exact:true})).toBeDisabled()
  // Eine echte offene IDB-Transaktion hält die neue Vorschau zurück, ohne Produktfunktionen zu mocken.
  await page.evaluate(() => new Promise<void>((resolve,reject) => {
    const state = window as unknown as { holdBackupModePreview:boolean }
    state.holdBackupModePreview = true
    const open = indexedDB.open('anker')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction('records','readwrite')
      transaction.oncomplete = () => db.close()
      const records = transaction.objectStore('records')
      const keep = () => { const read = records.get(['settings','main']); read.onsuccess = () => { if (state.holdBackupModePreview) keep() } }
      keep();resolve()
    }
  }))
  try {
    await checkbox.check()
    await expect(checkbox).toBeChecked()
    await expect(page.getByRole('button',{name:'Sicherung jetzt wiederherstellen',exact:true})).toBeDisabled()
    await expect(page.getByRole('button',{name:'Sicherung exportieren',exact:true})).toBeDisabled()
    await expect(page.getByText(/Einträge aus der Sicherung wiederhergestellt/)).toHaveCount(0)
  } finally {
    await page.evaluate(() => { (window as unknown as { holdBackupModePreview:boolean }).holdBackupModePreview = false })
  }
  await expect(page.getByText(/1 Einträge gelesen · 1 zur Wiederherstellung/)).toBeVisible()
  await page.getByRole('button',{name:'Abbrechen',exact:true}).click()
  expect(await storedRecord<Settings>(page,'settings','main')).toEqual(before)
  await choose(page,incoming)
  await page.getByRole('button',{name:'Sicherung jetzt wiederherstellen',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('1 Einträge aus der Sicherung wiederhergestellt')
  expect((await storedRecord<Settings>(page,'settings','main'))?.themeId).toBe('piraten')
})

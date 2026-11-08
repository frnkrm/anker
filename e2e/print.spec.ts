/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import type { Settings } from '../src/core/types'
import type { PrintDocumentSheet } from '../src/core/print'

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-06T10:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function savedSettings(page: Page): Promise<Settings> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const read = db.transaction('records').objectStore('records').get(['settings', 'main'])
      read.onsuccess = () => { resolve(read.result.data as Settings); db.close() }
      read.onerror = () => { reject(read.error); db.close() }
    }
  }))
}

test('Routinen öffnen direkt ihre Druckauswahl; QR und andere Auswahl ändern keine gespeicherten Daten', async ({ page }) => {
  await onboard(page)
  const before = await savedSettings(page)
  for (const [routine, title] of [['morning', 'Morgenroutine'], ['evening', 'Abendroutine']] as const) {
    await page.goto(`/fokus/${routine}`)
    await page.getByText('Weitere Möglichkeiten', { exact: true }).click()
    await page.getByRole('link', { name: `${title} drucken`, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/druck\\?typ=${routine}$`))
    await expect(page.locator('[data-sheet]')).toHaveCount(1)
    await expect(page.locator(`[data-sheet="${routine}"]`)).toBeVisible()
  }
  await page.goto('/wecker')
  await page.getByRole('link', { name: 'Drucken', exact: true }).click()
  await expect(page.locator('[data-sheet="qr"] [data-qr-ready="true"] svg')).toBeVisible()
  const qr = page.getByRole('img', { name: 'Wecker-QR-Code', exact: true })
  const viewBox = (await qr.locator('svg').getAttribute('viewBox'))!.split(' ').map(Number)
  expect(viewBox[2]).toBeGreaterThanOrEqual(29) // At least21 data modules plus4 white modules per side.
  for (const [choice, ids] of [['Beide Routinen', ['morning', 'evening']], ['Haustür-Check', ['door']], ['QR-Code', ['qr']]] as const) {
    await page.getByRole('radio', { name: choice, exact: true }).click()
    await expect(page.locator('[data-sheet]')).toHaveCount(ids.length)
    for (const id of ids) await expect(page.locator(`[data-sheet="${id}"]`)).toBeVisible()
  }
  expect(await savedSettings(page)).toEqual(before)
})

test('Lange Routine und große Schrift liefern mehrere A5/A4-Seiten ohne Drucknavigation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await onboard(page)
  const items = Array.from({ length: 90 }, (_, i) => ({ id: `paper-${i}`, title: i === 89 ? 'Letzter Testschritt: Alles vollständig erhalten.' : i % 3 ? `Schritt ${i + 1}: Äpfel, Öl und Grüße bereitstellen und anschließend ruhig weitermachen.` : 'Gleicher Schritt', minutes: 1 }))
  await page.evaluate(({ items }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('records', 'readwrite')
      const store = transaction.objectStore('records')
      const read = store.get(['settings', 'main'])
      read.onsuccess = () => {
        const record = read.result as { data: Settings }
        record.data.routines.morning = items
        record.data.appearance.fontScale = 1.6
        store.put(record)
      }
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onerror = () => { db.close(); reject(transaction.error) }
    }
  }), { items })
  await page.goto('/druck?typ=morning')
  await expect(page.locator('[data-sheet="morning"] li')).toHaveCount(90)
  await expect(page.getByText('Letzter Testschritt: Alles vollständig erhalten.', { exact: true })).toBeVisible()
  // Große Überschriften müssen auch auf schmalen Displays mit unterschiedlichen Systemschriften umbrechen.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await page.evaluate(() => {
    const overlay = document.createElement('aside')
    overlay.setAttribute('data-test-overlay', '')
    overlay.textContent = 'Dieser App-Hinweis gehört nicht auf Papier'
    document.getElementById('root')!.appendChild(overlay)
  })
  for (const paper of ['A5', 'A4'] as const) {
    await page.emulateMedia({ media: 'screen' })
    await page.getByRole('radio', { name: paper, exact: true }).click()
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('button', { name: /Drucken oder als PDF/ })).toBeHidden()
    await expect(page.locator('[data-test-overlay]')).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0)
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    }
    const path = testInfo.outputPath(`long-${paper}.pdf`)
    const pdf = await page.pdf({ path, preferCSSPageSize: true, printBackground: true })
    const raw = pdf.toString('latin1')
    expect(raw.startsWith('%PDF-')).toBe(true)
    expect((raw.match(/\/Type\s*\/Page(?:\s|\/|>)/g) ?? []).length).toBeGreaterThan(2)
    const box = /\/MediaBox\s*\[([\d.\s]+)\]/.exec(raw)![1]!.trim().split(/\s+/).map(Number)
    expect(box[2]).toBeGreaterThan(paper === 'A5' ? 417 : 592)
    expect(box[2]).toBeLessThan(paper === 'A5' ? 423 : 598)
    expect(box[3]).toBeGreaterThan(paper === 'A5' ? 592 : 839)
    expect(box[3]).toBeLessThan(paper === 'A5' ? 598 : 845)
    await testInfo.attach(`Lange Routine ${paper}`, { path, contentType: 'application/pdf' })
  }
})

interface PrintProbe { calls: { plugin: string; method: string; options: { sheets?: PrintDocumentSheet[]; uri?: string } }[] }

/** Adapter protocol simulation only; the repository remains Web IndexedDB, not Android SQLite. */
async function mockPrintAdapter(page: Page, opened: boolean, shareCancelled: boolean) {
  await page.addInitScript(({ opened, shareCancelled }) => {
    const probe: PrintProbe = { calls: [] }
    Object.assign(window, {
      __printProbe: probe,
      CapacitorCustomPlatform: { name: 'web' },
      Capacitor: {
        PluginHeaders: [
          { name: 'AnkerNative', methods: ['printPage', 'exportPrintPdf'].map((name) => ({ name, rtype: 'promise' })) },
          { name: 'Share', methods: [{ name: 'share', rtype: 'promise' }] },
        ],
        async nativePromise(plugin: string, method: string, options: PrintProbe['calls'][number]['options']) {
          probe.calls.push({ plugin, method, options })
          if (plugin === 'AnkerNative' && method === 'printPage') return { opened }
          if (plugin === 'AnkerNative' && method === 'exportPrintPdf') return { uri: 'file:///test-cache/anker-druck.pdf', pages: 1 }
          if (plugin === 'Share' && method === 'share') {
            if (shareCancelled) throw new Error('Share cancelled')
            return { activityType: '' }
          }
          throw new Error('Unexpected adapter call')
        },
      },
    })
  }, { opened, shareCancelled })
  await onboard(page)
  await page.evaluate(() => { (window as unknown as { CapacitorCustomPlatform: { name: string } }).CapacitorCustomPlatform.name = 'android' })
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await page.getByRole('link', { name: /Einstellungen/ }).click()
  await page.getByRole('link', { name: /Druckansicht/ }).click()
}

test('Fehlender Android-Druckdialog bietet unabhängige PDF an; Share-Abbruch gilt nicht als Versand', async ({ page }) => {
  await mockPrintAdapter(page, false, true)
  const before = await savedSettings(page)
  await page.getByRole('radio', { name: 'QR-Code', exact: true }).click()
  await page.getByRole('button', { name: 'Drucken oder als PDF speichern', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Android konnte den Druckdialog nicht öffnen.')
  await page.getByRole('button', { name: 'PDF-Datei erstellen und teilen', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Das Teilen wurde beendet oder konnte nicht geöffnet werden.' })).toBeVisible()
  const calls = await page.evaluate(() => (window as unknown as { __printProbe: PrintProbe }).__printProbe.calls)
  expect(calls.map((call) => `${call.plugin}.${call.method}`)).toEqual(['AnkerNative.printPage', 'AnkerNative.exportPrintPdf', 'Share.share'])
  expect(calls[0]!.options.sheets).toEqual(calls[1]!.options.sheets)
  const sheet = calls[0]!.options.sheets![0]!
  expect(sheet.kind).toBe('qr')
  expect(JSON.stringify(sheet)).not.toContain(before.alarm.qrSecret)
  expect(await savedSettings(page)).toEqual(before)
})

test('Android-Druckübergabe bestätigt ausschließlich den geöffneten Dialog', async ({ page }) => {
  await mockPrintAdapter(page, true, false)
  await page.getByRole('button', { name: 'Drucken oder als PDF speichern', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Druckdialog geöffnet.')
  await expect(page.getByText(/erfolgreich gedruckt|erfolgreich geteilt/i)).toHaveCount(0)
})

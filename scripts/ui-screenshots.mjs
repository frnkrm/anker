// Reproducible UI review with an isolated browser database and synthetic sample data.
// npm run preview -- --port 4173, then node scripts/ui-screenshots.mjs http://127.0.0.1:4173 ./screenshots
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const baseURL = process.argv[2] ?? 'http://127.0.0.1:4173'
if (!['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Bitte einen lokalen Preview-Server verwenden.')
const output = resolve(process.argv[3] ?? 'screenshots')
const date = '2026-11-09'
const time = (value) => Date.parse(`${date}T${value}:00+01:00`)
const manifest = []
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) })
try {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin', locale: 'de-DE', serviceWorkers: 'block' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.clock.setFixedTime(new Date(time('10:00')))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await page.waitForURL(/\/$/)
  const fixture = await page.evaluate(({ date, now }) => new Promise((resolve, reject) => {
    const request = indexedDB.open('anker')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction('records', 'readwrite')
      const records = transaction.objectStore('records')
      let fixture
      const read = records.get(['settings', 'main'])
      read.onsuccess = () => {
        const settings = read.result.data
        settings.work = Array.from({ length: 7 }, (_, index) => ({ isWorkDay: index < 5, start: 480, durationMin: 480, pauseMin: 60, homeOffice: false }))
        settings.anchor = { ...settings.anchor, wake: 420, manual: { wake: true, bed: true, pcStop: true } }
        settings.pcStop = 1320; settings.bed = 1350
        settings.alarm.qrSecret = 'ANKER-DEMO-UI-REVIEW'
        settings.appearance.developerTools = true
        settings.integrations = { healthConnect: false, googleCalendar: false, writeCalendar: false, sync: false }
        const local = { commitments: [{ id: 'books', date, label: 'Bücher zurückbringen', context: 'personal', commitment: 'hard', start: 1080, end: 1110,
          locationKind: 'onsite', originPlaceId: 'home', placeId: 'library', placeLabel: 'Bibliothek', travelMin: 15, travelHomeMin: 15, prepMin: 15, arrivalBufferMin: 10, thenTo: 'home', status: 'planned' }],
          places: [{ id: 'library', label: 'Bibliothek', travelFromHomeMin: 30 }],
          work: [{ id: 'report', title: 'Wochenbericht vorbereiten', nextStep: 'Dokument öffnen', createdAt: now, estimateMin: 25, deadline: now + 7200000,
            subtasks: [{ id: 'points', title: 'Stichpunkte sammeln', estimateMin: 5 }] }],
          workSessions: [], tomorrowSteps: [], sleepDiary: {}, handover: {}, meds: {} }
        const day = { date, override: {}, steps: {}, wakeAt: now - 3 * 3600000 }
        fixture = [ { collection: 'settings', id: 'main', data: settings }, { collection: 'meta', id: 'local', data: local }, { collection: 'days', id: date, data: day },
          { collection: 'inbox', id: 'thought', data: { id: 'thought', text: 'Eine Idee fürs Wochenende', createdAt: now, status: 'open' } },
          { collection: 'inbox', id: 'task', data: { id: 'task', text: 'Wäsche starten', nextStep: 'Wäschekorb bereitstellen', createdAt: now, status: 'task', taskDate: date, estimateMin: 10 } } ]
        for (const record of fixture) records.put({ ...record, updated_at: now, dirty: 1, deleted: false })
      }
      transaction.oncomplete = () => { db.close(); resolve(fixture) }
      transaction.onabort = () => { db.close(); reject(transaction.error) }
    }
  }), { date, now: time('10:00') })

  async function seed(records = fixture) {
    await page.evaluate((records) => new Promise((resolve, reject) => {
      const request = indexedDB.open('anker')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('records', 'readwrite')
        for (const record of records) tx.objectStore('records').put({ ...record, updated_at: Date.now(), dirty: 1, deleted: false })
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onabort = () => { db.close(); reject(tx.error) }
      }
    }), records)
  }
  async function capture(route, name) {
    await page.goto(route)
    await page.locator('h1').first().waitFor({ state: 'visible' })
    await page.locator('[aria-busy="true"]').waitFor({ state: 'hidden' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(100)
    const file = `${String(manifest.length + 1).padStart(2, '0')}-${name}.png`
    await page.screenshot({ path: join(output, file), animations: 'disabled', caret: 'hide' })
    const files = [file]
    if (await page.evaluate(() => document.documentElement.scrollHeight > 900)) {
      const full = file.replace('.png', '-gesamt.png')
      await page.screenshot({ path: join(output, full), fullPage: true, animations: 'disabled', caret: 'hide', style: 'nav[aria-label="Hauptnavigation"]{position:static!important}' })
      files.push(full)
    }
    manifest.push({ requestedRoute: route, actualRoute: new URL(page.url()).pathname + new URL(page.url()).hash, name, files,
      sampleTime: new Date(await page.evaluate(() => Date.now())).toISOString(), titles: await page.locator('h1').allTextContents() })
    console.log(`Aufgenommen: ${name}`)
  }
  for (const hour of ['07:05', '10:00', '16:30', '19:00', '21:45', '22:05', '22:45']) {
    await seed(); await page.clock.setFixedTime(new Date(time(hour)))
    await capture('/', `jetzt-${hour.replace(':', '')}`)
  }
  const free = structuredClone(fixture)
  free.find((record) => record.collection === 'days').data.override = { dayType: 'weekend' }
  free.find((record) => record.collection === 'meta').data.commitments = []
  await seed(free); await page.clock.setFixedTime(new Date(time('23:30')))
  await capture('/', 'jetzt-freier-tag-2330')
  const routes = ['/tag', '/mehr', '/arbeit', '/arbeitszeit', '/abend', '/vorbereitung', '/inbox', '/spiel', '/spiel/shop', '/rueckblick', '/schlaf', '/zeiten', '/wecker', '/pc-stopp', '/verbindungen', '/backup', '/druck', '/orte', '/einstellungen',
    ...['arbeit', 'weg', 'schlaf', 'sport', 'abende', 'abendmodus', 'morgenroutine', 'abendroutine', 'erinnerungen', 'darstellung', 'hilfen', 'abenduebergang', 'assistenz'].map((section) => '/einstellungen/' + section),
    '/fokus/morning', '/fokus/evening', '/aufgabe/work/report', '/aufgabe/task/task']
  for (const route of process.argv.includes('--now-only') ? [] : routes) {
    await seed(); await page.clock.setFixedTime(new Date(time('10:00')))
    await capture(route, route.slice(1).replaceAll('/', '-'))
  }
  if (errors.length) throw new Error(`Browserfehler: ${errors.join('; ')}`)
  await writeFile(join(output, 'manifest.json'), JSON.stringify({ syntheticDataOnly: true, androidDeviceProof: false, viewport: { width: 390, height: 844, dpr: 2 }, date, fullPageNavigation: 'Gesamtansichten ordnen die feste Navigation ausschließlich für die Aufnahme unter dem Inhalt an.', captures: manifest }, null, 2))
  console.log(`${manifest.length} Ansichten erfolgreich aufgenommen.`)
} finally { await browser.close() }

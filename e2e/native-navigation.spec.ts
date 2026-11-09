/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { expect, test, type Page } from '@playwright/test'
import { defaultSettings } from '../src/core/defaults'
import { guidancePreferences } from '../src/core/guidance'
import type { ReminderDeliveryDiagnostics } from '../src/platform/native'

interface BridgeProbe {
  launchReads: number
  focusUntil: number
  listeners: Record<string, number>
  emit: (plugin: string, event: string, value: { url: string } | Record<string, never>) => void
  setRinging: (ringing: boolean) => void
  audioOk: boolean
  toneBlocked: boolean
  toneCalls: number
  reminderChannelOpens: string[]
  handoffReads: number
  handoffAcks: number
  launchReleased: boolean
  releaseLaunch: () => void
}

/** Browser simulation of Capacitor entry events, not an Android execution test. */
async function nativeEntry(page: Page, launchUrl: string, measurementEnabled = false, audio: { audioOk?: boolean; toneBlocked?: boolean; reminderDelivery?: ReminderDeliveryDiagnostics } = {}, layoutFontScale?: number, earlyHandoff = false) {
  const settings = { ...defaultSettings('2026-11-05'), onboarded: true }
  if (earlyHandoff) {
    settings.guidance = { ...guidancePreferences(), enabled: true, zeroGapMorning: true }
    settings.anchor = { ...settings.anchor, wake: 120, manual: { wake: true, bed: true, pcStop: true } }
    settings.routines.morning = [{ id: 'water', title: 'Ein Glas Wasser', minutes: 1 }]
    settings.sport.days = []
  }
  if (layoutFontScale !== undefined) {
    settings.appearance.fontScale = layoutFontScale
    settings.alarm.wakeCheckEnabled = true
    settings.alarm.medicationEnabled = true
    settings.alarm.medicationReminderAt = 7 * 60
  }
  settings.alarm.preWakeEnabled = measurementEnabled
  settings.alarm.smartWake.enabled = measurementEnabled
  await page.addInitScript(({ launchUrl, settings, audio, earlyHandoff }) => {
    const callbacks = new Map<string, { plugin: string; event: string; callback: (value: unknown) => void }>()
    let nextId = 0
    const alarm = { ringing: false, kind: null as string | null, snoozed: 0, scheduledAt: new Date('2026-11-06T06:30:00+01:00').getTime(), preWakeAt: new Date('2026-11-06T06:00:00+01:00').getTime() as number | null, preWakePausedForTargetAt: 0, exact: true, mainConfirmed: true, preWakeConfirmed: true }
    let measurementActive = false
    let handoffPending = earlyHandoff
    const handoffAt = Date.parse('2026-11-06T02:00:00+01:00')
    const records = [{ collection: 'settings', id: 'main', data: JSON.stringify(settings), updated_at: Date.now(), deleted: 0, dirty: 0 }]
    const probe: BridgeProbe = {
      launchReads: 0,
      focusUntil: 0,
      audioOk: audio.audioOk ?? true,
      toneBlocked: audio.toneBlocked ?? false,
      toneCalls: 0,
      reminderChannelOpens: [],
      handoffReads: 0,
      handoffAcks: 0,
      launchReleased: !earlyHandoff,
      releaseLaunch() {},
      listeners: {},
      emit(plugin, event, value) {
        for (const entry of [...callbacks.values()]) {
          if (entry.plugin === plugin && entry.event === event) entry.callback(value)
        }
      },
      setRinging(ringing) { alarm.ringing = ringing; alarm.kind = ringing ? 'test' : null },
    }
    Object.assign(window, {
      __ankerBridge: probe,
      CapacitorCustomPlatform: { name: 'android' },
      Capacitor: {
        PluginHeaders: [
          { name: 'App', methods: ['getLaunchUrl', 'getInfo', 'removeListener'].map((name) => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
          { name: 'AnkerNative', methods: ['getAlarmState', 'getAlarmDiagnostics', 'playTestTone', 'openReminderChannelSettings', 'getBedtimePromptState', 'getSmartWakeState', 'startSmartWake', 'stopSmartWake', 'syncAlarmConfig', 'drainReminderActions', 'setReminderFocus', 'removeListener', 'getMorningHandoff', 'ackMorningHandoff', 'syncRoutinePaceKeeper', 'stopRoutinePaceKeeper', 'stopSleepAudio', 'pcBridgeDrainEvents', 'pcBridgeConfigure', 'pcBridgeStop'].map((name) => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }]) },
          { name: 'CapacitorSQLite', methods: ['checkConnectionsConsistency', 'createConnection', 'open', 'execute', 'executeSet', 'query', 'run'].map((name) => ({ name, rtype: 'promise' })) },
        ],
        async nativePromise(plugin: string, method: string, options: { callbackId?: string; values?: (string | number)[]; set?: { values: (string | number)[] }[]; until?: number; channel?: string }) {
          if (method === 'removeListener') { callbacks.delete(options.callbackId!); return {} }
          if (plugin === 'App' && method === 'getLaunchUrl') {
            probe.launchReads++
            if (earlyHandoff) await new Promise<void>(resolve => { probe.releaseLaunch = () => { probe.launchReleased = true; resolve() } })
            return { url: launchUrl }
          }
          if (plugin === 'App' && method === 'getInfo') return { id: 'de.frnkrm.anker.mobile', name: 'Anker', version: 'simulation', build: '0' }
          if (plugin === 'AnkerNative' && (method === 'getAlarmState' || method === 'syncAlarmConfig')) return { ...alarm }
          if (plugin === 'AnkerNative' && method === 'getAlarmDiagnostics') return { ...alarm, notificationsEnabled: true, fullScreen: true, alarmVolume: 5, alarmVolumeMax: 7, audioOk: probe.audioOk, interruptionFilter: 1, testResult: '', sdk: 36, device: 'Browser simulation', reminderDelivery: audio.reminderDelivery }
          if (plugin === 'AnkerNative' && method === 'playTestTone') {
            probe.toneCalls++
            return { ok: !probe.toneBlocked }
          }
          if (plugin === 'AnkerNative' && method === 'getBedtimePromptState') return { phase: 'idle', overlayPermission: false, exact: true }
          if (plugin === 'AnkerNative' && method === 'openReminderChannelSettings') { probe.reminderChannelOpens.push(options.channel!); return {} }
          if (plugin === 'AnkerNative' && method === 'getSmartWakeState') return { active: measurementActive, phase: measurementActive ? 'waiting' : 'stopped', targetAt: alarm.scheduledAt, windowAt: alarm.scheduledAt - 45 * 60_000, hasMotion: true, microphoneGranted: true, preWakePausedForTargetAt: alarm.preWakePausedForTargetAt, message: measurementActive ? 'Vorbereitet.' : 'Beendet.' }
          if (plugin === 'AnkerNative' && method === 'startSmartWake') { measurementActive = true; alarm.preWakeAt = null; alarm.preWakePausedForTargetAt = alarm.scheduledAt; return {} }
          if (plugin === 'AnkerNative' && method === 'stopSmartWake') { measurementActive = false; return {} }
          if (plugin === 'AnkerNative' && method === 'setReminderFocus') { probe.focusUntil = options.until ?? 0; return {} }
          if (plugin === 'AnkerNative' && method === 'drainReminderActions') return { actions: [] }
          if (plugin === 'AnkerNative' && method === 'getMorningHandoff') { probe.handoffReads++; return { pending: handoffPending, antiRelapseAt: 0, ...(handoffPending ? { token: 'early-handoff', targetAt: handoffAt, at: handoffAt, method: 'qr' } : {}) } }
          if (plugin === 'AnkerNative' && method === 'ackMorningHandoff') { handoffPending = false; probe.handoffAcks++; return { acknowledged: true } }
          if (plugin === 'AnkerNative' && (method === 'syncRoutinePaceKeeper' || method === 'stopRoutinePaceKeeper')) return { active: false, phase: 'idle', speechStatus: 'idle' }
          if (plugin === 'AnkerNative' && method === 'stopSleepAudio') return { active: false, phase: 'stopped' }
          if (plugin === 'AnkerNative' && method === 'pcBridgeDrainEvents') return { events: [], lastSeq: 0 }
          if (plugin === 'AnkerNative' && method === 'pcBridgeConfigure') return { configured: true }
          if (plugin === 'AnkerNative' && method === 'pcBridgeStop') return { state: 'unpaired', connected: false, active: false }
          if (plugin === 'CapacitorSQLite') {
            if (method === 'checkConnectionsConsistency') return { result: false }
            if (method === 'query') return { values: records.filter((r) => !options.values?.length || (r.collection === options.values[0] && (!options.values[1] || r.id === options.values[1]))) }
            if (method === 'run' || method === 'executeSet') {
              const writes = method === 'executeSet' ? options.set!.map((entry) => entry.values) : [options.values!]
              for (const values of writes) {
                const [collection, id, data, updated_at, deleted, dirty] = values as [string, string, string, number, number, number]
                const index = records.findIndex((r) => r.collection === collection && r.id === id)
                const row = { collection, id, data, updated_at, deleted, dirty }
                if (index < 0) records.push(row); else records[index] = row
              }
            }
            return {}
          }
          throw new Error(`Unexpected native method: ${plugin}.${method}`)
        },
        nativeCallback(plugin: string, method: string, options: { eventName: string }, callback: (value: unknown) => void) {
          if (method !== 'addListener') throw new Error(`Unexpected native callback: ${plugin}.${method}`)
          const id = String(++nextId)
          callbacks.set(id, { plugin, event: options.eventName, callback })
          const key = `${plugin}.${options.eventName}`
          probe.listeners[key] = (probe.listeners[key] ?? 0) + 1
          return id
        },
      },
    })
  }, { launchUrl, settings, audio, earlyHandoff })
  await page.clock.setFixedTime(new Date('2026-11-06T02:00:00+01:00'))
  await page.goto('/')
  await expect.poll(async () => (await probe(page)).launchReads).toBe(1)
  if (earlyHandoff) {
    await expect(page).toHaveURL(/\/fokus\/morning$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ein Glas Wasser')
  } else {
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ab ins Bett')
  }
}

test('Ein verzögerter alter Startlink verdrängt keinen Morgenübergang und spätere Widget-Klicks bleiben möglich', async ({ page }) => {
  await nativeEntry(page, 'de.frnkrm.anker.mobile://now', false, {}, undefined, true)
  expect(await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.handoffAcks)).toBe(1)
  await page.getByRole('button', { name: 'Zurück', exact: true }).click()
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.releaseLaunch())
  await expect(page).toHaveURL(/\/mehr$/)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.handoffReads)).toBeGreaterThanOrEqual(2)
  await expect(page).toHaveURL(/\/mehr$/)
  await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.emit('App', 'appUrlOpen', { url: 'de.frnkrm.anker.mobile://now' }))
  await expect(page).toHaveURL(/\/$/)
  expect(await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.handoffAcks)).toBe(1)
})

test('Ein neuer klingelnder Alarm überholt einen alten Launchlink nach dem Morgenübergang', async ({ page }) => {
  await nativeEntry(page, 'de.frnkrm.anker.mobile://now', false, {}, undefined, true)
  await page.evaluate(() => {
    const bridge = (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge
    bridge.setRinging(true)
    bridge.emit('AnkerNative', 'alarmRinging', {})
    bridge.releaseLaunch()
  })
  await expect(page).toHaveURL(/\/wecker\/klingelt$/)
  await expect(page.getByRole('button', { name: 'Test beenden', exact: true })).toBeVisible()
  await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.emit('App', 'appUrlOpen', { url: 'de.frnkrm.anker.mobile://now' }))
  await expect(page).toHaveURL(/\/wecker\/klingelt$/)
})

async function probe(page: Page) {
  return page.evaluate(() => {
    const bridge = (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge
    return { launchReads: bridge.launchReads, listeners: bridge.listeners }
  })
}

test('Unterbrochener Ton bleibt eine Warnung; abgelehnter Testton meldet Fehler und lässt einen neuen Versuch zu', async ({ page }) => {
  await nativeEntry(page, 'de.frnkrm.anker.mobile://now', false, { audioOk: false, toneBlocked: true })
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await page.getByRole('link', { name: /Schlaf & Wecker/ }).click()
  await expect(page).toHaveURL(/\/wecker$/)
  await expect(page.getByText('Die letzte Tonausgabe war unterbrochen oder konnte nicht starten', { exact: true })).toBeVisible()
  await expect(page.getByText('Beim letzten Klingeln gab es keinen Ton', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Testton', exact: true }).click()
  const message = page.getByText('Der Testton konnte nicht starten. Prüfe andere Audioausgaben und versuche es bei geöffneter App erneut.', { exact: true })
  await expect(message).toBeVisible()
  await expect(page.getByText('Von dir als hörbar bestätigt', { exact: true })).toHaveCount(0)
  await page.evaluate(() => { (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.toneBlocked = false })
  await page.getByRole('button', { name: 'Testton', exact: true }).click()
  await expect(message).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.toneCalls)).toBe(2)
  await expect(page.getByText('Von dir als hörbar bestätigt', { exact: true })).toHaveCount(0)
})

test('Globale Freigabe verdeckt keinen blockierten Erinnerungskanal; Öffnen ändert keine Android-Freigabe', async ({ page }) => {
  await nativeEntry(page, 'de.frnkrm.anker.mobile://now', false, { reminderDelivery: {
    channels: [{ id: 'sanft', importance: 0, blocked: true }, { id: 'uebergang', importance: 2, blocked: false }, { id: 'wecker', importance: -1, blocked: false }],
    nextAt: new Date('2026-11-06T02:20:00+01:00').getTime(), nextChannel: 'sanft',
    focusUntil: new Date('2026-11-06T02:10:00+01:00').getTime(), quietUntil: 0, planQuietUntil: 0,
    storedSlots: 2, activeNotifications: 0, lastSyncAt: 0,
  } })
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await page.getByRole('link', { name: /Schlaf & Wecker/ }).click()
  await expect(page).toHaveURL(/\/wecker$/)
  const diagnosis = page.getByRole('region', { name: 'Alltags-Erinnerungen', exact: true })
  await expect(diagnosis.getByText('Sanfte Hinweise: in Android blockiert', { exact: true })).toBeVisible()
  await expect(diagnosis.getByText('Übergangshinweise: zugelassen', { exact: true })).toBeVisible()
  await expect(diagnosis.getByText('Weckerbezogene Hinweise: noch nicht angelegt', { exact: true })).toBeVisible()
  await expect(diagnosis.getByText('Android meldet aktuell 0 Alltagskarten. Gespeicherte Plätze: 2. Das bestätigt noch nicht, dass du einen Hinweis gesehen hast.', { exact: true })).toBeVisible()
  await expect(diagnosis.getByText(/Fokusschutz bis/)).toBeVisible()
  await expect(diagnosis.getByText('Seit dieser Diagnoseversion wurde noch kein erfolgreicher Erinnerungsabgleich erfasst.', { exact: true })).toBeVisible()
  await expect(page.getByText('Ohne sie siehst du die Wecker-Meldung nicht.', { exact: true })).toHaveCount(0)
  await diagnosis.getByRole('button', { name: 'Sanfte Hinweise in Android öffnen', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.reminderChannelOpens)).toEqual(['sanft'])
  await expect(diagnosis.getByText('Sanfte Hinweise: in Android blockiert', { exact: true })).toBeVisible()
})

for (const target of ['now', 'alarm']) {
  test(`Alter ${target}-Öffnungslink sperrt die Navigation bei Gute Nacht nicht`, async ({ page }) => {
    await nativeEntry(page, `de.frnkrm.anker.mobile://${target}`)
    const before = await probe(page)
    await page.getByRole('link', { name: 'Mehr', exact: true }).click()
    await expect(page.getByRole('link', { name: /Einstellungen/ })).toBeVisible()
    await page.evaluate(() => { history.pushState({}, '', '/geraetetest'); window.dispatchEvent(new PopStateEvent('popstate')) })
    await expect(page.getByLabel('Test auswählen', { exact: true })).toBeVisible()
    await page.getByText('Einzelne Bereiche prüfen', { exact: true }).click()
    await page.getByRole('button', { name: 'Zeiteingabe prüfen', exact: true }).click()
    await page.getByRole('button', { name: 'Uhrzeiten direkt ändern', exact: true }).click()
    await expect(page.getByLabel('PC-Stopp', { exact: true })).toBeVisible()
    expect(await probe(page)).toEqual(before)
    expect(before.launchReads).toBe(1)
    expect(before.listeners['App.appUrlOpen']).toBe(1)
    expect(before.listeners['AnkerNative.alarmRinging']).toBeGreaterThanOrEqual(1)
  })
}

test('Neue native Links und ein echter Klingelzustand bleiben nach Seitenwechsel erreichbar', async ({ page }) => {
  await nativeEntry(page, 'de.frnkrm.anker.mobile://now')
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await expect(page.getByRole('link', { name: /Einstellungen/ })).toBeVisible()
  await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.emit('App', 'appUrlOpen', { url: 'de.frnkrm.anker.mobile://evening' }))
  await expect(page).toHaveURL(/\/abend$/)
  await expect(page.getByRole('heading', { name: 'Abend & Alltag', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const bridge = (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge
    bridge.setRinging(true)
    bridge.emit('AnkerNative', 'alarmRinging', {})
  })
  await expect(page.getByRole('button', { name: 'Test beenden', exact: true })).toBeVisible()
  await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.emit('App', 'appUrlOpen', { url: 'de.frnkrm.anker.mobile://thoughts' }))
  await expect(page).toHaveURL(/\/wecker\/klingelt$/)
  expect((await probe(page)).launchReads).toBe(1)
})

test('Messnacht zeigt die Vorweckerpause vor Start, im Status und nach Messungsende', async ({ page }) => {
  await nativeEntry(page, 'de.frnkrm.anker.mobile://now', true)
  await page.getByRole('link', { name: 'Mehr', exact: true }).click()
  await page.getByRole('link', { name: /Schlaf & Wecker/ }).click()
  await expect(page.getByText(/Beim Start wird der Vorwecker für diese Nacht pausiert/)).toBeVisible()
  await page.getByRole('button', { name: 'Messung für diese Nacht starten', exact: true }).click()
  await expect(page.getByText(/Vorwecker für .* pausiert\./)).toBeVisible()
  await expect(page.getByText('Vorwecker: für diese Messnacht pausiert', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Messung beenden', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Messung für diese Nacht starten', exact: true })).toBeVisible()
  await expect(page.getByText(/Vorwecker für .* pausiert\./)).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Vorwecker', exact: true })).toBeChecked()
})

test('Laufender Fokus spiegelt nur sein tatsächliches Timerende und räumt beim Verlassen auf', async ({ page }) => {
  await nativeEntry(page, 'de.frnkrm.anker.mobile://now')
  await page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.emit('App', 'appUrlOpen', { url: 'de.frnkrm.anker.mobile://now' }))
  // A real route transition without reloading the native session.
  await page.getByRole('link', { name: 'Heute', exact: true }).click()
  await page.evaluate(() => { history.pushState({}, '', '/fokus/morning'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.getByRole('button', { name: 'Zurück', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.focusUntil)).toBeGreaterThan(new Date('2026-11-06T02:00:00+01:00').getTime())
  await page.getByRole('button', { name: 'Zurück', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ankerBridge: BridgeProbe }).__ankerBridge.focusUntil)).toBe(0)
})

for (const width of [390, 320]) for (const scale of [1, 1.6]) {
  test(`Wecker-Formular und Diagnose bei ${width}px / ${scale}`, async ({ page }) => {
    await page.setViewportSize({width, height:844})
    await nativeEntry(page, 'de.frnkrm.anker.mobile://now', true, {reminderDelivery: {
      channels: [{id:'sanft',importance:0,blocked:true},{id:'uebergang',importance:2,blocked:false},{id:'wecker',importance:-1,blocked:false}],
      nextAt:Date.parse('2026-11-06T02:20:00+01:00'),nextChannel:'sanft',focusUntil:Date.parse('2026-11-06T02:10:00+01:00'),quietUntil:0,planQuietUntil:0,storedSlots:2,activeNotifications:0,lastSyncAt:0,
    }}, scale)
    await page.getByRole('link', {name:'Mehr', exact:true}).click()
    await page.getByRole('link', {name:/Schlaf & Wecker/}).click()
    await expect(page.getByRole('heading',{level:1,name:'Schlaf & Wecker',exact:true})).toBeVisible()
    await expect(page.getByRole('region',{name:'Alltags-Erinnerungen'})).toBeVisible()
    for (const summary of await page.locator('details > summary').all()) await summary.click()
    const geometry = await page.locator('.settings-page').evaluate(root => {
      const visible=(node:HTMLElement)=>node.getClientRects().length>0
      const values=[...root.querySelectorAll<HTMLInputElement>('.setting-value')].filter(visible).map(node=>{
        const rect=node.getBoundingClientRect();return {x:rect.x,width:rect.width,height:rect.height}
      })
      const clipped=[...root.querySelectorAll<HTMLElement>('p,h1,h2,h3,summary,.setting-label,.setting-unit,.setting-value,button')].filter(visible)
        .filter(node=>node.scrollWidth>node.clientWidth+1 || getComputedStyle(node).textOverflow==='ellipsis')
        .map(node=>({tag:node.tagName,label:node.getAttribute('aria-label')||node.textContent?.slice(0,100),width:node.clientWidth,content:node.scrollWidth}))
      return {values,clipped,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth}
    })
    expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport+1)
    expect(geometry.clipped).toEqual([])
    expect(geometry.values).toHaveLength(4)
    for(const value of geometry.values) {expect(value.width).toBeCloseTo(160,0);expect(value.height).toBeGreaterThanOrEqual(44)}
    expect(Math.max(...geometry.values.map(value=>value.x))-Math.min(...geometry.values.map(value=>value.x))).toBeLessThanOrEqual(1)
    await page.getByRole('button',{name:'Vorwecker Minuten erhöhen',exact:true}).click()
    await expect(page.getByRole('spinbutton',{name:'Vorwecker Minuten',exact:true})).toHaveValue('35')
    await page.getByRole('button',{name:'Wachheits-Check Minuten verringern',exact:true}).click()
    await expect(page.getByRole('spinbutton',{name:'Wachheits-Check Minuten',exact:true})).toHaveValue('4')
    await page.getByLabel('Erinnerungszeit',{exact:true}).fill('07:25')
    await expect(page.getByLabel('Erinnerungszeit',{exact:true})).toHaveValue('07:25')
    await page.getByRole('radio',{name:'5',exact:true}).click()
    await expect(page.getByRole('radio',{name:'5',exact:true})).toHaveAttribute('aria-checked','true')
    if(width===320 && scale===1.6) {
      await page.screenshot({path:'/tmp/anker-alarm-layout-320-160.png',fullPage:true})
      await page.getByRole('region',{name:'Alltags-Erinnerungen'}).screenshot({path:'/tmp/anker-alarm-diagnosis-320-160.png'})
      await page.getByRole('group',{name:'Vorwecker Minuten ändern',exact:true}).screenshot({path:'/tmp/anker-alarm-prewake-320-160.png'})
    }
  })
}

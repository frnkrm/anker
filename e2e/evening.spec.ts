import { expect, test, type Page } from '@playwright/test'
import type { DayLog, Settings } from '../src/core/types'
import { openTodayAdjust } from './helpers/controls'
import { storedRecord } from './helpers/storage'

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-02T19:00:00+01:00'))
  await page.goto('/start')
  await page.getByRole('button', { name: 'Weiter' }).click()
  const time = (label: string) => page.getByLabel(label, { exact: true }).inputValue()
  const pcStop = await time('PC-Stopp')
  const bed = await time('Bett')
  await page.getByRole('button', { name: /Passt, los/ }).click()
  await expect(page).toHaveURL(/\/$/)
  return { pcStop, bed }
}

async function finishEvening(page: Page) {
  await page.goto('/fokus/evening')
  const heading = page.getByRole('heading', { level: 1 })
  const done = page.getByRole('button', { name: 'Erledigt', exact: true })
  await expect(done).toBeVisible()
  while (await done.count()) {
    const title = await heading.innerText()
    await done.click()
    await expect(heading).not.toHaveText(title)
  }
  await expect(heading).toHaveText('Abendroutine fertig')
  await expect.poll(async () => (await storedRecord<DayLog>(page, 'days', '2026-11-02'))?.eveningRoutineDoneAt ?? 0).toBeGreaterThan(0)
}

test('Abendroutine bietet nach PC-Stopp und Bettzeit keine neue Freizeit an', async ({ page }) => {
  const { pcStop, bed } = await onboard(page)
  await finishEvening(page)
  await expect(page.getByText(`Jetzt Freizeit bis ${pcStop}.`, { exact: true })).toBeVisible()

  await page.clock.setFixedTime(new Date(`2026-11-02T${pcStop}:00+01:00`))
  await page.reload()
  await expect(page.getByText(`Zeit zum Runterkommen. Bett um ${bed}.`, { exact: true })).toBeVisible()
  await expect(page.getByText(/Jetzt Freizeit/)).toHaveCount(0)

  await page.clock.setFixedTime(new Date(`2026-11-02T${bed}:00+01:00`))
  await page.reload()
  await expect(page.getByText('Jetzt ist Zeit fürs Bett.', { exact: true })).toBeVisible()
  await expect(page.getByText(/Jetzt Freizeit/)).toHaveCount(0)
})

test('Abend mit offenem Ende bekommt im Fokus keine erfundene Freizeitgrenze', async ({ page }) => {
  await onboard(page)
  await openTodayAdjust(page)
  await page.getByRole('dialog').getByText('Weitere Möglichkeiten', { exact: true }).click()
  await page.getByRole('button', { name: 'Länger wach bleiben', exact: true }).click()
  await page.getByRole('button', { name: 'Weiß ich noch nicht', exact: true }).click()
  await page.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await expect(page.getByText('Viel Spaß. Der Abend gehört dir. Ob dein PC die Änderung übernommen hat, ist nicht bestätigt.', { exact: true })).toBeVisible()
  await finishEvening(page)
  await expect(page.getByText('Für heute ist hier nichts mehr offen.', { exact: true })).toBeVisible()
  await expect(page.getByText(/Jetzt Freizeit bis/)).toHaveCount(0)
})

test('Abendeinstellungen sind gebündelt und optionale Schalter bleiben eine eigene Wahl', async ({ page }) => {
  await onboard(page)
  await expect(page.getByRole('button', { name: 'Heute anpassen', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Mehr' })).toBeVisible()
  await page.goto('/einstellungen')
  const planning = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Planung', exact: true }) })
  for (const section of ['schlaf', 'abend', 'routinen']) await expect(planning.locator(`a[href="/einstellungen/${section}"]`)).toBeVisible()
  await page.goto('/einstellungen/abendmodus')
  await expect(page).toHaveURL(/\/einstellungen\/abend#modus$/)
  const preset = page.getByRole('switch', { name: 'Abendmodus vorschlagen', exact: true })
  await expect(preset).toHaveAttribute('aria-checked', 'false')
  await preset.click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.support.eveningPreset.enabled).toBe(true)
  await page.reload()
  await expect(preset).toHaveAttribute('aria-checked', 'true')

  await page.goto('/einstellungen/arbeit')
  const quiet = page.getByRole('switch', { name: 'Arbeitsaufgaben nach Feierabend ruhigstellen', exact: true })
  await expect(quiet).toHaveAttribute('aria-checked', 'true')
  await quiet.click()
  await expect.poll(async () => (await storedRecord<Settings>(page, 'settings', 'main'))?.support.workAfterHoursQuiet).toBe(false)
  await page.reload()
  await expect(quiet).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('heading', { name: 'Nach Feierabend', exact: true })).toBeVisible()
})

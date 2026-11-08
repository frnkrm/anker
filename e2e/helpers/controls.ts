import { expect, type Locator, type Page } from '@playwright/test'

/** Selects the visible custom control by its actual form value, using real clicks. */
export async function chooseValue(page: Page, label: string, value: string | number, scope: Page | Locator = page): Promise<void> {
  const opener = scope.getByRole('combobox', { name: label, exact: true })
  const inline = scope.getByRole('radiogroup', { name: label, exact: true })
  await expect.poll(async () => await opener.isVisible() || await inline.isVisible()).toBe(true)
  const isSheet = await opener.count() > 0 && await opener.isVisible()
  if (isSheet) await opener.click()
  const area = isSheet ? page.getByRole('dialog').last() : scope
  const group = area.getByRole('radiogroup', { name: label, exact: true })
  await expect(group).toBeVisible()
  const option = group.locator(`button[value=${JSON.stringify(String(value))}]`)
  await expect(option).toHaveCount(1)
  await option.click()
}

/** Inspect the actual selectable list, then close it through the user-facing escape action. */
export async function choiceValues(page: Page, label: string): Promise<string[]> {
  const opener = page.getByRole('combobox', { name: label, exact: true })
  const inline = page.getByRole('radiogroup', { name: label, exact: true })
  await expect.poll(async () => await opener.isVisible() || await inline.isVisible()).toBe(true)
  if (await opener.count()) await opener.click()
  const group = page.getByRole('radiogroup', { name: label, exact: true })
  await expect(group).toBeVisible()
  const values = await group.getByRole('radio').evaluateAll((buttons) => buttons.map((button) => (button as HTMLButtonElement).value))
  if (await opener.count()) { await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0) }
  return values
}

/** Date display stays German; the picker input is the shared component's editing surface. */
export async function fillDate(page: Page, label: string, value: string, scope: Page | Locator = page): Promise<void> {
  await scope.getByLabel(`${label} auswählen`, { exact: true }).fill(value)
}

export async function openTodayAdjust(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Heute anpassen', exact: true }).click()
  return page.getByRole('dialog').last()
}

export async function expandDetails(page: Page, title: string, scope: Page | Locator = page): Promise<void> {
  const summary = scope.locator('summary').filter({ hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first()
  await expect(summary).toBeVisible()
  if (!await summary.evaluate((element) => (element.parentElement as HTMLDetailsElement).open)) await summary.click()
}

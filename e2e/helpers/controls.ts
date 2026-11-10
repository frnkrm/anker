import { expect, type Locator, type Page } from '@playwright/test'

/** The visible dialog can precede its effect's registered history entry. */
async function openedChoiceMarker(page: Page): Promise<string> {
  let marker = ''
  await expect.poll(async () => {
    marker = await page.evaluate(() => String(history.state?.ankerSheet ?? ''))
    return marker
  }).not.toBe('')
  return marker
}

/** Closing a top-level Sheet also has to consume its temporary history entry. */
async function settledChoice(opener: Locator, dialog: Locator, marker: string, nested: boolean): Promise<void> {
  await expect(dialog).toHaveCount(0)
  await expect(opener).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(() => opener.evaluate((element, previous) =>
    !element.closest('[inert], [aria-hidden="true"]') && (previous.nested || history.state?.ankerSheet !== previous.marker),
  { marker, nested })).toBe(true)
}

/** Selects the visible custom control by its actual form value, using real clicks. */
export async function chooseValue(page: Page, label: string, value: string | number, scope: Page | Locator = page): Promise<void> {
  const opener = scope.getByRole('combobox', { name: label, exact: true })
  const inline = scope.getByRole('radiogroup', { name: label, exact: true })
  await expect.poll(async () => await opener.isVisible() || await inline.isVisible()).toBe(true)
  const isSheet = await opener.count() > 0 && await opener.isVisible()
  const nested = isSheet && await opener.evaluate((element) => !!element.closest('[role="dialog"]'))
  if (isSheet) await opener.click()
  const dialog = page.getByRole('dialog', { name: label, exact: true })
  const area = isSheet ? dialog : scope
  const group = area.getByRole('radiogroup', { name: label, exact: true })
  await expect(group).toBeVisible()
  const option = group.locator(`button[value=${JSON.stringify(String(value))}]`)
  await expect(option).toHaveCount(1)
  const marker = isSheet ? await openedChoiceMarker(page) : ''
  const selectedLabel = isSheet ? await option.locator('span').last().innerText() : ''
  await option.click()
  if (isSheet) {
    await expect(opener.locator('span').first()).toHaveText(selectedLabel)
    await settledChoice(opener, dialog, marker, nested)
  } else await expect(option).toHaveAttribute('aria-checked', 'true')
}

/** Inspect the actual selectable list, then close it through the user-facing escape action. */
export async function choiceValues(page: Page, label: string): Promise<string[]> {
  const opener = page.getByRole('combobox', { name: label, exact: true })
  const inline = page.getByRole('radiogroup', { name: label, exact: true })
  await expect.poll(async () => await opener.isVisible() || await inline.isVisible()).toBe(true)
  const isSheet = await opener.count() > 0 && await opener.isVisible()
  const nested = isSheet && await opener.evaluate((element) => !!element.closest('[role="dialog"]'))
  if (isSheet) await opener.click()
  const dialog = page.getByRole('dialog', { name: label, exact: true })
  const group = (isSheet ? dialog : page).getByRole('radiogroup', { name: label, exact: true })
  await expect(group).toBeVisible()
  const values = await group.getByRole('radio').evaluateAll((buttons) => buttons.map((button) => (button as HTMLButtonElement).value))
  if (isSheet) {
    const marker = await openedChoiceMarker(page)
    await page.keyboard.press('Escape')
    await settledChoice(opener, dialog, marker, nested)
  }
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

import { expect, test } from '@playwright/test'

import { dismissVisibleEditPanels } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
  await page.reload()
})

test('saves, reloads, inserts, duplicates and deletes templates from the menu', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('template.example.com')
  await page.getByLabel('Link title').fill('Template card')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const card = page
    .getByTestId(/link-card-/)
    .filter({ hasText: 'Template card' })
  await expect(card).toHaveCount(1)
  await card.click()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Templates' }).click()
  await expect(page.getByTestId('templates-panel')).toBeVisible()

  await page.getByTestId('open-template-create').click()
  await page.getByLabel('Template name').fill('Starter')
  await page.getByRole('button', { name: 'Create template' }).click()

  await expect(page.getByTestId('template-status')).toContainText(
    'Saved template “Starter”.',
  )
  await expect(page.getByTestId('templates-panel')).toContainText('Starter')

  await page.keyboard.press('Escape')
  await card.click()
  await page.keyboard.press('Delete')
  await expect(page.getByTestId(/link-card-/)).toHaveCount(0)
  await page.waitForTimeout(300)

  await page.reload()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Templates' }).click()
  await expect(page.getByTestId('templates-panel')).toContainText('Starter')

  const starterTemplate = page
    .getByTestId('templates-panel')
    .locator('article')
    .filter({ hasText: 'Starter' })
    .first()

  await expect(
    starterTemplate.getByRole('img', { name: 'Template preview for Starter' }),
  ).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await starterTemplate.getByRole('button', { name: 'Download' }).click()
  const download = await downloadPromise

  await expect(page.getByTestId('template-status')).toContainText(
    'Downloaded “Starter”.',
  )
  expect(download.suggestedFilename()).toMatch(
    /^starter-\d{4}-\d{2}-\d{2}\.template\.json$/,
  )

  await starterTemplate.getByRole('button', { name: 'Insert' }).click()
  await expect(page.getByTestId('template-status')).toContainText(
    'Inserted “Starter”.',
  )
  await expect(page.getByTestId(/link-card-/)).toHaveCount(1)
  await expect(page.getByTestId(/link-card-/).first()).toContainText(
    'Template card',
  )

  await starterTemplate.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.getByTestId('templates-panel')).toContainText(
    'Starter copy',
  )

  const starterCopyTemplate = page
    .getByTestId('templates-panel')
    .locator('article')
    .filter({ hasText: 'Starter copy' })
    .first()

  await starterCopyTemplate.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete template' }).click()
  await expect(
    page
      .getByTestId('templates-panel')
      .locator('article')
      .filter({ hasText: 'Starter copy' }),
  ).toHaveCount(0)

  const refreshedStarterTemplate = page
    .getByTestId('templates-panel')
    .locator('article')
    .filter({ hasText: 'Starter' })
    .first()

  await refreshedStarterTemplate.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete template' }).click()
  await expect(
    page
      .getByTestId('templates-panel')
      .locator('article')
      .filter({ hasText: 'Starter' }),
  ).toHaveCount(0)
})

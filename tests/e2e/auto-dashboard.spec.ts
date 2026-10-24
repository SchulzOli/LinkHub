import { expect, test } from '@playwright/test'

import { dismissVisibleEditPanels } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('builds an Auto workspace from the links opened in LinkHub', async ({
  page,
  context,
}) => {
  await context.route('https://often.example.com/**', (route) =>
    route.fulfill({ body: 'ok', contentType: 'text/plain' }),
  )

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill('often.example.com')
  await page.getByLabel('Link title').fill('Often')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  await page.getByRole('button', { name: 'Toggle interaction mode' }).click()

  const pagePromise = context.waitForEvent('page')

  await page
    .getByTestId(/link-card-/)
    .filter({ hasText: 'Often' })
    .locator('a')
    .click()
  await (await pagePromise).close()
  await page.bringToFront()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('dialog').getByRole('tab', { name: 'Auto' }).click()
  await expect(page.getByTestId('auto-dashboard-panel')).toBeVisible()
  await expect(page.getByTestId('auto-dashboard-build')).toHaveCount(0)

  await page.getByLabel('Turn on the Auto dashboard').check()
  // Browser data only exists in the extension; the web build can't use it.
  await expect(page.getByLabel('Browsing history')).toBeDisabled()
  await expect(page.getByLabel('LinkHub clicks')).toBeChecked()

  await page.getByTestId('auto-dashboard-build').click()

  // The first build creates the Auto workspace and switches to it, which
  // closes the menu.
  await expect(page.getByTestId('auto-dashboard-panel')).toHaveCount(0, {
    timeout: 15000,
  })
  await expect(
    page.getByTestId(/link-card-/).filter({ hasText: 'Often' }),
  ).toHaveCount(1)
  await expect(page.getByText('Recently used')).toBeVisible()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('dialog').getByRole('tab', { name: 'Auto' }).click()
  await expect(page.getByTestId('auto-dashboard-status')).toContainText(
    'Built 1 link, 0 feeds, 0 charts.',
  )
  await page.keyboard.press('Escape')

  await page.getByTestId('workspace-rail-toggle').click()
  await expect(page.getByTestId('workspace-rail')).toContainText('Auto')

  // Settings survive a reload.
  await page.reload()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('dialog').getByRole('tab', { name: 'Auto' }).click()
  await expect(page.getByLabel('Turn on the Auto dashboard')).toBeChecked()
  await expect(page.getByTestId('auto-dashboard-build')).toHaveText('Rebuild')
})
